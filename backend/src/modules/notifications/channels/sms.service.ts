import { Injectable, Logger } from '@nestjs/common';
import Twilio from 'twilio';

/** Reads TWILIO_* directly from process.env — SMS is an optional channel, an unconfigured account should no-op, not fail app startup. */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly client: ReturnType<typeof Twilio> | null;
  private readonly fromNumber: string | undefined;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !this.fromNumber) {
      this.logger.warn('TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER not fully configured — SMS notifications disabled');
      this.client = null;
      return;
    }

    this.client = Twilio(accountSid, authToken);
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async send(to: string, body: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.messages.create({ from: this.fromNumber, to, body });
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}: ${(error as Error).message}`);
    }
  }
}
