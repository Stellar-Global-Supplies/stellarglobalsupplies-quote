"""
OpenTelemetry tracing initialisation for SGS Quote App Lambda functions.

Initialises a TracerProvider once at cold start and reuses it across warm
invocations.  Provides a ``trace_lambda_handler`` decorator that:

* extracts W3C trace context from incoming API Gateway HTTP API v2 headers
* creates a root SERVER span for the Lambda invocation
* ends the root span before calling ``force_flush()``
* skips tracing for OPTIONS / CORS preflight requests

Also provides ``TraceJsonFormatter`` so application logs can carry
``trace.id``, ``span.id`` and ``service.name`` as structured JSON attributes
that the existing CloudWatch → New Relic log-forwarder pipeline will forward.

Logs continue to travel through the existing pipeline:

    Lambda → CloudWatch → New Relic log-forwarder → New Relic Logs

Only traces are exported via OTLP.
"""

from __future__ import annotations

import functools
import json
import logging
import os
from typing import Any, Callable

import boto3

from opentelemetry import trace
from opentelemetry.context import detach
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import SpanKind, Status, StatusCode
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

# ---------------------------------------------------------------------------
# Module-level state — initialised once at cold start, reused across invocations
# ---------------------------------------------------------------------------
_tracer_provider: TracerProvider | None = None
_tracer: trace.Tracer | None = None
_nr_license_key: str | None = None

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# SSM helpers (cached per execution environment)
# ---------------------------------------------------------------------------

def _get_nr_license_key() -> str:
    """Retrieve the New Relic license key from SSM Parameter Store.

    Cached at module level so it is fetched only once per cold start.
    """
    global _nr_license_key
    if _nr_license_key is not None:
        return _nr_license_key

    region = os.environ.get("AWS_REGION", "ap-south-1")
    prefix = os.environ.get("SSM_PREFIX", "/sgs-quote")
    param_name = f"{prefix}/new_relic_license_key"

    try:
        ssm = boto3.client("ssm", region_name=region)
        resp = ssm.get_parameter(Name=param_name, WithDecryption=True)
        _nr_license_key = resp["Parameter"]["Value"]
    except Exception:
        logger.warning("Failed to retrieve New Relic license key from SSM; tracing disabled")
        _nr_license_key = ""

    return _nr_license_key


# ---------------------------------------------------------------------------
# TracerProvider lifecycle
# ---------------------------------------------------------------------------

def _create_tracer_provider() -> TracerProvider:
    """Build a TracerProvider configured for New Relic EU OTLP ingestion.

    Called once during cold start.  The provider is reused for all subsequent
    warm invocations.
    """
    license_key = _get_nr_license_key()
    if not license_key:
        # Return a no-op provider so the application still works without NR
        return TracerProvider()

    # Resource attributes are driven by environment variables set in Terraform:
    #   OTEL_SERVICE_NAME
    #   OTEL_RESOURCE_ATTRIBUTES
    resource = Resource.create()

    exporter = OTLPSpanExporter(
        endpoint="https://otlp.eu01.nr-data.net/v1/traces",
        headers={"api-key": license_key},
        timeout=1,  # seconds — do not let telemetry delay the business API
    )

    processor = BatchSpanProcessor(
        span_exporter=exporter,
        max_queue_size=2048,
        max_export_batch_size=512,
        schedule_delay_millis=5000,
        export_timeout_millis=1000,
    )

    provider = TracerProvider(resource=resource)
    provider.add_span_processor(processor)

    return provider


def _get_tracer_provider() -> TracerProvider:
    """Return the module-level TracerProvider, creating it if necessary."""
    global _tracer_provider
    if _tracer_provider is None:
        _tracer_provider = _create_tracer_provider()
    return _tracer_provider


def _get_tracer() -> trace.Tracer:
    """Return a tracer instance for the application."""
    global _tracer
    if _tracer is None:
        _tracer = _get_tracer_provider().get_tracer("sgs-quote-app")
    return _tracer


# ---------------------------------------------------------------------------
# JSON log formatter for trace correlation
# ---------------------------------------------------------------------------

