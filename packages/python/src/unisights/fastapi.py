# src/unisights/fastapi.py
"""
FastAPI integration for Unisights event collection.

Uses the enhanced validator that matches @pradeeparul2/unisights-node.

Example:
    from fastapi import FastAPI
    from unisights import UnisightsOptions
    from unisights.fastapi import unisights_fastapi

    async def handle_event(payload, request):
        print(f"Session: {payload.data.session_id}")

    app = FastAPI()
    router = unisights_fastapi(UnisightsOptions(handler=handle_event))
    app.include_router(router)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Request, HTTPException, status

from .types import UnisightsPayload, UnisightsOptions
from .validator import UnisightsValidator, ValidationError, validate_json_payload
from .collector import Unisights

logger = logging.getLogger(__name__)


def unisights_fastapi(options: Optional[UnisightsOptions] = None) -> APIRouter:
    """Create FastAPI router for Unisights event collection.

    Args:
        options: UnisightsOptions configuration

    Returns:
        APIRouter instance ready to include in FastAPI app

    Example:
        config = UnisightsOptions(
            path="/api/events",
            handler=my_handler,
            validate_schema=True,
            max_payload_size=5 * 1024 * 1024
        )

        app = FastAPI()
        router = unisights_fastapi(config)
        app.include_router(router)
    """
    if options is None:
        options = UnisightsOptions()

    router = APIRouter(tags=["unisights"])
    collector = Unisights(
        handler=options.handler,
        debug=options.debug
    )
    validator = UnisightsValidator(
        validate_schema=options.validate_schema,
        validate_required_fields=options.validate_required_fields,
        strict=True,
        max_payload_size=options.max_payload_size
    )

    @router.post(
        options.path,
        status_code=200,
        response_model=dict,
        summary="Collect analytics events",
        description="Receive and process analytics events from Unisights client SDK"
    )
    async def collect_events(request: Request) -> dict:
        """Collect and process analytics events.

        Args:
            request: FastAPI request object

        Returns:
            Success response with status

        Raises:
            HTTPException: On validation or processing errors
        """
        try:
            # Validate content-type
            content_type = request.headers.get("content-type", "").split(";")[0].strip()
            if content_type and content_type != "application/json":
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail="Content-Type must be application/json"
                )

            # Read request body with size limit
            body = await request.body()
            if len(body) > options.max_payload_size:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Payload exceeds {options.max_payload_size} bytes"
                )

            # Parse JSON payload
            valid_json, payload_dict, json_error = validate_json_payload(body)
            if not valid_json:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=json_error or "Invalid JSON"
                )

            # Validate against schema
            try:
                payload: UnisightsPayload = validator.validate(payload_dict)
            except ValidationError as e:
                if options.debug:
                    detail = f"Validation error: {e.field} - {e.message}"
                else:
                    detail = "Invalid event payload"
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=detail
                )

            # Process event with handler
            try:
                await collector.process(payload, request)
                if options.debug:
                    logger.info(
                        f"Event processed successfully",
                        extra={
                            "session_id": payload.data.session_id,
                            "asset_id": payload.data.asset_id,
                            "events_count": len(payload.data.events)
                        }
                    )
                return {"status": "received", "session_id": payload.data.session_id}
            except Exception as e:
                logger.error(f"Handler error: {e}", exc_info=True)
                if options.debug:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Processing error: {str(e)}"
                    )
                else:
                    # Silently accept and queue for retry
                    return {"status": "accepted", "session_id": payload.data.session_id}

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error" if not options.debug else str(e)
            )

    @router.options(
        options.path,
        include_in_schema=False
    )
    async def options_events():
        """Handle CORS preflight requests."""
        return {}

    return router