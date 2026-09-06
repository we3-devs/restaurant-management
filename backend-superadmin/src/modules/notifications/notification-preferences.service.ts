import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from './entities/notification-preference.entity';
import type { NotificationType } from './entities/notification.entity';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepo: Repository<NotificationPreference>,
  ) {}

  async getOrCreate(userId: number): Promise<NotificationPreference> {
    const existing = await this.preferenceRepo.findOne({ where: { userId } });
    if (existing) return existing;
    return this.preferenceRepo.save(
      this.preferenceRepo.create({ userId, emailEnabled: false, smsEnabled: false, pushEnabled: false, mutedTypes: [] }),
    );
  }

  async update(userId: number, dto: UpdateNotificationPreferenceDto): Promise<NotificationPreference> {
    const preference = await this.getOrCreate(userId);
    Object.assign(preference, {
      ...(dto.emailEnabled !== undefined && { emailEnabled: dto.emailEnabled }),
      ...(dto.smsEnabled !== undefined && { smsEnabled: dto.smsEnabled }),
      ...(dto.pushEnabled !== undefined && { pushEnabled: dto.pushEnabled }),
      ...(dto.mutedTypes !== undefined && { mutedTypes: dto.mutedTypes as NotificationType[] }),
    });
    return this.preferenceRepo.save(preference);
  }
}
