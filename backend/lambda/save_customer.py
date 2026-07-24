"""Lambda: POST /api/customers — used by import page

Tracing: the ``@trace_lambda_handler`` decorator creates a root SERVER span
for each invocation.  Child CLIENT spans are created automatically by
``supabase_client.db_request()``.
"""
import json, logging
from supabase_client import db_request, cors_response, is_preflight
from tracing import trace_lambda_handler, configure_json_logging

logger = configure_json_logging()
logger.setLevel(logging.INFO)


@trace_lambda_handler
def handler(event, context):
    if is_preflight(event):
        return cors_response(200, {"message": "OK"})

    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return cors_response(400, {"error": "Invalid JSON"})

    for f in ["company_name", "gst_number", "address", "state", "state_code"]:
        if not body.get(f):
            return cors_response(400, {"error": f"Missing field: {f}"})

    record = {
        "company_name":   body["company_name"].strip(),
        "gst_number":     body["gst_number"].strip().upper(),
        "address":        body.get("address", "").strip(),
        "city":           body.get("city", "").strip(),
        "pin_code":       body.get("pin_code", "").strip(),
        "state":          body["state"].strip(),
        "state_code":     str(body["state_code"]).strip(),
        "contact_person": body.get("contact_person", "").strip(),
        "contact_number": body.get("contact_number", "").strip(),
        "email":          body.get("email", "").strip().lower(),
    }

    try:
        result = db_request("POST", "quote_customers", record, params="on_conflict=gst_number")
        return cors_response(200, {"success": True, "customer": result[0] if result else record})
    except Exception as exc:
        logger.exception("save_customer failed")
        return cors_response(500, {"error": str(exc)})
