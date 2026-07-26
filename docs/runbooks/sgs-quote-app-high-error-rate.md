---
title: "SGS Quote App — High Error Rate Runbook"
description: "Response steps when the SGS Quote App API error rate exceeds 5%"
author: "Prasad Bhavsar"
---

## Summary

Use this runbook when the Quote App API is returning an elevated rate of 5xx errors, preventing sales team members from creating or managing quotes. This is typically triggered by the `QuoteAppErrorRate > 5%` CloudWatch alarm.

**Service:** `sgs-quote-app`
**Owner:** `@team-sgs-quote`
**Author:** `Prasad Bhavsar`
**On-call rotation:** [PagerDuty — SGS Quote rotation](https://stellar.pagerduty.com/sgs-quote)
**Last tested:** `2025-07-15`
**Estimated time:** ~15 minutes

---

## Overview

This runbook covers the procedure for diagnosing and resolving high error rates in the SGS Quote App. The app consists of 7 Lambda functions, a Supabase PostgreSQL database, and SES for email delivery. Errors can originate from any of these components.

### Common Failure Scenarios

| Scenario | Likelihood | Impact |
|----------|-----------|--------|
| Supabase database outage or latency | Medium | All API endpoints affected |
| Lambda timeout due to slow queries | Low | Specific endpoints affected | 
| SSM parameter missing or rotated | Low | All Lambda invocations fail |
| SES sending limits exceeded | Low | Email sending fails |
| Cognito JWT validation issues | Low | Authentication failures |

---

## Prerequisites

- [ ] AWS console access (`stellarglobalsupplies-production`)
- [ ] `aws cli` configured with production profile
- [ ] Access to `#eng-ops` Slack channel
- [ ] Supabase dashboard access
- [ ] New Relic APM access for trace analysis

---

## When to use this runbook 

- Alert: `QuoteAppErrorRate > 5%` in PagerDuty
- Symptom: Quote creation or listing fails in the UI
- Customer report: "I can't create a quote" or "Quote page shows an error"

**Do NOT use this runbook if:**
- Error rate is < 5% and not customer-impacting — monitor and check logs
- The issue is specific to one user only — check Cognito / auth first

---

## Impact assessment

```bash
# Check error rate right now (last 5 min) across all functions
for fn in save_quote get_quotes delete_quote save_customer get_customers get_skus send_email; do
  aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Errors \
    --dimensions Name=FunctionName,Value=sgs-quote-app-${fn} \
    --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
    --period 300 \
    --statistics Sum \
    --region us-east-1 \
    --output text
done

# Check total invocations vs errors
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=sgs-quote-app-save_quote \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Sum \
  --region us-east-1
```

---

## Runbook steps

### Step 1: Notify the team

- [ ] Post in `#eng-ops`: "🔴 Investigating high error rate on sgs-quote-app. Running high-error-rate runbook."
- [ ] If > 20% error rate for > 5 minutes: trigger P1 via PagerDuty immediately
- [ ] Check if anyone has already acknowledged or is working on the issue

### Step 2: Check New Relic for trace insights

```bash
# Open New Relic APM for sgs-quote-app
# Look for error traces in the last 15 minutes
```

- [ ] Open [New Relic APM — sgs-quote-app](https://one.newrelic.com)
- [ ] Go to **APM & Services** → `sgs-quote-app` → **Errors**
- [ ] Look for error traces grouped by `http.route` and `error.message`
- [ ] Identify which specific endpoint(s) are failing

### Step 3: Check Lambda logs

```bash
# Check errors across all Lambda functions (last 15 min)
for fn in save_quote get_quotes delete_quote save_customer get_customers get_skus send_email; do
  echo "=== sgs-quote-app-${fn} ==="
  aws logs filter-log-events \
    --log-group-name /aws/lambda/sgs-quote-app-${fn} \
    --filter-pattern "ERROR" \
    --start-time $(date -d '15 minutes ago' +%s000) \
    --region us-east-1 \
    | jq '.events[].message' | head -5
done
```

Common error patterns:

| Log pattern | Likely cause | Go to |
|-------------|-------------|-------|
| `Supabase error` | Database unreachable or query error | Step 4a |
| `timeout` | Lambda timeout exceeded | Step 4b |
| `SSM` / `ParameterNotFound` | Secrets missing or wrong | Step 4c |
| `New Relic` / `OTLP` | Telemetry export failure (non-critical) | Step 5 |
| `SES` / `Throttling` | SES rate limit exceeded | Step 4d |
| `Cognito` / `JWT` | Authentication failure | Step 4e |

### Step 4a: Supabase / Database issue

```bash
# Check Supabase status
curl -s https://status.supabase.com | grep -i "incident\|outage"

# Check Supabase project health (from Supabase dashboard)
# Navigate to: Database → Reports → Query performance
```

- [ ] Open [Supabase Status](https://status.supabase.com) — check for active incidents
- [ ] If Supabase has an incident → this is external, not our fault
- [ ] Sign in to Supabase dashboard → check database connections and query performance
- [ ] Check active connection count — Pro plan limit is 200
- [ ] Check if there are any slow queries in the query performance tab

```
→ Post in #eng-ops: "⚠️ Supabase has an active incident: <link>. Monitoring."
→ No action on our side — wait for Supabase to recover
→ Skip to Step 5
```

### Step 4b: Lambda timeout

```bash
# Check duration metrics for all functions
for fn in save_quote get_quotes delete_quote save_customer get_customers get_skus send_email; do
  echo "=== sgs-quote-app-${fn} ==="
  aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Duration \
    --dimensions Name=FunctionName,Value=sgs-quote-app-${fn} \
    --start-time $(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
    --period 300 \
    --statistics Maximum \
    --region us-east-1 \
    --output text
done
```

| Function | Timeout | Typical Duration | Action if exceeded |
|----------|---------|-----------------|-------------------|
| `save_quote` | 30s | 500ms–2s | Check Supabase query performance |
| `get_quotes` | 30s | 200ms–1s | Check if index is missing |
| `delete_quote` | 10s | 100ms–500ms | Check row locks |
| `save_customer` | 10s | 100ms–500ms | Check for duplicates query |
| `get_customers` | 10s | 100ms–300ms | Normal |
| `get_skus` | 10s | 100ms–300ms | Normal |
| `send_email` | 60s | 2s–5s | Check SES reputation |

If average duration is near the timeout limit:

- [ ] Temporarily increase Lambda timeout in Terraform and redeploy
- [ ] Open a ticket to investigate query performance or Supabase latency
- [ ] Consider adding database indexes for slow queries

### Step 4c: Secrets / SSM issue

```bash
# Check if SSM parameters exist
for param in supabase_url supabase_service_role_key new_relic_license_key; do
  echo "=== /sgs-quote/${param} ==="
  aws ssm get-parameter \
    --name "/sgs-quote/${param}" \
    --with-decryption \
    --region us-east-1 2>&1
done
```

- [ ] Verify all SSM parameters under `/sgs-quote/` exist
- [ ] If parameters were rotated, ensure the Lambda is configured with the correct `SSM_PREFIX`
- [ ] Force a Lambda cold start to refresh cached secrets:
  ```bash
  for fn in save_quote get_quotes delete_quote save_customer get_customers get_skus send_email; do
    aws lambda update-function-configuration \
      --function-name sgs-quote-app-${fn} \
      --description "Cold start refresh $(date +%s)" \
      --region us-east-1
  done
  ```

### Step 4d: SES / Email sending issue

```bash
# Check SES sending limits
aws ses get-send-quota --region us-east-1

# Check SES reputation
aws ses get-send-statistics --region us-east-1
```

- [ ] Check if daily sending quota is exhausted
- [ ] Check SES reputation dashboard for bounces/complaints
- [ ] If rate limited, check `send_email` function for concurrency issues

### Step 4e: Cognito / Authentication issue

```bash
# Check Cognito User Pool status
aws cognito-idp describe-user-pool \
  --user-pool-id $(aws cognito-idp list-user-pools --max-results 10 --region us-east-1 | jq -r '.UserPools[] | select(.Name=="sgs-quote-users") | .Id') \
  --region us-east-1
```

- [ ] Verify Cognito User Pool is active
- [ ] Check if JWT tokens are expired
- [ ] Verify API Gateway JWT authorizer configuration

### Step 5: Verify recovery

- [ ] Error rate below 1% for 3 consecutive minutes
- [ ] Test creating a quote in the UI:
  ```bash
  # Test API health
  curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $(aws cognito-idp admin-initiate-auth ...)" \
    https://api.quote.stellarglobalsupplies.com/api/quotes
  ```
- [ ] Post in `#eng-ops`: "✅ SGS Quote App recovered. [Brief summary of root cause and action taken]."
- [ ] Resolve PagerDuty alert
- [ ] If a ticket was created, update it with findings

---

## Escalation

| Time | Action |
|------|--------|
| 0–15 min | This runbook + `#eng-ops` |
| 15–30 min | Page `@on-call-lead` |
| 30 min+ | Page `@engineering-manager`, draft customer comms |

---

## Post-incident

- [ ] File an incident report within 24 hours
- [ ] Schedule a blameless post-mortem if P1 or P2
- [ ] Update this runbook if any step was wrong or unclear
- [ ] Update `Last tested` date
- [ ] Add monitoring/alerts to prevent recurrence

### Incident Report Template

```markdown
## Incident Report

**Date:** YYYY-MM-DD
**Duration:** HH:MM to HH:MM (X minutes)
**Severity:** P1/P2
**Services affected:** sgs-quote-app
**Root cause:** [Summary]
**Impact:** [Number of users affected, quotes lost, etc.]
**Resolution:** [Steps taken to resolve]
**Prevention:** [Action items to prevent recurrence]
```

---

## Related

- [Architecture: SGS Quote App](../architecture/sgs-quote-app-architecture.md)
- [Infra: SGS Quote App Infrastructure](../infra/sgs-quote-app-infra.md)
- [API: SGS Quote App API Reference](../api/sgs-quote-app-api.md)
- [OTLP Lambda Tracing Guide](../architecture/otlp-lambda-tracing.md)
- [ADR-001: Supabase vs Self-Hosted](../adr/adr-001-supabase-vs-self-hosted.md)