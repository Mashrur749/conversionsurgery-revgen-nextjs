import { describe, it, expect } from 'vitest';
import { CA_AB_LOCALE } from './ca-ab';

describe('CA_AB_LOCALE', () => {
  describe('identity fields', () => {
    it('has localeId ca-ab', () => {
      expect(CA_AB_LOCALE.localeId).toBe('ca-ab');
    });

    it('has name set', () => {
      expect(CA_AB_LOCALE.name).toBeTruthy();
    });

    it('language is en-CA', () => {
      expect(CA_AB_LOCALE.language).toBe('en-CA');
    });

    it('timezone is America/Edmonton', () => {
      expect(CA_AB_LOCALE.timezone).toBe('America/Edmonton');
    });
  });

  describe('communicationNorms', () => {
    it('directness is low', () => {
      expect(CA_AB_LOCALE.communicationNorms.directness).toBe('low');
    });

    it('apologeticTone is true', () => {
      expect(CA_AB_LOCALE.communicationNorms.apologeticTone).toBe(true);
    });

    it('formalityDefault is friendly', () => {
      expect(CA_AB_LOCALE.communicationNorms.formalityDefault).toBe('friendly');
    });

    it('greetingStyle is populated', () => {
      expect(CA_AB_LOCALE.communicationNorms.greetingStyle).toBeTruthy();
    });

    it('closingStyle is populated', () => {
      expect(CA_AB_LOCALE.communicationNorms.closingStyle).toBeTruthy();
    });

    it('commonExpressions has at least 4 entries', () => {
      expect(
        CA_AB_LOCALE.communicationNorms.commonExpressions.length,
      ).toBeGreaterThanOrEqual(4);
    });

    it('avoidExpressions has at least 3 entries', () => {
      expect(
        CA_AB_LOCALE.communicationNorms.avoidExpressions.length,
      ).toBeGreaterThanOrEqual(3);
    });
  });

  describe('regulatoryContext', () => {
    it('consentFramework is CASL', () => {
      expect(CA_AB_LOCALE.regulatoryContext.consentFramework).toBe('CASL');
    });

    it('quietHoursRule references CRTC', () => {
      expect(CA_AB_LOCALE.regulatoryContext.quietHoursRule).toContain('CRTC');
    });

    it('quietHoursRule specifies 9pm start', () => {
      expect(CA_AB_LOCALE.regulatoryContext.quietHoursRule).toContain('9pm');
    });

    it('businessIdentificationRequired is true', () => {
      expect(
        CA_AB_LOCALE.regulatoryContext.businessIdentificationRequired,
      ).toBe(true);
    });

    it('consentLanguage is populated', () => {
      expect(CA_AB_LOCALE.regulatoryContext.consentLanguage).toBeTruthy();
    });
  });

  describe('culturalReferences', () => {
    it('seasonalAnchors has winter defined', () => {
      expect(CA_AB_LOCALE.culturalReferences.seasonalAnchors['winter']).toBeTruthy();
    });

    it('seasonalAnchors has summer defined', () => {
      expect(CA_AB_LOCALE.culturalReferences.seasonalAnchors['summer']).toBeTruthy();
    });

    it('seasonalAnchors has construction season defined', () => {
      expect(
        CA_AB_LOCALE.culturalReferences.seasonalAnchors['construction season'],
      ).toBeTruthy();
    });

    it('trustAnchors includes HomeStars', () => {
      expect(CA_AB_LOCALE.culturalReferences.trustAnchors).toContain(
        'HomeStars',
      );
    });

    it('trustAnchors includes Google Reviews', () => {
      expect(CA_AB_LOCALE.culturalReferences.trustAnchors).toContain(
        'Google Reviews',
      );
    });

    it('localTerminology maps ADU to legal suite', () => {
      expect(CA_AB_LOCALE.culturalReferences.localTerminology['ADU']).toBe(
        'legal suite',
      );
    });

    it('localTerminology maps basement apartment to secondary suite', () => {
      expect(
        CA_AB_LOCALE.culturalReferences.localTerminology['basement apartment'],
      ).toBe('secondary suite');
    });
  });

  describe('buyingPsychology', () => {
    it('priceDiscussionStyle is populated', () => {
      expect(CA_AB_LOCALE.buyingPsychology.priceDiscussionStyle).toBeTruthy();
    });

    it('priceDiscussionStyle references indirect approach', () => {
      expect(
        CA_AB_LOCALE.buyingPsychology.priceDiscussionStyle.toLowerCase(),
      ).toContain('indirect');
    });

    it('comparisonShoppingNorm is populated', () => {
      expect(CA_AB_LOCALE.buyingPsychology.comparisonShoppingNorm).toBeTruthy();
    });

    it('decisionTimeline is populated', () => {
      expect(CA_AB_LOCALE.buyingPsychology.decisionTimeline).toBeTruthy();
    });

    it('trustBuildingPriority has at least 3 entries', () => {
      expect(
        CA_AB_LOCALE.buyingPsychology.trustBuildingPriority.length,
      ).toBeGreaterThanOrEqual(3);
    });
  });
});
