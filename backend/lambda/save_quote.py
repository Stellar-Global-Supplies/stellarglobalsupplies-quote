"""
Lambda: POST /api/quotes
- New quote: auto-assigns quote_number, inserts
- Edit (quote_number already exists): upserts via ON CONFLICT DO UPDATE

Tracing: the ``@trace_lambda_handler`` decorator creates a root SERVER span
for each invocation.  Child CLIENT spans are created automatically by
``supabase_client.db_request()``.
"""
import json, logging, urllib.parse
from supabase_client import db_request, cors_response, is_preflight
from tracing import trace_lambda_handler, configure_json_logging
from datetime import datetime

logger = configure_json_logging()
logger.setLevel(logging.INFO)


def upsert_customer(customer: dict) -> str:
    gst = (customer.get("gst_number") or "").strip().upper()
    record = {
        "company_name":   customer["company_name"].strip(),
        "gst_number":     gst or None,  # store null if empty
        "address":        customer.get("address", "").strip(),
        "city":           customer.get("city", "").strip(),
        "pin_code":       customer.get("pin_code", "").strip(),
        "state":          customer.get("state", "").strip(),
        "state_code":     str(customer.get("state_code", "")).strip(),
        "contact_person": customer.get("contact_person", "").strip(),
        "contact_number": customer.get("contact_number", "").strip(),
        "email":          customer.get("email", "").strip().lower(),
    }
    # Only use upsert-on-conflict when GST is provided (unique key)
    params = "on_conflict=gst_number" if gst else ""
    result = db_request("POST", "quote_customers", record, params=params)
    return result[0]["id"]


def get_next_quote_number() -> str:
    now        = datetime.now()
    year_start = now.year if now.month >= 4 else now.year - 1
    fy         = f"{str(year_start)[2:]}-{str(year_start + 1)[2:]}"
    prefix     = urllib.parse.quote(f"SGS/{fy}/")
    results    = db_request(
        "GET", "quotes",
        params=f"select=quote_number&quote_number=like.{prefix}*&order=created_at.desc&limit=1",
    )
    if results:
        try:
            return f"SGS/{fy}/{int(results[0]['quote_number'].split('/')[-1]) + 1}"
        except (ValueError, IndexError):
            pass
    return f"SGS/{fy}/1"


@trace_lambda_handler
def handler(event, context):
    if is_preflight(event):
        return cors_response(200, {"message": "OK"})

    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return cors_response(400, {"error": "Invalid JSON"})

    customer = body.get("customer", {})
    if not customer.get("company_name"):
        return cors_response(400, {"error": "customer.company_name is required"})
    if not body.get("items"):
        return cors_response(400, {"error": "items is required"})

    try:
        customer_id  = upsert_customer(customer)
        now          = datetime.now()

        # If quote_number supplied it's an edit — keep same number.
        # If blank it's a new quote — auto-assign.
        quote_number = (body.get("quote_number") or "").strip() or get_next_quote_number()

        quote = {
            "quote_number": quote_number,
            "customer_id":  customer_id,
            "date":         body.get("date", now.strftime("%Y-%m-%d")),
            "expiry_date":  body.get("expiry_date"),
            "items":        json.dumps(body["items"]),
            "sub_total":    body.get("sub_total", 0),
            "igst_rate":    body.get("igst_rate", 0),
            "cgst_rate":    body.get("cgst_rate", 9),
            "sgst_rate":    body.get("sgst_rate", 9),
            "igst_amount":  body.get("igst_amount", 0),
            "cgst_amount":  body.get("cgst_amount", 0),
            "sgst_amount":  body.get("sgst_amount", 0),
            "grand_total":  body.get("grand_total", 0),
            "notes":        body.get("notes", ""),
            "status":       body.get("status", "draft"),
        }

        # ON CONFLICT (quote_number) DO UPDATE — handles both insert and edit
        result = db_request(
            "POST", "quotes", quote,
            params="on_conflict=quote_number",
            prefer="return=representation,resolution=merge-duplicates",
        )

        return cors_response(200, {
            "success":     True,
            "quote":       result[0] if result else quote,
            "customer_id": customer_id,
        })

    except Exception as exc:
        logger.exception("save_quote failed")
        return cors_response(500, {"error": str(exc)})
