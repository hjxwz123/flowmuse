import { ImageTask, PublicModerationStatus, VideoTask } from '@prisma/client';

import { serializeUserFacingProviderData } from './user-provider-data.serializer';

export type ApiTaskType = 'image' | 'video';
export type ApiTaskFailureReason = 'sensitive_word';

export type ApiTask = {
  type: ApiTaskType;
  id: string;
  userId: string;
  modelId: string;
  channelId: string;
  projectId: string | null;
  taskNo: string;
  taskGroupId: string | null;
  provider: string;
  providerTaskId: string | null;
  prompt: string;
  negativePrompt: string | null;
  parameters: Record<string, unknown> | null;
  providerData?: unknown | null;
  status: ImageTask['status'];
  resultUrl: string | null;
  thumbnailUrl: string | null;
  ossKey: string | null;
  creditsCost: number | null;
  creditSource: ImageTask['creditSource'] | null;
  isPublic: boolean;
  publicModerationStatus: PublicModerationStatus;
  publicRequestedAt: Date | null;
  publicModeratedAt: Date | null;
  publicModeratedBy: string | null;
  publicModerationNote: string | null;
  errorMessage: string | null;
  failureStatusCode: number | null;
  failureReason: ApiTaskFailureReason | null;
  retryCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  toolId: string | null;
  toolTitle: string | null;
  canCancel?: boolean;
  cancelSupported?: boolean;
};

// 精简版任务类型（用于列表接口，不包含 parameters 大字段；仅对少数需要前台继续操作的模型保留 providerData）
export type ApiTaskLite = Omit<ApiTask, 'parameters'>;

type WithOptionalTool = { tool?: { title: string } | null };

const KNOWN_FAILURE_STATUS_CODES = new Set([429, 503, 524]);

function toJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeKnownFailureStatusCode(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return KNOWN_FAILURE_STATUS_CODES.has(value) ? value : null;
  }

  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;

  const exact = Number(text);
  if (Number.isFinite(exact) && KNOWN_FAILURE_STATUS_CODES.has(exact)) {
    return exact;
  }

  const match = text.match(/\b(429|503|524)\b/);
  return match ? Number(match[1]) : null;
}

function extractKnownFailureStatusCode(value: unknown, depth = 0): number | null {
  const direct = normalizeKnownFailureStatusCode(value);
  if (direct !== null) return direct;
  if (depth >= 5 || !value || typeof value !== 'object') return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractKnownFailureStatusCode(item, depth + 1);
      if (nested !== null) return nested;
    }
    return null;
  }

  const source = value as Record<string, unknown>;
  const preferredKeys = ['status_code', 'statusCode', 'http_status', 'httpStatus', 'code', 'status'];
  for (const key of preferredKeys) {
    if (!(key in source)) continue;
    const code = normalizeKnownFailureStatusCode(source[key]);
    if (code !== null) return code;
  }

  for (const nestedValue of Object.values(source)) {
    const nested = extractKnownFailureStatusCode(nestedValue, depth + 1);
    if (nested !== null) return nested;
  }

  return null;
}

function containsTriggeringFailure(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') return value.toLowerCase().includes('triggering');
  if (depth >= 5 || !value || typeof value !== 'object') return false;

  if (Array.isArray(value)) {
    return value.some((item) => containsTriggeringFailure(item, depth + 1));
  }

  return Object.values(value as Record<string, unknown>).some((nestedValue) =>
    containsTriggeringFailure(nestedValue, depth + 1),
  );
}

function getFailureStatusCode(task: Pick<ImageTask | VideoTask, 'status' | 'errorMessage' | 'providerData'>) {
  if (task.status !== 'failed') return null;

  const providerStatusCode = extractKnownFailureStatusCode(task.providerData);
  if (providerStatusCode !== null) return providerStatusCode;

  const errorMessage = task.errorMessage?.trim();
  if (errorMessage && /^task timeout$/i.test(errorMessage)) return 524;

  return extractKnownFailureStatusCode(errorMessage);
}

function getFailureReason(task: Pick<ImageTask | VideoTask, 'status' | 'errorMessage' | 'providerData'>): ApiTaskFailureReason | null {
  if (task.status !== 'failed') return null;
  if (containsTriggeringFailure(task.errorMessage) || containsTriggeringFailure(task.providerData)) {
    return 'sensitive_word';
  }
  return null;
}

