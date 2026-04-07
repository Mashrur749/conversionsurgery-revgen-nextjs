'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Volume2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

interface Props {
  clientId: string;
  voiceVoiceId?: string | null;
}

const SAMPLE_PROMPTS = [
  'How much does a kitchen renovation cost?',
  'Can I book an estimate for next week?',
  'I want to speak to someone',
  'Are you licensed?',
];

function PlayButton({ text, voiceId }: { text: string; voiceId: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function play() {
    setPlaying(true);
    try {
      const res = await fetch('/api/admin/voice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId, text: text.slice(0, 500) }),
      });
      if (!res.ok) throw new Error('Preview failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
        audioRef.current.onended = () => setPlaying(false);
      }
    } catch {
      toast.error('Audio preview failed');
      setPlaying(false);
    }
  }

  return (
    <>
      <button
        onClick={play}
        disabled={playing}
        className="mt-1.5 text-[#6B7E54] hover:text-[#6B7E54]/80 flex items-center gap-1 text-xs disabled:opacity-50"
      >
        {playing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Volume2 className="h-3 w-3" />
        )}
        {playing ? 'Playing...' : 'Play'}
      </button>
      <audio ref={audioRef} className="hidden" />
    </>
  );
}

export function VoiceSimulator({ clientId, voiceVoiceId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const history = messages.filter((m) => !m.error);
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/voice-simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error('Simulation failed');
      const data = (await res.json()) as { response: string };
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  function retryLast() {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      setMessages((prev) => prev.filter((m) => !m.error));
      void sendMessage(lastUser.content);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Message area */}
      <div className="min-h-[300px] max-h-[480px] overflow-y-auto flex flex-col gap-3 pr-1">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center py-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Type a message as a homeowner to test the voice AI
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void sendMessage(prompt)}
                  className="text-xs px-3 py-1.5 rounded-full border border-[#6B7E54]/30 text-[#6B7E54] hover:bg-[#E3E9E1] transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'rounded-lg p-3 max-w-[85%]',
              msg.role === 'user'
                ? 'bg-[#C8D4CC] border border-[#1B2F26]/20 ml-auto'
                : msg.error
                  ? 'bg-[#FDEAE4] border border-[#C15B2E]/30 mr-auto'
                  : 'bg-accent border border-[#6B7E54]/30 mr-auto'
            )}
          >
            <p className="text-xs font-medium mb-1 text-muted-foreground">
              {msg.role === 'user' ? 'Homeowner' : 'AI'}
            </p>
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            {msg.error && (
              <button
                onClick={retryLast}
                className="mt-1.5 text-[#C15B2E] hover:text-[#C15B2E]/80 flex items-center gap-1 text-xs"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            )}
            {msg.role === 'assistant' && !msg.error && voiceVoiceId && (
              <PlayButton text={msg.content} voiceId={voiceVoiceId} />
            )}
          </div>
        ))}

        {loading && (
          <div className="rounded-lg p-3 max-w-[85%] bg-accent border border-[#6B7E54]/30 mr-auto">
            <p className="text-xs font-medium mb-1 text-muted-foreground">AI</p>
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6B7E54] animate-bounce [animation-delay:0ms]" />
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6B7E54] animate-bounce [animation-delay:150ms]" />
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6B7E54] animate-bounce [animation-delay:300ms]" />
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end border-t pt-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type as a homeowner... (Enter to send)"
          rows={2}
          className="flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          disabled={loading}
        />
        <button
          onClick={() => void sendMessage(input)}
          disabled={loading || !input.trim()}
          className="h-9 px-4 rounded-md bg-[#1B2F26] text-white text-sm font-medium hover:bg-[#1B2F26]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Send
        </button>
      </div>

      {/* Clear */}
      {messages.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => setMessages([])}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Clear conversation
          </button>
        </div>
      )}
    </div>
  );
}
