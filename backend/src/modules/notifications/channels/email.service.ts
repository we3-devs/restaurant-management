import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

/**
 * Reads SMTP_* directly from process.env rather than the strict
 * EnvironmentVariables schema (env.validation.ts) — email is an optional
 * channel, so an unconfigured SMTP block should silently no-op, not fail
 * app startup.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    this.from = process.env.SMTP_FROM ?? user ?? 'no-reply@localhost';

    if (!host || !port || !user || !pass) {
      this.logger.warn('SMTP_HOST/PORT/USER/PASS not fully configured — email notifications disabled');
      this.transporter = null;
      return;
    }

    this.transporter = createTransport({
      host,
      port: Number(port),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) return;
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${(error as Error).message}`);
    }
  }
}
