"""
Shared Supabase client for all Lambda functions.
Uses the SERVICE ROLE key — bypasses RLS safely since Lambda is
a trusted server-side environment secured by API Gateway.
Never expose the service role key to the browser/frontend.
"""

import json
import os
import boto3
import urllib.request
import urllib.parse
import logging

logger = logging.getLogger()

ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
_cache: dict = {}


def _get_secret(name: str) -> str:
    prefix = os.environ.get("SSM_PREFIX", "/sgs-quote")
    full = f"{prefix}/{name}"
    if full not in _cache:
        resp = ssm.get_parameter(Name=full, WithDecryption=True)
        _cache[full] = resp["Parameter"]["Value"]
    return _cache[full]


def _headers() -> dict:
    """
    Always use service_role key for Lambda → Supabase calls.
    The apikey header identifies the project; the Authorization
    Bearer with the service role key bypasses RLS.
    """
    service_key = _get_secret("supabase_service_role_key")
    return {
        "apikey":        service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type":  "application/json",
        "Prefer":        "return=representation,resolution=merge-duplicates",
    }


def supabase_url() -> str:
    return _get_secret("supabase_url")


def db_request(
    method: str,
    table: str,
    data: dict | None = None,
    params: str = "",
    prefer: str | None = None,
) -> list:
    """
    Make a Supabase REST API call.
    method: GET | POST | PATCH | DELETE
    table:  table or view name
    data:   request body (for POST/PATCH)
    params: query string (without leading ?)
    prefer: override Prefer header if needed
    """
    url = supabase_url()
    endpoint = f"{url}/rest/v1/{table}"
    if params:
        endpoint += f"?{params}"

    headers = _headers()
    if prefer:
        headers["Prefer"] = prefer

    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(endpoint, data=body, method=method, headers=headers)

    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        logger.error("Supabase %s %s → %s %s", method, endpoint, e.code, body_text)
        raise RuntimeError(f"Supabase error {e.code}: {body_text}") from e


def cors_headers() -> dict:
    return {
        "Content-Type":                "application/json",
        "Access-Control-Allow-Origin": "https://quote.stellarglobalsupplies.com",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    }


def cors_response(status: int, body) -> dict:
    return {
        "statusCode": status,
        "headers":    cors_headers(),
        "body":       json.dumps(body),
    }


def is_preflight(event: dict) -> bool:
    return event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS"
