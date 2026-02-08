# Phase 9: Hot Transfer System - Summary

Implement business hours-aware ring group routing for high-intent leads.

---

## 🎯 Phase Overview

**Goal**: Route high-intent leads directly to phones during business hours for real-time handoff
**Components**: 2 files
**Estimated Time**: 4 hours
**Depends On**: Phase 8 (Team Escalation System)

---

## What Gets Built

### Hot Transfer Architecture

```
Incoming SMS (High-Intent Lead)
    ↓
Check Business Hours
    ├─ If WITHIN business hours
    │   └─> Initiate Ring Group
    │       └─> Ring team phones simultaneously
    │           ├─ Phone rings
    │           ├─ Agent answers
    │           └─> Call attempt logged
    │
    └─ If OUTSIDE business hours
        └─> Escalation System (Phase 8)
            └─> Team gets SMS notification
```

### Files Modified/Created

| File | Type | Purpose |
|------|------|---------|
| `src/lib/db/schema.ts` | Modified | Add businessHours, callAttempts tables |
| `src/lib/services/hot-transfer.ts` | Created | Service functions for ring groups |
| `src/app/(dashboard)/settings/page.tsx` | Modified | Add business hours configuration UI |
| `src/app/api/webhook/ring-group/route.ts` | Created | Twilio ring group webhooks |
| `src/components/business-hours-ui.tsx` | Created | Business hours UI component |
| `src/app/api/webhook/sms/route.ts` | Modified | Integrate hot transfer decision |

---

## Implementation Steps

### Step 1: Schema & Services (09a)
Add business hours and call tracking with ring group functions.

**Files Modified**:
- `src/lib/db/schema.ts` - Add `businessHours` and `callAttempts` tables

**Tables Created**:
```sql
CREATE TABLE business_hours (
  id UUID PRIMARY KEY,
  clientId UUID NOT NULL,
  dayOfWeek INTEGER (0-6),  -- Sunday=0, Monday=1, etc
  startTime TIME NOT NULL,
  endTime TIME NOT NULL,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT now()
);

CREATE TABLE call_attempts (
  id UUID PRIMARY KEY,
  leadId UUID NOT NULL,
  clientId UUID NOT NULL,
  phone VARCHAR(20) NOT NULL,
  duration INTEGER,  -- seconds
  answered BOOLEAN,
  transferredToAgent BOOLEAN,
  createdAt TIMESTAMP DEFAULT now()
);
```

**Service Functions**:
- `isWithinBusinessHours()` - Check if now is business hours
- `initiateRingGroup()` - Start phone ringing
- `detectHotIntent()` - Determine if lead is high-intent

### Step 2: Webhooks & UI (09b)
Add Twilio webhook handlers and business hours UI.

**Files Created**:
- `src/app/api/webhook/ring-group/route.ts` - Twilio call event webhooks
- `src/components/business-hours-ui.tsx` - Business hours configuration UI

**Files Modified**:
- `src/app/(dashboard)/settings/page.tsx` - Add business hours section
- `src/app/api/webhook/sms/route.ts` - Add hot transfer logic

**Webhook Events**:
```
/api/webhook/ring-group  (from Twilio)
  ├─ ringing  - Someone answered
  ├─ answered - Agent picked up
  └─ completed - Call ended
```

---

## Implementation Checklist

### Phase 9a: Schema & Service
- [ ] Read `09a-hot-transfer-schema-services.md`
- [ ] Add `businessHours` table to schema
- [ ] Add `callAttempts` table to schema
- [ ] Create `src/lib/services/hot-transfer.ts`
- [ ] Implement `isWithinBusinessHours()`
- [ ] Implement `initiateRingGroup()`
- [ ] Implement `detectHotIntent()`
- [ ] Run `npm run db:push`
- [ ] Verify tables in `npm run db:studio`

### Phase 9b: Webhooks & UI
- [ ] Read `09b-hot-transfer-webhooks-ui.md`
- [ ] Create ring group webhook handler
- [ ] Create business hours UI component
- [ ] Add business hours section to settings
- [ ] Update SMS webhook for hot transfer logic
- [ ] Test business hours configuration
- [ ] Test ring group initiation
- [ ] Test fallback to escalation

### Testing & Verification
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] Can configure business hours in settings
- [ ] SMS within business hours triggers ring group
- [ ] SMS outside business hours uses escalation
- [ ] Call attempts logged in database
- [ ] Twilio webhooks received and processed

---

## Database Changes

### New Tables

```sql
-- Business hours for a client
CREATE TABLE business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clientId UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  dayOfWeek INTEGER NOT NULL,  -- 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime TIME NOT NULL,     -- e.g., 09:00:00
  endTime TIME NOT NULL,       -- e.g., 17:00:00
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now()
);

-- Track all call attempts
CREATE TABLE call_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leadId UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  clientId UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,  -- Team member phone
  duration INTEGER,  -- seconds
  answered BOOLEAN DEFAULT false,
  transferredToAgent BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT now()
);
```

