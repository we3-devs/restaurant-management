# Production Load Testing Guide

This directory contains the k6-based production load testing system for the Restaurant Management System API. Tests run on GitHub-hosted runners to avoid contamination from local internet conditions.

## ⚠️ IMPORTANT

**This is a production API test.** Before running tests:

1. Notify the team that you're about to run a production load test
2. Monitor the production environment (Render dashboard, database, logs)
3. Start with conservative parameters (25 RPS, 30 seconds)
4. Only use read-only endpoints (no mutations, no data creation)

## Setup

### 1. Create GitHub Secrets

Navigate to **Settings → Secrets and variables → Actions** and add:

- `RMS_LOAD_TEST_EMAIL`: Test user email (e.g., `test@rms.local`)
- `RMS_LOAD_TEST_PASSWORD`: Test user password (e.g., `Admin@12345`)

These credentials must correspond to an existing test user in the production database.

**Do NOT commit credentials to the repository.**

### 2. Verify the Test User Exists

Test users must:
- Already exist in the production database
- Have a valid password set
- Have appropriate roles/permissions to access load test endpoints
- NOT be used for other purposes (to avoid conflicting concurrent requests)

Contact the team to confirm which test user account should be used.

## Running Tests

### Via GitHub Actions (Recommended)

1. Go to **Actions** → **Production Load Test**
2. Click **Run workflow**
3. Select:
   - **Target RPS**: 25, 50, 75, 100, 150, or 200 requests per second
   - **Duration**: 30s, 60s, or 120s
   - **Virtual Users**: (optional, defaults to 10)
4. Click **Run workflow**

The test will:
- Authenticate as the test user
- Execute 1,000–12,000 requests (depends on RPS × duration)
- Report results in the workflow logs
- Save results as an artifact

### Via Local k6 CLI

To test locally (if you have k6 installed):

```bash
# Install k6 (macOS)
brew install k6

# Install k6 (Windows)
choco install k6

# Run with default parameters (25 RPS, 30s)
k6 run load-tests/rms-production.js \
  --vus 10 \
  --duration 30s

# Run with custom parameters
LOAD_RPS=50 \
LOAD_DURATION=60s \
LOAD_VUS=15 \
LOAD_TEST_EMAIL=test@rms.local \
LOAD_TEST_PASSWORD=Admin@12345 \
BASE_URL=https://restaurant-management-g6vb.onrender.com/api \
k6 run load-tests/rms-production.js
```

## Understanding Results

### Key Metrics

#### Throughput

- **Actual RPS**: Requests per second achieved (may be less than target if the API is slow)
- **Total Requests**: How many requests completed during the test
- **Error Rate**: Percentage of failed requests (target: < 1%)

#### Latency (Response Times)

- **p50 (median)**: 50% of requests completed faster than this
- **p90**: 90% of requests completed faster than this
- **p95**: 95% of requests completed faster than this (target: < 1000ms)
- **p99**: 99% of requests completed faster than this (target: < 2000ms)
- **Max**: Slowest response time observed

#### HTTP Status Codes

- **2xx**: Successful responses (desired)
- **4xx**: Client errors (bad request, not found, etc.)
- **5xx**: Server errors (API is failing)

#### Endpoint Breakdown

The test measures each endpoint separately:
- `GET /auth/me` (40% of traffic)
- `POST /auth/ws-ticket` (20% of traffic)
- `GET /dining-tables` (20% of traffic)
- `GET /outlets/assigned` (20% of traffic)

### Interpreting a Test

**Example result (PASS):**
```
Actual RPS:     25.3
Error Rate:     0.1%
p50 latency:    180ms
p95 latency:    850ms
p99 latency:    1850ms
```
✓ This is healthy. The API handles the target load comfortably.

**Example result (FAIL):**
```
Actual RPS:     15.2  (target was 25)
Error Rate:     3.2%
p50 latency:    2100ms
p95 latency:    5200ms
p99 latency:    8500ms
```
✗ The API is struggling. Response times are high, and errors are occurring. Investigate the database, connection pool, or slow queries.

