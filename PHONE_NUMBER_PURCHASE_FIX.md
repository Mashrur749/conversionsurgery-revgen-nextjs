# Phone Number Purchase Fix - Testing Guide

## What Was Fixed

The phone number purchase endpoint was trying to call the actual Twilio API for mock phone numbers, which caused failures.

**Solution:** Added mock number detection that skips the Twilio API call in development mode.

---

## How It Works Now

### Mock Number Detection
Mock phone numbers follow the pattern: `+1XXX5550000` to `+1XXX5559999`
- Example: `+14035550001` (Calgary)
- Example: `+17805550002` (Edmonton)

When a user selects a mock number in development:
1. System detects it's a mock number (pattern match)
2. Skips calling Twilio API
3. Directly updates the database
4. Returns success to the UI

### Real Number Purchase
When using real Twilio numbers (production):
1. System calls Twilio API to purchase
2. Configures webhooks
3. Updates database
4. Returns success

---

## Testing Steps

### Prerequisites
```bash
# Make sure you have the latest code
git pull

# Install dependencies (if needed)
npm install

# Start dev server
npm run dev
```

### Test Wizard Flow

**1. Navigate to Wizard**
- URL: `http://localhost:3000/admin/clients/new/wizard`
- Or: Admin Dashboard → "+ New Client" → "Start Setup Wizard"

**2. Step 1: Business Info**
```
Business Name: Test Company ABC
Owner Name: John Doe
Email: john@example.com
Phone: 403-555-0100
Timezone: America/Edmonton
→ Click "Next"
```

**3. Step 2: Phone Number (FIXED)**
```
Area Code: 403
→ Click "Search"
→ Should show 10 mock numbers (Calgary, AB)

Select any number (e.g., +1403555-0000)
→ Click "Select"
→ Should proceed to Step 3
```

**4. Verify in Browser Console**
Open DevTools (F12) → Console tab
You should see:
```
Purchasing phone number: +14035550000 for client: [clientId]
Phone number assigned successfully
```

**5. Verify in Server Logs**
Terminal where `npm run dev` is running should show:
```
[Twilio Purchase API] Purchasing number +14035550000 for client [clientId]
[Twilio Purchase] Assigning mock number: +14035550000
[Twilio Purchase] Successfully assigned +14035550000 to client [clientId]
[Twilio Purchase API] Success! SID: mock-555000
```

**6. Complete Remaining Steps**
```
Step 3: Add a team member (optional)
Step 4: Set business hours
Step 5: Review and activate
→ Click "🚀 Activate Client"
→ Should show success screen
```

**7. Verify Database**
The client should now have:
- `twilioNumber` set to the selected phone number
- `status` set to `'active'`
- All team members and business hours saved

---

## Debugging

### If Purchase Still Fails

**Check browser console (F12 → Console):**
- Look for error messages
- Copy the error and search for cause

**Check server logs:**
- Look for `[Twilio Purchase]` messages
- Check for any error details

**Check network tab (F12 → Network):**
1. Click on the `/api/admin/twilio/purchase` request
2. Check `Response` tab for error details
3. Check `Headers` to verify Content-Type is application/json

### Common Issues

**Issue: "Client not created yet"**
- Solution: Go back to Step 1 and complete the form first

**Issue: "Failed to purchase phone number"**
- Check server logs for specific error
- Verify clientId is valid UUID format
- Verify phone number is in format +1XXXXXXXXX

**Issue: Nothing happens when clicking "Select"**
- Check browser console for JavaScript errors
- Verify `/api/admin/twilio/purchase` endpoint is accessible
- Check network tab to see if request was made

---

## Success Criteria

✅ Phone number search returns 10 mock numbers
✅ Clicking "Select" moves to next step
✅ Client receives the phone number
✅ No API errors in logs
✅ Client status becomes "active"
✅ Team members and hours are saved

---

## Technical Details

### Files Modified
1. **src/lib/services/twilio-provisioning.ts**
   - Added `isMockPhoneNumber()` function
   - Updated `purchaseNumber()` to detect mock numbers
   - Skip Twilio API for mock numbers

2. **src/app/api/admin/twilio/purchase/route.ts**
   - Added detailed logging
   - Better error messages

3. **src/app/(dashboard)/admin/clients/new/wizard/steps/step-phone-number.tsx**
   - Enhanced error handling
   - Console logging for debugging

### Flow Diagram

```
User clicks "Select" on phone number
    ↓
handlePurchase() called with phoneNumber
    ↓
Validate clientId exists
    ↓
POST /api/admin/twilio/purchase
    ↓
purchaseNumber(phoneNumber, clientId)
    ↓
Is mock number? (matches pattern)
    ├─ YES: Skip Twilio, update DB
    └─ NO: Call Twilio API, then update DB
    ↓
Update client: set twilioNumber, status='active'
    ↓
Return success to UI
    ↓
Proceed to next step
```

---

## Next Steps

Once this is tested and working:
1. Test with real Twilio numbers (if configured)
2. Test team members saving
3. Test business hours saving
4. Test client activation
5. Verify all data persists in database

The complete wizard flow should now work end-to-end! 🎉
