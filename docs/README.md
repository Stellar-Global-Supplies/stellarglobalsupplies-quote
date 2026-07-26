# docs/

All documentation for this service lives here and is automatically published to
[docs.stellarglobalsupplies.com](https://docs.stellarglobalsupplies.com).

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

## Full instructions

See **[CONTRIBUTING-DOCS.md](../CONTRIBUTING-DOCS.md)** in the repo root.
