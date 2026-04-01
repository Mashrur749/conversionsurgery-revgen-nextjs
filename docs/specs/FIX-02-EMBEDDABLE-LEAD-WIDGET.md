# FIX-02: Embeddable Lead Intake Widget

Status: Ready
Priority: HIGH — contractors will ask "what about my website leads?"
Estimated files: 3-4

---

## Problem

Leads can only enter the system via inbound SMS, missed calls, or a developer-integrated API webhook. There's no embeddable widget a contractor can paste on their website. This means website leads — often the primary source — don't flow into the system unless the contractor has a developer.

## Solution

Create a public lead intake endpoint (no Bearer token — uses client ID + origin validation) and a lightweight embeddable HTML/JS snippet that contractors (or you during onboarding) can paste into any website.

## Implementation

### Step 1: Create public lead intake endpoint

**New file:** `src/app/api/public/leads/route.ts`

This endpoint is similar to `/api/webhooks/form` but designed for browser-side use (no Bearer token, CORS-enabled, rate-limited by client ID).

```typescript
/**
 * POST /api/public/leads
 * Public lead intake endpoint for embeddable widget.
 * No auth token required — uses clientId + CORS origin validation.
 * Rate limited: 20 submissions per minute per client.
 */

// Schema:
const publicLeadSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(200),
  phone: z.string().min(10).max(20),
  email: z.string().email().optional(),
  message: z.string().max(2000).optional(),
  projectType: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  source: z.literal('widget').default('widget'),
});
```

**Key differences from `/api/webhooks/form`:**
- No Bearer token — public endpoint
- CORS headers: `Access-Control-Allow-Origin: *` (contractor's site domain is unknown)
- Rate limiting: check `daily_stats` or in-memory counter — 20 per minute per clientId
- Validates clientId exists and is active before processing
- Reuses `handleFormSubmission()` from `src/lib/automations/form-response.ts`
- Returns minimal response (no internal IDs): `{ success: true, message: "We'll be in touch shortly!" }`

**CORS preflight:** Also export an `OPTIONS` handler returning CORS headers.

### Step 2: Add 'widget' to lead source

**File:** `src/db/schema/leads.ts`

The `source` field is a `varchar(50)`, not an enum — so no migration needed. The value `'widget'` can be used directly. However, add it to the analytics aggregation source list if there's a hardcoded list.

**Check:** `src/lib/services/analytics-aggregation.ts` — if it has a source breakdown, add `'widget'` to the list.

### Step 3: Create embed snippet generator endpoint

**New file:** `src/app/api/admin/clients/[id]/embed/route.ts`

```typescript
/**
 * GET /api/admin/clients/[id]/embed
 * Returns the embeddable HTML snippet for a client.
 */
export const GET = adminClientRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const snippet = generateEmbedSnippet(clientId, appUrl);
    return NextResponse.json({ snippet, clientId });
  }
);
```

**Snippet template** (returned as a string the admin copies):

```html
<!-- ConversionSurgery Lead Capture Widget -->
<div id="cs-widget"></div>
<script>
(function() {
  var CLIENT_ID = '{{clientId}}';
  var API_URL = '{{appUrl}}/api/public/leads';
  var container = document.getElementById('cs-widget');
  container.innerHTML = '<form id="cs-form" style="max-width:400px;font-family:system-ui,sans-serif">'
    + '<h3 style="margin:0 0 16px;font-size:18px">Request a Free Estimate</h3>'
    + '<input name="name" placeholder="Your name" required style="display:block;width:100%;padding:10px;margin:0 0 12px;border:1px solid #ccc;border-radius:6px;box-sizing:border-box;font-size:14px">'
    + '<input name="phone" type="tel" placeholder="Phone number" required style="display:block;width:100%;padding:10px;margin:0 0 12px;border:1px solid #ccc;border-radius:6px;box-sizing:border-box;font-size:14px">'
    + '<input name="email" type="email" placeholder="Email (optional)" style="display:block;width:100%;padding:10px;margin:0 0 12px;border:1px solid #ccc;border-radius:6px;box-sizing:border-box;font-size:14px">'
    + '<textarea name="message" placeholder="Tell us about your project" rows="3" style="display:block;width:100%;padding:10px;margin:0 0 12px;border:1px solid #ccc;border-radius:6px;box-sizing:border-box;font-size:14px;resize:vertical"></textarea>'
    + '<button type="submit" style="width:100%;padding:12px;background:#1B2F26;color:#fff;border:none;border-radius:6px;font-size:16px;cursor:pointer">Get Your Estimate</button>'
    + '<p id="cs-status" style="margin:8px 0 0;font-size:13px;color:#666"></p>'
    + '</form>';
  document.getElementById('cs-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var btn = this.querySelector('button');
    var status = document.getElementById('cs-status');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: CLIENT_ID,
        name: this.name.value,
        phone: this.phone.value,
        email: this.email.value || undefined,
        message: this.message.value || undefined,
        source: 'widget'
      })
    }).then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) {
        container.innerHTML = '<p style="padding:24px;text-align:center;font-size:16px;color:#3D7A50">Thanks! We will be in touch shortly.</p>';
      } else {
        status.textContent = d.error || 'Something went wrong. Please try again.';
        status.style.color = '#C15B2E';
        btn.disabled = false;
        btn.textContent = 'Get Your Estimate';
      }
    }).catch(function() {
      status.textContent = 'Connection error. Please try again.';
      status.style.color = '#C15B2E';
      btn.disabled = false;
      btn.textContent = 'Get Your Estimate';
    });
  });
})();
</script>
```

### Step 4: Add "Embed Widget" section to client admin page

**File:** `src/app/(dashboard)/admin/clients/[id]/page.tsx` (or a sub-component)

Add a card/section that:
1. Shows a "Copy Widget Code" button
2. Fetches from `/api/admin/clients/[id]/embed`
3. Displays the snippet in a `<pre>` block with a copy button

Keep it minimal — just a code block with a copy button. No complex UI.

### Edge Cases

1. **Bot spam** — The public endpoint has no CAPTCHA. Rate limiting (20/min per clientId) is the first defense. If spam becomes a problem, add honeypot field later.
2. **Invalid clientId** — Return generic error, don't reveal whether client exists.
3. **Duplicate leads** — `handleFormSubmission()` already handles upsert by phone+clientId.
4. **Client is inactive** — `handleFormSubmission()` already checks client status.
5. **Phone formatting** — Server-side normalization handles this.
6. **CORS** — Allow all origins since contractor websites are unknown. The clientId acts as the scoping mechanism.

### Files Changed

| File | Change |
|------|--------|
| `src/app/api/public/leads/route.ts` | **NEW** — Public lead intake endpoint |
| `src/app/api/admin/clients/[id]/embed/route.ts` | **NEW** — Embed snippet generator |
| `src/app/(dashboard)/admin/clients/[id]/page.tsx` | Add "Widget Code" card (or new component) |

### Verification

1. `npm run typecheck` passes
2. `npm run build` passes
3. `npm test` passes
4. Manual test: POST to `/api/public/leads` with valid clientId → lead created, SMS sent
5. Manual test: POST without clientId → 400 error
6. Manual test: paste snippet into a test HTML file, submit form → lead appears in dashboard
7. `npm run quality:no-regressions` passes

### Resume Point

If interrupted, check:
- Does `src/app/api/public/leads/route.ts` exist? → If not, create it.
- Does `src/app/api/admin/clients/[id]/embed/route.ts` exist? → If not, create it.
- Does the admin page have the widget card? → If not, add it.
- Run `npm run typecheck` to verify state.
