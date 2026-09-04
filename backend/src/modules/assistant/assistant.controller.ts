import { BadRequestException, Controller, Post, Body, UploadedFile, UseInterceptors, Headers } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { User } from '../users/entities/user.entity';
import { AssistantService } from './assistant.service';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('ingest')
  @UseInterceptors(FileInterceptor('file'))
  ingest(@CurrentUser() user: User, @UploadedFile() file: Express.Multer.File, @Body('outletId') outletId?: string) {
    if (!file) throw new BadRequestException('A PDF or DOCX file is required');
    return this.assistant.ingest(user, file, outletId ? Number(outletId) : undefined);
  }

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
