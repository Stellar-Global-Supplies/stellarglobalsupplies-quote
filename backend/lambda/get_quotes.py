"""Lambda: GET /api/quotes"""
import json, logging
from supabase_client import db_request, cors_response, is_preflight
import urllib.parse

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    if is_preflight(event):
        return cors_response(200, {"message": "OK"})

    qp     = event.get("queryStringParameters") or {}
    limit  = min(int(qp.get("limit", 50)), 100)
    offset = int(qp.get("offset", 0))
    search = qp.get("search", "").strip()

    params = f"select=*,quote_customers(*)&order=created_at.desc&limit={limit}&offset={offset}"
    if search:
        params += f"&quote_number=ilike.*{urllib.parse.quote(search)}*"

    try:
        data = db_request("GET", "quotes", params=params)
        return cors_response(200, data)
    except Exception as exc:
        logger.exception("get_quotes failed")
        return cors_response(500, {"error": str(exc)})
