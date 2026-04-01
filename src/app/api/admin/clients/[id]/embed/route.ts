import { NextResponse } from 'next/server';
import {
  adminClientRoute,
  AGENCY_PERMISSIONS,
} from '@/lib/utils/route-handler';

function generateEmbedSnippet(clientId: string, appUrl: string): string {
  return `<!-- ConversionSurgery Lead Capture Widget -->
<div id="cs-widget"></div>
<script>
(function() {
  var CLIENT_ID = '${clientId}';
  var API_URL = '${appUrl}/api/public/leads';
  var container = document.getElementById('cs-widget');
  container.innerHTML = '<form id="cs-form" style="max-width:400px;font-family:system-ui,sans-serif">'
    + '<h3 style="margin:0 0 16px;font-size:18px">Request a Free Estimate</h3>'
    + '<input name="name" placeholder="Your name" required style="display:block;width:100%;padding:10px;margin:0 0 12px;border:1px solid #ccc;border-radius:6px;box-sizing:border-box;font-size:14px">'
    + '<input name="phone" type="tel" placeholder="(403) 555-1234" required style="display:block;width:100%;padding:10px;margin:0 0 12px;border:1px solid #ccc;border-radius:6px;box-sizing:border-box;font-size:14px">'
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
</script>`;
}

/**
 * GET /api/admin/clients/[id]/embed
 * Returns the embeddable HTML snippet for a client.
 */
export const GET = adminClientRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW, clientIdFrom: (p: { id: string }) => p.id },
  async ({ clientId }) => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.conversionsurgery.com';
    const snippet = generateEmbedSnippet(clientId, appUrl);
    return NextResponse.json({ snippet, clientId });
  }
);
