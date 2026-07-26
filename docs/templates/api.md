---
title: "[Service] API Reference"
description: "Endpoint documentation, authentication and request/response examples for [Service]"
---

<!--
  TEMPLATE: API Documentation
  ============================
  Copy to docs/api/<service-name>-api.md
  e.g. docs/api/orders-api.md
       docs/api/payments-api.md
-->

## Overview

> What does this API do? Who consumes it?

**Base URL (production):** `https://api.stellarglobalsupplies.com/v1`
**Base URL (staging):** `https://api-staging.stellarglobalsupplies.com/v1`
**Auth method:** Bearer token (JWT)
**Owner:** `@team-name`
**Last updated:** `YYYY-MM-DD`

---

## Authentication

All requests require a valid JWT in the `Authorization` header:

```bash
curl -H "Authorization: Bearer <your-token>" \
     https://api.stellarglobalsupplies.com/v1/...
```

Tokens are issued by Auth0. See [Auth Guide] for how to obtain one.

**Token scopes:**

| Scope | Access |
|-------|--------|
| `read:orders` | Read order data |
| `write:orders` | Create and update orders |
| `admin:orders` | Delete and manage all orders |

---

## Errors

All errors follow this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": {}
  }
}
```

| HTTP Status | Code | Meaning |
|-------------|------|---------|
| `400` | `VALIDATION_ERROR` | Request body failed validation |
| `401` | `UNAUTHORIZED` | Missing or invalid token |
| `403` | `FORBIDDEN` | Valid token but insufficient scope |
| `404` | `NOT_FOUND` | Resource does not exist |
| `429` | `RATE_LIMITED` | Slow down — see rate limits |
| `500` | `INTERNAL_ERROR` | Server error — page on-call |

---

## Rate limits

| Tier | Limit |
|------|-------|
| Default | 60 req/min |
| Premium | 600 req/min |

Response headers on every request:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 54
X-RateLimit-Reset: 1720000000
```

---

## Endpoints

---

### `GET /[resource]`

List all [resources] the caller has access to.

**Required scope:** `read:[resource]`

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | ❌ | Page number, default `1` |
| `limit` | integer | ❌ | Items per page, default `20`, max `100` |
| `status` | string | ❌ | Filter by status: `active`, `inactive` |

**Request:**

```bash
curl -X GET "https://api.stellarglobalsupplies.com/v1/[resource]?page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

**Response `200`:**

```json
{
  "data": [
    {
      "id": "res_01HXXXXX",
      "name": "Example resource",
      "status": "active",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "pages": 8
  }
}
```

---

### `POST /[resource]`

Create a new [resource].

**Required scope:** `write:[resource]`

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Display name, max 255 chars |
| `type` | string | ✅ | One of: `typeA`, `typeB` |
| `metadata` | object | ❌ | Arbitrary key-value pairs |

**Request:**

```bash
curl -X POST "https://api.stellarglobalsupplies.com/v1/[resource]" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New resource",
    "type": "typeA",
    "metadata": {
      "region": "ap-south-1"
    }
  }'
```

**Response `201`:**

```json
{
  "data": {
    "id": "res_01HXXXXX",
    "name": "New resource",
    "type": "typeA",
    "status": "active",
    "metadata": {
      "region": "ap-south-1"
    },
    "created_at": "2025-07-26T10:30:00Z",
    "updated_at": "2025-07-26T10:30:00Z"
  }
}
```

---

### `GET /[resource]/:id`

Fetch a single [resource] by ID.

**Required scope:** `read:[resource]`

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Resource ID, prefix `res_` |

**Request:**

```bash
curl -X GET "https://api.stellarglobalsupplies.com/v1/[resource]/res_01HXXXXX" \
  -H "Authorization: Bearer <token>"
```

**Response `200`:** Same shape as the object in the list response above.

**Response `404`:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource res_01HXXXXX not found"
  }
}
```

---

### `PATCH /[resource]/:id`

Update fields on an existing [resource]. Only send fields you want to change.

**Required scope:** `write:[resource]`

**Request:**

```bash
curl -X PATCH "https://api.stellarglobalsupplies.com/v1/[resource]/res_01HXXXXX" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated name"}'
```

**Response `200`:** Full updated object.

---

### `DELETE /[resource]/:id`

Permanently delete a [resource]. This cannot be undone.

**Required scope:** `admin:[resource]`

**Request:**

```bash
curl -X DELETE "https://api.stellarglobalsupplies.com/v1/[resource]/res_01HXXXXX" \
  -H "Authorization: Bearer <token>"
```

**Response `204`:** Empty body.

---

## Webhooks

[Service] emits webhooks for the following events:

| Event | Trigger |
|-------|---------|
| `resource.created` | A new resource is created |
| `resource.updated` | Any field on a resource changes |
| `resource.deleted` | A resource is deleted |

**Webhook payload:**

```json
{
  "event": "resource.created",
  "timestamp": "2025-07-26T10:30:00Z",
  "data": {
    "id": "res_01HXXXXX"
  }
}
```

Webhooks are signed with HMAC-SHA256. Verify the `X-Stellar-Signature` header
before processing. See [Webhook Verification Guide].

---

## SDKs

| Language | Package | Status |
|----------|---------|--------|
| Node.js | `@stellar/api-client` | ✅ Maintained |
| Python | `stellar-api-python` | ✅ Maintained |
| Go | `stellar-api-go` | 🚧 In progress |

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| `v1.2` | 2025-06-01 | Added `metadata` field to all resources |
| `v1.1` | 2025-03-15 | Added webhook support |
| `v1.0` | 2025-01-01 | Initial release |

---

## Related

- [Architecture: Service Name](../architecture/service-name-architecture.md)
- [Runbook: API incidents](../runbooks/api-incident.md)
