# Realistic Restaurant Load Test Guide

## Overview

The **Realistic Load Test** simulates actual restaurant operations with 50 concurrent users playing different roles, performing real business workflows over 11 minutes.

This is fundamentally different from the raw throughput tests:
- **Production Test**: Measures RPS (requests/second) ceiling with minimal think time
- **Realistic Test**: Measures sustained operations with realistic user behavior and business workflows

## Test Profile

### Duration & Stages

```
0 min ─────────────────────────────────────────────────────────────────── 11 min

0-1 min:    Ramp up   0   → 10 VUs
1-3 min:    Ramp up  10   → 25 VUs
3-5 min:    Ramp up  25   → 50 VUs
5-10 min:   Sustain  50 VUs (constant load)
10-11 min:  Ramp down 50  → 0 VUs
```

### User Roles (25% Each)

#### 1. Waiter (25% of 50 VUs = ~12-13 users)
**Workflow:**
1. Browse available tables (GET /dining-tables)
2. Create new order for a table (POST /orders)
3. Add items to order (POST /orders/{id}/items)
4. View assigned outlets (GET /outlets/assigned)

**Think time:** 2-30 seconds between actions
**Business logic tested:** Order creation, item management

#### 2. Kitchen Staff (25% of 50 VUs = ~12-13 users)
**Workflow:**
1. Fetch active tickets (GET /kitchen/tickets)
2. Mark order as "preparing" (PATCH /kitchen/tickets/{id})
3. Mark order as "ready" (PATCH /kitchen/tickets/{id})
4. Check personal profile (GET /auth/me)

**Think time:** 2-30 seconds between actions
**Business logic tested:** Ticket workflow, status updates

#### 3. Cashier (25% of 50 VUs = ~12-13 users)
**Workflow:**
1. Browse pending orders (GET /orders)
2. Generate bill for order (GET /orders/{id}/bill)
3. Process payment (POST /payments)
4. Mark order complete (PATCH /orders/{id})

**Think time:** 2-30 seconds between actions
**Business logic tested:** Payment processing, order completion

#### 4. Manager (25% of 50 VUs = ~12-13 users)
**Workflow:**
1. View dashboard (GET /dashboard)
2. Fetch today's reports (GET /reports?period=today)
3. Check inventory (GET /inventory)
4. View all orders (GET /orders?status=all)

**Think time:** 2-30 seconds between actions
**Business logic tested:** Analytics, reporting, aggregate data

## Success Criteria

### Primary Metrics

| Metric | Target | Acceptable | Fail |
|--------|--------|-----------|------|
| Overall error rate | < 1% | 1–2% | > 2% |
| p95 latency | < 1s | 1–2s | > 2s |
| p99 latency | < 2s | 2–4s | > 4s |
| 5xx errors | 0 | 0 | > 0 |
| Timeouts | 0 | 0 | > 0 |

### Role-Specific Success

| Role | Errors | p95 Latency | Notes |
|------|--------|-----------|-------|
| Waiter | < 2% | < 1.5s | Order creation must be fast |
| Kitchen | < 2% | < 1.5s | Status updates are critical |
| Cashier | < 2% | < 2s | Payment processing can be slower |
| Manager | < 2% | < 2s | Reporting queries are heavier |

### Business Checks

- ✓ All endpoints responding (200 or 201 on success)
- ✓ Order creation succeeds 100%
- ✓ Payment processing succeeds 100%
- ✓ Status updates complete
- ✓ Dashboards load
- ✓ Zero data loss or corruption

## Interpreting Results

### If Test PASSES ✓

```
Error rate:        0.2% ✓
p95 latency:       850ms ✓
p99 latency:       1500ms ✓
All roles < 2%:    ✓
Timeouts:          0 ✓
```

**Interpretation:** Your API can comfortably handle ~50 concurrent restaurant staff.

**What this means:**
- Restaurant can safely operate with 50 simultaneous users
- All roles performing their workflows without bottlenecks
- Response times are snappy (< 1s for most requests)
- Business workflows complete successfully

**Next steps:**
- Increase to 75-100 VU test if you want to find the ceiling
- Deploy with confidence for operations at this scale
- Monitor production for sustained performance

### If Test FAILS (Errors > 2%) ✗

```
Error rate:        5.2% ✗
p95 latency:       3200ms ✗
p99 latency:       6800ms ✗
Waiter errors:     8% ✗✗
Kitchen errors:    2% ✓
Cashier errors:    1% ✓
Manager errors:    2% ✓
```

**Interpretation:** Waiter workflow is struggling. Likely bottleneck: Order creation (POST /orders).

**What this means:**
- The API struggles to create orders under concurrent load
- Database connection pool may be exhausted
- Query performance degrading
- Restaurant operations would experience delays at this user level

**Diagnosis steps:**
1. Check which role/endpoint is failing (see artifacts)
2. Review database connection pool status (Supabase dashboard)
3. Check Render CPU/memory (should be < 80%)
4. Review slow query logs
5. Look for N+1 queries or missing indexes

**Fix options:**
1. Increase database connection pool
2. Add caching (Redis) for read-heavy endpoints
3. Optimize slow queries (add indexes, reduce query complexity)
4. Consider connection pooling (pgBouncer)
5. Reduce think time per test to focus on steady state

### If p95 > 2s but error rate < 1% ⚠️

```
Error rate:        0.3% ✓
p95 latency:       2500ms ⚠️
p99 latency:       4200ms ⚠️
```

**Interpretation:** API is handling the load, but responses are slow.

**What this means:**
- No errors = system is stable
- Slow responses = database or query optimization issue
- Restaurant staff will experience lag, but operations continue

