# E2E Load Test - Quick Start (5 minutes to run)

## 1️⃣ Add GitHub Secrets (One-time Setup)

Go to: **GitHub** → **Settings** → **Secrets and variables** → **Actions**

Add 2 secrets:
- `RMS_ADMIN_EMAIL` = `admin@rms.local` (your admin email)
- `RMS_ADMIN_PASSWORD` = `your_admin_password` (your admin password)

✓ Done

## 2️⃣ Run the Workflow

Go to: **Actions** → **End-to-End Realistic Load Test (With Account Setup)**

Click: **Run workflow** (dropdown, top right)

Options:
- `cleanup_after`: Select `true` (delete accounts after test) or `false` (keep for review)

Click: **Run workflow** button

**Test starts! ⏱️ Wait ~15 minutes...**

## 3️⃣ What Happens Automatically

```
✓ Admin logs in
✓ Fetches available roles
✓ Creates 4 test accounts:
  - Manager account
  - Cashier account
  - Waiter account
  - Cook account
✓ Assigns roles to each
✓ Runs 50-VU load test (11 minutes)
✓ Generates report
✓ Optional: Deletes accounts
```

## 4️⃣ Check Results

In workflow run, scroll to **Artifacts** section

Download: `e2e-load-test-results-{run-id}.json`

### Quick Check ✓

Look for these in the workflow logs:

```
Error Rate:  0.2%     ✓ (should be < 1%)
p95:         856ms    ✓ (should be < 2000ms)
p99:         1542ms   ✓ (should be < 4000ms)
Checks:      100%     ✓ (should be 100%)
```

## Expected Output

```
========================================
PHASE 1: Admin Authentication
========================================
✓ Admin authenticated successfully

========================================
PHASE 2: Fetching Available Roles
========================================
✓ Roles found: Manager(2), Cashier(3), Waiter(4), Cook(5)

========================================
PHASE 3A: Creating Manager Account
========================================
✓ Manager user created (ID: 42, Email: test-manager-1723123456@rms.local)
✓ Manager role assigned

✓ E2E Load Test Complete
========================================

Summary:
  1. ✓ Admin authentication
  2. ✓ Fetched roles
  3. ✓ Created 4 test accounts
  4. ✓ Ran 50-VU realistic load test
  5. ✓ Extracted results
  6. ✓ Cleaned up test accounts (if enabled)
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| ❌ "Admin authentication failed" | Check secrets are correct (Settings → Secrets) |
| ❌ "Failed to fetch roles" | Admin needs `roles.view` permission |
| ❌ Test takes > 20 min | API is slow, check Render/Supabase status |
| ❌ Error rate > 5% | API struggling, review bottleneck (see guide) |

## Success Criteria

| Metric | Good | Acceptable | Bad |
|--------|------|-----------|-----|
| Error rate | < 1% | 1-2% | > 2% |
| p95 latency | < 1s | 1-2s | > 2s |
| p99 latency | < 2s | 2-4s | > 4s |
| All checks pass | 100% | > 98% | < 98% |

## Next Steps

✅ **If test passes:**
- API handles ~50 concurrent staff
- Deploy with confidence
- Monitor production for regressions

❌ **If test fails:**
- Review logs for which role is struggling
- Check database connection pool
- Optimize slow queries
- Re-run after fix

## See Also

- [SETUP-E2E-WORKFLOW.md](SETUP-E2E-WORKFLOW.md) — Full documentation
- [REALISTIC-TEST-GUIDE.md](../load-tests/REALISTIC-TEST-GUIDE.md) — How to interpret results
- [CREATE-TEST-ACCOUNTS.md](../load-tests/CREATE-TEST-ACCOUNTS.md) — Manual account creation

---

**Ready?** Go to Actions and click "Run workflow" → Select cleanup option → Run!

⏱️ Total time: ~15 minutes
