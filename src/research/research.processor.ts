import { Processor, WorkerHost } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import axios from 'axios';
import { Job } from 'bullmq';

import { CreditsService } from '../credits/credits.service';
import { EncryptionService } from '../encryption/encryption.service';
import { InboxService } from '../inbox/inbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { RESEARCH_QUEUE } from '../queues/queue-names';
import { AiSettingsService } from '../settings/ai-settings.service';
import { SystemSettingsService } from '../settings/system-settings.service';
import { WebSearchService, WebSearchHit } from '../chat/web-search.service';
import { serializeResearchTask } from './research.serializer';

type UpstreamMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
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

type ResearchIteration = {
  round: number;
  focus: string[];
  queries: string[];
  newHits: number;
  totalHits: number;
  note?: string;
};

type FollowUpSearchPlan = {
  stop: boolean;
  reason?: string;
  gaps: string[];
  queries: string[];
};

type CollectFindingsOptions = {
  existingUrls?: Set<string>;
  progressStart?: number;
  progressEnd?: number;
  maxHits?: number;
};

type ResearchInputFileContext = {
  fileIds: string[];
  files: Array<{
    id: string;
    fileName: string;
    extension: string;
    textLength: number;
  }>;
  promptContext: string;
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

@Injectable()
@Processor(RESEARCH_QUEUE)
export class ResearchProcessor extends WorkerHost {
  private static readonly RESEARCH_FILE_CONTEXT_MAX_CHARS = 12_000;
  private static readonly RESEARCH_FILE_CONTEXT_PER_FILE_MAX_CHARS = 2_500;
  private static readonly RESEARCH_REPORT_TITLE_MAX_CHARS = 80;
  private readonly logger = new Logger(ResearchProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly aiSettings: AiSettingsService,
    private readonly systemSettings: SystemSettingsService,
    private readonly webSearch: WebSearchService,
    private readonly credits: CreditsService,
    private readonly inbox: InboxService,
  ) {
    super();
  }

  async process(job: Job<{ taskId: string }>) {
    if (job.name !== 'run') return;

    const taskId = this.parseBigInt(job.data.taskId, 'taskId');

    const task = await this.prisma.researchTask.findUnique({
      where: { id: taskId },
      include: {
        model: {
          select: {
            id: true,
            name: true,
            modelKey: true,
            defaultParams: true,
            channel: {
              select: {
                baseUrl: true,
                apiKey: true,
                extraHeaders: true,
                timeout: true,
              },
            },
          },
        },
      },
    });

    if (!task) return;
    if (task.status === TaskStatus.completed || task.status === TaskStatus.failed) return;

    const model: RuntimeModel = {
      modelKey: task.model.modelKey,
      defaultParams: task.model.defaultParams,
      channel: task.model.channel,
    };
    const initialProviderData = this.toJsonRecord(task.providerData);
    const inputFiles = await this.loadInputFileContext(task.userId, initialProviderData);

    try {
      await this.updateTask(task.id, {
        status: TaskStatus.processing,
        stage: 'decomposing',
        progress: 5,
        errorMessage: null,
        startedAt: task.startedAt ?? new Date(),
      });

      const plan = await this.decomposeTopic(task.topic, model, inputFiles.promptContext);
      await this.updateTask(task.id, {
        stage: 'planning_queries',
        progress: 22,
        plan: plan as Prisma.InputJsonValue,
      });

      const queries = await this.generateSearchQueries(task.topic, plan, model, inputFiles.promptContext);
      await this.updateTask(task.id, {
        stage: 'searching',
        progress: 30,
        queries: queries as unknown as Prisma.InputJsonValue,
      });

      const findings = await this.runIterativeResearch(task.id, task.topic, plan, model, queries);
      await this.updateTask(task.id, {
        stage: 'writing_report',
        progress: 72,
        findings: findings as unknown as Prisma.InputJsonValue,
      });

      const report = await this.generateReport(task.topic, plan, findings, model, inputFiles.promptContext);
      const reportTitle = await this.summarizeReportTitle(task.topic, report.content, model);

      await this.updateTask(task.id, {
        status: TaskStatus.completed,
        stage: 'completed',
        progress: 100,
        report: report.content,
        providerData: {
          ...initialProviderData,
          reportProvider: report.providerData,
          reportTitle,
          findingsCount: findings.hits.length,
          researchRounds: findings.iterations.length,
          inputFileIds: inputFiles.fileIds,
          inputFiles: inputFiles.files,
          generatedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        completedAt: new Date(),
      });

      await this.inbox.sendSystemMessage({
        userId: task.userId,
        type: 'task_completed',
        level: 'success',
        title: '深度研究任务已完成',
        content: task.topic,
        relatedType: 'research',
        relatedId: task.id,
        dedupKey: `task:research:${task.id.toString()}:completed:${task.retryCount}`,
        meta: {
          taskType: 'research',
          taskId: task.id.toString(),
          taskNo: task.taskNo,
          retryCount: task.retryCount,
          status: 'completed',
          modelId: task.modelId.toString(),
          channelId: task.channelId.toString(),
          progress: 100,
          stage: 'completed',
        } satisfies Prisma.JsonObject,
      });
    } catch (error) {
      const message = this.normalizeErrorMessage(error);
      this.logger.error(`Research task failed: ${message}`, error instanceof Error ? error.stack : undefined);

      const latest = await this.prisma.researchTask.findUnique({
        where: { id: task.id },
        select: { status: true },
      });

      if (latest?.status !== TaskStatus.completed) {
        await this.prisma.$transaction(async (tx) => {
          await tx.researchTask.update({
            where: { id: task.id },
            data: {
              status: TaskStatus.failed,
              stage: 'failed',
              progress: Math.max(task.progress, 1),
              errorMessage: message,
              completedAt: new Date(),
            },
          });

          await this.credits.refundCredits(tx, task.userId, task.id, `Refund research task ${task.taskNo}`, {
            scopeDescriptionContains: task.taskNo,
            maxRefundAmount: typeof task.creditsCost === 'number' ? Math.max(task.creditsCost, 0) : undefined,
          });
        });
        await this.publishResearchTaskUpdate(task.id);
      }

      await this.inbox.sendSystemMessage({
        userId: task.userId,
        type: 'task_failed',
        level: 'error',
        title: '深度研究任务失败',
        content: task.topic,
        relatedType: 'research',
        relatedId: task.id,
        dedupKey: `task:research:${task.id.toString()}:failed:${task.retryCount}`,
        meta: {
          taskType: 'research',
          taskId: task.id.toString(),
          taskNo: task.taskNo,
          retryCount: task.retryCount,
          status: 'failed',
          modelId: task.modelId.toString(),
          channelId: task.channelId.toString(),
          errorMessage: message,
          stage: 'failed',
        } satisfies Prisma.JsonObject,
      });
    }
  }

  private async updateTask(id: bigint, data: Prisma.ResearchTaskUpdateInput) {
    const updated = await this.prisma.researchTask.update({
      where: { id },
      data,
      include: {
        model: {
          select: {
            name: true,
          },
        },
      },
    });
    await this.inbox.publishResearchUpdate(updated.userId, serializeResearchTask(updated));
    return updated;
  }

  private async publishResearchTaskUpdate(taskId: bigint) {
    const task = await this.prisma.researchTask.findUnique({
      where: { id: taskId },
      include: {
        model: {
          select: {
            name: true,
          },
        },
      },
    });
    if (!task) return;
    await this.inbox.publishResearchUpdate(task.userId, serializeResearchTask(task));
  }

  private async decomposeTopic(topic: string, model: RuntimeModel, fileContext?: string): Promise<ResearchPlan> {
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
      fileContext ? `用户上传文件摘要：\n${fileContext}` : '',
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
    fileContext?: string,
  ): Promise<string[]> {
    const prompt = [
      '你是联网检索词生成器。请根据研究主题和问题拆解，生成可直接用于搜索引擎的检索词。',
      '只输出 JSON，格式：{"queries":["检索词1","检索词2"]}',
      '限制：',
      '1) 3-6 条查询词。',
      '2) 每条查询词尽量包含实体、约束条件、时间限定（必要时）。',
      '3) 不要输出解释文本。',
    ].join('\n');

    const userPayload = [
      `研究主题：${topic}`,
      `研究目标：${plan.objective}`,
      `关键问题：${plan.keyQuestions.join('；')}`,
      fileContext ? `用户上传文件摘要：\n${fileContext}` : '',
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
    const topicNormalized = this.normalizeLine(topic);
    const queries = this.normalizeStringArray(parsed.queries)
      .map((item) => this.normalizeLine(item).slice(0, 120))
      .filter((item) => item.length > 0)
      .filter((item) => !this.isTopicCopyQuery(item, topicNormalized))
      .slice(0, 6);
    const merged = this.mergeQueries([], queries, 6);
    if (merged.length > 0) return merged;

    const fallback = this.buildFallbackQueries(topic, plan, 4);
    return fallback.length > 0 ? fallback : ['行业现状 关键趋势 权威来源'];
  }

  private async runIterativeResearch(
    taskId: bigint,
    topic: string,
    plan: ResearchPlan,
    model: RuntimeModel,
    initialQueries: string[],
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
        const planningProgress = this.resolveRoundPlanningProgress(round, maxRounds);
        await this.updateTask(taskId, {
          stage: 'planning_queries',
          progress: planningProgress,
        });

        const followUp = await this.generateFollowUpSearchPlan(topic, plan, allQueries, allHits, model, round);
        roundFocus = followUp.gaps.length > 0 ? followUp.gaps.slice(0, 4) : plan.keyQuestions.slice(0, 4);
        roundNote = followUp.reason || '';

        if (followUp.stop) {
          if (roundNote) notes.push(roundNote);
          break;
        }

        roundQueries = this.filterNewQueries(followUp.queries, allQueries).slice(0, 6);
        if (roundQueries.length === 0) {
          notes.push('迭代检索已无新增查询词，提前结束。');
          break;
        }

        allQueries = this.mergeQueries(allQueries, roundQueries, 24);
        await this.updateTask(taskId, {
          stage: 'searching',
          progress: planningProgress,
          queries: allQueries as unknown as Prisma.InputJsonValue,
        });
      }

      const window = this.resolveRoundProgressWindow(round, maxRounds);
      const roundFindings = await this.collectFindings(taskId, roundQueries, {
        existingUrls: seenUrls,
        progressStart: window.start,
        progressEnd: window.end,
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

      const snapshot: ResearchFindings = {
        generatedAt: new Date().toISOString(),
        webSearchEnabled,
        note: notes.length > 0 ? notes.join(' ') : undefined,
        queries: allQueries,
        totalHits: allHits.length,
        iterations,
        hits: allHits,
      };

      await this.updateTask(taskId, {
        stage: 'searching',
        progress: window.end,
        queries: allQueries as unknown as Prisma.InputJsonValue,
        findings: snapshot as unknown as Prisma.InputJsonValue,
      });

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
    taskId: bigint,
    queries: string[],
    options?: CollectFindingsOptions,
  ): Promise<ResearchFindings> {
    const progressStart = this.normalizeProgress(options?.progressStart ?? 35);
    const progressEnd = this.normalizeProgress(options?.progressEnd ?? 66);
    const progressLower = Math.min(progressStart, progressEnd);
    const progressUpper = Math.max(progressStart, progressEnd);

    const runtime = await this.systemSettings.getPublicSettings();
    if (!runtime.webSearchEnabled || !runtime.webSearchBaseUrl.trim()) {
      await this.updateTask(taskId, {
        stage: 'searching',
        progress: progressUpper,
      });
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
    const searchProgressCap = this.interpolateProgress(progressLower, progressUpper, 0.72);
    const fetchProgressStart = Math.min(progressUpper, searchProgressCap + 1);

    for (let index = 0; index < queries.length; index += 1) {
      const query = queries[index];
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

      const progress = this.interpolateProgress(
        progressLower,
        searchProgressCap,
        (index + 1) / Math.max(queries.length, 1),
      );
      await this.updateTask(taskId, {
        stage: 'searching',
        progress,
      });

      if (uniqueHits.size >= maxHits) break;
    }

    const mergedHits = Array.from(uniqueHits.values());

    const enriched: ResearchFindings['hits'] = [];
    for (let index = 0; index < mergedHits.length; index += 1) {
      const row = mergedHits[index];
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

      const progress = this.interpolateProgress(
        fetchProgressStart,
        progressUpper,
        (index + 1) / Math.max(mergedHits.length, 1),
      );
      await this.updateTask(taskId, {
        stage: 'searching',
        progress,
      });
    }

    await this.updateTask(taskId, {
      stage: 'searching',
      progress: progressUpper,
    });

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
    fileContext?: string,
  ) {
    const evidenceBlocks = findings.hits.slice(0, 12).map((hit, index) => {
      const ref = `[R${index + 1}]`;
      const summary = this.normalizeLine(`${hit.pageContent || ''} ${hit.snippet || ''}`)
        .slice(0, 1200)
        .trim();
      const lines = [
        `${ref} ${hit.title || '未命名来源'}`,
        `URL: ${hit.url}`,
        `Query: ${hit.query}`,
      ];
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
      fileContext ? '用户上传文件摘要：' : '',
      fileContext || '',
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

  private async summarizeReportTitle(topic: string, report: string, model: RuntimeModel) {
    const prompt = [
      '你是研究报告标题生成器。',
      `请基于研究主题与报告正文输出一个简洁标题，长度不超过 ${ResearchProcessor.RESEARCH_REPORT_TITLE_MAX_CHARS} 个字符。`,
      '要求：',
      '1) 准确概括结论导向，不要照抄原题。',
      '2) 不能包含换行、引号、编号前缀。',
      '3) 只输出标题文本，不要任何解释。',
    ].join('\n');

    const userPayload = [
      `研究主题：${topic}`,
      '研究报告正文：',
      report.slice(0, 4000),
    ].join('\n\n');

    try {
      const completion = await this.requestTaskModelCompletion(
        [
          { role: 'system', content: prompt },
          { role: 'user', content: userPayload },
        ],
        model,
        { temperature: 0.2 },
      );

      const normalized = this.normalizeLine(
        completion.content
          .replace(/^[#*\-\d.\s]+/, '')
          .replace(/^["'“”]+|["'“”]+$/g, ''),
      ).slice(0, ResearchProcessor.RESEARCH_REPORT_TITLE_MAX_CHARS);

      if (normalized) return normalized;
    } catch (error) {
      this.logger.warn(`Research title fallback: ${this.normalizeErrorMessage(error)}`);
    }

    const fallback = this.normalizeLine(topic).slice(0, ResearchProcessor.RESEARCH_REPORT_TITLE_MAX_CHARS);
    return fallback || '深度研究报告';
  }

  private async loadInputFileContext(
    userId: bigint,
    providerData: Record<string, unknown>,
  ): Promise<ResearchInputFileContext> {
    const fileIds = this.normalizeStringArray(providerData.inputFileIds).slice(0, 20);
    if (fileIds.length === 0) {
      return { fileIds: [], files: [], promptContext: '' };
    }

    const parsedIds = fileIds
      .map((raw) => {
        try {
          return BigInt(raw);
        } catch {
          return null;
        }
      })
      .filter((item): item is bigint => item !== null);

    if (parsedIds.length === 0) {
      return { fileIds: [], files: [], promptContext: '' };
    }

    const rows = await this.prisma.chatFile.findMany({
      where: {
        id: { in: parsedIds },
        userId,
        status: 'ready',
      },
      select: {
        id: true,
        fileName: true,
        extension: true,
        textLength: true,
        extractedText: true,
      },
    });

    if (rows.length === 0) {
      return { fileIds: [], files: [], promptContext: '' };
    }

    const rowMap = new Map(rows.map((item) => [item.id.toString(), item]));
    const ordered = fileIds
      .map((id) => rowMap.get(id))
      .filter((item): item is (typeof rows)[number] => Boolean(item));

    let budget = ResearchProcessor.RESEARCH_FILE_CONTEXT_MAX_CHARS;
    const blocks: string[] = [];
    for (const item of ordered) {
      if (budget <= 0) break;
      const excerpt = this.normalizeLine(item.extractedText || '').slice(
        0,
        Math.min(ResearchProcessor.RESEARCH_FILE_CONTEXT_PER_FILE_MAX_CHARS, budget),
      );
      if (!excerpt) continue;
      budget -= excerpt.length;
      blocks.push(`[F${item.id.toString()}] ${item.fileName}\n${excerpt}`);
    }

    return {
      fileIds: ordered.map((item) => item.id.toString()),
      files: ordered.map((item) => ({
        id: item.id.toString(),
        fileName: item.fileName,
        extension: item.extension,
        textLength: item.textLength,
      })),
      promptContext: blocks.join('\n\n'),
    };
  }

  private async requestQueryPlannerCompletion(
    plan: ResearchPlan,
    model: RuntimeModel,
    messages: UpstreamMessage[],
    extraPayload?: Record<string, unknown>,
  ): Promise<CompletionResult> {
    const shouldUseTaskModel = plan.complexity === 'simple';
    if (shouldUseTaskModel) return this.requestTaskModelCompletion(messages, model, extraPayload);

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

  private resolveRoundProgressWindow(round: number, totalRounds: number) {
    const start = 35;
    const end = 68;
    if (totalRounds <= 1) return { start, end };

    const span = end - start + 1;
    const segmentStartOffset = Math.floor((span * (round - 1)) / totalRounds);
    const segmentEndOffset = Math.floor((span * round) / totalRounds) - 1;

    const segmentStart = start + segmentStartOffset;
    const segmentEnd = round === totalRounds ? end : Math.max(segmentStart, start + segmentEndOffset);
    return { start: segmentStart, end: segmentEnd };
  }

  private resolveRoundPlanningProgress(round: number, totalRounds: number) {
    const window = this.resolveRoundProgressWindow(round, totalRounds);
    return this.normalizeProgress(window.start - 1);
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

  private normalizeProgress(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.trunc(value)));
  }

  private interpolateProgress(start: number, end: number, ratio: number) {
    const boundedRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
    const raw = start + (end - start) * boundedRatio;
    return this.normalizeProgress(raw);
  }

  private async requestCompletionByModel(
    model: RuntimeModel,
    messages: UpstreamMessage[],
    extraPayload?: Record<string, unknown>,
  ): Promise<CompletionResult> {
    const decryptedApiKey = this.encryption.decryptString(model.channel.apiKey);
    if (!decryptedApiKey) {
      throw new BadRequestException('Channel API key is not configured');
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

  private normalizeCompletionResponse(statusCode: number, payload: any): CompletionResult {
    if (statusCode >= 400) {
      const message = this.extractErrorMessage(payload) ?? `Upstream chat request failed (${statusCode})`;
      throw new BadRequestException(message);
    }

    const upstreamError = this.extractErrorMessage(payload);
    if (upstreamError) throw new BadRequestException(upstreamError);

    const content = this.extractAssistantContent(payload).trim();
    if (!content) {
      throw new BadRequestException('Upstream chat returned empty content');
    }

    return {
      content,
      providerData: {
        id: typeof payload?.id === 'string' ? payload.id : null,
        model: typeof payload?.model === 'string' ? payload.model : null,
        usage: payload?.usage ?? null,
      },
    };
  }

  private extractAssistantContent(payload: any): string {
    if (!payload || typeof payload !== 'object') return '';

    const firstChoice = payload.choices?.[0];
    const candidates = [
      firstChoice?.message?.content,
      firstChoice?.delta?.content,
      firstChoice?.text,
      payload.output_text,
      payload.content,
      payload.text,
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
          if (!part || typeof part !== 'object') return '';
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

  private extractErrorMessage(payload: any): string | null {
    if (!payload || typeof payload !== 'object') return null;

    const error = payload.error;
    if (!error) return null;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && typeof error.message === 'string') return error.message;

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

  private toJsonRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
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
    const trimmed = baseUrl.replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
    return `${trimmed}/chat/completions`;
  }

  private normalizeErrorMessage(error: unknown) {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();
      if (typeof response === 'string' && response.trim()) return response;
      if (response && typeof response === 'object') {
        const message = (response as Record<string, unknown>).message;
        if (typeof message === 'string' && message.trim()) return message;
        if (Array.isArray(message)) {
          const first = message.find((item) => typeof item === 'string' && item.trim());
          if (typeof first === 'string') return first;
        }
      }
      return error.message;
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return 'Research task failed';
  }

  private parseBigInt(raw: string, fieldName: string) {
    try {
      return BigInt(raw);
    } catch {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }
  }
}
