"""
Simple Django app for Unisights e2e testing.
"""

import os
import sys
import json
import logging
from typing import Any

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_app_settings')

import django
from django.conf import settings
from django.urls import path
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.middleware.common import CommonMiddleware
from django.middleware.csrf import CsrfViewMiddleware
from django.contrib.sessions.middleware import SessionMiddleware

# ────────────────────────────────────────────────────────────────────────────
# CORS Middleware
# ────────────────────────────────────────────────────────────────────────────

class CORSMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        origin = request.META.get('HTTP_ORIGIN')
        allowed_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
        
        if origin in allowed_origins:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Credentials'] = 'true'
        else:
            response['Access-Control-Allow-Origin'] = '*'
        
        response['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type'
        
        return response

    def process_view(self, request, view_func, view_args, view_kwargs):
        if request.method == 'OPTIONS':
            response = JsonResponse({}, status=204)
            origin = request.META.get('HTTP_ORIGIN')
            if origin in ["http://localhost:3000", "http://127.0.0.1:3000"]:
                response['Access-Control-Allow-Origin'] = origin
                response['Access-Control-Allow-Credentials'] = 'true'
            else:
                response['Access-Control-Allow-Origin'] = '*'
            response['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
            response['Access-Control-Allow-Headers'] = 'Content-Type'
            return response
        return None

# Configure Django settings
if not settings.configured:
    settings.configure(
        DEBUG=True,
        SECRET_KEY='test-secret-key-for-e2e',
        USE_TZ=True,
        INSTALLED_APPS=[
            'django.contrib.contenttypes',
            'django.contrib.auth',
        ],
        MIDDLEWARE=[
            'django.middleware.common.CommonMiddleware',
            'django.middleware.csrf.CsrfViewMiddleware',
            'django.contrib.sessions.middleware.SessionMiddleware',
            'frameworks.django_app.CORSMiddleware',
        ],
        DATABASES={
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': ':memory:',
            }
        },
        ROOT_URLCONF=__name__,
        APPEND_SLASH=False,
        ALLOWED_HOSTS=['*'],
        CORS_ALLOWED_ORIGINS=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        CORS_ALLOW_CREDENTIALS=True,
    )

django.setup()

from unisights import UnisightsOptions, UnisightsPayload
from unisights.validator import UnisightsValidator, ValidationError
from unisights.collector import Unisights

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Event storage
events = []


def serialize_payload(payload: Any) -> Any:
    """Convert a payload object to JSON-serializable data."""
    if hasattr(payload, "model_dump"):
        return payload.model_dump()
    if hasattr(payload, "to_dict"):
        return payload.to_dict()
    if hasattr(payload, "dict"):
        return payload.dict()
    return payload


# ────────────────────────────────────────────────────────────────────────────
# Event Handler
# ────────────────────────────────────────────────────────────────────────────

async def handle_event(payload: UnisightsPayload, request: Any) -> None:
    """Handle Unisights analytics event."""
    print(f"[DEBUG] Received event: {payload}")
    events.append(serialize_payload(payload))


options = UnisightsOptions(
    path="/collect-django/event",
    handler=handle_event,
    debug=True,
)

collector = Unisights(handler=options.handler)
validator = UnisightsValidator(
    validate_schema=options.validate_schema,
    validate_required_fields=options.validate_required_fields,
    strict=True,
    max_payload_size=options.max_payload_size
)


# ────────────────────────────────────────────────────────────────────────────
# Django Views
# ────────────────────────────────────────────────────────────────────────────

@require_http_methods(["GET"])
def health_view(request):
    """Health check endpoint."""
    return JsonResponse({"status": "ok"})


@require_http_methods(["GET"])
def get_events_view(request):
    """Get events endpoint."""
    data = events[-1] if events else None
    serialized = serialize_payload(data) if data is not None else None
    return JsonResponse(serialized, safe=False)


@require_http_methods(["GET"])
def clear_events_view(request):
    """Clear events endpoint."""
    global events
    events = []
    return JsonResponse({"cleared": True})


@csrf_exempt
@require_http_methods(["POST"])
def collect_event_view(request):
    """Collect Unisights event."""
    try:
        # Parse JSON
        try:
            payload_dict = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        # Validate payload
        try:
            payload = validator.validate(payload_dict)
        except ValidationError as e:
            return JsonResponse({"error": f"{e.field}: {e.message}"}, status=422)

        # Process event
        try:
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(collector.process(payload, request))
            logger.info(f"Event processed: {payload.data.session_id}")
            return JsonResponse({
                "status": "received",
                "session_id": payload.data.session_id
            })
        except Exception as e:
            logger.error(f"Handler error: {e}", exc_info=True)
            status = 500 if options.debug else 202
            return JsonResponse({
                "status": "accepted" if status == 202 else "error",
                "session_id": payload.data.session_id
            }, status=status)

    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)


# ────────────────────────────────────────────────────────────────────────────
# URL Patterns
# ────────────────────────────────────────────────────────────────────────────

urlpatterns = [
    path('health', health_view),
    path('test/events', get_events_view),
    path('test/clear', clear_events_view),
    path('collect-django/event', collect_event_view),
]


# ────────────────────────────────────────────────────────────────────────────
# ASGI Application
# ────────────────────────────────────────────────────────────────────────────

from django.core.asgi import get_asgi_application

application = get_asgi_application()
asgi_app = application