**Actions:**
1. Run this test again to confirm reproducibility
2. Check if issue is database-specific (run query profiling)
3. Consider caching strategies (Redis)
4. Identify slow endpoints from the results
5. Optimize those specific queries

## Analyzing Results

### Step 1: Check Overall Health

```bash
# From the k6 output, look for:
http_req_failed: 0.2% (rate < 0.01 = < 1%)  ✓
http_req_duration:
  p(95) = 850ms (< 1000ms)                    ✓
  p(99) = 1500ms (< 2000ms)                   ✓
```

### Step 2: Check Per-Role Metrics

Look for `waiter_errors`, `kitchen_errors`, `cashier_errors`, `manager_errors` in the results:

```
waiter_errors:        1.2%  ⚠️ (slightly elevated)
kitchen_errors:       0.1%  ✓
cashier_errors:       0.5%  ✓
manager_errors:       0.3%  ✓
```

This tells you which role/workflow is struggling.

### Step 3: Check Flow Duration

Each role workflow reports total duration:

```
waiter_flow_duration:        avg=15200ms  ⚠️ (high)
kitchen_flow_duration:       avg=8500ms   ✓
cashier_flow_duration:       avg=12000ms  ✓
manager_flow_duration:       avg=11000ms  ✓
```

High duration + high errors = bottleneck in that workflow.

### Step 4: Identify Bottleneck Endpoint

The failing role tells you which endpoint:
- Waiter high errors → Order creation (POST /orders) or item adding
- Kitchen high errors → Status updates (PATCH /kitchen/tickets)
- Cashier high errors → Payment processing or bill generation
- Manager high errors → Dashboard or reporting queries

## Adjusting the Test

### Make It Easier (Debug Mode)

If test is failing heavily, run with reduced load to isolate issues:

Create a temporary script with:
- 10 VUs max (instead of 50)
- 5-minute total duration
- Same roles, same workflows
- Easier to debug when things fail

### Make It Harder (Stress Test)

If test passes easily, run extended version:

```javascript
stages: [
  { duration: '2m', target: 50 },   // Ramp slower
  { duration: '10m', target: 50 },  // Sustain longer
  { duration: '1m', target: 100 },  // Spike to 100
  { duration: '5m', target: 100 },  // Sustain at peak
  { duration: '2m', target: 0 },    // Ramp down
]
```

This tests:
- Sustained operations at 50 VUs
- Spike to 100 VUs (your true ceiling)
- Recovery after spike

## Understanding Think Time

The test adds random delays between actions (2-30 seconds):

```javascript
function thinkTime() {
  const seconds = Math.random() * 28 + 2;  // 2-30 seconds
  sleep(seconds);
}
```

**Why think time matters:**
- Without it: Benchmark (raw throughput)
- With it: Realistic simulation (user behavior)

**Real-world example:**
- A waiter checks tables, thinks about it, creates an order
- They don't spam orders instantly
- Think time = (browse + decision time)

This makes the test realistic but slower. **This is intentional and correct.**

## Pre-Test Checklist

Before running the realistic test:

- ✓ Notify ops team
- ✓ Open Render dashboard in separate tab
- ✓ Open Supabase dashboard (check connection pool)
- ✓ Have ops on standby (can they kill the test if needed?)
- ✓ Test credentials exist (RMS_LOAD_TEST_EMAIL, RMS_LOAD_TEST_PASSWORD secrets)
- ✓ Time the test (don't run during business hours if possible)
- ✓ Have a clear resolution if it fails (which component to optimize?)

## Post-Test Checklist

After test completes:

- ✓ Download results artifact (load-test-results-realistic-*.json)
- ✓ Review error rates per role
- ✓ Note p95/p99 latencies
- ✓ Check Render and Supabase logs for anomalies
- ✓ Compare to previous test runs (did it improve/degrade?)
- ✓ Document findings in a comment or issue
- ✓ If failed: Create ticket to optimize bottleneck

## When to Run This Test

### ✓ Run It

- After significant backend changes
- Before increasing production capacity
- After database optimizations
- To establish a new baseline
- Before adding features that increase load
- Quarterly (to catch regressions)

### ✗ Don't Run It

- During peak business hours
- Without ops team awareness
- More than once per hour (let system cool down)
- After only one failed attempt (run 2-3 times to confirm)
- Without understanding what you're testing

## Comparing Test Runs

Create a spreadsheet to track performance over time:

| Date | RPS | VUs | Duration | Error% | p95 | p99 | Status | Notes |
|------|-----|-----|----------|--------|-----|-----|--------|-------|
| 2026-08-13 | N/A | 50 | 11m | 0.3% | 850ms | 1500ms | ✓ PASS | Baseline |
| 2026-08-20 | N/A | 50 | 11m | 0.2% | 780ms | 1400ms | ✓ PASS | After index |
| 2026-08-27 | N/A | 50 | 11m | 2.1% | 2200ms | 4500ms | ✗ FAIL | Needs investigation |

This helps you spot trends:
- Improvement = optimization is working
- Degradation = something broke
- Stable = no regression

## References

- [k6 Documentation](https://k6.io/docs/)
- [k6 Scenarios](https://k6.io/docs/using-k6/scenarios/)
- [k6 Thresholds](https://k6.io/docs/using-k6/thresholds/)
- [Performance Testing Best Practices](https://k6.io/blog/introduction-to-load-testing/)

## Questions?

If tests are confusing or results unclear:
1. Run the test again (one-off anomalies happen)
2. Compare to baseline (what changed since last run?)
3. Check logs (Render, Supabase, k6 output)
4. Reduce load and re-run (isolate the issue)
5. Ask the team (collective debugging is faster)
