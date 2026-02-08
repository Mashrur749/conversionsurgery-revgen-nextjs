# Comprehensive Testing Guide for Phases 7-9

**Last Updated**: February 8, 2026  
**Status**: Ready for Testing  
**Estimated Time**: 2-3 hours for full end-to-end testing

---

## 📋 Quick Start

1. **Prerequisites**: `npm run db:push && npm run dev`
2. **Test Data**: Ensure admin user, test clients, team members exist
3. **Run Each Phase**: Follow tests 7.1-7.6, 8.1-8.6, 9.1-9.10
4. **Verify Webhooks**: Test Twilio integration with curl/Postman
5. **End-to-End**: Complete workflows from SMS through escalation/claim

---

## Phase 7: Admin System Testing

### 7.1 Database Admin Flag
```sql
SELECT id, email, is_admin FROM users LIMIT 5;
```
✓ Admin user has `is_admin = true`  
✓ Regular users have `is_admin = false`

### 7.2 NextAuth Session
```bash
npx tsx test-session.ts  # See PHASE_7_8_9_IMPLEMENTATION.md for file content
```
✓ Session includes `isAdmin` field  
✓ Session includes `selectedClientId`

### 7.3 Admin Context Provider
- [ ] Dashboard loads without errors
- [ ] No TypeScript errors in IDE
- [ ] Client selector component renders

### 7.4 Client Selector UI
- [ ] Visible on dashboard for admin users
- [ ] Shows list of available clients
- [ ] Clicking client updates selected client
- [ ] Dashboard data filters to selected client
- [ ] Selection persists on page refresh

### 7.5 Multi-Client Data Isolation
- [ ] Select Client A: See Client A data only
- [ ] Select Client B: See Client B data (different from A)
- [ ] Switch back to A: Same data as before
- [ ] No cross-client data leakage

### 7.6 Regular Users Cannot Switch
- [ ] Login as non-admin user
- [ ] Client selector NOT visible
- [ ] No way to switch clients
- [ ] User locked to single client

---

## Phase 8: Team Escalation Testing

### 8.1 Database - Team Members Table
```sql
SELECT id, client_id, name, phone, receive_escalations, priority FROM team_members LIMIT 5;
```
✓ Table exists with all columns  
✓ Index on client_id  
✓ Default values set

### 8.2 Database - Escalation Claims Table
```sql
SELECT id, lead_id, client_id, claim_token, status FROM escalation_claims LIMIT 5;
```
✓ Table exists with all columns  
✓ Unique constraint on claim_token  
✓ Indexes created

### 8.3 Token Generation
```bash
npx tsx test-token-generation.ts
```
✓ Tokens are 64 characters (hex format)  
✓ Each token is unique  
✓ No generation errors

### 8.4 GET /api/claims
```bash
curl -X GET http://localhost:3000/api/claims \
  -H "Cookie: [session-cookie]"
```
✓ Returns 200 with escalations for user's client  
✓ Returns 401 without authentication  
✓ Escalations properly filtered by client

### 8.5 POST /api/claims/claim
```bash
curl -X POST http://localhost:3000/api/claims/claim \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_TOKEN"}'
```
✓ Valid token: Returns 200, escalation marked claimed  
✓ Invalid token: Returns 400  
✓ Each token claimed only once

### 8.6 Complete Escalation Workflow
1. Send high-intent SMS: "I need help ASAP callback"
2. Check escalation created: `SELECT * FROM escalation_claims WHERE status='pending'`
3. Team receives SMS with claim link
4. Team member clicks link or calls API
5. Verify: `SELECT claimed_by FROM escalation_claims` shows team member ID

---

## Phase 9: Hot Transfer Testing

### 9.1 Database - Business Hours Table
```sql
SELECT day_of_week, open_time, close_time, is_open FROM business_hours 
WHERE client_id='TEST_CLIENT' ORDER BY day_of_week;
```
✓ 7 rows (one per day)  
✓ Mon-Fri: open_time='09:00', close_time='17:00'  
✓ Sat-Sun: is_open=false

### 9.2 Database - Call Attempts Table
```sql
SELECT id, status, answered_by, duration FROM call_attempts LIMIT 5;
```
✓ Table created with all columns  
✓ Indexes on lead_id, client_id, status  
✓ Status values: ringing, answered, no-answer

### 9.3 Business Hours Service
```bash
npx tsx test-business-hours.ts
```
✓ Correctly identifies within/outside business hours  
✓ Timezone conversion works  
✓ Returns false on weekends

### 9.4 High-Intent Detection
```bash
npx tsx test-hot-transfer.ts
```
✓ Detects: "callback", "ASAP", "urgent", "quote", "estimate"  
✓ Ignores: "hello", "checking in", "send email"

### 9.5 Ring Group Webhook - Test All Events

**Ringing Event**:
```bash
curl -X POST http://localhost:3000/api/webhook/ring-group \
  -d "CallId=ca123&CallStatus=ringing"
```
✓ Call attempt created with status='ringing'

**Answered Event**:
```bash
curl -X POST http://localhost:3000/api/webhook/ring-group \
  -d "CallId=ca123&CallStatus=answered&AnsweredBy=tm1&CallDuration=300"
```
✓ Status changed to 'answered'  
✓ Team member ID recorded  
✓ Duration recorded (300 sec)

