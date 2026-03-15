# src/unisights/asgi.py (updated)
"""
ASGI middleware for Unisights event collection.

Works with any ASGI application. Uses the enhanced validator that matches
the @pradeeparul2/unisights-node specification.
"""

import json
import logging
from typing import Callable, Optional, Any

from .types import UnisightsPayload, UnisightsOptions
from .validator import UnisightsValidator, ValidationError, validate_json_payload
from .collector import Unisights

logger = logging.getLogger(__name__)


def unisights_asgi(options: Optional[UnisightsOptions] = None):
    """Create ASGI middleware for Unisights event collection.

    Args:
        options: UnisightsOptions configuration

    Returns:
        ASGI middleware function

    Example:
        from unisights import UnisightsOptions, unisights_asgi

        options = UnisightsOptions(
            path="/collect/events",
            handler=my_handler_func,
            validate_schema=True
        )

        async def app(scope, receive, send):
            if scope["type"] == "http":
                middleware = unisights_asgi(options)
                await middleware(scope, receive, send)
    """
    if options is None:
        options = UnisightsOptions()

    collector = Unisights(handler=options.handler, debug=options.debug)
    validator = UnisightsValidator(
        validate_schema=options.validate_schema,
        validate_required_fields=options.validate_required_fields,
        strict=True,
        max_payload_size=options.max_payload_size,
    )

    async def middleware(scope, receive, send):
        """ASGI middleware implementation."""
        if scope["type"] != "http":
            return

        # Handle CORS preflight
        if scope["method"] == "OPTIONS" and scope["path"] == options.path:
            await _send_cors_response(send, 204, b"")
            return

        # Only handle POST to configured path
        if scope["method"] != "POST" or scope["path"] != options.path:
            await _send_error(send, 404, "Not Found")
            return

        # Get headers
        headers = dict(scope.get("headers", []))
        content_type = headers.get(b"content-type", b"").decode().split(";")[0]

        # Validate content-type
        if content_type and content_type != "application/json":
            await _send_error(send, 415, "Content-Type must be application/json")
            return

        # Read body with size limit
        body = b""
        body_size = 0

        try:
            while True:
                message = await receive()
                chunk = message.get("body", b"")
                body_size += len(chunk)

                if body_size > options.max_payload_size:
                    await _send_error(
                        send,
                        413,
                        f"Payload exceeds maximum size of {options.max_payload_size} bytes"
                    )
                    return

                body += chunk
                if not message.get("more_body"):
                    break
        except Exception as e:
            logger.error(f"Error reading request body: {e}")
            await _send_error(send, 400, "Error reading request body")
            return

        # Parse JSON
        valid_json, payload_dict, json_error = validate_json_payload(body)
        if not valid_json:
            await _send_error(send, 400, json_error or "Invalid JSON")
            return

        # Validate payload structure
        try:
            payload = validator.validate(payload_dict)
        except ValidationError as e:
            if options.debug:
                await _send_error(send, 422, f"Validation failed: {str(e)}")
            else:
                await _send_error(send, 422, "Invalid payload")
            return

        # Process event
        try:
            await collector.process(payload, scope)
            await _send_success(send, 200, {"status": "received"})
        except Exception as e:
            logger.error(f"Handler error: {e}", exc_info=True)
            if options.debug:
                await _send_error(send, 500, f"Processing error: {str(e)}")
            else:
                # Accept silently and return 202 to client
                await _send_success(send, 202, {"status": "accepted"})

    return middleware


async def _send_success(send, status: int, data: dict):
    """Send successful JSON response."""
    headers = [
        (b"content-type", b"application/json"),
        (b"access-control-allow-origin", b"*"),
        (b"access-control-allow-methods", b"POST, OPTIONS"),
    ]

    body = json.dumps(data).encode()

    await send({
        "type": "http.response.start",
        "status": status,
        "headers": headers
    })
    await send({
        "type": "http.response.body",
        "body": body
    })


async def _send_error(send, status: int, error: str):
    """Send error response."""
    headers = [
        (b"content-type", b"application/json"),
        (b"access-control-allow-origin", b"*"),
    ]

    body = json.dumps({"error": error}).encode()

    await send({
        "type": "http.response.start",
        "status": status,
        "headers": headers
    })
    await send({
        "type": "http.response.body",
        "body": body
    })


async def _send_cors_response(send, status: int, body: bytes):
    """Send CORS preflight response."""
    await send({
        "type": "http.response.start",
        "status": status,
        "headers": [
            (b"access-control-allow-origin", b"*"),
            (b"access-control-allow-methods", b"POST, OPTIONS"),
            (b"access-control-allow-headers", b"content-type, authorization"),
            (b"access-control-max-age", b"86400"),
        ]
    })
    await send({
        "type": "http.response.body",
        "body": body
    })