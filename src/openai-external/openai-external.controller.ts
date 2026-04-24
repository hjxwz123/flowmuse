import { Body, Controller, Get, Headers, Post, Res } from '@nestjs/common';
import { Response } from 'express';

import { OpenaiDeepResearchService } from './openai-deep-research.service';

@Controller(['openai/v1', 'v1'])
export class OpenaiExternalController {
  constructor(private readonly service: OpenaiDeepResearchService) {}

  @Get('models')
  async listModels(
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const authError = this.service.verifyAccess(authorization);
    if (authError) {
      this.service.sendJsonError(res, authError.status, authError.message, authError.type, authError.code);
      return;
    }

    try {
      const payload = await this.service.buildModelListPayload();
      res.status(200).json(payload);
    } catch (error) {
      const message = this.service.normalizeErrorMessage(error);
      this.service.sendJsonError(res, 500, message, 'server_error', 'internal_error');
    }
  }

  @Post('chat/completions')
  async chatCompletions(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    const authError = this.service.verifyAccess(authorization);
    if (authError) {
      this.service.sendJsonError(res, authError.status, authError.message, authError.type, authError.code);
      return;
    }

    const parsed = this.service.parseCompletionRequest(body);
    if (!parsed.ok) {
      this.service.sendJsonError(res, parsed.error.status, parsed.error.message, parsed.error.type, parsed.error.code);
      return;
    }

    await this.service.handleStreamCompletion(parsed.data, res);
  }
}
