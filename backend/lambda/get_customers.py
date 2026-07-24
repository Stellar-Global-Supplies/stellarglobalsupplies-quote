"""Lambda: GET /api/customers?search=<query>

Tracing: the ``@trace_lambda_handler`` decorator creates a root SERVER span
for each invocation.  Child CLIENT spans are created automatically by
``supabase_client.db_request()``.
"""
import json, logging
from supabase_client import db_request, cors_response, is_preflight
from tracing import trace_lambda_handler, configure_json_logging
import urllib.parse

logger = configure_json_logging()
logger.setLevel(logging.INFO)


@trace_lambda_handler
def handler(event, context):
    if is_preflight(event):
        return cors_response(200, {"message": "OK"})

    qp     = event.get("queryStringParameters") or {}
    search = qp.get("search", "").strip()

    params = "select=*&order=company_name.asc&limit=30"
    if search:
        params += f"&company_name=ilike.*{urllib.parse.quote(search)}*"

    try:
        data = db_request("GET", "quote_customers", params=params)
        return cors_response(200, data)
    except Exception as exc:
        logger.exception("get_customers failed")
        return cors_response(500, {"error": str(exc)})
