import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

export type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST') ?? '';
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER') ?? '';
    const pass = this.config.get<string>('SMTP_PASS') ?? '';
    this.from = this.config.get<string>('SMTP_FROM') ?? 'no-reply@example.com';

    if (!host) {
      this.logger.warn('SMTP_HOST is not configured. Email sending will be mocked.');
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });
  }

  async send(params: SendEmailParams) {
    if (!this.transporter) {
      this.logger.warn(`Email mocked: ${params.to} - ${params.subject}`);
      return { ok: true, mocked: true };
    }

    const info = await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    return { ok: true, messageId: info.messageId };
  }
}
