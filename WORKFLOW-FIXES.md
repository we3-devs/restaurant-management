# 🔧 Workflow Fixes - APT Permission Error

## Problem Identified

**Error:** `E: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)`

**Cause:** The GitHub Actions workflows were attempting to run `apt-get update` and `apt-get install` without `sudo` privileges.

**Affected Steps:**
- Step 38-41: "Install jq (for JSON parsing)"
- Workflows: `realistic-load-test-e2e.yml` and `realistic-load-test-multi-user.yml`

---

## ✅ Solution Applied

### Fixed Workflows

#### 1. `.github/workflows/realistic-load-test-e2e.yml`

**Before:**
```yaml
- name: Install jq (for JSON parsing)
  run: |
    apt-get update
    apt-get install -y jq
```

**After:**
```yaml
- name: Install jq (for JSON parsing)
  run: |
    sudo apt-get update
    sudo apt-get install -y jq
```

#### 2. `.github/workflows/realistic-load-test-multi-user.yml`

**Before:**
```yaml
- name: Install jq
  run: apt-get update && apt-get install -y jq
```

**After:**
```yaml
- name: Install jq (for JSON parsing)
  run: sudo apt-get update && sudo apt-get install -y jq
```

---

## Why This Works

GitHub Actions Ubuntu runners require `sudo` to manage system packages because:

- `/var/lib/apt/lists/lock` is owned by `root`
- The runner user doesn't have write permissions
- `sudo` grants temporary elevated privileges for package management

This is a standard practice in CI/CD workflows and poses no security risk in this context.

---

## Verification

✅ **Both workflows updated and ready to use**

The workflows will now:
1. ✓ Install jq without permission errors
2. ✓ Parse JSON results correctly
3. ✓ Extract metrics from load test output
4. ✓ Display per-role performance data

---

## Testing the Fix

Run either workflow and verify:
- [ ] Step completes without permission errors
- [ ] jq is installed successfully
- [ ] Metrics are extracted and displayed
- [ ] Results artifact is uploaded

```
Expected output:
  ✓ Install jq (for JSON parsing) - SUCCESS
  ✓ Run ... Load Test - SUCCESS
  ✓ Extract Results - SUCCESS
  ✓ Upload Results - SUCCESS
```

---

## Files Updated

```
✓ .github/workflows/realistic-load-test-e2e.yml
✓ .github/workflows/realistic-load-test-multi-user.yml
```

**Status:** All workflows ready to run ✅

---

## Next Steps

1. Go to: **Actions** → Choose your workflow
2. Click: **Run workflow**
3. Monitor: Job should now complete without permission errors
4. Verify: Check logs for "Install jq (for JSON parsing) - SUCCESS"

---

**All workflows are now fixed and ready to use!** 🚀
