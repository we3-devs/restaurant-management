import { ConfigService } from '@nestjs/config';
import { isAbsolute, join } from 'node:path';
import { AppConfig } from '../../config/configuration';

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * Extension is derived from the sniffed mime type, never from the client's
 * originalname — that string is attacker-controlled and is the usual way a
 * ".png" upload ends up on disk as ".html" or ".php".
 *
 * SVG is deliberately absent: it can carry <script>, and anything served from
 * the API origin executing script there is a stored-XSS foothold. Raster
 * formats cover logos and favicons; add SVG only behind sanitisation.
 */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
};

export const UPLOADS_ROUTE = 'api/uploads';

export function resolveUploadDir(config: ConfigService<AppConfig>): string {
  const configured = config.get('app', { infer: true })!.uploadDir;
  return isAbsolute(configured) ? configured : join(process.cwd(), configured);
}
