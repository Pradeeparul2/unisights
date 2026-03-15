# Unisights Python - Complete Framework Integration Summary

## 📦 What's Included

This package provides complete, production-ready integration of the Unisights event collection system with three major Python web frameworks:

### 1. **FastAPI** (`fastapi.py`)

- Modern async-first ASGI integration
- Full type hints and automatic validation
- OpenAPI documentation support
- CORS middleware integration
- Best for: Modern APIs, high performance

### 2. **Flask** (`flask.py`)

- Lightweight blueprint-based integration
- Background queue support for async handlers
- Simple but powerful
- Best for: Microservices, quick prototypes

### 3. **Django** (`django.py`)

- Full-featured view integration
- Sync view support (Django 3.0+)
- Async view support (Django 4.1+)
- CSRF exempt and CORS ready
- Best for: Large applications, complex systems

---

## 🎯 Quick Start

### FastAPI

```python
from fastapi import FastAPI
from unisights import UnisightsOptions
from unisights.fastapi import unisights_fastapi

app = FastAPI()

async def handle_event(payload, request):
    print(f"Session: {payload.data.session_id}")
    print(f"Events: {len(payload.data.events)}")

options = UnisightsOptions(
    path="/api/events",
    handler=handle_event,
    validate_schema=True
)

router = unisights_fastapi(options)
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

**Run:**

```bash
pip install fastapi uvicorn
python app.py
```

### Flask

```python
from flask import Flask
from unisights import UnisightsOptions
from unisights.flask import unisights_flask

app = Flask(__name__)

async def handle_event(payload, request):
    print(f"Session: {payload.data.session_id}")
    print(f"Events: {len(payload.data.events)}")

options = UnisightsOptions(
    path="/api/events",
    handler=handle_event,
    validate_schema=True
)

bp = unisights_flask(options)
app.register_blueprint(bp)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
```

**Run:**

```bash
pip install flask flask-cors
python app.py
```

### Django

```python
# urls.py
from django.urls import path
from unisights import UnisightsOptions
from unisights.django import unisights_django

async def handle_event(payload, request):
    print(f"Session: {payload.data.session_id}")
    print(f"Events: {len(payload.data.events)}")

options = UnisightsOptions(
    handler=handle_event,
    validate_schema=True
)

urlpatterns = [
    path("api/events/", unisights_django(options))
]
```

**Run:**

```bash
pip install django django-cors-headers
python manage.py runserver
```

---

## 🔧 Configuration Options

All frameworks use the same `UnisightsOptions`:

```python
from unisights import UnisightsOptions

options = UnisightsOptions(
    # Routing
    path="/api/events",              # Default: "/events"

    # Handler
    handler=my_async_handler,        # Optional: callable

    # Validation
    validate_schema=True,            # Validate event types
    validate_required_fields=True,   # Require all fields

    # Security
    max_payload_size=5*1024*1024,   # Max 5MB
    allow_origins=["*"],             # CORS origins

    # Debugging
    debug=True                       # Verbose logging
)
```

---

## 📊 Payload Structure

The payload received by your handler:

```python
UnisightsPayload {
    data: UnisightsData {
        asset_id: str                    # Your property/app ID
        session_id: str                  # UUID v4 session identifier
        page_url: str                    # Current page URL
        entry_page: str                  # First page in session
        exit_page: str | None            # Last page before exit
        utm_params: UtmParams {
            utm_source: str | None
            utm_medium: str | None
            utm_campaign: str | None
            utm_term: str | None
            utm_content: str | None
            custom_params: dict
        }
        device_info: DeviceInfo {
            browser: str                 # e.g., "Chrome"
            os: str                      # e.g., "Windows"
            device_type: str             # "Desktop" | "Mobile" | "Tablet"
        }
        scroll_depth: int                # 0-100 percent
        time_on_page: int                # Seconds
        events: UnisightsEvent[] {       # List of events
            type: str                    # "page_view" | "click" | "web_vital" | "custom" | "error"
            data: dict                   # Event-specific data
        }
    }
    encrypted: bool                  # Whether payload is encrypted
}
```

---

## 🎨 Handler Examples

### Example 1: Simple Logging

```python
async def log_events(payload, request):
    """Log all received events."""
    data = payload.data
    print(f"Session {data.session_id}: {len(data.events)} events")
    for event in data.events:
        print(f"  - {event.type}")
