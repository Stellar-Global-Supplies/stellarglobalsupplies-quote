---
title: "SGS Quote App API Reference"
description: "Endpoint documentation, authentication and request/response examples for the SGS Quote Application"
author: "Prasad Bhavsar"
---

## Overview

The SGS Quote App API provides REST endpoints for managing quotes, customers, SKU search, and email dispatch. It is consumed by the React frontend and authenticated via Cognito JWT tokens.

**Base URL (production):** `https://api.quote.stellarglobalsupplies.com`
**Auth method:** Bearer token (JWT from Cognito)
**Owner:** `@team-sgs-quote`
**Author:** `Prasad Bhavsar`
**Last updated:** `2025-07-26`

---

## Authentication

All requests require a valid JWT in the `Authorization` header:

```bash 
curl -H "Authorization: Bearer <your-token>" \
     https://api.quote.stellarglobalsupplies.com/api/quotes
```

Tokens are issued by Cognito User Pool. The frontend handles the OAuth flow automatically.

### Token Details

| Property | Value |
|----------|-------|
| Token Type | JWT (JSON Web Token) |
| Issuer | Cognito User Pool (`cognito-idp.us-east-1.amazonaws.com/<pool-id>`) |
| Expiry | 1 hour (access token), 30 days (refresh token) |
| Header | `Authorization: Bearer <token>` |

---

## Errors

All errors follow this shape:

```json
{
  "error": "Human-readable description of the error"
}
```

| HTTP Status | Meaning |
|-------------|---------|
| `400` | Invalid request — missing or malformed fields |
| `401` | Missing or invalid JWT token |
| `403` | Valid token but insufficient permissions |
| `404` | Resource not found |
| `405` | HTTP method not allowed for this endpoint |
| `500` | Server error — Lambda or Supabase failure |

---

## Endpoints

---

### `GET /api/quotes`

List all quotes with optional search. Includes the associated customer data.

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | ❌ | Search by quote number (ilike match) |
| `limit` | integer | ❌ | Items per page, default `50`, max `100` |
| `offset` | integer | ❌ | Pagination offset, default `0` |

**Request:**

```bash
curl -X GET "https://api.quote.stellarglobalsupplies.com/api/quotes?limit=20&offset=0" \
  -H "Authorization: Bearer <token>"
```

**Response `200`:**

```json
[
  {
    "id": "uuid",
    "quote_number": "SGS/25-26/42",
    "customer_id": "uuid",
    "date": "2025-07-26",
    "expiry_date": "2025-08-25",
    "items": [
      {
        "sku": "MS-001",
        "description": "Mild Steel Plate 6mm",
        "quantity": 10,
        "unit": "pcs",
        "rate": 1500.00
      }
    ],
    "sub_total": 15000.00,
    "igst_rate": 0,
    "cgst_rate": 9,
    "sgst_rate": 9,
    "igst_amount": 0,
    "cgst_amount": 1350.00,
    "sgst_amount": 1350.00,
    "grand_total": 17700.00,
    "notes": "Delivery within 7 working days",
    "status": "draft",
    "created_at": "2025-07-26T10:30:00Z",
    "updated_at": "2025-07-26T10:30:00Z",
    "quote_customers": {
      "id": "uuid",
      "company_name": "Acme Corp",
      "gst_number": "27AABCU1234D1Z1",
      "address": "123 Industrial Area",
      "city": "Mumbai",
      "pin_code": "400001",
      "state": "Maharashtra",
      "state_code": "27",
      "contact_person": "John Doe",
      "contact_number": "+91-9876543210",
      "email": "john@acme.com"
    }
  }
]
```

**Possible status values:** `draft`, `sent`, `accepted`, `rejected`

---

### `POST /api/quotes`

Create a new quote or update an existing one. If `quote_number` is provided, it updates that quote. If blank, a new quote number is auto-assigned.

