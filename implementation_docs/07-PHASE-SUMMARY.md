# Phase 7: Admin System - Summary

Complete admin functionality implementation for multi-client management.

---

## 🎯 Phase Overview

**Goal**: Enable admins to manage multiple clients from a single account
**Components**: 3 files
**Estimated Time**: 2 hours
**Depends On**: Phases 1-6

---

## What Gets Built

### Admin System Architecture

```
User (with isAdmin flag)
    ↓
Admin Context Provider
    ↓
Client Selector Dropdown
    ↓
Dashboard Pages (filtered by selected client)
```

### Files Modified/Created

| File | Type | Purpose |
|------|------|---------|
| `src/lib/db/schema.ts` | Modified | Add `isAdmin` field to users table |
| `src/types/next-auth.d.ts` | Modified | Update session types for admin |
| `src/lib/admin-context.tsx` | Created | Global admin state management |
| `src/components/client-selector.tsx` | Created | Dropdown for client selection |
| `src/lib/get-client-id.ts` | Created | Helper to get current client ID |
| `src/app/(dashboard)/layout.tsx` | Modified | Add client selector to header |
| `src/app/(dashboard)/page.tsx` | Modified | Filter data by selected client |
| `src/app/(dashboard)/conversations/page.tsx` | Modified | Filter data by selected client |
| `src/app/(dashboard)/settings/page.tsx` | Modified | Filter data by selected client |

---

## Implementation Steps

### Step 1: Database Schema (07a)
Add admin flag to users table and update TypeScript types.

**Files**:
- `src/lib/db/schema.ts` - Add `isAdmin: boolean('is_admin').default(false)`
- `src/types/next-auth.d.ts` - Add `isAdmin: boolean` to user type

**Verification**:
```bash
npm run db:push  # Push migration
npm run db:studio  # Verify field exists
```

### Step 2: Admin UI Components (07b)
Create context provider and client selector component.

**Files Created**:
- `src/lib/admin-context.tsx` - Context for managing selected client
- `src/components/client-selector.tsx` - Dropdown UI component
- `src/lib/get-client-id.ts` - Helper function

**Key Functions**:
```typescript
getClientId() // Get currently selected client ID
useAdminContext() // Access admin context
```

### Step 3: Dashboard Updates (07c)
Update all dashboard pages to support admin view.

**Files Modified**:
- `src/app/(dashboard)/layout.tsx` - Add client selector to header
- `src/app/(dashboard)/page.tsx` - Filter leads by client
- `src/app/(dashboard)/conversations/page.tsx` - Filter conversations by client
- `src/app/(dashboard)/settings/page.tsx` - Show settings for selected client

**Changes**:
- Use `getClientId()` in all dashboard pages
- Filter database queries by `clientId`
- Show client selector in header

---

## Implementation Checklist

### Phase 7a: Schema & Auth
- [ ] Read `07a-admin-schema-auth.md`
- [ ] Update `src/lib/db/schema.ts` with `isAdmin` field
- [ ] Update `src/types/next-auth.d.ts` with admin type
- [ ] Run `npm run db:push`
- [ ] Verify with `npm run db:studio`
- [ ] Check TypeScript errors: `npm run type-check`

### Phase 7b: UI Components
- [ ] Read `07b-admin-ui-components.md`
- [ ] Create `src/lib/admin-context.tsx`
- [ ] Create `src/components/client-selector.tsx`
- [ ] Create `src/lib/get-client-id.ts`
- [ ] Test rendering: `npm run dev`
- [ ] Verify no TypeScript errors

### Phase 7c: Dashboard Integration
- [ ] Read `07c-admin-dashboard-pages.md`
- [ ] Update `src/app/(dashboard)/layout.tsx`
- [ ] Update `src/app/(dashboard)/page.tsx`
- [ ] Update `src/app/(dashboard)/conversations/page.tsx`
- [ ] Update `src/app/(dashboard)/settings/page.tsx`
- [ ] Test all pages: `npm run dev`

### Testing & Verification
- [ ] Build completes successfully: `npm run build`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] Admin context renders without errors
- [ ] Client selector dropdown opens and closes
- [ ] Switching clients updates dashboard data
- [ ] Admin can view multiple clients' data

---

## Database Changes

