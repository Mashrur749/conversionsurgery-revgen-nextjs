# Common Cascade Failure Patterns

Reference catalog of cascade chains frequently found in web applications. Use these during Step 5 to ensure completeness — check each pattern against the target system and include any that apply.

## 1. Database Connection Pool Exhaustion

**Trigger**: Slow query or DB latency spike causes connections to be held longer than expected.

```
Slow query (>5s) 
  → Pool connections held longer
  → Pool fills to max
  → New requests wait for connection (timeout)
  → Request timeouts cascade to all DB-dependent endpoints
  → Health check fails (if it queries DB)
  → Load balancer marks instance unhealthy
  → Remaining instances take full load → pool exhaustion spreads
```

**Detection**: Connection pool metrics, query duration alerts, 5xx rate spike.
**Break the chain**: Connection timeouts (not just query timeouts), pool overflow rejection (fail fast), read replicas for heavy queries.

## 2. Authentication Cascade

**Trigger**: Auth provider (session store, OAuth provider, magic link service) becomes unavailable.

```
Session store unavailable (Redis/DB down)
  → All authenticated requests fail
  → Users see 401/403 on every page
  → Retry storms as users refresh
  → Auth endpoints overloaded with re-login attempts
  → Magic link / OTP service rate-limited by retry volume
  → Support queue floods
```

**Detection**: Auth failure rate spike, session validation latency.
**Break the chain**: Cached session validation (tolerate stale for N minutes), graceful degradation (read-only mode), circuit breaker on auth provider.

## 3. Webhook Delivery Chain

**Trigger**: Webhook endpoint returns 5xx or times out.

```
Webhook delivery fails
  → Retry queue grows (exponential backoff)
  → Queue fills with retries for same event
  → New events queued behind retries
  → Event processing delay increases
  → Downstream systems miss time-sensitive events
  → State divergence between systems
  → Manual reconciliation required
```

**Detection**: Webhook delivery success rate, queue depth, event processing lag.
**Break the chain**: DLQ (dead letter queue) with alerting, circuit breaker per endpoint, event deduplication, idempotency keys.

## 4. Rate Limit Cascade

**Trigger**: One component hits external API rate limit.

```
Burst of API calls hits rate limit
  → Requests start failing with 429
  → Retry logic fires → more requests → more 429s
  → Backoff timer grows → requests pile up in queue
  → Queue hits memory limit
  → Other callers of same API affected (shared rate limit)
  → User-visible features degrade across unrelated endpoints
```

**Detection**: 429 response count, API quota utilization, queue depth.
**Break the chain**: Token bucket rate limiter (client-side), request coalescing, separate rate limit pools per feature, graceful degradation when rate-limited.

## 5. Cache Stampede

**Trigger**: Popular cache entry expires, many concurrent requests try to rebuild it.

```
Cache entry expires
  → N concurrent requests miss cache simultaneously
  → All N hit the database/origin
  → Origin overwhelmed by N identical queries
  → Response time spikes for all requests (not just the stampede)
  → More cache entries expire due to slow response (TTL clock keeps ticking)
  → Stampede spreads to more keys
```

**Detection**: Cache hit ratio drop, origin request spike, response latency spike.
**Break the chain**: Cache lock (only one request rebuilds), stale-while-revalidate, probabilistic early expiry, warming on deploy.

## 6. Configuration Propagation

**Trigger**: Bad config deployed (wrong env var, feature flag misconfigured, secret rotated without update).

```
Bad config deployed to one instance
  → Instance starts failing silently (wrong API key, wrong URL)
  → Errors not immediately obvious (may look like transient failures)
  → Rolling deploy spreads bad config to all instances
  → Full outage when last healthy instance gets bad config
  → Rollback complicated if config was separate from code deploy
```

