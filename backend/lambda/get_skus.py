"""Lambda: GET /api/skus?search=<query>"""
import json, logging
from supabase_client import db_request, cors_response, is_preflight
import urllib.parse

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    if is_preflight(event):
        return cors_response(200, {"message": "OK"})

    qp     = event.get("queryStringParameters") or {}
    search = qp.get("search", "").strip()

    params = "select=sku,material_type,hsn_sac&order=sku.asc&limit=30"
    if search:
        params += f"&sku=ilike.*{urllib.parse.quote(search)}*"

    try:
        data = db_request("GET", "top_sku", params=params)
        return cors_response(200, data)
    except Exception as exc:
        logger.exception("get_skus failed")
        return cors_response(500, {"error": str(exc)})
