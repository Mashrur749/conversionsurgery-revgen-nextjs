/**
 * Booking Conversation Handler
 *
 * Manages conversational appointment booking over SMS.
 * Uses AI provider to interpret booking intent, extract time preferences,
 * and match responses to available slots.
 */

import { getDb } from '@/db';
import { leadContext, appointments } from '@/db/schema';
import { eq, and, not, desc } from 'drizzle-orm';
import {
  getAvailableSlots,
  suggestSlots,
  bookAppointment,
  rescheduleAppointment,
  cancelAppointment,
  type TimeSlot,
} from './appointment-booking';
import { getTrackedAI } from '@/lib/ai';

export type BookingIntent =
  | 'book'          // Wants to schedule
  | 'reschedule'    // Wants to change existing
  | 'cancel'        // Wants to cancel
  | 'select_slot'   // Choosing from offered options
  | 'check_later'   // "Let me check my schedule"
  | 'none';         // No booking intent

export interface BookingConversationResult {
  intent: BookingIntent;
  responseMessage: string;
  appointmentCreated: boolean;
  appointmentId?: string;
  needsAddress?: boolean;
}

/**
 * Key used to store a pending (address-pending) slot in leadContext.keyFacts.
 * Format: "pending_slot:<date>|<time>"
 */
const PENDING_SLOT_PREFIX = 'pending_slot:';

function encodePendingSlot(date: string, time: string): string {
  return `${PENDING_SLOT_PREFIX}${date}|${time}`;
}

function decodePendingSlot(encoded: string): { date: string; time: string } | null {
  if (!encoded.startsWith(PENDING_SLOT_PREFIX)) return null;
  const parts = encoded.slice(PENDING_SLOT_PREFIX.length).split('|');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { date: parts[0], time: parts[1] };
}

async function storePendingSlot(leadId: string, date: string, time: string): Promise<void> {
  const db = getDb();
  const [ctx] = await db
    .select({ keyFacts: leadContext.keyFacts })
    .from(leadContext)
    .where(eq(leadContext.leadId, leadId))
    .limit(1);

  const existing = (ctx?.keyFacts ?? []).filter(f => !f.startsWith(PENDING_SLOT_PREFIX));
  await db
    .update(leadContext)
    .set({ keyFacts: [...existing, encodePendingSlot(date, time)], updatedAt: new Date() })
    .where(eq(leadContext.leadId, leadId));
}

async function clearPendingSlot(leadId: string): Promise<void> {
  const db = getDb();
  const [ctx] = await db
    .select({ keyFacts: leadContext.keyFacts })
    .from(leadContext)
    .where(eq(leadContext.leadId, leadId))
    .limit(1);

  if (!ctx) return;
  const filtered = (ctx.keyFacts ?? []).filter(f => !f.startsWith(PENDING_SLOT_PREFIX));
  await db
    .update(leadContext)
    .set({ keyFacts: filtered, updatedAt: new Date() })
    .where(eq(leadContext.leadId, leadId));
}

async function getPendingSlot(leadId: string): Promise<{ date: string; time: string } | null> {
  const db = getDb();
  const [ctx] = await db
    .select({ keyFacts: leadContext.keyFacts })
    .from(leadContext)
    .where(eq(leadContext.leadId, leadId))
    .limit(1);

  const entry = (ctx?.keyFacts ?? []).find(f => f.startsWith(PENDING_SLOT_PREFIX));
  if (!entry) return null;
  return decodePendingSlot(entry);
}

/**
 * Detects booking intent from an inbound message.
 */
export async function detectBookingIntent(
  message: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
): Promise<BookingIntent> {
  const lowerMessage = message.toLowerCase();

  // Quick keyword checks before calling AI
  const bookKeywords = ['book', 'schedule', 'appointment', 'come out', 'set up a time', 'when can you'];
  const rescheduleKeywords = ['reschedule', 'change the time', 'move the appointment', 'different time', 'different day'];
  const cancelKeywords = ['cancel', 'don\'t need', 'not coming', 'nevermind'];

  if (cancelKeywords.some(k => lowerMessage.includes(k))) return 'cancel';
  if (rescheduleKeywords.some(k => lowerMessage.includes(k))) return 'reschedule';

  // Check if this is a response to a slot suggestion
  const lastAssistant = conversationHistory
    .filter(m => m.role === 'assistant')
    .slice(-1)[0];
  if (lastAssistant?.content.includes('Would') && lastAssistant?.content.includes('work')) {
    // AI offered slots, this might be a selection
    const slotPatterns = /\b(tuesday|wednesday|thursday|friday|monday|saturday|sunday|morning|afternoon|1|2|3|first|second|third|option)\b/i;
    if (slotPatterns.test(message)) return 'select_slot';
  }

  if (bookKeywords.some(k => lowerMessage.includes(k))) return 'book';

  // "let me check" patterns
  if (lowerMessage.includes('let me check') || lowerMessage.includes('get back to you')) {
    return 'check_later';
  }

  return 'none';
}

