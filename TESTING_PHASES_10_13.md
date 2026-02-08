# Complete Testing Guide: Phases 10-13

## Quick Start Testing

### 1. Start Development Server
```bash
npm run dev
```

### 2. Access Admin Dashboard
- Navigate to: `http://localhost:3000/admin/clients`
- You must be logged in as an admin user

### 3. Test Phase 13 Setup Wizard (End-to-End)

**Option A: Via Dashboard**
1. Click "+ New Client" button on `/admin/clients` page
2. Click "Start Setup Wizard"
3. Follow all 5 steps

**Option B: Direct URL**
- Navigate to: `http://localhost:3000/admin/clients/new/wizard`

---

## Step-by-Step Testing

### Phase 13a: Setup Wizard Basics

#### Step 1: Business Info
**What to test:**
- [ ] Enter business name (e.g., "Test Company Inc")
- [ ] Enter owner name (e.g., "John Smith")
- [ ] Enter email (e.g., "john@test.com")
- [ ] Enter phone (e.g., "403-555-1234")
- [ ] Select timezone from dropdown
- [ ] Enter optional Google Business URL

**Expected:**
- Form validates email format
- Clicking "Next" creates client in database
- Progress bar advances
- Step 2 indicator turns green with checkmark
- Can go back with "← Back" button

#### Step 2: Phone Number
**What to test:**
- [ ] Enter area code (e.g., "403")
- [ ] Click "Search" button
- [ ] Numbers appear (requires Twilio configured)
- [ ] Click "Select" on a number
- [ ] or Click "Skip for now →" to continue without number

**Expected:**
- Search shows available numbers
- Selection moves to Step 3
- Phone number saved for later steps
- Can go back or skip

#### Step 3: Team Members (Phase 13b)
**What to test:**
- [ ] Add team member:
  - [ ] Enter name (e.g., "Jane Doe")
  - [ ] Enter email (e.g., "jane@test.com")
  - [ ] Enter phone (e.g., "403-555-5678")
  - [ ] Select role (Manager, Lead/Sales, Support, Admin)
  - [ ] Click "Add Member"
- [ ] Member appears in list
- [ ] Click "Remove" to delete member
- [ ] Add multiple members
- [ ] Notice warning if no members added

**Expected:**
- Email validation on save attempt
- Members persist in UI
- Warning message if list empty
- Clicking "Next" saves members to database via `/api/team-members`

#### Step 4: Business Hours (Phase 13b)
**What to test:**
- [ ] For each day:
  - [ ] Toggle "Open" switch
  - [ ] If open, set opening time (e.g., "08:00")
  - [ ] If open, set closing time (e.g., "18:00")
- [ ] Toggle different days
- [ ] Notice Switch component (not checkbox)
- [ ] Closed days show "Closed" label

**Expected:**
- Switch component toggles smoothly
- Time inputs appear/disappear based on toggle
- Clicking "Next" saves hours to database via `/api/business-hours`
- Hours stored with dayOfWeek (0-6) and times

#### Step 5: Review & Launch (Phase 13b)
**What to test:**
- [ ] Review displays:
  - [ ] Business Information (name, owner, email, phone)
  - [ ] Twilio Number (if assigned)
  - [ ] Team Members list (if any)
  - [ ] Business Hours summary (as badges)
- [ ] Warnings appear if:
  - [ ] No phone number assigned
  - [ ] No team members added
- [ ] Click "🚀 Activate Client"
- [ ] Success screen appears
- [ ] Click "View Client" to see client detail page
- [ ] Click "Back to All Clients" to see list

**Expected:**
- All information displays correctly
- Activate button disabled if no phone number
- Client status changes to "active" in database
- Can navigate to client detail page
- Client appears in clients list with "active" status

---

## API Testing

### Phase 10: Admin Client Management

**Create Client via API:**
```bash
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test API Client",
    "ownerName": "Test Owner",
    "email": "test@example.com",
    "phone": "403-555-9999",
    "timezone": "America/Edmonton"
  }'
```

