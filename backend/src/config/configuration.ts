export interface AppConfig {
  app: {
    port: number;
    frontendUrls: string[];
    publicUrl: string;
    uploadDir: string;
  };
  storage: {
    endpoint: string;
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    /** Public base for reading objects — on R2 this is the pub-*.r2.dev or custom domain, not the API endpoint. */
    publicUrl: string;
  };
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  bcrypt: {
    saltRounds: number;
  };
  seed: {
    adminEmail: string;
    adminPassword: string;
  };
}

export default (): AppConfig => ({
  app: {
    port: parseInt(process.env.PORT ?? '3001', 10),
    // FRONTEND_URL may be a comma-separated list — dashboard-web and
    // operational-web are two different origins in dev (ports 3000/3100)
    // that both need to pass the /kds websocket's CORS check.
    frontendUrls: (process.env.FRONTEND_URL ?? 'http://localhost:3000')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean),
    // Uploaded branding is referenced by absolute URL — the guest app, the two
    // staff apps and a printed receipt are all different origins, so a relative
    // /api/uploads path would resolve against the wrong host.
    publicUrl: (
      process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? '3001'}`
    ).replace(/\/$/, ''),
    uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  },
  // Any S3-compatible provider: Cloudflare R2, Supabase Storage, Backblaze B2,
  // MinIO, or AWS itself. Leave S3_BUCKET unset and uploads fall back to local
  // disk, which is what keeps dev working with no credentials.
  storage: {
    endpoint: process.env.S3_ENDPOINT ?? '',
    bucket: process.env.S3_BUCKET ?? '',
    region: process.env.S3_REGION ?? 'auto',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    publicUrl: (process.env.S3_PUBLIC_URL ?? '').replace(/\/$/, ''),
  },
  database: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_DATABASE ?? 'restaurant',
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10),
  },
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@rms.local',
    adminPassword: process.env.SEED_ADMIN_PASSWORD ?? '',
  },
});
