---
title: "ADR-002: Why we chose Lambda over ECS Fargate"
description: "Architecture Decision Record — choosing AWS Lambda over ECS Fargate for the SGS Quote Application backend"
author: "Prasad Bhavsar"
---

<!--
  ADR-002: Lambda vs ECS Fargate
  ===============================
  Check existing ADRs before numbering.
  Once merged, ADRs are NEVER deleted — only superseded by a newer ADR.
-->

## Status

`Accepted`

**Date:** `2025-07-26`
**Deciders:** `@prasadbhavsar`, `@team-sgs-quote`
**Author:** `Prasad Bhavsar`
**Technical story:** [Link to ticket / RFC / discussion]

---


## Context

The SGS Quote App backend needs to handle HTTP API requests for quote CRUD operations, customer  management, SKU search, and email dispatch. The workload is characterised by:

- **Low traffic:** ~1,000 quotes created per month, ~10,000 API requests/month
- **Bursty usage:** Sales team activity spikes during business hours (9 AM–6 PM IST) with near-zero traffic overnight
- **Short-lived requests:** Most operations complete in <5 seconds; email sending is the longest operation at ~30 seconds
- **Variable compute needs:** Simple operations (GET customers, GET SKUs) need minimal CPU/memory, while PDF generation and email sending need more
- **Small team:** No dedicated infrastructure or operations team

We evaluated two compute options:
1. **AWS Lambda** — serverless function-as-a-service
2. **AWS ECS Fargate** — serverless container orchestration

Key constraints:
- **Team size:** 2–3 developers with no container orchestration experience
- **Budget:** Startup-stage — minimise fixed costs
- **Complexity budget:** The team already manages Terraform, Supabase, and a React frontend — adding ECS would stretch operations capacity
- **Cold start tolerance:** Sub-second cold starts acceptable; critical path is quote creation (a few seconds is fine)
- **No existing container infrastructure:** No ECR, no Docker Compose setup, no CI/CD for containers

---

## Decision

We will use **AWS Lambda (Python 3.12)** as the compute platform for the SGS Quote App backend, with 7 Lambda functions fronted by API Gateway HTTP API.

---

## Options considered

### Option A: AWS Lambda ✅ (chosen)

**Description:** Serverless function-as-a-service. Each API endpoint maps to a dedicated Lambda function. Deployed via Terraform with zipped code packages.

**Pros:**
- **Zero infrastructure management** — no servers, no containers, no orchestrator
- **Autoscaling** — scales from 0 to hundreds of concurrent executions instantly
- **Pay-per-use** — $0.00 when idle; ~$1/month at current traffic levels
- **Per-function configuration** — each function gets its own memory (128MB–512MB), timeout (10s–60s), and IAM role
- **Simple deployment** — zip Python code + dependencies, Terraform updates the function code
- **Team familiarity** — team has prior Lambda experience
- **Tracing integration** — native OpenTelemetry support via Lambda extensions

**Cons:**
- **Cold starts** — 200–500ms cold start for Python functions with dependencies
- **Execution duration limit** — max 15 minutes (not a constraint for current use case, max operation is 60s)
- **Package size limit** — 250MB unzipped (Lambda deploys); requires Lambda layers for large dependencies
- **Stateless** — no local filesystem persistence between invocations (Lambda ephemeral storage is 512MB–10GB)
- **VPC networking latency** — Lambda in VPC adds 1–2s cold start for ENI setup

---

### Option B: ECS Fargate

**Description:** Serverless container orchestration running on AWS Fargate with an Application Load Balancer (ALB) frontend.

**Pros:**
- **No cold starts** — containers are always warm (or can be configured with auto-scaling)
- **Long-running processes** — no execution duration limit
- **Standard Docker workflow** — consistent local development and production environments
- **Larger compute** — up to 16 vCPU and 120GB memory per task
- **Persistent storage** — EFS can be mounted for shared filesystem access

**Cons:**
- **Always-on cost** — minimum 1 task running 24/7 (~$30/month for small task with 0.25 vCPU, 0.5GB RAM)
- **Infrastructure complexity** — requires ALB, ECS cluster, ECR, task definitions, service auto-scaling, CloudWatch alarms
- **Deployment complexity** — requires Docker image build, push to ECR, ECS service update (vs zip + Terraform for Lambda)
- **Team learning curve** — no existing ECS or Docker Compose expertise on the team
- **Slower deploys** — image build + push + service update takes 3–5 minutes vs 30 seconds for Lambda
- **Over-provisioning for low traffic** — at ~10K requests/month, a single Fargate task is idle 95% of the time

