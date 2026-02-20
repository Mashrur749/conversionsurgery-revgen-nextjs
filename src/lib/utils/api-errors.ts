import { NextResponse } from 'next/server';

/**
 * Safe error response utility.
 * Logs the full error server-side but returns a generic message to the client,
 * preventing internal implementation details from leaking.
 */
export function safeErrorResponse(
  logPrefix: string,
  error: unknown,
  fallbackMessage = 'Internal server error',
  status = 500
): NextResponse {
  console.error(`${logPrefix}:`, error);
  return NextResponse.json({ error: fallbackMessage }, { status });
}

/**
 * Permission/auth error response for catch blocks around requireAgencyPermission()
 * and requirePortalPermission(). Replaces the repeated pattern:
 *
 *   const msg = error instanceof Error ? error.message : '';
 *   return NextResponse.json(
 *     { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
 *     { status: msg.includes('Unauthorized') ? 401 : 403 }
 *   );
 *
 * With a single call:
 *   return permissionErrorResponse(error);
 */
export function permissionErrorResponse(error: unknown): NextResponse {
  const msg = error instanceof Error ? error.message : '';
  if (msg.includes('Unauthorized')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
