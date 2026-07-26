---
title: "Payments — High Error Rate Runbook"
description: "Response steps when the Payments Service error rate exceeds 5%"
---

> This is an **example** of a filled-in runbook.
> Copy `docs/templates/runbook.md` and fill it in like this.
> Delete this callout when you write your real doc.

## Summary

Use this runbook when the Payments Service is returning an elevated rate of
5xx errors, causing order placement failures. This is typically triggered by
the `PaymentsErrorRate > 5%` CloudWatch alarm.

**Service:** `stellar-payments-api`
**Owner:** `@team-payments`
**On-call rotation:** [PagerDuty — Payments rotation](https://stellar.pagerduty.com/payments)
**Last tested:** `2025-06-14`
**Estimated time:** ~15 minutes

---

## Prerequisites

- [ ] AWS console access (`stellarglobalsupplies-production`)
- [ ] `aws cli` configured with production profile
- [ ] Access to `#eng-ops` Slack channel
- [ ] Stripe dashboard access (for external verification)

---

## When to use this runbook

- Alert: `PaymentsErrorRate > 5%` in PagerDuty
- Symptom: Orders failing at checkout with "Payment processing error"
- Customer report: "I can't place an order"

**Do NOT use this runbook if:**
- Error rate is < 5% and not customer-impacting — monitor and check logs
- The issue is in the Orders Service, not Payments — use the Orders runbook

---

## Impact assessment

```bash
# Check error rate right now (last 5 min)
aws cloudwatch get-metric-statistics \
  --namespace StellarPayments \
  --metric-name ErrorRate \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average \
  --region ap-south-1
```

---

## Runbook steps

### Step 1: Notify the team

- [ ] Post in `#eng-ops`: "🔴 Investigating high error rate on stellar-payments-api. Running payments-high-error-rate runbook."
- [ ] If > 20% error rate for > 5 minutes: trigger P1 via PagerDuty immediately

### Step 2: Check if Stripe is down

- [ ] Open [Stripe Status](https://status.stripe.com) — check for incidents
- [ ] If Stripe has an active incident → this is external, not our fault

```
→ Post in #eng-ops: "⚠️ Stripe has an active incident: <link>. Monitoring."
→ Set orders to "pending" mode if possible (coordinate with Orders team)
→ Wait for Stripe to recover — no further action on our side
→ Skip to Step 5
```

### Step 3: Check Payments Service logs

```bash
aws logs filter-log-events \
  --log-group-name /ecs/stellar-payments-api \
  --filter-pattern "ERROR" \
  --start-time $(date -d '15 minutes ago' +%s000) \
  --region ap-south-1 \
  | jq '.events[].message' | head -20
```

Common error patterns:

| Log pattern | Likely cause | Go to |
|-------------|-------------|-------|
| `Connection refused` | DB is unreachable | Step 4a |
| `Stripe API timeout` | Stripe slow/down | Step 2 |
| `Invalid API key` | Secrets rotation issue | Step 4b |
| `OOMKilled` | Memory limit hit | Step 4c |

### Step 4a: DB unreachable

```bash
# Check RDS status
aws rds describe-db-instances \
  --db-instance-identifier stellar-payments-db \
  --query 'DBInstances[0].DBInstanceStatus' \
  --region ap-south-1
```

If status is `failing-over` → Multi-AZ failover in progress, wait ~30s and recheck.
If status is `stopped` → escalate immediately to `@on-call-lead`.

### Step 4b: Invalid Stripe API key

```bash
# Force Secrets Manager cache refresh by restarting ECS tasks
aws ecs update-service \
  --cluster stellar-production \
  --service stellar-payments-svc \
  --force-new-deployment \
  --region ap-south-1

# Wait for stable
aws ecs wait services-stable \
  --cluster stellar-production \
  --services stellar-payments-svc \
  --region ap-south-1
```

### Step 4c: OOM / task restart loop

```bash
# Scale up task memory temporarily
aws ecs update-service \
  --cluster stellar-production \
  --service stellar-payments-svc \
  --task-definition stellar-payments-api:LATEST \
  --region ap-south-1
```

Then open a ticket to increase the memory limit in Terraform.

### Step 5: Verify recovery

- [ ] Error rate below 1% for 3 consecutive minutes
- [ ] Post in `#eng-ops`: "✅ Payments Service recovered. [Brief summary of root cause and action taken]."
- [ ] Resolve PagerDuty alert

---

## Escalation

| Time | Action |
|------|--------|
| 0–15 min | This runbook + `#eng-ops` |
| 15–30 min | Page `@on-call-lead` |
| 30 min+ | Page `@engineering-manager`, draft customer comms |

---

## Related

- [Architecture: Payments Service](../architecture/example-payments-architecture.md)
- [API: Payments API](../api/payments-api.md)
- [Runbook: RDS Failover](./rds-failover.md)
