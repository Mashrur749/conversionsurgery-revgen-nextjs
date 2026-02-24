import { randomBytes } from 'node:crypto';
import { getDb } from '@/db';
import { clients, dataExportRequests } from '@/db/schema';
import { and, asc, desc, eq, inArray, lt } from 'drizzle-orm';
import {
  addBusinessDays,
  EXPORT_DOWNLOAD_TOKEN_TTL_DAYS,
  EXPORT_SLA_BUSINESS_DAYS,
} from '@/lib/services/cancellation-policy';
import { buildClientDataExportBundle } from '@/lib/services/data-export-bundle';
import type { DataExportRequest } from '@/db/schema/data-export-requests';

export const DATA_EXPORT_REQUEST_STATUSES = {
  REQUESTED: 'requested',
  PROCESSING: 'processing',
  READY: 'ready',
  DELIVERED: 'delivered',
  FAILED: 'failed',
} as const;

export type DataExportRequestStatus =
  (typeof DATA_EXPORT_REQUEST_STATUSES)[keyof typeof DATA_EXPORT_REQUEST_STATUSES];

export type DataExportSlaState = 'on_track' | 'at_risk' | 'breached' | 'closed';

interface RequestDataExportInput {
  clientId: string;
  cancellationRequestId?: string;
  requestedBy?: string;
}

function generateDownloadToken(): string {
  return randomBytes(24).toString('hex');
}

function calculateTokenExpiry(now: Date): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + EXPORT_DOWNLOAD_TOKEN_TTL_DAYS);
  return expiresAt;
}

function isOpenStatus(status: string): boolean {
  return status === DATA_EXPORT_REQUEST_STATUSES.REQUESTED
    || status === DATA_EXPORT_REQUEST_STATUSES.PROCESSING
    || status === DATA_EXPORT_REQUEST_STATUSES.READY;
}

