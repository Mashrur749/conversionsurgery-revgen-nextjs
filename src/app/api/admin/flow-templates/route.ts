import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { flowTemplates } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { createTemplate } from '@/lib/services/flow-templates';
import { z } from 'zod';

/**
 * GET /api/admin/flow-templates
 * List all flow templates
 */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.FLOWS_EDIT },
  async () => {
    const db = getDb();
    const templates = await db
      .select()
      .from(flowTemplates)
      .orderBy(desc(flowTemplates.updatedAt));

    return NextResponse.json(templates);
  }
);

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  category: z.enum([
    'missed_call',
    'form_response',
    'estimate',
    'appointment',
    'payment',
    'review',
    'referral',
    'custom',
  ]),
  defaultTrigger: z
    .enum(['webhook', 'scheduled', 'manual', 'ai_suggested'])
    .optional(),
  defaultApprovalMode: z.enum(['auto', 'suggest', 'ask_sms']).optional(),
  tags: z.array(z.string()).optional(),
  steps: z.array(
    z.object({
      stepNumber: z.number(),
      name: z.string().optional(),
      delayMinutes: z.number(),
      messageTemplate: z.string(),
      skipConditions: z
        .object({
          ifReplied: z.boolean().optional(),
          ifScheduled: z.boolean().optional(),
          ifPaid: z.boolean().optional(),
        })
        .optional(),
    })
  ),
});

/**
 * POST /api/admin/flow-templates
 * Create a new flow template
 */
export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.FLOWS_EDIT },
  async ({ request }) => {
    const body = await request.json();
    const validation = createSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      console.error('[FlowEngine] Template creation validation failed:', errors);
      return NextResponse.json(
        { error: 'Invalid input', details: errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    const template = await createTemplate({
      name: data.name,
      slug: data.slug,
      description: data.description,
      category: data.category,
      defaultTrigger: data.defaultTrigger,
      defaultApprovalMode: data.defaultApprovalMode,
      tags: data.tags,
      steps: data.steps.map((s) => ({
        stepNumber: s.stepNumber,
        name: s.name,
        delayMinutes: s.delayMinutes,
        messageTemplate: s.messageTemplate,
        skipConditions: s.skipConditions,
      })),
    });

    console.log('[FlowEngine] Created template:', template.id);
    return NextResponse.json(template);
  }
);
