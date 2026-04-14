/**
 * Layer 3: Basement Development Industry Playbook
 *
 * Trade-specific expertise for Calgary basement renovation conversations.
 * Makes the agent an expert at converting basement development inquiries
 * into booked estimate visits.
 *
 * Primary ICP: Calgary basement development contractors
 * Avg project: $50-120K (legal suites: $80-120K)
 */

export interface PlaybookConfig {
  playbookId: string;
  name: string;
  vocabularyMapping: Array<{
    homeownerTerm: string;
    contractorTerm: string;
    context?: string;
  }>;
  projectSizingHeuristics: {
    scopeIndicators: Array<{
      signal: string;
      impliedScope: 'small' | 'medium' | 'large' | 'complex';
      impliedTimeline: string;
      qualifyingQuestions: string[];
    }>;
  };
  objectionPatterns: Array<{
    category: string;
    typicalPhrasing: string[];
    handlingStrategy: string;
    neverSay: string[];
  }>;
  conversionDynamics: {
    typicalSalesCycle: string;
    decisionMakers: string;
    competitorCount: string;
    highValueSignals: string[];
    lowValueSignals: string[];
    optimalFollowUpCadence: string;
  };
  communicationStyle: {
    purchaseType: 'emergency' | 'routine' | 'considered' | 'luxury';
    informationDensity: 'high' | 'medium' | 'low';
    emotionalRegister: string;
    expertiseDisplay: 'subtle' | 'direct';
  };
  qualifyingSequence: Array<{
    question: string;
    whyItMatters: string;
    ifAnswered: string;
  }>;
  emergencySignals: {
    keywords: string[];
    urgencyFloor: number;
  };
  differentiators: string[];
  exampleConversations: Array<{
    scenario: string;
    turns: Array<{ role: 'homeowner' | 'agent'; message: string }>;
    annotations: string[];
  }>;
}