## ⚠️ Production Baseline

Before progressive testing, understand the current production baseline:

**Latest production measurement:**
- **Target**: 100 RPS, 10 concurrency
- **Achieved**: ~49 RPS (49% of target)
- **p50 latency**: 1806ms
- **p95 latency**: 3085ms
- **p99 latency**: 3529ms
- **Error rate**: 0% (successful, but slow)

**Key insight**: The API successfully handles requests, but response times are high (~3 seconds for p95). This is driven by database query latency (Supabase remote + network overhead), not errors. The connection pool maxes out at 13 connections, limiting maximum sustainable throughput to ~2-5 RPS per connection.

## Progressive Load Testing Strategy

**⚠️ IMPORTANT**: The following stages are NOT guarantees that the backend can safely handle those loads. They are **controlled production tests** to characterize current behavior. Each stage should be run **hours apart** to avoid back-to-back stress.

### Stage 1: Smoke Test (25 RPS, 30s) ✓ START HERE
**Purpose**: Baseline confirmation. Verify the API is responsive and stable.
- 750 total requests
- Expected: Should perform similar to baseline (p95 ~2.5–3s, error rate < 1%)
- **Action if fails**: Stop. Do not proceed. Something is wrong.
- **Action if passes**: Wait 30 minutes before Stage 2.

### Stage 2: Light Load (50 RPS, 30s)
**Purpose**: 2× baseline. Verify database connection pool under light doubled load.
- 1,500 total requests
- Expected: p95 ~3–3.5s, error rate < 1% (may see some timeout risk)
- **Action if fails**: Stop. The API cannot handle 2× baseline.
- **Action if passes**: Wait 60 minutes before Stage 3.
- **Monitor**: Supabase dashboard for connection pool saturation.

### Stage 3: Moderate Load (75 RPS, 60s)
**Purpose**: 3× baseline over longer duration. Test sustained load and connection pooling.
- 4,500 total requests
- Expected: p95 ~3.5–4.5s, error rate < 2% (timeout risk increases)
- **Action if fails**: Stop. The API hits capacity at ~50 RPS.
- **Action if passes**: Wait 120 minutes before Stage 4.
- **Monitor**: Watch Render CPU, memory, and error logs in real-time.

### Stage 4: High Load (100 RPS, 60s)
**Purpose**: 2× baseline sustained. Push toward stress conditions.
- 6,000 total requests
- Expected: p95 > 5s, error rate 2–10% (likely connection timeouts)
- **Action if fails (errors > 10%)**: Stop immediately. The API is overloaded.
- **Action if passes (controlled degradation)**: Database/pool is the limit.
- **Monitor**: Expect to see errors. This is where the bottleneck reveals itself.

### Stage 5: Stress Test (150 RPS, 30s) – ONLY if previous stages are stable
**Purpose**: Find breaking point. Identify where errors spike.
- 4,500 total requests
- Expected: Error rate 5–50%, high p99 latencies
- **Action**: Document where errors began. This is the API's true maximum.
- **Only run if explicitly authorized.** This is destructive testing.

## What Endpoints Are Tested?

The test only uses **read-only** endpoints to avoid contaminating production data:

- `GET /auth/me`: Fetch current authenticated user and permissions
- `GET /dining-tables`: List all dining tables
- `GET /outlets/assigned`: List outlets assigned to the user
- `POST /auth/ws-ticket`: Generate a WebSocket authentication ticket (read-only)

**No mutations are performed** (no POST/PUT/PATCH/DELETE to data endpoints).

## Expected Threshold Failures

Given the current production baseline (p95 ~3085ms), the test thresholds will likely fail at 25 RPS. This is **normal and expected**. 

The thresholds are intentionally strict to catch regressions. If they fail:
1. **This is expected data** — you now have a baseline
2. Run the test multiple times at 25 RPS to confirm stability
3. Once 25 RPS is stable, attempt 50 RPS
4. If error rate stays < 1% despite high latency, the API is coping

The goal is **characterization**, not hitting arbitrary thresholds. Document the actual behavior at each RPS level.

