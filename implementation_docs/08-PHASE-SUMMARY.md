# Phase 8: Team Escalation System - Summary

Implement team-based lead escalation and claiming system.

---

## 🎯 Phase Overview

**Goal**: Route high-intent leads to team members for claiming and ownership
**Components**: 3 files
**Estimated Time**: 3 hours
**Depends On**: Phase 7 (Admin System)

---

## What Gets Built

### Team Escalation Architecture

```
Incoming SMS (High-Intent Lead)
    ↓
Escalation Detection
    ↓
Create Escalation Claim
    ↓
Notify Team Members
    ↓
Team Member Claim Lead
    ↓
Lead Assigned to Team Member
```

### Files Modified/Created

| File | Type | Purpose |
|------|------|---------|
| `src/lib/db/schema.ts` | Modified | Add teamMembers, escalationClaims tables |
| `src/lib/services/team-escalation.ts` | Created | Service functions for escalation |
| `src/app/(dashboard)/claims/page.tsx` | Created | List escalation claims |
| `src/app/(dashboard)/claims/[id]/page.tsx` | Created | Claim details page |
| `src/app/api/claim/route.ts` | Created | API for claiming escalations |
| `src/app/api/team-members/route.ts` | Created | API for managing team |
| `src/app/api/team-members/[id]/route.ts` | Created | API for team member CRUD |
| `src/components/team-members-ui.tsx` | Created | UI for team management |
| `src/app/api/webhook/sms/route.ts` | Modified | Integrate team escalation |
| `src/app/(dashboard)/settings/page.tsx` | Modified | Add team members section |

---

## Implementation Steps

### Step 1: Database Schema (08a)
Add team and escalation tables with service functions.

**Files Modified**:
- `src/lib/db/schema.ts` - Add `teamMembers` and `escalationClaims` tables

**Tables Created**:
```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY,
  clientId UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50),
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT now()
);

CREATE TABLE escalation_claims (
  id UUID PRIMARY KEY,
  leadId UUID NOT NULL,
  clientId UUID NOT NULL,
  escalatedAt TIMESTAMP DEFAULT now(),
  claimedBy UUID,  -- teamMember ID
  claimedAt TIMESTAMP,
  resolved BOOLEAN DEFAULT false
);
```

**Service Functions**:
- `notifyTeamForEscalation()` - Send notifications to team
- `claimEscalation()` - Team member claims a lead

### Step 2: Claim Pages & SMS Integration (08b)
Create UI for claims and integrate with incoming SMS.

**Files Created**:
- `src/app/(dashboard)/claims/page.tsx` - List unclaimed leads
- `src/app/(dashboard)/claims/[id]/page.tsx` - Claim detail view
- `src/app/api/claim/route.ts` - API endpoint for claiming

**API Endpoints**:
```
GET /api/claim            # List claims
POST /api/claim           # Claim a lead
GET /api/claim/[id]       # Get claim details
```

**SMS Integration**:
When high-intent lead arrives:
1. Create escalation claim
2. Notify all active team members
3. First team member to claim gets the lead
4. Other notifications cleared

### Step 3: Team Members UI (08c)
Add team member management to settings.

**Files Created**:
- `src/app/api/team-members/route.ts` - GET/POST team members
- `src/app/api/team-members/[id]/route.ts` - PATCH/DELETE team members
- `src/components/team-members-ui.tsx` - UI component

**API Endpoints**:
```
GET /api/team-members         # List team
POST /api/team-members        # Add member
PATCH /api/team-members/[id]  # Update member
DELETE /api/team-members/[id] # Remove member
```

---

## Implementation Checklist

### Phase 8a: Schema & Service
- [ ] Read `08a-team-schema-service.md`
- [ ] Add `teamMembers` table to schema
- [ ] Add `escalationClaims` table to schema
- [ ] Create `src/lib/services/team-escalation.ts`
- [ ] Implement `notifyTeamForEscalation()`
- [ ] Implement `claimEscalation()`
- [ ] Run `npm run db:push`
- [ ] Verify tables in `npm run db:studio`

### Phase 8b: Claim Pages & SMS
- [ ] Read `08b-claim-pages-sms-update.md`
- [ ] Create claims pages (list and detail)
- [ ] Create `/api/claim` route
- [ ] Integrate with SMS webhook
- [ ] Test claim creation and notification
- [ ] Verify claims appear in dashboard

### Phase 8c: Team UI
- [ ] Read `08c-team-members-ui.md`
- [ ] Create team members API routes
- [ ] Create team UI component
- [ ] Add team section to settings page
- [ ] Test adding/removing team members
- [ ] Test team member notifications

### Testing & Verification
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] Team members can be added in settings
- [ ] SMS to high-intent number creates claim
- [ ] Team members receive notifications
- [ ] Claiming a lead assigns it
- [ ] Claims show in claims page

---

## Database Changes

### New Tables

```sql
-- Team members for a client
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clientId UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50),  -- 'manager', 'agent', etc
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now()
);

-- Escalation claims for leads
CREATE TABLE escalation_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leadId UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  clientId UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  escalatedAt TIMESTAMP DEFAULT now(),
  claimedBy UUID REFERENCES team_members(id) ON DELETE SET NULL,
  claimedAt TIMESTAMP,
  resolved BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT now()
);
```

### Indexes
```sql
CREATE INDEX idx_team_members_client_id ON team_members(clientId);
CREATE INDEX idx_escalation_claims_client_id ON escalation_claims(clientId);
CREATE INDEX idx_escalation_claims_lead_id ON escalation_claims(leadId);
CREATE INDEX idx_escalation_claims_claimed_by ON escalation_claims(claimedBy);
```

---

## Key Features

### 1. Team Escalation Service
Handles escalation logic and notifications.

