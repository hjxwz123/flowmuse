import { BaseVideoAdapter, VideoGenerateParams } from '../base/base-video.adapter';
import { TaskStatusResponse, ValidationResult } from '../base/base-image.adapter';

// 海螺AI提交任务响应
type MinimaxVideoSubmitResponse = {
  code?: number;
  message?: string;
  request_id?: string;
  data?: {
    task_id?: string;
    task_status?: string;
    created_at?: number;
    updated_at?: number;
  };
  // 兼容旧版响应格式
  task_id?: string;
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
  [key: string]: unknown;
};

// 海螺AI查询任务响应
type MinimaxVideoQueryResponse = {
  code?: string;
  message?: string;
  data?: {
    task_id?: string;
    action?: string;
    status?: string; // Waiting, Running, Success, Failed, Cancelled
    fail_reason?: string;
    submit_time?: number;
    start_time?: number;
    finish_time?: number;
    progress?: string;
    data?: {
      file?: {
        bytes?: number;
        file_id?: number;
        purpose?: string;
        filename?: string;
        created_at?: number;
        download_url?: string;
        backup_download_url?: string;
      };
      status?: string;
      file_id?: string;
      task_id?: string;
      base_resp?: {
        status_msg?: string;
        status_code?: number;
      };
      video_width?: number;
      video_height?: number;
    };
  };
  [key: string]: unknown;
};

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function mapMinimaxStateToStatus(state: string | undefined): TaskStatusResponse['status'] {
  const s = (state ?? '').toLowerCase();
  if (!s) return 'processing';
  if (s === 'waiting') return 'pending';
  if (s === 'running') return 'processing';
  if (s === 'success') return 'completed';
  if (s === 'failed' || s === 'cancelled') return 'failed';
  return 'processing';
}

/**
 * 海螺AI（MiniMax）视频生成适配器
 *
 * 支持功能：
 * - 文生视频
 * - 图生视频（首帧图片）
 * - 图生视频（首尾帧）
 *
 * 支持的参数：
 * - model: MiniMax-Hailuo-02 或 MiniMax-Hailuo-2.3
 * - prompt: 提示词
 * - duration: 6 或 10 秒
 * - first_frame_image: 首帧图片URL（图生视频）
 * - last_frame_image: 尾帧图片URL（图生视频）
 * - resolution: 分辨率，如 768P（可选）
 * - prompt_optimizer: 是否启用提示词优化（可选）
 */
export class MinimaxVideoAdapter extends BaseVideoAdapter {
  async submitTask(params: VideoGenerateParams): Promise<string> {
    const request = this.transformParams(params) as Record<string, unknown>;
    const res = await this.httpClient.post<MinimaxVideoSubmitResponse>('/minimax/v1/video_generation', request, {
      headers: { Accept: 'application/json' },
    });

    const data = res.data ?? {};

    // 检查错误
    if (data.message && data.code !== 0 && data.code !== undefined) {
      throw new Error(data.message);
    }
    if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
      throw new Error(data.base_resp.status_msg ?? 'Minimax video submit failed');
    }

    // 获取 task_id（兼容两种响应格式）
    const taskId = asString(data.data?.task_id) ?? asString(data.task_id);
    if (!taskId) throw new Error('Minimax video submit: missing task id');

    return taskId;
  }

  async queryTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    const res = await this.httpClient.get<MinimaxVideoQueryResponse>(
      `/minimax/v1/query/video_generation`,
      {
        params: { task_id: taskId },
        headers: { Accept: 'application/json' },
      },
    );

    const data = res.data?.data ?? {};
    const state = asString(data.status);
    const status = mapMinimaxStateToStatus(state);

    // 获取视频下载URL
    const videoUrl = asString(data.data?.file?.download_url) ?? asString(data.data?.file?.backup_download_url);
    const errorMessage = asString(data.fail_reason);

    return {
      status,
      resultUrls: videoUrl ? [videoUrl] : [],
      errorMessage: status === 'failed' ? errorMessage ?? 'Task failed' : undefined,
      providerData: {
        ...data,
        progress: data.progress,
        videoWidth: data.data?.video_width,
        videoHeight: data.data?.video_height,
      },
    };
  }

  async getTaskResult(taskId: string): Promise<string> {
    const status = await this.queryTaskStatus(taskId);
    return status.resultUrls?.[0] ?? '';
  }

  async cancelTask(_taskId: string): Promise<void> {
    // 海螺AI视频生成API不支持取消任务
  }

  validateParams(params: unknown): ValidationResult {
    const p = (params ?? {}) as VideoGenerateParams;
    const errors: string[] = [];

    // 验证提示词
    if (!asString(p.prompt)) errors.push('prompt is required');

    // 验证模型
    const model = asString((p as any).model) ?? asString((p as any).minimaxModel);
    if (!model) errors.push('model is required');

    // 验证时长（仅支持6或10秒）
    const duration = asNumber((p as any).duration);
    if (duration !== undefined && duration !== 6 && duration !== 10) {
      errors.push('duration must be 6 or 10 seconds');
    }

    return { valid: errors.length === 0, errors };
  }

  transformParams(params: VideoGenerateParams): unknown {
    const body: Record<string, unknown> = {
      model: asString((params as any).model) ?? asString((params as any).minimaxModel) ?? 'MiniMax-Hailuo-02',
      prompt: params.prompt,
      duration: asNumber((params as any).duration) ?? 6,
    };

    // 处理首帧图片（图生视频）
    const firstFrameImage = asString((params as any).firstFrameImage) ??
                           asString((params as any).first_frame_image) ??
                           asString((params as any).firstFrame) ??
                           asString(params.referenceImage);
    if (firstFrameImage) {
      body.first_frame_image = firstFrameImage;
    }

    // 处理尾帧图片（图生视频）
    const lastFrameImage = asString((params as any).lastFrameImage) ??
                          asString((params as any).last_frame_image) ??
                          asString((params as any).lastFrame);
    if (lastFrameImage) {
      body.last_frame_image = lastFrameImage;
    }

    // 分辨率（可选）
    const resolution = asString((params as any).resolution);
    if (resolution) {
      body.resolution = resolution;
    }

    // 提示词优化（可选）
    const promptOptimizer = (params as any).promptOptimizer ?? (params as any).prompt_optimizer;
    if (promptOptimizer !== undefined) {
      body.prompt_optimizer = promptOptimizer;
    }

    return body;
  }
}
