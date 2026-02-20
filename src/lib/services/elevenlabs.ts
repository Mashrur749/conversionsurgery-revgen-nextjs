const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';
const TTS_MAX_RETRIES = 2;

function ensureApiKey(): string {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('[ElevenLabs] ELEVENLABS_API_KEY is not configured');
  }
  return ELEVENLABS_API_KEY;
}

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url: string;
}

interface VoiceListResponse {
  voices: Voice[];
}

export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  previewUrl: string;
}

/**
 * List available ElevenLabs voices.
 */
export async function listVoices(): Promise<ElevenLabsVoice[]> {
  const apiKey = ensureApiKey();
  const res = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
    headers: { 'xi-api-key': apiKey },
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs API error: ${res.status}`);
  }

  const data: VoiceListResponse = await res.json();
  return data.voices.map((v) => ({
    voiceId: v.voice_id,
    name: v.name,
    category: v.category,
    labels: v.labels || {},
    previewUrl: v.preview_url || '',
  }));
}

/**
 * Get a single voice by ID.
 */
export async function getVoice(voiceId: string): Promise<ElevenLabsVoice | null> {
  const apiKey = ensureApiKey();
  const res = await fetch(`${ELEVENLABS_BASE_URL}/voices/${voiceId}`, {
    headers: { 'xi-api-key': apiKey },
  });

  if (!res.ok) return null;

  const v: Voice = await res.json();
  return {
    voiceId: v.voice_id,
    name: v.name,
    category: v.category,
    labels: v.labels || {},
    previewUrl: v.preview_url || '',
  };
}

/**
 * Synthesize speech from text using ElevenLabs.
 * Returns an ArrayBuffer of audio data (mp3).
 */
export async function synthesizeSpeech(
  voiceId: string,
  text: string,
  options?: {
    stability?: number;
    similarityBoost?: number;
    modelId?: string;
  }
): Promise<ArrayBuffer> {
  const apiKey = ensureApiKey();

  for (let attempt = 1; attempt <= TTS_MAX_RETRIES; attempt++) {
    const res = await fetch(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: options?.modelId || 'eleven_monolingual_v1',
          voice_settings: {
            stability: options?.stability ?? 0.5,
            similarity_boost: options?.similarityBoost ?? 0.75,
          },
        }),
      }
    );

    if (res.ok) {
      return res.arrayBuffer();
    }

    // Non-retryable errors (auth, bad request)
    if (res.status === 401 || res.status === 400 || res.status === 404) {
      throw new Error(`ElevenLabs TTS error: ${res.status}`);
    }

    // Retryable (429, 5xx)
    if (attempt < TTS_MAX_RETRIES) {
      const delay = 1000 * attempt;
      console.warn(`[ElevenLabs] TTS attempt ${attempt} failed (${res.status}), retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    throw new Error(`ElevenLabs TTS error after ${TTS_MAX_RETRIES} attempts: ${res.status}`);
  }

  // Unreachable
  throw new Error('ElevenLabs TTS: max retries exceeded');
}
