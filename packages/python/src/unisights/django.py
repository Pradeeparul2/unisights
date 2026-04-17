"""
Django integration for Unisights event collection.

Uses the enhanced validator that matches @pradeeparul2/unisights-node.
Supports both sync and async handlers with optional background processing.

Example:
    from django.urls import path
    from unisights import UnisightsOptions
    from unisights.django import unisights_django

    async def handle_event(payload, request):
        print(f"Session: {payload.data.session_id}")

    urlpatterns = [
        path("api/events/", unisights_django(UnisightsOptions(handler=handle_event)))
    ]
"""

import json
import logging
import asyncio
from typing import Optional, Callable
from threading import Thread
from queue import Queue
from functools import wraps

from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .types import UnisightsPayload, UnisightsOptions
from .validator import UnisightsValidator, ValidationError
from .collector import Unisights

def validate_json_payload(body: bytes):
    """Wrapper for JSON validation."""
    return UnisightsValidator.validate_json_payload(body)

logger = logging.getLogger(__name__)


def unisights_django(options: Optional[UnisightsOptions] = None) -> Callable:
    """Create Django view for Unisights event collection.

    Args:
        options: UnisightsOptions configuration

    Returns:
        Django view function (CSRF exempt)

    Example:
        config = UnisightsOptions(
            path="/api/events/",
            handler=my_async_handler,
            validate_schema=True,
            max_payload_size=5 * 1024 * 1024
        )

        urlpatterns = [
            path("api/events/", unisights_django(config))
        ]

    Note:
        Add this to settings.py for CORS:
        
        CORS_ALLOWED_ORIGINS = ["*"]
        MIDDLEWARE = [
            "django.middleware.cors.CorsMiddleware",
            ...
        ]
    """
    if options is None:
        options = UnisightsOptions()

    collector = Unisights(handler=options.handler)
    validator = UnisightsValidator(
        validate_schema=options.validate_schema,
        validate_required_fields=options.validate_required_fields,
        strict=True,
        max_payload_size=options.max_payload_size
    )

    # Optional: Background queue for async handlers in Django sync context
    event_queue = None
    if options.handler:
        event_queue = Queue()

        def worker():
            """Background worker processing events asynchronously."""
            while True:
                try:
                    payload, req = event_queue.get()
                    try:
                        # Run async handler in event loop
                        asyncio.run(collector.process(payload, req))
                    except Exception as e:
                        logger.error(
                            f"Worker error processing {payload.data.asset_id}: {e}",
                            exc_info=True
                        )
                    finally:
                        event_queue.task_done()
                except Exception as e:
                    logger.error(f"Queue worker error: {e}", exc_info=True)

        # Start background worker thread
        worker_thread = Thread(target=worker, daemon=True)
        worker_thread.start()

    @require_http_methods(["POST", "OPTIONS"])
    @csrf_exempt
    def collect_events(request: HttpRequest) -> JsonResponse:
        """Collect and process analytics events.

        Args:
            request: Django HttpRequest object

        Returns:
            JsonResponse with status and headers

        Response Status Codes:
            200 - Event processed successfully
            202 - Event queued for processing
            400 - Invalid JSON or malformed request
            413 - Payload too large
            415 - Wrong content type
            422 - Validation error
            500 - Processing error
        """
        # Handle CORS preflight
        if request.method == "OPTIONS":
            response = JsonResponse({})
            response["Access-Control-Allow-Origin"] = "*"
            response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type"
            response["Access-Control-Max-Age"] = "86400"
            return response

        # Validate HTTP method
        if request.method != "POST":
            return JsonResponse(
                {"error": "Method not allowed"},
                status=405,
                headers=_cors_headers()
            )

        try:
            # Validate content-type
            content_type = request.META.get("CONTENT_TYPE", "").split(";")[0].strip()
            if content_type and content_type != "application/json":
                return JsonResponse(
                    {"error": "Content-Type must be application/json"},
                    status=415,
                    headers=_cors_headers()
                )

            # Check content length
            content_length = request.META.get("CONTENT_LENGTH", 0)
            try:
                content_length = int(content_length) if content_length else 0
            except (ValueError, TypeError):
                content_length = 0

            if content_length > options.max_payload_size:
                return JsonResponse(
                    {"error": f"Payload exceeds {options.max_payload_size} bytes"},
                    status=413,
                    headers=_cors_headers()
                )

            # Read and parse request body
            try:
                body = request.body
                if not body:
                    return JsonResponse(
                        {"error": "Empty request body"},
                        status=400,
                        headers=_cors_headers()
                    )

                # Check actual size
                if len(body) > options.max_payload_size:
                    return JsonResponse(
                        {"error": f"Payload exceeds {options.max_payload_size} bytes"},
                        status=413,
                        headers=_cors_headers()
                    )

            except Exception as e:
                logger.error(f"Error reading request body: {e}")
                return JsonResponse(
                    {"error": "Error reading request body"},
                    status=400,
                    headers=_cors_headers()
                )

            # Validate JSON
            valid_json, payload_dict, json_error = validate_json_payload(body)
            if not valid_json:
                return JsonResponse(
                    {"error": json_error or "Invalid JSON"},
                    status=400,
                    headers=_cors_headers()
                )

            # Validate payload schema
            try:
                payload: UnisightsPayload = validator.validate(payload_dict)
            except ValidationError as e:
                if options.debug:
                    detail = f"{e.field}: {e.message}"
                else:
                    detail = "Invalid event payload"
                return JsonResponse(
                    {"error": detail},
                    status=422,
                    headers=_cors_headers()
                )

            # Process event
            try:
                # Use queue if available (for async handlers)
                if event_queue:
                    event_queue.put((payload, request))
                    if options.debug:
                        logger.info(
                            f"Event queued",
                            extra={
                                "session_id": payload.data.session_id,
                                "asset_id": payload.data.asset_id,
                                "queue_size": event_queue.qsize()
                            }
                        )
                    return JsonResponse(
                        {
                            "status": "queued",
                            "session_id": payload.data.session_id
                        },
                        status=202,
                        headers=_cors_headers()
                    )
                else:
                    # Direct processing (sync handler or no handler)
                    asyncio.run(collector.process(payload, request))
                    if options.debug:
                        logger.info(
                            f"Event processed",
                            extra={
                                "session_id": payload.data.session_id,
                                "asset_id": payload.data.asset_id,
                                "events_count": len(payload.data.events)
                            }
                        )
                    return JsonResponse(
                        {
                            "status": "received",
                            "session_id": payload.data.session_id
                        },
                        status=200,
                        headers=_cors_headers()
                    )

            except Exception as e:
                logger.error(f"Handler error: {e}", exc_info=True)
                if options.debug:
                    return JsonResponse(
                        {"error": f"Processing error: {str(e)}"},
                        status=500,
                        headers=_cors_headers()
                    )
                else:
                    # Silently accept
                    return JsonResponse(
                        {
                            "status": "accepted",
                            "session_id": payload.data.session_id
                        },
                        status=202,
                        headers=_cors_headers()
                    )

        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
            return JsonResponse(
                {"error": "Internal server error" if not options.debug else str(e)},
                status=500,
                headers=_cors_headers()
            )

    return collect_events


