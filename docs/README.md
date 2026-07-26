---
title: "SGS Quotes Documentation"
description: "Documentation hub for the Stellar Global Supplies Quote Application — architecture, runbooks, API, infrastructure, and ADRs"
---

# docs/

All documentation for this service lives here and is automatically published to
[docs.stellarglobalsupplies.com](https://docs.stellarglobalsupplies.com).

**Author:** Prasad Bhavsar

---

## Quick reference

| Folder | What to put here | Template |
|--------|-----------------|----------|
| `architecture/` | System design, data flows, component diagrams | `templates/architecture.md` |
| `runbooks/` | Ops procedures, incident response, on-call guides | `templates/runbook.md` |
| `infra/` | Terraform modules, deployment steps, environments | `templates/infra.md` |
| `api/` | Endpoint docs, auth, request/response examples | `templates/api.md` |
| `adr/` | Architecture Decision Records | `templates/adr.md` |
| `images/` | PNG/SVG images referenced from docs above | — |
| `templates/` | Starter templates — copy, fill in, save to correct subfolder | — |

## How to use this documentation

1. **New team members** — start with the [architecture doc](architecture/sgs-quote-app-architecture.md) to understand the system design
2. **On-call engineers** — familiarise yourself with the [runbooks](runbooks/sgs-quote-app-high-error-rate.md) before your first shift
3. **Developers** — refer to the [API reference](api/sgs-quote-app-api.md) when integrating with the backend
4. **DevOps / Platform** — review the [infrastructure docs](infra/sgs-quote-app-infra.md) for Terraform modules and deployment steps
5. **Decision context** — read the [ADRs](adr/adr-001-supabase-vs-self-hosted.md) to understand key architectural choices

## Documentation inventory

| Doc | Path | Last Updated | Author |
|-----|------|-------------|--------|
| Architecture Overview | `docs/architecture/sgs-quote-app-architecture.md` | 2025-07-26 | Prasad Bhavsar |
| OTLP Lambda Tracing Guide | `docs/architecture/otlp-lambda-tracing.md` | 2025-07-26 | Prasad Bhavsar |
| Example Payments Architecture | `docs/architecture/example-payments-architecture.md` | 2025-07-26 | Prasad Bhavsar |
| High Error Rate Runbook | `docs/runbooks/sgs-quote-app-high-error-rate.md` | 2025-07-26 | Prasad Bhavsar |
| Example Payments Runbook | `docs/runbooks/example-payments-high-error-rate.md` | 2025-07-26 | Prasad Bhavsar |
| Infrastructure Overview | `docs/infra/sgs-quote-app-infra.md` | 2025-07-26 | Prasad Bhavsar |
| API Reference | `docs/api/sgs-quote-app-api.md` | 2025-07-26 | Prasad Bhavsar |
| ADR-001: Supabase vs Self-Hosted | `docs/adr/adr-001-supabase-vs-self-hosted.md` | 2025-07-26 | Prasad Bhavsar |
| ADR-002: Lambda vs ECS Fargate | `docs/adr/adr-002-lambda-vs-ecs-fargate.md` | 2025-07-26 | Prasad Bhavsar |

## Rules

1. **Files must be `.md`** — no `.txt`, no `.docx`
2. **Use `kebab-case` filenames** — `rds-failover.md` ✅, `RDS Failover.md` ❌
3. **Start every file with frontmatter:**
   ```
   ---
   title: "Your Title"
   description: "One sentence description"
   ---
   ```
4. **Images go in `docs/images/`** — reference with `../images/filename.png`
5. **Never edit `stellar-docs` directly** — always edit here and merge
6. **Every doc must include an author field** in the frontmatter

## Full instructions

See **[CONTRIBUTING-DOCS.md](../CONTRIBUTING-DOCS.md)** in the repo root.