/**
 * Slack incoming webhook integration.
 * Fire-and-forget: logs errors but never throws.
 */
export async function sendSlackSupportNotification({
  userEmail,
  page,
  message,
}: {
  userEmail: string;
  page: string;
  message: string;
}) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[Slack] SLACK_WEBHOOK_URL not configured — skipping notification');
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `*New Support Request*\n>*From:* ${userEmail}\n>*Page:* ${page}\n>*Message:* ${message}`,
      }),
    });
  } catch (error) {
    console.error('[Slack] Failed to send webhook:', error);
  }
}
