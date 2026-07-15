"""
Lambda: POST /api/quotes
1. Upserts the customer into quote_customers (by gst_number).
2. Saves the quote linked to that customer.
3. Auto-generates quote number if not supplied.

Frontend only needs to call POST /api/quotes — no separate customer save step.
"""

import json
import os
import boto3
import logging
import urllib.request
import urllib.parse
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
_cache: dict = {}


def get_secret(name: str) -> str:
    prefix = os.environ.get("SSM_PREFIX", "/sgs-quote")
    full = f"{prefix}/{name}"
    if full not in _cache:
        resp = ssm.get_parameter(Name=full, WithDecryption=True)
        _cache[full] = resp["Parameter"]["Value"]
    return _cache[full]


def supabase(method: str, table: str, data: dict | None = None, params: str = "") -> list:
    url = get_secret("supabase_url")
    key = get_secret("supabase_anon_key")
    endpoint = f"{url}/rest/v1/{table}" + (f"?{params}" if params else "")
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(
        endpoint, data=body, method=method,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation,resolution=merge-duplicates",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def upsert_customer(customer: dict) -> str:
    """Upsert into quote_customers, return the UUID."""
    record = {
        "company_name":   customer["company_name"].strip(),
        "gst_number":     customer["gst_number"].strip().upper(),
        "address":        customer.get("address", "").strip(),
        "city":           customer.get("city", "").strip(),
        "pin_code":       customer.get("pin_code", "").strip(),
        "state":          customer.get("state", "").strip(),
        "state_code":     str(customer.get("state_code", "")).strip(),
        "contact_person": customer.get("contact_person", "").strip(),
        "contact_number": customer.get("contact_number", "").strip(),
        "email":          customer.get("email", "").strip().lower(),
    }
    result = supabase("POST", "quote_customers", record, "on_conflict=gst_number")
    return result[0]["id"]


def get_next_quote_number() -> str:
    now = datetime.now()
    year_start = now.year if now.month >= 4 else now.year - 1
    fy = f"{str(year_start)[2:]}-{str(year_start + 1)[2:]}"
    results = supabase(
        "GET", "quotes",
        params=f"select=quote_number&quote_number=like.SGS%2F{fy}%2F*&order=created_at.desc&limit=1",
    )
    if results:
        try:
            last_seq = int(results[0]["quote_number"].split("/")[-1])
            return f"SGS/{fy}/{last_seq + 1}"
        except (ValueError, IndexError):
            pass
    return f"SGS/{fy}/1"


def cors_response(status: int, body) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "https://quote.stellarglobalsupplies.com",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body),
    }


def handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return cors_response(200, {"message": "OK"})

    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return cors_response(400, {"error": "Invalid JSON"})

    # Validate required fields
    customer = body.get("customer", {})
    if not customer.get("company_name"):
        return cors_response(400, {"error": "customer.company_name is required"})
    if not customer.get("gst_number"):
        return cors_response(400, {"error": "customer.gst_number is required"})
    if not body.get("items"):
        return cors_response(400, {"error": "items is required"})

    try:
        # Step 1 — upsert customer, get their UUID
        customer_id = upsert_customer(customer)

        # Step 2 — save the quote
        now = datetime.now()
        quote_number = body.get("quote_number") or get_next_quote_number()

        quote = {
            "quote_number": quote_number,
            "customer_id":  customer_id,
            "date":         body.get("date", now.strftime("%Y-%m-%d")),
            "expiry_date":  body.get("expiry_date"),
            "items":        json.dumps(body["items"]),
            "sub_total":    body.get("sub_total", 0),
            "igst_rate":    body.get("igst_rate", 0),
            "cgst_rate":    body.get("cgst_rate", 9),
            "sgst_rate":    body.get("sgst_rate", 9),
            "igst_amount":  body.get("igst_amount", 0),
            "cgst_amount":  body.get("cgst_amount", 0),
            "sgst_amount":  body.get("sgst_amount", 0),
            "grand_total":  body.get("grand_total", 0),
            "notes":        body.get("notes", ""),
            "status":       body.get("status", "draft"),
        }

        result = supabase("POST", "quotes", quote)
        saved = result[0] if result else quote

        return cors_response(200, {
            "success":     True,
            "quote":       saved,
            "customer_id": customer_id,
        })

    except Exception as exc:
        logger.exception("Failed to save quote")
        return cors_response(500, {"error": str(exc)})
