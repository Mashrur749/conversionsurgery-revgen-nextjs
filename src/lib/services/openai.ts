import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

interface AIResult {
  response: string;
  confidence: number;
  shouldEscalate: boolean;
  escalationReason?: string;
}

// Phrases that ALWAYS trigger escalation
const ESCALATION_TRIGGERS = [
  // Pricing
  'price', 'pricing', 'cost', 'how much', 'quote', 'estimate',
  // Complaints
  'complaint', 'upset', 'frustrated', 'angry', 'unhappy', 'terrible', 'awful',
  // Human request
  'call me', 'speak to someone', 'talk to', 'human', 'person', 'owner',
  // High intent
  'ready to book', 'let\'s do it', 'move forward', 'schedule', 'when can you start',
  // Changes
  'reschedule', 'cancel', 'change',
];

export async function generateAIResponse(
  incomingMessage: string,
  businessName: string,
  ownerName: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
): Promise<AIResult> {

  // Check for immediate escalation triggers
  const lowerMessage = incomingMessage.toLowerCase();
  for (const trigger of ESCALATION_TRIGGERS) {
    if (lowerMessage.includes(trigger)) {
      return {
        response: '',
        confidence: 1,
        shouldEscalate: true,
        escalationReason: `Contains trigger phrase: "${trigger}"`,
      };
    }
  }

  // Check for too many back-and-forths
  if (conversationHistory.length >= 6) {
    return {
      response: '',
      confidence: 1,
      shouldEscalate: true,
      escalationReason: 'Extended conversation (3+ exchanges)',
    };
  }

  const systemPrompt = `You are a helpful text assistant for ${businessName}, a remodeling contractor.

Your role is to:
- Acknowledge inquiries warmly
- Gather basic information (project type, address, timeline)
- Keep conversations moving toward scheduling an estimate

You must NEVER:
- Provide pricing or quotes (say "I'll have ${ownerName} get back to you with pricing details")
- Make promises about timelines or availability
- Handle complaints (say "${ownerName} will reach out to discuss this personally")
- Schedule appointments (say "Let me have ${ownerName} reach out to find a time that works")

Keep responses SHORT (1-3 sentences max). Sound like a real text message, not a corporate bot.
Ask ONE question at a time to keep the conversation going.
Be friendly but professional.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-10), // Last 10 messages
        { role: 'user', content: incomingMessage },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || '';

    // Confidence based on response quality
    let confidence = 0.85;

    // Lower confidence if response is too short or too long
    if (response.length < 20 || response.length > 320) {
      confidence = 0.6;
    }

    // Lower confidence if response seems uncertain
    const uncertainPhrases = ['i\'m not sure', 'i don\'t know', 'maybe', 'perhaps'];
    if (uncertainPhrases.some(phrase => response.toLowerCase().includes(phrase))) {
      confidence = 0.5;
    }

    return {
      response,
      confidence,
      shouldEscalate: confidence < 0.7,
      escalationReason: confidence < 0.7 ? 'Low AI confidence' : undefined,
    };
  } catch (error) {
    console.error('OpenAI error:', error);
    return {
      response: '',
      confidence: 0,
      shouldEscalate: true,
      escalationReason: 'AI generation failed',
    };
  }
}
