import { Injectable } from '@nestjs/common';
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
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST') ?? '';
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER') ?? '';
    const pass = this.config.get<string>('SMTP_PASS') ?? '';
    this.from = this.config.get<string>('SMTP_FROM') ?? 'no-reply@example.com';

    if (!host) {
      const nodeEnv = (this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? '').toLowerCase();
      const isProd = nodeEnv === 'production';
      if (isProd) {
        throw new Error('Missing SMTP_HOST in production environment');
      }
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
      // In dev, allow running without SMTP.
      // eslint-disable-next-line no-console
      console.log('[email:mock]', params);
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
