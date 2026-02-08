# Complete Testing Guide - Revenue Recovery SaaS

## Prerequisites

Before testing, ensure you have:

1. **Local Environment Setup**
   ```bash
   npm install
   npm run db:push  # Apply database migrations
   ```

2. **Test Data in Database**
   ```bash
   npm run db:studio  # Opens Drizzle Studio
   ```
   Create a test client manually:
   ```sql
   INSERT INTO clients (
     id, business_name, email, status, 
     twilio_number, twilio_account_sid, twilio_auth_token,
     openai_api_key, monthly_message_limit, notification_email
   ) VALUES (
     'test-client-1',
     'Test Business',
     'test@example.com',
     'active',
     '+15551234567',      -- Your Twilio number
     'ACxxxxxxxxxxxxxxxx',  -- Your Twilio SID
     'auth_token_here',
     'sk-...',            -- Your OpenAI key
     10000,
     'test@example.com'
   );
   ```

3. **Environment Variables**
   ```bash
   cp .env.example .env.local
   # Fill in your actual values:
   # - DATABASE_URL (from Neon)
   # - TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN
   # - OPENAI_API_KEY
   # - AUTH_SECRET (generate: `openssl rand -hex 32`)
   # - CRON_SECRET (for testing cron endpoints)
   ```

4. **Start Local Server**
   ```bash
   npm run dev
   # Runs on http://localhost:3000
   ```

---

## Phase 1: Core API Webhooks Testing

### 1.1 Test Twilio SMS Webhook

**Purpose:** Verify incoming SMS triggers AI response

**Test Steps:**

1. Get your Twilio number from the database
2. Send SMS to that number from your phone
3. Check Cloudflare/terminal logs
4. Verify:
   - Message logged in `conversations` table
   - AI response sent back
   - Lead created if new number

**Manual Test with curl:**
```bash
curl -X POST http://localhost:3000/api/webhooks/twilio/sms \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B14035551234&To=%2B15551234567&Body=How%20much%20does%20a%20roof%20cost%3F&MessageSid=SMxxxxxxxx"
```

**Expected Response:**
```json
{"success": true}
```

**Database Check:**
```sql
-- Check conversations table
SELECT * FROM conversations 
WHERE created_at > now() - interval '1 minute'
ORDER BY created_at DESC;

-- Check leads table
SELECT * FROM leads 
WHERE phone = '+14035551234'
ORDER BY created_at DESC;
```

---

### 1.2 Test Twilio Voice Webhook (Missed Call)

**Purpose:** Verify missed call triggers SMS response

**Test Steps:**

