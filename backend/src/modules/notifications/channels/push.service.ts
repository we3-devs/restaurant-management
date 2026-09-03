import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import webPush from 'web-push';
import { PushSubscription } from '../entities/push-subscription.entity';

/** Reads VAPID_* directly from process.env — push is an optional channel, an unconfigured keypair should no-op, not fail app startup. */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly configured: boolean;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptionRepo: Repository<PushSubscription>,
  ) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@localhost';

    if (!publicKey || !privateKey) {
      this.logger.warn('VAPID_PUBLIC_KEY/PRIVATE_KEY not configured — push notifications disabled');
      this.configured = false;
      return;
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);
    this.configured = true;
  }

  get isConfigured(): boolean {
    return this.configured;
  }

  get publicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY ?? null;
  }

  async subscribe(userId: number, endpoint: string, p256dh: string, auth: string, app: 'operational' | 'dashboard'): Promise<void> {
    const existing = await this.subscriptionRepo.findOne({ where: { endpoint } });
    if (existing) {
      existing.userId = userId;
      existing.p256dh = p256dh;
      existing.auth = auth;
      existing.app = app;
      await this.subscriptionRepo.save(existing);
      return;
    }
    await this.subscriptionRepo.save(this.subscriptionRepo.create({ userId, endpoint, p256dh, auth, app }));
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.subscriptionRepo.delete({ endpoint });
  }

  async sendToUser(
    userId: number,
    title: string,
    body: string,
    data?: { type?: string; orderId?: number | null },
    priority: 'normal' | 'high' | 'urgent' = 'normal',
  ): Promise<void> {
    if (!this.configured) return;
    const subscriptions = await this.subscriptionRepo
      .createQueryBuilder('subscription')
      .where('subscription.user_id = :userId', { userId })
      .andWhere(
        priority === 'urgent'
          ? "subscription.app IN ('operational', 'dashboard')"
          : "subscription.app = 'operational'",
      )
      .getMany();
    const payload = JSON.stringify({ title, body, data });

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription expired or was revoked by the browser — stop retrying it.
            await this.subscriptionRepo.delete({ id: sub.id });
            return;
          }
          this.logger.error(`Failed to send push to subscription ${sub.id}: ${(error as Error).message}`);
        }
      }),
    );
  }
}
