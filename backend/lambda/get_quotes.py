"""
Lambda: GET /api/quotes
Returns quotes joined with quote_customers (not the existing customers table).
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

    qp = event.get("queryStringParameters") or {}
    limit  = min(int(qp.get("limit", 50)), 100)
    offset = int(qp.get("offset", 0))
    search = qp.get("search", "").strip()

    # Join with quote_customers using the foreign key relationship
    params = (
        f"select=*,quote_customers(*)"
        f"&order=created_at.desc"
        f"&limit={limit}&offset={offset}"
    )
    if search:
        enc = urllib.parse.quote(search)
        params += f"&quote_number=ilike.*{enc}*"

    endpoint = f"{url}/rest/v1/quotes?{params}"
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
        logger.exception("Failed to get quotes")
        return cors_response(500, {"error": str(exc)})