export const BASEMENT_DEVELOPMENT_PLAYBOOK: PlaybookConfig = {
  playbookId: 'basement_development',
  name: 'Basement Development & Finishing',

  // ─────────────────────────────────────────────────────────────────────────
  // Vocabulary Mapping
  // Extends trade-synonyms.ts patterns with conversation-level intent context.
  // Helps the agent understand what homeowners mean when they use lay terms.
  // ─────────────────────────────────────────────────────────────────────────
  vocabularyMapping: [
    {
      homeownerTerm: 'finish my basement',
      contractorTerm: 'basement finishing/development',
      context: 'Homeowner may not know the scope — could be cosmetic finishing or full development',
    },
    {
      homeownerTerm: 'legal suite',
      contractorTerm: 'secondary suite development',
      context: 'High-value project ($80-120K). Requires permits, separate entrance, egress windows, kitchen rough-in. Always confirm permit intent.',
    },
    {
      homeownerTerm: 'secondary suite',
      contractorTerm: 'secondary suite development',
      context: 'Same as legal suite — preferred Calgary terminology. Triggers high-value qualification path.',
    },
    {
      homeownerTerm: 'in-law suite',
      contractorTerm: 'secondary suite development',
      context: 'Homeowner may not know the legal/permit implications. Educate on secondary suite requirements.',
    },
    {
      homeownerTerm: 'basement apartment',
      contractorTerm: 'secondary suite development',
      context: 'Implies rental intent — high motivation, financially driven buyer. Ask about timeline and budget.',
    },
    {
      homeownerTerm: 'walkout basement',
      contractorTerm: 'walkout development',
      context: 'Existing ground-level access. Affects scope significantly — natural light, easier egress, potentially easier suite conversion.',
    },
    {
      homeownerTerm: 'underpinning',
      contractorTerm: 'foundation lowering',
      context: 'Signals a ceiling height issue. Complex project requiring structural engineering. Flag for large/complex scope.',
    },
    {
      homeownerTerm: 'dig out the basement',
      contractorTerm: 'foundation lowering / basement excavation',
      context: 'Same as underpinning — highly complex, multi-trade project. Confirm before scoping.',
    },
    {
      homeownerTerm: 'rough-in',
      contractorTerm: 'mechanical rough-in (plumbing/electrical/HVAC)',
      context: 'Homeowner is aware of infrastructure — likely more informed buyer. Ask what they already have roughed in.',
    },
    {
      homeownerTerm: 'framing',
      contractorTerm: 'wall framing and partition layout',
      context: 'Homeowner may want framing-only or understand the full scope starts here.',
    },
    {
      homeownerTerm: 'just drywall and paint',
      contractorTerm: 'cosmetic finishing only',
      context: 'Smaller scope. Confirm if framing and mechanical are already done. May still need permits.',
    },
    {
      homeownerTerm: 'egress window',
      contractorTerm: 'egress window installation',
      context: 'Required for habitable bedrooms in Alberta. Signals bedroom/suite intent. Code-required.',
    },
    {
      homeownerTerm: 'cold storage',
      contractorTerm: 'cold storage room / unfinished utility space',
      context: 'Homeowner may want to keep or remove. Affects usable square footage.',
    },
    {
      homeownerTerm: 'bar downstairs',
      contractorTerm: 'wet bar / basement bar installation',
      context: 'Common add-on. Not a suite — recreational development. Mid-size scope.',
    },
    {
      homeownerTerm: 'put a bathroom down there',
      contractorTerm: 'bathroom addition — basement',
      context: 'Requires plumbing rough-in or new rough-in. Confirms wet trade involvement. Ask if rough-in exists.',
    },
    {
      homeownerTerm: 'media room',
      contractorTerm: 'home theatre / media room development',
      context: 'Common scope item. Usually part of a full development. Ask if they want the whole basement done.',
    },
    {
      homeownerTerm: 'open concept',
      contractorTerm: 'open-plan basement layout',
      context: 'Affects partition layout. Usually simpler scope unless suite is involved.',
    },
    {
      homeownerTerm: 'permits',
      contractorTerm: 'development permit / building permit',
      context: 'Serious buyer signal. All habitable basement space in Calgary requires permits. Confirm contractor handles this.',
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Project Sizing Heuristics
  // Scope classification from conversation signals — NOT price ranges.
  // Price ranges live in per-client KB.
  // ─────────────────────────────────────────────────────────────────────────
  projectSizingHeuristics: {
    scopeIndicators: [
      {
        signal: 'mentions secondary suite, legal suite, or basement apartment',
        impliedScope: 'complex',
        impliedTimeline: '8-12 weeks',
        qualifyingQuestions: [
          'Are you looking to have it permitted as a legal secondary suite?',
          'Does the space have a separate entrance, or is that part of the project?',
          'Do you already have a bathroom rough-in down there?',
        ],
      },
      {
        signal: 'mentions underpinning, digging out, or wants to raise ceiling height',
        impliedScope: 'complex',
        impliedTimeline: '12-20 weeks',
        qualifyingQuestions: [
          'What is the current ceiling height in the basement?',
          'Have you had a structural engineer look at it yet?',
        ],
      },
      {
        signal: 'just drywall and paint, basic finishing, or framing already done',
        impliedScope: 'small',
        impliedTimeline: '2-4 weeks',
        qualifyingQuestions: [
          'Is the framing and mechanical rough-in already completed?',
          'What square footage are we working with?',
        ],
      },
      {
        signal: 'full development or full basement finishing from scratch',
        impliedScope: 'large',
        impliedTimeline: '6-10 weeks',
        qualifyingQuestions: [
          'What rooms are you thinking — bedrooms, bathroom, living area?',
          'What is the approximate square footage of the basement?',
          'Do you have any existing rough-ins we would be working around?',
        ],
      },
      {
        signal: 'walkout basement development',
        impliedScope: 'large',
        impliedTimeline: '4-8 weeks',
        qualifyingQuestions: [
          'Are you planning to include a suite, or is it for personal use?',
          'Does the walkout level already have windows and an entrance?',
        ],
      },
      {
        signal: 'just a bathroom down there, or only a bathroom',
        impliedScope: 'medium',
        impliedTimeline: '3-5 weeks',
        qualifyingQuestions: [
          'Is there already a rough-in for the plumbing, or would that need to be added?',
          'Is this part of a larger basement project or just the bathroom?',
        ],
      },
      {
        signal: 'bedroom or extra bedroom in the basement',
        impliedScope: 'medium',
        impliedTimeline: '3-6 weeks',
        qualifyingQuestions: [
          'Alberta code requires an egress window for a habitable bedroom — is there one there now?',
          'Is this just the bedroom or are you thinking about the whole basement?',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Objection Patterns
  // Common objection categories in basement renovation — how they surface and how to handle them.
  // Specific answers live in the per-client KB (warranties, pricing, reviews).
  // ─────────────────────────────────────────────────────────────────────────
  objectionPatterns: [
    {
      category: 'price_comparison',
      typicalPhrasing: [
        "I got a cheaper quote from another company",
        "Someone else quoted us less",
        "We're comparing prices",
        "You're more expensive than the other guys",
        "Can you match their price?",
      ],
      handlingStrategy:
        "Acknowledge without apology — don't compete on price. Reframe on the 20-year investment in home value and livable space. Differentiate on communication, permits handled, and what happens when issues arise mid-project. Ask what the other quote included to surface scope differences.",
      neverSay: [
        "We can match that price",
        "They're probably cutting corners",
        "Our price is non-negotiable",
        "That quote is probably wrong",
      ],
    },
    {
      category: 'timeline_concern',
      typicalPhrasing: [
        "That takes too long",
        "I need it done faster",
        "We need it done before [date]",
        "How long does it really take?",
        "Can you speed it up?",
      ],
      handlingStrategy:
        "Acknowledge the timeline need — it's real. Explain what drives the schedule (permits, inspections, trades sequencing) so they understand it's not arbitrary. Offer to look at the schedule once we know the full scope. If genuinely urgent, offer a phased approach where they can use part of the space sooner.",
      neverSay: [
        "We can get it done in half the time",
        "It depends on a lot of things",
        "That's just how long it takes",
        "Other clients have waited longer",
      ],
    },
    {
      category: 'partner_approval',
      typicalPhrasing: [
        "I need to check with my wife/husband",
        "I have to talk to my spouse",
        "My partner hasn't seen the quote yet",
        "We haven't decided together yet",
        "She/he wants to get more quotes first",
      ],
      handlingStrategy:
        "This is genuine 70% of the time for basement projects — it's a couple's decision. Acknowledge it as the right approach. Offer to include the partner: send a detailed write-up they can review together, or offer a second call/meeting that works for both. Don't push for a solo decision.",
      neverSay: [
        "Can't you just decide?",
        "How long will that take?",
        "I really need an answer soon",
        "Most people decide within a day or two",
      ],
    },
    {
      category: 'trust_deficit',
      typicalPhrasing: [
        "How do I know you're legit?",
        "Are you licensed?",
        "Do you have insurance?",
        "I've heard horror stories about basement contractors",
        "What happens if something goes wrong?",
      ],
      handlingStrategy:
        "Take this seriously — the fear is valid, bad basement contractors exist. Reference permits and inspections as built-in accountability. Mention insurance and warranty clearly. Offer to share reviews or connect them with a past client. The permit process means the city independently verifies the work.",
      neverSay: [
        "Of course we're legit",
        "Don't worry about that",
        "Everyone asks that",
        "We've never had a problem",
      ],
    },
    {
      category: 'scope_uncertainty',
      typicalPhrasing: [
        "I'm not sure exactly what I want",
        "We haven't figured out the layout",
        "I have some ideas but nothing concrete",
        "We're still in the planning stages",
        "Not sure if we want a suite or just a rec room",
      ],
      handlingStrategy:
        "Normalize it — most homeowners don't have a firm plan at this stage, and that's exactly what the site visit is for. Position the estimate visit as a planning session, not a sales call. The contractor will walk the space with them and help figure out what makes sense.",
      neverSay: [
        "I need more details before I can help",
        "Come back when you know what you want",
        "We'll need plans before we can quote",
        "That's hard to price without a spec",
      ],
    },
    {
      category: 'bad_timing',
      typicalPhrasing: [
        "We're not ready to start yet",
        "Maybe in a few months",
        "We're waiting until spring",
        "We just started thinking about it",
        "Budget isn't there yet",
      ],
      handlingStrategy:
        "Acknowledge without pressure. Basement work is year-round in Calgary — there's no bad time. Offer to stay in touch and reach out closer to their timeline. If the hesitation is budget, offer the site visit as a no-pressure way to understand costs before committing. Follow the nurturing cadence.",
      neverSay: [
        "Our schedule fills up fast",
        "Now is the best time to start",
        "You should lock in your spot now",
        "Prices go up every year",
      ],
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Conversion Dynamics
  // How basement buyers make decisions — shapes follow-up cadence and strategy.
  // ─────────────────────────────────────────────────────────────────────────
  conversionDynamics: {
    typicalSalesCycle: '2-4 weeks from inquiry to booked estimate',
    decisionMakers:
      'Usually a couple. One partner often drives the inquiry, the other approves the budget. The absent partner is rarely a stall — assume they are a real decision-maker.',
    competitorCount: 'Homeowners typically get 2-4 quotes for a project this size.',
    highValueSignals: [
      'mentions legal suite or secondary suite',
      'asks about permits or city requirements',
      'mentions a specific timeline or deadline',
      'asks about warranty or what happens if something goes wrong',
      'says they are ready to start soon or this spring/summer',
      'asks about the process in detail — what happens at each stage',
      'references a budget range unprompted',
    ],
    lowValueSignals: [
      'says "just getting an idea of cost" without project details',
      'contact says "my landlord wants" — not the decision-maker',
      'asks only about price without describing any scope',
      'says "we might do it ourselves" — likely comparison shopping or price anchoring',
      'no response to two follow-ups',
    ],
    optimalFollowUpCadence: 'Day 2, Day 5, Day 10 — not more aggressive. Change message angle each time; do not re-ask the same question.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Communication Style
  // How the agent should present itself in basement renovation conversations.
  // ─────────────────────────────────────────────────────────────────────────
  communicationStyle: {
    purchaseType: 'considered',
    informationDensity: 'medium',
    emotionalRegister:
      'Reassuring — this is a big financial decision for most people. The homeowner wants to feel informed and heard, not sold to. Lead with curiosity and education, not urgency or pressure.',
    expertiseDisplay: 'subtle',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Qualifying Sequence
  // Trade-specific questions in priority order.
  // Ask one per message — never stack questions.
  // ─────────────────────────────────────────────────────────────────────────
  qualifyingSequence: [
    {
      question: 'What kind of project are you thinking about — full development, finishing work, or a secondary suite?',
      whyItMatters:
        'Determines the scope tier immediately. Full development vs. finishing vs. suite are dramatically different in complexity, timeline, and price. This one answer shapes every subsequent message.',
      ifAnswered:
        'Map to scope indicator. If suite → complex path. If finishing only → confirm framing/mechanical status. If full development → proceed to size question.',
    },
    {
      question: 'What is the approximate square footage of the basement?',
      whyItMatters:
        'The single biggest driver of price and timeline after project type. 800 sq ft vs 1,600 sq ft is a different project entirely. Also helps confirm if they have a realistic expectation.',
      ifAnswered:
        'Store for estimate prep. If they say they do not know, suggest they measure roughly (width × length) — it shows investment in the conversation.',
    },
    {
      question: 'Do you have a timeline in mind — when would you like to have it done?',
      whyItMatters:
        'Urgency signal. "Before Christmas" or "before school starts" creates a natural constraint that motivates booking. Also screens out "just exploring" leads who have no timeline.',
      ifAnswered:
        'If tight timeline → flag for urgent scheduling. If open timeline → stay warm, follow nurturing cadence. Either way, use it to frame the estimate visit.',
    },
    {
      question: 'Is it a walkout, or does the basement have windows on any side?',
      whyItMatters:
        'Walkouts significantly affect scope — natural light, easier egress compliance, sometimes separate entrance already exists. Also impacts suite viability.',
      ifAnswered:
        'If walkout + suite intent → high-value project. If standard below-grade → ask about egress windows if bedroom is planned.',
    },
    {
      question: 'Are you thinking about having it permitted as a legal secondary suite?',
      whyItMatters:
        'The single highest-value signal in basement development. Permitted suites require more work but also generate rental income — buyers are highly motivated. Confirms serious intent.',
      ifAnswered:
        'If yes → complex scope, 8-12 weeks, high-value lead. Prioritize estimate booking. If no → proceed with standard development qualifying.',
    },
    {
      question: 'Is it just you making this call, or does your partner want to be part of the conversation?',
      whyItMatters:
        'Identifies the real decision-making unit. Basement projects almost always involve both partners. Getting the absent partner into the estimate visit prevents late-stage stalls.',
      ifAnswered:
        'If partner is involved → offer to send a summary they can review together, or suggest a time that works for both. Never pressure a solo decision on a project this size.',
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Emergency Signals
  // Water-related incidents trigger immediate escalation regardless of stage.
  // ─────────────────────────────────────────────────────────────────────────
  emergencySignals: {
    keywords: [
      'flooding',
      'flood',
      'water damage',
      'sewage',
      'sewage backup',
      'burst pipe',
      'burst pipes',
      'leak',
      'water in basement',
      'water coming in',
      'sump pump failed',
      'sump pump failure',
      'standing water',
      'wet basement',
      'mold',
      'mould',
    ],
    urgencyFloor: 90,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Differentiators
  // Strategic positioning statements for the agent to use when differentiating.
  // The agent selects contextually — not all in one message.
  // ─────────────────────────────────────────────────────────────────────────
  differentiators: [
    'You&rsquo;re texting with us right now — how fast did the other companies respond?',
    'We send a detailed, line-by-line estimate — not just a lump sum number',
    'We stay in touch at every stage — you won&rsquo;t be left wondering what&rsquo;s happening next',
    'Every project gets a dedicated point of contact from start to finish',
    'We handle all permits and inspections — you don&rsquo;t have to chase the city',
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Example Conversations
  // Few-shot examples of excellent basement development conversations.
  // Used as context in the respond node prompt.
  // ─────────────────────────────────────────────────────────────────────────
  exampleConversations: [
    {
      scenario: 'Smooth qualifying leading to estimate booking — homeowner knows what they want',
      turns: [
        {
          role: 'homeowner',
          message: 'Hi, I saw your Google ad. We want to finish our basement. It&rsquo;s about 1,000 sq ft.',
        },
        {
          role: 'agent',
          message:
            'Hey! Thanks for reaching out. 1,000 sq ft is a solid space — lots of potential. Are you thinking full development (bedrooms, bathroom, living area) or more of a finishing job where the framing is already done?',
        },
        {
          role: 'homeowner',
          message: 'Full development. Nothing is done down there. We want 2 bedrooms, a bathroom, and a family room.',
        },
        {
          role: 'agent',
          message:
            'That&rsquo;s a great layout for that size. Do you have a timeline in mind — is there a date you&rsquo;re hoping to have it done by?',
        },
      ],
      annotations: [
        'Agent acknowledged their specific info (1,000 sq ft) before asking anything',
        'First question clarified scope tier — full development vs finishing. Critical fork.',
        'Second question targeted timeline — creates urgency framing for the estimate visit',
        'No mention of price, no selling — purely qualifying to understand their situation',
        'One question per message — SMS constraint respected',
      ],
    },
    {
      scenario: 'Price objection after estimate sent — homeowner received a cheaper quote',
      turns: [
        {
          role: 'homeowner',
          message: 'We got another quote that came in quite a bit lower than yours. Still thinking about it.',
        },
        {
          role: 'agent',
          message:
            "That's a fair thing to consider — this is a big project. One thing worth checking: did the other quote include permits and inspections, or are those separate? That&rsquo;s often where the difference shows up.",
        },
        {
          role: 'homeowner',
          message: "I'm not sure actually. I'd have to look at it again.",
        },
        {
          role: 'agent',
          message:
            "Worth a look. Our quote includes all permits, two inspections, and a 2-year warranty on workmanship. If those are add-ons on the other side, the numbers get closer. Happy to walk you through ours line by line if that helps.",
        },
      ],
      annotations: [
        'Agent did not apologize for the price or offer a discount',
        'First response asked a diagnostic question — surfaces real scope differences rather than arguing',
        'Second response named specific inclusions (permits, inspections, warranty) without claiming the other quote is wrong',
        'Offered a line-by-line walkthrough — transparency as a differentiator, not defensiveness',
        'Never said "we can match it" or implied the competitor was cutting corners',
      ],
    },
  ],
};
