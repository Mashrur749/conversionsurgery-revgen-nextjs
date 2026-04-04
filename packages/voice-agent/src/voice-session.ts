/**
 * VoiceSession Durable Object
 *
 * Holds a single voice call's WebSocket connection to Twilio ConversationRelay.
 * On each caller utterance, streams Claude's response tokens back to Twilio for
 * real-time ElevenLabs TTS synthesis.
 *
 * Lifecycle: one DO instance per active call. Garbage-collected when the WS closes.
 */

import type {
  Env,
  SessionContext,
  CRInboundMessage,
  CRSetupMessage,
  CRPromptMessage,
  CRInterruptMessage,
  CRTextMessage,
  CREndMessage,
  HandoffData,
  ConversationMessage,
} from './types';
import { VOICE_TOOLS, executeTool } from './tools';

export class VoiceSession implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private ws: WebSocket | null = null;
  private ctx: SessionContext | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    // Only accept WebSocket upgrades
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair());

    this.ws = server;
    server.accept();

    server.addEventListener('message', (event) => {
      void this.handleMessage(event.data as string);
    });

    server.addEventListener('close', () => {
      this.ws = null;
      this.ctx = null;
    });

    server.addEventListener('error', (err) => {
      console.error('[VoiceSession] WebSocket error:', err);
      this.ws = null;
      this.ctx = null;
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  // ── Message Router ──────────────────────────────────────────────────

  private async handleMessage(raw: string): Promise<void> {
    let message: CRInboundMessage;
    try {
      message = JSON.parse(raw) as CRInboundMessage;
    } catch {
      console.error('[VoiceSession] Invalid JSON:', raw.slice(0, 200));
      return;
    }

    switch (message.type) {
      case 'setup':
        await this.handleSetup(message);
        break;
      case 'prompt':
        await this.handlePrompt(message);
        break;
      case 'interrupt':
        this.handleInterrupt(message);
        break;
      case 'dtmf':
        console.log('[VoiceSession] DTMF received:', message.digit);
        break;
      case 'error':
        console.error('[VoiceSession] ConversationRelay error:', message.description);
        break;
    }
  }

  // ── Setup: Load context from DB ─────────────────────────────────────

  private async handleSetup(message: CRSetupMessage): Promise<void> {
    const { clientId, leadId, callSid } = message.customParameters;

    console.log('[VoiceSession] Setup:', {
      callSidSuffix: message.callSid?.slice(-8),
      clientId,
    });

    // Load client context from Neon
    const context = await this.loadContext(clientId, leadId, message.callSid);
    if (!context) {
      console.error('[VoiceSession] Failed to load context, ending session');
      this.sendEnd({
        reasonCode: 'call-ended',
        reason: 'Failed to load call context',
        callSummary: '',
        transcript: '',
        callerIntent: null,
        callbackRequested: false,
      });
      return;
    }

    this.ctx = context;
  }

  // ── Prompt: Stream Claude response ──────────────────────────────────

  private async handlePrompt(message: CRPromptMessage): Promise<void> {
    if (!this.ctx) {
      console.error('[VoiceSession] Prompt received before setup');
      return;
    }

    const { voicePrompt } = message;
    this.ctx.fullTranscript += `\nCaller: ${voicePrompt}`;
    this.ctx.conversationHistory.push({ role: 'user', content: voicePrompt });

    try {
      const fullResponse = await this.streamClaudeResponse();
      if (fullResponse) {
        this.ctx.fullTranscript += `\nAI: ${fullResponse}`;
      }
    } catch (err) {
      console.error('[VoiceSession] Claude streaming error:', err);
      this.sendText('I apologize, I had a brief issue. Could you repeat that?', true);
    }
  }

  // ── Interrupt: Truncate history ─────────────────────────────────────

  private handleInterrupt(message: CRInterruptMessage): void {
    if (!this.ctx) return;

    const { utteranceUntilInterrupt } = message;
    const history = this.ctx.conversationHistory;

    // Find the last assistant message containing the interrupted text
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === 'assistant' && typeof msg.content === 'string') {
        if (msg.content.includes(utteranceUntilInterrupt)) {
          // Truncate to what was actually heard
          const pos = msg.content.indexOf(utteranceUntilInterrupt);
          const truncated = msg.content.substring(0, pos + utteranceUntilInterrupt.length);
          (msg as ConversationMessage).content = truncated;

          // Remove any assistant messages after this one
          this.ctx.conversationHistory = history.filter(
            (m, idx) => !(idx > i && m.role === 'assistant')
          );
          break;
        }
      }
    }
  }

  // ── Claude Streaming with Tool Use ──────────────────────────────────

  private async streamClaudeResponse(): Promise<string> {
    if (!this.ctx || !this.ws) return '';

    const { buildSystemPrompt } = await import('./prompts');
    const systemPrompt = buildSystemPrompt(this.ctx);

    return this.callClaudeStreaming(systemPrompt);
  }

  private async callClaudeStreaming(systemPrompt: string): Promise<string> {
    if (!this.ctx || !this.ws) return '';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: systemPrompt,
        messages: this.ctx.conversationHistory,
        tools: VOICE_TOOLS,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      console.error('[VoiceSession] Anthropic API error:', response.status);
      this.sendText('Let me connect you with someone who can help.', true);
      return '';
    }

    let fullTextResponse = '';
    const toolUseBlocks: Array<{ id: string; name: string; inputJson: string }> = [];
    let currentToolId = '';
    let currentToolName = '';
    let currentToolInput = '';

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data) as {
            type: string;
            index?: number;
            content_block?: { type: string; id?: string; name?: string };
            delta?: { type: string; text?: string; partial_json?: string };
          };

          // Text token — stream to Twilio immediately
          if (
            event.type === 'content_block_delta' &&
            event.delta?.type === 'text_delta' &&
            event.delta.text
          ) {
            fullTextResponse += event.delta.text;
            this.sendText(event.delta.text, false);
          }

          // Tool use block started
          if (
            event.type === 'content_block_start' &&
            event.content_block?.type === 'tool_use'
          ) {
            currentToolId = event.content_block.id ?? '';
            currentToolName = event.content_block.name ?? '';
            currentToolInput = '';
          }

          // Tool input JSON accumulating
          if (
            event.type === 'content_block_delta' &&
            event.delta?.type === 'input_json_delta' &&
            event.delta.partial_json
          ) {
            currentToolInput += event.delta.partial_json;
          }

          // Tool use block finished
          if (event.type === 'content_block_stop' && currentToolId) {
            toolUseBlocks.push({
              id: currentToolId,
              name: currentToolName,
              inputJson: currentToolInput,
            });
            currentToolId = '';
            currentToolName = '';
            currentToolInput = '';
          }
        } catch {
          // Skip unparseable SSE lines
        }
      }
    }

    // If there was text, signal end of text to Twilio
    if (fullTextResponse) {
      this.sendText('', true);
    }

    // If Claude used tools, execute them and make a follow-up call
    if (toolUseBlocks.length > 0) {
      // Build assistant message with both text and tool_use content blocks
      const assistantContent: Array<{ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }> = [];
      if (fullTextResponse) {
        assistantContent.push({ type: 'text', text: fullTextResponse });
      }

      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

      for (const tool of toolUseBlocks) {
        let parsedInput: Record<string, unknown> = {};
        try {
          parsedInput = JSON.parse(tool.inputJson) as Record<string, unknown>;
        } catch {
          parsedInput = {};
        }

        assistantContent.push({
          type: 'tool_use',
          id: tool.id,
          name: tool.name,
          input: parsedInput,
        });

        // Execute the tool
        const result = await executeTool(tool.name, parsedInput, this.ctx!, this.env);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: result.output,
        });

        // If tool ends the session (transfer/callback), send end message
        if (result.shouldEndSession && result.handoffData) {
          // Send filler while transferring
          this.sendText('Let me connect you now. One moment please.', true);
          this.sendEnd(result.handoffData);
          return fullTextResponse;
        }
      }

      // Add assistant message (with tool_use blocks) to history
      this.ctx.conversationHistory.push({
        role: 'assistant',
        content: assistantContent,
      });

      // Add tool results to history
      this.ctx.conversationHistory.push({
        role: 'user',
        content: toolResults,
      });

      // Send filler while Claude processes tool results
      if (!fullTextResponse) {
        this.sendText('Let me check on that for you.', true);
      }

      // Make follow-up call so Claude can respond based on tool results
      const { buildSystemPrompt } = await import('./prompts');
      const followUpResponse = await this.callClaudeStreaming(buildSystemPrompt(this.ctx));
      return fullTextResponse + (followUpResponse ? `\n${followUpResponse}` : '');
    }

    // No tools — just text response
    if (fullTextResponse) {
      this.ctx.conversationHistory.push({ role: 'assistant', content: fullTextResponse });
    }

    return fullTextResponse;
  }

  // ── DB Context Loading ──────────────────────────────────────────────

  private async loadContext(
    clientId: string,
    leadId: string,
    callSid: string,
  ): Promise<SessionContext | null> {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(this.env.DATABASE_URL);

      // Parallel queries for client, KB, and agent settings
      const [clientRows, kbRows, settingsRows] = await Promise.all([
        sql`SELECT business_name, owner_name, phone, voice_greeting, timezone FROM clients WHERE id = ${clientId} LIMIT 1`,
        sql`SELECT category, title, content FROM knowledge_base WHERE client_id = ${clientId}`,
        sql`SELECT agent_tone, can_discuss_pricing FROM client_agent_settings WHERE client_id = ${clientId} LIMIT 1`,
      ]);

      const client = clientRows[0];
      if (!client) return null;

      const knowledgeContext = kbRows
        .map((k: Record<string, string>) => `${k.category}: ${k.title} — ${k.content}`)
        .join('\n');

      const settings = settingsRows[0];

      return {
        callSid,
        clientId,
        leadId,
        businessName: (client.business_name as string) || 'the business',
        ownerName: (client.owner_name as string) || 'the owner',
        ownerPhone: (client.phone as string) || null,
        greeting: (client.voice_greeting as string) || '',
        agentTone: ((settings?.agent_tone as string) || 'professional') as SessionContext['agentTone'],
        canDiscussPricing: (settings?.can_discuss_pricing as boolean) || false,
        knowledgeContext,
        timezone: (client.timezone as string) || 'America/Edmonton',
        conversationHistory: [],
        fullTranscript: '',
        detectedIntent: null,
        callbackRequested: false,
      };
    } catch (err) {
      console.error('[VoiceSession] DB load error:', err);
      return null;
    }
  }

  // ── WebSocket Helpers ───────────────────────────────────────────────

  private sendText(token: string, last: boolean): void {
    if (!this.ws) return;
    const msg: CRTextMessage = { type: 'text', token, last };
    this.ws.send(JSON.stringify(msg));
  }

  private sendEnd(handoff: HandoffData): void {
    if (!this.ws) return;
    const msg: CREndMessage = { type: 'end', handoffData: JSON.stringify(handoff) };
    this.ws.send(JSON.stringify(msg));
  }
}
