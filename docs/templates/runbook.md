---
title: "[Service] — [Procedure Name] Runbook"
description: "Step-by-step procedure for [what this runbook handles]"
---

<!--
  TEMPLATE: Operational Runbook
  ================================
  Copy to docs/runbooks/<service>-<procedure>.md
  e.g. docs/runbooks/rds-failover.md
       docs/runbooks/ecs-rollback.md
       docs/runbooks/high-cpu-incident.md
-->

## Summary

> One paragraph. When do you use this runbook? What problem does it solve?

**Service:** `stellar-[service-name]`
**Owner:** `@team-name`
**On-call rotation:** [Link to PagerDuty / OpsGenie]
**Last tested:** `YYYY-MM-DD`
**Estimated time:** ~X minutes

---

## Prerequisites

Before starting, confirm you have:

- [ ] AWS console access for `stellarglobalsupplies` account
- [ ] `kubectl` / `aws cli` configured for `ap-south-1`
- [ ] Access to `#eng-ops` Slack channel
- [ ] [Any other tool or permission needed]

---

## When to use this runbook

Use this runbook when **any** of the following are true:

- Alert fired: `[Alert Name]` in [CloudWatch / PagerDuty]
- Symptom: [Describe observable symptom, e.g. "Orders returning 503"]
- Customer report: [Describe what users experience]

**Do NOT use this runbook if:**

- [Counter-indication 1 — use Runbook X instead]
- [Counter-indication 2]

---

## Impact assessment

Before taking action, assess impact:

```bash
# Check current error rate (last 5 minutes)
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count \
  --dimensions Name=LoadBalancer,Value=<alb-name> \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Sum
```

| Metric | Healthy | Degraded | Critical |
|--------|---------|----------|---------|
| Error rate | < 1% | 1–5% | > 5% |
| P99 latency | < 200ms | 200–500ms | > 500ms |
| Active tasks | ≥ 2 | 1 | 0 |

---

## Runbook steps

> Follow steps in order. Tick each checkbox as you complete it.

### Step 1: Notify the team

- [ ] Post in `#eng-ops`: "🔴 Investigating [issue] on [service]. Running [this runbook]."
- [ ] If P1: page the on-call lead via PagerDuty

### Step 2: Confirm the problem

- [ ] Open the [CloudWatch dashboard](https://console.aws.amazon.com/...)
- [ ] Check logs for errors:

```bash
aws logs filter-log-events \
  --log-group-name /ecs/stellar-[service] \
  --filter-pattern "ERROR" \
  --start-time $(date -d '15 minutes ago' +%s000) \
  | jq '.events[].message'
```

- [ ] Note the first error timestamp: `________________`
- [ ] Note the error message pattern: `________________`

### Step 3: [Primary remediation action]

> Describe the action clearly. Include exact commands.

- [ ] [Action description]:

```bash
# Example: restart the ECS service
aws ecs update-service \
  --cluster stellar-production \
  --service stellar-[service]-svc \
  --force-new-deployment \
  --region ap-south-1
```

Expected output:
```
{
  "service": {
    "serviceName": "stellar-[service]-svc",
    "status": "ACTIVE",
    ...
  }
}
```

- [ ] Wait for deployment to stabilise (~3 minutes):

```bash
aws ecs wait services-stable \
  --cluster stellar-production \
  --services stellar-[service]-svc \
  --region ap-south-1
```

### Step 4: Verify recovery

- [ ] Error rate returned below 1%:

```bash
# Run the same check as Step 1 / Impact Assessment
```

- [ ] Check 3 recent successful requests in logs
- [ ] Confirm no new alerts fired in the last 5 minutes

### Step 5: Close the incident

- [ ] Post in `#eng-ops`: "✅ [Service] recovered. [Brief description of what was done]."
- [ ] Resolve PagerDuty alert if open
- [ ] Add to the incident log: [Link to incident tracker]

---

## Rollback

If the steps above made things worse:

```bash
# Roll back ECS to the previous task definition
PREVIOUS_TASK_DEF=$(aws ecs describe-services \
  --cluster stellar-production \
  --services stellar-[service]-svc \
  --query 'services[0].deployments[-1].taskDefinition' \
  --output text)

aws ecs update-service \
  --cluster stellar-production \
  --service stellar-[service]-svc \
  --task-definition $PREVIOUS_TASK_DEF \
  --region ap-south-1
```

---

## Escalation path

| Time elapsed | Action |
|---|---|
| 0–15 min | Follow this runbook, notify `#eng-ops` |
| 15–30 min | Escalate to `@on-call-lead` on PagerDuty |
| 30+ min | Escalate to `@engineering-manager`, consider customer comms |

**On-call contacts:**
- Primary: [Name] — PagerDuty / Slack `@handle`
- Secondary: [Name] — PagerDuty / Slack `@handle`

---

## Post-incident

After every incident using this runbook:

- [ ] File an incident report within 24 hours: [Incident Report Template]
- [ ] Schedule a blameless post-mortem if P1 or P2
- [ ] Update this runbook if any step was wrong or unclear
- [ ] Update `Last tested` date at the top of this file

---

## Related

- [Architecture: Service Name](../architecture/service-name-architecture.md)
- [Runbook: Related Procedure](./related-runbook.md)
- [Alert: Alert Name](https://console.aws.amazon.com/cloudwatch/...)