### Indexes
```sql
CREATE INDEX idx_business_hours_client_day ON business_hours(clientId, dayOfWeek);
CREATE INDEX idx_call_attempts_lead_id ON call_attempts(leadId);
CREATE INDEX idx_call_attempts_client_id ON call_attempts(clientId);
```

---

## Key Features

### 1. Business Hours Checking
Determine if current time is within business hours.

```typescript
const isBusinessHours = await isWithinBusinessHours(clientId, timezone);

if (isBusinessHours) {
  // Ring phones
  await initiateRingGroup(leadData);
} else {
  // Fall back to team escalation
  await notifyTeamForEscalation(leadData);
}
```

### 2. Ring Group Initiation
Start simultaneous ringing to team member phones.

```typescript
await initiateRingGroup({
  leadId: lead.id,
  clientId: client.id,
  teamMembers: client.teamMembers,
  ringDuration: 30  // seconds
});
```

### 3. Business Hours UI
Configuration interface for setting hours.

```
Business Hours Configuration
├── Monday
│   ├── Start Time: [09:00] ←→ End Time: [17:00]
│   └── [Active ✓]
├── Tuesday
│   ├── Start Time: [09:00] ←→ End Time: [17:00]
│   └── [Active ✓]
└── ... (other days)
```

### 4. Call Attempt Tracking
Log all ring group attempts.

```sql
SELECT * FROM call_attempts WHERE clientId = ? ORDER BY createdAt DESC;
-- Track success rate, duration, conversion
```

---

## Architecture Diagram

```
┌────────────────────────────────────────┐
│    Incoming SMS (High-Intent)         │
│    Intent Score: 0.85 (> 0.7)
└──────────────┬─────────────────────────┘
               │
               ↓
┌────────────────────────────────────────┐
│  SMS Webhook (/api/webhook/sms)       │
│  - Call detectHotIntent()
│  - Check if high-intent
└──────────────┬─────────────────────────┘
               │
               ↓
┌────────────────────────────────────────┐
│  isWithinBusinessHours(clientId)       │
│  - Get client's timezone
│  - Get current time in that timezone
│  - Check business_hours table
└──┬─────────────────────────────┬───────┘
   │                             │
   │ YES - Business Hours        │ NO - Outside Hours
   ↓                             ↓
┌──────────────────┐  ┌─────────────────────────┐
│ initiateRingGroup │  │ notifyTeamForEscalation │
│ - Get team phones │  │ - Create claim          │
│ - Ring all phones │  │ - Send SMS to team      │
│ - Create call     │  │ - Team can claim        │
│   attempt record  │  └─────────────────────────┘
└──────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│ Twilio Event: Agent Answers          │
│ /api/webhook/ring-group              │
│ - Stop ringing other phones
│ - Update call_attempts.answered=true
│ - Connect lead to agent
└──────────────────────────────────────┘
```

---

## Common Issues & Solutions

### Issue: Business hours not being checked correctly
**Solution**: Verify timezone is correct:
```typescript
// In isWithinBusinessHours()
const now = new Date().toLocaleString('en-US', {
  timeZone: client.timezone  // Must match Olson format
});
```

### Issue: Ring group not initiating
**Solution**: Check Twilio configuration:
```bash
# Verify Twilio phone numbers in database
npm run db:studio
# Check: clients.twilioNumber is set
# Check: Team member phone numbers are set
```

### Issue: Multiple agents ringing when shouldn't
**Solution**: Ensure only one initiates per lead:
```typescript
// Check if already ringing
const recentAttempt = await db
  .select()
  .from(callAttempts)
  .where(and(
    eq(callAttempts.leadId, leadId),
    gt(callAttempts.createdAt, new Date(Date.now() - 60000))  // Last 60s
  ));

if (recentAttempt.length > 0) return; // Already ringing
```

---

## Integration Points

### With Phase 7 (Admin System)
- Admin context used to configure business hours for selected client
- Business hours UI filtered by admin's selected client

### With Phase 8 (Team Escalation)
- Falls back to team escalation outside business hours
- Both systems work together seamlessly

### With Twilio
- Configure webhook URL in Twilio:
  ```
  Voice Webhooks → Status Callback URL
  https://yourdomain.com/api/webhook/ring-group
  ```

---

## Twilio Configuration

### Required Settings

1. **Phone Numbers**
   - Main client number: Set in `clients.twilioNumber`
   - Team member numbers: Set in `teamMembers.phone`

2. **Webhooks**
   - Configure in Twilio Console:
     ```
     Account Settings → Webhooks
     Voice: Status Callback URL
     https://yourdomain.com/api/webhook/ring-group
     ```

3. **Voice Settings**
   - Enable simultaneous ringing
   - Set ring timeout (30 seconds recommended)
   - Enable call recording (optional)

---

## Performance Considerations

