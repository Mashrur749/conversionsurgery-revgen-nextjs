# Probability Calibration Reference

Anchoring failure probabilities is the hardest part of FMEA. Humans systematically overestimate rare dramatic failures (data breach) and underestimate common mundane ones (stale cache). These base rates provide calibration anchors — adjust from these, don't estimate from scratch.

## Base Rate Table

All probabilities are **per month** unless noted. Adjust for your system's specific mitigations.

### Infrastructure Failures

| Failure Type | Base Rate | With Standard Mitigations | Notes |
|-------------|:---------:|:------------------------:|-------|
| Major cloud provider outage (region-level) | 0.5% | 0.5% (can't mitigate) | AWS/GCP/Azure: ~6 incidents/year across all regions |
| Database connection failure (transient) | 5% | 1% (with pool + retry) | Neon/PlanetScale: occasional cold starts |
| Database connection failure (extended) | 0.5% | 0.1% (with failover) | > 5 min outage |
| DNS resolution failure | 0.2% | 0.05% (with TTL caching) | |
| CDN cache miss storm | 2% | 0.5% (with origin shield) | After deploy or cache purge |
| SSL/TLS certificate expiry | 1% | 0.01% (with auto-renewal) | Manual cert management: 5-10% |
| Disk/storage full | 1% | 0.1% (with monitoring) | Logs, temp files, uploads |

### Application Failures

| Failure Type | Base Rate | With Standard Mitigations | Notes |
|-------------|:---------:|:------------------------:|-------|
| Unhandled exception in request path | 10% | 2% (with error boundaries) | Per endpoint per month |
| Race condition in concurrent writes | 3% | 0.5% (with transactions) | Higher with optimistic locking |
| Memory leak causing OOM | 2% | 0.5% (with restarts) | Serverless: near zero |
| Stale cache serving wrong data | 5% | 1% (with TTL + invalidation) | Higher after schema changes |
| Queue message lost/stuck | 2% | 0.2% (with DLQ + retry) | |
| Cron job failure (single run) | 5% | 1% (with catch-up logic) | Network, timeout, lock contention |
| Cron job failure (undetected for > 1 day) | 2% | 0.1% (with alerting) | |

### External API Failures

| Failure Type | Base Rate | With Standard Mitigations | Notes |
|-------------|:---------:|:------------------------:|-------|
| Stripe API timeout (single request) | 1% | 0.2% (with retry) | Stripe SLA: 99.99% |
| Stripe API degraded (> 10 min) | 0.3% | 0.3% (can't mitigate) | ~3-4 incidents/year |
| Twilio API timeout (single request) | 2% | 0.5% (with retry) | Twilio SLA: 99.95% |
| Twilio SMS delivery failure | 5% | 3% (with carrier fallback) | Carrier-dependent, landline numbers |
| Google API quota exceeded | 3% | 0.5% (with rate limiting) | Calendar/OAuth especially |
| Google API auth token expired | 2% | 0.1% (with refresh flow) | If refresh token revoked: 100% |
| Webhook delivery failure (single) | 5% | 1% (with retry queue) | Network, timeout, 5xx |
| Webhook delivery failure (> 1 hour delay) | 2% | 0.3% (with alerting) | |

### Auth & Security Failures

| Failure Type | Base Rate | With Standard Mitigations | Notes |
|-------------|:---------:|:------------------------:|-------|
| Session token expired mid-operation | 3% | 0.5% (with refresh) | |
| OAuth flow failure (provider-side) | 1% | 1% (can't mitigate) | Google OAuth: occasional 500s |
| Magic link email not delivered | 3% | 1% (with Resend + fallback) | Spam filters, bounce |
| OTP SMS not received | 5% | 2% (with retry + voice fallback) | Carrier filtering |
| CSRF token mismatch | 0.5% | 0.1% (with SameSite cookies) | Tab duplication edge cases |
| API key rotation causing downtime | 1% | 0.01% (with gradual rotation) | |

### Data & Schema Failures

| Failure Type | Base Rate | With Standard Mitigations | Notes |
|-------------|:---------:|:------------------------:|-------|
| Migration failure on deploy | 5% | 1% (with dry-run + rollback) | Per deployment |
| Schema drift (code expects old schema) | 3% | 0.5% (with typecheck) | After migrations |
| Data truncation (field too long) | 2% | 0.1% (with validation) | User input, API responses |
| Foreign key violation | 2% | 0.5% (with cascade rules) | Deletion ordering |
| Null reference on optional field | 8% | 2% (with strict types) | jsonb fields especially |

### Human/Process Failures

| Failure Type | Base Rate | With Standard Mitigations | Notes |
|-------------|:---------:|:------------------------:|-------|
| Deploy to wrong environment | 2% | 0.1% (with CI/CD guards) | |
| Env variable misconfigured | 3% | 0.5% (with validation on startup) | After infra changes |
| Feature flag stale/forgotten | 5% | 1% (with flag hygiene process) | Per flag per quarter |
| Monitoring alert ignored/missed | 10% | 3% (with escalation) | Alert fatigue |
| Runbook not followed correctly | 15% | 5% (with automation) | Manual recovery steps |

## Adjustment Rules

Use these modifiers on base rates:

| Condition | Multiplier | Rationale |
|-----------|:----------:|-----------|
| Code has test coverage > 80% | 0.5x | Fewer logic bugs reach production |
| Code has no tests | 2x | More latent bugs |
| Serverless (e.g., Cloudflare Workers) | 0.3x for infra failures | No server to manage |
| Single maintainer (bus factor = 1) | 1.5x for process failures | Less review, more blind spots |
| Component was recently refactored | 2x for 30 days | Fresh code, fresh bugs |
| Component hasn't changed in 6+ months | 0.7x for logic bugs, 1.5x for dependency bugs | Stable code but stale deps |
| Third-party API with no SLA | 3x for that API's failures | No guarantees |

## Calibration Self-Check

After scoring all failure modes, do this sanity check:

1. **Sum all probabilities**: If the sum of all independent failure probabilities > 50% per month, you're probably overestimating. A well-built system doesn't fail that often.
2. **Check for anchoring bias**: Did you score most things as 5/10? That's the median trap. Force yourself to use 1-3 and 7-10 too.
3. **Availability bias**: Are all your high-probability failures dramatic (data breach, total outage)? The mundane ones (stale cache, missed cron, slow query) are usually more probable.
4. **Neglect of mitigations**: Did you account for existing retries, fallbacks, and monitoring? These shift probabilities significantly.
