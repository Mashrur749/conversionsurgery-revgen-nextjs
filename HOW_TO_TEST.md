# How to Test All Phases - Quick Navigation

Choose your testing path below:

---

## 🚀 I Want to Test Everything in 30 Minutes

**Start here:** `QUICK_TEST.md`

This gives you:
- 5 min setup
- Quick tests for each phase
- Expected outputs for each test
- Success indicators

**Good for:** Quick verification, demos, testing before deployment

---

## 📖 I Want Detailed, Step-by-Step Instructions

**Start here:** `TESTING_GUIDE.md`

This includes:
- Full prerequisites and setup
- Detailed test steps for each phase
- Database queries to verify results
- curl commands for webhooks
- Troubleshooting guide
- Performance testing info

**Good for:** Thorough testing, understanding how everything works, debugging

**Topics covered:**
- Phase 1: Webhooks (Twilio SMS, voice, forms)
- Phase 2: AI sequences (response generation, escalation)
- Phase 3: Automations (appointment, estimate, review, payment)
- Phase 4: Cron jobs (processing, monthly reset, weekly summary)
- Phase 5: Dashboard (auth, pages, interactions)
- Phase 6: Deployment (build, local test, production)

---

## 🎬 I Want Real-World Testing Scenarios

**Start here:** `TESTING_SCENARIOS.md`

This walks through 9 real-world scenarios:

1. **Customer calls and doesn't leave message** → Missed call auto-response
2. **Customer fills out form** → Lead creation and first AI response
3. **Customer asks about pricing** → AI escalation detection
4. **Contractor replies via dashboard** → Manual message sending
5. **Contractor schedules appointment** → Reminders queued
6. **Start estimate follow-up** → Multi-day sequence
7. **View weekly summary** → Stats aggregation
8. **Dashboard overview** → Statistics display
9. **Cancel sequence** → Pending message cleanup

Each scenario includes:
- What happens behind the scenes
- Step-by-step test instructions
- SQL queries to verify results
- Success criteria checklist

**Good for:** End-to-end testing, validating business logic, customer demos

---

## 📋 I Want a Checklist

All testing documents include checklists. Quick version:

### Phase 1: Webhooks ✓
- [ ] SMS webhook receives and responds
- [ ] Voice webhook triggers missed call SMS
- [ ] Form webhook creates leads
- [ ] Database health check works

### Phase 2: AI ✓
- [ ] GPT-4 generates responses
- [ ] Pricing questions escalate
- [ ] Confidence scores assigned
- [ ] AI responses logged

### Phase 3: Automations ✓
- [ ] Appointment reminders scheduled
- [ ] Estimate follow-ups queued
- [ ] Review requests created
- [ ] Payment reminders scheduled
- [ ] Sequences cancel correctly

### Phase 4: Cron Jobs ✓
- [ ] Messages process and send
- [ ] Daily stats update
- [ ] Monthly counts reset
- [ ] Weekly summary aggregates

### Phase 5: Dashboard ✓
- [ ] Login with magic link works
- [ ] Dashboard shows correct stats
- [ ] Leads display with status
- [ ] Conversations thread correctly
- [ ] Can send manual replies
- [ ] Can trigger sequences
- [ ] Settings page loads

### Phase 6: Deployment ✓
- [ ] Build succeeds
- [ ] Wrangler local test works
- [ ] All env vars set
- [ ] Cron jobs trigger
- [ ] Production URLs respond

---

## 🛠️ Testing Setup

Before any testing, run:

```bash
# 1. Install dependencies
npm install

# 2. Apply database migrations
npm run db:push

# 3. Create test client in database
npm run db:studio
# Insert client record (see TESTING_GUIDE.md)

# 4. Set environment variables
cp .env.example .env.local
# Fill in your API keys

# 5. Start server
npm run dev

# 6. In another terminal, open database viewer
npm run db:studio
```

---

## 📱 Testing by Role

### 🕵️ Developer
**Testing Approach:** Deep technical testing
1. Follow `TESTING_GUIDE.md`
2. Test database integrity
3. Check TypeScript compilation
4. Verify API contracts
5. Performance test with load testing tools

### 📞 Sales/Demo Person
**Testing Approach:** Quick validation
1. Follow `QUICK_TEST.md`
2. Run through `TESTING_SCENARIOS.md`
3. Verify customer-visible features
4. Test dashboard UI
5. Check error messages are helpful

### 🏗️ Contractor/User
**Testing Approach:** Real workflows
1. Follow `TESTING_SCENARIOS.md`
2. Focus on scenarios 1-9
3. Test dashboard usability
4. Send test SMS to your phone
5. Verify appointment scheduling

### 🚀 DevOps/Deployment
**Testing Approach:** Infrastructure validation
1. Follow `DEPLOYMENT.md`
2. Test Phase 6 in `TESTING_GUIDE.md`
3. Verify environment variables
4. Build and deploy locally
5. Monitor logs and metrics

---

