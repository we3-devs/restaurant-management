import { Controller, Post, Body, Headers } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { User } from '../users/entities/user.entity';
import { AssistantService } from './assistant.service';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  chat(@CurrentUser() user: User, @Body() body: { question?: string; outletId?: number }) {
    return this.assistant.chat(user, body.question ?? '', body.outletId);
  }

  @Post('cron/daily-summary')
  @Public()
  dailySummary(@Headers('x-cron-secret') secret?: string) {
    return this.assistant.dailySummary(secret);
  }
}
