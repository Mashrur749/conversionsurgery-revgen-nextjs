import { z } from 'zod';

/**
 * Startup environment variable validation.
 *
 * This module validates that all required environment variables are set
 * when the application starts. If any are missing, it crashes immediately
 * with a clear error message listing all missing variables.
 *
 * Import this module early in the application lifecycle (e.g., layout.tsx
 * or instrumentation.ts) to fail fast instead of discovering missing
 * env vars at runtime when a user hits a specific code path.
 */

const requiredEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'Postgres connection string required'),

  // Auth
  AUTH_SECRET: z.string().min(1, 'NextAuth secret required'),
  CLIENT_SESSION_SECRET: z.string().min(1, 'Client portal session secret required'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1, 'Stripe secret key required'),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key required'),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().min(1, 'Twilio account SID required'),
  TWILIO_AUTH_TOKEN: z.string().min(1, 'Twilio auth token required'),

  // Cron
  CRON_SECRET: z.string().min(1, 'Cron secret required'),
});

const optionalEnvSchema = z.object({
  // Email (graceful degradation if missing)
  RESEND_API_KEY: z.string().optional(),

  // Stripe webhooks (empty string fallback is a security risk — S3)
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // R2 Storage (only needed for media features)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // Google (only needed for Google integrations)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),

  // Twilio extras
  TWILIO_PHONE_NUMBER: z.string().optional(),
  TWILIO_WEBHOOK_BASE_URL: z.string().optional(),

  // Voice
  ELEVENLABS_API_KEY: z.string().optional(),

  // URLs
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),

  // Notifications
  SLACK_WEBHOOK_URL: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PHONE_NUMBER: z.string().optional(),

  // Webhooks
  FORM_WEBHOOK_SECRET: z.string().optional(),

  // Email from address
  EMAIL_FROM: z.string().optional(),
});

export type RequiredEnv = z.infer<typeof requiredEnvSchema>;
export type OptionalEnv = z.infer<typeof optionalEnvSchema>;

/**
 * Validates required environment variables. Call at startup.
 * Throws with a clear, formatted error listing all missing variables.
 */
export function validateEnv(): void {
  const result = requiredEnvSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`
    );

    const message = [
      '',
      '=== MISSING REQUIRED ENVIRONMENT VARIABLES ===',
      '',
      ...missing,
      '',
      'Set these in your .env file or deployment environment.',
      'The application cannot start without them.',
      '===============================================',
      '',
    ].join('\n');

    console.error(message);
    throw new Error(`Missing required environment variables:\n${missing.join('\n')}`);
  }

  // Warn about optional but recommended variables
  const warnings: string[] = [];

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    warnings.push('STRIPE_WEBHOOK_SECRET is not set — Stripe webhook signature verification will be skipped');
  }
  if (!process.env.RESEND_API_KEY) {
    warnings.push('RESEND_API_KEY is not set — email sending will fail');
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    warnings.push('NEXT_PUBLIC_APP_URL is not set — defaulting to http://localhost:3000');
  }

  if (warnings.length > 0) {
    console.warn(
      '\n[env] Warnings:\n' +
      warnings.map((w) => `  - ${w}`).join('\n') +
      '\n'
    );
  }
}

// Validate on module import in production
if (process.env.NODE_ENV === 'production') {
  validateEnv();
}
