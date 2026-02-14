const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

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
  const res = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
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
  const res = await fetch(`${ELEVENLABS_BASE_URL}/voices/${voiceId}`, {
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
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
  const res = await fetch(
    `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
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

  if (!res.ok) {
    throw new Error(`ElevenLabs TTS error: ${res.status}`);
  }

  return res.arrayBuffer();
}
