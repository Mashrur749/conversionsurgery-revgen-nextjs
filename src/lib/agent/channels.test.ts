import { describe, expect, it } from 'vitest';
import { CHANNEL_CONFIGS, getChannelConfig } from './channels';

describe('CHANNEL_CONFIGS', () => {
  it('defines all 3 required channels (sms, voice, web_chat)', () => {
    expect(CHANNEL_CONFIGS).toHaveProperty('sms');
    expect(CHANNEL_CONFIGS).toHaveProperty('voice');
    expect(CHANNEL_CONFIGS).toHaveProperty('web_chat');
  });

  describe('sms', () => {
    it('has maxLength of 300', () => {
      expect(CHANNEL_CONFIGS['sms'].messageConstraints.maxLength).toBe(300);
    });

    it('has maxQuestionsPerMessage of 1', () => {
      expect(CHANNEL_CONFIGS['sms'].messageConstraints.maxQuestionsPerMessage).toBe(1);
    });

    it('emojiPolicy is never (brand rule)', () => {
      expect(CHANNEL_CONFIGS['sms'].toneModifiers.emojiPolicy).toBe('never');
    });

    it('does not support formatting', () => {
      expect(CHANNEL_CONFIGS['sms'].messageConstraints.supportsFormatting).toBe(false);
    });

    it('canTransferToHuman is false', () => {
      expect(CHANNEL_CONFIGS['sms'].escalationBehavior.canTransferToHuman).toBe(false);
    });

    it('id matches key', () => {
      expect(CHANNEL_CONFIGS['sms'].id).toBe('sms');
    });
  });

  describe('voice', () => {
    it('has silenceHandling defined', () => {
      expect(CHANNEL_CONFIGS['voice'].pacingRules.silenceHandling).toBeDefined();
      expect(typeof CHANNEL_CONFIGS['voice'].pacingRules.silenceHandling).toBe('string');
      expect(CHANNEL_CONFIGS['voice'].pacingRules.silenceHandling!.length).toBeGreaterThan(0);
    });

    it('canTransferToHuman is true', () => {
      expect(CHANNEL_CONFIGS['voice'].escalationBehavior.canTransferToHuman).toBe(true);
    });

    it('transfer mechanism references Twilio', () => {
      expect(CHANNEL_CONFIGS['voice'].escalationBehavior.transferMechanism).toMatch(/twilio/i);
    });

    it('fillerWordsAllowed is true', () => {
      expect(CHANNEL_CONFIGS['voice'].toneModifiers.fillerWordsAllowed).toBe(true);
    });

    it('emojiPolicy is never', () => {
      expect(CHANNEL_CONFIGS['voice'].toneModifiers.emojiPolicy).toBe('never');
    });

    it('id matches key', () => {
      expect(CHANNEL_CONFIGS['voice'].id).toBe('voice');
    });
  });

  describe('web_chat', () => {
    it('supports formatting', () => {
      expect(CHANNEL_CONFIGS['web_chat'].messageConstraints.supportsFormatting).toBe(true);
    });

    it('maxLength is greater than sms maxLength', () => {
      expect(CHANNEL_CONFIGS['web_chat'].messageConstraints.maxLength).toBeGreaterThan(
        CHANNEL_CONFIGS['sms'].messageConstraints.maxLength,
      );
    });

    it('id matches key', () => {
      expect(CHANNEL_CONFIGS['web_chat'].id).toBe('web_chat');
    });
  });

  it('all channels have the required shape', () => {
    for (const [key, config] of Object.entries(CHANNEL_CONFIGS)) {
      expect(typeof config.id).toBe('string');
      expect(config.id).toBe(key);
      expect(typeof config.messageConstraints.maxLength).toBe('number');
      expect(typeof config.messageConstraints.maxQuestionsPerMessage).toBe('number');
      expect(typeof config.messageConstraints.supportsFormatting).toBe('boolean');
      expect(typeof config.messageConstraints.supportsLinks).toBe('boolean');
      expect(typeof config.messageConstraints.supportsImages).toBe('boolean');
      expect(typeof config.pacingRules.responseTimeExpectation).toBe('string');
      expect(typeof config.pacingRules.turnCadence).toBe('string');
      expect(['terse', 'concise', 'moderate', 'verbose']).toContain(config.toneModifiers.brevityLevel);
      expect(typeof config.toneModifiers.fillerWordsAllowed).toBe('boolean');
      expect(['always', 'usually', 'formal_only']).toContain(config.toneModifiers.contractions);
      expect(['never', 'sparingly', 'natural']).toContain(config.toneModifiers.emojiPolicy);
      expect(typeof config.escalationBehavior.canTransferToHuman).toBe('boolean');
      expect(typeof config.escalationBehavior.transferMechanism).toBe('string');
    }
  });
});

describe('getChannelConfig', () => {
  it('returns sms config for sms id', () => {
    expect(getChannelConfig('sms').id).toBe('sms');
  });

  it('returns voice config for voice id', () => {
    expect(getChannelConfig('voice').id).toBe('voice');
  });

  it('returns web_chat config for web_chat id', () => {
    expect(getChannelConfig('web_chat').id).toBe('web_chat');
  });

  it('falls back to sms config for unknown channel id', () => {
    expect(getChannelConfig('unknown_channel').id).toBe('sms');
  });

  it('falls back to sms config for empty string', () => {
    expect(getChannelConfig('').id).toBe('sms');
  });
});
