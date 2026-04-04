/**
 * Claude tool definitions and execution handlers for voice conversations.
 *
 * Tools allow the AI to take actions during a live phone call:
 * - Check calendar availability
 * - Book appointments
 * - Transfer to human
 * - Schedule callbacks
 * - Capture project details on the lead record
 */

import type { Env, SessionContext, HandoffData, ConversationMessage } from './types';

// ── Tool Definitions (Anthropic format) ─────────────────────────────────

export const VOICE_TOOLS = [
  {
    name: 'check_availability',
    description:
      'Check available appointment slots for a given date. Returns a list of open time slots.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'The date to check availability for, in YYYY-MM-DD format',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'book_appointment',
    description:
      'Book an estimate appointment for the caller. Use check_availability first to confirm the slot is open.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Appointment date in YYYY-MM-DD format',
        },
        time: {
          type: 'string',
          description: 'Appointment time in HH:MM format (24-hour)',
        },
        caller_name: {
          type: 'string',
          description: 'The caller name',
        },
        project_type: {
          type: 'string',
          description: 'Type of project (e.g., kitchen renovation, bathroom remodel)',
        },
        notes: {
          type: 'string',
          description: 'Any additional notes about the appointment',
        },
      },
      required: ['date', 'time', 'caller_name', 'project_type'],
    },
  },
  {
    name: 'transfer_to_human',
    description:
      'Transfer the caller to the business owner or team member. Use when the caller requests a human, is frustrated, or the question is beyond your knowledge.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: {
          type: 'string',
          description: 'Brief reason for the transfer',
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'schedule_callback',
    description:
      'Schedule a callback from the business owner. Use when transfer is not possible or the caller prefers to be called back.',
    input_schema: {
      type: 'object' as const,
      properties: {
        preferred_time: {
          type: 'string',
          description: 'When the caller wants to be called back (e.g., "tomorrow morning", "after 3pm")',
        },
        caller_name: {
          type: 'string',
          description: 'The caller name',
        },
      },
      required: [],
    },
  },
  {
    name: 'capture_project_details',
    description:
      'Save project details the caller has shared. Call this whenever you learn new information about the caller or their project.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Caller name',
        },
        project_type: {
          type: 'string',
          description: 'Type of project',
        },
        estimated_value: {
          type: 'string',
          description: 'Estimated project value if mentioned',
        },
        address: {
          type: 'string',
          description: 'Project address if mentioned',
        },
        notes: {
          type: 'string',
          description: 'Any other relevant details',
        },
      },
      required: [],
    },
  },
];

// ── Tool Execution ──────────────────────────────────────────────────────

export interface ToolExecutionResult {
  output: string;
  shouldEndSession: boolean;
  handoffData?: HandoffData;
}

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: SessionContext,
  env: Env,
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case 'check_availability':
      return await handleCheckAvailability(toolInput, ctx, env);
    case 'book_appointment':
      return await handleBookAppointment(toolInput, ctx, env);
    case 'transfer_to_human':
      return handleTransferToHuman(toolInput, ctx);
    case 'schedule_callback':
      return await handleScheduleCallback(toolInput, ctx, env);
    case 'capture_project_details':
      return await handleCaptureProjectDetails(toolInput, ctx, env);
    default:
      return { output: `Unknown tool: ${toolName}`, shouldEndSession: false };
  }
}

// ── Individual Tool Handlers ────────────────────────────────────────────

