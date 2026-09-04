/**
 * Centralized environment configuration.
 * In development, missing required vars produce console warnings instead of crashing.
 * In production, missing required vars still throw (fail-fast).
 */

interface EnvironmentConfig {
  DATABASE_URL: string;
  JWT_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
  APP_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';

  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  GOOGLE_AI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DEEPGRAM_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  AWS_S3_BUCKET?: string;
  SENTRY_DSN?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  EMAIL_FROM?: string;
  REDIS_URL?: string;
  WHATSAPP_PROVIDER_URL?: string;
  WHATSAPP_API_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  PUSH_PROVIDER_KEY?: string;
}

const REQUIRED_VARS: (keyof EnvironmentConfig)[] = [
  'DATABASE_URL',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'APP_URL',
];

function loadEnv(): EnvironmentConfig {
  const missing: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isDev = nodeEnv !== 'production';
  // During Next.js build (next build), env vars come from Vercel at runtime.
  // Only throw at actual runtime in production, not during static analysis/build.
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || !process.env.DATABASE_URL;

  if (missing.length > 0) {
    if (isDev || isBuildTime) {
      console.warn(
        `[HubSphere] Missing env vars: ${missing.join(', ')}. ` +
        (isBuildTime
          ? 'Build will succeed; vars must be set in deployment environment (Vercel/Supabase).'
          : 'Some features may not work. Set these in .env for full functionality.')
      );
    } else {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}. `
        + `Please check your .env file.`
      );
    }
  }

  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl && !dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    if (isDev || isBuildTime) {
      console.warn(
        `[HubSphere] DATABASE_URL should be PostgreSQL (postgresql://...). Got: ${dbUrl.substring(0, 12)}...`
      );
    } else {
      throw new Error(
        'DATABASE_URL must be a PostgreSQL connection string.'
      );
    }
  }

  // Validate JWT secret minimum strength
  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret.length > 0 && jwtSecret.length < 32) {
    const msg = 'JWT_SECRET must be at least 32 characters for HMAC-SHA256 security.';
    if (isDev || isBuildTime) {
      console.warn(`[HubSphere] ${msg} Current length: ${jwtSecret.length}. Set a stronger secret.`);
    } else {
      throw new Error(msg);
    }
  }

  // Validate REFRESH_TOKEN_SECRET minimum strength
  const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || '';
  if (refreshTokenSecret.length > 0 && refreshTokenSecret.length < 32) {
    const msg = 'REFRESH_TOKEN_SECRET must be at least 32 characters.';
    if (isDev || isBuildTime) {
      console.warn(`[HubSphere] ${msg} Current length: ${refreshTokenSecret.length}. Set a stronger secret.`);
    } else {
      throw new Error(msg);
    }
  }

  // Generate a random dev-only secret when env var is missing.
  // In production, the REQUIRED_VARS check above already throws.
  // Empty-string secrets must never be used — they allow trivially forgeable JWTs.
  const generateDevSecret = (name: string): string => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `dev-${name}-${hex}`;
  };

  return {
    DATABASE_URL: process.env.DATABASE_URL || '',
    JWT_SECRET: process.env.JWT_SECRET || generateDevSecret('jwt'),
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || generateDevSecret('refresh'),
    APP_URL: process.env.APP_URL || '',
    NODE_ENV: (process.env.NODE_ENV as EnvironmentConfig['NODE_ENV']) || 'development',

    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM,
    REDIS_URL: process.env.REDIS_URL,
    WHATSAPP_PROVIDER_URL: process.env.WHATSAPP_PROVIDER_URL,
    WHATSAPP_API_TOKEN: process.env.WHATSAPP_API_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    PUSH_PROVIDER_KEY: process.env.PUSH_PROVIDER_KEY,
  };
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
export type Env = EnvironmentConfig;
