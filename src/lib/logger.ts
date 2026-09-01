/**
 * Structured JSON logging utility.
 *
 * - Production: single-line JSON to stdout (parseable by log aggregators)
 * - Development: pretty-printed multi-line output with color hints
 * - NEVER logs passwords, JWTs, refresh tokens, API keys, TOTP secrets
 * - Auto-strips sensitive fields from context objects
 * - All log calls are wrapped so logging failures never break routes
 */

import { isProduction, isDevelopment } from '@/lib/env';

// ============================================
// TYPES
// ============================================

type LogLevel = 'info' | 'warn' | 'error' | 'security';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context: Record<string, unknown>;
}

// ============================================
// SENSITIVE FIELD DETECTION
// ============================================

/**
 * Field name patterns that must NEVER appear in log output.
 * Checked case-insensitively against both keys and string values.
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /^password$/i,
  /password/i,
  /passwd/i,
  /^secret$/i,
  /secret$/i,
  /totp/i,
  /otp_secret/i,
  /api[_\-]?key/i,
  /api[_\-]?secret/i,
  /access[_\-]?token/i,
  /refresh[_\-]?token/i,
  /auth[_\-]?token/i,
  /bearer/i,
  /authorization/i,
  /cookie/i,
  /credential/i,
  /private[_\-]?key/i,
  /session[_\-]?id/i,
  /smtp[_\-]?pass/i,
  /database[_\-]?url/i,
  /redis[_\-]?url/i,
  /jwt/i,
  /token$/i,
];

/**
 * Patterns that detect sensitive VALUES (even if the key name is safe).
 * Applied to string values only.
 */
const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, // JWT format
  /^sk-[a-zA-Z0-9]{20,}$/,                                         // API key format (e.g. OpenAI)
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function isSensitiveValue(value: string): boolean {
  if (value.length < 8) return false;
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Recursively strip sensitive fields from an object.
 * Returns a new object — never mutates the input.
 */
function stripSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 10) return '[max-depth]';

  if (obj == null) return obj;
  if (typeof obj === 'string') {
    return isSensitiveValue(obj) ? '[REDACTED]' : obj;
  }
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => stripSensitive(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string' && isSensitiveValue(value)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = stripSensitive(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ============================================
// FORMATTERS
// ============================================

function formatTimestamp(): string {
  return new Date().toISOString();
}

function jsonLine(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function prettyLine(entry: LogEntry): string {
  const levelColors: Record<LogLevel, string> = {
    info: '\x1b[36m',    // cyan
    warn: '\x1b[33m',    // yellow
    error: '\x1b[31m',   // red
    security: '\x1b[35m', // magenta
  };
  const reset = '\x1b[0m';
  const color = levelColors[entry.level] ?? '';
  const levelStr = entry.level.toUpperCase().padEnd(8);
  const ctx = Object.keys(entry.context).length > 0
    ? '\n  ' + JSON.stringify(entry.context, null, 2).split('\n').join('\n  ')
    : '';

  return `${color}${levelStr}${reset} [${entry.module}] ${entry.message}${ctx}`;
}

// ============================================
// CORE LOG FUNCTION
// ============================================

function emit(level: LogLevel, module: string, message: string, context: Record<string, unknown> = {}): void {
  try {
    const safeContext = stripSensitive(context) as Record<string, unknown>;
    const entry: LogEntry = {
      timestamp: formatTimestamp(),
      level,
      module,
      message,
      context: safeContext,
    };

    const line = isDevelopment ? prettyLine(entry) : jsonLine(entry);

    switch (level) {
      case 'error':
        process.stderr.write(line + '\n');
        break;
      case 'security':
      case 'warn':
        process.stderr.write(line + '\n');
        break;
      case 'info':
      default:
        process.stdout.write(line + '\n');
        break;
    }
  } catch {
    // Intentionally swallowed — logging must never break the application
  }
}

// ============================================
// PUBLIC API
// ============================================

export const logger = {
  /**
   * General informational log.
   */
  info(message: string, context: Record<string, unknown> & { module?: string } = {}): void {
    const { module: mod = 'app', ...rest } = context;
    emit('info', mod as string, message, rest);
  },

  /**
   * Warning log for unexpected but non-fatal conditions.
   */
  warn(message: string, context: Record<string, unknown> & { module?: string } = {}): void {
    const { module: mod = 'app', ...rest } = context;
    emit('warn', mod as string, message, rest);
  },

  /**
   * Error log for failures and exceptions.
   */
  error(message: string, context: Record<string, unknown> & { module?: string; error?: unknown } = {}): void {
    const { module: mod = 'app', error: err, ...rest } = context;
    const enriched = { ...rest };
    if (err instanceof Error) {
      enriched.errorMessage = err.message;
      if (isDevelopment) {
        enriched.errorStack = err.stack;
      }
    }
    emit('error', mod as string, message, enriched);
  },

  /**
   * Security event log for authentication, authorization, and audit events.
   * Always written to stderr.
   */
  security(eventType: string, context: Record<string, unknown> & { module?: string } = {}): void {
    const { module: mod = 'security', ...rest } = context;
    emit('security', mod as string, eventType, rest);
  },
};