**Required scope:** Authenticated user

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customer` | object | ✅ | Customer details (see below) |
| `items` | array | ✅ | Array of line items |
| `quote_number` | string | ❌ | Existing quote number for edits; blank for new quotes |
| `date` | string | ❌ | Quote date, default today (`YYYY-MM-DD`) |
| `expiry_date` | string | ❌ | Quote expiry date |
| `sub_total` | number | ❌ | Sum of item totals, default `0` |
| `igst_rate` | number | ❌ | IGST tax rate, default `0` |
| `cgst_rate` | number | ❌ | CGST tax rate, default `9` |
| `sgst_rate` | number | ❌ | SGST tax rate, default `9` |
| `igst_amount` | number | ❌ | IGST tax amount, default `0` |
| `cgst_amount` | number | ❌ | CGST tax amount, default `0` |
| `sgst_amount` | number | ❌ | SGST tax amount, default `0` |
| `grand_total` | number | ❌ | Total including tax, default `0` |
| `notes` | string | ❌ | Additional notes |
| `status` | string | ❌ | One of: `draft`, `sent`, `accepted`, `rejected`. Default `draft` |

**Customer object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name` | string | ✅ | Customer company name |
| `gst_number` | string | ❌ | GST number (used for deduplication) |
| `address` | string | ❌ | Street address |
| `city` | string | ❌ | City |
| `pin_code` | string | ❌ | PIN code |
| `state` | string | ❌ | State name |
| `state_code` | string | ❌ | State code (2-digit) |
| `contact_person` | string | ❌ | Contact person name |
| `contact_number` | string | ❌ | Contact phone number |
| `email` | string | ❌ | Email address |

**Item object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sku` | string | ✅ | Product SKU code |
| `description` | string | ✅ | Item description |
| `quantity` | number | ✅ | Quantity |
| `unit` | string | ✅ | Unit of measure (pcs, kg, m, etc.) |
| `rate` | number | ✅ | Unit rate |

**Request:**

```bash
curl -X POST "https://api.quote.stellarglobalsupplies.com/api/quotes" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {
      "company_name": "Acme Corp",
      "gst_number": "27AABCU1234D1Z1",
      "address": "123 Industrial Area",
      "city": "Mumbai",
      "state": "Maharashtra",
      "state_code": "27"
    },
    "items": [
      {
        "sku": "MS-001",
        "description": "Mild Steel Plate 6mm",
        "quantity": 10,
        "unit": "pcs",
        "rate": 1500.00
      }
    ],
    "sub_total": 15000.00,
    "cgst_rate": 9,
    "sgst_rate": 9,
    "cgst_amount": 1350.00,
    "sgst_amount": 1350.00,
    "grand_total": 17700.00
  }'
```

**Response `200`:**

```json
{
  "success": true,
  "quote": {
    "id": "uuid",
    "quote_number": "SGS/25-26/42",
    "customer_id": "uuid",
    "date": "2025-07-26",
    "items": "[{\"sku\":\"MS-001\",...}]",
    "sub_total": 15000.00,
    "grand_total": 17700.00,
    "status": "draft"
  },
  "customer_id": "uuid"
}
```

---

### `GET /api/quotes/{id}`

Not implemented as a separate endpoint. Quote details are fetched via the list endpoint with search/filter.

---

### `PATCH /api/quotes/{id}`

Update the status of an existing quote.

**Required scope:** Authenticated user

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Quote UUID |

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | ✅ | One of: `draft`, `sent`, `accepted`, `rejected` |

**Request:**

```bash
curl -X PATCH "https://api.quote.stellarglobalsupplies.com/api/quotes/<uuid>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "sent"}'
```

**Response `200`:**

```json
{
  "success": true,
  "quote": {
    "id": "uuid",
    "quote_number": "SGS/25-26/42",
    "status": "sent"
  }
}
```

---

### `DELETE /api/quotes/{id}`

Permanently delete a quote. This cannot be undone.

**Required scope:** Authenticated user

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Quote UUID |

**Request:**

```bash
curl -X DELETE "https://api.quote.stellarglobalsupplies.com/api/quotes/<uuid>" \
  -H "Authorization: Bearer <token>"
```

**Response `200`:**

```json
{
  "success": true
}
```

---

### `GET /api/customers`

List customers with optional search by company name.

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | ❌ | Search by company name (ilike match) |

**Request:**

```bash
curl -X GET "https://api.quote.stellarglobalsupplies.com/api/customers?search=Acme" \
  -H "Authorization: Bearer <token>"
