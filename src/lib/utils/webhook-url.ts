import { NextRequest } from 'next/server';

/**
 * Derive the base URL for Twilio webhook callback URLs from the incoming
 * request. Used in TwiML responses for `<Dial action="...">` etc.
 *
 * Priority:
 * 1. x-forwarded-host + x-forwarded-proto (ngrok, reverse proxies)
 * 2. TWILIO_WEBHOOK_BASE_URL env var (dedicated webhook endpoint)
 * 3. NEXT_PUBLIC_APP_URL env var
 * 4. Request host header as last resort
 */
export function getWebhookBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');

  if (forwardedHost) {
    const proto = forwardedProto || 'https';
    return `${proto}://${forwardedHost}`;
  }

  if (process.env.TWILIO_WEBHOOK_BASE_URL) {
    return process.env.TWILIO_WEBHOOK_BASE_URL;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  const host = request.headers.get('host') || 'localhost:3000';
  const proto = host.includes('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

/**
 * Escape a URL for safe inclusion in TwiML/XML attributes.
 * XML requires `&` to be encoded as `&amp;` inside attribute values.
 */
export function xmlAttr(url: string): string {
  return url.replace(/&/g, '&amp;');
}