**List Clients:**
```bash
curl http://localhost:3000/api/admin/clients
```

**Get Client:**
```bash
curl http://localhost:3000/api/admin/clients/{clientId}
```

**Update Client:**
```bash
curl -X PATCH http://localhost:3000/api/admin/clients/{clientId} \
  -H "Content-Type: application/json" \
  -d '{"businessName": "Updated Name"}'
```

### Phase 11: Twilio Integration

**Search Numbers (requires Twilio config):**
```bash
curl "http://localhost:3000/api/admin/twilio/search?areaCode=403&country=CA"
```

**View Account Balance:**
```bash
curl http://localhost:3000/api/admin/twilio/account
```

### Phase 13: Wizard API Calls

**Save Team Member (called by Step 3):**
```bash
curl -X POST http://localhost:3000/api/team-members \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "{clientId}",
    "name": "Team Member",
    "phone": "403-555-0000",
    "email": "team@example.com",
    "role": "lead"
  }'
```

**Save Business Hours (called by Step 4):**
```bash
curl -X PUT http://localhost:3000/api/business-hours \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "{clientId}",
    "hours": [
      {"dayOfWeek": 0, "openTime": "00:00", "closeTime": "00:00", "isOpen": false},
      {"dayOfWeek": 1, "openTime": "08:00", "closeTime": "18:00", "isOpen": true},
      {"dayOfWeek": 2, "openTime": "08:00", "closeTime": "18:00", "isOpen": true}
    ]
  }'
```

---

## Expected Behavior Summary

### Complete Wizard Flow
```
Start → Business Info (creates client)
      → Phone Number (optional)
      → Team Members (saves via API)
      → Business Hours (saves via API)
      → Review & Launch (activates client)
      → Success Screen
```

### Data Persistence
1. Client created after Step 1
2. Phone number assigned (if selected)
3. Team members saved to database
4. Business hours configured
5. Client status = "active" after launch
6. All data visible on client detail page

### UI/UX Features
- Progress bar shows completion
- Step indicators turn green when complete
- Error messages for validation failures
- Loading states during async operations
- Warnings for incomplete setup
- Emoji-enhanced buttons (🧙‍♂️ 🚀 ←  →)
- Responsive design for mobile

---

## Common Issues & Solutions

### "Team members not saving"
**Issue:** Member added but not persisting
**Solution:** 
- Check browser DevTools Network tab for POST request
- Verify `/api/team-members` endpoint returns 200
- Check console for JavaScript errors

### "Business hours not saving"
**Issue:** Hours show but seem to reset
**Solution:**
- Check Network tab for PUT request to `/api/business-hours`
- Verify time format (HH:mm)
- Check for database connection issues

### "Can't activate client"
**Issue:** Activate button disabled or gives error
**Solution:**
- Phone number is required - must select one in Step 2
- Check `/api/admin/clients` PATCH endpoint works
- Verify client ID is valid

### "Wizard shows blank"
**Issue:** Wizard page loads but no content
**Solution:**
- Check admin authentication (redirect to /dashboard if not admin)
- Check browser console for errors
- Verify page route exists at `/admin/clients/new/wizard`

---

## Performance Checklist

- [ ] Pages load in < 2 seconds
- [ ] Form inputs respond instantly
- [ ] Search completes in < 3 seconds
- [ ] Database saves complete in < 1 second
- [ ] Progress bar updates smoothly
- [ ] No console errors

---

## Success Criteria

✅ **All of the following must be true:**
1. Wizard accessible from `/admin/clients/new/wizard`
2. All 5 steps render with correct content
3. Client created successfully
4. Phone number can be searched and selected
5. Team members save to database
6. Business hours save to database
7. Client activates and shows "active" status
8. All routes registered (npm run build shows them)
9. Build succeeds with 0 TypeScript errors
10. Client detail page displays saved information