def _cors_headers() -> dict:
    """Get CORS headers for response."""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
    }


# Optional: ASGI view for Django async support
async def unisights_django_async(options: Optional[UnisightsOptions] = None) -> Callable:
    """Create Django async view for Unisights event collection.

    This is useful for Django 4.1+ with ASGI support and native async views.

    Args:
        options: UnisightsOptions configuration

    Returns:
        Django async view function

    Example:
        from django.urls import path
        from unisights.django import unisights_django_async

        urlpatterns = [
            path("api/events/", unisights_django_async(options))
        ]

    Note:
        Django project must use ASGI with:
        
        asgi.py:
        application = get_asgi_application()
        
        And middleware must support async.
    """
    if options is None:
        options = UnisightsOptions()

    collector = Unisights(handler=options.handler)
    validator = UnisightsValidator(
        validate_schema=options.validate_schema,
        validate_required_fields=options.validate_required_fields,
        strict=True,
        max_payload_size=options.max_payload_size
    )

    @require_http_methods(["POST", "OPTIONS"])
    @csrf_exempt
    async def collect_events_async(request: HttpRequest) -> JsonResponse:
        """Async collect and process analytics events."""
        # Handle CORS preflight
        if request.method == "OPTIONS":
            response = JsonResponse({})
            response["Access-Control-Allow-Origin"] = "*"
            response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type"
            response["Access-Control-Max-Age"] = "86400"
            return response

        try:
            # Validate content-type
            content_type = request.META.get("CONTENT_TYPE", "").split(";")[0].strip()
            if content_type and content_type != "application/json":
                return JsonResponse(
                    {"error": "Content-Type must be application/json"},
                    status=415
                )

            # Check content length
            content_length = request.META.get("CONTENT_LENGTH", 0)
            try:
                content_length = int(content_length) if content_length else 0
            except (ValueError, TypeError):
                content_length = 0

            if content_length > options.max_payload_size:
                return JsonResponse(
                    {"error": f"Payload exceeds {options.max_payload_size} bytes"},
                    status=413
                )

            # Read request body
            body = await request.aread()
            if not body:
                return JsonResponse(
                    {"error": "Empty request body"},
                    status=400
                )

            # Validate JSON
            valid_json, payload_dict, json_error = validate_json_payload(body)
            if not valid_json:
                return JsonResponse(
                    {"error": json_error or "Invalid JSON"},
                    status=400
                )

            # Validate payload schema
            try:
                payload: UnisightsPayload = validator.validate(payload_dict)
            except ValidationError as e:
                if options.debug:
                    detail = f"{e.field}: {e.message}"
                else:
                    detail = "Invalid event payload"
                return JsonResponse(
                    {"error": detail},
                    status=422
                )

            # Process event
            try:
                await collector.process(payload, request)
                if options.debug:
                    logger.info(
                        f"Event processed",
                        extra={
                            "session_id": payload.data.session_id,
                            "asset_id": payload.data.asset_id,
                            "events_count": len(payload.data.events)
                        }
                    )
                return JsonResponse(
                    {
                        "status": "received",
                        "session_id": payload.data.session_id
                    },
                    status=200
                )

            except Exception as e:
                logger.error(f"Handler error: {e}", exc_info=True)
                if options.debug:
                    return JsonResponse(
                        {"error": f"Processing error: {str(e)}"},
                        status=500
                    )
                else:
                    return JsonResponse(
                        {
                            "status": "accepted",
                            "session_id": payload.data.session_id
                        },
                        status=202
                    )

        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
            return JsonResponse(
                {"error": "Internal server error" if not options.debug else str(e)},
                status=500
            )

    return collect_events_async