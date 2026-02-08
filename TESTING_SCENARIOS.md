# Testing Scenarios - Real-World Workflows

This document walks through realistic testing scenarios with expected outcomes.

---

## Scenario 1: Customer Calls and Doesn't Leave Message

### What Happens
```
1. Customer calls Twilio number
2. Phone rings 30 seconds
3. Customer hangs up (voicemail not enabled)
4. System detects missed call
5. SMS sent automatically
6. New lead created in database
```

### Test Steps

1. **Call Setup**
   - Get your Twilio number from database
   - Have a phone ready

2. **Make Call**
   - Call the number
   - Let it ring for 10-15 seconds
   - Hang up (don't leave message)

3. **Verify Results**
   
   **SMS Received:**
   - Your phone should get message within 5 seconds
   - Message: "Thanks for reaching out! We'll get back to you ASAP."

   **Database:**
   ```sql
   SELECT id, phone, name, status, created_at 
   FROM leads 
   WHERE source = 'missed_call'
   ORDER BY created_at DESC 
   LIMIT 1;
   ```
   **Expected:** New lead with status='new', source='missed_call'

### Success Criteria ✓
- [ ] SMS received within 5 seconds
- [ ] Lead created in database
- [ ] Lead status is 'new'
- [ ] Source is 'missed_call'

---

## Scenario 2: Customer Fills Out Form

### What Happens
```
1. Customer fills out contact form on website
2. Form data sent to webhook
3. Confirmation SMS sent
4. Lead created with 'new' status
5. AI-ready for first message response
```

### Test Steps

1. **Send Form Data**
   ```bash
   curl -X POST http://localhost:3000/api/webhooks/form \
     -H "Content-Type: application/json" \
     -d '{
       "clientId": "test-client-1",
       "name": "Sarah Johnson",
       "phone": "+14035559999",
       "email": "sarah@example.com",
       "projectType": "kitchen_remodel",
       "address": "456 Oak Ave"
     }'
   ```

2. **Check Results**
   
   **Database:**
   ```sql
   SELECT id, phone, name, project_type, address, status
   FROM leads 
   WHERE phone = '+14035559999';
   ```
   **Expected:** Lead created with all form data

3. **Send First Message**
   - Text the number: "When can you start?"
   
   **Check AI Response:**
   ```sql
   SELECT content, message_type, ai_confidence
   FROM conversations
   WHERE lead_id = (SELECT id FROM leads WHERE phone = '+14035559999')
   ORDER BY created_at DESC;
   ```

### Success Criteria ✓
- [ ] Webhook accepts form data
- [ ] Lead created with all fields
- [ ] AI responds to first message
- [ ] Conversation logged with correct type

---

## Scenario 3: Customer Asks About Pricing

### What Happens
```
1. Customer texts: "How much does a roof cost?"
2. AI detects pricing question
3. Message escalated (not answered by AI)
4. High-confidence escalation flag set
5. Lead marked as action_required
6. Contractor gets alert
```

### Test Steps

1. **Send Pricing Question**
   - Text your Twilio number: "How much does a roof cost?"

2. **Verify Escalation**
   ```sql
   SELECT 
     content, 
     message_type, 
     ai_confidence,
     direction
   FROM conversations
   WHERE direction = 'outbound'
   AND created_at > NOW() - INTERVAL '5 minutes'
   ORDER BY created_at DESC;
   ```
   **Expected:** message_type = 'escalation', ai_confidence < 0.5

3. **Check Lead Status**
   ```sql
   SELECT id, action_required, action_required_reason
   FROM leads
   WHERE phone = '+14035559999';
   ```
   **Expected:** action_required = true, reason = 'escalation_detected'

### Success Criteria ✓
- [ ] Message detected as escalation
- [ ] Lead marked action_required
- [ ] Low confidence score assigned
- [ ] Contractor can see in dashboard

---

## Scenario 4: Contractor Replies to Customer via Dashboard

### What Happens
```
1. Contractor logs into dashboard
2. Sees lead with action_required
3. Clicks reply button
4. Types custom message
5. SMS sent via Twilio
6. Marked as 'manual' in database
7. action_required flag cleared
```

### Test Steps

1. **Access Dashboard**
   - Navigate to http://localhost:3000/dashboard
   - Enter email: test@example.com
   - Click magic link (check console logs for link)

2. **Go to Lead**
   - Click on leads showing action_required (red flag)
   - Click "Action Required" lead

3. **Send Reply**
   - In reply form, type: "Thanks for your inquiry! A roof typically costs $8-15k. Would you like a free estimate?"
   - Click "Send SMS"
   - Should see message appear in conversation

4. **Verify in Database**
   ```sql
   SELECT 
     content, 
     message_type, 
     direction,
     twilio_sid
   FROM conversations
   WHERE lead_id = '[lead-id]'
   AND message_type = 'manual'
   ORDER BY created_at DESC;
   ```
   **Expected:** Message logged with twilio_sid

5. **Check Lead Status**
   ```sql
   SELECT action_required FROM leads WHERE id = '[lead-id]';
   ```
   **Expected:** action_required = false

### Success Criteria ✓
- [ ] Can login with magic link
- [ ] Can see leads with action_required
- [ ] Can send manual reply
- [ ] Message sent to customer
- [ ] action_required cleared automatically

---

## Scenario 5: Contractor Schedules Appointment

### What Happens
```
1. Contractor opens lead detail
2. Clicks "Schedule Appointment"
3. Selects date and time
4. 2 reminders scheduled:
   - 24 hours before
   - 1 hour before
5. Messages queued in system
6. Automatic sends when time comes
```

### Test Steps

1. **On Lead Detail Page**
   - Click "📅 Schedule Appointment"
   - Select date: 2 days from now
   - Select time: 2:00 PM

2. **Verify Scheduled**
   ```sql
   SELECT 
     sequence_type,
     send_at,
     content,
     sent
   FROM scheduled_messages
   WHERE lead_id = '[lead-id]'
   AND sequence_type = 'appointment'
   ORDER BY send_at;
   ```
   **Expected:**
   - 2 messages created
   - First: 24 hours before scheduled time
   - Second: 1 hour before scheduled time

3. **Simulate Time Passing**
   - Update message to send in past:
   ```sql
   UPDATE scheduled_messages
   SET send_at = NOW() - INTERVAL '1 minute'
   WHERE sequence_type = 'appointment'
   AND lead_id = '[lead-id]'
   LIMIT 1;
   ```

4. **Trigger Cron**
   ```bash
   curl http://localhost:3000/api/cron/process-scheduled \
     -H "Authorization: Bearer [CRON_SECRET]"
   ```

5. **Verify Sent**
   ```sql
   SELECT 
     sequence_type,
     sent,
     sent_at
   FROM scheduled_messages
   WHERE lead_id = '[lead-id]'
   AND sequence_type = 'appointment'
   AND sent = true;
   ```

### Success Criteria ✓
- [ ] Can schedule appointment from dashboard
- [ ] 2 reminders created at correct times
- [ ] Cron sends messages on schedule
- [ ] Messages logged in conversations

---

## Scenario 6: Start Estimate Follow-up Sequence

### What Happens
```
1. Contractor clicks "Start Estimate Follow-up"
2. System creates 3 messages:
   - Day 2: "Did you receive the estimate?"
   - Day 5: "Any questions about the estimate?"
   - Day 7: "Ready to move forward?"
3. Messages sent automatically on schedule
4. Customer can reply, AI responds
```

### Test Steps

1. **Trigger Sequence**
   - On lead detail page
   - Click "💰 Start Estimate Follow-up"

2. **Verify Scheduled**
   ```sql
   SELECT 
     step_number,
     send_at,
     content
   FROM scheduled_messages
   WHERE lead_id = '[lead-id]'
   AND sequence_type = 'estimate'
   ORDER BY send_at;
   ```
   **Expected:**
   - 3 messages
   - Days 2, 5, 7 from today

3. **Trigger Manually (for testing)**
   ```sql
   UPDATE scheduled_messages
   SET send_at = NOW() - INTERVAL '1 minute'
   WHERE sequence_type = 'estimate'
   AND lead_id = '[lead-id]'
   LIMIT 1;
   ```

4. **Run Cron**
   ```bash
   curl http://localhost:3000/api/cron/process-scheduled \
     -H "Authorization: Bearer [CRON_SECRET]"
   ```

5. **Check Sent**
   ```sql
   SELECT step_number, sent, sent_at
   FROM scheduled_messages
   WHERE lead_id = '[lead-id]'
   AND sequence_type = 'estimate'
   ORDER BY sent_at;
   ```

### Success Criteria ✓
- [ ] 3 messages scheduled
- [ ] Correct timing (days 2, 5, 7)
- [ ] Messages send via cron
- [ ] Tracked in database

---

## Scenario 7: View Weekly Summary

### What Happens
```
1. Monday 7am UTC, cron runs
2. Weekly stats aggregated
3. For each client:
   - Count missed calls captured
   - Count form submissions
   - Count messages sent
   - List completed sequences
4. Summary would email (when integrated)
```

### Test Steps

1. **Create Test Activity**
   - Create multiple conversations
   - Create multiple scheduled messages
   - Mark some as sent
   - Create daily stats entries

2. **Trigger Weekly Summary**
   ```bash
   curl http://localhost:3000/api/cron/weekly-summary \
     -H "Authorization: Bearer [CRON_SECRET]"
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

3. **Check Aggregated Stats**
   ```sql
   SELECT 
     date,
     messages_sent,
     missed_calls_captured,
     forms_responded
   FROM daily_stats
   WHERE client_id = 'test-client-1'
   ORDER BY date DESC;
   ```

### Success Criteria ✓
- [ ] Cron runs without errors
- [ ] Stats aggregated correctly
- [ ] Email preparation works
- [ ] Correct client checked

---

## Scenario 8: Dashboard Overview Statistics

### What Happens
```
1. Contractor logs into dashboard
2. Sees 7-day overview:
   - Total leads
   - Messages sent this month
   - Scheduled messages pending
   - Leads requiring action
   - Recent conversations
3. Can see trends and priorities
```

### Test Steps

1. **Create Test Data**
   ```sql
   -- Update clients to simulate activity
   UPDATE clients 
   SET messages_sent_this_month = 250
   WHERE id = 'test-client-1';

   -- Create some daily stats
   INSERT INTO daily_stats (client_id, date, messages_sent, missed_calls_captured)
   VALUES 
     ('test-client-1', CURRENT_DATE, 15, 3),
     ('test-client-1', CURRENT_DATE - INTERVAL '1 day', 12, 2);
   ```

2. **View Dashboard**
   - Go to http://localhost:3000/dashboard
   - Should see all stats updated

3. **Verify Calculations**
   ```sql
   -- Total leads
   SELECT COUNT(*) as total_leads FROM leads 
   WHERE client_id = 'test-client-1';

   -- Messages this month
   SELECT messages_sent_this_month FROM clients 
   WHERE id = 'test-client-1';

   -- Pending scheduled
   SELECT COUNT(*) as pending FROM scheduled_messages
   WHERE client_id = 'test-client-1'
   AND sent = false
   AND cancelled = false;

   -- Action required
   SELECT COUNT(*) as action_required FROM leads
   WHERE client_id = 'test-client-1'
   AND action_required = true;
   ```

### Success Criteria ✓
- [ ] Dashboard loads without errors
- [ ] Stats display correct numbers
- [ ] Can see recent conversations
- [ ] Action required leads highlighted

---

## Scenario 9: Cancel a Sequence

### What Happens
```
1. Contractor realizes follow-up not needed
2. Clicks sequence cancel option
3. All pending messages marked cancelled
4. No more messages sent
5. Lead notes updated
```

### Test Steps

1. **Have Pending Messages**
   - Create estimate follow-up (3 messages queued)
   - Verify in database

2. **Cancel Sequence**
   ```bash
   curl -X POST http://localhost:3000/api/sequences/cancel \
     -H "Content-Type: application/json" \
     -d '{"leadId": "[lead-id]"}'
   ```

3. **Verify Cancelled**
   ```sql
   SELECT 
     sequence_type,
     cancelled,
     cancelled_reason,
     cancelled_at
   FROM scheduled_messages
   WHERE lead_id = '[lead-id]'
   AND sequence_type = 'estimate';
   ```
   **Expected:** All marked cancelled=true

4. **Verify No More Sends**
   - Try to trigger cron
   ```bash
   curl http://localhost:3000/api/cron/process-scheduled \
     -H "Authorization: Bearer [CRON_SECRET]"
   ```
   **Expected:** These messages skipped

### Success Criteria ✓
- [ ] Can cancel sequences
- [ ] Messages marked cancelled
- [ ] No longer sent by cron
- [ ] Notes updated

---

## Test Completion Checklist

After running all scenarios:

- [ ] Scenario 1: Missed call auto-response working
- [ ] Scenario 2: Form capture and lead creation working
- [ ] Scenario 3: AI escalation detecting pricing questions
- [ ] Scenario 4: Manual replies from dashboard sending
- [ ] Scenario 5: Appointment scheduling and reminders working
- [ ] Scenario 6: Multi-day follow-up sequences working
- [ ] Scenario 7: Weekly summary aggregating data
- [ ] Scenario 8: Dashboard showing correct statistics
- [ ] Scenario 9: Sequence cancellation preventing sends

**If all pass:** System is production-ready! 🚀

