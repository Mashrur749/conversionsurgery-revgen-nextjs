import { getAIProvider } from '@/lib/ai';

export interface DetectedSignals {
  readyToSchedule: boolean;
  wantsEstimate: boolean;
  jobComplete: boolean;
  satisfied: boolean;
  frustrated: boolean;
  priceObjection: boolean;
  urgentNeed: boolean;
  justBrowsing: boolean;
  referralMention: boolean;
  paymentMention: boolean;
  confidence: number;
  rawSignals: string[];
}

const SIGNAL_PROMPT = `Analyze this conversation and detect customer signals. Return JSON only.

Signals to detect:
- readyToSchedule: Customer wants to book/schedule (e.g., "when can you come", "I'm available Tuesday")
- wantsEstimate: Customer wants a quote/estimate (e.g., "how much would it cost", "can you send pricing")
- jobComplete: References completed work (e.g., "the job looks great", "you guys finished")
- satisfied: Expresses satisfaction (e.g., "thank you so much", "great work", "very happy")
- frustrated: Shows frustration (e.g., "this is taking too long", "I've been waiting")
- priceObjection: Concern about price (e.g., "that's more than expected", "too expensive")
- urgentNeed: Emergency/urgent situation (e.g., "leaking now", "need help ASAP", "emergency")
- justBrowsing: Not serious buyer (e.g., "just getting quotes", "maybe next year")
- referralMention: Mentions referring others (e.g., "I'll tell my neighbors", "my friend needs")
- paymentMention: Discusses payment (e.g., "how do I pay", "what do I owe", "send invoice")

Return format:
{
  "readyToSchedule": false,
  "wantsEstimate": false,
  "jobComplete": false,
  "satisfied": false,
  "frustrated": false,
  "priceObjection": false,
  "urgentNeed": false,
  "justBrowsing": false,
  "referralMention": false,
  "paymentMention": false,
  "confidence": 85,
  "rawSignals": ["specific phrases detected"]
}`;

export async function detectSignals(
  conversationHistory: { role: string; content: string }[]
): Promise<DetectedSignals> {
  // Only analyze last 10 messages for efficiency
  const recentMessages = conversationHistory.slice(-10);

  const conversationText = recentMessages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  try {
    const ai = getAIProvider();
    const { data } = await ai.chatJSON<DetectedSignals>(
      [{ role: 'user', content: conversationText }],
      {
        systemPrompt: SIGNAL_PROMPT,
        temperature: 0.3,
        maxTokens: 500,
      },
    );

    return {
      readyToSchedule: data.readyToSchedule || false,
      wantsEstimate: data.wantsEstimate || false,
      jobComplete: data.jobComplete || false,
      satisfied: data.satisfied || false,
      frustrated: data.frustrated || false,
      priceObjection: data.priceObjection || false,
      urgentNeed: data.urgentNeed || false,
      justBrowsing: data.justBrowsing || false,
      referralMention: data.referralMention || false,
      paymentMention: data.paymentMention || false,
      confidence: data.confidence || 50,
      rawSignals: data.rawSignals || [],
    };
  } catch (error) {
    console.error('Signal detection error:', error);
    return {
      readyToSchedule: false,
      wantsEstimate: false,
      jobComplete: false,
      satisfied: false,
      frustrated: false,
      priceObjection: false,
      urgentNeed: false,
      justBrowsing: false,
      referralMention: false,
      paymentMention: false,
      confidence: 0,
      rawSignals: [],
    };
  }
}

// Map signals to flow triggers
export function mapSignalsToFlows(signals: DetectedSignals): string[] {
  const suggestedFlows: string[] = [];

  if (signals.readyToSchedule) {
    suggestedFlows.push('Schedule Appointment');
  }
  if (signals.wantsEstimate) {
    suggestedFlows.push('Estimate Follow-up');
  }
  if ((signals.jobComplete && signals.satisfied) || signals.satisfied) {
    suggestedFlows.push('Review Request');
  }
  if (signals.referralMention) {
    suggestedFlows.push('Referral Request');
  }
  if (signals.paymentMention) {
    suggestedFlows.push('Payment Reminder');
  }

  return suggestedFlows;
}