**Missed Event**:
```bash
curl -X POST http://localhost:3000/api/webhook/ring-group \
  -d "CallId=ca123&CallStatus=no-answer"
```
✓ Status changed to 'no-answer'  
✓ ended_at timestamp set  
✓ Fallback escalation created

### 9.6 Routing During Business Hours
1. Set business hours: Mon-Fri 8AM-6PM
2. Send high-intent SMS during these hours
3. Check logs: `[Hot Transfer] Initiating ring group to X team members`
4. Verify call_attempts: `status='ringing'` NOT escalation

### 9.7 Routing After Business Hours
1. Set business hours: future time (e.g., 22:00-23:00)
2. Send high-intent SMS now
3. Check logs: `[Hot Transfer] Outside business hours, using escalation`
4. Verify escalation_claims created instead of call_attempts

### 9.8 No Team Available Fallback
1. Deactivate all team: `UPDATE team_members SET is_active=false`
2. Send high-intent SMS during business hours
3. Check logs: `[Hot Transfer] No team members available, using escalation`
4. Verify escalation created, call_attempts NOT created
5. Re-activate: `UPDATE team_members SET is_active=true`

---

## Complete End-to-End Workflows

### SMS → Escalation → Claim (After Hours)
**Duration**: ~10 minutes

1. Trigger high-intent SMS: "I need immediate callback ASAP"
2. Verify routing decision in logs (should be escalation, not ring-group)
3. Team member receives SMS with claim link
4. Team member claims via link or API
5. Verify database: escalation status='claimed', claimed_by set
6. Verify dashboard shows escalation as claimed

### Ring Group → Answered (During Hours)
**Duration**: ~15 minutes

1. Set business hours to current time
2. Send high-intent SMS: "How much for your service urgent?"
3. Verify call_attempts created with status='ringing'
4. Simulate webhook: answered by team member after 300 seconds
5. Verify call_attempts updated: status='answered', duration=300
6. Verify dashboard shows call history with team member name

---

## Verification Checklist

### Phase 7 Admin System
- [ ] isAdmin field exists on users table
- [ ] Admin flag in NextAuth session
- [ ] Admin context provider works
- [ ] Client selector visible for admins only
- [ ] Dashboard data filters by selected client
- [ ] No cross-client data leakage

### Phase 8 Team Escalation  
- [ ] team_members table created correctly
- [ ] escalation_claims table created correctly
- [ ] Secure tokens generated (64 hex chars)
- [ ] GET /api/claims returns pending escalations
- [ ] POST /api/claims/claim claims escalation
- [ ] Complete workflow: SMS→Escalation→SMS→Claim works
- [ ] Team receives SMS with claim link
- [ ] Claims filtered by client

### Phase 9 Hot Transfer
- [ ] business_hours table created correctly
- [ ] call_attempts table created correctly
- [ ] isWithinBusinessHours() returns correct value
- [ ] detectHighIntent() identifies patterns
- [ ] During hours: routes to ring-group
- [ ] After hours: routes to escalation
- [ ] No team: routes to escalation (fallback)
- [ ] Webhook records: answered calls with duration
- [ ] Webhook records: missed calls
- [ ] Webhook returns proper TwiML response

### Integration
- [ ] Phase 7 affects Phase 8 (client isolation)
- [ ] Phase 8 uses Phase 7 (client context)
- [ ] Phase 9 uses Phase 8 (escalation fallback)
- [ ] Complete E2E workflow works
- [ ] All migrations applied
- [ ] Build succeeds without errors

---

## Quick Troubleshooting

| Issue | Check | Fix |
|-------|-------|-----|
| Client selector not showing | isAdmin=true in DB | Restart dev server |
| GET /api/claims returns 401 | Session cookie sent | Check NextAuth setup |
| High-intent not detected | Message has keywords | Test with patterns from service |
| Webhook not recording | Endpoint exists, CallId provided | Check server logs |
| Business hours always false | Business hours records exist | Verify times in DB |
| Ring group never initiates | Team members active & available | Check team_members table |

---

## Testing Resources

**Test Files to Create**:
- `test-session.ts` - Verify NextAuth session includes admin flag
- `test-token-generation.ts` - Verify secure token generation
- `test-business-hours.ts` - Verify business hours checking
- `test-hot-transfer.ts` - Verify high-intent detection & routing

**Useful SQL Queries**:
```sql
-- Check all Phase 7-9 tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('users', 'team_members', 'escalation_claims', 'business_hours', 'call_attempts');

-- Verify migrations applied
SELECT name FROM "_drizzle_migrations" 
WHERE name LIKE '000[234]%' ORDER BY name;

-- Check for data integrity
SELECT COUNT(*) FROM team_members WHERE client_id NOT IN (SELECT id FROM clients);
SELECT COUNT(*) FROM escalation_claims WHERE status='pending' LIMIT 10;
SELECT COUNT(*) FROM call_attempts WHERE status='answered' LIMIT 10;
```

**API Testing with Curl**:
```bash
# Test authentication
curl -X GET http://localhost:3000/api/claims -v

# Test claim
curl -X POST http://localhost:3000/api/claims/claim \
  -H "Content-Type: application/json" \
  -d '{"token":"your_token"}'

# Test webhooks
curl -X POST http://localhost:3000/api/webhook/ring-group \
  -d "CallId=test123&CallStatus=answered&AnsweredBy=tm1&CallDuration=60"
```

---

**All tests ready! Run through each phase systematically and document any issues.** ✅

