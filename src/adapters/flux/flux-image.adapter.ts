import { BaseImageAdapter, ImageGenerateParams, TaskStatusResponse, ValidationResult } from '../base/base-image.adapter';

export class FluxImageAdapter extends BaseImageAdapter {
  async submitTask(params: ImageGenerateParams): Promise<string> {
    const fluxParams = this.transformParams(params);
    const response = await this.httpClient.post<{ id: string }>('/v1/images/generations', fluxParams);
    return response.data.id;
  }

  async queryTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    const response = await this.httpClient.get<any>(`/v1/images/${taskId}`);
    const data = response.data ?? {};

    return {
      status: data.status,
      resultUrls: data.output?.image_url ? [data.output.image_url] : [],
      errorMessage: data.error,
    };
  }

  async getTaskResult(taskId: string): Promise<string[]> {
    const status = await this.queryTaskStatus(taskId);
    return status.resultUrls ?? [];
  }

  async cancelTask(taskId: string): Promise<void> {
    await this.httpClient.delete(`/v1/images/${taskId}`);
  }

  validateParams(_params: unknown): ValidationResult {
    return { valid: true };
  }

  transformParams(params: ImageGenerateParams): unknown {
    return {
      prompt: params.prompt,
      width: params.width ?? 1024,
      height: params.height ?? 1024,
      num_inference_steps: params.steps ?? 50,
      guidance_scale: 7.5,
      seed: params.seed,
    };
  }
}