### New Schema Fields

```sql
-- Added to users table
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT false;
```

### Indexes
No new indexes required - admin system uses existing lead/conversation indexes.

---

## Type Changes

### NextAuth Session Type

**Before**:
```typescript
interface Session {
  user?: {
    id: string;
    email: string;
    name: string;
    clientId: string;
  };
}
```

**After**:
```typescript
interface Session {
  user?: {
    id: string;
    email: string;
    name: string;
    clientId: string;
    isAdmin: boolean;  // NEW
  };
}
```

---

## Key Features

### 1. Admin Context Provider
Manages which client the admin is currently viewing.

```typescript
interface AdminContext {
  selectedClientId: string | null;
  setSelectedClientId: (id: string) => void;
  isAdmin: boolean;
}
```

### 2. Client Selector Component
Dropdown showing all clients the admin owns/manages.

```typescript
<ClientSelector
  clients={adminClients}
  onChange={handleClientChange}
/>
```

### 3. Helper Functions
```typescript
// Get current client ID (admin or regular user)
const clientId = getClientId(session, adminContext);

// Use in database queries
const leads = await db
  .select()
  .from(leads)
  .where(eq(leads.clientId, clientId));
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│         User Login (Admin)              │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│    AdminContextProvider Wraps App      │
│  - Sets selectedClientId from localStorage
│  - Provides useAdminContext hook
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│      Dashboard Layout Component         │
│  - Renders ClientSelector dropdown
│  - Shows current client name
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│   Dashboard Pages (Leads, Conv, etc)   │
│  - Call getClientId() to get current
│  - Filter queries by clientId
│  - Display client-specific data
└─────────────────────────────────────────┘
```

---

## Common Issues & Solutions

### Issue: Admin field not appearing after migration
**Solution**:
```bash
npm run db:push
npm run db:studio  # Verify manually
```

### Issue: Client selector doesn't update dashboard
**Solution**: Ensure `useAdminContext()` is called in pages, not just layout
```typescript
const { selectedClientId } = useAdminContext();
const leads = await fetchLeads(selectedClientId);
```

### Issue: Multiple admins seeing same clients
**Solution**: Client selector should only show clients associated with that admin. Check:
```typescript
// In ClientSelector component
const adminClients = clients.filter(c => c.adminId === userId);
```

---

## Performance Notes

### Query Optimization
- All queries already use indexes on `clientId`
- No N+1 queries if using `select()` properly
- Consider caching client list in localStorage

### State Management
- Admin context uses React Context (sufficient for single-level depth)
- Selected client stored in localStorage for persistence
- Consider Redux/Zustand if complexity grows

---

## Security Considerations

### Authorization
- Only admins can switch between clients
- Regular users always use their `clientId` from session
- Verify `isAdmin` flag before allowing client selection

### Data Access
- All database queries must filter by `clientId`
- Use `getClientId()` consistently across app
- Audit admin actions if needed later

---

## Integration Points

### With Phase 8 (Team Escalation)
- Admin context used to show team members for selected client
- Team escalation filtered by admin's selected client

### With Phase 9 (Hot Transfer)
- Business hours configured per client
- Admin context used to select which client's settings to edit

---

## Files Reference

### 07a-admin-schema-auth.md
First implementation file - covers database schema changes

### 07b-admin-ui-components.md
Second implementation file - covers UI components

### 07c-admin-dashboard-pages.md
Third implementation file - covers dashboard integration

---

## Completion Criteria

Phase 7 is complete when:

✅ Admin users have `isAdmin = true` in database
✅ Client selector appears in dashboard header
✅ Admin can switch between clients
✅ Dashboard data changes when switching clients
✅ All pages filter data by selected client
✅ Build succeeds with no TypeScript errors
✅ No console errors in browser
✅ localStorage persists client selection

---

## Next Phase

After completing Phase 7:
- All pages support admin view
- Foundation ready for team escalation (Phase 8)
- Multi-client support fully functional

**Move to Phase 8**: [Team Escalation System](./08a-team-schema-service.md)

---

**Last Updated**: February 7, 2026
**Status**: Ready for Implementation
**Difficulty**: Medium (requires database changes + context setup)
**Pre-requisites**: Phases 1-6 Complete
