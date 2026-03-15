"""
Analytics views for Unisights event collection.
"""
 
import logging
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from datetime import datetime
 
from unisights import UnisightsOptions, UnisightsPayload
from unisights.django import unisights_django
 
logger = logging.getLogger(__name__)
 
 
# ────────────────────────────────────────────────────────────────────────────
# Event Handler
# ────────────────────────────────────────────────────────────────────────────
 
async def process_unisights_event(payload: UnisightsPayload, request) -> None:
    """Process Unisights analytics event.
    
    Args:
        payload: Parsed and validated UnisightsPayload
        request: Django request object
    """
    data = payload.data
    
    logger.info("=" * 50)
    logger.info("Analytics Event Received")
    logger.info("=" * 50)
    logger.info(f"Asset ID: {data.asset_id}")
    logger.info(f"Session ID: {data.session_id}")
    logger.info(f"Page URL: {data.page_url}")
    logger.info(f"Entry Page: {data.entry_page}")
    if data.exit_page:
        logger.info(f"Exit Page: {data.exit_page}")
    
    # Device information
    logger.info(f"Browser: {data.device_info.browser}")
    logger.info(f"OS: {data.device_info.os}")
    logger.info(f"Device Type: {data.device_info.device_type}")
    
    # Engagement metrics
    logger.info(f"Scroll Depth: {data.scroll_depth}%")
    logger.info(f"Time on Page: {data.time_on_page}s")
    
    # UTM Tracking
    if data.utm_params.utm_source:
        logger.info("UTM Parameters:")
        logger.info(f"  Source: {data.utm_params.utm_source}")
        logger.info(f"  Medium: {data.utm_params.utm_medium}")
        logger.info(f"  Campaign: {data.utm_params.utm_campaign}")
        if data.utm_params.utm_term:
            logger.info(f"  Term: {data.utm_params.utm_term}")
        if data.utm_params.utm_content:
            logger.info(f"  Content: {data.utm_params.utm_content}")
    
    # Process events
    logger.info(f"\nProcessing {len(data.events)} events:")
    logger.info("-" * 50)
    
    for idx, event in enumerate(data.events, 1):
        logger.info(f"\nEvent {idx}: {event.type.upper()}")
        
        if event.type == "page_view":
            title = event.data.get('title', 'N/A')
            location = event.data.get('location', 'N/A')
            logger.info(f"  Title: {title}")
            logger.info(f"  Location: {location}")
            
        elif event.type == "click":
            x = event.data.get('x', 0)
            y = event.data.get('y', 0)
            logger.info(f"  Position: ({x}, {y})")
            
        elif event.type == "web_vital":
            name = event.data.get('name', 'N/A')
            value = event.data.get('value', 0)
            rating = event.data.get('rating', 'N/A')
            logger.info(f"  Metric: {name}")
            logger.info(f"  Value: {value:.2f}ms")
            logger.info(f"  Rating: {rating}")
            
        elif event.type == "error":
            message = event.data.get('message', 'N/A')
            source = event.data.get('source', 'N/A')
            lineno = event.data.get('lineno', 0)
            colno = event.data.get('colno', 0)
            logger.error(f"  Message: {message}")
            logger.error(f"  Source: {source} ({lineno}:{colno})")
            
        elif event.type == "custom":
            name = event.data.get('name', 'N/A')
            custom_data = event.data.get('data', '{}')
            logger.info(f"  Name: {name}")
            logger.info(f"  Data: {custom_data}")
    
    logger.info("=" * 50)
    
    # TODO: Save to database
    # from .models import AnalyticsSession, AnalyticsEvent
    # session, created = AnalyticsSession.objects.get_or_create(
    #     session_id=data.session_id,
    #     defaults={
    #         'asset_id': data.asset_id,
    #         'page_url': data.page_url,
    #         'entry_page': data.entry_page,
    #         'exit_page': data.exit_page,
    #         'browser': data.device_info.browser,
    #         'os': data.device_info.os,
    #         'scroll_depth': data.scroll_depth,
    #         'time_on_page': data.time_on_page,
    #     }
    # )
    # for event in data.events:
    #     AnalyticsEvent.objects.create(
    #         session=session,
    #         event_type=event.type,
    #         event_data=event.data
    #     )
    
    # TODO: Send to analytics service
    # analytics_client.send_events(data)
 
 
# ────────────────────────────────────────────────────────────────────────────
# Views
# ────────────────────────────────────────────────────────────────────────────
 
@require_http_methods(["GET"])
def health_check(request):
    """Health check endpoint."""
    return JsonResponse({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    })
 
 
# Configure Unisights
unisights_config = UnisightsOptions(
    path="/api/events/",
    handler=process_unisights_event,
    validate_schema=True,
    validate_required_fields=True,
    max_payload_size=5 * 1024 * 1024,  # 5MB
    debug=True
)
 
# Create Unisights view
unisights_view = unisights_django(unisights_config)
 
# Export as handle_unisights_event
handle_unisights_event = unisights_view