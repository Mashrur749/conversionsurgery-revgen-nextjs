import { NextResponse } from 'next/server';
import { and, eq, gte, lte } from 'drizzle-orm';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { addonBillingEvents } from '@/db/schema';
import {
  type AddonPricingKey,
} from '@/lib/services/addon-pricing';
import {
  formatAddonCurrency,
  formatAddonLineItemDescription,
  formatAddonUnit,
} from '@/lib/services/addon-billing-format';

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_VIEW },
  async ({ session, request }) => {
    const start = parseDateParam(request.nextUrl.searchParams.get('periodStart'));
    const end = parseDateParam(request.nextUrl.searchParams.get('periodEnd'));

    if (!start || !end) {
      return NextResponse.json(
        { error: 'periodStart and periodEnd query params are required (ISO date)' },
        { status: 400 }
      );
    }

    const db = getDb();
    const events = await db
      .select()
      .from(addonBillingEvents)
      .where(and(
        eq(addonBillingEvents.clientId, session.clientId),
        gte(addonBillingEvents.periodStart, start),
        lte(addonBillingEvents.periodEnd, end)
      ))
      .orderBy(addonBillingEvents.periodStart, addonBillingEvents.createdAt);

    const rows = [
      [
        'event_id',
        'addon_type',
        'description',
        'source_type',
        'source_ref',
        'period_start',
        'period_end',
        'quantity',
        'unit',
        'unit_price_cents',
        'unit_price_display',
        'total_cents',
        'total_display',
        'status',
        'invoice_id',
        'invoice_line_item_ref',
        'dispute_status',
        'dispute_note',
        'idempotency_key',
        'created_at',
      ].join(','),
      ...events.map((event) => {
        const addonType = event.addonType as AddonPricingKey;
        const description = formatAddonLineItemDescription(addonType, event.quantity);
        const unit = formatAddonUnit(addonType, event.quantity);
        return [
          event.id,
          event.addonType,
          `"${description.replace(/"/g, '""')}"`,
          event.sourceType,
          event.sourceRef ? `"${event.sourceRef.replace(/"/g, '""')}"` : '',
          event.periodStart.toISOString(),
          event.periodEnd.toISOString(),
          String(event.quantity),
          unit,
          String(event.unitPriceCents),
          formatAddonCurrency(event.unitPriceCents),
          String(event.totalCents),
          formatAddonCurrency(event.totalCents),
          event.status,
          event.invoiceId || '',
          event.invoiceLineItemRef || '',
          event.disputeStatus || 'none',
          event.disputeNote ? `"${event.disputeNote.replace(/"/g, '""')}"` : '',
          event.idempotencyKey,
          event.createdAt.toISOString(),
        ].join(',');
      }),
    ];

    const fileName = `addon-events-${start.toISOString().slice(0, 10)}-to-${end.toISOString().slice(0, 10)}.csv`;

    return new NextResponse(rows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=\"${fileName}\"`,
      },
    });
  }
);