```typescript
// Notify team when high-intent lead arrives
await notifyTeamForEscalation({
  leadId: lead.id,
  clientId: client.id,
  leadName: lead.name,
  teamMembers: client.teamMembers
});

// Team member claims the lead
await claimEscalation({
  claimId: claim.id,
  teamMemberId: teamMember.id
});
```

### 2. Claims Page
Shows unclaimed and claimed leads for team members.

```
Escalation Claims
├── Unclaimed (showing new leads)
│   ├── Lead 1
│   ├── Lead 2
│   └── Lead 3
├── My Claims (team member's claimed leads)
│   ├── Claimed Lead 1
│   └── Claimed Lead 2
└── Team Claims (all team's claims)
    └── ...
```

### 3. Team Member Management
Add/remove/manage team members in settings.

```
Team Members
├── Add Team Member button
├── Team List
│   ├── Name | Email | Phone | Role | Active | Actions
│   ├── John Smith | john@... | 555-1234 | Agent | ✓ | Edit | Remove
│   └── Jane Doe | jane@... | 555-5678 | Manager | ✓ | Edit | Remove
└── Manage roles and permissions
```

---

## Architecture Diagram

```
┌──────────────────────────────────────────┐
│       Incoming SMS (High-Intent)         │
└────────────────┬─────────────────────────┘
                 │
                 ↓
┌──────────────────────────────────────────┐
│    SMS Webhook (/api/webhook/sms)       │
│  - Detect high-intent (intent > 0.7)
└────────────────┬─────────────────────────┘
                 │
                 ↓
┌──────────────────────────────────────────┐
│  notifyTeamForEscalation()               │
│  - Create escalation claim
│  - Get team members for client
│  - Send SMS/Email to team
└────────────────┬─────────────────────────┘
                 │
                 ↓
┌──────────────────────────────────────────┐
│      Team Member Receives Alert          │
│  - SMS: "New high-intent lead: John"
│  - Link to claims page
└────────────────┬─────────────────────────┘
                 │
                 ↓
┌──────────────────────────────────────────┐
│    Claims Page (/dashboard/claims)       │
│  - Shows unclaimed escalation claims
│  - Team member clicks "Claim"
└────────────────┬─────────────────────────┘
                 │
                 ↓
┌──────────────────────────────────────────┐
│    claimEscalation() API                 │
│  - Update escalation_claims.claimedBy
│  - Set claimedAt timestamp
│  - Return success
└────────────────┬─────────────────────────┘
                 │
                 ↓
┌──────────────────────────────────────────┐
│    Lead is Now Assigned                  │
│  - Dashboard shows claimed lead
│  - Team member can follow up
└──────────────────────────────────────────┘
```

---

## Common Issues & Solutions

### Issue: Team members not receiving notifications
**Solution**: Verify in database that:
```bash
npm run db:studio
# Check: teamMembers table has correct clientId
# Check: escalationClaims created with correct leadId
```

### Issue: Claims not appearing in claims page
**Solution**: Ensure claims page filters by current client:
```typescript
const claims = await db.select()
  .from(escalationClaims)
  .where(eq(escalationClaims.clientId, clientId));
```

### Issue: Multiple teams getting notified incorrectly
**Solution**: Verify SMS webhook properly detects intent:
```typescript
if (confidence > ESCALATION_THRESHOLD) {
  await notifyTeamForEscalation(leadData);
}
```

---

## Integration Points

### With Phase 7 (Admin System)
- Admin context used to filter claims by selected client
- Team members only show for selected client
- Claims page respects admin's client selection

### With Phase 9 (Hot Transfer)
- High-intent leads can bypass team escalation
- Can go directly to ring group if within business hours
- Escalation as fallback if ring group not applicable

---

## Performance Considerations

### Database Queries
```typescript
// Efficient: Single query with relations
const claims = await db
  .select()
  .from(escalationClaims)
  .where(eq(escalationClaims.clientId, clientId))
  .leftJoin(leads, eq(leads.id, escalationClaims.leadId))
  .leftJoin(teamMembers, eq(teamMembers.id, escalationClaims.claimedBy));

// Inefficient: N+1 queries - avoid!
const claims = await db.select().from(escalationClaims);
for (const claim of claims) {
  const lead = await getLead(claim.leadId);  // BAD!
}
```

### Notifications
- Use async notifications (don't wait for email/SMS)
- Queue notifications if needed for high volume
- Consider rate limiting per team member

---

## Security Considerations

### Authorization
- Only authenticated users can claim
- Can only claim leads for their client
- Admin can view all claims for managed clients

### Data Access
- Team members see only their client's claims
- Admins see all claims for managed clients
- Regular users don't see escalation claims

### Notification Privacy
- Don't include sensitive lead data in SMS
- Use links to app instead of inline details
- Verify recipient before sending

---

## Files Reference

### 08a-team-schema-service.md
Database schema and service functions

### 08b-claim-pages-sms-update.md
UI pages and SMS integration

### 08c-team-members-ui.md
Team management UI component

---

## Completion Criteria

Phase 8 is complete when:

✅ Team members table exists in database
✅ Escalation claims table exists
✅ Can add team members in settings
✅ High-intent SMS creates escalation claim
✅ Team members notified of new claims
✅ Claiming a lead works
✅ Claims page shows escalations
✅ Build succeeds with no errors
✅ No console errors

---

## Next Phase

After completing Phase 8:
- Team can receive and claim leads
- Escalation system fully functional
- Ready for hot transfer routing (Phase 9)

**Move to Phase 9**: [Hot Transfer System](./09a-hot-transfer-schema-services.md)

---

**Last Updated**: February 7, 2026
**Status**: Ready for Implementation
**Difficulty**: Medium-High (complex notification logic)
**Pre-requisites**: Phase 7 Complete
