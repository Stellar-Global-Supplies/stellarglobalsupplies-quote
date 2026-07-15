"""
Lambda: POST /api/customers
Upserts a record into public.quote_customers (not the existing customers table).
"""

import json
import os
import boto3
import logging
import urllib.request
import urllib.parse

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
_cache = {}

TABLE = "quote_customers"


def get_secret(name: str) -> str:
    prefix = os.environ.get("SSM_PREFIX", "/sgs-quote")
    full = f"{prefix}/{name}"
    if full not in _cache:
        resp = ssm.get_parameter(Name=full, WithDecryption=True)
        _cache[full] = resp["Parameter"]["Value"]
    return _cache[full]


def supabase_upsert(data: dict) -> dict:
    url = get_secret("supabase_url")
    key = get_secret("supabase_anon_key")

    endpoint = f"{url}/rest/v1/{TABLE}?on_conflict=gst_number"
    body = json.dumps(data).encode()

    req = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation,resolution=merge-duplicates",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def cors_response(status: int, body: dict) -> dict:
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

    required = ["company_name", "gst_number", "address", "state", "state_code"]
    for f in required:
        if not body.get(f):
            return cors_response(400, {"error": f"Missing field: {f}"})

    record = {
        "company_name":    body["company_name"].strip(),
        "gst_number":      body["gst_number"].strip().upper(),
        "address":         body["address"].strip(),
        "city":            body.get("city", "").strip(),
        "pin_code":        body.get("pin_code", "").strip(),
        "state":           body["state"].strip(),
        "state_code":      str(body["state_code"]).strip(),
        "contact_person":  body.get("contact_person", "").strip(),
        "contact_number":  body.get("contact_number", "").strip(),
        "email":           body.get("email", "").strip().lower(),
    }

    try:
        result = supabase_upsert(record)
        return cors_response(200, {
            "success": True,
            "customer": result[0] if result else record,
        })
    except Exception as exc:
        logger.exception("Failed to save quote_customer")
        return cors_response(500, {"error": str(exc)})
