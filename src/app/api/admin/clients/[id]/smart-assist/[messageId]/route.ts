import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import {
  sendSmartAssistDraftNow,
  cancelSmartAssistDraft,
} from '@/lib/services/smart-assist-lifecycle';

const actionSchema = z
  .object({
    action: z.enum(['approve', 'edit', 'cancel']),
    editedContent: z.string().optional(),
  })
  .strict();

export const POST = adminClientRoute<{ id: string; messageId: string }>(
  { permission: AGENCY_PERMISSIONS.CONVERSATIONS_VIEW, clientIdFrom: (p) => p.id },
  async ({ request, params }) => {
    const { messageId } = params;

    const body = await request.json();
    const data = actionSchema.parse(body);

    if (data.action === 'cancel') {
      const cancelled = await cancelSmartAssistDraft({
        scheduledMessageId: messageId,
        reason: 'Admin cancelled',
        source: 'admin_dashboard',
      });

      return NextResponse.json({
        success: cancelled,
        status: cancelled ? 'cancelled' : null,
        reason: cancelled ? 'cancelled' : 'not_pending',
      });
    }

    if (data.action === 'edit') {
      if (!data.editedContent?.trim()) {
        return NextResponse.json(
          { error: 'Invalid input', details: [{ message: 'editedContent is required for edit action' }] },
          { status: 400 }
        );
      }

      const result = await sendSmartAssistDraftNow({
        scheduledMessageId: messageId,
        action: 'approve_send',
        editedContent: data.editedContent,
      });

      return NextResponse.json({
        success: result.success,
        status: result.status,
        reason: result.reason,
      });
    }

    // action === 'approve'
    const result = await sendSmartAssistDraftNow({
      scheduledMessageId: messageId,
      action: 'approve_send',
    });

    return NextResponse.json({
      success: result.success,
      status: result.status,
      reason: result.reason,
    });
  }
);
