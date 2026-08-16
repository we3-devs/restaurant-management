import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from './uploads.constants';
import { StorageService } from './storage.service';
import { UploadsController } from './uploads.controller';

@Module({
  imports: [
    MulterModule.register({
      // Buffered in memory rather than written straight to disk, so the same
      // bytes can go to a bucket or to disk without two upload code paths.
      // Safe at a 2MB cap; revisit if this ever accepts large media.
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, callback) => {
        callback(null, file.mimetype in ALLOWED_IMAGE_TYPES);
      },
    }),
  ],
  controllers: [UploadsController],
  providers: [StorageService],
})
export class UploadsModule {}