```

**Response `200`:**

```json
[
  {
    "id": "uuid",
    "company_name": "Acme Corp",
    "gst_number": "27AABCU1234D1Z1",
    "address": "123 Industrial Area",
    "city": "Mumbai",
    "pin_code": "400001",
    "state": "Maharashtra",
    "state_code": "27",
    "contact_person": "John Doe",
    "contact_number": "+91-9876543210",
    "email": "john@acme.com",
    "created_at": "2025-07-26T10:30:00Z",
    "updated_at": "2025-07-26T10:30:00Z"
  }
]
```

---

### `POST /api/customers`

Create a new customer or update an existing one (upsert by GST number). Used by the import page.

**Required scope:** Authenticated user

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name` | string | ✅ | Customer company name |
| `gst_number` | string | ✅ | GST number (unique key for upsert) |
| `address` | string | ✅ | Street address |
| `city` | string | ❌ | City |
| `pin_code` | string | ❌ | PIN code |
| `state` | string | ✅ | State name |
| `state_code` | string | ✅ | State code (2-digit) |
| `contact_person` | string | ❌ | Contact person name |
| `contact_number` | string | ❌ | Contact phone number |
| `email` | string | ❌ | Email address |

**Request:**

```bash
curl -X POST "https://api.quote.stellarglobalsupplies.com/api/customers" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Acme Corp",
    "gst_number": "27AABCU1234D1Z1",
    "address": "123 Industrial Area",
    "state": "Maharashtra",
    "state_code": "27"
  }'
```

**Response `200`:**

```json
{
  "success": true,
  "customer": {
    "id": "uuid",
    "company_name": "Acme Corp",
    "gst_number": "27AABCU1234D1Z1",
    "address": "123 Industrial Area",
    "state": "Maharashtra",
    "state_code": "27"
  }
}
```

---

### `GET /api/skus`

Search for SKUs/products by SKU code.

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | ❌ | Search by SKU code (ilike match) |

**Request:**

```bash
curl -X GET "https://api.quote.stellarglobalsupplies.com/api/skus?search=MS" \
  -H "Authorization: Bearer <token>"
```

**Response `200`:**

```json
[
  {
    "sku": "MS-001",
    "material_type": "Mild Steel Plate 6mm",
    "hsn_sac": "7208"
  },
  {
    "sku": "MS-002",
    "material_type": "Mild Steel Plate 10mm",
    "hsn_sac": "7208"
  }
]
```

---

### `POST /api/email/send`

Send a quote as a PDF attachment via email. Uses Gmail API with OAuth2.

**Required scope:** Authenticated user

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | string | ✅ | Recipient email address |
| `cc` | array | ❌ | CC email addresses |
| `subject` | string | ✅ | Email subject line |
| `bodyHtml` | string | ✅ | HTML email body |
| `pdfBase64` | string | ✅ | PDF file as base64-encoded string |
| `filename` | string | ✅ | PDF filename (e.g. `SGS-25-26-42.pdf`) |

**Request:**

```bash
curl -X POST "https://api.quote.stellarglobalsupplies.com/api/email/send" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "john@acme.com",
    "cc": ["accounts@acme.com"],
    "subject": "Quotation SGS/25-26/42 from Stellar Global Supplies",
    "bodyHtml": "<p>Dear Sir,</p><p>Please find attached our quotation.</p>",
    "pdfBase64": "JVBERi0xLjcN... (base64 encoded PDF)",
    "filename": "SGS-25-26-42.pdf"
  }'
```

**Response `200`:**

```json
{
  "success": true,
  "messageId": "123abc"
}
```

---

## Rate Limiting

API Gateway is configured with the following rate limits:

| Limit | Value |
|-------|-------|
| Burst | 100 requests/second |
| Rate | 50 requests/second |

When exceeded, the API returns `429 Too Many Requests`.

---

## API Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-07-26 | Initial API documentation | Prasad Bhavsar |

---

## Related

- [Architecture: SGS Quote App](../architecture/sgs-quote-app-architecture.md)
- [Runbook: High Error Rate](../runbooks/sgs-quote-app-high-error-rate.md)
- [Infra: SGS Quote App Infrastructure](../infra/sgs-quote-app-infra.md)
- [OTLP Lambda Tracing Guide](../architecture/otlp-lambda-tracing.md)