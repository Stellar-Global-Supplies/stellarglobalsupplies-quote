---
title: "ADR-001: Why we chose Supabase over self-hosted PostgreSQL"
description: "Architecture Decision Record — choosing managed Supabase over self-hosted PostgreSQL for the SGS Quote Application"
---

<!--
  ADR-001: Supabase vs Self-Hosted PostgreSQL
  ============================================
  Check existing ADRs before numbering.
  Once merged, ADRs are NEVER deleted — only superseded by a newer ADR.
-->

## Status

`Accepted`

**Date:** `2025-07-26`
**Deciders:** `@prasadbhavsar`, `@team-sgs-quote`
**Technical story:** [Link to ticket / RFC / discussion]

---

## Context

The SGS Quote App requires a relational database to store quotes, customers, and SKU/product data. The data model involves multiple related entities — quotes have line items, customers have multiple quotes, and SKUs cross-reference product categories. The application also needs basic authentication support and a simple API layer for mobile clients.

We evaluated two primary approaches:

1. **Self-hosted PostgreSQL** on AWS RDS (or EC2)
2. **Supabase** — a managed PostgreSQL platform with built-in auth, REST API, and client SDKs

Key constraints influencing this decision:
- **Team size:** Small team (2–3 developers) with no dedicated DBA
- **Timeline:** MVP delivery target of 4 weeks
- **Operations burden:** No existing database monitoring or backup infrastructure
- **Feature requirements:** Need row-level security, real-time subscriptions (future), and a simple API layer
- **Cost sensitivity:** Startup budget — minimise fixed monthly costs
- **Team expertise:** Strong PostgreSQL experience but no Supabase-specific experience

---

## Decision

We will use **Supabase (managed PostgreSQL 15)** as the primary datastore for the SGS Quote Application.

---

## Options considered

### Option A: Supabase ✅ (chosen)

**Description:** Managed PostgreSQL 15 platform with built-in authentication, auto-generated REST API, real-time subscriptions, and a web dashboard.

**Pros:**
- **Zero operations overhead** — backups, patching, replication managed by Supabase
- **Built-in auth** — integrated with Cognito via service role key flow; can also use Supabase Auth as fallback
- **Auto-generated REST API** — useful for ad-hoc queries and mobile clients
- **Row-level security (RLS)** — natively supported, enables multi-tenant data isolation
- **Web dashboard** — provides SQL editor, table browsing, and API documentation without additional tooling
- **Generous free tier** — 500MB database, 50,000 monthly active users included
- **Managed backups** — daily backups with point-in-time recovery on Pro plan ($25/month)
- **Cost:** ~$25/month (Pro plan) for 8GB database, 100GB bandwidth

**Cons:**
- **Vendor lock-in** — tied to Supabase's platform; managed PostgreSQL features are proprietary extensions
- **No AWS integration** — runs on Supabase's infrastructure, higher latency than RDS in the same AWS region
- **Connection limits** — Pro plan limits to 200 simultaneous connections (requires connection pooling for Lambda)
- **Not HIPAA compliant** — cannot store PHI without BAA (not a concern for current scope)
- **Data transfer costs** — egress charges apply if data is moved out of Supabase

---

### Option B: PostgreSQL on RDS

**Description:** Self-managed PostgreSQL 15 on AWS RDS with Multi-AZ deployment.

**Pros:**
- **Full control** — complete access to PostgreSQL configuration (shared_buffers, work_mem, etc.)
- **AWS integration** — low latency within us-east-1, VPC security groups, IAM authentication
- **No vendor lock-in** — standard PostgreSQL, portable to any hosting
- **Scalable** — vertical scaling (instance size) and read replicas for read-heavy workloads
- **Mature ecosystem** — extensive tooling (pgAdmin, pgBackRest, pg_stat_statements)
- **Cost:** ~$260/month (db.r7g.large, Multi-AZ) — significant fixed cost

