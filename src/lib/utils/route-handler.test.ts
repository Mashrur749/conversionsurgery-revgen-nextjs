import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { adminRoute, adminClientRoute, portalRoute } from './route-handler';

// Mock permission modules
const mockRequireAgencyPermission = vi.fn();
const mockRequireAgencyClientPermission = vi.fn();
const mockRequirePortalPermission = vi.fn();

vi.mock('@/lib/permissions/require-agency-permission', () => ({
  requireAgencyPermission: (...args: unknown[]) => mockRequireAgencyPermission(...args),
  requireAgencyClientPermission: (...args: unknown[]) =>
    mockRequireAgencyClientPermission(...args),
}));

vi.mock('@/lib/permissions/require-portal-permission', () => ({
  requirePortalPermission: (...args: unknown[]) => mockRequirePortalPermission(...args),
}));

function makeRequest(method = 'GET', path = '/api/admin/test') {
  return new NextRequest(new URL(path, 'http://localhost:3000'), { method });
}

function makeContext(params: Record<string, string> = {}) {
  return { params: Promise.resolve(params) };
}

const fakeAgencySession = {
  personId: 'person-1',
  userId: 'user-1',
  membershipId: 'mem-1',
  permissions: new Set(['agency.clients.view']),
  clientScope: 'all' as const,
  assignedClientIds: null,
};

const fakePortalSession = {
  personId: 'person-2',
  clientId: 'client-1',
  membershipId: 'mem-2',
  permissions: new Set(['portal.dashboard']),
  isOwner: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// -------------------------------------------------------------------------
// adminRoute
// -------------------------------------------------------------------------

describe('adminRoute', () => {
  it('calls handler with session on successful auth', async () => {
    mockRequireAgencyPermission.mockResolvedValue(fakeAgencySession);

    const handler = vi.fn().mockResolvedValue(
      Response.json({ ok: true })
    );

    const route = adminRoute(
      { permission: 'agency.clients.view' as never },
      handler
    );

    const res = await route(makeRequest(), makeContext());
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].session).toBe(fakeAgencySession);
    expect(res.status).toBe(200);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAgencyPermission.mockRejectedValue(
      new Error('Unauthorized: not authenticated')
    );

    const handler = vi.fn();
    const route = adminRoute(
      { permission: 'agency.clients.view' as never },
      handler
    );

    const res = await route(makeRequest(), makeContext());
    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when insufficient permissions', async () => {
    mockRequireAgencyPermission.mockRejectedValue(
      new Error('Forbidden: insufficient permissions')
    );

    const handler = vi.fn();
    const route = adminRoute(
      { permission: 'agency.clients.view' as never },
      handler
    );

    const res = await route(makeRequest(), makeContext());
    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });

  it('returns 400 on ZodError from handler', async () => {
    mockRequireAgencyPermission.mockResolvedValue(fakeAgencySession);

    const handler = vi.fn().mockRejectedValue(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string',
        },
      ])
    );

    const route = adminRoute(
      { permission: 'agency.clients.view' as never },
      handler
    );

    const res = await route(makeRequest('POST', '/api/admin/test'), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid input');
    expect(body.details).toHaveLength(1);
  });

  it('returns 500 on generic error from handler', async () => {
    mockRequireAgencyPermission.mockResolvedValue(fakeAgencySession);

    const handler = vi.fn().mockRejectedValue(new Error('DB connection failed'));

    const route = adminRoute(
      { permission: 'agency.clients.view' as never },
      handler
    );

    const res = await route(makeRequest(), makeContext());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });

  it('passes params to handler', async () => {
    mockRequireAgencyPermission.mockResolvedValue(fakeAgencySession);

    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));

    const route = adminRoute<{ id: string }>(
      { permission: 'agency.clients.view' as never },
      handler
    );

    await route(makeRequest(), makeContext({ id: 'abc-123' }));
    expect(handler.mock.calls[0][0].params).toEqual({ id: 'abc-123' });
  });

  it('accepts array of permissions', async () => {
    mockRequireAgencyPermission.mockResolvedValue(fakeAgencySession);

    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));

    const route = adminRoute(
      { permission: ['agency.clients.view', 'agency.clients.edit'] as never },
      handler
    );

    await route(makeRequest(), makeContext());
    expect(mockRequireAgencyPermission).toHaveBeenCalledWith(
      'agency.clients.view',
      'agency.clients.edit'
    );
  });
});

// -------------------------------------------------------------------------
// adminClientRoute
// -------------------------------------------------------------------------

describe('adminClientRoute', () => {
  it('extracts clientId from params and checks client access', async () => {
    mockRequireAgencyClientPermission.mockResolvedValue(fakeAgencySession);

    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));

    const route = adminClientRoute<{ id: string }>(
      {
        permission: 'agency.clients.view' as never,
        clientIdFrom: (p) => p.id,
      },
      handler
    );

    await route(makeRequest(), makeContext({ id: 'client-99' }));
    expect(mockRequireAgencyClientPermission).toHaveBeenCalledWith(
      'client-99',
      'agency.clients.view'
    );
    expect(handler.mock.calls[0][0].clientId).toBe('client-99');
  });

  it('returns 403 when client not in scope', async () => {
    mockRequireAgencyClientPermission.mockRejectedValue(
      new Error('Forbidden: client not in scope')
    );

    const handler = vi.fn();
    const route = adminClientRoute<{ id: string }>(
      {
        permission: 'agency.clients.view' as never,
        clientIdFrom: (p) => p.id,
      },
      handler
    );

    const res = await route(makeRequest(), makeContext({ id: 'client-99' }));
    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });
});

// -------------------------------------------------------------------------
// portalRoute
// -------------------------------------------------------------------------

describe('portalRoute', () => {
  it('calls handler with portal session on success', async () => {
    mockRequirePortalPermission.mockResolvedValue(fakePortalSession);

    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));

    const route = portalRoute(
      { permission: 'portal.dashboard' as never },
      handler
    );

    const res = await route(
      makeRequest('GET', '/api/client/dashboard'),
      makeContext()
    );
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].session).toBe(fakePortalSession);
    expect(res.status).toBe(200);
  });

  it('returns 403 on portal auth failure', async () => {
    mockRequirePortalPermission.mockRejectedValue(
      new Error('Forbidden: insufficient permissions')
    );

    const handler = vi.fn();
    const route = portalRoute(
      { permission: 'portal.dashboard' as never },
      handler
    );

    const res = await route(
      makeRequest('GET', '/api/client/dashboard'),
      makeContext()
    );
    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });
});
