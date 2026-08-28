/**
 * Centralized environment configuration with runtime validation.
 * Required vars are validated at module load time.
 * Provider-specific vars (AI, telephony, etc.) are optional.
 */

interface EnvironmentConfig {
  // Required
  DATABASE_URL: string;
  JWT_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
  APP_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';

  // Optional - provider configurations (app starts without these)
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
}

const REQUIRED_VARS: (keyof EnvironmentConfig)[] = [
  'DATABASE_URL',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'APP_URL',
  'NODE_ENV',
];

function loadEnv(): EnvironmentConfig {
  const missing: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `Please check your .env file.`
    );
  }

  return {
    // Required
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: process.env.JWT_SECRET!,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET!,
    APP_URL: process.env.APP_URL!,
    NODE_ENV: (process.env.NODE_ENV as EnvironmentConfig['NODE_ENV']) || 'development',

    // Optional - AI providers
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,

    // Optional - Speech
    DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,

    // Optional - Telephony
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,

    // Optional - Storage
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,

    // Optional - Monitoring
    SENTRY_DSN: process.env.SENTRY_DSN,

    // Optional - Email
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM,

    // Optional - Cache
    REDIS_URL: process.env.REDIS_URL,
  };
}

/**
 * Typed environment configuration.
 * Access via `import { env } from '@/lib/env'`
 *
 * Required vars are validated at first import.
 * Optional provider vars default to undefined.
 */
export const env = loadEnv();

/**
 * Check if we're running in production.
 */
export const isProduction = env.NODE_ENV === 'production';

/**
 * Check if we're running in development.
 */
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * Check if we're running tests.
 */
export const isTest = env.NODE_ENV === 'test';

export type Env = EnvironmentConfig;
