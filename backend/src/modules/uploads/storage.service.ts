import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppConfig } from '../../config/configuration';
import {
  ALLOWED_IMAGE_TYPES,
  UPLOADS_ROUTE,
  resolveUploadDir,
} from './uploads.constants';

const CACHE_CONTROL = 'public, max-age=2592000, immutable';

/** Keeps bucket objects grouped by what they are, so branding, menu photos, and raw import files stay separable. */
export type UploadPurpose = 'branding' | 'food' | 'import';

/**
 * Saves branding images to an S3-compatible bucket, falling back to local disk
 * when no bucket is configured.
 *
 * The fallback is not just a dev convenience: local disk on an ephemeral host
 * (Render, Fly, most containers) loses every upload on redeploy, so the bucket
 * is what makes this durable in production. Any S3-compatible provider works —
 * Cloudflare R2, Supabase Storage, Backblaze B2, MinIO, AWS — because the only
 * provider-specific inputs are the endpoint and the public base URL.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null = null;
  private readonly bucket: string;
  private readonly objectPublicUrl: string;

  constructor(private readonly configService: ConfigService<AppConfig>) {
    const storage = this.configService.get('storage', { infer: true })!;
    this.bucket = storage.bucket;
    // R2 serves reads from a different host than the S3 API endpoint, so the
    // public base is configured separately rather than derived.
    this.objectPublicUrl = storage.publicUrl || storage.endpoint;

    if (storage.bucket && storage.endpoint && storage.accessKeyId) {
      this.client = new S3Client({
        region: storage.region,
        endpoint: storage.endpoint,
        // Non-AWS providers address buckets by path, not by subdomain.
        forcePathStyle: true,
        credentials: {
          accessKeyId: storage.accessKeyId,
          secretAccessKey: storage.secretAccessKey,
        },
      });
      this.logger.log(`Branding uploads -> bucket "${storage.bucket}"`);
    } else {
      this.logger.warn(
        'S3_BUCKET not configured — branding uploads go to local disk, which does not survive a redeploy on an ephemeral host',
      );
    }
  }

  async saveImage(
    buffer: Buffer,
    mimetype: string,
    purpose: UploadPurpose = 'branding',
  ): Promise<string> {
    return this.save(buffer, mimetype, ALLOWED_IMAGE_TYPES[mimetype], purpose);
  }

  /**
   * Non-image binaries (CSV/Excel uploads for data-import) — same storage
   * path as saveImage, but the extension is supplied by the caller (from its
   * own mimetype->extension table, e.g. ALLOWED_IMPORT_TYPES) rather than
   * being looked up from the image-only table.
   */
  async saveFile(
    buffer: Buffer,
    mimetype: string,
    extension: string,
    purpose: UploadPurpose,
  ): Promise<string> {
    return this.save(buffer, mimetype, extension, purpose);
  }

  private async save(
    buffer: Buffer,
    mimetype: string,
    extension: string,
    purpose: UploadPurpose,
  ): Promise<string> {
    const filename = `${randomUUID()}${extension}`;

    if (!this.client) {
      // Disk keeps a flat layout: main.ts serves one directory, and the
      // filename is already a UUID so there's nothing to collide.
      return this.saveToDisk(buffer, filename);
    }

    const key = `${purpose}/${filename}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
        CacheControl: CACHE_CONTROL,
      }),
    );

    return `${this.objectPublicUrl}/${key}`;
  }

  private async saveToDisk(buffer: Buffer, filename: string): Promise<string> {
    const uploadDir = resolveUploadDir(this.configService);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), buffer);

    const { publicUrl } = this.configService.get('app', { infer: true })!;
    return `${publicUrl}/${UPLOADS_ROUTE}/${filename}`;
  }
}
