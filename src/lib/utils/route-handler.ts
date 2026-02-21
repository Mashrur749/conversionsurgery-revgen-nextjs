/**
 * Route handler wrappers that eliminate auth/error boilerplate.
 *
 * Usage:
 *   export const GET = adminRoute(
 *     { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW },
 *     async ({ session }) => {
 *       const db = getDb();
 *       return NextResponse.json({ data });
 *     }
 *   );
 */
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  requireAgencyPermission,
  requireAgencyClientPermission,
  type AgencySession,
} from '@/lib/permissions/require-agency-permission';
import {
  requirePortalPermission,
  type PortalSession,
} from '@/lib/permissions/require-portal-permission';
import type { AgencyPermission, PortalPermission } from '@/lib/permissions/constants';
import { permissionErrorResponse, safeErrorResponse } from '@/lib/utils/api-errors';

// Re-export for single-import convenience
export { AGENCY_PERMISSIONS, PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
export type { AgencySession } from '@/lib/permissions/require-agency-permission';
export type { PortalSession } from '@/lib/permissions/require-portal-permission';

// ---------------------------------------------------------------------------
// Context types passed to route handlers
// ---------------------------------------------------------------------------

export interface AdminContext<P = Record<string, never>> {
  request: NextRequest;
  session: AgencySession;
  params: P;
}

export interface AdminClientContext<P = Record<string, never>> {
  request: NextRequest;
  session: AgencySession;
  params: P;
  clientId: string;
}

export interface PortalContext<P = Record<string, never>> {
  request: NextRequest;
  session: PortalSession;
  params: P;
}

// ---------------------------------------------------------------------------
// Helper: detect permission errors vs generic errors
// ---------------------------------------------------------------------------

function isPermissionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return msg.includes('Unauthorized') || msg.includes('Forbidden');
}

function handleError(request: NextRequest, error: unknown): NextResponse {
  if (isPermissionError(error)) {
    return permissionErrorResponse(error);
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Invalid input', details: error.issues },
      { status: 400 }
    );
  }
  const prefix = `${request.method} ${request.nextUrl.pathname}`;
  return safeErrorResponse(prefix, error);
}

// ---------------------------------------------------------------------------
// adminRoute — for /api/admin/* routes (no client scoping)
// ---------------------------------------------------------------------------

interface AdminRouteOptions {
  permission: AgencyPermission | AgencyPermission[];
}

type NextRouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<Response>;

/**
 * Wrap an admin API route handler.
 * Handles auth, permission checks, Zod validation errors, and generic errors.
 */
export function adminRoute<P = Record<string, never>>(
  options: AdminRouteOptions,
  handler: (ctx: AdminContext<P>) => Promise<Response>
): NextRouteHandler {
  const perms = Array.isArray(options.permission)
    ? options.permission
    : [options.permission];

  return async (request: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    try {
      const session = await requireAgencyPermission(...perms);
      const params = (await context.params) as P;
      return await handler({ request, session, params });
    } catch (error) {
      return handleError(request, error);
    }
  };
}

// ---------------------------------------------------------------------------
// adminClientRoute — for /api/admin/clients/[id]/* routes
// ---------------------------------------------------------------------------

interface AdminClientRouteOptions<P> {
  permission: AgencyPermission | AgencyPermission[];
  clientIdFrom: (params: P) => string;
}

/**
 * Wrap a client-scoped admin API route handler.
 * Validates both agency permission AND client access scope.
 */
export function adminClientRoute<P = Record<string, never>>(
  options: AdminClientRouteOptions<P>,
  handler: (ctx: AdminClientContext<P>) => Promise<Response>
): NextRouteHandler {
  const perms = Array.isArray(options.permission)
    ? options.permission
    : [options.permission];

  return async (request: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    try {
      const params = (await context.params) as P;
      const clientId = options.clientIdFrom(params);
      const session = await requireAgencyClientPermission(clientId, ...perms);
      return await handler({ request, session, params, clientId });
    } catch (error) {
      return handleError(request, error);
    }
  };
}

// ---------------------------------------------------------------------------
// portalRoute — for /api/client/* routes
// ---------------------------------------------------------------------------

interface PortalRouteOptions {
  permission: PortalPermission | PortalPermission[];
}

/**
 * Wrap a client portal API route handler.
 * Handles portal auth, permission checks, and error handling.
 */
export function portalRoute<P = Record<string, never>>(
  options: PortalRouteOptions,
  handler: (ctx: PortalContext<P>) => Promise<Response>
): NextRouteHandler {
  const perms = Array.isArray(options.permission)
    ? options.permission
    : [options.permission];

  return async (request: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    try {
      const session = await requirePortalPermission(...perms);
      const params = (await context.params) as P;
      return await handler({ request, session, params });
    } catch (error) {
      return handleError(request, error);
    }
  };
}
