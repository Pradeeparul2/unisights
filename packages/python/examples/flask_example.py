# examples/flask_example.py
"""
Complete Flask example with Unisights event collection.

Run:
    pip install flask
    python examples/flask_example.py

Then POST to:
    curl -X POST http://localhost:5000/api/events \\
      -H "Content-Type: application/json" \\
      -d '{"encrypted": false, "data": {...}}'
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from datetime import datetime
from typing import Optional

from unisights import UnisightsOptions, UnisightsPayload
from unisights.flask import unisights_flask

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
CORS(app)

# Configure app
app.config['JSON_SORT_KEYS'] = False
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB


# ────────────────────────────────────────────────────────────────────────────
# Event Handler
# ────────────────────────────────────────────────────────────────────────────

async def handle_unisights_event(payload: UnisightsPayload, request) -> None:
    """Process Unisights analytics event.
    
    Args:
        payload: Parsed and validated UnisightsPayload
        request: Flask request object
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
    # db.sessions.insert_one({
    #     "asset_id": data.asset_id,
    #     "session_id": data.session_id,
    #     "page_url": data.page_url,
    #     "events": [e.to_dict() for e in data.events],
    #     "timestamp": datetime.utcnow()
    # })
    
    # TODO: Send to analytics service
    # analytics_client.send_events(data)


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

# Register Unisights blueprint
unisights_bp = unisights_flask(unisights_config)
app.register_blueprint(unisights_bp)


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }), 200


@app.route('/', methods=['GET'])
def root():
    """API documentation."""
    return jsonify({
        "name": "Analytics API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "events": "/api/events (POST)"
        }
    }), 200


# ────────────────────────────────────────────────────────────────────────────
# Error Handlers
# ────────────────────────────────────────────────────────────────────────────

@app.errorhandler(Exception)
def handle_error(error):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {error}", exc_info=True)
    return jsonify({"error": "Internal server error"}), 500


@app.errorhandler(404)
def handle_not_found(error):
    """Handle 404 errors."""
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(405)
def handle_method_not_allowed(error):
    """Handle 405 errors."""
    return jsonify({"error": "Method not allowed"}), 405


# ────────────────────────────────────────────────────────────────────────────
# Before/After Hooks
# ────────────────────────────────────────────────────────────────────────────

@app.before_request
def log_request():
    """Log incoming request."""
    if request.path != '/health':
        logger.debug(f"{request.method} {request.path}")


@app.after_request
def log_response(response):
    """Log response."""
    if request.path != '/health':
        logger.debug(f"Response: {response.status_code}")
    return response


if __name__ == "__main__":
    logger.info("Starting Analytics API...")
    logger.info("Listen on: http://0.0.0.0:5000")
    logger.info("Unisights endpoint: POST /api/events")
    
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )


# ────────────────────────────────────────────────────────────────────────────
# Test Payload
# ────────────────────────────────────────────────────────────────────────────

"""
curl -X POST http://localhost:5000/api/events \\
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