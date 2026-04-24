import { ImageTask, VideoTask } from '@prisma/client';

import { serializeUserFacingProviderData } from './user-provider-data.serializer';

export type ApiGalleryCreator = {
  id: string;
  username: string | null;
  email: string;
  avatar: string | null;
};

export type ApiGalleryItem = {
  type: 'image' | 'video';
  id: string;
  userId: string;
  modelId: string;
  modelName: string | null;
  provider: string;
  prompt: string;
  negativePrompt: string | null;
  status: ImageTask['status'];
  resultUrl: string | null;
  thumbnailUrl: string | null;
  isPublic: boolean;
  createdAt: Date;
  completedAt: Date | null;
};

// 详情接口返回的类型（包含 parameters + creator）
export type ApiGalleryItemDetail = ApiGalleryItem & {
  parameters: Record<string, unknown> | null;
  providerData?: unknown | null;
  creator: ApiGalleryCreator | null;
};

function toJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Serialize image task for gallery API
 * Excludes sensitive fields: providerData, parameters, channelId, providerTaskId, etc.
 */
export function serializeGalleryImage(task: ImageTask): ApiGalleryItem {
  return {
    type: 'image',
    id: task.id.toString(),
    userId: task.userId.toString(),
    modelId: task.modelId.toString(),
    modelName: null,
    provider: task.provider,
    prompt: task.prompt,
    negativePrompt: task.negativePrompt ?? null,
    status: task.status,
    resultUrl: task.resultUrl ?? null,
    thumbnailUrl: task.thumbnailUrl ?? null,
    isPublic: task.isPublic,
    createdAt: task.createdAt,
    completedAt: task.completedAt ?? null,
  };
}

/**
 * Serialize video task for gallery API
 * Excludes sensitive fields: providerData, parameters, channelId, providerTaskId, etc.
 */
export function serializeGalleryVideo(task: VideoTask): ApiGalleryItem {
  return {
    type: 'video',
    id: task.id.toString(),
    userId: task.userId.toString(),
    modelId: task.modelId.toString(),
    modelName: null,
    provider: task.provider,
    prompt: task.prompt,
    negativePrompt: null,
    status: task.status,
    resultUrl: task.resultUrl ?? null,
    thumbnailUrl: task.thumbnailUrl ?? null,
    isPublic: task.isPublic,
    createdAt: task.createdAt,
    completedAt: task.completedAt ?? null,
  };
}

/**
 * Serialize image task for gallery detail API (includes parameters for reference image)
 */
export function serializeGalleryImageDetail(
  task: ImageTask,
  creator?: { id: bigint; username: string | null; email: string; avatar: string | null } | null,
  modelName?: string | null,
): ApiGalleryItemDetail {
  const providerData = serializeUserFacingProviderData(task);
  return {
    type: 'image',
    id: task.id.toString(),
    userId: task.userId.toString(),
    modelId: task.modelId.toString(),
    modelName: modelName ?? null,
    provider: task.provider,
    prompt: task.prompt,
    negativePrompt: task.negativePrompt ?? null,
    status: task.status,
    resultUrl: task.resultUrl ?? null,
    thumbnailUrl: task.thumbnailUrl ?? null,
    isPublic: task.isPublic,
    createdAt: task.createdAt,
    completedAt: task.completedAt ?? null,
    parameters: toJsonObject(task.parameters),
    ...(providerData !== undefined ? { providerData } : {}),
    creator: creator ? { id: creator.id.toString(), username: creator.username, email: creator.email, avatar: creator.avatar } : null,
  };
}

/**
 * Serialize video task for gallery detail API (includes parameters)
 */
export function serializeGalleryVideoDetail(
  task: VideoTask,
  creator?: { id: bigint; username: string | null; email: string; avatar: string | null } | null,
  modelName?: string | null,
): ApiGalleryItemDetail {
  const providerData = serializeUserFacingProviderData(task);
  return {
    type: 'video',
    id: task.id.toString(),
    userId: task.userId.toString(),
    modelId: task.modelId.toString(),
    modelName: modelName ?? null,
    provider: task.provider,
    prompt: task.prompt,
    negativePrompt: null,
    status: task.status,
    resultUrl: task.resultUrl ?? null,
    thumbnailUrl: task.thumbnailUrl ?? null,
    isPublic: task.isPublic,
    createdAt: task.createdAt,
    completedAt: task.completedAt ?? null,
    parameters: toJsonObject(task.parameters),
    ...(providerData !== undefined ? { providerData } : {}),
    creator: creator ? { id: creator.id.toString(), username: creator.username, email: creator.email, avatar: creator.avatar } : null,
  };
}
