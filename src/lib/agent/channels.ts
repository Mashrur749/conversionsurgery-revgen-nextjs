/**
 * Layer 4: Channel Adaptation Constants
 *
 * Constraints and affordances of each communication medium.
 * Shapes HOW the message is delivered, not WHAT it says.
 *
 * Each channel config answers: what can I send, how long should I wait,
 * what tone is expected, and how do I hand off to a human?
 */

export interface ChannelConfig {
  id: string;
  messageConstraints: {
    maxLength: number;
    maxQuestionsPerMessage: number;
    supportsFormatting: boolean;
    supportsLinks: boolean;
    supportsImages: boolean;
  };
  pacingRules: {
    responseTimeExpectation: string;
    turnCadence: string;
    silenceHandling?: string;
  };
  toneModifiers: {
    brevityLevel: 'terse' | 'concise' | 'moderate' | 'verbose';
    fillerWordsAllowed: boolean;
    contractions: 'always' | 'usually' | 'formal_only';
    emojiPolicy: 'never' | 'sparingly' | 'natural';
  };
  escalationBehavior: {
    canTransferToHuman: boolean;
    transferMechanism: string;
  };
}

export const CHANNEL_CONFIGS: Record<string, ChannelConfig> = {
  // ─────────────────────────────────────────────────────────────────────────
  // SMS
  // Primary channel for ConversionSurgery. Async, concise, no formatting.
  // Brand rule: emojis never (professional tone, see Learned Rule #12).
  // 300 chars = 2 SMS segments — stay under to avoid split messages.
  // ─────────────────────────────────────────────────────────────────────────
  sms: {
    id: 'sms',
    messageConstraints: {
      maxLength: 300,
      maxQuestionsPerMessage: 1,
      supportsFormatting: false,
      supportsLinks: true,
      supportsImages: true,
    },
    pacingRules: {
      responseTimeExpectation: 'Under 30 seconds',
      turnCadence: 'Async — hours between turns is normal',
    },
    toneModifiers: {
      brevityLevel: 'concise',
      fillerWordsAllowed: false,
      contractions: 'always',
      emojiPolicy: 'never',
    },
    escalationBehavior: {
      canTransferToHuman: false,
      transferMechanism: 'Escalation queue with SMS notification to team',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Voice
  // Real-time channel via Twilio. Immediate response required.
  // Filler words acceptable — silence is more disruptive than in text.
  // Hot transfer to human possible via Twilio dial.
  // ─────────────────────────────────────────────────────────────────────────
  voice: {
    id: 'voice',
    messageConstraints: {
      maxLength: 500,
      maxQuestionsPerMessage: 2,
      supportsFormatting: false,
      supportsLinks: false,
      supportsImages: false,
    },
    pacingRules: {
      responseTimeExpectation: 'Immediate — real-time conversation',
      turnCadence: 'Real-time — no pauses longer than 3 seconds',
      silenceHandling: 'Fill silence after 3 seconds with acknowledgment',
    },
    toneModifiers: {
      brevityLevel: 'moderate',
      fillerWordsAllowed: true,
      contractions: 'always',
      emojiPolicy: 'never',
    },
    escalationBehavior: {
      canTransferToHuman: true,
      transferMechanism: 'Hot transfer via Twilio dial',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Web Chat
  // Semi-synchronous. Supports formatting and richer content.
  // Links and images available — use to share portfolio, estimates, etc.
  // ─────────────────────────────────────────────────────────────────────────
  web_chat: {
    id: 'web_chat',
    messageConstraints: {
      maxLength: 800,
      maxQuestionsPerMessage: 2,
      supportsFormatting: true,
      supportsLinks: true,
      supportsImages: true,
    },
    pacingRules: {
      responseTimeExpectation: 'Under 10 seconds',
      turnCadence: 'Semi-synchronous — minutes between turns',
    },
    toneModifiers: {
      brevityLevel: 'moderate',
      fillerWordsAllowed: false,
      contractions: 'usually',
      emojiPolicy: 'sparingly',
    },
    escalationBehavior: {
      canTransferToHuman: false,
      transferMechanism: 'Escalation queue with email notification',
    },
  },
};

/**
 * Retrieve a channel config by id.
 * Falls back to SMS config if the channel is unknown — the primary channel
 * for ConversionSurgery at launch.
 */
export function getChannelConfig(channelId: string): ChannelConfig {
  return CHANNEL_CONFIGS[channelId] ?? CHANNEL_CONFIGS['sms'];
}
