import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { AppConfig } from '../../config/configuration';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  resolveUploadDir,
} from './uploads.constants';
import { UploadsController } from './uploads.controller';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) => {
        const uploadDir = resolveUploadDir(configService);
        // Created up front so the first upload of a fresh deploy doesn't fail
        // on ENOENT — main.ts serves this same directory statically.
        mkdirSync(uploadDir, { recursive: true });

        return {
          storage: diskStorage({
            destination: uploadDir,
            filename: (_req, file, callback) => {
              const ext = ALLOWED_IMAGE_TYPES[file.mimetype];
              callback(null, `${randomUUID()}${ext}`);
            },
          }),
          limits: { fileSize: MAX_UPLOAD_BYTES },
          fileFilter: (_req, file, callback) => {
            callback(null, file.mimetype in ALLOWED_IMAGE_TYPES);
          },
        };
      },
    }),
  ],
  controllers: [UploadsController],
})
export class UploadsModule {}
