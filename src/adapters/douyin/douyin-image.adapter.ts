import { BaseImageAdapter, ImageGenerateParams, TaskStatusResponse, ValidationResult } from '../base/base-image.adapter';

export class DouyinImageAdapter extends BaseImageAdapter {
  async submitTask(_params: ImageGenerateParams): Promise<string> {
    throw new Error('Douyin adapter not implemented');
  }

  async queryTaskStatus(_taskId: string): Promise<TaskStatusResponse> {
    throw new Error('Douyin adapter not implemented');
  }

  async getTaskResult(_taskId: string): Promise<string[]> {
    throw new Error('Douyin adapter not implemented');
  }

  async cancelTask(_taskId: string): Promise<void> {
    throw new Error('Douyin adapter not implemented');
  }

  validateParams(_params: unknown): ValidationResult {
    return { valid: true };
  }

  transformParams(params: ImageGenerateParams): unknown {
    return params;
  }
}

