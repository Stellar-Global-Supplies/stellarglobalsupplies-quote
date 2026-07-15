"""
Lambda: POST /api/quotes
Upserts quote_customer then saves the quote in one call.
"""
import json, logging
from supabase_client import db_request, cors_response, is_preflight
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def upsert_customer(customer: dict) -> str:
    record = {
        "company_name":   customer["company_name"].strip(),
        "gst_number":     customer["gst_number"].strip().upper(),
        "address":        customer.get("address", "").strip(),
        "city":           customer.get("city", "").strip(),
        "pin_code":       customer.get("pin_code", "").strip(),
        "state":          customer.get("state", "").strip(),
        "state_code":     str(customer.get("state_code", "")).strip(),
        "contact_person": customer.get("contact_person", "").strip(),
        "contact_number": customer.get("contact_number", "").strip(),
        "email":          customer.get("email", "").strip().lower(),
    }
    result = db_request("POST", "quote_customers", record, params="on_conflict=gst_number")
    return result[0]["id"]


def get_next_quote_number() -> str:
    now = datetime.now()
    year_start = now.year if now.month >= 4 else now.year - 1
    fy = f"{str(year_start)[2:]}-{str(year_start + 1)[2:]}"
    import urllib.parse
    results = db_request(
        "GET", "quotes",
        params=f"select=quote_number&quote_number=like.{urllib.parse.quote(f'SGS/{fy}/')}*&order=created_at.desc&limit=1"
    )
    if results:
        try:
            return f"SGS/{fy}/{int(results[0]['quote_number'].split('/')[-1]) + 1}"
        except (ValueError, IndexError):
            pass
    return f"SGS/{fy}/1"


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
    if not customer.get("gst_number"):
        return cors_response(400, {"error": "customer.gst_number is required"})
    if not body.get("items"):
        return cors_response(400, {"error": "items is required"})

    try:
        customer_id  = upsert_customer(customer)
        quote_number = body.get("quote_number") or get_next_quote_number()
        now          = datetime.now()

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

        result = db_request("POST", "quotes", quote)
        return cors_response(200, {
            "success":     True,
            "quote":       result[0] if result else quote,
            "customer_id": customer_id,
        })

    except Exception as exc:
        logger.exception("save_quote failed")
        return cors_response(500, {"error": str(exc)})