**Detection**: Config validation on startup, canary deploys, config drift detection.
**Break the chain**: Config validation at boot (crash early, don't serve bad traffic), config diffing in deploy pipeline, feature flag kill switches.

## 7. Payment Processing Chain

**Trigger**: Payment provider API degraded.

```
Stripe API timeout on charge creation
  → Customer sees "processing" spinner
  → Customer retries → duplicate charge risk
  → Webhook for original charge arrives late
  → System creates duplicate subscription/order
  → Customer charged twice
  → Chargeback risk → Stripe account warning
```

**Detection**: Payment API latency, duplicate charge detection, webhook delivery lag.
**Break the chain**: Idempotency keys on all charges, client-side retry prevention (disable button), webhook dedup by event ID, payment state machine (pending → confirmed → fulfilled).

## 8. Cron Job Cascade

**Trigger**: One cron job runs long and overlaps with the next run.

```
Cron job takes longer than interval
  → Next run starts while previous still running
  → Both compete for same resources (DB connections, locks, API quota)
  → Both run slower → next overlap is worse
  → Eventually: deadlock, duplicate processing, or OOM
  → Cron orchestrator falls behind → scheduled events missed
  → Time-sensitive operations (reports, notifications) delayed
```

**Detection**: Job duration vs interval ratio, lock contention alerts, job queue depth.
**Break the chain**: Distributed locks (skip if already running), job-level timeout, catch-up logic (process missed intervals on next run).

## 9. Third-Party Dependency Outage

**Trigger**: Critical external service goes down (Twilio, Stripe, Google APIs, etc.).

```
External API returns 503
  → Primary feature blocked (can't send SMS, can't charge card)
  → Retry logic consumes request budget
  → Internal queue fills with pending operations
  → Other features using same API affected (shared client, shared rate limit)
  → User-facing errors spread across seemingly unrelated features
  → Operator confusion about root cause (symptoms appear unrelated)
```

**Detection**: Per-dependency health checks, circuit breaker state, error categorization by root cause.
**Break the chain**: Circuit breaker pattern (stop calling dead API), graceful degradation per feature, dependency health dashboard, queue-and-retry for non-time-critical operations.

## 10. Observability Blind Spot

**Trigger**: Monitoring itself fails or has a gap.

```
Log pipeline backed up or metrics delayed
  → Alerts don't fire for real issues
  → Issues compound silently (errors accumulate, queue grows, data drifts)
  → Discovery happens via user report (hours later)
  → Blast radius much larger than if caught early
  → Recovery takes longer (must first understand scope)
  → Post-mortem reveals alerting gap
```

**Detection**: Meta-monitoring (monitoring the monitoring), synthetic canaries, heartbeat checks.
**Break the chain**: Multi-channel alerting (don't rely on one pipeline), synthetic monitoring (test from outside), regular alert testing (fire test alerts monthly).

## 11. State Machine Deadlock

**Trigger**: Entity gets stuck in an intermediate state that no process handles.

```
Record moves to "processing" state
  → Process that should advance it crashes mid-operation
  → Record stuck in "processing" forever
  → No process picks up "processing" records (only "pending")
  → Business operation halted for that entity
  → If common enough: growing backlog of stuck records
  → No alerting because "processing" isn't an error state
```

**Detection**: State age monitoring (records in transitional states > expected duration), state distribution dashboards.
**Break the chain**: State timeout with auto-recovery, "processing" heartbeat (if no heartbeat in N minutes, release back to pending), stuck-state cron job.

## 12. DNS/Network Partition

**Trigger**: Network connectivity issue between services.

```
DNS resolution intermittently fails
  → Some requests succeed, some fail (hard to reproduce)
  → Retry logic partially works (success rate ~70%)
  → Timeouts on failed requests cascade to slow responses
  → Load balancer health checks intermittently pass
  → Instance flaps between healthy/unhealthy
  → Requests routed to flapping instance have unpredictable latency
```

**Detection**: DNS resolution latency, TCP connection failure rate, health check flap detection.
**Break the chain**: DNS caching with fallback, TCP keepalive, connection reuse, health check hysteresis (require N consecutive failures before marking unhealthy).

---

## Using This Catalog

During Step 5 (cascade modeling), scan this catalog against your target system:

1. For each pattern, check: "Does this target have components that match this chain?"
2. If yes, trace the specific variant through your component graph
3. Record as a cascade chain with your system's specific component IDs
4. Check for patterns NOT in this catalog — this list covers common ones but your system may have unique cascades

The most dangerous cascades are the ones that cross domain boundaries — a payment failure that cascades into an auth problem, or a cron job failure that cascades into stale data that cascades into wrong AI responses. Look for those cross-domain chains specifically.