### Database Queries
```typescript
// Efficient: Single query with timezone calculation
const businessHours = await db
  .select()
  .from(businessHoursTable)
  .where(and(
    eq(businessHoursTable.clientId, clientId),
    eq(businessHoursTable.dayOfWeek, dayOfWeek),
    eq(businessHoursTable.isActive, true)
  ));

// Timezone conversion in application code
const now = new Date().toLocaleString('en-US', { timeZone });
```

### Call Logging
- Log asynchronously to avoid blocking
- Batch insert call_attempts if high volume
- Consider archiving old calls monthly

---

## Security Considerations

### Authorization
- Only team members can answer ring group calls
- Admin can configure business hours for their clients
- Verify phone numbers are registered team members

### Data Access
- Call attempt logs show only that calls occurred
- Don't log conversation content (Twilio handles that)
- Restrict access to call logs by client

### Twilio Security
- Use API Key for backend authentication
- Store Twilio credentials in environment variables
- Validate webhook signatures from Twilio

---

## Timezone Support

Supported timezones (Olson format):
```
America/Edmonton
America/Denver
America/Chicago
America/New_York
America/Los_Angeles
Europe/London
Europe/Paris
Australia/Sydney
Asia/Tokyo
...
```

Database stores as VARCHAR:
```typescript
timezone: varchar('timezone', { length: 50 }).default('America/Edmonton')
```

---

## Business Hours Examples

### Example 1: 9-5 Business
```
Monday-Friday: 09:00 - 17:00
Saturday: Closed
Sunday: Closed
```

### Example 2: 24/7 with Team Shifts
```
Monday-Friday: 08:00 - 20:00 (Day shift)
Monday-Friday: 20:00 - 08:00 (Night shift)
Saturday: 09:00 - 17:00
Sunday: Closed
```

### Example 3: Multiple Locations
```
Create separate client records for each location
Each with own business hours and phone number
```

---

## Testing Guide

### Test 1: Business Hours Detection
```bash
# 1. Set business hours: Monday 9-5
# 2. Set current time to: Monday 2:00 PM
# 3. Send SMS with high-intent message
# 4. Verify: Ring group initiates
# 5. Verify: call_attempts record created
```

### Test 2: Outside Hours Fallback
```bash
# 1. Set current time to: Monday 6:00 PM (after 5 PM)
# 2. Send SMS with high-intent message
# 3. Verify: Escalation notification sent (not ring group)
# 4. Verify: Escalation claim created
```

### Test 3: Agent Answer
```bash
# 1. Initiate ring group
# 2. Agent answers phone
# 3. Verify: Twilio webhook received
# 4. Verify: call_attempts.answered = true
# 5. Verify: Other phones stop ringing
```

---

## Files Reference

### 09a-hot-transfer-schema-services.md
Database schema and service functions for ring groups

### 09b-hot-transfer-webhooks-ui.md
Twilio webhooks and business hours UI

---

## Completion Criteria

Phase 9 is complete when:

✅ Business hours table exists
✅ Call attempts table exists
✅ Can configure business hours in settings
✅ SMS within business hours initiates ring group
✅ SMS outside business hours uses escalation
✅ Ring group phones receive calls
✅ Agent answering updates database
✅ Call attempts tracked and logged
✅ Build succeeds with no errors
✅ No console errors

---

## Performance Impact

### Database Load
- `isWithinBusinessHours()`: 1 query (indexed)
- `initiateRingGroup()`: 2 queries (insert + select)
- `detectHotIntent()`: No queries (AI logic only)
- Estimated: < 50ms per SMS

### Twilio Costs
- Ring group: ~$0.05 per minute per line
- Call recording: +$0.005 per minute (optional)
- SMS notification: ~$0.01 each

---

## Monitoring & Analytics

### Key Metrics to Track
- Ring group conversion rate (% leads who answered)
- Average ring group duration
- Escalation vs. hot transfer distribution
- Agent call pickup time
- Call-to-appointment conversion

### Dashboard Views
```
Hot Transfer Stats
├── Today's Ring Groups: 42
├── Answer Rate: 67%
├── Avg Ring Duration: 18s
├── Escalations (no answer): 14
└── Conv to Appt: 31%
```

---

## After Phase 9

Your system now has:

✅ Multi-client admin support (Phase 7)
✅ Team escalation claiming (Phase 8)
✅ Business hours ring groups (Phase 9)
✅ Real-time lead routing
✅ Complete lead capture solution

**You're production-ready!**

---

## Next Steps Beyond Phase 9

1. **Analytics Dashboard** - Track conversion metrics
2. **Advanced Routing** - AI-based lead scoring
3. **Mobile App** - Team member app for ring groups
4. **Reporting** - Generate client reports
5. **Integrations** - CRM, calendar, billing

---

**Last Updated**: February 7, 2026
**Status**: Ready for Implementation
**Difficulty**: High (Twilio integration, timezone handling)
**Pre-requisites**: Phase 8 Complete