## Monitoring During a Test

While a test is running:

1. **GitHub Actions**: Watch the workflow run in real-time at **Actions** → **Production Load Test**
2. **Render Dashboard**: Monitor API CPU, memory, and response times
3. **Database**: Check connection pool usage (Supabase dashboard)
4. **Logs**: Review backend logs for errors or anomalies

## Stopping a Test

### Via GitHub Actions
1. Go to **Actions** → **Production Load Test** → active run
2. Click the **Cancel** button (top-right)
3. The test will halt immediately

### Via k6 CLI
- Press **Ctrl+C** to stop

## Test Safety Limits

The GitHub Actions workflow enforces these **input limits** to prevent accidental overload:

- **Maximum RPS**: 150 (prevents runaway load)
- **Maximum Duration**: 120 seconds (prevents long test runs)
- **Maximum VUs**: 100 (prevents excessive concurrency)

If you attempt to exceed these limits, the workflow **fails immediately before k6 runs**.

## k6 Thresholds

k6 automatically fails the test if:
- `http_req_failed`: Error rate exceeds 1% (< 0.01 = < 1%)
- `http_req_duration` p95: Exceeds 1000ms
- `http_req_duration` p99: Exceeds 2000ms

**Note**: These thresholds are aspirational based on a healthy API. However, given the current production baseline (p95 ~3085ms), the 25 RPS smoke test will **fail the thresholds** unless the backend improves. This is expected. Use the test to establish a new baseline, then adjust thresholds as appropriate.

## Interpreting k6 JSON Results

After a test completes, download the artifact `load-test-results-*.json` from GitHub Actions. The file contains detailed metrics in JSON format.

**Key metrics to look for:**

```
Type: "Point" (individual measurement)
Type: "Trend" (percentile distribution)

Common metrics:
- http_req_duration: Response time (includes p50, p95, p99)
- http_req_failed: Count/rate of failed requests
- endpoint_auth_me_duration: Latency for /auth/me specifically
- endpoint_dining_tables_duration: Latency for /dining-tables
- endpoint_outlets_assigned_duration: Latency for /outlets/assigned
- endpoint_ws_ticket_duration: Latency for /auth/ws-ticket
```

**To extract key values** (requires `jq`):

```bash
# Total requests
jq '.[] | select(.metric == "http_requests") | .data.value' results.json

# p95 latency
jq '.[] | select(.metric == "http_req_duration") | select(.data.value.p95) | .data.value.p95' results.json

# Error rate
jq '.[] | select(.metric == "http_req_failed") | select(.data.value.rate) | .data.value.rate' results.json

# Endpoint-specific metrics
jq '.[] | select(.metric | contains("endpoint_")) | "\(.metric): \(.data.value)"' results.json
```

**Comparison across test runs:**

Document the baseline (Stage 1) and compare against later stages:

| Stage | RPS | Duration | Achieved RPS | p50 | p95 | p99 | Error% |
|-------|-----|----------|--------------|-----|-----|-----|--------|
| 1     | 25  | 30s      | _?_          | _?_ | _?_ | _?_ | _?_    |
| 2     | 50  | 30s      | _?_          | _?_ | _?_ | _?_ | _?_    |
| 3     | 75  | 60s      | _?_          | _?_ | _?_ | _?_ | _?_    |
| 4     | 100 | 60s      | _?_          | _?_ | _?_ | _?_ | _?_    |

Fill in the blanks as you run each stage.

## Troubleshooting

### Test fails: "Authentication failed"
**Cause**: Test user credentials are incorrect or the user doesn't exist in production.
**Fix**: Verify `RMS_LOAD_TEST_EMAIL` and `RMS_LOAD_TEST_PASSWORD` GitHub Secrets.

### Test fails: "Connection refused"
**Cause**: The API is unreachable (network issue or Render is down).
**Fix**: Verify the API is running at https://restaurant-management-g6vb.onrender.com/api

