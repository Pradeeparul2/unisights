# examples/

## FastAPI Example

# examples/fastapi_example.py
"""
Complete FastAPI example with Unisights event collection.

Run:
    pip install fastapi uvicorn
    python examples/fastapi_example.py

Then POST to:
    curl -X POST http://localhost:8000/api/events \
      -H "Content-Type: application/json" \
      -d '{"encrypted": false, "data": {...}}'
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
from typing import Optional
from datetime import datetime

from unisights import UnisightsOptions, UnisightsPayload
from unisights.fastapi import unisights_fastapi

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Analytics API",
    description="Event collection endpoint for Unisights",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ────────────────────────────────────────────────────────────────────────────
# Event Handler
# ────────────────────────────────────────────────────────────────────────────

async def handle_unisights_event(payload: UnisightsPayload, request: Request):
    """Process Unisights analytics event.
    
    Args:
        payload: Parsed and validated UnisightsPayload
        request: FastAPI request object
    """
    data = payload.data
    
    logger.info(f"=== Analytics Event ===")
    logger.info(f"Asset ID: {data.asset_id}")
    logger.info(f"Session ID: {data.session_id}")
    logger.info(f"Page URL: {data.page_url}")
    logger.info(f"Device: {data.device_info.browser} on {data.device_info.os}")
    logger.info(f"Scroll Depth: {data.scroll_depth}%")
    logger.info(f"Time on Page: {data.time_on_page}s")
    
    # UTM Tracking
    if data.utm_params.utm_source:
        logger.info(f"UTM Source: {data.utm_params.utm_source}")
        logger.info(f"UTM Medium: {data.utm_params.utm_medium}")
        logger.info(f"UTM Campaign: {data.utm_params.utm_campaign}")
    
    # Process events
    logger.info(f"Processing {len(data.events)} events:")
    for idx, event in enumerate(data.events, 1):
        logger.info(f"  {idx}. {event.type}")
        
        if event.type == "page_view":
            logger.info(f"     Title: {event.data.get('title')}")
            logger.info(f"     Location: {event.data.get('location')}")
            
        elif event.type == "click":
            logger.info(f"     Position: ({event.data.get('x')}, {event.data.get('y')})")
            
        elif event.type == "web_vital":
            logger.info(f"     Metric: {event.data.get('name')}")
            logger.info(f"     Value: {event.data.get('value'):.2f}ms")
            logger.info(f"     Rating: {event.data.get('rating')}")
            
        elif event.type == "error":
            logger.error(f"     {event.data.get('message')}")
            logger.error(f"     Location: {event.data.get('source')}")
            
        elif event.type == "custom":
            logger.info(f"     Name: {event.data.get('name')}")
            logger.info(f"     Data: {event.data.get('data')}")
    
    # TODO: Save to database
    # await db.sessions.insert_one({
    #     "asset_id": data.asset_id,
    #     "session_id": data.session_id,
    #     "page_url": data.page_url,
    #     "events": [e.to_dict() for e in data.events],
    #     "timestamp": datetime.utcnow()
    # })
    
    # TODO: Send to analytics service
    # await analytics_client.send_events(data)


# ────────────────────────────────────────────────────────────────────────────
# Routes
# ────────────────────────────────────────────────────────────────────────────

# Configure Unisights
unisights_config = UnisightsOptions(
    path="/api/events",
    handler=handle_unisights_event,
    validate_schema=True,
    validate_required_fields=True,
    max_payload_size=5 * 1024 * 1024,  # 5MB
    debug=True
)

# Include Unisights router
unisights_router = unisights_fastapi(unisights_config)
app.include_router(unisights_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/")
async def root():
    """API documentation."""
    return {
        "name": "Analytics API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "events": "/api/events (POST)"
        }
    }


# ────────────────────────────────────────────────────────────────────────────
# Error Handlers
# ────────────────────────────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"}
    )


if __name__ == "__main__":
    import uvicorn
    
    logger.info("Starting Analytics API...")
    logger.info("Listen on: http://0.0.0.0:8000")
    logger.info("Unisights endpoint: POST /api/events")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )


# ────────────────────────────────────────────────────────────────────────────
# Test Payload
# ────────────────────────────────────────────────────────────────────────────

"""
curl -X POST http://localhost:8000/api/events \\
  -H "Content-Type: application/json" \\
  -d '{
    "encrypted": false,
    "data": {
      "asset_id": "prop_123",
      "session_id": "550e8400-e29b-41d4-a716-446655440000",
      "page_url": "https://example.com/products",
      "entry_page": "https://example.com",
      "exit_page": null,
      "utm_params": {
        "utm_source": "google",
        "utm_medium": "cpc",
        "utm_campaign": "summer_sale"
      },
      "device_info": {
        "browser": "Chrome",
        "os": "Windows",
        "device_type": "Desktop"
      },
      "scroll_depth": 75,
      "time_on_page": 120,
      "events": [
        {
          "type": "page_view",
          "data": {
            "location": "https://example.com/products",
            "title": "Products",
            "timestamp": 1234567890
          }
        },
        {
          "type": "click",
          "data": {
            "x": 100,
            "y": 200,
            "timestamp": 1234567891
          }
        },
        {
          "type": "web_vital",
          "data": {
            "name": "LCP",
            "value": 2.5,
            "rating": "good",
            "delta": 0.1,
            "id": "abc123",
            "entries": 1,
            "navigation_type": "navigation",
            "timestamp": 1234567892
          }
        }
      ]
    }
  }'
"""