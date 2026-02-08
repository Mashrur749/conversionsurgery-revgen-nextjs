# Quick Start Guide - Phases 7-9 Implementation

Fast reference for getting started with implementing Phases 7, 8, and 9.

---

## 🚀 3-Step Quick Start

### Step 1: Choose Your Phase
```
Phase 7: Admin System                 (2 hours)
Phase 8: Team Escalation System       (3 hours)
Phase 9: Hot Transfer System          (4 hours)

MUST IMPLEMENT IN ORDER: 7 → 8 → 9
```

### Step 2: Read Phase Summary
- Phase 7 → Read [07-PHASE-SUMMARY.md](./07-PHASE-SUMMARY.md)
- Phase 8 → Read [08-PHASE-SUMMARY.md](./08-PHASE-SUMMARY.md)
- Phase 9 → Read [09-PHASE-SUMMARY.md](./09-PHASE-SUMMARY.md)

### Step 3: Follow Implementation Files
Each phase has 2-3 implementation files in order (a → b → c)

---

## 📂 File Structure at a Glance

```
PHASE 7 (Admin System)
├── 07a-admin-schema-auth.md       ← Database schema changes
├── 07b-admin-ui-components.md     ← Create UI components
└── 07c-admin-dashboard-pages.md   ← Update dashboard

PHASE 8 (Team Escalation)
├── 08a-team-schema-service.md     ← Database + service functions
├── 08b-claim-pages-sms-update.md  ← Create pages + SMS integration
└── 08c-team-members-ui.md         ← Add team management UI

PHASE 9 (Hot Transfer)
├── 09a-hot-transfer-schema-services.md   ← Database + ring groups
└── 09b-hot-transfer-webhooks-ui.md       ← Webhooks + UI
```

---

## ⏱️ Timeline

### Day 1: Phase 7a
**Duration**: 1-2 hours
**What**: Update schema, add isAdmin field
**Files**:
- Modify: `src/lib/db/schema.ts`
- Modify: `src/types/next-auth.d.ts`
- Run: `npm run db:push`

### Day 2: Phase 7b
**Duration**: 1-2 hours
**What**: Create admin context and client selector
**Files**:
- Create: `src/lib/admin-context.tsx`
- Create: `src/components/client-selector.tsx`
- Create: `src/lib/get-client-id.ts`

### Day 3: Phase 7c
**Duration**: 1-2 hours
**What**: Update dashboard to support admin view
**Files**:
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: All dashboard pages to use `getClientId()`

### Day 4: Phase 8a
**Duration**: 1-2 hours
**What**: Add team and escalation tables
**Files**:
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/services/team-escalation.ts`
- Run: `npm run db:push`

### Day 5: Phase 8b
**Duration**: 1-2 hours
**What**: Create claim pages and integrate SMS
**Files**:
- Create: `src/app/(dashboard)/claims/page.tsx`
- Create: `src/app/(dashboard)/claims/[id]/page.tsx`
- Create: `src/app/api/claim/route.ts`
- Modify: `src/app/api/webhook/sms/route.ts`

### Day 6: Phase 8c
**Duration**: 1-2 hours
**What**: Add team member management
**Files**:
- Create: `src/app/api/team-members/route.ts`
- Create: `src/app/api/team-members/[id]/route.ts`
- Create: `src/components/team-members-ui.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`

### Day 7: Phase 9a
**Duration**: 1-2 hours
**What**: Add business hours and call tracking
**Files**:
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/services/hot-transfer.ts`
- Run: `npm run db:push`

### Day 8: Phase 9b
**Duration**: 1-2 hours
**What**: Add webhooks and business hours UI
**Files**:
- Create: `src/app/api/webhook/ring-group/route.ts`
- Create: `src/components/business-hours-ui.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`
- Modify: `src/app/api/webhook/sms/route.ts`

---

## 🔧 Commands You'll Need

```bash
# After making schema changes
npm run db:push              # Apply migrations

# When you're done
npm run type-check          # Check for TypeScript errors
npm run build              # Production build
npm run dev                # Start dev server for testing

# To review database
npm run db:studio          # Open Drizzle Studio

# When stuck
npm run dev                # Check console for errors
# Open browser DevTools to see client errors
```

---

## ✅ Verification Checklist

### After Each Step (a, b, c)

- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] Dev server runs: `npm run dev`
- [ ] No console errors in browser
- [ ] Feature works as described
- [ ] Database schema correct: `npm run db:studio`

### After Each Phase (7, 8, 9)

- [ ] All 3 steps (a, b, c) complete
- [ ] Full build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] Can start dev server: `npm run dev`
- [ ] Feature fully integrated
- [ ] Ready to move to next phase

---

## 🎯 What Gets Built

### Phase 7 Delivers
✅ Admin can switch between clients
✅ Dashboard shows selected client's data
✅ All pages filter by selected client

### Phase 8 Delivers
✅ Can add team members in settings
✅ High-intent SMS creates escalation claim
✅ Team members get notifications
✅ Team can claim leads from claims page

### Phase 9 Delivers
✅ Can configure business hours
✅ SMS within hours triggers ring group
✅ SMS outside hours uses escalation
✅ Calls logged to database

---

## 🆘 Quick Troubleshooting

**Build fails after changes**
```bash
npm run type-check        # See specific errors
npm run db:studio         # Verify schema
```

**Database won't migrate**
```bash
npm run db:generate       # Create migration
npm run db:push           # Apply it
```

**Feature not working**
1. Check browser console (F12)
2. Check server logs: `npm run dev`
3. Check database: `npm run db:studio`

**Can't see admin context**
- Verify context provider wraps app in layout
- Verify `useAdminContext()` called in pages

**Claims page empty**
- Check SMS webhook is calling escalation service
- Verify claims table has data: `npm run db:studio`
- Check query is filtering by correct clientId

**Ring group not triggering**
- Verify business hours configured
- Check SMS webhook calls hot-transfer service
- Verify Twilio phone numbers set in database

---

## 📚 When You Need More Detail

| Need | Go To |
|------|-------|
| Full overview | [README.md](./README.md) |
| All files listed | [INDEX.md](./INDEX.md) |
| Phase overview | [XX-PHASE-SUMMARY.md](./07-PHASE-SUMMARY.md) |
| Step-by-step | [XXa/XXb/XXc files](./07a-admin-schema-auth.md) |
| Architecture | Phase summary (has diagrams) |
| Troubleshooting | Phase summary (common issues section) |

---

## 🚀 You're Ready!

1. Open the summary file for your phase
2. Work through steps a, b, c
3. Verify with the checklist
4. Move to next phase
5. Repeat until Phase 9 complete

**Total time**: ~9 hours of work
**Difficulty**: Medium to High
**Result**: Production-ready admin system

---

## 💡 Pro Tips

- ✅ Commit after each step (7a, 7b, 7c, etc.)
- ✅ Test before moving to next step
- ✅ Keep dev server running in one terminal
- ✅ Use `npm run db:studio` frequently to verify
- ✅ Read error messages carefully
- ✅ Reference phase summary's architecture diagram when confused

---

**Last Updated**: February 7, 2026
**Status**: Ready to implement
**Estimated Time**: 9 hours total