## ⏱️ Time Estimates

| Testing Type | Time | Best For |
|-------------|------|----------|
| Quick Test | 30 min | Fast validation |
| Full Testing | 2-3 hours | Thorough QA |
| Scenarios Only | 1 hour | Business logic |
| Deployment | 1 hour | Going live |

---

## 🔍 What Each Document Tests

```
QUICK_TEST.md
├─ Phase 1: Webhooks (1 webhook test)
├─ Phase 2: AI (2 message types)
├─ Phase 3: Automations (2 sequences)
├─ Phase 4: Cron (1 cron test)
├─ Phase 5: Dashboard (4 page tests)
└─ Phase 6: Deployment (1 build test)

TESTING_GUIDE.md
├─ Phase 1: Webhooks (4 detailed tests)
├─ Phase 2: AI (2 detailed tests)
├─ Phase 3: Automations (5 detailed tests)
├─ Phase 4: Cron (3 detailed tests)
├─ Phase 5: Dashboard (8 detailed tests)
├─ Phase 6: Deployment (4 detailed tests)
└─ Troubleshooting & Performance

TESTING_SCENARIOS.md
├─ Scenario 1: Missed calls
├─ Scenario 2: Form capture
├─ Scenario 3: Pricing escalation
├─ Scenario 4: Manual replies
├─ Scenario 5: Appointment scheduling
├─ Scenario 6: Follow-up sequences
├─ Scenario 7: Weekly summary
├─ Scenario 8: Dashboard stats
└─ Scenario 9: Sequence cancellation
```

---

## 🎯 Recommended Testing Order

### For First-Time Testing
1. Start with `QUICK_TEST.md` (30 min)
2. Run through `TESTING_SCENARIOS.md` (1 hour)
3. If issues found, use `TESTING_GUIDE.md` for details

### For Thorough Testing
1. Follow `TESTING_GUIDE.md` systematically
2. Create comprehensive test data
3. Test all edge cases
4. Run `TESTING_SCENARIOS.md` scenarios

### Before Deploying
1. Complete all tests in `TESTING_GUIDE.md`
2. Run `TESTING_SCENARIOS.md` scenarios
3. Follow Phase 6 deployment tests
4. Verify all checklists pass

---

## 📊 Success Metrics

**Phase 1 (Webhooks):** All 3 webhook types receive and process data
**Phase 2 (AI):** AI responds to >80% of messages, escalations detected
**Phase 3 (Automations):** Messages schedule at correct times, send via cron
**Phase 4 (Cron):** Scheduled messages process without errors, stats update
**Phase 5 (Dashboard):** All pages load, can trigger sequences, stats correct
**Phase 6 (Deployment):** Build succeeds, Wrangler runs, no errors in logs

---

## 🆘 If Tests Fail

1. **Check error message** in terminal or browser console
2. **Use `TESTING_GUIDE.md`** troubleshooting section
3. **Verify environment variables** are set correctly
4. **Check database connection** with `npm run db:studio`
5. **Review logs** in Cloudflare dashboard (if deployed)

---

## ✅ Testing Complete When

- [ ] All webhook tests pass
- [ ] AI generates responses correctly
- [ ] Appointment reminders schedule
- [ ] Estimate follow-ups queue correctly
- [ ] Cron processes messages
- [ ] Dashboard pages load
- [ ] Can login, view, and manage leads
- [ ] Build succeeds for Cloudflare

---

## 📚 Documentation Map

```
HOW_TO_TEST.md          ← You are here (navigation guide)
├── QUICK_TEST.md            30-min walkthrough
├── TESTING_GUIDE.md          Detailed test procedures
├── TESTING_SCENARIOS.md      Real-world workflows
├── DEPLOYMENT.md             Production deployment
├── PRODUCTION_READY.md       Readiness checklist
├── PHASE_6_SUMMARY.md        Deployment features
└── README.md                 Project overview
```

---

## 🎓 Learning Path

If you're new to the system:

1. **Understand Architecture**
   - Read `README.md`
   - Look at `PRODUCTION_READY.md` overview

2. **Follow Development**
   - Run `npm run dev`
   - Follow `QUICK_TEST.md`
   - Check database with `npm run db:studio`

3. **Deep Dive**
   - Read `TESTING_GUIDE.md`
   - Run scenarios from `TESTING_SCENARIOS.md`
   - Examine code in `src/app/api/`

4. **Deploy**
   - Follow `DEPLOYMENT.md`
   - Run Phase 6 tests
   - Monitor with `wrangler tail`

---

## 🚀 Let's Get Started

**Pick one and begin:**

1. **Fast verification?** → `QUICK_TEST.md` (30 min)
2. **Detailed testing?** → `TESTING_GUIDE.md` (2-3 hours)
3. **Real workflows?** → `TESTING_SCENARIOS.md` (1 hour)
4. **Ready to deploy?** → `DEPLOYMENT.md` (following Phase 6 tests)

All paths are valid. Choose based on your needs!