```

### Example 2: Database Storage

```python
async def save_to_database(payload, request):
    """Save events to MongoDB."""
    from motor.motor_asyncio import AsyncMongoClient

    client = AsyncMongoClient()
    db = client["analytics"]

    await db.sessions.insert_one({
        "session_id": payload.data.session_id,
        "asset_id": payload.data.asset_id,
        "page_url": payload.data.page_url,
        "events": [e.to_dict() for e in payload.data.events],
        "timestamp": datetime.utcnow()
    })
```

### Example 3: Analytics Service

```python
async def send_to_analytics(payload, request):
    """Send events to external analytics service."""
    import httpx

    async with httpx.AsyncClient() as client:
        await client.post(
            "https://api.analytics.service/events",
            json={
                "session_id": payload.data.session_id,
                "events": [e.to_dict() for e in payload.data.events]
            }
        )
```

### Example 4: Conditional Processing

```python
async def smart_handler(payload, request):
    """Process events based on type."""
    data = payload.data

    for event in data.events:
        if event.type == "error":
            # Send errors to error tracking
            await send_to_sentry(event)

        elif event.type == "web_vital":
            # Send vitals to performance monitoring
            await send_to_performance_monitor(event)

        elif event.type == "click":
            # Log user interactions
            await log_interaction(event)
```

---

## 🔄 Request/Response Flow

### Request

```
Client (Browser)
    ↓
POST /api/events
Content-Type: application/json
{
    "encrypted": false,
    "data": { ... }
}
```

### Validation Steps

```
1. Content-Type Check (application/json)
2. Body Size Check (≤ max_payload_size)
3. JSON Parsing
4. Schema Validation
5. Required Fields Check
6. Event Type Validation
7. Handler Execution
```

### Response

```
Success (200/202):
{
    "status": "received",
    "session_id": "550e8400-e29b-41d4-a716-446655440000"
}

Error (400-500):
{
    "error": "Validation failed: scroll_depth must be 0-100"
}
```

---

## 🚨 Error Handling

### HTTP Status Codes

| Code    | Meaning       | Cause                           |
| ------- | ------------- | ------------------------------- |
| **200** | Success       | Event processed                 |
| **202** | Accepted      | Event queued (Flask background) |
| **400** | Bad Request   | Invalid JSON syntax             |
| **413** | Too Large     | Payload exceeds limit           |
| **415** | Unsupported   | Wrong content-type              |
| **422** | Unprocessable | Validation failed               |
| **500** | Server Error  | Handler error (debug=True)      |

### Example Error Response

```json
{
  "error": "session_id: Invalid UUID format"
}
```

---

## 📋 Event Types

### 1. Page View

```python
{
    "type": "page_view",
    "data": {
        "location": "https://example.com/products",
        "title": "Products Page",
        "timestamp": 1234567890
    }
}
```

### 2. Click

```python
{
    "type": "click",
    "data": {
        "x": 100,
        "y": 200,
        "timestamp": 1234567890
    }
}
```

### 3. Web Vital (Core Web Vitals)

```python
{
    "type": "web_vital",
    "data": {
        "name": "LCP",  # FCP, LCP, CLS, INP, TTFB, FID
        "value": 2.5,
        "rating": "good",  # good, needs-improvement, poor
        "delta": 0.1,
        "id": "abc123",
        "entries": 1,
        "navigation_type": "navigation",
        "timestamp": 1234567890
    }
}
```

### 4. Custom

```python
{
    "type": "custom",
    "data": {
        "name": "user_signup",
        "data": '{"plan": "pro", "tier": "premium"}',
        "timestamp": 1234567890
    }
}
```

### 5. Error

```python
{
    "type": "error",
    "data": {
        "message": "TypeError: Cannot read property 'length' of undefined",
        "source": "https://example.com/app.js",
        "lineno": 42,
        "colno": 15,
        "timestamp": 1234567890
    }
}
```

---

## 🔐 CORS Configuration

### FastAPI

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)
```

### Flask

```python
from flask_cors import CORS

CORS(app, resources={
    r"/api/events": {
        "origins": ["https://yourdomain.com"],
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})
```

