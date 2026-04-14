/**
 * Layer 2: Locale Context — Canadian Alberta (ca-ab)
 *
 * Cultural and regulatory context that shapes communication norms.
 * This is the only locale needed at launch (Calgary/Edmonton ICP).
 */

export interface LocaleConfig {
  localeId: string;
  name: string;
  language: string;
  timezone: string;
  communicationNorms: {
    directness: 'low' | 'medium' | 'high';
    apologeticTone: boolean;
    formalityDefault: 'casual' | 'friendly' | 'professional';
    greetingStyle: string;
    closingStyle: string;
    commonExpressions: string[];
    avoidExpressions: string[];
  };
  regulatoryContext: {
    consentFramework: string;
    quietHoursRule: string;
    businessIdentificationRequired: boolean;
    consentLanguage: string;
  };
  culturalReferences: {
    seasonalAnchors: Record<string, string>;
    trustAnchors: string[];
    localTerminology: Record<string, string>;
  };
  buyingPsychology: {
    priceDiscussionStyle: string;
    comparisonShoppingNorm: string;
    decisionTimeline: string;
    trustBuildingPriority: string[];
  };
}

export const CA_AB_LOCALE: LocaleConfig = {
  localeId: 'ca-ab',
  name: 'Canadian — Alberta',
  language: 'en-CA',
  timezone: 'America/Edmonton',

  communicationNorms: {
    directness: 'low',
    apologeticTone: true,
    formalityDefault: 'friendly',
    greetingStyle: 'Hey! or Hi there!',
    closingStyle: 'Thanks! or Talk soon!',
    commonExpressions: [
      'no worries',
      'sounds good',
      'for sure',
      'perfect',
      'awesome',
      'totally',
      'sorry about the wait',
      'no worries if the timing does not work',
    ],
    avoidExpressions: [
      "y'all",
      "fixin' to",
      'reckon',
      'howdy',
      'y&apos;all',
      'gonna need ya to',
      'real quick',
    ],
  },

  regulatoryContext: {
    consentFramework: 'CASL',
    quietHoursRule: 'CRTC 9pm-10am',
    businessIdentificationRequired: true,
    consentLanguage:
      'By texting back, you consent to receive follow-up messages from {businessName}. Reply STOP to opt out at any time.',
  },

  culturalReferences: {
    seasonalAnchors: {
      winter: 'October-April',
      summer: 'May-September',
      'construction season': 'April-November',
      'permit slowdown': 'December-January',
      'before winter': 'by late September / early October',
      spring: 'April-May',
    },
    trustAnchors: [
      'HomeStars',
      'Google Reviews',
      'BBB',
      'BILD Calgary',
      'referrals from neighbours',
    ],
    localTerminology: {
      'basement apartment': 'secondary suite',
      ADU: 'legal suite',
      'in-law suite': 'secondary suite',
      'granny flat': 'secondary suite',
      'accessory dwelling unit': 'legal suite',
      'mother-in-law suite': 'secondary suite',
      apartment: 'suite',
      'finished basement': 'developed basement',
    },
  },

  buyingPsychology: {
    priceDiscussionStyle:
      'indirect — Canadians avoid direct price talk early in the process; prefer to frame cost as investment',
    comparisonShoppingNorm:
      "polite — 'looking at a few options' or 'getting a couple quotes' is standard and should be acknowledged without challenge",
    decisionTimeline:
      'takes time, often involves partner discussion — "I need to talk to my husband/wife" is a genuine step, not a stall tactic',
    trustBuildingPriority: [
      'HomeStars and Google Reviews',
      'neighbour or friend referrals',
      'years of local experience',
      'licensing and permits',
      'communication quality',
    ],
  },
};
