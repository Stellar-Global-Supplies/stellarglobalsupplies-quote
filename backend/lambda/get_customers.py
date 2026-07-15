"""
Lambda: GET /api/customers?search=<query>
Reads from public.quote_customers (not the existing customers table).
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

    url = get_secret("supabase_url")
    key = get_secret("supabase_anon_key")

    params = event.get("queryStringParameters") or {}
    search = params.get("search", "").strip()

    query = f"select=*&order=company_name.asc&limit=20"
    if search:
        enc = urllib.parse.quote(search)
        query += f"&company_name=ilike.*{enc}*"

    endpoint = f"{url}/rest/v1/{TABLE}?{query}"
    req = urllib.request.Request(
        endpoint,
        method="GET",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
        },
    )

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
        return cors_response(200, data)
    except Exception as exc:
        logger.exception("Failed to query quote_customers")
        return cors_response(500, {"error": str(exc)})
