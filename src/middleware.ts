import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware — runs before every API route.
 *
 * 1. Auth guards: fast cookie-existence checks (no validation — handlers do that)
 * 2. Rate limiting: in-memory per-IP, per-isolate (not globally shared)
 * 3. Security headers: nosniff, frame-deny, XSS, referrer, permissions-policy
 */

// ---------------------------------------------------------------------------
// Rate limiting (in-memory, per-isolate)
// ---------------------------------------------------------------------------
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function getRateLimitKey(ip: string, bucket: string): string {
  return `${ip}:${bucket}`;
}

function isRateLimited(ip: string, bucket: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();

  // Periodic cleanup to prevent memory leaks
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now;
    for (const [key, entry] of rateLimitMap) {
      if (entry.resetAt <= now) {
        rateLimitMap.delete(key);
      }
    }
  }

  const key = getRateLimitKey(ip, bucket);
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count++;
  return entry.count > maxRequests;
}

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// ---------------------------------------------------------------------------
// Sensitive endpoints that get stricter rate limits
// ---------------------------------------------------------------------------
const SENSITIVE_PREFIXES = [
  '/api/admin/responses/',      // AI generation
  '/api/admin/agency/send',     // email send
  '/api/client/auth/',          // OTP
  '/api/admin/voice/preview',   // TTS generation
];

function isSensitive(pathname: string): boolean {
  return SENSITIVE_PREFIXES.some((p) => pathname.startsWith(p));
}

// ---------------------------------------------------------------------------
// Open routes — no auth required
// ---------------------------------------------------------------------------
function isOpenRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/client/auth/') ||
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/api/compliance/')
  );
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ---- Auth guards (cookie existence — never validates) ----
  if (!isOpenRoute(pathname)) {
    if (pathname.startsWith('/api/admin/') || pathname.startsWith('/api/clients/')) {
      // Admin routes: require NextAuth session cookie
      const hasSession =
        request.cookies.has('next-auth.session-token') ||
        request.cookies.has('__Secure-next-auth.session-token');
      if (!hasSession) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (pathname.startsWith('/api/client/')) {
      // Client portal routes: require clientSessionId cookie
      if (!request.cookies.has('clientSessionId')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (pathname.startsWith('/api/cron/')) {
      // Cron routes: require Authorization bearer header
      const authHeader = request.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
  }

  // ---- Rate limiting ----
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';

  if (isSensitive(pathname)) {
    // 30 requests per minute for sensitive endpoints
    if (isRateLimited(ip, 'sensitive', 30, 60_000)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }
  } else if (pathname.startsWith('/api/admin/') || pathname.startsWith('/api/clients/')) {
    // 120 requests per minute for general admin routes
    if (isRateLimited(ip, 'admin', 120, 60_000)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }
  }

  // ---- Security headers ----
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