/**
 * Handles the booking conversation flow.
 * Called by the orchestrator when booking intent is detected.
 *
 * Address gate (J5): If no address is known when a slot is selected, we do NOT book
 * immediately. Instead we ask for the address and store the chosen slot as a pending
 * slot in leadContext.keyFacts. On the next inbound message we detect the pending slot,
 * use the message as the address, and complete the booking.
 */
export async function handleBookingConversation(
  clientId: string,
  leadId: string,
  leadName: string,
  message: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  businessName: string,
  ownerName: string,
  intent: BookingIntent,
  leadAddress?: string | null
): Promise<BookingConversationResult> {
  // Address gate: check if we have a pending slot awaiting an address from the customer.
  // If so, treat this message as the address and complete the booking.
  const pending = await getPendingSlot(leadId);
  if (pending) {
    // The current message is the address — complete the booking now.
    const address = message.trim();
    await clearPendingSlot(leadId);
    const result = await bookAppointment(clientId, leadId, pending.date, pending.time, address);
    if (result.success) {
      return {
        intent: 'book',
        responseMessage: result.confirmationMessage!,
        appointmentCreated: true,
        appointmentId: result.appointmentId,
        needsAddress: false,
      };
    }
    return {
      intent: 'book',
      responseMessage: result.error || 'Something went wrong confirming your appointment. Let me have someone reach out.',
      appointmentCreated: false,
    };
  }

  switch (intent) {
    case 'book':
      return handleNewBooking(clientId, leadId, leadName, message, businessName, ownerName, leadAddress);

    case 'select_slot':
      return handleSlotSelection(clientId, leadId, leadName, message, conversationHistory, businessName, leadAddress);

    case 'reschedule':
      return handleReschedule(clientId, leadId, leadName, message, businessName, ownerName);

    case 'cancel':
      return handleCancellation(clientId, leadId, leadName, businessName);

    case 'check_later':
      return {
        intent: 'check_later',
        responseMessage: `No rush at all! Just text us whenever you're ready and we'll get you set up.`,
        appointmentCreated: false,
      };

    default:
      return {
        intent: 'none',
        responseMessage: '',
        appointmentCreated: false,
      };
  }
}

/**
 * Checks whether there is a pending slot awaiting address confirmation for a lead.
 * If one exists, treats the current message as the address and completes the booking.
 * Returns null if there is no pending slot (indicating the caller should proceed normally).
 *
 * This is called by incoming-sms.ts BEFORE booking intent detection, so that an address-only
 * reply (which wouldn't match booking keywords) can still complete the booking.
 */
export async function checkAndCompletePendingBooking(
  clientId: string,
  leadId: string,
  leadName: string,
  message: string,
  businessName: string,
  ownerName: string
): Promise<BookingConversationResult | null> {
  const pending = await getPendingSlot(leadId);
  if (!pending) return null;

  const address = message.trim();
  await clearPendingSlot(leadId);
  const result = await bookAppointment(clientId, leadId, pending.date, pending.time, address);
  if (result.success) {
    return {
      intent: 'book',
      responseMessage: result.confirmationMessage!,
      appointmentCreated: true,
      appointmentId: result.appointmentId,
      needsAddress: false,
    };
  }
  return {
    intent: 'book',
    responseMessage: result.error || `Something went wrong confirming the appointment. Let me have ${ownerName} reach out directly.`,
    appointmentCreated: false,
  };
}

/**
 * Handles initial booking request — suggests available slots.
 */
