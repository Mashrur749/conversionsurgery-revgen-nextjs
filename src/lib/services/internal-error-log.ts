import { getDb } from '@/db';
import { errorLog } from '@/db/schema';

const MAX_MESSAGE_LENGTH = 1200;
const MAX_STACK_LENGTH = 6000;
const REDACTED_SECRET = '[REDACTED_SECRET]';
const REDACTED_TEXT = '[REDACTED_TEXT]';
const REDACTED_PHONE = '[REDACTED_PHONE]';

const REDACTION_PATTERNS: Array<[RegExp, string]> = [
  [/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]'],
  [/\bsk-[A-Za-z0-9_-]{16,}\b/g, 'sk-[REDACTED]'],
  [/\bAC[a-fA-F0-9]{32}\b/g, 'AC[REDACTED]'],
  [/\bSG\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g, 'SG.[REDACTED].[REDACTED]'],
  [/\bpk_(live|test)_[A-Za-z0-9]{16,}\b/gi, 'pk_$1_[REDACTED]'],
  [/\bsk_(live|test)_[A-Za-z0-9]{16,}\b/gi, 'sk_$1_[REDACTED]'],
];
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g;

const SECRET_FIELD_KEYS = new Set([
  'token',
  'auth_token',
  'access_token',
  'refresh_token',
  'secret',
  'api_key',
  'openai_api_key',
  'twilio_auth_token',
  'stripe_secret_key',
  'password',
  'authorization',
  'signature',
  'cookie',
]);

const MESSAGE_BODY_FIELD_KEYS = new Set([
  'body',
  'content',
  'message',
  'text',
  'transcript',
  'speech_result',
  'prompt',
  'input',
  'output',
  'last_message',
]);

const PHONE_FIELD_KEYS = new Set([
  'phone',
  'from',
  'to',
  'caller',
  'recipient',
  'mobile',
  'number',
  'lead_phone',
  'owner_phone',
  'transfer_to',
  'twilio_number',
]);

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...[truncated]`;
}

function getLeafKey(path?: string): string | undefined {
  if (!path) return undefined;
  const segments = path.split('.');
  return segments[segments.length - 1];
}

function normalizeFieldKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '');
}

function isSecretFieldKey(normalizedKey: string): boolean {
  if (SECRET_FIELD_KEYS.has(normalizedKey)) return true;
  return (
    normalizedKey.endsWith('_token') ||
    normalizedKey.endsWith('_secret') ||
    normalizedKey.endsWith('_password') ||
    normalizedKey.endsWith('_api_key')
  );
}

function isMessageBodyFieldKey(normalizedKey: string): boolean {
  if (MESSAGE_BODY_FIELD_KEYS.has(normalizedKey)) return true;
  return (
    normalizedKey.endsWith('_body') ||
    normalizedKey.endsWith('_content') ||
    normalizedKey.endsWith('_message') ||
    normalizedKey.endsWith('_text') ||
    normalizedKey.includes('transcript')
  );
}

function isPhoneFieldKey(normalizedKey: string): boolean {
  if (PHONE_FIELD_KEYS.has(normalizedKey)) return true;
  return (
    normalizedKey.endsWith('_phone') ||
    normalizedKey.endsWith('_number') ||
    normalizedKey.endsWith('_from') ||
    normalizedKey.endsWith('_to')
  );
}

function maskPhoneForLog(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) {
    return REDACTED_PHONE;
  }
  return `[PHONE:${digits.slice(-4)}]`;
}

function sanitizeByKey(value: string, keyPath?: string): string {
  const key = getLeafKey(keyPath);
  if (!key) return value;
  const normalizedKey = normalizeFieldKey(key);

  if (isSecretFieldKey(normalizedKey)) {
    return REDACTED_SECRET;
  }
  if (isMessageBodyFieldKey(normalizedKey)) {
    return `${REDACTED_TEXT} length=${value.length}`;
  }
  if (isPhoneFieldKey(normalizedKey)) {
    return maskPhoneForLog(value);
  }
  return value;
}

function redactPhoneNumbers(value: string): string {
  return value.replace(PHONE_PATTERN, (match) => maskPhoneForLog(match));
}

export function sanitizeLogText(
  value: string,
  maxLength = MAX_MESSAGE_LENGTH,
  keyPath?: string
): string {
  let sanitized = sanitizeByKey(value, keyPath);
  for (const [pattern, replacement] of REDACTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  sanitized = redactPhoneNumbers(sanitized);
  return truncate(sanitized, maxLength);
}

function sanitizeUnknown(value: unknown, keyPath?: string): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return sanitizeLogText(value, MAX_MESSAGE_LENGTH, keyPath);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(item, keyPath ? `${keyPath}[]` : undefined));
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeLogText(value.message),
      stack: value.stack ? sanitizeLogText(value.stack, MAX_STACK_LENGTH) : undefined,
    };
  }
  if (typeof value === 'object') {
    try {
      const record = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(record)) {
        const nextPath = keyPath ? `${keyPath}.${key}` : key;
        out[key] = sanitizeUnknown(item, nextPath);
      }
      return out;
    } catch {
      return sanitizeLogText(String(value));
    }
  }
  return sanitizeLogText(String(value));
}

function extractErrorType(error: unknown): string {
  if (error instanceof Error && error.name) {
    return truncate(error.name, 100);
  }
  return 'UnknownError';
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeLogText(error.message);
  }
  return sanitizeLogText(String(error));
}

export function sanitizeLogValue(value: unknown): unknown {
  return sanitizeUnknown(value);
}

export function logSanitizedConsoleError(
  prefix: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const sanitizedError = sanitizeUnknown(error);
  const sanitizedContext = context ? (sanitizeUnknown(context) as Record<string, unknown>) : undefined;
  if (sanitizedContext) {
    console.error(prefix, sanitizedContext, sanitizedError);
    return;
  }
  console.error(prefix, sanitizedError);
}

export async function logInternalError(params: {
  source: string;
  error: unknown;
  status?: number;
  clientId?: string | null;
  context?: Record<string, unknown>;
}): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    const db = getDb();
    const details = sanitizeUnknown({
      source: params.source,
      status: params.status ?? 500,
      stack: params.error instanceof Error ? params.error.stack : undefined,
      context: params.context ?? {},
      capturedAt: new Date().toISOString(),
    });

    await db.insert(errorLog).values({
      clientId: params.clientId ?? null,
      errorType: extractErrorType(params.error),
      errorMessage: extractErrorMessage(params.error),
      errorDetails: details as Record<string, unknown>,
    });
  } catch (logError) {
    const fallback = logError instanceof Error ? logError.message : String(logError);
    console.error('[InternalErrorLog] Failed to persist error log:', sanitizeLogText(fallback));
  }
}
