"""
Shared Supabase client for all Lambda functions.
Uses the SERVICE ROLE key — bypasses RLS safely since Lambda is
a trusted server-side environment secured by API Gateway.
Never expose the service role key to the browser/frontend.

Tracing: every ``db_request()`` call creates a child CLIENT span under
the active SERVER (Lambda) span so that Supabase latency is visible in
New Relic APM distributed traces.
"""

import json
import os
import logging
from urllib.parse import urlparse

import boto3
import urllib.request
import urllib.parse

from opentelemetry import trace
from opentelemetry.trace import SpanKind, Status, StatusCode

logger = logging.getLogger()

tracer = trace.get_tracer("sgs-quote-app")

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

    Each call creates a CLIENT child span under the active Lambda SERVER span
    for distributed tracing visibility in New Relic APM.
    """
    url = supabase_url()
    endpoint = f"{url}/rest/v1/{table}"
    if params:
        endpoint += f"?{params}"

    headers = _headers()
    if prefer:
        headers["Prefer"] = prefer

    parsed = urlparse(url)
    span_attrs = {
        "db.system": "supabase",
        "db.operation.name": method,
        "db.collection.name": table,
        "server.address": parsed.hostname or "unknown",
        "http.request.method": method,
    }

    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(endpoint, data=body, method=method, headers=headers)

    with tracer.start_as_current_span(
        f"{method} Supabase {table}",
        kind=SpanKind.CLIENT,
        attributes=span_attrs,
    ) as span:
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read()
                span.set_attribute("http.response.status_code", resp.status)
                return json.loads(raw) if raw else []
        except urllib.error.HTTPError as e:
            body_text = e.read().decode()
            span.set_attribute("http.response.status_code", e.code)
            span.set_status(Status(StatusCode.ERROR, f"Supabase HTTP {e.code}"))
            span.record_exception(e)
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
