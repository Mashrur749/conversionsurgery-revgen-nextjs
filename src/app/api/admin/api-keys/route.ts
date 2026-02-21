import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { createApiKey, listApiKeys } from '@/lib/services/api-key-management';
import { z } from 'zod';

export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT },
  async ({ request }) => {
    const clientId = request.nextUrl.searchParams.get('clientId');
    if (!clientId) {
      return NextResponse.json({ error: 'clientId required' }, { status: 400 });
    }

    const keys = await listApiKeys(clientId);
    return NextResponse.json(keys);
  }
);

const createSchema = z.object({
  clientId: z.string().uuid(),
  label: z.string().min(1).max(100),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
}).strict();

export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT },
  async ({ request }) => {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { clientId, label, scopes, expiresAt } = parsed.data;
    const result = await createApiKey(
      clientId,
      label,
      scopes || [],
      expiresAt ? new Date(expiresAt) : undefined
    );

    return NextResponse.json(result, { status: 201 });
  }
);
