---
title: "SGS Quote App Infrastructure"
description: "Terraform modules, deployment steps and environment configuration for the SGS Quote Application"
---

## Overview

This document covers the AWS infrastructure powering the SGS Quote App — a serverless web application using Lambda, API Gateway, S3, CloudFront, and Cognito. All infrastructure is managed via Terraform.

**Terraform module:** `infrastructure/terraform/`
**Managed by:** `@team-sgs-quote`
**AWS Account:** `stellarglobalsupplies-production`
**Primary region:** `us-east-1`
**Last reviewed:** `2025-07-26`

---

## Architecture 

```
us-east-1
├── VPC: default VPC
│
├── S3: sgs-quote-frontend (static website hosting)
│   └── CloudFront: quote.stellarglobalsupplies.com
│
├── API Gateway HTTP API: sgs-quote-api
│   └── JWT Authorizer (Cognito)
│
├── Lambda Functions (×7):
│   ├── save_quote (256MB, 30s)
│   ├── get_quotes (256MB, 30s)
│   ├── delete_quote (128MB, 10s)
│   ├── save_customer (128MB, 10s)
│   ├── get_customers (128MB, 10s)
│   ├── get_skus (128MB, 10s)
│   └── send_email (512MB, 60s)
│
├── Cognito User Pool: sgs-quote-users
│
├── SSM Parameter Store: /sgs-quote/*
│
└── ACM Certificate: *.stellarglobalsupplies.com
```

---

## Resources

| Resource | Terraform resource | ARN / ID | Notes |
|----------|--------------------|----------|-------|
| Frontend S3 Bucket | `aws_s3_bucket.frontend` | `sgs-quote-frontend` | Static website, versioned |
| CloudFront Distribution | `aws_cloudfront_distribution.cdn` | `E...` | Custom domain, HTTPS only |
| API Gateway | `aws_apigatewayv2_api.main` | `sgs-quote-api` | HTTP API, JWT auth |
| Cognito User Pool | `aws_cognito_user_pool.main` | `sgs-quote-users` | Email auth, MFA optional |
| Lambda Functions | `aws_lambda_function.*` | `sgs-quote-app-*` | Python 3.12, 7 functions |
| SSM Parameters | `aws_ssm_parameter.*` | `/sgs-quote/*` | SecureString for secrets |
| ACM Certificate | `aws_acm_certificate.cert` | `arn:aws:acm:...` | `us-east-1` for CloudFront |

---

## Terraform module usage

```hcl
# Example: how to deploy the SGS Quote App infrastructure
module "sgs_quote_app" {
  source = "../../infrastructure/terraform"

  environment = "production"
  aws_region  = "us-east-1"
  domain_name = "quote.stellarglobalsupplies.com"

  # Cognito
  cognito_callback_urls = ["https://quote.stellarglobalsupplies.com"]
  cognito_logout_urls   = ["https://quote.stellarglobalsupplies.com"]

  # Supabase (stored in SSM)
  supabase_url             = "https://xxxxx.supabase.co"
  supabase_service_role_key = "eyJ... (service role key)"

  # New Relic
  new_relic_license_key = "xxxxx (40-char hex)"

  # SES
  ses_verified_sender = "quotes@stellarglobalsupplies.com"
}
```

### Module inputs

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `environment` | `string` | ✅ | — | Deployment environment (`dev`, `staging`, `production`) |
| `aws_region` | `string` | ❌ | `us-east-1` | AWS region |
| `domain_name` | `string` | ✅ | — | Custom domain for the app |
| `cognito_callback_urls` | `list(string)` | ✅ | — | OAuth callback URLs |
| `cognito_logout_urls` | `list(string)` | ✅ | — | OAuth logout URLs |
| `supabase_url` | `string` | ✅ | — | Supabase project URL |
| `supabase_service_role_key` | `string` | ✅ | — | Supabase service role key |
| `new_relic_license_key` | `string` | ✅ | — | New Relic license key |
| `ses_verified_sender` | `string` | ✅ | — | SES verified email address |