export function resolveDataExportSlaState(
  request: {
    status: string;
    dueAt: Date;
  },
  now: Date = new Date()
): DataExportSlaState {
  if (request.status === DATA_EXPORT_REQUEST_STATUSES.FAILED) {
    return 'breached';
  }

  if (!isOpenStatus(request.status)) {
    return 'closed';
  }

  if (request.dueAt.getTime() < now.getTime()) {
    return 'breached';
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const remainingDays = (request.dueAt.getTime() - now.getTime()) / dayMs;

  if (remainingDays <= 1) {
    return 'at_risk';
  }

  return 'on_track';
}

export function buildExportDownloadPath(requestId: string, token: string): string {
  return `/api/client/exports/${requestId}/download?token=${encodeURIComponent(token)}`;
}

export async function createDataExportRequest(
  input: RequestDataExportInput
): Promise<DataExportRequest> {
  const db = getDb();
  const now = new Date();
  const dueAt = addBusinessDays(now, EXPORT_SLA_BUSINESS_DAYS);

  const [request] = await db
    .insert(dataExportRequests)
    .values({
      clientId: input.clientId,
      cancellationRequestId: input.cancellationRequestId,
      requestedBy: input.requestedBy || 'client_portal',
      status: DATA_EXPORT_REQUEST_STATUSES.REQUESTED,
      requestedAt: now,
      dueAt,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return request;
}

export async function processDataExportRequest(requestId: string): Promise<DataExportRequest> {
  const db = getDb();
  const now = new Date();

  const [request] = await db
    .select()
    .from(dataExportRequests)
    .where(eq(dataExportRequests.id, requestId))
    .limit(1);

  if (!request) {
    throw new Error('Data export request not found');
  }

  if (!isOpenStatus(request.status)) {
    return request;
  }

  await db
    .update(dataExportRequests)
    .set({
      status: DATA_EXPORT_REQUEST_STATUSES.PROCESSING,
      startedAt: now,
      updatedAt: now,
      failureReason: null,
      failedAt: null,
    })
    .where(eq(dataExportRequests.id, requestId));

  try {
    const bundle = await buildClientDataExportBundle(request.clientId);
    const readyAt = new Date();
    const downloadToken = generateDownloadToken();
    const downloadTokenExpiresAt = calculateTokenExpiry(readyAt);

    const [ready] = await db
      .update(dataExportRequests)
      .set({
        status: DATA_EXPORT_REQUEST_STATUSES.READY,
        readyAt,
        artifactSummary: bundle.summary,
        downloadToken,
        downloadTokenExpiresAt,
        updatedAt: readyAt,
      })
      .where(eq(dataExportRequests.id, requestId))
      .returning();

    return ready;
  } catch (error) {
    const failedAt = new Date();
    const failureReason = error instanceof Error ? error.message : 'Unknown export failure';

    const [failed] = await db
      .update(dataExportRequests)
      .set({
        status: DATA_EXPORT_REQUEST_STATUSES.FAILED,
        failedAt,
        failureReason,
        updatedAt: failedAt,
      })
      .where(eq(dataExportRequests.id, requestId))
      .returning();

    return failed;
  }
}

export async function requestAndProcessDataExport(
  input: RequestDataExportInput
): Promise<DataExportRequest> {
  const request = await createDataExportRequest(input);
  return processDataExportRequest(request.id);
}

export async function getLatestDataExportRequest(clientId: string): Promise<DataExportRequest | null> {
  const db = getDb();

  const [request] = await db
    .select()
    .from(dataExportRequests)
    .where(eq(dataExportRequests.clientId, clientId))
    .orderBy(desc(dataExportRequests.createdAt))
    .limit(1);

  return request || null;
}

export async function listClientDataExportRequests(clientId: string): Promise<DataExportRequest[]> {
  const db = getDb();

  return db
    .select()
    .from(dataExportRequests)
    .where(eq(dataExportRequests.clientId, clientId))
    .orderBy(desc(dataExportRequests.createdAt));
}

export async function listPendingDataExportRequests(limit: number = 50) {
  const db = getDb();

  const rows = await db
    .select({
      id: dataExportRequests.id,
      clientId: dataExportRequests.clientId,
      businessName: clients.businessName,
      status: dataExportRequests.status,
      requestedAt: dataExportRequests.requestedAt,
      dueAt: dataExportRequests.dueAt,
      readyAt: dataExportRequests.readyAt,
      deliveredAt: dataExportRequests.deliveredAt,
      failedAt: dataExportRequests.failedAt,
      failureReason: dataExportRequests.failureReason,
      artifactSummary: dataExportRequests.artifactSummary,
    })
    .from(dataExportRequests)
    .innerJoin(clients, eq(dataExportRequests.clientId, clients.id))
    .where(inArray(dataExportRequests.status, [
      DATA_EXPORT_REQUEST_STATUSES.REQUESTED,
      DATA_EXPORT_REQUEST_STATUSES.PROCESSING,
      DATA_EXPORT_REQUEST_STATUSES.READY,
      DATA_EXPORT_REQUEST_STATUSES.FAILED,
    ]))
    .orderBy(asc(dataExportRequests.dueAt))
    .limit(limit);

  const now = new Date();
  return rows.map((row) => ({
    ...row,
    slaState: resolveDataExportSlaState({ status: row.status, dueAt: row.dueAt }, now),
  }));
}

export async function getDownloadableDataExportRequest(params: {
  requestId: string;
  clientId: string;
  token: string;
}): Promise<DataExportRequest | null> {
  const db = getDb();

  const [request] = await db
    .select()
    .from(dataExportRequests)
    .where(and(
      eq(dataExportRequests.id, params.requestId),
      eq(dataExportRequests.clientId, params.clientId),
      eq(dataExportRequests.downloadToken, params.token),
      inArray(dataExportRequests.status, [
        DATA_EXPORT_REQUEST_STATUSES.READY,
        DATA_EXPORT_REQUEST_STATUSES.DELIVERED,
      ])
    ))
    .limit(1);

  if (!request) {
    return null;
  }

  if (!request.downloadTokenExpiresAt || request.downloadTokenExpiresAt.getTime() < Date.now()) {
    return null;
  }

  return request;
}

export async function markDataExportDelivered(requestId: string): Promise<void> {
  const db = getDb();

  await db
    .update(dataExportRequests)
    .set({
      status: DATA_EXPORT_REQUEST_STATUSES.DELIVERED,
      deliveredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(dataExportRequests.id, requestId));
}

export async function listOverdueDataExportRequests(now: Date = new Date()) {
  const db = getDb();

  return db
    .select()
    .from(dataExportRequests)
    .where(and(
      inArray(dataExportRequests.status, [
        DATA_EXPORT_REQUEST_STATUSES.REQUESTED,
        DATA_EXPORT_REQUEST_STATUSES.PROCESSING,
        DATA_EXPORT_REQUEST_STATUSES.READY,
      ]),
      lt(dataExportRequests.dueAt, now)
    ))
    .orderBy(asc(dataExportRequests.dueAt));
}