1. Call your Twilio number and let it ring (don't answer)
2. Check that SMS is sent immediately
3. Verify lead is created with "new" status

**Manual Test with curl:**
```bash
curl -X POST http://localhost:3000/api/webhooks/twilio/voice \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B14035551234&To=%2B15551234567&CallSid=CAxxxxxxxx&CallStatus=completed"
```

**Expected SMS:** "Thanks for reaching out! We'll get back to you ASAP."

---

### 1.3 Test Form Webhook

**Purpose:** Verify form submissions create leads

**Test Steps:**

1. Send form data to webhook
2. Verify SMS confirmation sent
3. Check lead created in database

**Test with curl:**
```bash
curl -X POST http://localhost:3000/api/webhooks/form \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "test-client-1",
    "name": "John Smith",
    "phone": "+14035559876",
    "email": "john@example.com",
    "projectType": "roof_replacement",
    "address": "123 Main St"
  }'
```

**Expected Response:**
```json
{"success": true, "leadId": "lead-xxx"}
```

**Database Check:**
```sql
SELECT * FROM leads 
WHERE phone = '+14035559876'
AND source = 'form';
```

---

### 1.4 Test Database Connection

**Purpose:** Verify database is working

```bash
curl http://localhost:3000/api/test-db
```

**Expected Response:**
```json
{"success": true, "timestamp": "2026-02-07T..."}
```

---

## Phase 2: AI Sequences Testing

### 2.1 Test AI Response Generation

**Purpose:** Verify GPT-4 responds to different question types

**Test Steps:**

1. Send SMS with different question types
2. Verify AI responds appropriately
3. Check `conversations` table for confidence scores

**Test Messages:**
```
Pricing question: "How much does a roof cost?"
Service question: "Do you offer gutter cleaning?"
Complex question: "I need a quote for my whole house"
```

**Check in Database:**
```sql
SELECT 
  content, 
  message_type, 
  ai_confidence
FROM conversations 
WHERE message_type = 'ai_response'
ORDER BY created_at DESC 
LIMIT 10;
```

**Expected Results:**
- `ai_confidence` > 0.7 for straightforward questions
- `message_type` = 'ai_response' for AI-generated messages
- Escalation detected for pricing/complex questions

---

### 2.2 Test Escalation Detection

**Purpose:** Verify complex questions escalate to human

**Test with pricing question:**
```bash
curl -X POST http://localhost:3000/api/webhooks/twilio/sms \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B14035551234&To=%2B15551234567&Body=What's%20your%20pricing%3F&MessageSid=SMxxxxxxxx"
```

**Check Database:**
```sql
SELECT * FROM conversations 
WHERE lead_id IN (SELECT id FROM leads WHERE phone = '+14035551234')
AND message_type = 'escalation'
ORDER BY created_at DESC;
```

**Expected:** Message marked with `message_type = 'escalation'` and `ai_confidence` is lower

---

## Phase 3: SMS Automations Testing

### 3.1 Test Appointment Reminder Sequence

**Purpose:** Verify appointment reminders send at correct times

**Test Steps:**

1. Create appointment 2 days in future
2. Manually trigger cron job
3. Verify reminders in scheduled queue
4. Fast-forward time to trigger reminders (in testing)

**Create Test Appointment:**
```bash
curl -X POST http://localhost:3000/api/sequences/appointment \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "lead-xxx",
    "date": "2026-02-09",
    "time": "14:00"
  }'
```

**Check Scheduled Messages:**
```sql
SELECT 
  scheduled_messages.*, 
  leads.phone,
  leads.name
FROM scheduled_messages
JOIN leads ON scheduled_messages.lead_id = leads.id
WHERE sequence_type = 'appointment'
ORDER BY send_at;
```

**Expected:**
- Two scheduled messages (24h before + 1h before)
- Correct send_at timestamps
- `sent = false` until cron runs

---

### 3.2 Test Estimate Follow-up Sequence

**Purpose:** Verify multi-day follow-up messages

**Test Steps:**

1. Start estimate sequence
2. Check scheduled messages created
3. Verify timing (Day 2, Day 5, Day 7)

**Start Sequence:**
```bash
curl -X POST http://localhost:3000/api/sequences/estimate \
  -H "Content-Type: application/json" \
  -d '{"leadId": "lead-xxx"}'
```

**Check Database:**
```sql
SELECT 
  sequence_type,
  step_number,
  send_at,
  content
FROM scheduled_messages
WHERE lead_id = 'lead-xxx'
AND sequence_type = 'estimate'
ORDER BY send_at;
```

**Expected:**
- 3 messages scheduled
- Day 2, 5, and 7 timing
- Increasing urgency in messages

---

### 3.3 Test Review Request Sequence

**Purpose:** Verify review request campaign

```bash
curl -X POST http://localhost:3000/api/sequences/review \
  -H "Content-Type: application/json" \
  -d '{"leadId": "lead-xxx"}'
```

**Check Database:**
```sql
SELECT * FROM scheduled_messages
WHERE lead_id = 'lead-xxx'
AND sequence_type = 'review';
```

**Expected:**
- 2 review request messages
- Day 1 and Day 3 timing

---

### 3.4 Test Payment Reminder Sequence

**Purpose:** Verify payment reminders

```bash
curl -X POST http://localhost:3000/api/sequences/payment \
  -H "Content-Type: application/json" \
  -d '{"leadId": "lead-xxx"}'
```

**Check Database:**
```sql
SELECT * FROM scheduled_messages
WHERE lead_id = 'lead-xxx'
AND sequence_type = 'payment';
```

---

### 3.5 Test Sequence Cancellation

**Purpose:** Verify canceling sequences removes pending messages

```bash
curl -X POST http://localhost:3000/api/sequences/cancel \
  -H "Content-Type: application/json" \
  -d '{"leadId": "lead-xxx"}'
```

**Check Database:**
```sql
SELECT 
  sequence_type,
  cancelled,
  cancelled_reason,
  cancelled_at
FROM scheduled_messages
WHERE lead_id = 'lead-xxx'
AND cancelled = true;
```

**Expected:**
- All pending messages marked as `cancelled = true`
- `cancelled_reason = 'Client cancelled'` or similar

---

## Phase 4: Cron Job Testing

### 4.1 Test Scheduled Message Processing

**Purpose:** Verify cron processes and sends scheduled messages

**Setup:**
1. Create some scheduled messages
2. Set their `send_at` to past time
3. Manually trigger cron

**Manual Cron Trigger:**
```bash
# Set CRON_SECRET in .env.local first
curl -X GET http://localhost:3000/api/cron/process-scheduled \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

**Expected Response:**
```json
{
  "processed": 2,
  "sent": 2,
  "skipped": 0,
  "failed": 0,
  "timestamp": "2026-02-07T11:30:00Z"
}
```

**Check Database:**
```sql
-- Verify messages marked as sent
SELECT 
  sequence_type,
  sent,
  sent_at,
  lead_id
FROM scheduled_messages
WHERE sent = true
ORDER BY sent_at DESC
LIMIT 5;

-- Verify conversations logged
SELECT 
  content,
  message_type,
  twilio_sid
FROM conversations
WHERE message_type = 'scheduled'
ORDER BY created_at DESC
LIMIT 5;
```

---

### 4.2 Test Monthly Message Count Reset

**Purpose:** Verify counts reset on 1st of month

**Setup:**
1. Set a client's `messagesSentThisMonth` to 100
2. Manually set system date to 1st of month
3. Trigger cron

**Check Database:**
```sql
-- Before: messagesSentThisMonth = 100
-- After: messagesSentThisMonth = 0

SELECT 
  id,
  business_name,
  messages_sent_this_month
FROM clients
WHERE id = 'test-client-1';
```

---

### 4.3 Test Weekly Summary Report

**Purpose:** Verify weekly stats aggregation

**Manual Trigger:**
```bash
curl -X GET http://localhost:3000/api/cron/weekly-summary \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

**Expected Response:**
```json
{
  "success": true,
  "clientsChecked": 1,
  "emailsSent": 1,
  "weekRange": "2026-02-01 to 2026-02-07"
}
```

**Check Database:**
```sql
-- Verify daily stats exist
SELECT 
  date,
  messages_sent,
  missed_calls_captured,
  forms_responded
FROM daily_stats
WHERE client_id = 'test-client-1'
ORDER BY date DESC;
```

---

## Phase 5: Dashboard UI Testing

### 5.1 Test Authentication Flow

**Purpose:** Verify magic link login works

**Test Steps:**

1. Navigate to http://localhost:3000/login
2. Enter test client email: test@example.com
3. Check email (or terminal logs in dev mode)
4. Click magic link
5. Should redirect to dashboard

**Expected:**
- Redirected to `/dashboard`
- Session created
- Can access protected pages

**Check Session:**
```bash
# Check browser cookies
# Should have: __Secure-authjs.session-token

# Or test with curl:
curl http://localhost:3000/dashboard \
  -H "Cookie: __Secure-authjs.session-token=..."
```

---

### 5.2 Test Dashboard Overview

**Purpose:** Verify stats display correctly

**Navigate to:** http://localhost:3000/dashboard

**Verify:**
- [ ] Stats cards show correct numbers
- [ ] Recent conversations display
- [ ] Action required leads highlighted in red
- [ ] No console errors

**Expected Stats:**
- Total leads (from leads table count)
- Messages sent this month (from clients.messages_sent_this_month)
- Scheduled messages count (from scheduled_messages WHERE sent=false)
- Action required count (from leads WHERE action_required=true)

---

### 5.3 Test Leads List Page

**Purpose:** Verify leads display with status

**Navigate to:** http://localhost:3000/leads

**Verify:**
- [ ] All test leads display
- [ ] Status badges show correct colors
- [ ] Phone numbers formatted correctly
- [ ] Action required indicator (red dot) visible
- [ ] Can click to go to detail page

**Test Data Check:**
```sql
SELECT 
  id, name, phone, status, 
  action_required, updated_at
FROM leads
WHERE client_id = 'test-client-1'
ORDER BY updated_at DESC;
```

---

### 5.4 Test Lead Detail Page

**Purpose:** Verify conversation and management UI

**Navigate to:** http://localhost:3000/leads/[lead-id]

**Verify:**
- [ ] Lead info displays (name, phone, email)
- [ ] All conversations show in thread
- [ ] Outbound messages aligned right (blue)
- [ ] Inbound messages aligned left (gray)
- [ ] Message timestamps display correctly
- [ ] Reply form visible (if lead not opted out)

**Test Reply:**
1. Type message: "Testing dashboard reply"
2. Click "Send SMS"
3. Check that message appears in conversation
4. Verify sent to Twilio

**Verify in Database:**
```sql
SELECT * FROM conversations
WHERE lead_id = 'lead-xxx'
AND message_type = 'manual'
ORDER BY created_at DESC;
```

---

### 5.5 Test Action Buttons

**Purpose:** Verify sequence triggering from dashboard

**On Lead Detail Page:**

1. **Mark Resolved Button** (if action_required=true)
   - Click button
   - Verify lead.action_required becomes false
   - Button disappears

2. **Schedule Appointment Button**
   - Click to show date/time inputs
   - Enter date & time
   - Click "Confirm"
   - Verify scheduled messages created

3. **Start Estimate Follow-up**
   - Click button
   - Verify 3 scheduled messages created

4. **Request Review**
   - Click button
   - Verify 2 scheduled messages created

**Database Verification:**
```sql
-- Check updated lead status
SELECT action_required FROM leads WHERE id = 'lead-xxx';

-- Check scheduled messages
SELECT * FROM scheduled_messages
WHERE lead_id = 'lead-xxx'
ORDER BY send_at;
```

---

### 5.6 Test Conversations Page

**Purpose:** Verify all conversations display

**Navigate to:** http://localhost:3000/conversations

**Verify:**
- [ ] All conversations from all leads show
- [ ] Can click to go to lead detail
- [ ] Messages preview correctly
- [ ] Direction badge shows (inbound/outbound)
- [ ] Timestamps display

---

### 5.7 Test Scheduled Messages Page

**Purpose:** Verify pending messages display

**Navigate to:** http://localhost:3000/scheduled

**Verify:**
- [ ] All unsent, non-cancelled messages show
- [ ] Grouped by lead
- [ ] Sequence type badge displays
- [ ] Send date/time shows
- [ ] Message preview shows

---

### 5.8 Test Settings Page

**Purpose:** Verify account settings display

**Navigate to:** http://localhost:3000/settings

**Verify:**
- [ ] Business name displays
- [ ] Twilio number shows
- [ ] Message usage shows
- [ ] Monthly limit displays
- [ ] Webhook URL shows for copy

---

## Phase 6: Production Deployment Testing

### 6.1 Build for Cloudflare

**Purpose:** Verify OpenNext build succeeds

```bash
npm run cf:build
```

**Expected:**
- Build completes without errors
- `.open-next/` directory created
- `.open-next/worker.js` exists

**Check Build Output:**
```bash
ls -la .open-next/
# Should contain: worker.js, server.js, etc.
```

---

### 6.2 Test Locally with Wrangler

**Purpose:** Test Cloudflare Workers locally

```bash
npm run cf:dev
```

**Expected:**
- Server starts on http://localhost:8787
- All routes accessible
- Database queries work
- Logs visible in terminal

**Test Key Routes:**
```bash
# Test API
curl http://localhost:8787/api/test-db

# Test Auth
curl http://localhost:8787/login

# Test Dashboard
curl http://localhost:8787/dashboard \
  -H "Authorization: Bearer [session-token]"
```

---

### 6.3 Verify Environment Variables

**Purpose:** Ensure all secrets are set

```bash
# List all secrets
npx wrangler secret list

# Should show:
# DATABASE_URL
# AUTH_SECRET
# TWILIO_ACCOUNT_SID
# TWILIO_AUTH_TOKEN
# OPENAI_API_KEY
# RESEND_API_KEY
# CRON_SECRET
```

---

### 6.4 Test Cron Triggers

**Purpose:** Verify scheduled jobs work

**In Wrangler Dev:**
1. Trigger cron manually via curl:
```bash
curl -X POST http://localhost:8787/api/cron \
  -H "cf-cron: */5 * * * *" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

**Expected:**
- Processes messages
- Updates database
- Returns stats

---

## Testing Checklist

### Phase 1: Webhooks
- [ ] SMS webhook receives and responds
- [ ] Voice webhook triggers missed call SMS
- [ ] Form webhook creates leads
- [ ] Database health check works

### Phase 2: AI
- [ ] GPT-4 generates responses
- [ ] Pricing questions escalate
- [ ] Confidence scores assigned
- [ ] AI responses logged correctly

### Phase 3: Automations
- [ ] Appointment reminders scheduled
- [ ] Estimate follow-ups queued
- [ ] Review requests created
- [ ] Payment reminders scheduled
- [ ] Sequences cancel correctly

### Phase 4: Cron Jobs
- [ ] Messages process and send
- [ ] Daily stats update
- [ ] Monthly counts reset
- [ ] Weekly summary aggregates

### Phase 5: Dashboard
- [ ] Login with magic link
- [ ] Dashboard shows correct stats
- [ ] Leads display with status
- [ ] Conversations thread correctly
- [ ] Can send manual replies
- [ ] Can trigger sequences
- [ ] Settings page loads

### Phase 6: Deployment
- [ ] Build succeeds
- [ ] Wrangler local test works
- [ ] All env vars set
- [ ] Cron jobs trigger
- [ ] Production URLs respond

---

## Troubleshooting

### "Database connection failed"
```bash
# Verify DATABASE_URL is correct
echo $DATABASE_URL

# Test connection
npm run db:studio
```

### "Twilio API error"
```bash
# Verify credentials
echo $TWILIO_ACCOUNT_SID
echo $TWILIO_AUTH_TOKEN

# Check Twilio webhook settings configured correctly
```

### "OpenAI API error"
```bash
# Verify API key is valid
echo $OPENAI_API_KEY

# Check API key has text generation permissions
```

### "Auth not working"
```bash
# Verify AUTH_SECRET is set
echo $AUTH_SECRET

# Check NextAuth config in lib/auth.ts
```

### "Cron not running"
```bash
# Verify CRON_SECRET matches
# Check Cloudflare dashboard for cron logs
# Verify wrangler.toml has cron schedule
```

---

## Test Data Reset

To start fresh:

```bash
# Reset database (WARNING: deletes all data)
# 1. Go to Neon dashboard
# 2. Drop all tables
# 3. Run migrations again: npm run db:push

# OR in Drizzle Studio:
DELETE FROM scheduled_messages;
DELETE FROM conversations;
DELETE FROM leads;
DELETE FROM clients;
```

---

## Performance Testing

### Load Testing
```bash
# Install hey
brew install hey

# Test dashboard
hey -n 100 -c 10 http://localhost:3000/dashboard

# Test webhook
hey -n 1000 -c 50 -m POST \
  -H "Content-Type: application/json" \
  -d '{"test":"data"}' \
  http://localhost:3000/api/webhooks/form
```

### Expected Metrics
- Response time: <200ms
- Error rate: <1%
- Throughput: >100 req/s

---

## Monitoring in Production

Once deployed:

```bash
# View logs
npx wrangler tail

# Check metrics
# Go to Cloudflare dashboard → Workers → Your Worker

# Monitor database
npm run db:studio

# Check email delivery
# Login to Resend dashboard
```

