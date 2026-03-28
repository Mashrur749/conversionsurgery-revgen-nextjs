# Testing Guide: Self-Serve Signup Flow

Last updated: 2026-03-28
Audience: Engineering
Purpose: validate the public `/signup` path (not the primary managed-service delivery flow).

> **Note:** The primary testing guide is [`01-TESTING-GUIDE.md`](./01-TESTING-GUIDE.md). That guide follows the operator's managed-service delivery journey. This document covers the self-serve signup path, which exists as a secondary acquisition channel.

## Prerequisites

- Dev server running (`npm run dev`)
- Role templates seeded (`set -a && source .dev.vars && set +a && npx tsx src/scripts/seed-role-templates.ts`)
- See Section 0 of the [main testing guide](./01-TESTING-GUIDE.md) for full preflight.

## Self-Serve Signup Test

### Step 1: Create client via public signup

1. Open `/signup` and create a fresh test client (unique email + phone).
2. After submission, confirm you are **automatically redirected to `/client`** (the client dashboard).
3. Verify you are logged in (client nav bar visible, no login prompt).

Expected:
- Signup creates client, person, and clientMembership in one transaction.
- Portal session cookie is set automatically &mdash; no separate login step.
- Redirect goes to `/client` (not `/signup/next-steps` or `/client-login`).
- No `Owner role template is missing` errors.

If blocked:
- `Owner role template is missing`: run `npx tsx src/scripts/seed-role-templates.ts`.
- Redirected to `/client-login` instead of `/client`: auto-login failed. Check server logs for `[PublicSignup] Auto-login failed` error. Fallback: log in manually via OTP.

### Step 2: Dashboard setup banner

1. On the client dashboard (`/client`), verify the setup checklist banner is visible:
   - [ ] Set up your business phone number &rarr; [Set Up Phone]
   - [ ] Choose a plan &rarr; [Choose Plan]
2. Verify the banner uses brand colors (moss-light background, olive border).

Expected:
- Banner appears for new clients without phone or subscription.
- Each incomplete item has an action button.
- Completed items show green check and strikethrough.

### Step 3: Choose a plan (Stripe Checkout)

1. Click **Choose Plan** on the dashboard banner (or navigate to `/client/billing/upgrade`).
2. Select a plan and billing cycle.
3. Verify redirect to Stripe Checkout.
4. Complete with test card `4242 4242 4242 4242`.
5. Verify redirect to `/client/billing/success` with confirmation.
6. Return to `/client` &mdash; the &quot;Choose a plan&quot; item should now be checked off.

Expected:
- Checkout creates subscription via webhook.
- Dashboard banner updates (plan item completed).

If blocked:
- `Stripe pricing not configured`: price IDs are placeholder values. See main guide Step 26.

### Step 4: Set up phone number

1. Click **Set Up Phone** on the dashboard banner (or navigate to `/client/settings/phone`).
2. Select country and province, click **Search Available Numbers**.
3. Click **Purchase** on an available number.
4. Verify success message shows the purchased number.

Expected:
- Number purchased and assigned to client.
- Client status transitions from `pending` to `active`.
- Day-One milestone `number_live` auto-completes.
- Returning to `/client` &mdash; the phone item is checked off.
- If both items are complete, the setup banner disappears entirely.

If blocked:
- `Please choose a plan first` (402): subscription required before phone purchase. Complete Step 3 first.
- No numbers returned: Twilio API may be rate-limited. Dev fallback returns mock numbers.

### Step 5: Settings page phone card

1. Navigate to `/client/settings`.
2. Verify the **Business Phone Number** card appears at the top.
3. If phone is set up: shows the active number with &quot;Manage&quot; button.
4. If phone is not set up: shows &quot;Set Up Phone&quot; CTA.

Expected:
- Phone card is the first item on the settings page.
- Consistent with the dashboard setup banner state.

### Step 6: Onboarding checklist (fallback path)

This tests the public checklist page, which is used when auto-login fails or when the operator shares the link.

1. Open `/signup/next-steps?clientId=<id>&email=<email>` directly.
2. Checklist auto-loads.
3. Verify Day-One milestones are visible.
4. For `number_live` milestone (if not completed): verify &quot;Set up in portal &rarr;&quot; link is visible.

Expected:
- Checklist loads with progress indicators.
- Portal link on phone milestone is present and navigates to `/client/settings/phone`.
- If not logged in, clicking the link redirects to `/client-login` first (expected for unauthenticated context).

### Step 7: Setup help request

1. On the same next-steps page, enter optional context in the help field.
2. Click **Request Managed Onboarding Help**.

Expected:
- Button changes to &quot;Request Sent&quot;.
- No console errors.

## After Self-Serve Tests

Return to the [main testing guide](./01-TESTING-GUIDE.md) Step 1 to continue with the managed-service operator journey using the client you just created (or create a fresh one via admin wizard).