class TraceJsonFormatter(logging.Formatter):
    """Emit log records as JSON with trace context when a span is active.

    The existing CloudWatch → New Relic log-forwarder pipeline will parse
    these JSON messages and promote ``trace.id``, ``span.id`` and
    ``service.name`` into structured New Relic log attributes.

    Usage in a Lambda module::

        import logging
        from tracing import TraceJsonFormatter

        logger = logging.getLogger()
        for h in logger.handlers:
            if isinstance(h, logging.StreamHandler):
                h.setFormatter(TraceJsonFormatter())
    """

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "message": record.getMessage(),
            "level": record.levelname,
            "logger": record.name,
            "timestamp": self.formatTime(record, self.datefmt),
        }

        # Inject trace context when a valid span is active
        current_span = trace.get_current_span()
        if current_span is not None and current_span.is_recording():
            ctx = current_span.get_span_context()
            entry["trace.id"] = format(ctx.trace_id, "032x")
            entry["span.id"] = format(ctx.span_id, "016x")
            entry["service.name"] = os.environ.get("OTEL_SERVICE_NAME", "sgs-quote-app")

        return json.dumps(entry, ensure_ascii=False, default=str)


def configure_json_logging(logger_name: str | None = None) -> logging.Logger:
    """Configure the given logger to emit JSON-formatted log records.

    Replaces existing handlers on the target logger with a single JSON
    StreamHandler so that one application log call produces exactly one
    CloudWatch log record (JSON, not plain text).

    Idempotent — calling this function multiple times will not add
    duplicate handlers.

    Lambda runtime logs, boto3, and OpenTelemetry library logs are
    unaffected because they use their own loggers, not the target logger.

    Returns the logger so callers can use it immediately.
    """
    target = logging.getLogger(logger_name) if logger_name else logging.getLogger()

    # Idempotency: if the target already has exactly one JSON handler, skip.
    if (
        len(target.handlers) == 1
        and isinstance(target.handlers[0], logging.StreamHandler)
        and isinstance(target.handlers[0].formatter, TraceJsonFormatter)
    ):
        return target

    # Replace all existing handlers with a single JSON StreamHandler.
    target.handlers.clear()
    handler = logging.StreamHandler()
    handler.setFormatter(TraceJsonFormatter())
    target.addHandler(handler)
    return target


# ---------------------------------------------------------------------------
# Lambda handler decorator
# ---------------------------------------------------------------------------

def trace_lambda_handler(handler: Callable) -> Callable:
    """Decorator that wraps a Lambda handler with OpenTelemetry tracing.

    * Skips OPTIONS / CORS preflight requests.
    * Extracts W3C ``traceparent`` / ``tracestate`` from incoming headers.
    * Creates a root SERVER span named after the HTTP method and path.
    * Ends the root span **before** calling ``force_flush()``.
    * ``force_flush()`` is best-effort with a 1500 ms timeout.
    * Never raises an exception into application business logic.
    """

    @functools.wraps(handler)
    def wrapper(event: dict, context: object) -> dict:
        # ── Skip tracing for CORS preflight ──────────────────────────────
        if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
            return handler(event, context)

        # ── Extract W3C trace context from incoming headers ──────────────
        headers = event.get("headers", {}) or {}
        carrier = {
            "traceparent": headers.get("traceparent", ""),
            "tracestate": headers.get("tracestate", ""),
        }
        ctx = TraceContextTextMapPropagator().extract(carrier=carrier)

        # ── Determine span name ──────────────────────────────────────────
        http_method = event.get("requestContext", {}).get("http", {}).get("method", "UNKNOWN")
        raw_path = event.get("rawPath", "/")
        route_key = event.get("routeKey", "unknown")
        span_name = f"{http_method} {raw_path}"

        tracer = _get_tracer()
        span = tracer.start_span(
            span_name,
            context=ctx,
            kind=SpanKind.SERVER,
            attributes={
                "http.request.method": http_method,
                "http.route": route_key,
                "url.path": raw_path,
            },
        )

        # Make the span active so child spans and log correlation pick it up
        token = None
        try:
            token = trace.set_span_in_context(span, ctx)
        except Exception:
            logger.debug("Failed to set span in context; continuing without context")

        try:
            response = handler(event, context)
            status_code = response.get("statusCode", 200) if isinstance(response, dict) else 200
            span.set_attribute("http.response.status_code", status_code)
            return response

        except Exception as exc:
            span.set_attribute("http.response.status_code", 500)
            span.set_status(Status(StatusCode.ERROR, str(exc)))
            span.record_exception(exc)
            raise

        finally:
            # 1. End the root span FIRST
            span.end()

            # 2. Detach context if it was set
            if token is not None:
                try:
                    detach(token)
                except Exception:
                    logger.debug("Failed to detach context; continuing")

            # 3. Force-flush AFTER the span has ended
            #    Best-effort — never let telemetry failure affect the business API.
            try:
                tp = _get_tracer_provider()
                tp.force_flush(timeout_millis=1500)
            except Exception:
                logger.warning("Telemetry force_flush failed; continuing")

    return wrapper