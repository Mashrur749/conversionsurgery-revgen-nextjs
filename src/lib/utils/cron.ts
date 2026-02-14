import { NextRequest } from 'next/server';

/** Verifies the CRON_SECRET bearer token on incoming cron requests. */
export function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}
