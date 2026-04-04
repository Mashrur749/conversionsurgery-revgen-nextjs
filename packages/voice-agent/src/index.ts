/**
 * Voice Agent — Cloudflare Worker Entry
 *
 * Routes incoming WebSocket upgrade requests to VoiceSession Durable Objects.
 * Each call gets its own DO instance keyed by a unique ID from the request.
 */

import type { Env } from './types';

export { VoiceSession } from './voice-session';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response('ok', { status: 200 });
    }

    // WebSocket endpoint — Twilio ConversationRelay connects here
    if (url.pathname === '/ws') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }

      // Each call gets a unique DO instance
      // Use a random ID — the DO is ephemeral (lives only for the call duration)
      const id = env.VOICE_SESSION.newUniqueId();
      const stub = env.VOICE_SESSION.get(id);

      return stub.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
