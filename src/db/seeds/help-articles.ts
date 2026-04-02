import { getDb } from '@/db';
import { helpArticles } from '@/db/schema';

const ARTICLES = [
  // ============================================================
  // Getting Started
  // ============================================================
  {
    title: 'How to set up your AI assistant',
    slug: 'how-to-set-up-your-ai-assistant',
    category: 'Getting Started',
    sortOrder: 1,
    content: `## Setting Up Your AI Assistant

Your AI assistant is configured through the Knowledge Base wizard at **/client/onboarding**. The wizard asks 12 questions about your business so the AI knows how to represent you accurately.

### What the wizard covers

- **Services and trades** — which jobs you take on and which you decline
- **Service area** — the cities and regions you cover
- **Pricing guidance** — typical ranges so the AI can give realistic ballpark figures
- **Booking preferences** — how you prefer leads to request appointments
- **Warranties and guarantees** — what you stand behind
- **Common objections** — how you like to handle price questions or competitor comparisons

### How to complete setup

1. Log in to your client portal and navigate to **/client/onboarding**.
2. Work through each of the 12 questions. Be as specific as possible — the AI uses your exact wording.
3. Click **Save and Activate** when done.

The AI configures automatically from your answers. You do not need to write scripts or prompts.

### After setup

Your AI starts in **missed-call only** mode for the first week. This means it only responds to missed calls, not general inbound messages. This gives you time to review its tone before it handles more conversations.

If you want to adjust anything after setup, go to **Settings > Knowledge Base** to edit individual entries.`,
    isPublished: true,
  },
  {
    title: 'How to import your old quotes',
    slug: 'how-to-import-your-old-quotes',
    category: 'Getting Started',
    sortOrder: 2,
    content: `## Importing Old Quotes

If you have outstanding quotes sitting in a spreadsheet or CRM, you can import them so the AI can follow up automatically.

### What you need

A CSV file with at minimum:

- **name** — the homeowner's name
- **phone** — their mobile number (any format)

Optional columns that improve follow-up quality:

- **email** — for email follow-ups
- **estimateAmount** — the dollar value of the quote
- **notes** — any context about the job

### How to import

1. Go to **/client/leads/import**.
2. Click **Upload CSV** and select your file.
3. Map the columns from your file to the fields in the import form.
4. Set the **status** for all imported leads to **estimate_sent** so the follow-up sequence starts correctly.
5. Click **Import Leads**.

The system normalizes all phone numbers automatically. Duplicates (same number already in your leads) are skipped without error.

### After import

Imported leads enter the estimate follow-up sequence immediately. The AI sends the first follow-up message within 24 hours unless quiet hours apply.

If you want to pause follow-up on specific leads, open the lead in **/client/leads** and set the status to **on_hold**.`,
    isPublished: true,
  },
  {
    title: 'How to connect Google Calendar',
    slug: 'how-to-connect-google-calendar',
    category: 'Getting Started',
    sortOrder: 3,
    content: `## Connecting Google Calendar

When Google Calendar is connected, the AI can check your availability in real time and book appointments directly into your calendar. Existing appointments on your calendar also block the AI from booking over them.

### How to connect

1. Go to **Settings > Features** in your client portal.
2. Find the **Google Calendar** section and click **Connect Google Calendar**.
3. Sign in with the Google account that owns the calendar you want to use.
4. Grant the permissions requested — the system needs read/write access to create and update events.
5. Select which calendar to use if your Google account has multiple calendars.

### What syncs

- New appointments booked by the AI appear on your calendar within seconds.
- Changes you make to appointments on Google Calendar (reschedule, cancel) sync back to your leads within 15 minutes.
- The AI reads your calendar before suggesting times, so it will never double-book you.

### Disconnecting

To remove the integration, go to **Settings > Features** and click **Disconnect**. Existing appointments in your leads are not deleted, but the AI will stop syncing with Google Calendar.

### Troubleshooting

If the calendar stops syncing, the most common cause is an expired Google authorization. Return to **Settings > Features** and reconnect using the same steps above.`,
    isPublished: true,
  },

  // ============================================================
  // AI & Knowledge Base
  // ============================================================
  {
    title: 'How the AI responds to your leads',
    slug: 'how-the-ai-responds-to-your-leads',
    category: 'AI & Knowledge Base',
    sortOrder: 4,
    content: `## How the AI Responds to Your Leads

The AI works in one of two modes depending on your account stage and settings.

### Modes

**Smart Assist** — The AI drafts a response and holds it for up to 5 minutes before sending. You receive a notification and can review, edit, or cancel the message before it goes out. If you take no action within 5 minutes, the message sends automatically.

**Autonomous** — The AI sends responses immediately without a review window. This mode is enabled after the AI has demonstrated consistent quality during the Smart Assist period.

### What the AI handles

- Answering questions about your services, service area, and pricing ranges
- Scheduling and confirming appointments
- Following up on sent estimates
- Handling common objections (price, timeline, competitor comparisons)
- Asking for reviews after completed jobs

### When the AI escalates to you

The AI escalates automatically when:

- A lead explicitly asks to speak with a person
- The conversation involves a legal complaint or emergency
- The AI does not have enough information to answer confidently
- Sentiment turns strongly negative

When escalation happens, you receive an SMS notification and the AI pauses on that lead until you resume it.

### Reviewing AI messages

All messages sent by the AI are visible in **/client/conversations** alongside messages you send manually. AI-sent messages are labeled so you can distinguish them.`,
    isPublished: true,
  },
  {
    title: 'What to do when the AI gets something wrong',
    slug: 'what-to-do-when-the-ai-gets-something-wrong',
    category: 'AI & Knowledge Base',
    sortOrder: 5,
    content: `## What to Do When the AI Gets Something Wrong

The AI learns from corrections. When it sends an inaccurate or off-tone message, the right response is to correct the underlying knowledge entry rather than just fixing the message.

### Step 1: Check flagged messages

Messages that receive a negative reply or that you manually flag appear in **/client/conversations** with a flag icon. Review these regularly, especially in the first two weeks.

### Step 2: Find the source of the error

Most errors fall into one of three categories:

- **Wrong information** — the AI stated a price, service, or warranty incorrectly. Go to **Settings > Knowledge Base** and update the relevant entry.
- **Wrong tone** — the response was too formal, too casual, or used language you would not use. Update the relevant KB entry with an example of how you prefer to phrase it.
- **Out of scope** — the AI answered a question it should not have (e.g., a service you do not offer). Add that service to the "Services We Do Not Offer" section of your KB.

### Step 3: Update the Knowledge Base

1. Go to **Settings > Knowledge Base**.
2. Find the entry related to the error and click **Edit**.
3. Update the content to reflect the correct information or tone.
4. Save the entry. The AI uses your updated KB immediately — there is no delay.

### Step 4: Resume the AI on that lead

If the AI was paused after the error, go to the lead in **/client/conversations** and click **Resume AI** to re-enable automated responses.

The AI does not improve through machine learning — it improves because you give it better information. Keeping your Knowledge Base accurate is the most important thing you can do.`,
    isPublished: true,
  },
  {
    title: 'Understanding AI mode progression',
    slug: 'understanding-ai-mode-progression',
    category: 'AI & Knowledge Base',
    sortOrder: 6,
    content: `## Understanding AI Mode Progression

Your AI assistant is not fully autonomous from day one. It progresses through three stages to ensure quality before taking on more responsibility.

### Week 1: Missed-call only

During the first week, the AI only responds to missed calls. When someone calls and you do not answer, the AI sends a single follow-up text to open the conversation.

This gives you time to complete your Knowledge Base setup and review the AI's initial tone without it handling all inbound traffic.

### Week 2: Smart Assist

In week two, the AI handles inbound messages with a 5-minute review window. You receive a notification for every AI-drafted response. You can edit or cancel any message before it sends.

The goal of this stage is to identify any Knowledge Base gaps before the AI operates without a review window.

### Week 3+: Autonomous

After the AI has passed the quality gate — typically meaning no corrections needed over a 72-hour period — it advances to autonomous mode. Messages send immediately without a review window.

You can still review all sent messages in **/client/conversations** at any time.

### Quality gates

The system monitors the AI's performance continuously. If error rates increase or you flag multiple messages in a short period, the AI automatically steps back to Smart Assist mode until performance recovers.

### Adjusting the mode manually

If you want to stay in Smart Assist indefinitely, go to **Settings > Features** and set **AI Mode** to **Smart Assist**. This overrides the automatic progression.`,
    isPublished: true,
  },

  // ============================================================
  // Leads & Follow-Up
  // ============================================================
  {
    title: 'How to flag an estimate as sent',
    slug: 'how-to-flag-an-estimate-as-sent',
    category: 'Leads & Follow-Up',
    sortOrder: 7,
    content: `## How to Flag an Estimate as Sent

Marking an estimate as sent triggers the follow-up sequence. The AI will follow up at 24 hours, 48 hours, and 7 days after the estimate date if the lead has not responded.

### Method 1: Text command (fastest)

Text **EST** to your business phone number from any phone. You will receive a reply listing your recent leads. Reply with the number corresponding to the lead to mark their estimate as sent.

This method works from any mobile device without logging in to the portal.

### Method 2: Conversations page

1. Go to **/client/conversations** and open the lead's conversation.
2. Click **Mark Estimate Sent** in the lead details panel on the right.
3. Optionally enter the estimate amount so the AI can reference it in follow-ups.

### Method 3: Leads list

1. Go to **/client/leads**.
2. Find the lead and click the three-dot menu on their row.
3. Select **Mark Estimate Sent**.

### What happens next

The lead's status updates to **estimate_sent** and a timestamp is recorded. The follow-up sequence starts from that timestamp. If the lead replies at any point, the sequence pauses and the AI takes over the conversation.

### Bulk marking

If you sent estimates to multiple leads at once, you can select several leads from **/client/leads** and use the bulk action **Mark as Estimate Sent**.`,
    isPublished: true,
  },
  {
    title: 'How to mark a job as won or lost',
    slug: 'how-to-mark-a-job-as-won-or-lost',
    category: 'Leads & Follow-Up',
    sortOrder: 8,
    content: `## How to Mark a Job as Won or Lost

Updating job outcomes keeps your pipeline accurate and feeds the revenue tracking in your dashboard. It also stops follow-up messages from going to leads who have already made a decision.

### Marking a job as won

1. Open the lead in **/client/conversations** or **/client/leads**.
2. Click **Update Status** and select **Won**.
3. Enter the **confirmed revenue** — the amount the client agreed to pay. This is used in your ROI reporting.
4. Optionally add notes about the job.
5. Click **Save**.

The lead moves out of the active pipeline. The review request sequence starts automatically 7 days after the win date, asking the client for a Google review.

### Marking a job as lost

1. Open the lead in **/client/conversations** or **/client/leads**.
2. Click **Update Status** and select **Lost**.
3. Select a **loss reason** (price, timing, competitor, no response, or other).
4. Click **Save**.

Lost leads with a loss reason of **no response** may re-enter the win-back sequence after 30 days if the win-back automation is enabled.

### Correcting a status

If you marked a job incorrectly, open the lead and click **Update Status** again. You can move a lead from lost back to won, or from won back to active.`,
    isPublished: true,
  },
  {
    title: 'How the probable wins nudge works',
    slug: 'how-the-probable-wins-nudge-works',
    category: 'Leads & Follow-Up',
    sortOrder: 9,
    content: `## How the Probable Wins Nudge Works

The probable wins nudge is a weekly check-in that helps you close out leads you may have forgotten about. If the AI identifies leads that are likely to be won or lost but have not been updated, it sends you a brief SMS asking for an outcome.

### When it runs

The nudge runs every Wednesday morning. It looks at leads that:

- Have an appointment in the past that has not been marked won or lost
- Have been in **estimate_sent** status for more than 7 days without an update
- Were last active more than 14 days ago but have not been closed

### What the message looks like

You receive a text from your business number listing up to 3 leads. For each lead it asks: "Did you win this job? Reply YES, NO, or SKIP."

### Responding

- **YES** — marks the lead as won. You will be asked to confirm the revenue amount by replying with a dollar figure.
- **NO** — marks the lead as lost. You can add a loss reason from the portal if needed.
- **SKIP** — leaves the lead unchanged and removes it from that week's nudge. It may appear again in a future nudge.

### Turning it off

If you do not want the weekly nudge, go to **Settings > Notifications** and disable **Probable Wins Nudge**. You can still update lead outcomes manually at any time from **/client/leads**.`,
    isPublished: true,
  },

  // ============================================================
  // Billing & Account
  // ============================================================
  {
    title: 'How billing works',
    slug: 'how-billing-works',
    category: 'Billing & Account',
    sortOrder: 10,
    content: `## How Billing Works

Your subscription is billed monthly. There are no annual contracts — you pay month to month and can cancel or pause at any time.

### What is included

Your monthly fee covers:

- Unlimited leads and conversations
- All automated follow-up sequences (estimate, payment, review, win-back)
- AI conversation agent with Knowledge Base
- Calendar integration
- Client portal access for you and your team
- Compliance infrastructure (quiet hours, opt-out handling, CASL)

### Billing cycle

Your subscription renews on the same day each month. You will receive an email receipt from Stripe after each payment. You can view all past invoices at **/client/billing**.

### Payment method

You can update your credit card at any time from **/client/billing > Payment Method**. Changes take effect on the next billing cycle.

### Failed payments

If a payment fails, you will receive an email notification. The system retries automatically over 3 days. If payment is not resolved within that window, your account is paused until payment is updated. No data is deleted.

### Questions about a charge

For any billing questions, contact your account manager or email support. Include your account name and the invoice number from your receipt.`,
    isPublished: true,
  },
  {
    title: 'How to pause or cancel your account',
    slug: 'how-to-pause-or-cancel-your-account',
    category: 'Billing & Account',
    sortOrder: 11,
    content: `## How to Pause or Cancel Your Account

### Pausing your account

Pausing is designed for seasonal contractors who do not need the platform during slow months. During a pause:

- Your data, leads, and conversation history are preserved
- Automated follow-ups stop
- The AI stops responding to inbound messages
- You are not billed for the paused period

To pause, go to **/client/billing** and click **Pause Account**. Select the approximate date you want to resume. You can resume early at any time from the same page.

### Cancelling your account

To cancel, go to **/client/billing** and click **Cancel Subscription**. Cancellation requires 30 days notice. Your account remains active for the 30-day notice period, including all automations and AI responses.

After cancellation is confirmed:

- All automated messages stop at the end of the notice period
- Your data is retained for 90 days, after which it is deleted
- You can export your leads and conversation history before deletion by going to **/client/leads > Export**

### Reactivating after cancellation

If you cancel and want to come back, contact your account manager or sign up again at the current rate. Your previous data may be restorable if you reactivate within the 90-day retention window.`,
    isPublished: true,
  },

  // ============================================================
  // Compliance
  // ============================================================
  {
    title: 'Understanding quiet hours and compliance',
    slug: 'understanding-quiet-hours-and-compliance',
    category: 'Compliance',
    sortOrder: 12,
    content: `## Understanding Quiet Hours and Compliance

The platform handles all messaging compliance automatically. You do not need to manage opt-outs or quiet hours manually.

### Quiet hours

Automated messages are never sent between **9:00 PM and 10:00 AM** in the recipient's local timezone. Messages that would otherwise send during this window are queued and delivered at 10:00 AM the following morning.

This applies to all automated messages: estimate follow-ups, payment reminders, review requests, and win-back sequences. It does not apply to messages you send manually from the conversations page — you are responsible for the timing of manual messages.

### Opt-outs

When a contact replies **STOP** to any message, they are added to the opt-out list immediately. The system honors opt-outs within seconds. No further automated messages are sent to that number.

If a contact who has opted out contacts you first, you may reply — the opt-out only blocks outbound automated messages, not your replies to inbound messages.

To reinstate a contact who opted out by mistake, they can text **START** to your business number at any time.

### CASL compliance

The platform is built to meet Canada's Anti-Spam Legislation (CASL) requirements. Leads are only messaged when there is an established business relationship (they contacted you first or received a quote). The system tracks consent timestamps for every contact.

If you have questions about compliance for a specific situation, contact your account manager.`,
    isPublished: true,
  },
];

export async function seedHelpArticles() {
  const db = getDb();

  console.log('  Seeding help articles...');

  // Upsert by slug so re-running seed is safe
  for (const article of ARTICLES) {
    await db
      .insert(helpArticles)
      .values(article)
      .onConflictDoUpdate({
        target: helpArticles.slug,
        set: {
          title: article.title,
          content: article.content,
          category: article.category,
          sortOrder: article.sortOrder,
          isPublished: article.isPublished,
          updatedAt: new Date(),
        },
      });
  }

  console.log(`  Help articles: ${ARTICLES.length} upserted`);
}