**Cons:**
- **Operations overhead** — must manage backups, patching, monitoring, failover testing
- **DBA required** — need expertise for performance tuning, vacuum management, connection pooling
- **No built-in auth** — must integrate separately with Cognito or build custom auth
- **No auto-generated API** — need to build REST API layer manually
- **Fixed cost at low load** — $260/month even when database is idle
- **Backup management** — must configure automated backups, test restore procedures

---

### Option C: SQLite + S3 (serverless)

**Description:** SQLite database stored on S3 with Lambda-based access, using a serverless query engine.

**Pros:**
- **Near-zero cost** — S3 storage is $0.023/GB/month
- **No server management** — fully serverless
- **Simple setup** — no connection management, no VPC

**Cons:**
- **No concurrency** — SQLite is single-writer; concurrent Lambda invocations cause contention
- **No RLS** — must implement authorization entirely in application code
- **Limited query capability** — no window functions, no CTEs in some SQLite versions
- **Data sizing** — SQLite databases > 1GB have performance degradation
- **Not production-grade** — no built-in replication, no point-in-time recovery
- **Lambda cold start with large DB** — downloading a multi-MB SQLite file on every cold start adds latency

---

## Decision rationale

We chose **Option A (Supabase)** because:

1. **Operational simplicity** — no DBA required; backups, patching, and replication are managed. For a team of 2–3 developers building an MVP, this removes significant operational burden.

2. **Time to market** — the auto-generated REST API and built-in auth reduce backend development time by an estimated 2–3 weeks. The Supabase JS client library integrates directly with the React frontend.

3. **RLS out of the box** — row-level security is a first-class feature in Supabase. For a multi-tenant application, this provides fine-grained access control without custom middleware.

4. **Cost at low scale** — $25/month vs $260/month for RDS. At current scale (~1,000 quotes/month), the cost difference is significant. We can migrate to RDS if/when scale demands it.

5. **Progressive migration path** — Supabase is built on PostgreSQL. If we outgrow it, we can dump the database and import into RDS with minimal schema changes.

Option B was rejected primarily due to the operational overhead and fixed cost. The team does not have capacity to manage a production PostgreSQL instance.

Option C was rejected due to concurrency limitations — Lambda functions can invoke simultaneously, and SQLite's single-writer constraint would cause failures under load.

---

## Consequences

### Positive
- **Rapid development** — auto-generated API and auth reduce backend scope by ~40%
- **Zero database administration** — no patching, backup configuration, or performance tuning
- **Built-in dashboard** — the Supabase Studio web UI is useful for ad-hoc queries and debugging
- **Migration path exists** — standard PostgreSQL means we can migrate to RDS later

### Negative / risks
- **Vendor lock-in** — Supabase's managed features (RLS helper functions, real-time subscriptions) are proprietary
- **Latency** — Supabase infra is not in the same AWS account; expect 5–15ms additional latency from Lambda
- **Connection limits** — Pro plan allows 200 connections; Lambda scaling could exhaust the pool
- **No HIPAA** — if the application ever needs to handle PHI, migration to RDS becomes mandatory

### Mitigations
- **Connection pooling** — configure PgBouncer (included in Supabase Pro plan) to handle Lambda connection bursts
- **Tracing** — add OTLP span for database queries to monitor latency; alert if p99 exceeds 100ms
- **Data export** — run a weekly `pg_dump` to S3 as a cold backup (defense against vendor lock-in)
- **Connection monitoring** — track Supabase active connections in the SGS Quote dashboard; alert at 80% usage
- **Revisit this ADR** if monthly active users exceed 10,000 or database size exceeds 8GB

---

## Related

- [Architecture: SGS Quote App](../architecture/sgs-quote-app-architecture.md)
- [Infra: SGS Quote App Infrastructure](../infra/sgs-quote-app-infra.md)
- [API: SGS Quote App API Reference](../api/sgs-quote-app-api.md)
- [Supabase Schema](../infrastructure/supabase_schema.sql)
- [ADR-002: Why we chose Lambda over ECS Fargate](./adr-002-lambda-vs-ecs-fargate.md)