async function handleCheckAvailability(
  input: Record<string, unknown>,
  ctx: SessionContext,
  env: Env,
): Promise<ToolExecutionResult> {
  const date = input.date as string;

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(env.DATABASE_URL);

    // Get existing appointments for the requested date
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const [appointments, calendarEvents] = await Promise.all([
      sql`SELECT start_time, end_time FROM appointments
          WHERE client_id = ${ctx.clientId}
          AND start_time >= ${startOfDay}::timestamp
          AND start_time <= ${endOfDay}::timestamp
          AND status != 'cancelled'`,
      sql`SELECT start_time, end_time FROM calendar_events
          WHERE client_id = ${ctx.clientId}
          AND start_time >= ${startOfDay}::timestamp
          AND start_time <= ${endOfDay}::timestamp`,
    ]);

    // Build set of busy hours (simplified: 1-hour blocks)
    const busyHours = new Set<number>();
    for (const appt of [...appointments, ...calendarEvents]) {
      const start = new Date(appt.start_time as string);
      const end = new Date(appt.end_time as string);
      for (let h = start.getHours(); h < end.getHours(); h++) {
        busyHours.add(h);
      }
    }

    // Business hours: 8 AM to 5 PM, excluding busy slots
    const available: string[] = [];
    for (let h = 8; h < 17; h++) {
      if (!busyHours.has(h)) {
        const hour12 = h > 12 ? h - 12 : h;
        const ampm = h >= 12 ? 'PM' : 'AM';
        available.push(`${hour12}:00 ${ampm}`);
      }
    }

    if (available.length === 0) {
      return {
        output: JSON.stringify({ available_slots: [], message: 'No availability on this date' }),
        shouldEndSession: false,
      };
    }

    return {
      output: JSON.stringify({ available_slots: available }),
      shouldEndSession: false,
    };
  } catch (err) {
    console.error('[Tools] check_availability error:', err);
    return {
      output: JSON.stringify({ error: 'Unable to check availability right now' }),
      shouldEndSession: false,
    };
  }
}

async function handleBookAppointment(
  input: Record<string, unknown>,
  ctx: SessionContext,
  env: Env,
): Promise<ToolExecutionResult> {
  const date = input.date as string;
  const time = input.time as string;
  const callerName = input.caller_name as string;
  const projectType = input.project_type as string;
  const notes = (input.notes as string) || '';

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(env.DATABASE_URL);

    const startTime = new Date(`${date}T${time}:00`);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour

    // Insert appointment
    await sql`INSERT INTO appointments (client_id, lead_id, title, description, start_time, end_time, status, sync_status)
              VALUES (${ctx.clientId}, ${ctx.leadId}, ${`Estimate: ${projectType}`}, ${notes}, ${startTime.toISOString()}, ${endTime.toISOString()}, 'scheduled', 'pending')`;

    // Insert calendar event for sync
    await sql`INSERT INTO calendar_events (client_id, lead_id, title, description, start_time, end_time, event_type, status, sync_status)
              VALUES (${ctx.clientId}, ${ctx.leadId}, ${`Estimate: ${projectType} - ${callerName}`}, ${notes}, ${startTime.toISOString()}, ${endTime.toISOString()}, 'appointment', 'scheduled', 'pending')`;

    // Update lead with name and project type
    await sql`UPDATE leads SET name = ${callerName}, project_type = ${projectType}, status = 'appointment_scheduled', updated_at = NOW()
              WHERE id = ${ctx.leadId}`;

    const hour12 = startTime.getHours() > 12 ? startTime.getHours() - 12 : startTime.getHours();
    const ampm = startTime.getHours() >= 12 ? 'PM' : 'AM';

    return {
      output: JSON.stringify({
        confirmed: true,
        date,
        time: `${hour12}:00 ${ampm}`,
        message: `Appointment booked for ${callerName} on ${date} at ${hour12}:00 ${ampm}`,
      }),
      shouldEndSession: false,
    };
  } catch (err) {
    console.error('[Tools] book_appointment error:', err);
    return {
      output: JSON.stringify({ error: 'Unable to book the appointment right now. Please try again.' }),
      shouldEndSession: false,
    };
  }
}

function handleTransferToHuman(
  input: Record<string, unknown>,
  ctx: SessionContext,
): ToolExecutionResult {
  const reason = (input.reason as string) || 'Caller requested human agent';

  const handoff: HandoffData = {
    reasonCode: 'live-agent-handoff',
    reason,
    callSummary: summarizeConversation(ctx),
    transcript: ctx.fullTranscript,
    callerIntent: ctx.detectedIntent,
    callbackRequested: ctx.callbackRequested,
    transferTo: ctx.ownerPhone ?? undefined,
  };

  return {
    output: 'Transferring to human agent.',
    shouldEndSession: true,
    handoffData: handoff,
  };
}

