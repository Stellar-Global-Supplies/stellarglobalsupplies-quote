"""
Lambda: DELETE /api/quotes/{id}  — delete a quote
        PATCH  /api/quotes/{id}  — update status only
"""
import json, logging
from supabase_client import db_request, cors_response, is_preflight

logger = logging.getLogger()
logger.setLevel(logging.INFO)

VALID_STATUSES = {'draft', 'sent', 'accepted', 'rejected'}


def handler(event, context):
    if is_preflight(event):
        return cors_response(200, {"message": "OK"})

    method   = event.get("requestContext", {}).get("http", {}).get("method", "")
    quote_id = (event.get("pathParameters") or {}).get("id", "").strip()

    if not quote_id:
        return cors_response(400, {"error": "Missing quote id"})

    # ── DELETE ────────────────────────────────────────────────────────────────
    if method == "DELETE":
        try:
            db_request("DELETE", "quotes", params=f"id=eq.{quote_id}", prefer="return=minimal")
            return cors_response(200, {"success": True})
        except Exception as exc:
            logger.exception("delete_quote failed")
            return cors_response(500, {"error": str(exc)})

    # ── PATCH (status update) ─────────────────────────────────────────────────
    if method == "PATCH":
        try:
            body = json.loads(event.get("body", "{}"))
        except json.JSONDecodeError:
            return cors_response(400, {"error": "Invalid JSON"})

        status = body.get("status", "").strip()
        if status not in VALID_STATUSES:
            return cors_response(400, {"error": f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}"})

        try:
            result = db_request(
                "PATCH", "quotes",
                data={"status": status},
                params=f"id=eq.{quote_id}",
                prefer="return=representation",
            )
            return cors_response(200, {"success": True, "quote": result[0] if result else {}})
        except Exception as exc:
            logger.exception("update_quote_status failed")
            return cors_response(500, {"error": str(exc)})

    return cors_response(405, {"error": "Method not allowed"})
