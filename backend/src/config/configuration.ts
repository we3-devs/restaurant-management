export interface AppConfig {
  app: {
    port: number;
    frontendUrls: string[];
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
