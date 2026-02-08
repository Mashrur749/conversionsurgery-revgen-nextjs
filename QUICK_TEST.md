# Quick Testing Walkthrough - 30 Minutes

## Setup (5 minutes)

```bash
# 1. Start the server
npm run dev

# 2. In another terminal, open database browser
npm run db:studio

# 3. Create test client (in Drizzle Studio)
# Copy from TESTING_GUIDE.md "Test Data in Database" section
# Insert a client with:
# - id: test-client-1
# - email: test@example.com
# - twilioNumber: your Twilio number
# - All required API keys set
```

## Phase 1: Webhooks (5 minutes)

### Test 1: Form Webhook
```bash
curl -X POST http://localhost:3000/api/webhooks/form \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "test-client-1",
    "name": "John Smith",
    "phone": "+14035551234",
    "projectType": "roof"
  }'
```
**Expected:** SMS sent to number, lead created in database

### Test 2: SMS Webhook
```bash
curl -X POST http://localhost:3000/api/webhooks/twilio/sms \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B14035551234&To=%2B15551234567&Body=How%20much%3F&MessageSid=SM123"
```
**Expected:** AI response sent, conversation logged

## Phase 2: AI (3 minutes)

Send different SMS types to your Twilio number:
1. "How much do you charge?" → Should trigger escalation
2. "Do you offer appointments?" → Should get AI response
3. "I need a quote" → Should get AI response

**Check in database:**
```sql
SELECT content, message_type, ai_confidence 
FROM conversations 
ORDER BY created_at DESC LIMIT 5;
```

## Phase 3: Automations (10 minutes)

### Test Appointment Reminder
```bash
curl -X POST http://localhost:3000/api/sequences/appointment \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "[lead-id-from-earlier]",
    "date": "2026-02-10",
    "time": "14:00"
  }'
```
**Check database:**
```sql
SELECT * FROM scheduled_messages 
WHERE lead_id = '[lead-id]' 
AND sequence_type = 'appointment';
```
**Expected:** 2 messages scheduled (24h and 1h before)

### Test Estimate Follow-up
```bash
curl -X POST http://localhost:3000/api/sequences/estimate \
  -H "Content-Type: application/json" \
  -d '{"leadId": "[lead-id]"}'
```
**Expected:** 3 messages scheduled (days 2, 5, 7)

## Phase 4: Cron (3 minutes)

### Set message in past
```sql
UPDATE scheduled_messages 
SET send_at = NOW() - INTERVAL '1 hour'
WHERE sequence_type = 'estimate'
LIMIT 1;
```

### Trigger cron
```bash
curl -X GET http://localhost:3000/api/cron/process-scheduled \
  -H "Authorization: Bearer [your-CRON_SECRET]"
```
**Expected response:**
```json
{"processed": 1, "sent": 1, "skipped": 0, "failed": 0}
```

## Phase 5: Dashboard (3 minutes)

1. Open http://localhost:3000/login
2. Enter: test@example.com
3. Check terminal logs for magic link (in dev mode)
4. Click link or copy to browser
5. You should see dashboard

**Test pages:**
- http://localhost:3000/dashboard → Should show stats
- http://localhost:3000/leads → Should list lead
- http://localhost:3000/leads/[lead-id] → Should show conversation
- http://localhost:3000/conversations → Should show messages
- http://localhost:3000/scheduled → Should show queued messages

## Phase 6: Deployment (2 minutes)

```bash
# Build for Cloudflare
npm run cf:build

# Test locally
npm run cf:dev
# Visit http://localhost:8787 in browser

# Should work exactly like npm run dev
```

---

## Success Indicators

✅ All phases working if:

1. **Webhooks:** Lead created from form, SMS received and logged
2. **AI:** Responses generated, escalations detected
3. **Automations:** Messages scheduled at correct times
4. **Cron:** Messages sent, database updated
5. **Dashboard:** Can login, see stats, trigger sequences
6. **Deployment:** Builds without errors

---

## Quick Database Checks

```sql
-- All leads created
SELECT id, name, phone, status FROM leads;

-- All conversations
SELECT * FROM conversations ORDER BY created_at DESC LIMIT 10;

-- All scheduled messages
SELECT lead_id, sequence_type, send_at, sent 
FROM scheduled_messages 
ORDER BY send_at;

-- Daily stats
SELECT date, messages_sent, missed_calls_captured 
FROM daily_stats;

-- Check client message count
SELECT id, messages_sent_this_month FROM clients;
```

---

## If Something Breaks

1. Check terminal logs for error messages
2. Run `npm run build` to catch TypeScript errors
3. Verify database connection: `npm run db:studio`
4. Check environment variables: `echo $DATABASE_URL`
5. Clear cache: `rm -rf .next`

---

## That's It!

You've now tested all 6 phases in ~30 minutes. The system is working if all tests pass.

For detailed testing, see: `TESTING_GUIDE.md`
