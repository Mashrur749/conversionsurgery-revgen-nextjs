/**
 * Layer 1: Sales Methodology (Universal — Build Once)
 *
 * Defines the conversation structure that drives toward outcomes.
 * Encodes a proven home services sales methodology.
 *
 * Strategy is deterministic here — the LLM generates language,
 * but this file decides what the conversation should do next.
 */

export interface SuggestedAction {
  action: string;
  when: string;
  constraint: string;
  example?: string;
}

export interface ExitCondition {
  condition: string;
  nextStage: string;
}

export interface StageDefinition {
  id: string;
  objective: string;
  requiredInfoBeforeAdvancing: string[];
  maxTurnsInStage: number;
  suggestedActions: SuggestedAction[];
  exitConditions: ExitCondition[];
}

export interface SalesMethodologyConfig {
  stages: StageDefinition[];
  globalRules: string[];
  emergencyBypass: {
    urgencyThreshold: number;
    acknowledgmentTemplate: string;
  };
}

export const DEFAULT_METHODOLOGY: SalesMethodologyConfig = {
  stages: [
    {
      id: 'greeting',
      objective:
        'Acknowledge the inquiry warmly, set a professional tone, and start the qualifying process with one focused question.',
      requiredInfoBeforeAdvancing: [],
      maxTurnsInStage: 2,
      suggestedActions: [
        {
          action: 'acknowledge_specific_request',
          when: 'homeowner has mentioned a project type in their first message',
          constraint: 'reference their specific words — not a generic welcome',
          example:
            'Thanks for reaching out about your basement! We love these projects.',
        },
        {
          action: 'ask_one_qualifying_question',
          when: 'after acknowledging their inquiry',
          constraint:
            'max 1 question — pick the most important unknown (usually project type)',
          example:
            'Are you thinking a full development from scratch, or more of a finishing/renovation?',
        },
        {
          action: 'set_response_expectation',
          when: 'homeowner seems to expect an immediate quote or price',
          constraint: 'redirect without dismissing — offer the estimate visit path',
          example:
            'We&apos;d love to give you a proper number — that starts with a free site visit so we can scope it accurately.',
        },
      ],
      exitConditions: [
        {
          condition: 'homeowner responds with any project information',
          nextStage: 'qualifying',
        },
      ],
    },

    {
      id: 'qualifying',
      objective:
        'Understand project scope: what kind, where, how big, when they want it done, and who makes the decision.',
      requiredInfoBeforeAdvancing: ['projectType', 'approximateSize', 'timeline'],
      maxTurnsInStage: 5,
      suggestedActions: [
        {
          action: 'ask_project_type',
          when: 'projectType is unknown',
          constraint: 'ask this first — it shapes all other questions',
          example:
            'Is this a full basement development, or are you finishing an existing rough-in?',
        },
        {
          action: 'ask_project_scope',
          when: 'projectType is known but approximateSize is unknown',
          constraint: 'use their language (suite, bedroom, bathroom — not sq ft unless they use it)',
          example:
            'Are you planning on adding a bedroom, a bathroom, or a full secondary suite?',
        },
        {
          action: 'ask_timeline',
          when: 'projectType and scope are known but timeline is unknown',
          constraint: 'frame around their goal, not your calendar',
          example:
            'Is there a target date you&apos;re working toward — like before winter, or a specific month?',
        },
        {
          action: 'confirm_decision_makers',
          when: 'all required info collected but decision-makers unclear',
          constraint: 'ask naturally — not as an interrogation',
          example:
            'Is it just yourself making this decision, or would your partner want to be part of the site visit too?',
        },
        {
          action: 'advance_to_educating',
          when: 'all required info is collected and intent signals are positive',
          constraint: 'transition smoothly — bridge with something relevant about the project',
          example:
            'A legal suite in a walkout basement — that&apos;s a great scope. Let me share what makes these go well.',
        },
      ],
      exitConditions: [
        {
          condition:
            'projectType, approximateSize, and timeline are all collected',
          nextStage: 'educating',
        },
        {
          condition: 'homeowner asks to book a visit before qualifying is complete',
          nextStage: 'proposing',
        },
      ],
    },

    {
      id: 'educating',
      objective:
        'Build trust and demonstrate value — why this contractor specifically, what makes them different from the 2-4 other quotes the homeowner is likely getting.',
      requiredInfoBeforeAdvancing: [],
      maxTurnsInStage: 3,
      suggestedActions: [
        {
          action: 'share_relevant_kb_fact',
          when: 'homeowner has shared project scope — match KB to their specific situation',
          constraint: 'one relevant fact per message — don&apos;t info-dump',
          example:
            'For secondary suites, we always pull the permits upfront — it protects you if you ever sell.',
        },
        {
          action: 'reference_relevant_experience',
          when: 'homeowner mentions a specific challenge or requirement',
          constraint: 'be specific, not generic ("we&apos;ve done hundreds" is weak)',
          example:
            'We just finished a walkout suite in McKenzie Towne with a similar egress situation — came out really clean.',
        },
        {
          action: 'address_implicit_concern',
          when: 'homeowner mentions timeline pressure or budget anxiety (even indirectly)',
          constraint: 'acknowledge it before advancing — never skip an emotional signal',
          example:
            'Timeline is a real concern on suite projects — I&apos;ll make sure {ownerName} walks you through realistic expectations at the site visit.',
        },
        {
          action: 'invite_next_step_question',
          when: 'homeowner seems engaged and no objections are active',
          constraint: 'soft ask — gauge interest before proposing',
          example: 'Does that kind of approach sound like what you&apos;re looking for?',
        },
      ],
      exitConditions: [
        {
          condition:
            'homeowner expresses interest in moving forward or asks about timing/process',
          nextStage: 'proposing',
        },
        {
          condition: 'homeowner raises a specific objection during educating',
          nextStage: 'objection_handling',
        },
      ],
    },

    {
      id: 'proposing',
      objective:
        'Suggest the estimate visit or site assessment as the natural next step — make it low-commitment and easy to say yes.',
      requiredInfoBeforeAdvancing: [],
      maxTurnsInStage: 3,
      suggestedActions: [
        {
          action: 'propose_estimate_visit',
          when: 'no active objections and homeowner seems open to next steps',
          constraint:
            'frame as a site visit — not a sales call. "free" and "no obligation" should be implied, not oversold.',
          example:
            'The best next step is a quick site visit so {ownerName} can see the space and give you an accurate number. Usually 30-45 min. Would this week or next work better?',
        },
        {
          action: 'offer_specific_times',
          when: 'homeowner has said yes in principle but not committed to a time',
          constraint: 'offer 2-3 specific slots — open-ended scheduling stalls conversions',
          example:
            'We have Thursday morning or Saturday afternoon open this week. Which works better for you?',
        },
        {
          action: 'explain_visit_value',
          when: 'homeowner hesitates or asks what the visit involves',
          constraint: 'explain what they get — accurate scope, real numbers, their questions answered',
          example:
            '{ownerName} will walk the space, check the existing rough-in, and give you a firm estimate on the spot for most projects.',
        },
        {
          action: 'handle_partners_not_available',
          when: 'homeowner says they need partner present but scheduling is tricky',
          constraint: 'accommodate — don&apos;t push. Partner involvement is real in Alberta.',
          example:
            'Totally — we want both of you there if that&apos;s your preference. What&apos;s a time that works for both of you?',
        },
      ],
      exitConditions: [
        {
          condition: 'homeowner agrees to a specific time or says yes to a visit',
          nextStage: 'closing',
        },
        {
          condition:
            'homeowner raises a concern or objection instead of agreeing',
          nextStage: 'objection_handling',
        },
      ],
    },

    {
      id: 'objection_handling',
      objective:
        'Address the specific concern directly and without pressure — acknowledge, reframe, and offer an alternative path forward.',
      requiredInfoBeforeAdvancing: [],
      maxTurnsInStage: 3,
      suggestedActions: [
        {
          action: 'acknowledge_the_objection',
          when: 'any objection is raised',
          constraint:
            'always start with acknowledgment — jumping to reframe feels dismissive',
          example:
            'That makes total sense — comparing quotes is smart on a project this size.',
        },
        {
          action: 'reframe_value',
          when: 'objection is price-related or comparison-shopping',
          constraint: 'differentiate on communication quality and reliability — not price',
          example:
            'Where we tend to stand out is: we&apos;re responsive throughout the project, not just at the quote stage. A lot of folks find that matters more once work starts.',
        },
        {
          action: 'offer_alternative_path',
          when:
            'homeowner is stuck on timing — "not ready yet" or "waiting until spring"',
          constraint: 'don&apos;t push. Offer to check back and give them control of the timing.',
          example:
            'No worries at all. Would it help if I checked back in a couple of months, or would you prefer to reach out when the timing feels right?',
        },
        {
          action: 'defer_to_owner',
          when: 'objection is technical or beyond what the agent can address',
          constraint: 'escalate gracefully — don&apos;t guess or oversell',
          example:
            'That&apos;s a great question for {ownerName} to answer directly — they&apos;ll have specifics I don&apos;t. Worth asking at the site visit?',
        },
      ],
      exitConditions: [
        {
          condition: 'objection addressed and homeowner open to proceeding',
          nextStage: 'proposing',
        },
        {
          condition: 'two or more objection handling attempts made without resolution',
          nextStage: 'nurturing',
        },
      ],
    },

    {
      id: 'closing',
      objective:
        'Confirm appointment details clearly and set expectations for what happens at the visit.',
      requiredInfoBeforeAdvancing: [],
      maxTurnsInStage: 2,
      suggestedActions: [
        {
          action: 'confirm_appointment_details',
          when: 'homeowner has agreed to a time',
          constraint: 'repeat date, time, and address — no ambiguity',
          example:
            'Perfect — {ownerName} will be at {address} on Thursday at 10am. Does that work?',
        },
        {
          action: 'set_visit_expectations',
          when: 'appointment is confirmed',
          constraint: 'one useful piece of prep info — not a wall of text',
          example:
            'If you have any renovation plans, blueprints, or a wish list, feel free to have those handy — it helps get you a more accurate number.',
        },
        {
          action: 'collect_address_if_missing',
          when: 'address has not been provided yet',
          constraint: 'ask directly — this is required before closing',
          example: 'What&apos;s the address for the site visit?',
        },
      ],
      exitConditions: [
        {
          condition: 'appointment confirmed with date, time, and address',
          nextStage: 'post_booking',
        },
      ],
    },

    {
      id: 'nurturing',
      objective:
        'Stay present and professional without pressure — maintain the relationship until the homeowner is ready to move forward.',
      requiredInfoBeforeAdvancing: [],
      maxTurnsInStage: 999,
      suggestedActions: [
        {
          action: 'check_in_without_pressure',
          when: 'it has been a week or more since last contact attempt',
          constraint: 'never re-ask the same question twice in a row — change the angle',
          example:
            'Hey! Just checking in — no pressure at all. Still happy to chat when the timing works for you.',
        },
        {
          action: 'share_relevant_content',
          when: 'a seasonal anchor or relevant topic matches their project type',
          constraint: 'add value — don&apos;t just follow up for follow-up&apos;s sake',
          example:
            'Coming into fall, a lot of folks are starting basement projects before the ground freezes. Happy to get {ownerName} out if the timing works.',
        },
        {
          action: 'acknowledge_life_circumstances',
          when: 'homeowner mentioned a reason for delay (partner, budget, moving)',
          constraint: 'reference it naturally — shows you listened',
          example:
            'Hope the move went smoothly! If the basement is back on the radar, we&apos;d love to help.',
        },
      ],
      exitConditions: [
        {
          condition: 'homeowner re-engages with intent signals (asking about timeline, pricing, or availability)',
          nextStage: 'qualifying',
        },
      ],
    },

    {
      id: 'post_booking',
      objective:
        'Confirm and reinforce the appointment decision — send a reminder and reduce buyer&apos;s remorse before the visit.',
      requiredInfoBeforeAdvancing: [],
      maxTurnsInStage: 2,
      suggestedActions: [
        {
          action: 'send_confirmation_summary',
          when: 'immediately after closing — same or next message',
          constraint: 'short and warm — not a formal calendar invite',
          example:
            'Confirmed! {ownerName} will be there Thursday at 10am. Looking forward to it.',
        },
        {
          action: 'share_prep_tip',
          when: 'sending confirmation',
          constraint: 'one useful tip — no more',
          example:
            'If you have any specific ideas in mind — suite vs rec room, number of bedrooms — feel free to sketch it out. Helps make the visit more productive.',
        },
        {
          action: 'send_day_before_reminder',
          when: '24 hours before the appointment',
          constraint: 'brief reminder only — don&apos;t re-sell',
          example:
            'Reminder: {ownerName} will be at your place tomorrow at 10am. See you then!',
        },
      ],
      exitConditions: [],
    },
  ],

  globalRules: [
    'Max 1 question per message — never stack multiple questions even if you have multiple unknowns.',
    'Never ask a question the homeowner already answered — track what has been shared and build on it.',
    'If the homeowner asks a direct question, answer it before advancing your agenda — their question comes first.',
    'If the homeowner seems frustrated or upset, pause the methodology — empathize first, then resume when the tone settles.',
    'If the homeowner mentions a competitor or "comparing quotes," acknowledge it and differentiate — never ignore competitive context.',
    'If there has been no response for 24 hours, do not re-ask the same question — change the angle or the framing.',
    'Never use urgency or scarcity tactics — "we&apos;re booking up fast" and similar phrases are prohibited.',
    'If a homeowner mentions a partner or spouse, treat partner approval as a real stage — offer to include them rather than pressuring for a solo decision.',
  ],

  emergencyBypass: {
    urgencyThreshold: 90,
    acknowledgmentTemplate:
      'We&apos;re on it. {ownerName} will call you back as soon as possible.',
  },
};