### Module outputs

| Output | Description |
|--------|-------------|
| `cloudfront_domain` | CloudFront distribution domain name |
| `api_gateway_url` | API Gateway endpoint URL |
| `cognito_user_pool_id` | Cognito User Pool ID |
| `cognito_client_id` | Cognito App Client ID |
| `lambda_function_arns` | Map of Lambda function ARNs |

---

## Environments

| Environment | AWS Account | Terraform workspace | Branch |
|------------|-------------|--------------------|--------|
| `production` | `stellarglobalsupplies-production` | `production` | `main` |

> Currently only a production environment exists. Dev/staging can be added as needed.

### Environment-specific values

| Config | Production |
|--------|-----------|
| Lambda memory | 128MB–512MB (per function) |
| Lambda timeout | 10s–60s (per function) |
| CloudFront price class | PriceClass_100 (US, Europe) |
| Deletion protection | ✅ |
| Log retention | 14 days |

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
cd infrastructure/terraform

# Initialise with remote state
terraform init \
  -backend-config="bucket=stellarglobalsupplies-backend-config" \
  -backend-config="key=stellar-global-quote/terraform.tfstate" \
  -backend-config="region=us-east-1"

terraform workspace select production || terraform workspace new production
```

### Routine deploy

```bash
cd infrastructure/terraform

# Plan — always review before applying
terraform plan -var-file="production.tfvars" -out=tfplan

# Review the plan output carefully
# Check for any unexpected destroy actions

# Apply
terraform apply tfplan
```

### What deploys automatically (CI/CD)

The GitHub Action `.github/workflows/deploy.yml` runs on every merge to `main`:

1. Install Python dependencies for Lambda
2. Build frontend (npm install + npm run build)
3. Sync frontend to S3 + invalidate CloudFront
4. Zip Lambda code with dependencies
5. Terraform apply — updates Lambda functions and infrastructure

---

## State management

| Item | Value |
|------|-------|
| Backend | S3 + DynamoDB lock |
| State bucket | `stellarglobalsupplies-backend-config` |
| Lock table | `stellarglobalsupplies-backend-db-config` |
| State key | `stellar-global-quote/terraform.tfstate` |
| Encryption | SSE-S3 |

**Never edit state manually.** Use `terraform state mv` or `terraform import` if needed.

---

## IAM & Permissions

This infrastructure creates the following IAM roles:

| Role | Purpose | Trust |
|------|---------|-------|
| `sgs-quote-lambda-role` | Permissions for Lambda execution | `lambda.amazonaws.com` |
| `sgs-quote-deploy-role` | Used by CI/CD to run terraform | GitHub OIDC |

Lambda execution role includes:
- `ssm:GetParameter` on `/sgs-quote/*`
- `ses:SendEmail` and `ses:SendRawEmail`
- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`
- `kms:Decrypt` for SSM KMS key

---

## Cost

| Resource | Monthly cost (production) |
|----------|--------------------------|
| Lambda (7 functions, ~10K invocations/month) | ~$1 |
| API Gateway HTTP API | ~$3 |
| S3 + CloudFront | ~$5 |
| Cognito User Pool | ~$0 (free tier) |
| SSM Parameter Store | ~$1 |
| **Total estimate** | **~$10/month** |

Cost alerts are configured at $25/month in AWS Budgets.

---

## Related

- [Architecture: SGS Quote App](../architecture/sgs-quote-app-architecture.md)
- [Runbook: High Error Rate](../runbooks/sgs-quote-app-high-error-rate.md)
- [API: SGS Quote App API Reference](../api/sgs-quote-app-api.md)
- [ADR-002: Why we chose Lambda over ECS Fargate](../adr/adr-002-lambda-vs-ecs-fargate.md)