function normalizePublicModerationStatus(
  value: PublicModerationStatus | null | undefined,
  isPublic: boolean,
): PublicModerationStatus {
  if (value === PublicModerationStatus.approved || value === PublicModerationStatus.pending || value === PublicModerationStatus.rejected) {
    return value;
  }
  return isPublic ? PublicModerationStatus.approved : PublicModerationStatus.private;
}

export function serializeImageTask(task: ImageTask & WithOptionalTool): ApiTask {
  const toolId = (task as any).toolId?.toString() ?? null;
  const providerData = serializeUserFacingProviderData(task);
  return {
    type: 'image',
    id: task.id.toString(),
    userId: task.userId.toString(),
    modelId: task.modelId.toString(),
    channelId: task.channelId.toString(),
    projectId: (task as any).projectId?.toString() ?? null,
    taskNo: task.taskNo,
    taskGroupId: (task as any).taskGroupId ?? null,
    provider: task.provider,
    providerTaskId: task.providerTaskId ?? null,
    prompt: toolId ? '' : task.prompt,
    negativePrompt: task.negativePrompt ?? null,
    parameters: toJsonObject(task.parameters),
    ...(providerData !== undefined ? { providerData } : {}),
    status: task.status,
    resultUrl: task.resultUrl ?? null,
    thumbnailUrl: task.thumbnailUrl ?? null,
    ossKey: task.ossKey ?? null,
    creditsCost: task.creditsCost ?? null,
    creditSource: task.creditSource ?? null,
    isPublic: task.isPublic,
    publicModerationStatus: normalizePublicModerationStatus(task.publicModerationStatus, task.isPublic),
    publicRequestedAt: task.publicRequestedAt ?? null,
    publicModeratedAt: task.publicModeratedAt ?? null,
    publicModeratedBy: task.publicModeratedBy ?? null,
    publicModerationNote: task.publicModerationNote ?? null,
    errorMessage: task.errorMessage ?? null,
    failureStatusCode: getFailureStatusCode(task),
    failureReason: getFailureReason(task),
    retryCount: task.retryCount,
    startedAt: task.startedAt ?? null,
    completedAt: task.completedAt ?? null,
    deletedAt: (task as any).deletedAt ?? null,
    createdAt: task.createdAt,
    toolId,
    toolTitle: task.tool?.title ?? null,
  };
}

export function serializeVideoTask(
  task: VideoTask & WithOptionalTool,
  options?: { canCancel?: boolean; cancelSupported?: boolean },
): ApiTask {
  const toolId = (task as any).toolId?.toString() ?? null;
  const providerData = serializeUserFacingProviderData(task);
  return {
    type: 'video',
    id: task.id.toString(),
    userId: task.userId.toString(),
    modelId: task.modelId.toString(),
    channelId: task.channelId.toString(),
    projectId: (task as any).projectId?.toString() ?? null,
    taskNo: task.taskNo,
    taskGroupId: (task as any).taskGroupId ?? null,
    provider: task.provider,
    providerTaskId: task.providerTaskId ?? null,
    prompt: toolId ? '' : task.prompt,
    negativePrompt: null,
    parameters: toJsonObject(task.parameters),
    ...(providerData !== undefined ? { providerData } : {}),
    status: task.status,
    resultUrl: task.resultUrl ?? null,
    thumbnailUrl: task.thumbnailUrl ?? null,
    ossKey: task.ossKey ?? null,
    creditsCost: task.creditsCost ?? null,
    creditSource: task.creditSource ?? null,
    isPublic: task.isPublic,
    publicModerationStatus: normalizePublicModerationStatus(task.publicModerationStatus, task.isPublic),
    publicRequestedAt: task.publicRequestedAt ?? null,
    publicModeratedAt: task.publicModeratedAt ?? null,
    publicModeratedBy: task.publicModeratedBy ?? null,
    publicModerationNote: task.publicModerationNote ?? null,
    errorMessage: task.errorMessage ?? null,
    failureStatusCode: getFailureStatusCode(task),
    failureReason: getFailureReason(task),
    retryCount: task.retryCount,
    startedAt: task.startedAt ?? null,
    completedAt: task.completedAt ?? null,
    deletedAt: null,
    createdAt: task.createdAt,
    toolId,
    toolTitle: task.tool?.title ?? null,
    ...(options?.canCancel !== undefined ? { canCancel: options.canCancel } : {}),
    ...(options?.cancelSupported !== undefined ? { cancelSupported: options.cancelSupported } : {}),
  };
}

