import { NextResponse } from 'next/server';
import { logInternalError, logSanitizedConsoleError } from '@/lib/services/internal-error-log';

/**
 * Safe error response utility.
 * Logs the full error server-side but returns a generic message to the client,
 * preventing internal implementation details from leaking.
 */
export function safeErrorResponse(
  logPrefix: string,
  error: unknown,
  fallbackMessage = 'Internal server error',
  status = 500,
  options?: {
    clientId?: string | null;
    context?: Record<string, unknown>;
  }
): NextResponse {
  void logInternalError({
    source: logPrefix,
    error,
    status,
    clientId: options?.clientId ?? null,
    context: options?.context,
  });

  logSanitizedConsoleError(`${logPrefix}:`, error, options?.context);
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
