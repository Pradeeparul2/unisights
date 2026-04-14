"""
Flask integration for Unisights event collection.

Uses the enhanced validator that matches @pradeeparul2/unisights-node.
Supports both sync and async handlers with optional background processing.

Example:
    from flask import Flask
    from unisights import UnisightsOptions
    from unisights.flask import unisights_flask

    async def handle_event(payload, request):
        print(f"Session: {payload.data.session_id}")

    app = Flask(__name__)
    bp = unisights_flask(UnisightsOptions(handler=handle_event))
    app.register_blueprint(bp)
"""

import json
import logging
import asyncio
from typing import Optional
from threading import Thread
from queue import Queue

from flask import Blueprint, request, jsonify, Response

from .types import UnisightsPayload, UnisightsOptions
from .validator import UnisightsValidator, ValidationError
from .collector import Unisights

def validate_json_payload(body: bytes):
    """Wrapper for JSON validation."""
    return UnisightsValidator.validate_json_payload(body)

logger = logging.getLogger(__name__)


def unisights_flask(options: Optional[UnisightsOptions] = None) -> Blueprint:
    """Create Flask blueprint for Unisights event collection.

    Args:
        options: UnisightsOptions configuration

    Returns:
        Blueprint instance ready to register with Flask app

    Example:
        config = UnisightsOptions(
            path="/api/events",
            handler=my_async_handler,
            validate_schema=True,
            max_payload_size=5 * 1024 * 1024
        )

        app = Flask(__name__)
        bp = unisights_flask(config)
        app.register_blueprint(bp)
    """
    if options is None:
        options = UnisightsOptions()

    bp = Blueprint("unisights", __name__)
    collector = Unisights(handler=options.handler)
    validator = UnisightsValidator(
        validate_schema=options.validate_schema,
        validate_required_fields=options.validate_required_fields,
        strict=True,
        max_payload_size=options.max_payload_size
    )

    # Optional: Background queue for async handlers in Flask sync context
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

    @bp.route(options.path, methods=["POST", "OPTIONS"])
    def collect_events():
        """Collect and process analytics events.

        Returns:
            JSON response with status code
        """
        # Let flask-cors handle OPTIONS preflight at app level
        if request.method == "OPTIONS":
            return {"status": "ok"}, 204

        try:
            # Validate content-type
            content_type = request.headers.get("content-type", "").split(";")[0].strip()
            if content_type and content_type != "application/json":
                return {
                    "error": "Content-Type must be application/json"
                }, 415

            # Check content length
            content_length = request.content_length
            if content_length and content_length > options.max_payload_size:
                return {
                    "error": f"Payload exceeds {options.max_payload_size} bytes"
                }, 413

            # Read and parse request body
            try:
                body = request.get_data()
                if not body:
                    return {
                        "error": "Empty request body"
                    }, 400
            except Exception as e:
                logger.error(f"Error reading request body: {e}")
                return {
                    "error": "Error reading request body"
                }, 400

            # Validate JSON
            valid_json, payload_dict, json_error = validate_json_payload(body)
            if not valid_json:
                return {
                    "error": json_error or "Invalid JSON"
                }, 400

            # Validate payload schema
            try:
                payload: UnisightsPayload = validator.validate(payload_dict)
            except ValidationError as e:
                if options.debug:
                    detail = f"{e.field}: {e.message}"
                else:
                    detail = "Invalid event payload"
                return {
                    "error": detail
                }, 422

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
                    return {
                        "status": "queued",
                        "session_id": payload.data.session_id
                    }, 202
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
                    return {
                        "status": "received",
                        "session_id": payload.data.session_id
                    }, 200

            except Exception as e:
                logger.error(f"Handler error: {e}", exc_info=True)
                if options.debug:
                    return {
                        "error": f"Processing error: {str(e)}"
                    }, 500
                else:
                    # Silently accept
                    return {
                        "status": "accepted",
                        "session_id": payload.data.session_id
                    }, 202

        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
            return {
                "error": "Internal server error" if not options.debug else str(e)
            }, 500

    return bp