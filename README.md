# SGS Quote Generator — quote.stellarglobalsupplies.com

Internal quotation tool for Stellar Global Supplies. Generates pixel-perfect PDF quotations matching the company template, with Gmail and WhatsApp sharing.

## Architecture

```
quote.stellarglobalsupplies.com
    └─ CloudFront → S3 (React SPA)
         └─ calls →
api-quote.stellarglobalsupplies.com
    └─ API Gateway HTTP API
         ├─ POST /api/email/send      → Lambda (Gmail OAuth2)
         ├─ POST /api/customers       → Lambda → Supabase
         ├─ GET  /api/customers       → Lambda → Supabase
         ├─ POST /api/quotes          → Lambda → Supabase
         └─ GET  /api/quotes          → Lambda → Supabase

Auth: Supabase Auth (email/password, no self-registration)
Secrets: AWS SSM Parameter Store (SecureString)
State: Terraform remote state in S3
```

## Prerequisites

- AWS CLI configured (`aws configure`)
- Terraform ≥ 1.5
- Node.js ≥ 20
- Python 3.12
- A Supabase project
- Google OAuth2 credentials with Gmail API enabled + refresh token

---

## Step 1 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) → your project → **SQL Editor**
2. Paste and run `infrastructure/supabase_schema.sql`
3. Go to **Authentication → Users** and manually create user accounts for your team (no self-signup page)
4. Note your **Project URL** and **anon/public key** from Settings → API

---

## Step 2 — Google OAuth2 Refresh Token

You mentioned you already have the client ID, secret, and refresh token. Just make sure the refresh token has `https://www.googleapis.com/auth/gmail.send` scope.

If you need to regenerate it:
```bash
# Using Google OAuth2 Playground:
# 1. Go to https://developers.google.com/oauthplayground
# 2. Settings → Use your own OAuth2 credentials → enter client ID + secret
# 3. Scope: https://www.googleapis.com/auth/gmail.send
# 4. Authorize → Exchange code for tokens → copy refresh_token
```

---

## Step 3 — AWS Infrastructure (First Deploy)

```bash
# Create Terraform state bucket first (one-time)
aws s3 mb s3://sgs-terraform-state --region ap-south-1
aws s3api put-bucket-versioning \
  --bucket sgs-terraform-state \
  --versioning-configuration Status=Enabled

# Copy and fill in your values
cp infrastructure/terraform/terraform.tfvars.example \
   infrastructure/terraform/terraform.tfvars
# Edit terraform.tfvars with your real values

cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

After apply, note the outputs:
- `app_url` → https://quote.stellarglobalsupplies.com
- `api_endpoint` → https://api-quote.stellarglobalsupplies.com
- `frontend_bucket_name` → used by CI/CD
- `cloudfront_distribution_id` → used by CI/CD

---

## Step 4 — Local Frontend Development

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with your Supabase URL, anon key, and API URL

npm install
npm run dev
# Opens at http://localhost:5173
```

---

## Step 5 — GitHub Actions CI/CD

Add these **Repository Secrets** (Settings → Secrets → Actions):

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | IAM role ARN with OIDC trust for GitHub Actions |
| `ROUTE53_ZONE_ID` | Your hosted zone ID |
| `CERTIFICATE_ARN` | ACM cert ARN for *.stellarglobalsupplies.com |
| `SUPABASE_URL` | https://xxx.supabase.co |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `GMAIL_CLIENT_ID` | Google OAuth2 client ID |
| `GMAIL_CLIENT_SECRET` | Google OAuth2 client secret |
| `GMAIL_REFRESH_TOKEN` | Google OAuth2 refresh token |

Copy the workflow file to the right place in your repo:
```bash
mkdir -p .github/workflows
cp infrastructure/github-actions/deploy.yml .github/workflows/deploy.yml
```

Push to `main` → triggers full deploy automatically.

---

## Manual Frontend Deploy (without GHA)

```bash
cd frontend
npm run build

# Replace with actual values from terraform output
BUCKET=$(cd ../infrastructure/terraform && terraform output -raw frontend_bucket_name)
CF_ID=$(cd ../infrastructure/terraform && terraform output -raw cloudfront_distribution_id)

aws s3 sync dist/ s3://$BUCKET --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html"

aws s3 cp dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache,no-store,must-revalidate"

aws cloudfront create-invalidation --distribution-id $CF_ID --paths "/*"
```

---

## Project Structure

```
quote-app/
├── frontend/                    # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx       # Sidebar navigation
│   │   │   ├── CustomerForm.tsx # Customer with autocomplete/reuse
│   │   │   ├── ItemsTable.tsx   # Line items with live totals
│   │   │   ├── ShareModal.tsx   # WhatsApp + Gmail share UI
│   │   │   └── ProtectedRoute.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── QuoteEditor.tsx  # New + Edit quote form
│   │   │   ├── QuotesList.tsx
│   │   │   └── CustomersList.tsx
│   │   ├── utils/
│   │   │   └── generatePDF.ts   # jsPDF — exact template match
│   │   ├── lib/
│   │   │   ├── supabase.ts      # Supabase client + types
│   │   │   └── api.ts           # Lambda API calls
│   │   └── hooks/
│   │       └── useAuth.tsx      # Supabase auth context
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   └── lambda/
│       ├── send_email.py        # Gmail OAuth2 sender
│       ├── save_customer.py     # Upsert customer → Supabase
│       ├── get_customers.py     # List/search customers
│       ├── save_quote.py        # Save quote + auto quote number
│       └── get_quotes.py        # List quotes with customer join
│
└── infrastructure/
    ├── terraform/
    │   ├── main.tf              # Provider + backend config
    │   ├── variables.tf
    │   ├── frontend.tf          # S3 + CloudFront + Route53
    │   ├── backend.tf           # Lambda + API Gateway + IAM + SSM
    │   └── outputs.tf
    ├── github-actions/
    │   └── deploy.yml           # Full CI/CD pipeline
    └── supabase_schema.sql      # DB schema + RLS policies
```

---

## Key Features

- **Exact PDF match** — jsPDF renders the same layout as the CEO's template (two-column header, item table, bank details, signature boxes, amount in words)
- **Customer reuse** — type a company name in the search box to instantly load all their details
- **Auto quote numbering** — format `SGS/25-26/N`, auto-incremented per financial year
- **Live totals** — sub-total, IGST/CGST/SGST calculated as you type
- **WhatsApp share** — downloads PDF + opens WhatsApp with pre-filled message and customer's phone number
- **Gmail share** — sends PDF as attachment via your existing OAuth2 credentials, with branded HTML email body
- **Supabase Auth** — email/password login, no registration page (CEO creates accounts manually)
- **Fully serverless** — no EC2, no containers

## Notes

- The ACM certificate must be in **us-east-1** even though your infra is in ap-south-1 — CloudFront requirement. Your existing `*.stellarglobalsupplies.com` cert should already be there.
- Lambda functions pull secrets from SSM at cold-start and cache them in memory — no credentials in environment variables or code.
- WhatsApp Web doesn't support direct file attachment via URL — the flow downloads the PDF first, then opens WhatsApp with a pre-written message. The user attaches the file manually (one tap in WhatsApp).