# Phase 3: Core Automations - Testing Guide

**Status:** Ready to Test
**Date:** 2026-02-07
**All 12 Files Created:** ✅

---

## Files Created

### Utilities (2)
- ✅ `src/lib/utils/phone.ts` - Phone number normalization
- ✅ `src/lib/utils/templates.ts` - Message templates with rendering

### Services (2)
- ✅ `src/lib/services/twilio.ts` - SMS sending service
- ✅ `src/lib/services/openai.ts` - AI response generation with escalation

### Automation Handlers (3)
- ✅ `src/lib/automations/missed-call.ts` - Missed call handling
- ✅ `src/lib/automations/form-response.ts` - Form submission handling
- ✅ `src/lib/automations/incoming-sms.ts` - Incoming SMS + AI responses

### Webhook Routes (3)
- ✅ `src/app/api/webhooks/twilio/voice/route.ts` - Voice webhook
- ✅ `src/app/api/webhooks/twilio/sms/route.ts` - SMS webhook
- ✅ `src/app/api/webhooks/form/route.ts` - Form webhook

### Environment
- ✅ `.env.local` - All credentials configured (Twilio, OpenAI, Resend, DB)

---

## Pre-Testing Checklist

### 1. Verify Dependencies

```bash
npm list twilio openai zod libphonenumber-js
```

Expected output: All packages installed ✅

### 2. Check Database Client

Ensure `src/db/index.ts` exports the database connection properly:

```typescript
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

### 3. Verify Twilio Number in Database

Log into Neon Console and update your test client:

```sql
-- Update the test client with your Twilio phone number
UPDATE clients
SET twilio_number = '+1403XXX1234'  -- Use your actual Twilio number in E.164
WHERE id = 'your-test-client-uuid';

-- Verify it's set
SELECT id, business_name, twilio_number, status FROM clients LIMIT 1;
```

### 4. Check Environment Variables

Verify `.env.local` has all required keys:
```env
DATABASE_URL=postgresql://...
AUTH_SECRET=...
AUTH_URL=...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
OPENAI_API_KEY=sk-proj-...
RESEND_API_KEY=re_...
EMAIL_FROM=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Start Dev Server

```bash
npm run dev
```

Should start cleanly on port 3000.

---

## Test Scenarios

### Test 1: Missed Call Automation

**Setup:**
1. Have a Twilio number assigned to a test client
2. Client has `notification_sms` and `notification_email` enabled

