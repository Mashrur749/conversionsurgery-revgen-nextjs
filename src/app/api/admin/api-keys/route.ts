import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { createApiKey, listApiKeys } from '@/lib/services/api-key-management';
import { z } from 'zod';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

export async function GET(request: NextRequest) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.CLIENTS_EDIT);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const clientId = request.nextUrl.searchParams.get('clientId');
  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  }

  const keys = await listApiKeys(clientId);
  return NextResponse.json(keys);
}

const createSchema = z.object({
  clientId: z.string().uuid(),
  label: z.string().min(1).max(100),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.CLIENTS_EDIT);
  } catch (error) {
    return permissionErrorResponse(error);
  }

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