// 精简版序列化器（用于列表接口）
export function serializeImageTaskLite(task: ImageTask & WithOptionalTool): ApiTaskLite {
  const toolId = (task as any).toolId?.toString() ?? null;
  const providerData = serializeUserFacingProviderData(task);
  return {
    type: 'image',
    id: task.id.toString(),
    userId: task.userId.toString(),
    modelId: task.modelId.toString(),
    channelId: task.channelId.toString(),
    projectId: (task as any).projectId?.toString() ?? null,
    taskNo: task.taskNo,
    taskGroupId: (task as any).taskGroupId ?? null,
    provider: task.provider,
    providerTaskId: task.providerTaskId ?? null,
    prompt: toolId ? '' : task.prompt,
    negativePrompt: task.negativePrompt ?? null,
    ...(providerData !== undefined ? { providerData } : {}),
    status: task.status,
    resultUrl: task.resultUrl ?? null,
    thumbnailUrl: task.thumbnailUrl ?? null,
    ossKey: task.ossKey ?? null,
    creditsCost: task.creditsCost ?? null,
    creditSource: task.creditSource ?? null,
    isPublic: task.isPublic,
    publicModerationStatus: normalizePublicModerationStatus(task.publicModerationStatus, task.isPublic),
    publicRequestedAt: task.publicRequestedAt ?? null,
    publicModeratedAt: task.publicModeratedAt ?? null,
    publicModeratedBy: task.publicModeratedBy ?? null,
    publicModerationNote: task.publicModerationNote ?? null,
    errorMessage: task.errorMessage ?? null,
    failureStatusCode: getFailureStatusCode(task),
    failureReason: getFailureReason(task),
    retryCount: task.retryCount,
    startedAt: task.startedAt ?? null,
    completedAt: task.completedAt ?? null,
    deletedAt: (task as any).deletedAt ?? null,
    createdAt: task.createdAt,
    toolId,
    toolTitle: task.tool?.title ?? null,
  };
}

export function serializeVideoTaskLite(task: VideoTask & WithOptionalTool): ApiTaskLite {
  const toolId = (task as any).toolId?.toString() ?? null;
  const providerData = serializeUserFacingProviderData(task);
  return {
    type: 'video',
    id: task.id.toString(),
    userId: task.userId.toString(),
    modelId: task.modelId.toString(),
    channelId: task.channelId.toString(),
    projectId: (task as any).projectId?.toString() ?? null,
    taskNo: task.taskNo,
    taskGroupId: (task as any).taskGroupId ?? null,
    provider: task.provider,
    providerTaskId: task.providerTaskId ?? null,
    prompt: toolId ? '' : task.prompt,
    negativePrompt: null,
    ...(providerData !== undefined ? { providerData } : {}),
    status: task.status,
    resultUrl: task.resultUrl ?? null,
    thumbnailUrl: task.thumbnailUrl ?? null,
    ossKey: task.ossKey ?? null,
    creditsCost: task.creditsCost ?? null,
    creditSource: task.creditSource ?? null,
    isPublic: task.isPublic,
    publicModerationStatus: normalizePublicModerationStatus(task.publicModerationStatus, task.isPublic),
    publicRequestedAt: task.publicRequestedAt ?? null,
    publicModeratedAt: task.publicModeratedAt ?? null,
    publicModeratedBy: task.publicModeratedBy ?? null,
    publicModerationNote: task.publicModerationNote ?? null,
    errorMessage: task.errorMessage ?? null,
    failureStatusCode: getFailureStatusCode(task),
    failureReason: getFailureReason(task),
    retryCount: task.retryCount,
    startedAt: task.startedAt ?? null,
    completedAt: task.completedAt ?? null,
    deletedAt: null,
    createdAt: task.createdAt,
    toolId,
    toolTitle: task.tool?.title ?? null,
  };
}
