import { Injectable, Logger } from '@nestjs/common';
import { AiModelType, ApiChannelStatus, Prisma } from '@prisma/client';
import axios from 'axios';
import { randomUUID } from 'node:crypto';
import { Response } from 'express';

import { WebSearchHit, WebSearchService } from '../chat/web-search.service';
import { EncryptionService } from '../encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiSettingsService } from '../settings/ai-settings.service';
import { SystemSettingsService } from '../settings/system-settings.service';

type OpenaiErrorType = 'authentication_error' | 'invalid_request_error' | 'server_error';

type OpenaiErrorDescriptor = {
  status: number;
  message: string;
  type: OpenaiErrorType;
  code: string | null;
};

type CompletionRequestMessage = {
  role: string;
  content: unknown;
};

export type OpenaiChatCompletionsRequest = {
  model: string;
  messages: CompletionRequestMessage[];
  stream: boolean;
};

type ParseCompletionRequestResult =
  | { ok: true; data: OpenaiChatCompletionsRequest }
  | { ok: false; error: OpenaiErrorDescriptor };

type UpstreamMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type RuntimeModel = {
  modelKey: string;
  defaultParams: Prisma.JsonValue | null;
  channel: {
    baseUrl: string;
    apiKey: string | null;
    extraHeaders: Prisma.JsonValue | null;
    timeout: number;
  };
};

type CompletionResult = {
  content: string;
  providerData: {
    id: string | null;
    model: string | null;
    usage: unknown;
  };
};

type ResearchPlan = {
  objective: string;
  keyQuestions: string[];
  planSteps: string[];
  complexity: 'simple' | 'medium' | 'complex';
};

type ResearchIteration = {
  round: number;
  focus: string[];
  queries: string[];
  newHits: number;
  totalHits: number;
  note?: string;
};

type ResearchFindings = {
  generatedAt: string;
  webSearchEnabled: boolean;
  note?: string;
  queries: string[];
  totalHits: number;
  iterations: ResearchIteration[];
  hits: Array<{
    query: string;
    title: string;
    url: string;
    domain: string;
    publishedAt: string | null;
    snippet: string;
    pageContent: string;
    score: number | null;
  }>;
};

type FollowUpSearchPlan = {
  stop: boolean;
  reason?: string;
  gaps: string[];
  queries: string[];
};

type ResolveModelResult = {
  requestModelId: string;
  runtimeModel: RuntimeModel;
};

class OpenaiHttpError extends Error {
  status: number;
  type: OpenaiErrorType;
  code: string | null;

  constructor(status: number, message: string, type: OpenaiErrorType, code: string | null) {
    super(message);
    this.status = status;
    this.type = type;
    this.code = code;
  }
}

@Injectable()
export class OpenaiDeepResearchService {
  private static readonly MODEL_SUFFIX = '-deepresearch';
  private static readonly WEB_SEARCH_MAX_QUERY_COUNT = 6;
  private readonly logger = new Logger(OpenaiDeepResearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly aiSettings: AiSettingsService,
    private readonly systemSettings: SystemSettingsService,
    private readonly webSearch: WebSearchService,
  ) {}

  verifyAccess(authorizationHeader: string | undefined): OpenaiErrorDescriptor | null {
    const configured = this.getAllowedAccessKeys();
    if (configured.length === 0) {
      return {
        status: 503,
        message: 'OpenAI Deep Research API key is not configured',
        type: 'server_error',
        code: 'api_key_not_configured',
      };
    }

    const token = this.extractBearerToken(authorizationHeader);
    if (!token) {
      return {
        status: 401,
        message: 'Missing Bearer token',
        type: 'authentication_error',
        code: 'missing_api_key',
      };
    }

    if (!configured.includes(token)) {
      return {
        status: 403,
        message: 'Invalid API key',
        type: 'authentication_error',
        code: 'invalid_api_key',
      };
    }

    return null;
  }

  parseCompletionRequest(body: unknown): ParseCompletionRequestResult {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return {
        ok: false,
        error: {
          status: 400,
          message: 'Invalid request body',
          type: 'invalid_request_error',
          code: 'invalid_body',
        },
      };
    }

    const payload = body as Record<string, unknown>;
    const modelRaw = payload.model;
    const messagesRaw = payload.messages;
    const streamRaw = payload.stream;

    const model = typeof modelRaw === 'string' ? modelRaw.trim() : '';
    if (!model) {
      return {
        ok: false,
        error: {
          status: 400,
          message: '`model` is required',
          type: 'invalid_request_error',
          code: 'missing_model',
        },
      };
    }

    if (!Array.isArray(messagesRaw)) {
      return {
        ok: false,
        error: {
          status: 400,
          message: '`messages` must be an array',
          type: 'invalid_request_error',
          code: 'invalid_messages',
        },
      };
    }