**Steps:**
1. Call your Twilio number from any phone
2. Let it ring 5+ seconds and hang up (don't answer)
3. Wait 5 seconds

**Expected Results:**
- ✅ SMS sent to caller with missed call template
- ✅ New lead created in `leads` table with source='missed_call'
- ✅ Conversation logged in `conversations` table
- ✅ Daily stats updated (`missed_calls_captured`, `messages_sent`)
- ✅ Contractor notified (SMS to contractor phone)
- ✅ Webhook response: 200 with empty TwiML

**Database Check:**
```sql
SELECT * FROM leads ORDER BY created_at DESC LIMIT 1;
SELECT * FROM conversations WHERE lead_id = 'lead-id-here' ORDER BY created_at;
SELECT * FROM daily_stats WHERE client_id = 'client-id' ORDER BY date DESC LIMIT 1;
```

---

### Test 2: Form Submission

**Setup:**
1. Have your client ID ready

**Via curl:**
```bash
curl -X POST http://localhost:3000/api/webhooks/form \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "your-test-client-uuid-here",
    "name": "John Smith",
    "phone": "+14035551234",
    "email": "john@example.com",
    "message": "Need a kitchen remodel",
    "projectType": "Kitchen",
    "address": "123 Main St, Calgary"
  }'
```

**Expected Results:**
- ✅ HTTP 200 response
- ✅ Response JSON: `{ processed: true, leadId: "...", isNewLead: true }`
- ✅ SMS sent to form submitter with form_response template
- ✅ Lead created with source='form'
- ✅ Conversation entries for form + SMS response
- ✅ Daily stats: `forms_responded` incremented
- ✅ Contractor notified

**Failure Cases to Test:**
```bash
# Invalid phone
curl -X POST http://localhost:3000/api/webhooks/form \
  -H "Content-Type: application/json" \
  -d '{"clientId": "...", "phone": "123"}'
# Expected: 400 error

# Missing required fields
curl -X POST http://localhost:3000/api/webhooks/form \
  -H "Content-Type: application/json" \
  -d '{"clientId": "..."}'
# Expected: 400 error
```

---

### Test 3: Incoming SMS → AI Response

**Setup:**
1. Client must have Twilio number configured
2. OpenAI API key must be valid
3. Test leads should exist in database

**Steps:**
1. Text your Twilio number: "What's the soonest you could start?"
2. Wait 3-5 seconds

**Expected Results:**
- ✅ Incoming SMS logged as conversation (direction='inbound')
- ✅ AI generates response (not an escalation trigger)
- ✅ SMS sent back with AI response
- ✅ Outbound conversation logged with `message_type='ai_response'`
- ✅ `ai_confidence` recorded (0.5-1.0)
- ✅ Daily stats updated
- ✅ Contractor notified (non-urgent SMS)

**Check Response in Database:**
```sql
SELECT * FROM conversations
WHERE lead_id = 'lead-id'
ORDER BY created_at DESC
LIMIT 5;
```

---

### Test 4: Incoming SMS → Escalation Trigger

**Setup:**
Same as Test 3

**Steps:**
1. Text your Twilio number: "What's the price for a full bathroom remodel?"
2. Wait 3-5 seconds

**Expected Results:**
- ✅ Incoming SMS logged
- ✅ **Escalation triggered** (contains "price")
- ✅ `escalation_ack` template sent to lead
- ✅ Lead marked: `status='action_required'`, `action_required=true`
- ✅ Contractor notified **urgently** (different SMS)
- ✅ **NO AI response sent** (escalation = human takes over)

**Check in Database:**
```sql
SELECT id, status, action_required, action_required_reason
FROM leads
WHERE phone = '+1403xxx1234';

-- Should show: status='action_required', action_required=true
```

---

### Test 5: Opt-Out Flow

**Setup:**
Existing lead that already has conversations

**Steps:**
1. Text your Twilio number: "STOP"
2. Wait 2 seconds

**Expected Results:**
- ✅ Incoming STOP logged
- ✅ Phone number added to `blocked_numbers` with reason='opt_out'
- ✅ Lead marked: `status='opted_out'`, `opted_out=true`
- ✅ All `scheduled_messages` for this lead cancelled
- ✅ `opt_out_confirmation` SMS sent
- ✅ No contractor notification (automatic)

**Verify in Database:**
```sql
-- Check blocked numbers
SELECT * FROM blocked_numbers
WHERE client_id = 'client-id'
AND phone = '+1403xxx1234';

-- Check lead status
SELECT id, status, opted_out, opted_out_at
FROM leads
WHERE phone = '+1403xxx1234';

-- Check scheduled messages cancelled
SELECT * FROM scheduled_messages
WHERE lead_id = 'lead-id'
AND cancelled = true;
```

---

### Test 6: Extended Conversation (3+ Exchanges)

**Setup:**
1. Create a lead via any method
2. Have conversation history with 3+ back-and-forths

**Steps:**
1. Send 1st message: "Hi, what services do you offer?"
2. Get AI response back
3. Send 2nd message: "Do you do exterior work?"
4. Get AI response back
5. Send 3rd message: "What about deck staining?"

**Expected Results:**
- ✅ After 3+ messages (6+ conversation history):
  - **Escalation triggered** (conversation too long)
  - Escalation acknowledgment sent
  - Lead marked `action_required`

---

### Test 7: Phone Number Normalization

Test via database queries or logs:

```bash
# Test 1: Canadian format
normalizePhoneNumber("403-555-1234", "CA")
# Expected: "+14035551234"

# Test 2: US format
normalizePhoneNumber("(201) 555-0123")
# Expected: "+12015550123"

# Test 3: With +1
normalizePhoneNumber("+1 (403) 555-1234")
# Expected: "+14035551234"
```

Check logs:
```bash
npm run dev 2>&1 | grep "normalized"
```

---

### Test 8: Template Rendering

Quick test in Node REPL or test file:

```typescript
import { renderTemplate } from '@/lib/utils/templates';

const result = renderTemplate('missed_call', {
  ownerName: 'Mike',
  businessName: 'Revival Renovations',
});

console.log(result);
// Expected: "Hey, this is Mike from Revival Renovations. Sorry I missed your call..."
```

---

## ngrok Setup (For Local Webhook Testing)

To test Twilio webhooks locally, use ngrok:

```bash
# Install (if not already)
brew install ngrok  # macOS
# or
choco install ngrok  # Windows
# or
apt install ngrok    # Linux

# Start ngrok tunnel
ngrok http 3000
```

Output will show:
```
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000
```

### Configure Twilio Webhooks

1. Go to Twilio Console: https://console.twilio.com
2. Phone Numbers → Manage → Active Numbers
3. Click your test number
4. Under "Voice & Fax":
   - "A CALL COMES IN" → Webhook → `https://abc123.ngrok.io/api/webhooks/twilio/voice`
   - Method: POST
5. Under "Messaging":
   - "A MESSAGE COMES IN" → Webhook → `https://abc123.ngrok.io/api/webhooks/twilio/sms`
   - Method: POST
6. Save

Now calls and SMS will trigger your local webhooks.

---

## Expected Database State After Testing

### leads table
```
id          | phone         | client_id | source      | status           | action_required
lead-1      | +14035551234  | client-1  | missed_call | new              | false
lead-2      | +14035551235  | client-1  | form        | new              | false
lead-3      | +14035551236  | client-1  | sms         | action_required  | true
```

### conversations table
```
id          | lead_id | direction  | message_type   | content            | created_at
conv-1      | lead-1  | outbound   | sms            | "Hey, this is..." | 2026-02-07...
conv-2      | lead-2  | inbound    | form           | "[Form] Need..." | 2026-02-07...
conv-3      | lead-2  | outbound   | sms            | "Hey John..." | 2026-02-07...
conv-4      | lead-3  | inbound    | sms            | "What's price?" | 2026-02-07...
conv-5      | lead-3  | outbound   | escalation     | "Let me get..." | 2026-02-07...
```

### blocked_numbers table
```
client_id | phone         | reason   | created_at
client-1  | +14035551237  | opt_out  | 2026-02-07...
```

### daily_stats table
```
client_id | date       | missed_calls_captured | messages_sent | conversations_started
client-1  | 2026-02-07 | 1                     | 5             | 2
```

---

## Troubleshooting

### Issue: "No client found for Twilio number"
**Cause:** Client's `twilio_number` not set or doesn't match incoming webhook number
**Fix:**
```sql
UPDATE clients SET twilio_number = '+1403XXX1234' WHERE id = '...';
```

### Issue: "Failed to send SMS"
**Cause:** Twilio credentials invalid or account out of credits
**Fix:**
1. Check `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in `.env.local`
2. Verify Twilio account has credits: https://console.twilio.com/account/billing

### Issue: "OpenAI error"
**Cause:** Invalid API key or rate limited
**Fix:**
1. Check `OPENAI_API_KEY` in `.env.local` (must start with `sk-proj-`)
2. Verify API key has credits: https://platform.openai.com/account/billing/overview

### Issue: "Cannot find module '@/db'"
**Cause:** Path alias not configured or `src/db/index.ts` missing
**Fix:** Run `npm run dev` again or rebuild: `npm run build`

### Issue: AI response takes 5+ seconds
**Cause:** OpenAI API latency
**Fix:** Normal. Twilio will timeout after 10 seconds. Consider using a queue for AI processing (Phase 4).

---

## Next Steps After Testing

1. **Verify all 8 test scenarios pass**
2. **Create test client with real Twilio phone number**
3. **Set up ngrok tunnels for production domain**
4. **Configure Twilio webhooks in live Twilio account**
5. **Test with real calls/SMS**
6. **Monitor logs and database growth**
7. **Proceed to Phase 4: Sequence Automations**

---

## Phase 3 Complete Checklist

- [ ] All 12 files created and syntax valid
- [ ] Dependencies installed: `npm list twilio openai zod libphonenumber-js`
- [ ] Dev server starts: `npm run dev`
- [ ] Build succeeds: `npm run build`
- [ ] Test 1: Missed call automation ✅
- [ ] Test 2: Form submission ✅
- [ ] Test 3: Incoming SMS + AI ✅
- [ ] Test 4: Escalation trigger ✅
- [ ] Test 5: Opt-out flow ✅
- [ ] Test 6: Extended conversation ✅
- [ ] Test 7: Phone normalization ✅
- [ ] Test 8: Template rendering ✅
- [ ] Twilio webhooks configured
- [ ] Production domain webhook URLs set

---

## Commands Reference

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Check dependencies
npm list twilio openai zod libphonenumber-js

# View logs
npm run dev 2>&1 | tail -f

# Test form endpoint
curl -X POST http://localhost:3000/api/webhooks/form \
  -H "Content-Type: application/json" \
  -d '{"clientId":"...","phone":"+14035551234"}'
```

---

**Status:** Phase 3 Implementation Complete ✅
**Ready for Testing:** YES
**Target Completion:** 2026-02-07
