import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { handleFormSubmission } from '@/lib/automations/form-response';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { normalizePhoneNumber } from '@/lib/utils/phone';

// ---------------------------------------------------------------------------
// Rate limiting (in-memory, per-IP, sliding window)
// Resets on cold start — acceptable for serverless.
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  timestamps: number[];
}

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

const ipRateLimitMap = new Map<string, RateLimitEntry>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  let entry = ipRateLimitMap.get(ip);

  if (!entry) {
    entry = { timestamps: [] };
    ipRateLimitMap.set(ip, entry);
  }

  // Slide window: remove timestamps older than the window
  entry.timestamps = entry.timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );

  if (entry.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  entry.timestamps.push(now);
  return false;
}

// Periodic cleanup to prevent memory leak (every 5 minutes, remove stale IPs)
let lastCleanup = Date.now();
function cleanupRateLimitMap() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return; // 5 minutes
  lastCleanup = now;
  for (const [ip, entry] of ipRateLimitMap) {
    entry.timestamps = entry.timestamps.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );
    if (entry.timestamps.length === 0) {
      ipRateLimitMap.delete(ip);
    }
  }
}

// ---------------------------------------------------------------------------
// Deduplication (in-memory, phone+clientId, 60-second window)
// ---------------------------------------------------------------------------

const DEDUP_WINDOW_MS = 60_000;
const recentSubmissions = new Map<string, number>();

function isDuplicate(phone: string, clientId: string): boolean {
  const key = `${phone}:${clientId}`;
  const now = Date.now();
  const lastSubmission = recentSubmissions.get(key);

  if (lastSubmission && now - lastSubmission < DEDUP_WINDOW_MS) {
    return true;
  }

  recentSubmissions.set(key, now);
  return false;
}

// Periodic cleanup for dedup map
let lastDedupCleanup = Date.now();
function cleanupDedupMap() {
  const now = Date.now();
  if (now - lastDedupCleanup < 300_000) return;
  lastDedupCleanup = now;
  for (const [key, ts] of recentSubmissions) {
    if (now - ts >= DEDUP_WINDOW_MS) {
      recentSubmissions.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Input sanitization
// ---------------------------------------------------------------------------

/** Strip HTML tags from a string. */
function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

const publicLeadSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(200),
  phone: z.string().min(10).max(20),
  email: z.string().email().optional(),
  message: z.string().max(2000).optional(),
  projectType: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  source: z.literal('widget').default('widget'),
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * OPTIONS /api/public/leads
 * CORS preflight handler.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/public/leads
 * Public lead intake endpoint for embeddable widget.
 * No auth token required — uses clientId for scoping.
 *
 * Protections:
 * - IP-based rate limiting (10 req/min)
 * - Phone+clientId deduplication (60s window)
 * - HTML tag stripping on name/message fields
 */
export async function POST(request: NextRequest) {
  // Run periodic cleanups
  cleanupRateLimitMap();
  cleanupDedupMap();

  // Rate limit by IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const parsed = publicLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const data = parsed.data;

  // Sanitize text fields — strip HTML tags
  const sanitizedName = stripHtmlTags(data.name);
  const sanitizedMessage = data.message ? stripHtmlTags(data.message) : undefined;

  // Deduplication: same phone + clientId within 60s returns success (idempotent)
  const normalizedPhone = normalizePhoneNumber(data.phone);
  if (isDuplicate(normalizedPhone, data.clientId)) {
    return NextResponse.json(
      { success: true },
      { status: 200, headers: CORS_HEADERS }
    );
  }

  try {
    // Validate clientId exists and is active
    const db = getDb();
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, data.clientId), eq(clients.status, 'active')))
      .limit(1);

    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Unable to process submission. Please try again later.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const result = await handleFormSubmission({
      clientId: data.clientId,
      name: sanitizedName,
      phone: data.phone,
      email: data.email,
      message: sanitizedMessage,
      projectType: data.projectType,
      address: data.address,
    });

    if (!result.processed) {
      logSanitizedConsoleError(
        '[PublicLeads] Form submission not processed',
        new Error(result.reason ?? 'Unknown reason'),
        { clientId: data.clientId }
      );
      return NextResponse.json(
        { success: false, error: 'Unable to process submission. Please try again later.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    logSanitizedConsoleError('[PublicLeads][leads.post]', error);
    return NextResponse.json(
      { success: false, error: 'Processing failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