    const messages: CompletionRequestMessage[] = [];
    for (const row of messagesRaw) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const item = row as Record<string, unknown>;
      const role = typeof item.role === 'string' ? item.role.trim() : '';
      if (!role) continue;
      messages.push({
        role,
        content: item.content,
      });
      if (messages.length >= 100) break;
    }

    if (messages.length === 0) {
      return {
        ok: false,
        error: {
          status: 400,
          message: '`messages` cannot be empty',
          type: 'invalid_request_error',
          code: 'empty_messages',
        },
      };
    }

    if (streamRaw !== true) {
      return {
        ok: false,
        error: {
          status: 400,
          message: '`stream` must be true for deep research requests',
          type: 'invalid_request_error',
          code: 'stream_required',
        },
      };
    }

    const stream = true;
    return {
      ok: true,
      data: {
        model,
        messages,
        stream,
      },
    };
  }

  async buildModelListPayload() {
    const rows = await this.prisma.aiModel.findMany({
      where: {
        type: AiModelType.chat,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        modelKey: true,
        createdAt: true,
      },
    });

    const dedup = new Set<string>();
    const data = rows
      .filter((row) => {
        const key = (row.modelKey || '').trim();
        if (!key || dedup.has(key)) return false;
        dedup.add(key);
        return true;
      })
      .map((row) => ({
        id: `${row.modelKey}${OpenaiDeepResearchService.MODEL_SUFFIX}`,
        object: 'model',
        created: Math.floor(row.createdAt.getTime() / 1000),
        owned_by: 'aigallery',
        root: row.modelKey,
        parent: null as string | null,
      }));

    return {
      object: 'list',
      data,
    };
  }

  async handleNonStreamCompletion(request: OpenaiChatCompletionsRequest) {
    const resolved = await this.resolveModel(request.model);
    const topic = this.extractTopicFromMessages(request.messages);
    const conversationContext = this.buildConversationContext(request.messages);
    const reasoningChunks: string[] = [];

    const report = await this.runDeepResearch({
      topic,
      conversationContext,
      runtimeModel: resolved.runtimeModel,
      onReasoning: (chunk) => {
        reasoningChunks.push(chunk);
      },
    });

    const reasoning = reasoningChunks.join('').trim();
    const created = Math.floor(Date.now() / 1000);
    const id = this.buildCompletionId();
    const usage = this.estimateUsage(request.messages, reasoning, report);

    return {
      id,
      object: 'chat.completion',
      created,
      model: resolved.requestModelId,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: report,
            ...(reasoning ? { reasoning_content: reasoning } : {}),
          },
          finish_reason: 'stop',
        },
      ],
      usage,
    };
  }

  async handleNonStreamCompletionWithHeartbeat(request: OpenaiChatCompletionsRequest, res: Response) {
    let closed = false;
    let wroteHeartbeat = false;

    res.on('close', () => {
      closed = true;
    });

    res.status(200);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const heartbeat = setInterval(() => {
      if (closed || res.writableEnded) return;
      try {
        res.write(' ');
        wroteHeartbeat = true;
      } catch {
        // client may have gone away
      }
    }, 10_000);

    try {
      const payload = await this.handleNonStreamCompletion(request);
      if (closed || res.writableEnded) return;
      const body = JSON.stringify(payload);
      res.write((wroteHeartbeat ? '\n' : '') + body);
      res.end();
    } catch (error) {
      if (closed || res.writableEnded) return;
      const normalized = this.normalizeOpenaiError(error);

      if (!wroteHeartbeat && !res.headersSent) {
        this.sendJsonError(res, normalized.status, normalized.message, normalized.type, normalized.code);
        return;
      }

      const body = JSON.stringify({
        error: {
          message: normalized.message,
          type: normalized.type,
          param: null,
          code: normalized.code,
        },
      });
      res.write((wroteHeartbeat ? '\n' : '') + body);
      res.end();
    } finally {
      clearInterval(heartbeat);
    }
  }

  async handleStreamCompletion(request: OpenaiChatCompletionsRequest, res: Response) {
    let resolved: ResolveModelResult;
    let topic = '';
    let conversationContext = '';

    try {
      resolved = await this.resolveModel(request.model);
      topic = this.extractTopicFromMessages(request.messages);
      conversationContext = this.buildConversationContext(request.messages);
    } catch (error) {
      const normalized = this.normalizeOpenaiError(error);
      this.sendJsonError(res, normalized.status, normalized.message, normalized.type, normalized.code);
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const id = this.buildCompletionId();
    const created = Math.floor(Date.now() / 1000);
    const model = resolved.requestModelId;
    let closed = false;

    res.on('close', () => {
      closed = true;
    });

    const emitChunk = (delta: Record<string, unknown>, finishReason: string | null = null) => {
      if (closed || res.writableEnded) return;
      const payload = {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [
          {
            index: 0,
            delta,
            finish_reason: finishReason,
          },
        ],
      };
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        (res as Response & { flush?: () => void }).flush?.();
      } catch {
        closed = true;
      }
    };

    const emitDone = () => {
      if (closed || res.writableEnded) return;
      try {
        res.write('data: [DONE]\n\n');
      } catch {
        // ignore
      }
      try {
        res.end();
      } catch {
        // ignore
      }
    };

    const keepAlive = setInterval(() => {
      if (closed || res.writableEnded) return;
      try {
        res.write(': ping\n\n');
        (res as Response & { flush?: () => void }).flush?.();
      } catch {
        closed = true;
      }
    }, 10_000);

    try {
      emitChunk({ role: 'assistant' });

      const report = await this.runDeepResearch({
        topic,
        conversationContext,
        runtimeModel: resolved.runtimeModel,
        onReasoning: (chunk) => {
          for (const part of this.splitForStreaming(chunk, 240)) {
            emitChunk({ reasoning_content: part });
          }
        },
      });

      for (const part of this.splitForStreaming(report, 300)) {
        emitChunk({ content: part });
      }

      emitChunk({}, 'stop');
      emitDone();
    } catch (error) {
      if (closed || res.writableEnded) {
        clearInterval(keepAlive);
        return;
      }
      const normalized = this.normalizeOpenaiError(error);
      const errPayload = {
        error: {
          message: normalized.message,
          type: normalized.type,
          param: null,
          code: normalized.code,
        },
      };
      try {
        res.write(`data: ${JSON.stringify(errPayload)}\n\n`);
      } catch {
        // ignore
      }
      emitDone();
    } finally {
      clearInterval(keepAlive);
    }
  }

  sendJsonError(
    res: Response,
    status: number,
    message: string,
    type: OpenaiErrorType,
    code: string | null,
  ) {
    res.status(status).json({
      error: {
        message,
        type,
        param: null,
        code,
      },
    });
  }

  normalizeOpenaiError(error: unknown): OpenaiErrorDescriptor {
    if (error instanceof OpenaiHttpError) {
      return {
        status: error.status,
        message: error.message,
        type: error.type,
        code: error.code,
      };
    }

    return {
      status: 500,
      message: this.normalizeErrorMessage(error),
      type: 'server_error',
      code: 'internal_error',
    };
  }

  normalizeErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message || 'Internal Server Error';
    }
    return 'Internal Server Error';
  }

  private getAllowedAccessKeys() {
    const raw = process.env.OPENAI_DEEP_RESEARCH_API_KEY || '';
    return raw
      .split(/[,\n;]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private extractBearerToken(value: string | undefined) {
    const raw = (value || '').trim();
    if (!raw) return '';
    const match = raw.match(/^Bearer\s+(.+)$/i);
    if (!match) return '';
    return match[1].trim();
  }

  private buildCompletionId() {
    return `chatcmpl_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
  }

  private splitForStreaming(text: string, maxChunkSize: number) {
    const source = text || '';
    if (!source) return [];
    const size = Math.max(32, Math.min(1200, Math.trunc(maxChunkSize)));
    const out: string[] = [];
    let cursor = 0;

    while (cursor < source.length) {
      const next = Math.min(source.length, cursor + size);
      out.push(source.slice(cursor, next));
      cursor = next;
    }

    return out;
  }

  private estimateUsage(messages: CompletionRequestMessage[], reasoning: string, report: string) {
    const promptText = messages
      .map((item) => this.extractTextFromMessageContent(item.content))
      .filter((item) => item.length > 0)
      .join('\n');
    const promptTokens = this.estimateTokens(promptText);
    const completionTokens = this.estimateTokens(`${reasoning}\n${report}`);
    return {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    };
  }

  private estimateTokens(text: string) {
    const source = (text || '').trim();
    if (!source) return 0;
    return Math.max(1, Math.ceil(source.length / 4));
  }

  private extractTopicFromMessages(messages: CompletionRequestMessage[]) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const row = messages[index];
      const role = (row.role || '').trim().toLowerCase();
      if (role !== 'user') continue;
      const text = this.extractTextFromMessageContent(row.content);
      if (text) return text.slice(0, 8000);
    }

    throw new OpenaiHttpError(400, 'No user message found', 'invalid_request_error', 'missing_user_message');
  }

  private buildConversationContext(messages: CompletionRequestMessage[]) {
    const rows = messages.slice(-12);
    const lines: string[] = [];

    for (const row of rows) {
      const role = (row.role || '').trim().toLowerCase();
      if (!role) continue;
      const text = this.extractTextFromMessageContent(row.content);
      if (!text) continue;
      lines.push(`${role}: ${text.slice(0, 600)}`);
    }

    return lines.join('\n').slice(0, 5000);
  }

  private extractTextFromMessageContent(content: unknown): string {
    if (typeof content === 'string') {
      return this.normalizeLine(content).slice(0, 8000);
    }

    if (Array.isArray(content)) {
      const out: string[] = [];
      for (const item of content) {
        if (typeof item === 'string') {
          const t = this.normalizeLine(item);
          if (t) out.push(t);
          continue;
        }
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const obj = item as Record<string, unknown>;
        const type = typeof obj.type === 'string' ? obj.type.trim().toLowerCase() : '';
        if (type && type !== 'text') continue;
        if (typeof obj.text === 'string') {
          const t = this.normalizeLine(obj.text);
          if (t) out.push(t);
          continue;
        }
        if (typeof obj.content === 'string') {
          const t = this.normalizeLine(obj.content);
          if (t) out.push(t);
        }
      }
      return this.normalizeLine(out.join(' ')).slice(0, 8000);
    }

    if (content && typeof content === 'object') {
      const obj = content as Record<string, unknown>;
      if (typeof obj.text === 'string') return this.normalizeLine(obj.text).slice(0, 8000);
      if (typeof obj.content === 'string') return this.normalizeLine(obj.content).slice(0, 8000);
    }

    return '';
  }

  private async resolveModel(requestModel: string): Promise<ResolveModelResult> {
    const model = (requestModel || '').trim();
    if (!model.endsWith(OpenaiDeepResearchService.MODEL_SUFFIX)) {
      throw new OpenaiHttpError(
        400,
        `Model must end with ${OpenaiDeepResearchService.MODEL_SUFFIX}`,
        'invalid_request_error',
        'invalid_model_name',
      );
    }

    const modelKey = model.slice(0, -OpenaiDeepResearchService.MODEL_SUFFIX.length).trim();
    if (!modelKey) {
      throw new OpenaiHttpError(400, 'Invalid model name', 'invalid_request_error', 'invalid_model_name');
    }

    const row = await this.prisma.aiModel.findFirst({
      where: {
        type: AiModelType.chat,
        isActive: true,
        modelKey,
      },
      include: {
        channel: {
          select: {
            baseUrl: true,
            apiKey: true,
            extraHeaders: true,
            timeout: true,
            status: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    if (!row) {
      throw new OpenaiHttpError(404, `Model not found: ${model}`, 'invalid_request_error', 'model_not_found');
    }

    if (row.channel.status !== ApiChannelStatus.active) {
      throw new OpenaiHttpError(400, 'Model channel is inactive', 'invalid_request_error', 'inactive_channel');
    }

    return {
      requestModelId: `${row.modelKey}${OpenaiDeepResearchService.MODEL_SUFFIX}`,
      runtimeModel: {
        modelKey: row.modelKey,
        defaultParams: row.defaultParams,
        channel: {
          baseUrl: row.channel.baseUrl,
          apiKey: row.channel.apiKey,
          extraHeaders: row.channel.extraHeaders,
          timeout: row.channel.timeout,
        },
      },
    };
  }

  private async runDeepResearch(options: {
    topic: string;
    conversationContext: string;
    runtimeModel: RuntimeModel;
    onReasoning?: (chunk: string) => void;
  }) {
    const emitReasoning = (text: string) => {
      const normalized = text.trim();
      if (!normalized) return;
      const chunk = `${normalized}\n\n`;
      options.onReasoning?.(chunk);
    };

    emitReasoning(`### 任务理解\n- 主题：${options.topic}`);
    if (options.conversationContext) {
      emitReasoning(`- 对话上下文：已纳入分析（长度 ${options.conversationContext.length}）`);
    }

    const plan = await this.decomposeTopic(options.topic, options.runtimeModel, options.conversationContext);
    emitReasoning(
      [
        '### 研究任务拆解',
        `- 目标：${plan.objective}`,
        `- 复杂度：${plan.complexity}`,
        `- 关键问题：${plan.keyQuestions.join('；') || '无'}`,
        `- 执行步骤：${plan.planSteps.join(' -> ') || '无'}`,
      ].join('\n'),
    );

    const queries = await this.generateSearchQueries(
      options.topic,
      plan,
      options.runtimeModel,
      options.conversationContext,
    );
    emitReasoning(
      [
        '### 首轮搜索规划',
        ...queries.map((item, index) => `- Q${index + 1}: ${item}`),
      ].join('\n'),
    );

    const findings = await this.runIterativeResearch(options.topic, plan, options.runtimeModel, queries, emitReasoning);
    emitReasoning(
      [
        '### 研究循环完成',
        `- 轮次：${findings.iterations.length}`,
        `- 检索词总数：${findings.queries.length}`,
        `- 有效证据：${findings.totalHits}`,
        findings.note ? `- 备注：${findings.note}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );

    const report = await this.generateReport(
      options.topic,
      plan,
      findings,
      options.runtimeModel,
      options.conversationContext,
    );

    emitReasoning('### 报告写作\n- 已根据证据完成研究报告生成');

    return report.content;
  }

  private async decomposeTopic(
    topic: string,
    model: RuntimeModel,
    conversationContext?: string,
  ): Promise<ResearchPlan> {
    const prompt = [
      '你是资深研究规划师。请将用户研究主题拆解为可执行计划。',
      '只输出 JSON，不要输出任何额外解释。',
      'JSON 结构：{"objective":"...","keyQuestions":["..."],"planSteps":["..."],"complexity":"simple|medium|complex"}',
      '要求：',
      '1) keyQuestions 至少 3 条；planSteps 至少 4 条。',
      '2) complexity 仅能是 simple/medium/complex。',
    ].join('\n');

    const userPayload = [
      `研究主题：${topic}`,
      conversationContext ? `对话上下文：\n${conversationContext}` : '',
    ]
      .filter((item) => item.length > 0)
      .join('\n\n');

    const completion = await this.requestCompletionByModel(model, [
      { role: 'system', content: prompt },
      { role: 'user', content: userPayload },
    ]);

    const parsed = this.parseJsonObject(completion.content);
    const objective = this.normalizeLine((parsed.objective as string) || topic) || topic;

    const keyQuestions = this.normalizeStringArray(parsed.keyQuestions).slice(0, 8);
    const planSteps = this.normalizeStringArray(parsed.planSteps).slice(0, 10);

    const complexityRaw = this.normalizeLine((parsed.complexity as string) || 'medium').toLowerCase();
    const complexity: ResearchPlan['complexity'] =
      complexityRaw === 'simple' ? 'simple' : complexityRaw === 'complex' ? 'complex' : 'medium';

    return {
      objective,
      keyQuestions:
        keyQuestions.length > 0
          ? keyQuestions
          : ['核心问题是什么？', '关键变量有哪些？', '结论需要哪些证据支持？'],
      planSteps:
        planSteps.length > 0
          ? planSteps
          : ['明确研究范围与目标', '收集权威资料与数据', '交叉验证信息并提炼结论', '形成可执行建议'],
      complexity,
    };
  }

  private async generateSearchQueries(
    topic: string,
    plan: ResearchPlan,
    model: RuntimeModel,
    conversationContext?: string,
  ): Promise<string[]> {
    const prompt = [
      '你是联网检索词生成器。请根据研究主题和问题拆解，生成可直接用于搜索引擎的检索词。',
      '只输出 JSON，格式：{"queries":["检索词1","检索词2"]}',
      '限制：',
      '1) 3-6 条查询词。',
      '2) 每条查询词尽量包含实体、约束条件、时间限定（必要时）。',
      '3) 不要输出解释文本。',
      '4) 不要直接把用户长文本原样复制成查询词。',
    ].join('\n');

    const userPayload = [
      `研究主题：${topic}`,
      `研究目标：${plan.objective}`,
      `关键问题：${plan.keyQuestions.join('；')}`,
      conversationContext ? `对话上下文：\n${conversationContext}` : '',
    ]
      .filter((item) => item.length > 0)
      .join('\n\n');

    const completion = await this.requestQueryPlannerCompletion(
      plan,
      model,
      [
        { role: 'system', content: prompt },
        { role: 'user', content: userPayload },
      ],
      { temperature: 0.2 },
    );

    const parsed = this.parseJsonObject(completion.content);
    const topicNormalized = this.normalizeLine(topic);
    const queries = this.normalizeStringArray(parsed.queries)
      .map((item) => this.normalizeLine(item).slice(0, 120))
      .filter((item) => item.length > 0)
      .filter((item) => !this.isTopicCopyQuery(item, topicNormalized))
      .slice(0, OpenaiDeepResearchService.WEB_SEARCH_MAX_QUERY_COUNT);

    const merged = this.mergeQueries([], queries, OpenaiDeepResearchService.WEB_SEARCH_MAX_QUERY_COUNT);
    if (merged.length > 0) return merged;

    const fallback = this.buildFallbackQueries(topic, plan, 4);
    return fallback.length > 0 ? fallback : ['行业现状 关键趋势 权威来源'];
  }

  private async runIterativeResearch(
    topic: string,
    plan: ResearchPlan,
    model: RuntimeModel,
    initialQueries: string[],
    emitReasoning: (chunk: string) => void,
  ): Promise<ResearchFindings> {
    const maxRounds = this.resolveResearchRounds(plan.complexity);
    const hitTarget = this.resolveHitTarget(plan.complexity);

    let allQueries = this.mergeQueries([], initialQueries, 24);
    const allHits: ResearchFindings['hits'] = [];
    const seenUrls = new Set<string>();
    const iterations: ResearchIteration[] = [];
    const notes: string[] = [];
    let webSearchEnabled = true;

    for (let round = 1; round <= maxRounds; round += 1) {
      let roundQueries = round === 1 ? allQueries.slice(0, 6) : [];
      let roundFocus = round === 1 ? plan.keyQuestions.slice(0, 4) : [];
      let roundNote = '';

      if (round > 1) {
        const followUp = await this.generateFollowUpSearchPlan(topic, plan, allQueries, allHits, model, round);
        roundFocus = followUp.gaps.length > 0 ? followUp.gaps.slice(0, 4) : plan.keyQuestions.slice(0, 4);
        roundNote = followUp.reason || '';

        if (followUp.stop) {
          if (roundNote) notes.push(roundNote);
          emitReasoning(`### 第 ${round} 轮\n- 迭代规划判定可停止：${roundNote || '证据覆盖已足够'}`);
          break;
        }

        roundQueries = this.filterNewQueries(followUp.queries, allQueries).slice(0, 6);
        if (roundQueries.length === 0) {
          notes.push('迭代检索已无新增查询词，提前结束。');
          emitReasoning(`### 第 ${round} 轮\n- 无新增查询词，提前结束`);
          break;
        }

        allQueries = this.mergeQueries(allQueries, roundQueries, 24);
      }

      emitReasoning(
        [
          `### 第 ${round} 轮检索`,
          `- 关注点：${roundFocus.join('；') || '无'}`,
          `- 查询词：${roundQueries.join(' | ') || '无'}`,
        ].join('\n'),
      );

      const roundFindings = await this.collectFindings(roundQueries, {
        existingUrls: seenUrls,
        maxHits: this.resolveRoundMaxHits(plan.complexity, round),
      });

      webSearchEnabled = roundFindings.webSearchEnabled;
      for (const hit of roundFindings.hits) {
        if (seenUrls.has(hit.url)) continue;
        seenUrls.add(hit.url);
        allHits.push(hit);
      }

      if (roundFindings.note) {
        roundNote = roundNote ? `${roundNote} ${roundFindings.note}` : roundFindings.note;
      }

      iterations.push({
        round,
        focus: roundFocus,
        queries: roundQueries,
        newHits: roundFindings.hits.length,
        totalHits: allHits.length,
        note: roundNote || undefined,
      });

      emitReasoning(
        [
          `- 本轮新增证据：${roundFindings.hits.length}`,
          `- 累计证据：${allHits.length}`,
          roundNote ? `- 备注：${roundNote}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );

      if (!roundFindings.webSearchEnabled) {
        notes.push('联网搜索未启用，无法继续迭代检索。');
        break;
      }

      if (roundFindings.hits.length === 0) {
        notes.push(`第 ${round} 轮未获得新增证据，提前结束。`);
        break;
      }

      if (allHits.length >= hitTarget) {
        notes.push(`证据命中已达到 ${allHits.length} 条，覆盖度满足当前任务。`);
        break;
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      webSearchEnabled,
      note: notes.length > 0 ? notes.join(' ') : undefined,
      queries: allQueries,
      totalHits: allHits.length,
      iterations,
      hits: allHits,
    };
  }

  private async generateFollowUpSearchPlan(
    topic: string,
    plan: ResearchPlan,
    usedQueries: string[],
    hits: ResearchFindings['hits'],
    model: RuntimeModel,
    round: number,
  ): Promise<FollowUpSearchPlan> {
    const evidenceDigest = hits
      .slice(0, 8)
      .map((item, index) => {
        const excerpt = this.normalizeLine(`${item.snippet || ''} ${item.pageContent || ''}`).slice(0, 220);
        const parts = [`[E${index + 1}] ${item.title || '未命名来源'}`, `URL: ${item.url}`];
        if (item.publishedAt) parts.push(`Published: ${item.publishedAt}`);
        if (item.domain) parts.push(`Domain: ${item.domain}`);
        if (excerpt) parts.push(`Summary: ${excerpt}`);
        return parts.join('\n');
      })
      .join('\n\n');

    const prompt = [
      '你是研究任务中的迭代检索规划器。',
      '请判断现有证据是否足够回答问题：若足够则 stop=true；否则给出下一轮检索词。',
      '只输出 JSON，不要额外文本。',
      '格式：{"stop":true|false,"reason":"...","gaps":["缺口1"],"queries":["检索词1"]}',
      '要求：',
      '1) 若 stop=true，queries 应为空数组。',
      '2) 若 stop=false，queries 输出 2-5 条，聚焦信息缺口，避免与历史检索词重复。',
      '3) gaps 至少 1 条，表示待补证据点。',
    ].join('\n');

    const userPayload = [
      `研究主题：${topic}`,
      `当前轮次：${round}`,
      `研究目标：${plan.objective}`,
      `关键问题：${plan.keyQuestions.join('；')}`,
      `历史检索词：${usedQueries.join(' | ') || '无'}`,
      `已收集证据数：${hits.length}`,
      '',
      '证据摘要：',
      evidenceDigest || '暂无证据摘要',
    ].join('\n');

    const completion = await this.requestQueryPlannerCompletion(
      plan,
      model,
      [
        { role: 'system', content: prompt },
        { role: 'user', content: userPayload },
      ],
      { temperature: 0.2 },
    );

    const parsed = this.parseJsonObject(completion.content);
    const stopRaw = parsed.stop;
    const stop = stopRaw === true || String(stopRaw).toLowerCase() === 'true';
    const reason = this.normalizeLine((parsed.reason as string) || '');
    const gaps = this.normalizeStringArray(parsed.gaps).slice(0, 6);
    const queries = this.filterNewQueries(this.normalizeStringArray(parsed.queries).slice(0, 6), usedQueries).slice(0, 6);

    if (stop) {
      return {
        stop: true,
        reason: reason || '现有证据已覆盖主要问题。',
        gaps,
        queries: [],
      };
    }

    if (queries.length === 0) {
      return {
        stop: true,
        reason: reason || '未生成新增检索词。',
        gaps,
        queries: [],
      };
    }

    return {
      stop: false,
      reason,
      gaps,
      queries,
    };
  }

  private async collectFindings(
    queries: string[],
    options?: {
      existingUrls?: Set<string>;
      maxHits?: number;
    },
  ): Promise<ResearchFindings> {
    const runtime = await this.systemSettings.getPublicSettings();
    if (!runtime.webSearchEnabled || !runtime.webSearchBaseUrl.trim()) {
      return {
        generatedAt: new Date().toISOString(),
        webSearchEnabled: false,
        note: '管理员未开启联网搜索，报告基于模型已有知识生成。',
        queries,
        totalHits: 0,
        iterations: [],
        hits: [],
      };
    }

    const safeSearch = Math.max(0, Math.min(2, Math.trunc(runtime.webSearchSafeSearch)));
    const topK = Math.max(1, Math.min(12, Math.trunc(runtime.webSearchTopK)));
    const timeoutMs = Math.max(1000, Math.min(30_000, Math.trunc(runtime.webSearchTimeoutMs)));
    const blockedDomains = this.normalizeBlockedDomains(runtime.webSearchBlockedDomains);

    const existingUrls = options?.existingUrls;
    const uniqueHits = new Map<string, { query: string; hit: WebSearchHit }>();
    const defaultMaxHits = Math.max(6, Math.min(16, topK * 2));
    const maxHits = Math.max(4, Math.min(24, Math.trunc(options?.maxHits ?? defaultMaxHits)));

    for (const query of queries) {
      let hits: WebSearchHit[] = [];
      try {
        hits = await this.searchWebHitsWithFilters({
          baseUrl: runtime.webSearchBaseUrl,
          query,
          language: runtime.webSearchLanguage,
          categories: runtime.webSearchCategories,
          safeSearch,
          timeRange: runtime.webSearchTimeRange,
          topK,
          timeoutMs,
          blockedDomains,
        });
      } catch (error) {
        this.logger.warn(`Web search failed for query "${query}": ${this.normalizeErrorMessage(error)}`);
      }

      for (const hit of hits) {
        const url = (hit.url || '').trim();
        if (!url || uniqueHits.has(url) || existingUrls?.has(url)) continue;
        uniqueHits.set(url, { query, hit });
        if (uniqueHits.size >= maxHits) break;
      }

      if (uniqueHits.size >= maxHits) break;
    }

    const mergedHits = Array.from(uniqueHits.values());
    const enriched: ResearchFindings['hits'] = [];

    for (const row of mergedHits) {
      const pageContent = await this.webSearch.fetchPageContent(row.hit.url, {
        maxChars: 2800,
        timeoutMs: Math.max(1500, Math.min(timeoutMs, 12_000)),
      });

      enriched.push({
        query: row.query,
        title: row.hit.title,
        url: row.hit.url,
        domain: row.hit.domain,
        publishedAt: row.hit.publishedAt,
        snippet: row.hit.snippet,
        pageContent,
        score: row.hit.score,
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      webSearchEnabled: true,
      queries,
      totalHits: enriched.length,
      iterations: [],
      hits: enriched,
      note: enriched.length === 0 ? '未检索到可用资料，报告将标注证据不足。' : undefined,
    };
  }

  private async searchWebHitsWithFilters(options: {
    baseUrl: string;
    query: string;
    language: string;
    categories: string;
    safeSearch: number;
    timeRange: '' | 'day' | 'week' | 'month' | 'year';
    topK: number;
    timeoutMs: number;
    blockedDomains: string[];
  }) {
    const targetCount = Math.max(1, Math.min(24, Math.trunc(options.topK)));
    const blockedDomains = options.blockedDomains.filter((item) => item.length > 0);
    const maxPages = blockedDomains.length > 0 ? 5 : 1;
    const perPage = blockedDomains.length > 0 ? 20 : Math.min(20, targetCount);

    const output: WebSearchHit[] = [];
    const seenUrls = new Set<string>();

    for (let page = 1; page <= maxPages; page += 1) {
      const seenCountBefore = seenUrls.size;
      const rows = await this.webSearch.search({
        baseUrl: options.baseUrl,
        query: options.query,
        language: options.language,
        categories: options.categories,
        safeSearch: options.safeSearch,
        timeRange: options.timeRange,
        topK: perPage,
        timeoutMs: options.timeoutMs,
        page,
      });

      if (rows.length === 0) break;

      for (const hit of rows) {
        const url = (hit.url || '').trim();
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);

        if (this.isHitBlockedByDomain(hit, blockedDomains)) continue;

        output.push(hit);
        if (output.length >= targetCount) break;
      }

      if (output.length >= targetCount) break;
      if (seenUrls.size === seenCountBefore) break;
    }

    return output;
  }

  private normalizeBlockedDomains(raw: string) {
    const out: string[] = [];
    const seen = new Set<string>();

    for (const token of (raw || '').split(/[\n,;]+/)) {
      const normalized = token
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/^\.*/, '')
        .replace(/\/.*$/, '')
        .replace(/:\d+$/, '')
        .trim();
      if (!normalized) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
      if (out.length >= 200) break;
    }

    return out;
  }

  private isHitBlockedByDomain(hit: WebSearchHit, blockedDomains: string[]) {
    if (blockedDomains.length === 0) return false;

    const domain = (hit.domain || '').trim().toLowerCase();
    let hostname = domain;

    if (!hostname && hit.url) {
      try {
        hostname = new URL(hit.url).hostname.toLowerCase();
      } catch {
        hostname = '';
      }
    }

    if (!hostname) return false;
    return blockedDomains.some((blocked) => this.doesDomainMatch(hostname, blocked));
  }

  private doesDomainMatch(hostnameRaw: string, blockedRaw: string) {
    const hostname = hostnameRaw.trim().toLowerCase().replace(/^www\./, '');
    const blocked = blockedRaw.trim().toLowerCase().replace(/^www\./, '').replace(/^\.*/, '');
    if (!hostname || !blocked) return false;
    return hostname === blocked || hostname.endsWith(`.${blocked}`);
  }

  private async generateReport(
    topic: string,
    plan: ResearchPlan,
    findings: ResearchFindings,
    model: RuntimeModel,
    conversationContext?: string,
  ) {
    const evidenceBlocks = findings.hits.slice(0, 12).map((hit, index) => {
      const ref = `[R${index + 1}]`;
      const summary = this.normalizeLine(`${hit.pageContent || ''} ${hit.snippet || ''}`)
        .slice(0, 1200)
        .trim();
      const lines = [`${ref} ${hit.title || '未命名来源'}`, `URL: ${hit.url}`, `Query: ${hit.query}`];
      if (hit.publishedAt) lines.push(`Published: ${hit.publishedAt}`);
      if (hit.domain) lines.push(`Domain: ${hit.domain}`);
      if (summary) lines.push(`Evidence: ${summary}`);
      return lines.join('\n');
    });

    const systemPrompt = [
      '你是一名严谨的研究分析师，请输出结构化研究报告。',
      '请仅基于用户提供的证据与逻辑推理，不要虚构数据。',
      '报告必须使用 Markdown，且包含以下章节：',
      '1. 执行摘要',
      '2. 问题拆解',
      '3. 核心发现（分点）',
      '4. 结论与建议（可执行）',
      '5. 风险与不确定性',
      '6. 参考资料（按 [R1] 格式引用）',
      '要求：涉及事实结论时尽可能加上 [R1] 形式引用；若证据不足请明确说明。',
    ].join('\n');

    const userPrompt = [
      `研究主题：${topic}`,
      '',
      '研究计划：',
      JSON.stringify(plan, null, 2),
      '',
      conversationContext ? '对话上下文：' : '',
      conversationContext || '',
      '检索信息：',
      `- 联网搜索可用：${findings.webSearchEnabled ? '是' : '否'}`,
      `- 生成时间：${findings.generatedAt}`,
      `- 研究轮次：${findings.iterations.length}`,
      `- 使用查询词：${findings.queries.join(' | ')}`,
      `- 命中资料数：${findings.totalHits}`,
      findings.iterations.length > 0
        ? `- 每轮新增证据：${findings.iterations.map((item) => `第${item.round}轮 +${item.newHits}`).join('；')}`
        : '',
      findings.note ? `- 备注：${findings.note}` : '',
      '',
      '证据材料：',
      evidenceBlocks.length > 0 ? evidenceBlocks.join('\n\n') : '暂无外部证据，请明确写出证据不足的限制。',
    ]
      .filter((line) => line !== '')
      .join('\n');

    return this.requestCompletionByModel(
      model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3 },
    );
  }

  private async requestQueryPlannerCompletion(
    plan: ResearchPlan,
    model: RuntimeModel,
    messages: UpstreamMessage[],
    extraPayload?: Record<string, unknown>,
  ): Promise<CompletionResult> {
    const shouldUseTaskModel = plan.complexity === 'simple';
    if (shouldUseTaskModel) {
      return this.requestTaskModelCompletion(messages, model, extraPayload);
    }
    return this.requestCompletionByModel(model, messages, extraPayload);
  }

  private async requestTaskModelCompletion(
    messages: UpstreamMessage[],
    fallbackModel: RuntimeModel,
    extraPayload?: Record<string, unknown>,
  ): Promise<CompletionResult> {
    const aiSettings = await this.aiSettings.getAiSettings();
    const taskModelName = (aiSettings.webSearchTaskModelName || '').trim();
    const taskModelBaseUrl = (aiSettings.apiBaseUrl || '').trim();
    const taskModelApiKey = (aiSettings.apiKey || '').trim();

    if (taskModelName && taskModelBaseUrl && taskModelApiKey) {
      try {
        return await this.requestCompletionByGlobalModel(
          taskModelBaseUrl,
          taskModelApiKey,
          taskModelName,
          messages,
          extraPayload,
        );
      } catch (error) {
        this.logger.warn(`Task model completion fallback: ${this.normalizeErrorMessage(error)}`);
      }
    }

    return this.requestCompletionByModel(fallbackModel, messages, extraPayload);
  }

  private resolveResearchRounds(complexity: ResearchPlan['complexity']) {
    if (complexity === 'simple') return 1;
    if (complexity === 'complex') return 5;
    return 2;
  }

  private resolveHitTarget(complexity: ResearchPlan['complexity']) {
    if (complexity === 'simple') return 6;
    if (complexity === 'complex') return 18;
    return 10;
  }

  private resolveRoundMaxHits(complexity: ResearchPlan['complexity'], round: number) {
    if (complexity === 'simple') return 8;
    if (complexity === 'complex') return round === 1 ? 8 : 6;
    return round === 1 ? 7 : 5;
  }

  private buildFallbackQueries(topic: string, plan: ResearchPlan, max: number) {
    const candidates = [
      this.normalizeLine(plan.objective).slice(0, 96),
      ...plan.keyQuestions.map((item) => this.normalizeLine(item).slice(0, 96)),
      this.buildKeywordQueryFromTopic(topic),
    ].filter((item) => item.length > 0);

    return this.mergeQueries([], candidates, Math.max(1, max));
  }

  private buildKeywordQueryFromTopic(topic: string) {
    const normalized = this.normalizeLine(topic);
    if (!normalized) return '';

    const chineseParts = normalized.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    const englishParts = normalized
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && item.length <= 24);

    const out: string[] = [];
    const seen = new Set<string>();
    for (const token of [...chineseParts, ...englishParts]) {
      const key = token.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(token);
      if (out.length >= 8) break;
    }

    return this.normalizeLine(out.join(' ')).slice(0, 96);
  }

  private isTopicCopyQuery(query: string, topicNormalized: string) {
    const q = this.normalizeLine(query).toLowerCase();
    const topic = this.normalizeLine(topicNormalized).toLowerCase();
    if (!q || !topic) return false;
    if (q === topic) return true;

    if (topic.length >= 80 && q.length >= 80) {
      const qPrefix = q.slice(0, 70);
      const topicPrefix = topic.slice(0, 70);
      if (topic.includes(qPrefix) || q.includes(topicPrefix)) return true;
    }

    return false;
  }

  private mergeQueries(existing: string[], incoming: string[], max: number) {
    const merged = [...existing, ...incoming]
      .map((item) => this.normalizeLine(item).slice(0, 120))
      .filter((item) => item.length > 0);
    const out: string[] = [];
    const seen = new Set<string>();

    for (const item of merged) {
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= max) break;
    }

    return out;
  }

  private filterNewQueries(candidates: string[], existing: string[]) {
    const existingSet = new Set(existing.map((item) => this.normalizeLine(item).toLowerCase()).filter(Boolean));
    const out: string[] = [];
    const localSeen = new Set<string>();

    for (const item of candidates) {
      const normalized = this.normalizeLine(item).slice(0, 120);
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (existingSet.has(key) || localSeen.has(key)) continue;
      localSeen.add(key);
      out.push(normalized);
    }

    return out;
  }

  private async requestCompletionByModel(
    model: RuntimeModel,
    messages: UpstreamMessage[],
    extraPayload?: Record<string, unknown>,
  ): Promise<CompletionResult> {
    const decryptedApiKey = this.encryption.decryptString(model.channel.apiKey);
    if (!decryptedApiKey) {
      throw new OpenaiHttpError(500, 'Channel API key is not configured', 'server_error', 'missing_channel_api_key');
    }

    const defaultParams =
      model.defaultParams && typeof model.defaultParams === 'object' && !Array.isArray(model.defaultParams)
        ? (model.defaultParams as Record<string, unknown>)
        : {};

    const payload: Record<string, unknown> = {
      ...defaultParams,
      ...(extraPayload || {}),
      model: model.modelKey,
      messages,
      stream: false,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${decryptedApiKey}`,
      ...this.normalizeExtraHeaders(model.channel.extraHeaders),
    };

    const timeout = Math.max(5_000, Math.min(model.channel.timeout ?? 60_000, 600_000));
    const response = await axios.post(this.buildChatCompletionUrl(model.channel.baseUrl), payload, {
      headers,
      timeout,
      validateStatus: () => true,
    });

    return this.normalizeCompletionResponse(response.status, response.data);
  }

  private async requestCompletionByGlobalModel(
    baseUrl: string,
    apiKey: string,
    modelName: string,
    messages: UpstreamMessage[],
    extraPayload?: Record<string, unknown>,
  ): Promise<CompletionResult> {
    const payload: Record<string, unknown> = {
      ...(extraPayload || {}),
      model: modelName,
      messages,
      stream: false,
    };

    const response = await axios.post(this.buildChatCompletionUrl(baseUrl), payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 30_000,
      validateStatus: () => true,
    });

    return this.normalizeCompletionResponse(response.status, response.data);
  }

  private normalizeCompletionResponse(statusCode: number, payload: unknown): CompletionResult {
    if (statusCode >= 400) {
      const message = this.extractErrorMessage(payload) ?? `Upstream chat request failed (${statusCode})`;
      throw new OpenaiHttpError(502, message, 'server_error', 'upstream_error');
    }

    const upstreamError = this.extractErrorMessage(payload);
    if (upstreamError) {
      throw new OpenaiHttpError(502, upstreamError, 'server_error', 'upstream_error');
    }

    const content = this.extractAssistantContent(payload).trim();
    if (!content) {
      throw new OpenaiHttpError(502, 'Upstream chat returned empty content', 'server_error', 'empty_upstream_content');
    }

    const data = payload as Record<string, unknown>;
    return {
      content,
      providerData: {
        id: typeof data.id === 'string' ? data.id : null,
        model: typeof data.model === 'string' ? data.model : null,
        usage: data.usage ?? null,
      },
    };
  }

  private extractAssistantContent(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return '';
    const body = payload as Record<string, unknown>;
    const choices = Array.isArray(body.choices) ? body.choices : [];
    const firstChoice =
      choices.length > 0 && choices[0] && typeof choices[0] === 'object' && !Array.isArray(choices[0])
        ? (choices[0] as Record<string, unknown>)
        : null;

    const candidates = [
      firstChoice?.message && typeof firstChoice.message === 'object'
        ? (firstChoice.message as Record<string, unknown>).content
        : undefined,
      firstChoice?.delta && typeof firstChoice.delta === 'object'
        ? (firstChoice.delta as Record<string, unknown>).content
        : undefined,
      firstChoice?.text,
      body.output_text,
      body.content,
      body.text,
    ];

    for (const value of candidates) {
      const normalized = this.normalizeUpstreamContent(value);
      if (normalized) return normalized;
    }

    return '';
  }

  private normalizeUpstreamContent(value: unknown): string {
    if (typeof value === 'string') return value;

    if (Array.isArray(value)) {
      return value
        .map((part) => {
          if (typeof part === 'string') return part;
          if (!part || typeof part !== 'object' || Array.isArray(part)) return '';
          const record = part as Record<string, unknown>;
          if (typeof record.text === 'string') return record.text;
          if (typeof record.content === 'string') return record.content;
          return '';
        })
        .join('');
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (typeof record.text === 'string') return record.text;
      if (typeof record.content === 'string') return record.content;
      if (Array.isArray(record.content)) return this.normalizeUpstreamContent(record.content);
    }

    return '';
  }

  private extractErrorMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const record = payload as Record<string, unknown>;
    const error = record.error;
    if (!error) return null;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && !Array.isArray(error)) {
      const obj = error as Record<string, unknown>;
      if (typeof obj.message === 'string') return obj.message;
    }
    return 'Upstream provider returned an error';
  }

  private parseJsonObject(content: string): Record<string, unknown> {
    const source = (content || '').trim();
    if (!source) return {};

    const tryParse = (raw: string): Record<string, unknown> | null => {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // ignore
      }
      return null;
    };

    const direct = tryParse(source);
    if (direct) return direct;

    const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      const fromFence = tryParse(fenced[1].trim());
      if (fromFence) return fromFence;
    }

    const firstBrace = source.indexOf('{');
    const lastBrace = source.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const fromSlice = tryParse(source.slice(firstBrace, lastBrace + 1));
      if (fromSlice) return fromSlice;
    }

    return {};
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    const out: string[] = [];
    const seen = new Set<string>();

    for (const item of value) {
      if (typeof item !== 'string') continue;
      const normalized = this.normalizeLine(item);
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(normalized);
      if (out.length >= 20) break;
    }

    return out;
  }

  private normalizeLine(value: string) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  private normalizeExtraHeaders(raw: Prisma.JsonValue | null): Record<string, string> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!key) continue;
      if (typeof value === 'string') {
        out[key] = value;
        continue;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        out[key] = String(value);
      }
    }
    return out;
  }

  private buildChatCompletionUrl(baseUrl: string): string {
    const trimmed = (baseUrl || '').replace(/\/+$/, '');
    if (!trimmed) {
      throw new OpenaiHttpError(500, 'Channel base URL is not configured', 'server_error', 'missing_channel_base_url');
    }
    if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
    return `${trimmed}/chat/completions`;
  }
}
