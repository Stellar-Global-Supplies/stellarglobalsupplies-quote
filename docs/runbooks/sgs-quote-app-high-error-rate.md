---
title: "SGS Quote App — High Error Rate Runbook"
description: "Response steps when the SGS Quote App API error rate exceeds 5%"
---

## Summary

Use this runbook when the Quote App API is returning an elevated rate of 5xx errors, preventing sales team members from creating or managing quotes. This is typically triggered by the `QuoteAppErrorRate > 5%` CloudWatch alarm.

**Service:** `sgs-quote-app`
**Owner:** `@team-sgs-quote`
**On-call rotation:** [PagerDuty — SGS Quote rotation](https://stellar.pagerduty.com/sgs-quote)
**Last tested:** `2025-07-15`
**Estimated time:** ~15 minutes

---

## Prerequisites

- [ ] AWS console access (`stellarglobalsupplies-production`)
- [ ] `aws cli` configured with production profile
- [ ] Access to `#eng-ops` Slack channel
- [ ] Supabase dashboard access

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
# Check error rate right now (last 5 min)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
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

### Step 2: Check Lambda logs

```bash
# Check errors across all Lambda functions (last 15 min)
aws logs filter-log-events \
  --log-group-name /aws/lambda/sgs-quote-app-save_quote \
  --filter-pattern "ERROR" \
  --start-time $(date -d '15 minutes ago' +%s000) \
  --region us-east-1 \
  | jq '.events[].message' | head -20
```

Common error patterns:

| Log pattern | Likely cause | Go to |
|-------------|-------------|-------|
| `Supabase error` | Database unreachable or query error | Step 3a |
| `timeout` | Lambda timeout exceeded | Step 3b |
| `SSM` / `ParameterNotFound` | Secrets missing or wrong | Step 3c |
| `New Relic` / `OTLP` | Telemetry export failure (non-critical) | Step 4 |

### Step 3a: Supabase / Database issue

```bash
# Check Supabase status
curl -s https://status.supabase.com | grep -i "incident\|outage"
```

- [ ] Open [Supabase Status](https://status.supabase.com) — check for active incidents
- [ ] If Supabase has an incident → this is external, not our fault
- [ ] Sign in to Supabase dashboard → check database connections and query performance

```
→ Post in #eng-ops: "⚠️ Supabase has an active incident: <link>. Monitoring."
→ No action on our side — wait for Supabase to recover
→ Skip to Step 4
```

### Step 3b: Lambda timeout

```bash
# Check duration metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=sgs-quote-app-save_quote \
  --start-time $(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Maximum \
  --region us-east-1
```

If average duration is near the timeout limit (30s for save_quote, 60s for send_email):

- [ ] Temporarily increase Lambda timeout in Terraform and redeploy
- [ ] Open a ticket to investigate query performance or Supabase latency

### Step 3c: Secrets / SSM issue

```bash
# Check if SSM parameters exist
aws ssm get-parameter \
  --name "/sgs-quote/supabase_url" \
  --with-decryption \
  --region us-east-1
```

- [ ] Verify all SSM parameters under `/sgs-quote/` exist
- [ ] If parameters were rotated, ensure the Lambda is configured with the correct `SSM_PREFIX`
- [ ] Force a Lambda cold start to refresh cached secrets:
  ```bash
  aws lambda update-function-configuration \
    --function-name sgs-quote-app-save_quote \
    --description "Cold start refresh $(date +%s)" \
    --region us-east-1
  ```

### Step 4: Verify recovery

- [ ] Error rate below 1% for 3 consecutive minutes
- [ ] Test creating a quote in the UI
- [ ] Post in `#eng-ops`: "✅ SGS Quote App recovered. [Brief summary of root cause and action taken]."
- [ ] Resolve PagerDuty alert

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

---

## Related

- [Architecture: SGS Quote App](../architecture/sgs-quote-app-architecture.md)
- [Infra: SGS Quote App Infrastructure](../infra/sgs-quote-app-infra.md)
- [API: SGS Quote App API Reference](../api/sgs-quote-app-api.md)