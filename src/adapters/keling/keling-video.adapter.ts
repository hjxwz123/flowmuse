import { BaseVideoAdapter, VideoGenerateParams } from '../base/base-video.adapter';
import { TaskStatusResponse, ValidationResult } from '../base/base-image.adapter';

export class KelingVideoAdapter extends BaseVideoAdapter {
  async submitTask(params: VideoGenerateParams): Promise<string> {
    const request = this.transformParams(params);
    const response = await this.httpClient.post<{ task_id: string }>('/v1/videos/text2video', request);
    return response.data.task_id;
  }

  async queryTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    const response = await this.httpClient.get<any>(`/v1/videos/${taskId}`);
    const data = response.data ?? {};

    return {
      status: data.task_status,
      progress: data.progress,
      resultUrls: data.video_url ? [data.video_url] : [],
      errorMessage: data.error_message,
    };
  }

  async getTaskResult(taskId: string): Promise<string> {
    const status = await this.queryTaskStatus(taskId);
    return status.resultUrls?.[0] ?? '';
  }

  async cancelTask(_taskId: string): Promise<void> {
    // TODO: Implement cancel if provider supports it
  }

  validateParams(_params: unknown): ValidationResult {
    return { valid: true };
  }

  transformParams(params: VideoGenerateParams): unknown {
    return {
      prompt: params.prompt,
      duration: params.duration ?? 5,
      aspect_ratio: params.resolution ?? '16:9',
      image_url: params.referenceImage,
    };
  }
}

