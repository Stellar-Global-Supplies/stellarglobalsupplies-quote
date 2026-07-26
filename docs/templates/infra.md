---
title: "[Module/Service] Infrastructure"
description: "Terraform modules, deployment steps and environment configuration for [Module/Service]"
---

<!--
  TEMPLATE: Infrastructure Document
  ===================================
  Copy to docs/infra/<module-or-service>-infra.md
  e.g. docs/infra/ecs-cluster.md
       docs/infra/rds-setup.md
       docs/infra/networking.md
-->

## Overview

> What infrastructure does this document cover? Who manages it?

**Terraform module:** `modules/<module-name>`
**Managed by:** `@team-name`
**AWS Account:** `stellarglobalsupplies-production` (`123456789012`)
**Primary region:** `ap-south-1`
**Last reviewed:** `YYYY-MM-DD`

---

## Architecture

```
ap-south-1
├── VPC: stellar-production-vpc (10.0.0.0/16)
│   ├── Public subnets:  10.0.1.0/24, 10.0.2.0/24
│   └── Private subnets: 10.0.3.0/24, 10.0.4.0/24
│
├── [Resource 1]
│   ├── [Sub-component]
│   └── [Sub-component]
│
└── [Resource 2]
```

---

## Resources

| Resource | Terraform resource | ARN / ID | Notes |
|----------|--------------------|----------|-------|
| ECS Cluster | `aws_ecs_cluster.main` | `arn:aws:ecs:...` | Fargate only |
| RDS Instance | `aws_db_instance.primary` | `stellar-db-prod` | Multi-AZ |
| S3 Bucket | `aws_s3_bucket.assets` | `stellar-assets-prod` | Versioned |
| ALB | `aws_lb.main` | `stellar-alb-prod` | HTTPS only |

---

## Terraform module usage

```hcl
# Example: how to call this module from an environment
module "stellar_ecs_service" {
  source = "../../modules/ecs-service"

  service_name   = "orders-api"
  cluster_name   = "stellar-production"
  image_uri      = "123456789012.dkr.ecr.ap-south-1.amazonaws.com/stellar-orders:latest"
  cpu            = 512
  memory         = 1024
  desired_count  = 2

  environment_variables = {
    NODE_ENV    = "production"
    DB_HOST     = module.rds.endpoint
    REGION      = "ap-south-1"
  }

  secrets = {
    DB_PASSWORD = aws_secretsmanager_secret.db_password.arn
    API_KEY     = aws_secretsmanager_secret.api_key.arn
  }

  tags = local.common_tags
}
```

### Module inputs

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `service_name` | `string` | ✅ | — | ECS service name |
| `cluster_name` | `string` | ✅ | — | Target ECS cluster |
| `image_uri` | `string` | ✅ | — | Docker image URI |
| `cpu` | `number` | ❌ | `256` | vCPU units (256=0.25 vCPU) |
| `memory` | `number` | ❌ | `512` | Memory in MiB |
| `desired_count` | `number` | ❌ | `1` | Number of tasks |

### Module outputs

| Output | Description |
|--------|-------------|
| `service_arn` | ARN of the ECS service |
| `task_role_arn` | IAM role attached to tasks |
| `security_group_id` | Security group for the service |

---

## Environments

| Environment | AWS Account | Terraform workspace | Branch |
|------------|-------------|--------------------|----|
| `dev` | `stellar-dev` (`111111111111`) | `dev` | `develop` |
| `staging` | `stellar-staging` (`222222222222`) | `staging` | `staging` |
| `production` | `stellar-prod` (`333333333333`) | `production` | `main` |

### Environment-specific values

| Config | Dev | Staging | Production |
|--------|-----|---------|-----------|
| ECS desired count | 1 | 2 | 4–10 (autoscale) |
| RDS instance type | `db.t4g.micro` | `db.t4g.small` | `db.r7g.large` |
| Multi-AZ RDS | ❌ | ❌ | ✅ |
| Deletion protection | ❌ | ✅ | ✅ |

---

## Deployment

### Prerequisites

```bash
# Install tools
brew install terraform awscli

# Configure AWS credentials
aws configure --profile stellar-production
export AWS_PROFILE=stellar-production

# Verify
aws sts get-caller-identity
```

### First-time setup (bootstrap)

```bash
cd terraform/environments/production

# Initialise with remote state
terraform init \
  -backend-config="bucket=stellar-tfstate-prod" \
  -backend-config="key=production/terraform.tfstate" \
  -backend-config="region=ap-south-1"

terraform workspace select production
```

### Routine deploy

```bash
# Plan — always review before applying
terraform plan -var-file="production.tfvars" -out=tfplan

# Review the plan output carefully
# Check for any unexpected destroy actions

# Apply
terraform apply tfplan
```

### What deploys automatically (CI/CD)

The GitHub Action `.github/workflows/terraform.yml` runs on every merge to `main`:

1. `terraform fmt --check` — fails if formatting is wrong
2. `terraform validate` — syntax check
3. `terraform plan` — posts plan as PR comment
4. On merge: `terraform apply` — auto-applies to the target environment

---

## State management

| Item | Value |
|------|-------|
| Backend | S3 + DynamoDB lock |
| State bucket | `stellar-tfstate-prod` |
| Lock table | `stellar-tfstate-lock` |
| State key | `<env>/terraform.tfstate` |
| Encryption | SSE-S3 |

**Never edit state manually.** Use `terraform state mv` or `terraform import` if needed.

---

## IAM & Permissions

This infrastructure creates the following IAM roles:

| Role | Purpose | Trust |
|------|---------|-------|
| `stellar-ecs-task-role` | Permissions for running containers | `ecs-tasks.amazonaws.com` |
| `stellar-deploy-role` | Used by CI/CD to run terraform | GitHub OIDC |
| `stellar-rds-monitoring-role` | RDS Enhanced Monitoring | `monitoring.rds.amazonaws.com` |

Least-privilege principle applies. If a task needs a new permission, add it to
`modules/ecs-service/task-role-policy.json` and open a PR for review.

---

## Cost

| Resource | Monthly cost (production) |
|----------|--------------------------|
| ECS Fargate (2 tasks, 0.5vCPU/1GB) | ~$25 |
| RDS db.r7g.large Multi-AZ | ~$260 |
| ALB | ~$20 |
| S3 + data transfer | ~$10 |
| **Total estimate** | **~$315/month** |

Cost alerts are configured at $350/month in AWS Budgets.

---

## Runbooks

- [ECS service rollback](../runbooks/ecs-rollback.md)
- [RDS failover](../runbooks/rds-failover.md)
- [Terraform state recovery](../runbooks/terraform-state-recovery.md)

---

## Related

- [Architecture: Service Name](../architecture/service-name-architecture.md)
- [ADR: Why Fargate over EC2](../adr/adr-002-fargate-vs-ec2.md)
