import { ImageTask, PublicModerationStatus, VideoTask } from '@prisma/client';

import { serializeUserFacingProviderData } from './user-provider-data.serializer';

export type ApiTaskType = 'image' | 'video';

export type ApiTask = {
  type: ApiTaskType;
  id: string;
  userId: string;
  modelId: string;
  channelId: string;
  projectId: string | null;
  taskNo: string;
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

function toJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
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
    retryCount: task.retryCount,
    startedAt: task.startedAt ?? null,
    completedAt: task.completedAt ?? null,
    deletedAt: null,
    createdAt: task.createdAt,
    toolId,
    toolTitle: task.tool?.title ?? null,
  };
}
