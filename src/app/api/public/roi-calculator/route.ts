import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { roiCalculatorLeads } from '@/db/schema';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

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
// Deduplication (in-memory, email-based, 60-second window)
// ---------------------------------------------------------------------------

const DEDUP_WINDOW_MS = 60_000;
const recentSubmissions = new Map<string, number>();

function isDuplicate(email: string): boolean {
  const key = email.toLowerCase();
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
// Validation schema
// ---------------------------------------------------------------------------

const roiCalculatorSchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    businessName: z.string().min(1).max(200),
    phone: z.string().max(20).optional(),
    trade: z.string().max(100).optional(),
    monthlyEstimates: z.number().int().min(1).max(500),
    avgProjectValue: z.number().min(100).max(1_000_000),
    currentCloseRate: z.number().min(0).max(100),
    responseTime: z.enum(['under_5min', '5_30min', '30min_2hr', '2hr_24hr', 'over_24hr']),
    afterHoursPercent: z.number().min(0).max(100).optional(),
    followUpConsistency: z.enum(['always', 'sometimes', 'rarely', 'never']).optional(),
    followUpTouches: z.number().int().min(0).max(20).optional(),
    hoursPerWeek: z.number().min(0).max(100).optional(),
    hourlyValue: z.number().min(0).max(1000).optional(),
    utmSource: z.string().max(255).optional(),
    utmMedium: z.string().max(255).optional(),
    utmCampaign: z.string().max(255).optional(),
    referrer: z.string().max(2000).optional(),
  })
  .strict();

type RoiCalculatorInput = z.infer<typeof roiCalculatorSchema>;

// ---------------------------------------------------------------------------
// Calculation logic
// ---------------------------------------------------------------------------

const RESPONSE_TIME_PENALTY: Record<string, number> = {
  under_5min: 0.05,
  '5_30min': 0.15,
  '30min_2hr': 0.30,
  '2hr_24hr': 0.50,
  over_24hr: 0.70,
};

const FOLLOW_UP_RECOVERY_RATE: Record<string, number> = {
  always: 0.10,
  sometimes: 0.20,
  rarely: 0.35,
  never: 0.45,
};

interface RoiResults {
  lostRevenueAnnual: number;
  potentialRecoveryAnnual: number;
  projectedRoi: number;
  monthlyServiceCost: number;
  annualServiceCost: number;
}

function calculateRoi(input: RoiCalculatorInput): RoiResults {
  const responseTimePenalty = RESPONSE_TIME_PENALTY[input.responseTime];
  const followUpRecoveryRate =
    FOLLOW_UP_RECOVERY_RATE[input.followUpConsistency ?? 'sometimes'];

  const lostRevenueAnnual =
    input.monthlyEstimates *
    input.avgProjectValue *
    (1 - input.currentCloseRate / 100) *
    12 *
    responseTimePenalty;

  const potentialRecoveryAnnual = lostRevenueAnnual * followUpRecoveryRate;
  const annualServiceCost = 1000 * 12;
  const projectedRoi = potentialRecoveryAnnual / annualServiceCost;

  return {
    lostRevenueAnnual: Math.round(lostRevenueAnnual * 100) / 100,
    potentialRecoveryAnnual: Math.round(potentialRecoveryAnnual * 100) / 100,
    projectedRoi: Math.round(projectedRoi * 100) / 100,
    monthlyServiceCost: 1000,
    annualServiceCost,
  };
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * OPTIONS /api/public/roi-calculator
 * CORS preflight handler.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/public/roi-calculator
 * Public pre-sale ROI calculator endpoint.
 * No auth required — captures prospect data and returns ROI projections.
 *
 * Protections:
 * - IP-based rate limiting (10 req/min)
 * - Email deduplication (60s window)
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

  const parsed = roiCalculatorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const input = parsed.data;

  // Deduplication: same email within 60s returns cached result (idempotent)
  if (isDuplicate(input.email)) {
    const results = calculateRoi(input);
    return NextResponse.json(
      { success: true, results },
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // Calculate ROI results
  const results = calculateRoi(input);

  const userAgent = request.headers.get('user-agent') ?? undefined;

  try {
    const db = getDb();
    await db.insert(roiCalculatorLeads).values({
      email: input.email,
      name: input.name,
      businessName: input.businessName,
      phone: input.phone ?? null,
      trade: input.trade ?? null,
      monthlyEstimates: input.monthlyEstimates,
      avgProjectValue: String(input.avgProjectValue),
      currentCloseRate: String(input.currentCloseRate),
      responseTime: input.responseTime,
      afterHoursPercent:
        input.afterHoursPercent != null ? String(input.afterHoursPercent) : null,
      followUpConsistency: input.followUpConsistency ?? null,
      followUpTouches: input.followUpTouches ?? null,
      hoursPerWeek:
        input.hoursPerWeek != null ? String(input.hoursPerWeek) : null,
      hourlyValue:
        input.hourlyValue != null ? String(input.hourlyValue) : null,
      lostRevenueAnnual: String(results.lostRevenueAnnual),
      potentialRevenueAnnual: String(results.potentialRecoveryAnnual),
      projectedRoi: String(results.projectedRoi),
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      referrer: input.referrer ?? null,
      ipAddress: ip !== 'unknown' ? ip : null,
      userAgent: userAgent ?? null,
    });

    return NextResponse.json(
      { success: true, results },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    logSanitizedConsoleError('[RoiCalculator][roi-calculator.post]', error);
    return NextResponse.json(
      { success: false, error: 'Processing failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
