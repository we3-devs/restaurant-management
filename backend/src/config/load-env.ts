import { config } from 'dotenv';

// Prefer developer-specific local overrides; keep .env as the shared fallback.
// Existing process environment variables still take precedence over both files.
config({ path: ['.env.local', '.env'] });
