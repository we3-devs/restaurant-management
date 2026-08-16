import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppConfig } from '../../config/configuration';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { UPLOADS_ROUTE } from './uploads.constants';

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly configService: ConfigService<AppConfig>) {}

  @Post('branding')
  // Same permission that gates the settings these images are chosen from —
  // anyone who can set a logo URL can upload the logo it points at.
  @RequirePermissions('settings.manage')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Uploads a logo or favicon image and returns its absolute URL, for use as logoUrl/faviconUrl in settings',
  })
  uploadBranding(@UploadedFile() file?: Express.Multer.File) {
    // Multer's fileFilter rejects by skipping the file rather than throwing,
    // so an unsupported type arrives here as simply no file at all.
    if (!file) {
      throw new BadRequestException(
        'A PNG, JPEG, WebP, GIF or ICO file under 2MB is required',
      );
    }

    const { publicUrl } = this.configService.get('app', { infer: true })!;
    return { url: `${publicUrl}/${UPLOADS_ROUTE}/${file.filename}` };
  }
}