### Django

```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "https://yourdomain.com",
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    # ...
]
```

---

## 📚 Complete File Structure

```
python/src/
├── __init__.py                 # Package exports
├── types.py                    # Type definitions
├── validator.py                # Validation logic
├── collector.py                # Event processing
├── config.py                   # Configuration
├── fastapi.py                  # FastAPI integration
├── flask.py                    # Flask integration
└── django.py                   # Django integration

examples/
├── fastapi_example.py          # FastAPI example
├── flask_example.py            # Flask example
└── django_example.py           # Django example

tests/
└── test_validator.py           # Test suite
```

---

## 🧪 Testing

### Unit Testing

```python
import pytest
from unisights.validator import validate_unisights_payload
from uuid import uuid4

def test_valid_payload():
    """Test valid event payload."""
    payload = validate_unisights_payload({
        "encrypted": False,
        "data": {
            "asset_id": "prop_123",
            "session_id": str(uuid4()),
            "page_url": "https://example.com",
            "entry_page": "https://example.com",
            "events": []
        }
    })
    assert payload.data.asset_id == "prop_123"

def test_invalid_uuid():
    """Test invalid session ID."""
    with pytest.raises(ValidationError):
        validate_unisights_payload({
            "data": {
                "asset_id": "prop_123",
                "session_id": "not-a-uuid",  # Invalid
                "page_url": "https://example.com",
                "entry_page": "https://example.com"
            }
        })
```

### Integration Testing

```python
import httpx

async def test_fastapi_endpoint():
    """Test FastAPI event endpoint."""
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/events",
            json={
                "encrypted": False,
                "data": {
                    "asset_id": "test_prop",
                    "session_id": "550e8400-e29b-41d4-a716-446655440000",
                    "page_url": "https://example.com",
                    "entry_page": "https://example.com",
                    "events": []
                }
            }
        )
        assert response.status_code == 200
        assert response.json()["status"] == "received"
```

---

## 🚀 Deployment

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# FastAPI
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]

# Flask
# CMD ["gunicorn", "app:app", "-b", "0.0.0.0:5000"]

# Django
# CMD ["gunicorn", "django_project.wsgi", "-b", "0.0.0.0:8000"]
```

### Production Settings

FastAPI (Gunicorn + Uvicorn):

```bash
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

Flask (Gunicorn):

```bash
gunicorn app:app -w 4 --bind 0.0.0.0:5000
```

Django (Gunicorn):

```bash
gunicorn django_project.wsgi -w 4 --bind 0.0.0.0:8000
```

---

## 📈 Performance Tips

1. **Use async handlers** - Better than sync
2. **Batch database inserts** - Insert multiple events at once
3. **Use connection pooling** - For databases
4. **Enable compression** - gzip response body
5. **Cache device detection** - Don't re-detect per request
6. **Monitor queue size** - Keep Flask background queue healthy

---

## 🔗 Related Resources

- **Unisights Node.js**: https://github.com/pradeeparul2/unisights-node
- **FastAPI Docs**: https://fastapi.tiangolo.com
- **Flask Docs**: https://flask.palletsprojects.com
- **Django Docs**: https://docs.djangoproject.com

---

## 📞 Support

For issues, questions, or contributions:

1. Check the example files
2. Review the test suite
3. See framework_comparison.md for architecture details
4. Check validator_implementation_guide.md for validation rules

---

## ✅ Checklist for Production

- [ ] Handler error handling implemented
- [ ] Logging configured
- [ ] CORS configured for your domain
- [ ] Database connection pooling set up
- [ ] Rate limiting implemented (if needed)
- [ ] Monitoring/alerting configured
- [ ] Tests passing
- [ ] Load tested
- [ ] Security audit completed
- [ ] Deployment documented

---

## Summary

You now have **production-ready** Unisights integration for:

✅ **FastAPI** - Modern, fast, async-first  
✅ **Flask** - Simple, lightweight, with async support  
✅ **Django** - Full-featured, with sync and async support

Each with:

- ✅ Complete type definitions
- ✅ Comprehensive validation
- ✅ Error handling
- ✅ CORS support
- ✅ Example implementations
- ✅ Full documentation

Happy tracking! 🎉
