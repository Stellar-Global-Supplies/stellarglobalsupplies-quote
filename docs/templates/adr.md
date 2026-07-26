---
title: "ADR-[NNN]: [Short title of decision]"
description: "Architecture Decision Record — [one sentence summary]"
---

<!--
  TEMPLATE: Architecture Decision Record (ADR)
  =============================================
  Copy to docs/adr/adr-<NNN>-<short-title>.md
  e.g. docs/adr/adr-001-postgresql-vs-dynamodb.md
       docs/adr/adr-002-fargate-vs-ec2.md

  ADR numbers are sequential. Check existing ADRs before numbering.
  Once merged, ADRs are NEVER deleted — only superseded by a newer ADR.
-->

## Status

`Proposed` | `Accepted` | `Deprecated` | `Superseded by ADR-[NNN]`

**Date:** `YYYY-MM-DD`
**Deciders:** `@name1`, `@name2`, `@name3`
**Technical story:** [Link to ticket / RFC / discussion]

---

## Context

> Describe the situation that forces a decision to be made.
> What is the technical or business problem?
> What constraints exist (cost, team expertise, timeline, compliance)?
> Write this in present tense — the situation as it is NOW.

Example:
We need to choose a primary database for the Orders service. The service requires
ACID transactions, complex queries with joins, and needs to handle ~500 writes/min
at peak. The team has strong PostgreSQL experience. We have no existing DynamoDB
expertise.

---

## Decision

> State the decision clearly in one sentence.
> Start with "We will..." or "We have decided to..."

We will use **PostgreSQL 15 on RDS** as the primary datastore for the Orders service.

---

## Options considered

### Option A: PostgreSQL on RDS ✅ (chosen)

**Description:** Managed relational database on AWS RDS using PostgreSQL 15.

**Pros:**
- ACID compliant, strong consistency
- Team has 5+ years of PostgreSQL experience
- Rich query capabilities — joins, CTEs, window functions
- AWS manages patching, backups, Multi-AZ failover
- Cost: ~$260/month (db.r7g.large, Multi-AZ)

**Cons:**
- Vertical scaling only for writes
- Connection limits require pooling (PgBouncer or RDS Proxy)
- Not serverless — fixed cost even at low load

---

### Option B: DynamoDB

**Description:** AWS managed NoSQL key-value and document store.

**Pros:**
- Truly serverless — scales to zero
- Single-digit millisecond latency at any scale
- No connection management

**Cons:**
- No joins — requires denormalisation or multiple queries
- Team has no DynamoDB experience — significant ramp-up
- Complex queries (reports, analytics) require DynamoDB Streams + additional infra
- Access patterns must be defined upfront

---

### Option C: Aurora Serverless v2

**Description:** MySQL/PostgreSQL-compatible managed DB with serverless scaling.

**Pros:**
- PostgreSQL-compatible — reuse existing skills
- Scales down to near-zero when idle
- Auto-scales up under load

**Cons:**
- 2–3x more expensive than RDS at sustained load
- Slightly higher latency than RDS at steady state
- Minimum ACU = 0.5 even at "zero" scale

---

## Decision rationale

We chose **Option A (PostgreSQL on RDS)** because:

1. **Team expertise** — zero ramp-up time, immediate productivity
2. **Query requirements** — the order reporting queries use complex joins that
   would require significant re-architecture on DynamoDB
3. **ACID compliance** — order creation must be transactional (inventory check +
   order insert + payment record must all succeed or all fail)
4. **Cost** — Aurora Serverless v2 would cost ~$500/month vs $260 for RDS at
   our expected load profile
5. **Operational simplicity** — RDS Multi-AZ handles failover automatically;
   team already has runbooks for RDS operations

Option B was rejected primarily due to the access pattern inflexibility and
the team's lack of DynamoDB expertise introducing delivery risk.

Option C was rejected due to cost — we can revisit if load becomes unpredictable.

---

## Consequences

### Positive
- Immediate delivery — no learning curve
- Existing RDS runbooks apply directly
- Can use SQLAlchemy ORM which the team already uses

### Negative / risks
- Write scaling ceiling — if we exceed ~5000 writes/min we'll need to shard or migrate
- Connection pooling required from day one — add RDS Proxy to the Terraform module
- We accept vendor lock-in to AWS RDS

### Mitigations
- Add `connection_pool` config to the ECS task from day one
- Set a CloudWatch alarm at 70% of max connections
- Revisit this ADR if monthly write volume exceeds 50M

---

## Related

- [Architecture: Orders Service](../architecture/orders-service-architecture.md)
- [Infra: RDS Terraform Module](../infra/rds-module.md)
- [ADR-003: Why we chose RDS Proxy over PgBouncer](./adr-003-rds-proxy-vs-pgbouncer.md) *(if exists)*