---

### Option C: Lambda + Containers (Lambda container images)

**Description:** AWS Lambda using container images (up to 10GB) instead of zip deployments, combining Lambda's serverless execution with Docker's packaging flexibility.

**Pros:**
- **Larger packages** — up to 10GB vs 250MB for zip deployments
- **Consistent packaging** — Docker image used for both local development and Lambda
- **Same Lambda scaling** — inherits Lambda's pay-per-use and auto-scaling
- **Layering large dependencies** — easier for ML/native libraries (e.g., psycopg2 binary with PostgreSQL libraries)

**Cons:**
- **Cold start penalty** — larger images increase cold start time (2–5 seconds for 1GB+ images)
- **Image management overhead** — must push to ECR, maintain image tags, manage image lifecycle
- **No benefit for this project** — current Lambda code is <50MB zipped; no native dependencies that require >250MB
- **Debugging complexity** — harder to inspect container images vs zip deployments locally

---

## Decision rationale

We chose **Option A (AWS Lambda)** because:

1. **Cost at low scale** — Lambda costs ~$1/month vs ~$30/month for the minimum Fargate configuration. At ~10K requests/month, Lambda is 97% cheaper.

2. **Operational simplicity** — no ALB, no ECS cluster, no ECR, no task definitions. A single Terraform resource (`aws_lambda_function`) per endpoint. For a 2–3 person team, this is the difference between a 1-hour deploy and a 1-day setup.

3. **Right-sized for workload** — the API operations are short-lived (10s–60s max) and stateless. Lambda's execution model is a natural fit.

4. **Per-function resource optimisation** — `send_email` needs 512MB and 60s timeout; `get_customers` runs fine with 128MB and 10s. Lambda allows per-function configuration. Fargate would require separate task definitions or over-provisioning.

5. **Zero idle cost** — Lambda charges only when code runs. Fargate charges for running tasks even when idle. Given 8-hour bursty usage with near-zero traffic overnight, Lambda is significantly more cost-effective.

Option B (ECS Fargate) was rejected because the operational overhead and always-on cost are not justified at current traffic levels. We can revisit if traffic grows to >100K requests/month or if a request exceeds Lambda's 15-minute timeout.

Option C (Lambda containers) was rejected because it introduces image management overhead without any benefit — the current codebase fits well within the 250MB zip limit, and cold starts would degrade the user experience unnecessarily.

---

## Consequences

### Positive
- **Lowest possible cost** at current traffic levels
- **Minimal operational overhead** — the team can manage the entire backend with Terraform and zipped deploys
- **Granular resource allocation** — each function gets its own memory, timeout, and IAM role
- **Rapid deploys** — code changes deploy in ~30 seconds (zip + Terraform)

### Negative / risks
- **Cold start on first request** — the first request after idle period experiences 200–500ms latency; acceptable for internal tooling but could be jarring for interactive use
- **Package management** — if dependencies grow >250MB, must switch to Lambda layers or container images
- **VPC cold start penalty** — if Lambda requires VPC access (e.g., for RDS), cold start adds 1–2s for ENI setup
- **No long-running processes** — cannot handle operations exceeding 15 minutes (not currently needed but worth noting)

### Mitigations
- **Provisioned Concurrency** — can be enabled if cold start becomes a problem; 1 concurrent execution adds ~$0.000011 per GB-second
- **Lambda Power Tuning** — run periodic tuning to ensure optimal memory allocation per function
- **Stay on zip deployments** — avoid container images until the 250MB limit is actually reached
- **Keep Lambda out of VPC** — currently no VPC dependency; Supabase is accessed over the internet, SES via AWS API, SSM via SDK
- **Revisit this ADR** if monthly API requests exceed 100K or if a new use case requires >15-minute execution

---

## Related

- [Architecture: SGS Quote App](../architecture/sgs-quote-app-architecture.md)
- [Infra: SGS Quote App Infrastructure](../infra/sgs-quote-app-infra.md)
- [API: SGS Quote App API Reference](../api/sgs-quote-app-api.md)
- [Lambda Functions — Backend Source](../backend/lambda/)
- [Terraform Module — Lambda Resources](../infrastructure/terraform/main.tf)
- [ADR-001: Why we chose Supabase over self-hosted PostgreSQL](./adr-001-supabase-vs-self-hosted.md)