async function handleNewBooking(
  clientId: string,
  leadId: string,
  leadName: string,
  message: string,
  businessName: string,
  ownerName: string,
  leadAddress?: string | null
): Promise<BookingConversationResult> {
  // Get available slots
  const available = await getAvailableSlots(clientId);

  if (available.length === 0) {
    return {
      intent: 'book',
      responseMessage: `We're pretty booked up right now. Let me have ${ownerName} reach out to find a time that works. Sound good?`,
      appointmentCreated: false,
    };
  }

  // Try to parse time preference from the message
  const preferredSlot = await extractTimePreference(message, available, clientId);

  if (preferredSlot) {
    // Address gate: if no address is known, ask for it before booking
    if (!leadAddress) {
      await storePendingSlot(leadId, preferredSlot.date, preferredSlot.time);
      return {
        intent: 'book',
        responseMessage: `Great choice! Before I confirm, what's the address for the estimate?`,
        appointmentCreated: false,
        needsAddress: true,
      };
    }
    // Address available — book directly
    const result = await bookAppointment(clientId, leadId, preferredSlot.date, preferredSlot.time, leadAddress);
    if (result.success) {
      return {
        intent: 'book',
        responseMessage: result.confirmationMessage!,
        appointmentCreated: true,
        appointmentId: result.appointmentId,
        needsAddress: false,
      };
    }
  }

  // Suggest 2-3 slots
  const suggestions = suggestSlots(available, 3);
  const slotList = suggestions
    .map((s, i) => `${i + 1}. ${s.displayDate} at ${s.displayTime}`)
    .join('\n');

  return {
    intent: 'book',
    responseMessage: `Great, let's get you scheduled! Here are some openings:\n\n${slotList}\n\nWould any of these work for you?`,
    appointmentCreated: false,
  };
}

/**
 * Handles when a lead selects from offered time slots.
 */
async function handleSlotSelection(
  clientId: string,
  leadId: string,
  leadName: string,
  message: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  businessName: string,
  leadAddress?: string | null
): Promise<BookingConversationResult> {
  // Find the last slot suggestion message
  const lastAssistant = conversationHistory
    .filter(m => m.role === 'assistant')
    .slice(-1)[0];

  if (!lastAssistant) {
    return handleNewBooking(clientId, leadId, leadName, message, businessName, '', leadAddress);
  }

  // Get available slots again (they may have changed)
  const available = await getAvailableSlots(clientId);

  // Use AI to match the response to a slot
  const matchedSlot = await matchSlotFromResponse(message, lastAssistant.content, available, clientId);

  if (!matchedSlot) {
    // Couldn't determine which slot — ask again
    const suggestions = suggestSlots(available, 3);
    const slotList = suggestions
      .map((s, i) => `${i + 1}. ${s.displayDate} at ${s.displayTime}`)
      .join('\n');

    return {
      intent: 'select_slot',
      responseMessage: `Sorry, I didn't quite catch that. Which of these works best?\n\n${slotList}`,
      appointmentCreated: false,
    };
  }

  // Address gate: if no address is known, ask for it before booking
  if (!leadAddress) {
    await storePendingSlot(leadId, matchedSlot.date, matchedSlot.time);
    return {
      intent: 'select_slot',
      responseMessage: `Perfect! Before I lock that in, what's the address for the estimate?`,
      appointmentCreated: false,
      needsAddress: true,
    };
  }

  // Address available — book the matched slot
  const result = await bookAppointment(clientId, leadId, matchedSlot.date, matchedSlot.time, leadAddress);

  if (result.success) {
    return {
      intent: 'select_slot',
      responseMessage: result.confirmationMessage!,
      appointmentCreated: true,
      appointmentId: result.appointmentId,
      needsAddress: false,
    };
  }

  return {
    intent: 'select_slot',
    responseMessage: result.error || 'Something went wrong booking that time. Let me suggest another.',
    appointmentCreated: false,
  };
}

/**
 * Handles rescheduling an existing appointment.
 */
