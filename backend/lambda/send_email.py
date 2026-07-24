"""
Lambda: POST /api/email/send
Sends quotation PDF as email attachment via Gmail OAuth2.

Tracing: the ``@trace_lambda_handler`` decorator creates a root SERVER span
for each invocation.
"""

import json
import base64
import boto3
import os
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import urllib.request
import urllib.parse
from tracing import trace_lambda_handler, configure_json_logging

logger = configure_json_logging()
logger.setLevel(logging.INFO)

ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "us-east-1"))

_cache = {}

def get_secret(name: str) -> str:
    prefix = os.environ.get("SSM_PREFIX", "/sgs-quote")
    full = f"{prefix}/{name}"
    if full not in _cache:
        resp = ssm.get_parameter(Name=full, WithDecryption=True)
        _cache[full] = resp["Parameter"]["Value"]
    return _cache[full]


def get_access_token() -> str:
    """Exchange refresh token for an access token."""
    client_id = get_secret("gmail_client_id")
    client_secret = get_secret("gmail_client_secret")
    refresh_token = get_secret("gmail_refresh_token")

    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode()

    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=data,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())

    if "access_token" not in result:
        raise RuntimeError(f"Failed to get access token: {result}")

    return result["access_token"]


def build_email(to: str, cc: list, subject: str, body_html: str,
                pdf_b64: str, filename: str) -> str:
    """Build RFC 2822 email with PDF attachment, return base64url encoded."""
    msg = MIMEMultipart("mixed")
    msg["to"] = to
    msg["from"] = "stellarglobalsupplies@gmail.com"
    msg["subject"] = subject
    if cc:
        msg["cc"] = ", ".join(cc)

    # HTML body
    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(body_html, "html"))
    msg.attach(alt)

    # PDF attachment
    pdf_bytes = base64.b64decode(pdf_b64)
    attachment = MIMEBase("application", "pdf")
    attachment.set_payload(pdf_bytes)
    encoders.encode_base64(attachment)
    attachment.add_header(
        "Content-Disposition", "attachment", filename=filename
    )
    msg.attach(attachment)

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    return raw


def send_via_gmail_api(access_token: str, raw_email: str) -> dict:
    """Send email via Gmail API."""
    body = json.dumps({"raw": raw_email}).encode()
    req = urllib.request.Request(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def cors_response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "https://quote.stellarglobalsupplies.com",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body),
    }


@trace_lambda_handler
def handler(event, context):
    # Handle CORS preflight
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return cors_response(200, {"message": "OK"})

    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return cors_response(400, {"error": "Invalid JSON body"})

    required = ["to", "subject", "bodyHtml", "pdfBase64", "filename"]
    for field in required:
        if not body.get(field):
            return cors_response(400, {"error": f"Missing field: {field}"})

    try:
        access_token = get_access_token()
        raw = build_email(
            to=body["to"],
            cc=body.get("cc", []),
            subject=body["subject"],
            body_html=body["bodyHtml"],
            pdf_b64=body["pdfBase64"],
            filename=body["filename"],
        )
        result = send_via_gmail_api(access_token, raw)
        logger.info("Email sent: %s", result.get("id"))
        return cors_response(200, {"success": True, "messageId": result.get("id")})

    except Exception as exc:
        logger.exception("Failed to send email")
        return cors_response(500, {"error": str(exc)})
