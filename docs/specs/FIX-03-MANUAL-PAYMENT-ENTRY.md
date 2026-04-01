# FIX-03: Manual Payment Entry (Cash/E-Transfer/Check)

Status: Ready
Priority: HIGH — embarrassing reminder problem
Estimated files: 2-3

---

## Problem

When a contractor receives payment via cash, e-transfer, or check, there's no admin-side way to record it. The system keeps sending "your payment is overdue" reminders, making the contractor look incompetent. The existing `markInvoicePaid()` function works but is only accessible from the client portal — no admin endpoint exists.

Additionally, `markInvoicePaid()` doesn't record the payment method, so there's no audit trail of how payment was received.

## Solution

1. Create an admin endpoint to mark invoices as paid with payment method
2. Add a `paymentMethod` field to the mark-paid flow
3. Ensure reminders are cancelled (already handled by `markInvoicePaid()`)

## Implementation

### Step 1: Create admin mark-paid endpoint

**New file:** `src/app/api/admin/clients/[id]/invoices/[invoiceId]/mark-paid/route.ts`

```typescript
/**
 * POST /api/admin/clients/[id]/invoices/[invoiceId]/mark-paid
 * Admin marks an invoice as paid (for cash, e-transfer, check, etc.)
 */
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';

const markPaidSchema = z.object({
  paymentMethod: z.enum(['cash', 'etransfer', 'check', 'wire', 'stripe', 'other']),
  notes: z.string().max(500).optional(),
  paidAt: z.string().datetime().optional(), // ISO date — defaults to now
});

export const POST = adminClientRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ params, clientId }) => {
    const { invoiceId } = await params;
    // ... validate invoice belongs to client
    // ... call markInvoicePaid(invoiceId)
    // ... record payment method in audit log
  }
);
```

### Step 2: Update `markInvoicePaid()` to accept optional metadata

**File:** `src/lib/automations/payment-reminder.ts`

Add an optional parameter for payment metadata:

```typescript
export async function markInvoicePaid(
  invoiceId: string,
  metadata?: { paymentMethod?: string; notes?: string; paidAt?: Date; recordedBy?: string }
) {
  // ... existing logic (lines 178-221)
  // After marking invoice paid, also update paidAmount = totalAmount
  // Record in audit log if metadata provided
}
```

**Changes to existing function (lines 183-186):**

```typescript
await db
  .update(invoices)
  .set({
    status: 'paid',
    paidAmount: invoice.totalAmount, // NEW: set paid amount
    remainingAmount: 0,              // NEW: clear remaining
    updatedAt: new Date(),
  })
  .where(eq(invoices.id, invoiceId));
```

### Step 3: Add audit log entry

After marking paid, write an audit log entry:

```typescript
if (metadata) {
  await db.insert(auditLog).values({
    clientId: invoiceResult[0].clientId,
    action: 'invoice_manually_paid',
    details: {
      invoiceId,
      paymentMethod: metadata.paymentMethod,
      notes: metadata.notes,
      paidAt: metadata.paidAt?.toISOString() || new Date().toISOString(),
      recordedBy: metadata.recordedBy,
    } as unknown as Record<string, unknown>,
  });
}
```

### Edge Cases

1. **Invoice already paid** — Check status before marking. Return 400 "Invoice is already paid."
2. **Invoice doesn't belong to client** — `adminClientRoute` handles client scoping. Additionally verify `invoice.clientId === clientId`.
3. **Partial payment** — For MVP, mark-paid means fully paid. Partial payment support can come later.
4. **Concurrent requests** — Two admins mark same invoice paid simultaneously. The second update is idempotent (status was already 'paid'). No harm done.
5. **Reminders already sent** — `markInvoicePaid()` cancels future scheduled reminders. Already-sent reminders can't be unsent — this is acceptable.

### Files Changed

| File | Change |
|------|--------|
| `src/app/api/admin/clients/[id]/invoices/[invoiceId]/mark-paid/route.ts` | **NEW** — Admin mark-paid endpoint |
| `src/lib/automations/payment-reminder.ts` | Update `markInvoicePaid()` signature to accept metadata, set paidAmount/remainingAmount |

### Verification

1. `npm run typecheck` passes
2. `npm run build` passes
3. `npm test` passes
4. Manual test: create invoice → start payment reminders → call mark-paid endpoint → verify reminders cancelled and invoice status = 'paid'
5. `npm run quality:no-regressions` passes

### Resume Point

If interrupted, check:
- Does `src/app/api/admin/clients/[id]/invoices/[invoiceId]/mark-paid/route.ts` exist? → If not, create it.
- Did `markInvoicePaid()` get the metadata parameter? → If not, update it.
- Run `npm run typecheck` to verify state.
