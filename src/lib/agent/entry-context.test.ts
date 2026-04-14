import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveEntryContext } from './entry-context';

describe('resolveEntryContext', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Source mapping
  // ---------------------------------------------------------------------------

  describe('source mapping', () => {
    it('missed_call source produces empathetic opening', () => {
      const ctx = resolveEntryContext({
        leadSource: 'missed_call',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.source).toBe('missed_call');
      expect(ctx.openingStrategy.acknowledgment).toContain('missed');
      expect(ctx.openingStrategy.toneAdjustment).toContain('empathetic');
    });

    it('form source maps to form_submission', () => {
      const ctx = resolveEntryContext({
        leadSource: 'form',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.source).toBe('form_submission');
    });

    it('web_form source maps to form_submission', () => {
      const ctx = resolveEntryContext({
        leadSource: 'web_form',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.source).toBe('form_submission');
    });

    it('form_submission source maps correctly', () => {
      const ctx = resolveEntryContext({
        leadSource: 'form_submission',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.source).toBe('form_submission');
    });

    it('google source maps to google_ads', () => {
      const ctx = resolveEntryContext({
        leadSource: 'google',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.source).toBe('google_ads');
    });

    it('google_ads source maps correctly', () => {
      const ctx = resolveEntryContext({
        leadSource: 'google_ads',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.source).toBe('google_ads');
    });

    it('homeStars canonical casing maps correctly', () => {
      const ctx = resolveEntryContext({
        leadSource: 'homeStars',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.source).toBe('homeStars');
    });

    it('homestars lowercase maps to homeStars', () => {
      const ctx = resolveEntryContext({
        leadSource: 'homestars',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.source).toBe('homeStars');
    });

    it('referral source maps correctly', () => {
      const ctx = resolveEntryContext({
        leadSource: 'referral',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
        referrerName: 'Dave',
      });
      expect(ctx.source).toBe('referral');
    });

    it('csv_import with > 180 days maps to dormant_reactivation', () => {
      const ctx = resolveEntryContext({
        leadSource: 'csv_import',
        isReturningLead: false,
        daysSinceLastContact: 200,
        existingProjectInfo: null,
      });
      expect(ctx.source).toBe('dormant_reactivation');
    });

    it('csv_import with <= 180 days maps to unknown', () => {
      const ctx = resolveEntryContext({
        leadSource: 'csv_import',
        isReturningLead: false,
        daysSinceLastContact: 180,
        existingProjectInfo: null,
      });
      expect(ctx.source).toBe('unknown');
    });

    it('csv_import with null daysSinceLastContact maps to unknown', () => {
      const ctx = resolveEntryContext({
        leadSource: 'csv_import',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.source).toBe('unknown');
    });

    it('voice source maps to voice_call', () => {
      const ctx = resolveEntryContext({
        leadSource: 'voice',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.source).toBe('voice_call');
    });

    it('voice_call source maps correctly', () => {
      const ctx = resolveEntryContext({
        leadSource: 'voice_call',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.source).toBe('voice_call');
    });

    it('null leadSource maps to inbound_sms', () => {
      const ctx = resolveEntryContext({
        leadSource: null,
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.source).toBe('inbound_sms');
    });

    it('unknown source defaults gracefully', () => {
      const ctx = resolveEntryContext({
        leadSource: 'some_random_source',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.source).toBe('unknown');
    });
  });

  // ---------------------------------------------------------------------------
  // Form submission
  // ---------------------------------------------------------------------------

  describe('form_submission', () => {
    it('form_submission with rich data skips qualifying fields', () => {
      const ctx = resolveEntryContext({
        leadSource: 'form_submission',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
        formData: { projectType: 'basement finishing', timeline: 'next month', size: '1200 sqft' },
      });
      expect(ctx.source).toBe('form_submission');
      expect(ctx.openingStrategy.skipQualifying).toContain('projectType');
      expect(ctx.openingStrategy.skipQualifying).toContain('timeline');
    });

    it('form_submission with sqft key skips size qualifying', () => {
      const ctx = resolveEntryContext({
        leadSource: 'form_submission',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
        formData: { sqft: '1500' },
      });
      expect(ctx.openingStrategy.skipQualifying).toContain('size');
    });

    it('form_submission references project type in acknowledgment', () => {
      const ctx = resolveEntryContext({
        leadSource: 'form_submission',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
        formData: { projectType: 'kitchen renovation' },
      });
      expect(ctx.openingStrategy.acknowledgment).toContain('kitchen renovation');
    });

    it('form_submission with no form data uses generic acknowledgment', () => {
      const ctx = resolveEntryContext({
        leadSource: 'form_submission',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
        formData: null,
      });
      expect(ctx.openingStrategy.acknowledgment).toBeTruthy();
      expect(ctx.openingStrategy.skipQualifying).toEqual([]);
    });

    it('form_submission has direct tone', () => {
      const ctx = resolveEntryContext({
        leadSource: 'form_submission',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
        formData: {},
      });
      expect(ctx.openingStrategy.toneAdjustment).toContain('direct');
    });
  });

  // ---------------------------------------------------------------------------
  // Returning lead
  // ---------------------------------------------------------------------------

  describe('returning lead', () => {
    it('returning lead after 14 days gets welcome back acknowledgment', () => {
      const ctx = resolveEntryContext({
        leadSource: null,
        isReturningLead: true,
        daysSinceLastContact: 14,
        existingProjectInfo: { projectType: 'basement' },
      });
      expect(ctx.isReturningLead).toBe(true);
      expect(ctx.openingStrategy.acknowledgment).toContain('back');
    });

    it('returning lead after exactly 7 days does NOT get welcome back override', () => {
      const ctx = resolveEntryContext({
        leadSource: null,
        isReturningLead: true,
        daysSinceLastContact: 7,
        existingProjectInfo: null,
      });
      // 7 is not > 7, so no override — falls through to inbound_sms returning strategy
      expect(ctx.openingStrategy.acknowledgment).not.toContain('welcome back');
    });

    it('returning lead after 8 days gets welcome back override', () => {
      const ctx = resolveEntryContext({
        leadSource: null,
        isReturningLead: true,
        daysSinceLastContact: 8,
        existingProjectInfo: null,
      });
      expect(ctx.openingStrategy.acknowledgment).toContain('back');
    });

    it('returning lead skips qualifying for existing project info', () => {
      const ctx = resolveEntryContext({
        leadSource: null,
        isReturningLead: true,
        daysSinceLastContact: 14,
        existingProjectInfo: { projectType: 'basement', timeline: 'Q3' },
      });
      expect(ctx.openingStrategy.skipQualifying).toContain('projectType');
      expect(ctx.openingStrategy.skipQualifying).toContain('timeline');
    });

    it('inbound_sms returning lead (< 7 days) gets familiar tone', () => {
      const ctx = resolveEntryContext({
        leadSource: null,
        isReturningLead: true,
        daysSinceLastContact: 3,
        existingProjectInfo: { projectType: 'bathroom' },
      });
      expect(ctx.openingStrategy.toneAdjustment).toContain('familiar');
    });
  });

  // ---------------------------------------------------------------------------
  // Referral
  // ---------------------------------------------------------------------------

  describe('referral', () => {
    it('referral source includes referrer name in acknowledgment', () => {
      const ctx = resolveEntryContext({
        leadSource: 'referral',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
        referrerName: 'Dave',
      });
      expect(ctx.source).toBe('referral');
      expect(ctx.openingStrategy.acknowledgment).toContain('Dave');
    });

    it('referral with no referrer name uses fallback', () => {
      const ctx = resolveEntryContext({
        leadSource: 'referral',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
        referrerName: null,
      });
      expect(ctx.openingStrategy.acknowledgment).toBeTruthy();
    });

    it('referral has warm tone', () => {
      const ctx = resolveEntryContext({
        leadSource: 'referral',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.openingStrategy.toneAdjustment).toContain('warm');
    });
  });

  // ---------------------------------------------------------------------------
  // Dormant reactivation
  // ---------------------------------------------------------------------------

  describe('dormant_reactivation', () => {
    it('dormant reactivation skips prior project info in qualifying', () => {
      const ctx = resolveEntryContext({
        leadSource: 'csv_import',
        isReturningLead: false,
        daysSinceLastContact: 200,
        existingProjectInfo: { projectType: 'deck', budget: '15000' },
      });
      expect(ctx.source).toBe('dormant_reactivation');
      expect(ctx.openingStrategy.skipQualifying).toContain('projectType');
      expect(ctx.openingStrategy.skipQualifying).toContain('budget');
    });

    it('dormant reactivation uses gentle tone', () => {
      const ctx = resolveEntryContext({
        leadSource: 'csv_import',
        isReturningLead: false,
        daysSinceLastContact: 365,
        existingProjectInfo: null,
      });
      expect(ctx.openingStrategy.toneAdjustment).toContain('gentle');
    });

    it('dormant reactivation has "while" in acknowledgment', () => {
      const ctx = resolveEntryContext({
        leadSource: 'csv_import',
        isReturningLead: false,
        daysSinceLastContact: 300,
        existingProjectInfo: null,
      });
      expect(ctx.openingStrategy.acknowledgment).toContain('while');
    });
  });

  // ---------------------------------------------------------------------------
  // Time of day
  // ---------------------------------------------------------------------------

  describe('timeOfDay', () => {
    it('late night adjusts tone', () => {
      // 11pm Mountain Time (UTC-6) = 05:00 UTC next day
      vi.setSystemTime(new Date('2026-04-15T05:00:00Z'));
      const ctx = resolveEntryContext({
        leadSource: null,
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
        timezone: 'America/Edmonton',
      });
      expect(ctx.timeOfDay).toBe('late_night');
    });

    it('business hours returns business_hours', () => {
      // 10am Mountain Time (UTC-6) = 16:00 UTC
      vi.setSystemTime(new Date('2026-04-14T16:00:00Z')); // Monday
      const ctx = resolveEntryContext({
        leadSource: null,
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
        timezone: 'America/Edmonton',
      });
      expect(ctx.timeOfDay).toBe('business_hours');
    });

    it('evening hours return evening', () => {
      // 7pm Mountain Time (UTC-6) = 01:00 UTC next day
      vi.setSystemTime(new Date('2026-04-15T01:00:00Z')); // Monday night → still Monday in Mountain
      const ctx = resolveEntryContext({
        leadSource: null,
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
        timezone: 'America/Edmonton',
      });
      expect(ctx.timeOfDay).toBe('evening');
    });

    it('Saturday returns weekend', () => {
      // Saturday April 18, 2026 at noon Mountain (UTC-6) = 18:00 UTC
      vi.setSystemTime(new Date('2026-04-18T18:00:00Z'));
      const ctx = resolveEntryContext({
        leadSource: null,
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
        timezone: 'America/Edmonton',
      });
      expect(ctx.timeOfDay).toBe('weekend');
    });

    it('Sunday returns weekend', () => {
      // Sunday April 19, 2026 at 10am Mountain (UTC-6) = 16:00 UTC
      vi.setSystemTime(new Date('2026-04-19T16:00:00Z'));
      const ctx = resolveEntryContext({
        leadSource: null,
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
        timezone: 'America/Edmonton',
      });
      expect(ctx.timeOfDay).toBe('weekend');
    });

    it('defaults to America/Edmonton when timezone not provided', () => {
      // This just checks that the function runs without error when timezone is omitted
      const ctx = resolveEntryContext({
        leadSource: null,
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(['business_hours', 'evening', 'weekend', 'late_night']).toContain(ctx.timeOfDay);
    });

    it('late night tone includes calm note for missed_call', () => {
      vi.setSystemTime(new Date('2026-04-15T05:00:00Z')); // 11pm Mountain
      const ctx = resolveEntryContext({
        leadSource: 'missed_call',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
        timezone: 'America/Edmonton',
      });
      expect(ctx.timeOfDay).toBe('late_night');
      expect(ctx.openingStrategy.toneAdjustment).toContain('calm');
    });
  });

  // ---------------------------------------------------------------------------
  // google_ads
  // ---------------------------------------------------------------------------

  describe('google_ads', () => {
    it('google_ads has efficient tone', () => {
      const ctx = resolveEntryContext({
        leadSource: 'google_ads',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.openingStrategy.toneAdjustment).toContain('efficient');
    });

    it('google_ads acknowledgment says thanks', () => {
      const ctx = resolveEntryContext({
        leadSource: 'google_ads',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.openingStrategy.acknowledgment).toContain('Thanks');
    });
  });

  // ---------------------------------------------------------------------------
  // homeStars
  // ---------------------------------------------------------------------------

  describe('homeStars', () => {
    it('homeStars acknowledgment references HomeStars', () => {
      const ctx = resolveEntryContext({
        leadSource: 'homeStars',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.openingStrategy.acknowledgment).toContain('HomeStars');
    });

    it('homeStars has warm tone', () => {
      const ctx = resolveEntryContext({
        leadSource: 'homeStars',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(ctx.openingStrategy.toneAdjustment).toContain('warm');
    });
  });

  // ---------------------------------------------------------------------------
  // Return value shape
  // ---------------------------------------------------------------------------

  describe('return value shape', () => {
    it('passes through isReturningLead', () => {
      const ctx = resolveEntryContext({
        leadSource: 'missed_call',
        isReturningLead: true,
        daysSinceLastContact: 5,
        existingProjectInfo: null,
      });
      expect(ctx.isReturningLead).toBe(true);
    });

    it('passes through daysSinceLastContact', () => {
      const ctx = resolveEntryContext({
        leadSource: null,
        isReturningLead: false,
        daysSinceLastContact: 42,
        existingProjectInfo: null,
      });
      expect(ctx.daysSinceLastContact).toBe(42);
    });

    it('passes through existingProjectInfo', () => {
      const info = { projectType: 'basement', size: '1200 sqft' };
      const ctx = resolveEntryContext({
        leadSource: null,
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: info,
      });
      expect(ctx.existingProjectInfo).toEqual(info);
    });

    it('openingStrategy always has required shape', () => {
      const ctx = resolveEntryContext({
        leadSource: 'some_random_source',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      });
      expect(typeof ctx.openingStrategy.acknowledgment).toBe('string');
      expect(typeof ctx.openingStrategy.toneAdjustment).toBe('string');
      expect(Array.isArray(ctx.openingStrategy.skipQualifying)).toBe(true);
      // firstQuestion can be null
      expect(
        ctx.openingStrategy.firstQuestion === null ||
          typeof ctx.openingStrategy.firstQuestion === 'string',
      ).toBe(true);
    });
  });
});