async function handleReschedule(
  clientId: string,
  leadId: string,
  leadName: string,
  message: string,
  businessName: string,
  ownerName: string
): Promise<BookingConversationResult> {
  const db = getDb();

  // Find the most recent active appointment
  const [existing] = await db
    .select()
    .from(appointments)
    .where(and(
      eq(appointments.leadId, leadId),
      eq(appointments.clientId, clientId),
      not(eq(appointments.status, 'cancelled'))
    ))
    .orderBy(desc(appointments.createdAt))
    .limit(1);

  if (!existing) {
    return {
      intent: 'reschedule',
      responseMessage: `I don't see a current appointment on file. Would you like to schedule a new one?`,
      appointmentCreated: false,
    };
  }

  // Get available slots
  const available = await getAvailableSlots(clientId);
  const suggestions = suggestSlots(available, 3);

  if (suggestions.length === 0) {
    return {
      intent: 'reschedule',
      responseMessage: `No problem! Let me have ${ownerName} reach out to find a new time for you.`,
      appointmentCreated: false,
    };
  }

  const slotList = suggestions
    .map((s, i) => `${i + 1}. ${s.displayDate} at ${s.displayTime}`)
    .join('\n');

  return {
    intent: 'reschedule',
    responseMessage: `No problem at all! Here are some alternative times:\n\n${slotList}\n\nWhich works better for you?`,
    appointmentCreated: false,
  };
}

/**
 * Handles appointment cancellation.
 */
async function handleCancellation(
  clientId: string,
  leadId: string,
  leadName: string,
  businessName: string
): Promise<BookingConversationResult> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(appointments)
    .where(and(
      eq(appointments.leadId, leadId),
      eq(appointments.clientId, clientId),
      not(eq(appointments.status, 'cancelled'))
    ))
    .orderBy(desc(appointments.createdAt))
    .limit(1);

  if (!existing) {
    return {
      intent: 'cancel',
      responseMessage: `No worries! If you ever need us in the future, just reach out.`,
      appointmentCreated: false,
    };
  }

  await cancelAppointment(existing.id, 'Customer requested cancellation');

  return {
    intent: 'cancel',
    responseMessage: `Your appointment has been cancelled. No worries at all — if you need us down the road, just text anytime.`,
    appointmentCreated: false,
  };
}

/**
 * Uses AI to extract a time preference from a message and match it to available slots.
 */
async function extractTimePreference(
  message: string,
  available: TimeSlot[],
  clientId: string
): Promise<TimeSlot | null> {
  if (available.length === 0) return null;

  const slotDescriptions = available
    .slice(0, 20)
    .map(s => `${s.date} ${s.time} (${s.displayDate} ${s.displayTime})`)
    .join('\n');

  try {
    const ai = getTrackedAI({ clientId, operation: 'booking_extract_time' });
    const result = await ai.chat(
      [{ role: 'user', content: message }],
      {
        systemPrompt: `You extract time preferences from customer messages and match them to available slots.
Available slots:
${slotDescriptions}

If the customer's message mentions a specific time or day preference, return the BEST matching slot as JSON: {"date":"YYYY-MM-DD","time":"HH:mm"}
If no clear preference is expressed, return {"date":null,"time":null}
Return ONLY the JSON object, nothing else.`,
        temperature: 0,
        maxTokens: 50,
      },
    );

    const text = result.content.trim();
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (!parsed.date || !parsed.time) return null;

    // Verify the slot exists in available
    return available.find(s => s.date === parsed.date && s.time === parsed.time) || null;
  } catch {
    return null;
  }
}

/**
 * Uses AI to match a customer's slot selection response to offered options.
 */
async function matchSlotFromResponse(
  customerMessage: string,
  assistantMessage: string,
  available: TimeSlot[],
  clientId: string
): Promise<TimeSlot | null> {
  try {
    const ai = getTrackedAI({ clientId, operation: 'booking_match_slot' });
    const result = await ai.chat(
      [{ role: 'user', content: customerMessage }],
      {
        systemPrompt: `You match a customer's response to a time slot from a list of options.
The assistant previously offered these options:
${assistantMessage}

The available slots are:
${available.slice(0, 20).map(s => `${s.date} ${s.time} (${s.displayDate} ${s.displayTime})`).join('\n')}

Based on the customer's response, return the matching slot as JSON: {"date":"YYYY-MM-DD","time":"HH:mm"}
If you can't determine a match, return {"date":null,"time":null}
Return ONLY the JSON object.`,
        temperature: 0,
        maxTokens: 50,
      },
    );

    const text = result.content.trim();
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (!parsed.date || !parsed.time) return null;

    return available.find(s => s.date === parsed.date && s.time === parsed.time) || null;
  } catch {
    return null;
  }
}