### High error rate (> 5%)
**Cause**: The API is struggling under load.
**Actions**:
1. Reduce RPS and duration for the next test
2. Check backend logs for errors
3. Check database connection pool status
4. Check slow query logs
5. Consider caching or query optimization

### Very high p95 latency (> 2s)
**Cause**: Either the API or database is slow.
**Actions**:
1. Check Render CPU/memory usage
2. Check Supabase query performance
3. Identify slow endpoints from test results
4. Review recent database changes (migrations, indexes)

### GitHub Actions job fails
**Cause**: k6 installation or script syntax error.
**Fix**: Check the workflow logs for error messages. Verify `load-tests/rms-production.js` syntax.

## Safe Escalation Plan: 25 → 50 → 75 → 100 RPS

### Before Each Stage

1. **Note the time** – Record when you start
2. **Check Render metrics** – Verify CPU, memory, and error logs are healthy
3. **Check Supabase** – Verify connection pool is stable (should see < 13 connections)
4. **Wait between tests** – Allow 30–120 minutes for caches to stabilize

### Running Each Stage

1. **Execute the test** via GitHub Actions (manual `Run workflow`)
2. **Monitor in real-time**:
   - Watch Render dashboard for CPU spikes
   - Watch Supabase for connection pool exhaustion
   - Check logs for errors
3. **Let it complete** – Don't cancel early
4. **Save the artifact** – Download the `load-test-results-*.json` for comparison

### Decision Criteria for Next Stage

| Metric | ✓ Continue | ⚠️ Investigate | ✗ Stop |
|--------|-----------|-----------------|--------|
| Error rate | < 1% | 1–5% | > 5% |
| p95 latency | < 5s | 5–10s | > 10s |
| Render CPU | < 80% | 80–95% | > 95% |
| Supabase pool | < 13 connections | Hitting max | Exhausted |

**If ✗ Stop**: Do not proceed to next stage. Investigate the bottleneck instead.

**If ⚠️ Investigate**: Review logs, check for slow queries, consider caching improvements.

**If ✓ Continue**: Wait 60+ minutes and try next stage.

## Local Testing (Development)

To test against your local backend:

```bash
LOAD_TEST_EMAIL=your_local_user@example.com \
LOAD_TEST_PASSWORD=your_password \
BASE_URL=http://localhost:3000/api \
k6 run load-tests/rms-production.js \
  --vus 5 \
  --duration 10s
```

## Advanced Configuration

### Environment Variables

The k6 script accepts:

- `BASE_URL`: API base URL (default: `https://restaurant-management-g6vb.onrender.com/api`)
- `LOAD_RPS`: Target requests per second (default: `25`)
- `LOAD_DURATION`: Test duration (default: `30s`)
- `LOAD_VUS`: Number of virtual users (default: `10`)
- `LOAD_TIMEOUT`: Request timeout (default: `10000ms`)
- `LOAD_TEST_EMAIL`: Test user email
- `LOAD_TEST_PASSWORD`: Test user password

### Modifying Endpoint Distribution

Edit `load-tests/rms-production.js` and change the weights in the random selection logic:

```javascript
if (rand < 40) {
  // GET /auth/me (40%)
} else if (rand < 60) {
  // POST /auth/ws-ticket (20%)
} else if (rand < 80) {
  // GET /dining-tables (20%)
} else {
  // GET /outlets/assigned (20%)
}
```

### Adding New Endpoints

1. Add a new `group()` block in `export default function`
2. Define a new `Trend` metric for latency
3. Define a new `Rate` metric for errors
4. Adjust the random distribution weights

## Notes

- **GitHub Actions free tier**: Includes 2,000 minutes/month for builds. Load tests consume ~1–2 minutes per run.
- **k6 cloud integration**: This script does NOT use k6 Cloud; results stay local.
- **Production safety**: Tests only use read-only endpoints. No data is created, modified, or deleted.
- **Concurrency limit**: The test respects the database connection pool (13 connections by default).

## References

- [k6 Documentation](https://k6.io/docs/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Render Status Dashboard](https://status.render.com/)
- [Supabase Documentation](https://supabase.com/docs/)