async function handleScheduleCallback(
  input: Record<string, unknown>,
  ctx: SessionContext,
  env: Env,
): Promise<ToolExecutionResult> {
  const preferredTime = (input.preferred_time as string) || 'as soon as possible';
  const callerName = input.caller_name as string | undefined;

  ctx.callbackRequested = true;

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(env.DATABASE_URL);

    // Update voice call and lead
    await sql`UPDATE voice_calls SET callback_requested = true, updated_at = NOW()
              WHERE twilio_call_sid = ${ctx.callSid}`;

    if (callerName) {
      await sql`UPDATE leads SET name = ${callerName}, updated_at = NOW()
                WHERE id = ${ctx.leadId}`;
    }
  } catch (err) {
    console.error('[Tools] schedule_callback DB error:', err);
  }

  const handoff: HandoffData = {
    reasonCode: 'callback-scheduled',
    reason: `Callback requested: ${preferredTime}`,
    callSummary: summarizeConversation(ctx),
    transcript: ctx.fullTranscript,
    callerIntent: ctx.detectedIntent,
    callbackRequested: true,
    callerName: callerName ?? undefined,
  };

  return {
    output: `Callback scheduled for ${preferredTime}.`,
    shouldEndSession: true,
    handoffData: handoff,
  };
}

async function handleCaptureProjectDetails(
  input: Record<string, unknown>,
  ctx: SessionContext,
  env: Env,
): Promise<ToolExecutionResult> {
  const name = input.name as string | undefined;
  const projectType = input.project_type as string | undefined;
  const estimatedValue = input.estimated_value as string | undefined;
  const address = input.address as string | undefined;
  const notes = input.notes as string | undefined;

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(env.DATABASE_URL);

    // Build dynamic update — only set fields that were provided
    const updates: string[] = [];
    const values: unknown[] = [];

    if (name) { updates.push('name'); values.push(name); }
    if (projectType) { updates.push('project_type'); values.push(projectType); }
    if (estimatedValue) { updates.push('estimated_value'); values.push(estimatedValue); }
    if (address) { updates.push('address'); values.push(address); }
    if (notes) { updates.push('notes'); values.push(notes); }

    if (updates.length > 0) {
      // Use a simple approach — update each field individually
      if (name) await sql`UPDATE leads SET name = ${name}, updated_at = NOW() WHERE id = ${ctx.leadId}`;
      if (projectType) await sql`UPDATE leads SET project_type = ${projectType}, updated_at = NOW() WHERE id = ${ctx.leadId}`;
      if (estimatedValue) await sql`UPDATE leads SET estimated_value = ${estimatedValue}, updated_at = NOW() WHERE id = ${ctx.leadId}`;
      if (address) await sql`UPDATE leads SET address = ${address}, updated_at = NOW() WHERE id = ${ctx.leadId}`;
      if (notes) await sql`UPDATE leads SET notes = ${notes}, updated_at = NOW() WHERE id = ${ctx.leadId}`;
    }

    return {
      output: JSON.stringify({ captured: true }),
      shouldEndSession: false,
    };
  } catch (err) {
    console.error('[Tools] capture_project_details error:', err);
    return {
      output: JSON.stringify({ captured: false, error: 'Failed to save details' }),
      shouldEndSession: false,
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function summarizeConversation(ctx: SessionContext): string {
  const lastMessages = ctx.conversationHistory.slice(-6);
  const summary = lastMessages
    .filter((m): m is ConversationMessage => typeof m.content === 'string')
    .map((m) => `${m.role === 'user' ? 'Caller' : 'AI'}: ${m.content}`)
    .join('\n');
  return summary || 'No conversation recorded.';
}
