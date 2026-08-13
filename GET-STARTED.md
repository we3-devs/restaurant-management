# 🚀 Get Started with Load Testing (Right Now!)

## ✅ Complete Checklist - Do This Now

### 1️⃣ Add GitHub Secrets (2 minutes)

**Go here:** GitHub repo → Settings → Secrets and variables → Actions

**Add Secret #1:**
- Name: `RMS_ADMIN_EMAIL`
- Value: Your admin email (e.g., `admin@rms.local`)
- Click "Add secret"

**Add Secret #2:**
- Name: `RMS_ADMIN_PASSWORD`
- Value: Your admin password
- Click "Add secret"

**✓ Done!**

### 2️⃣ Run the Load Test (1 minute)

**Go here:** GitHub repo → Actions tab

**Find:** "End-to-End Realistic Load Test (With Account Setup)"

**Click:** "Run workflow" (top right, next to search)

**Choose:**
- `cleanup_after`: Select `true` (recommended - auto-deletes accounts)

**Click:** "Run workflow" button

**⏱️ Test starts! Wait ~15 minutes...**

### 3️⃣ Watch It Run (Optional - 30 seconds)

Scroll down to see real-time progress:
```
PHASE 1: Admin Authentication ✓
PHASE 2: Fetching Available Roles ✓
PHASE 3A: Creating Manager Account ✓
PHASE 3B: Creating Cashier Account ✓
PHASE 3C: Creating Waiter Account ✓
PHASE 3D: Creating Cook Account ✓
PHASE 5: Running Realistic Load Test (11 minutes)
  ... test runs ...
PHASE 6: Extract Load Test Results
✓ E2E Load Test Complete
```

### 4️⃣ Download Results (2 minutes, after test finishes)

**In the completed workflow:**
1. Scroll to **Artifacts** section
2. Download: `e2e-load-test-results-{number}.json`
3. Open in text editor or with `jq` tool

### 5️⃣ Check If It Passed (1 minute)

**Look in workflow logs for these lines:**

```
Error Rate:  0.2%  ✓ (good if < 1%)
p95 Latency: 856ms ✓ (good if < 2000ms)
p99 Latency: 1542ms ✓ (good if < 4000ms)
Success:     100%  ✓ (good if = 100%)
```

**If all have ✓:** Your API is ready! 🎉
**If any have ✗:** See troubleshooting below

---

## 📊 What You Just Did

You ran a **realistic, production-grade load test** that:

✅ Created 4 test accounts automatically (Manager, Cashier, Waiter, Cook)
✅ Assigned proper roles via API
✅ Simulated 50 concurrent restaurant staff
✅ Tested real workflows (orders, payments, kitchen, dashboards)
✅ Measured performance across all roles
✅ Cleaned up test accounts (if cleanup_after=true)

**Total time:** ~15 minutes (fully automated)

---

## ⚠️ Troubleshooting

### ❌ "Secret verification failed"
**Problem:** GitHub secrets not set up correctly

**Fix:**
1. Go to Settings → Secrets and variables → Actions
2. Check both secrets exist:
   - `RMS_ADMIN_EMAIL`
   - `RMS_ADMIN_PASSWORD`
3. Values should match your actual admin account
4. Re-run workflow

### ❌ "Admin authentication failed"
**Problem:** Admin credentials are wrong or admin account doesn't exist

**Fix:**
1. Test credentials manually:
   ```bash
   curl -X POST https://restaurant-management-g6vb.onrender.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}'
   ```
2. Should return `accessToken` and user data
3. If fails: Verify email/password are correct
4. Update secrets and retry

### ❌ Error rate > 1%
**Problem:** API is struggling under load

**Fix:**
1. Check Render dashboard (CPU, memory usage)
2. Check Supabase connection pool (should be < 13 connections)
3. Review backend logs for errors
4. Wait 30 minutes for API to cool down
5. Re-run test

### ❌ p95/p99 latency > 3 seconds
**Problem:** Queries are slow, not errors

**Fix:**
1. This is normal if API is under sustained load
2. Check database query performance
3. Look for slow queries in logs
4. Add indexes if needed
5. Re-test after optimization

### ❌ Workflow times out (> 20 minutes)
**Problem:** API is very slow or unreachable

**Fix:**
1. Check if Render is up: Visit https://restaurant-management-g6vb.onrender.com/api/health
2. Check if Supabase is up
3. Check your internet connection
4. Try again in 10 minutes (might be temporary issue)

### ❌ "Role not found"
**Problem:** Operational roles weren't seeded in database

**Fix:**
1. Go to backend directory
2. Run: `npm run seed`
3. This creates Manager, Cashier, Waiter, Cook roles
4. Retry workflow

---

## 📖 Learn More

**Need more details?**
- Read: [E2E-QUICK-START.md](.github/workflows/E2E-QUICK-START.md) (5 min)
- Read: [SETUP-E2E-WORKFLOW.md](.github/workflows/SETUP-E2E-WORKFLOW.md) (detailed)

**Want to understand results?**
- Read: [load-tests/REALISTIC-TEST-GUIDE.md](load-tests/REALISTIC-TEST-GUIDE.md)

**Want the big picture?**
- Read: [LOAD-TESTING-README.md](LOAD-TESTING-README.md)
- Read: [load-tests/COMPLETE-SETUP-SUMMARY.md](load-tests/COMPLETE-SETUP-SUMMARY.md)

**Need to create accounts manually?**
- Read: [load-tests/CREATE-TEST-ACCOUNTS.md](load-tests/CREATE-TEST-ACCOUNTS.md)

---

## 🎯 What Happens Next

### If Test Passed ✅
```
Your API handles ~50 concurrent staff comfortably
↓
Great news! You can:
  1. Deploy with confidence
  2. Document this as baseline
  3. Run before major deployments to catch regressions
  4. Schedule weekly automated tests
```

### If Test Failed ❌
```
Your API struggles under load
↓
Action items:
  1. Identify which role/workflow is failing
  2. Check database connection pool
  3. Optimize slow queries
  4. Add caching if needed
  5. Re-test after fix
  6. If still fails, investigate further
```

---

## 💡 Quick Tips

1. **Running it again?** Just click "Run workflow" in Actions again!
2. **Want to schedule it?** Edit the workflow file to add `schedule:` trigger
3. **Need to change test duration?** Edit `load-tests/rms-realistic.js` stages
4. **Testing local backend?** Change BASE_URL environment variable
5. **Want stress test?** Increase VU target from 50 to 100/200

---

## ✨ Key Takeaways

| What | Where |
|------|-------|
| Run test | Actions → End-to-End Realistic Load Test |
| Add secrets | Settings → Secrets and variables → Actions |
| Results | Artifacts after test completes |
| Troubleshoot | See above ⬆️ or review full docs |
| Learn more | LOAD-TESTING-README.md |

---

## 🎉 You're All Set!

You now have:
- ✅ Automated load testing workflow
- ✅ Real-world scenario simulation
- ✅ 4 test accounts created automatically
- ✅ Detailed per-role metrics
- ✅ Production-ready setup

**Next action:** Go to Actions → Run workflow → Wait 15 minutes → Review results

---

**Questions?** Check [LOAD-TESTING-README.md](LOAD-TESTING-README.md) or [SETUP-E2E-WORKFLOW.md](.github/workflows/SETUP-E2E-WORKFLOW.md)

**Ready?** Go to Actions now! 🚀
