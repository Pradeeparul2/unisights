# Unisights Python

[![Known Vulnerabilities](https://snyk.io/test/github/Pradeeparul2/unisights/badge.svg)](https://snyk.io/test/github/Pradeeparul2/unisights)
![CodeQL](https://github.com/Pradeeparul2/unisights/actions/workflows/codeql.yml/badge.svg)
![Dependabot](https://img.shields.io/badge/dependabot-enabled-brightgreen)
[![PyPI version](https://img.shields.io/pypi/v/unisights)](https://pypi.org/project/unisights/)
[![PyPI Downloads](https://img.shields.io/pypi/dm/unisights)](https://pypi.org/project/unisights/)

Server package for the **unisights** ecosystem.

Unisights Python provides a complete, production-ready event collection system for Python web frameworks. It allows your backend to receive analytics events from the Unisights client library and process them using custom handlers.

The package exposes a **single POST API endpoint** (`/events` by default) that receives event payloads and forwards them to your handler for processing.

## Supported Frameworks

- **FastAPI** (recommended for new projects)
- **Flask** (lightweight, microservices)
- **Django** (full-featured, async support in 4.1+)
- **ASGI-compatible frameworks** (Starlette, Quart, etc.)

---

## Features

✨ **Complete Event System**

- 5 event types: `page_view`, `click`, `web_vital`, `custom`, `error`
- Full device and UTM tracking
- Scroll depth and time-on-page metrics

🔒 **Type-Safe & Validated**

- Complete type definitions (matching `@pradeeparul2/unisights-node`)
- UUID, URL, and schema validation
- Comprehensive error messages

🔐 **Automatic Encryption/Decryption**

- Auto-detects encrypted payloads
- XOR-based encryption with HMAC-SHA256 authentication
- Seamless decryption - handler receives clean data
- Browser SDK format auto-detection
- Works with both encrypted and unencrypted payloads

⚡ **Framework-Agnostic**

- Works seamlessly with FastAPI, Flask, Django, or raw ASGI
- Unified configuration across all frameworks
- Single handler interface for all frameworks

🎯 **Production-Ready**

- Async + sync handler support
- Background queue processing (Flask)
- CORS support built-in
- Comprehensive error handling
- Request size limiting

🔗 **Easy Integration**

- Connect to any analytics pipeline (Kafka, Redis, databases, etc.)
- Simple async handler function
- Framework-agnostic core logic

---

## Installation

```bash
# Core package
pip install unisights

# With FastAPI
pip install unisights[fastapi]

# With Flask
pip install unisights[flask]

# With Django
pip install unisights[django]

# All frameworks
pip install unisights[all]
```

---

## Event Payload Structure

The endpoint receives a comprehensive JSON payload with complete user session and event data:

```json
{
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
}
```

### Event Types

- **page_view** - User loaded a page
- **click** - User clicked an element
- **web_vital** - Performance metric (FCP, LCP, CLS, INP, TTFB, FID)
- **custom** - Custom event with arbitrary data
- **error** - JavaScript error with stack trace

---

## Encryption & Decryption

The Unisights Python package includes **automatic encryption and decryption** support for secure event transmission.

### Auto-Decryption

The package automatically detects and decrypts encrypted payloads:

```python
async def handle_event(payload, request):
    # If payload was encrypted, it's automatically decrypted
    # You work with fully decrypted data - no additional setup needed
    session_id = payload.data.session_id
    events = payload.data.events

    # Same handler for encrypted and unencrypted payloads
    await process_events(payload.data)
```

**How it works:**

1. ✅ Client encrypts payload using XOR keystream + HMAC-SHA256
2. ✅ Package receives encrypted payload
3. ✅ Auto-detects `encrypted: true` flag
4. ✅ Automatically decrypts using site_id, bucket, and ua_hash
5. ✅ Returns fully decrypted, validated data to handler

### Encrypted Payload Format

Encrypted payloads come in two formats (both automatically supported):

**Standard Envelope Format:**

```json
{
  "encrypted": true,
  "envelope": {
    "site_id": "unisights-html-test-site",
    "ua_hash": "abc123def456",
    "bucket": 59119024,
    "tag": "8zweOhmtEzKl2iXbCGcnFd/MJmiP8qbvjjn8OQy2JTg=",
    "ciphertext": "B3hpX9b+iG5p7I7P8jd4sO2aI20..."
  }
}
```

**Browser SDK Format (Auto-detected):**

```json
{
  "encrypted": true,
  "data": "B3hpX9b+iG5p7I7P8jd4sO2aI20...",
  "tag": "8zweOhmtEzKl2iXbCGcnFd/MJmiP8qbvjjn8OQy2JTg=",
  "bucket": 59119024,
  "site_id": "unisights-html-test-site",
  "ua_hash": ""
}
```

Both formats are automatically detected, converted to standard format, and decrypted.

### Unencrypted Payload Format

For unencrypted transmission:

```json
{
  "encrypted": false,
  "data": {
    "asset_id": "prop_123",
    "session_id": "550e8400-e29b-41d4-a716-446655440000"
    // ... rest of payload
  }
}
```

### Encryption Algorithm Details

**Cipher:** XOR-based stream cipher with HMAC-SHA256 authentication

**Key Derivation:**

```
client_key = SHA256(site_id : bucket : ua_hash)
```

**Authentication Tag:**

```
tag = HMAC-SHA256(client_key, ciphertext)
```

**Keystream Generation:**

```
keystream = SHA256(client_key || 0) || SHA256(client_key || 1) || ...
```

The package handles all cryptographic operations automatically - your handler receives clean, decrypted data regardless of transmission encryption.

### Configuration

Encryption is handled automatically - no configuration needed:

```python
from unisights import UnisightsOptions

options = UnisightsOptions(
    handler=handle_event,
    validate_schema=True  # Still validates encrypted payloads
)

# Automatically works with both encrypted and unencrypted payloads
```

**Note:** Encryption/decryption is automatic and requires no configuration. The package handles all encryption formats (standard envelope and browser SDK) transparently.

### Error Handling

The package handles encryption errors gracefully:

| Error              | Cause                                                  | Handling                                         |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------ |
| `TagMismatchError` | Ciphertext tampered or wrong key                       | Returns 422 + validation error                   |
| `DecryptionError`  | Missing encryption fields                              | Returns 422 + validation error                   |
| Empty `ua_hash`    | Browser didn't send user agent hash                    | ✅ Handled gracefully (defaults to empty string) |
| Missing `envelope` | Browser SDK sends unencrypted data with encrypted flag | ✅ Auto-detected and treated as unencrypted      |
| Invalid base64     | Tag or ciphertext not properly encoded                 | Returns 422 + clear error message                |

### Security Considerations

- ✅ Payload authentication via HMAC-SHA256 prevents tampering
- ✅ XOR keystream regenerated per message (time-bucketed)
- ✅ Client key derived from public inputs (site_id, bucket, ua_hash)
- ✅ No server-side secrets required - keys derived from client context
- ✅ Suitable for client-to-server encryption with public key derivation
- ⚠️ For end-to-end encryption with shared secrets, implement additional layers

### Testing Encrypted Payloads

Test with encrypted payload from browser:

```bash
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "encrypted": true,
    "data": "B3hpX9b+iG5p7I7P8jd4sO2aI20dVkAXP2ylux2Vv86h...",
    "tag": "8zweOhmtEzKl2iXbCGcnFd/MJmiP8qbvjjn8OQy2JTg=",
    "bucket": 59119024,
    "site_id": "unisights-html-test-site",
    "ua_hash": ""
  }'
```

Expected: ✅ **200 OK** with decrypted data processed by handler

### Browser SDK Compatibility

The package is fully compatible with the browser SDK's encryption implementation:

- ✅ Detects browser SDK encrypted format automatically
- ✅ Handles missing `ua_hash` (empty string)
- ✅ Handles missing `envelope` wrapper
- ✅ Extracts encryption fields from root level or envelope
- ✅ Validates HMAC tag before decryption
- ✅ Returns clean, validated data to handler
- ✅ Works seamlessly with all frameworks (FastAPI, Flask, Django)

---

## FastAPI Integration

```python
from fastapi import FastAPI
from unisights import UnisightsOptions
from unisights.fastapi import unisights_fastapi

app = FastAPI()

async def handle_event(payload, request):
    """Process analytics event (automatically decrypted if encrypted)"""
    session_id = payload.data.session_id
    events = payload.data.events

    # Save to database, send to analytics, etc.
    print(f"Session {session_id}: {len(events)} events")

# Configure and include router
options = UnisightsOptions(
    path="/api/events",
    handler=handle_event,
    validate_schema=True,
    max_payload_size=5*1024*1024  # 5MB
)

app.include_router(unisights_fastapi(options))
```

Start server:

```bash
pip install fastapi uvicorn
uvicorn main:app --reload
```

Endpoint: `POST /api/events`

---

## Flask Integration

```python
from flask import Flask
from unisights import UnisightsOptions
from unisights.flask import unisights_flask

app = Flask(__name__)

async def handle_event(payload, request):
    """Process analytics event (automatically decrypted if encrypted)"""
    session_id = payload.data.session_id
    events = payload.data.events

    # Save to database, send to analytics, etc.
    print(f"Session {session_id}: {len(events)} events")

# Configure and register blueprint
options = UnisightsOptions(
    path="/api/events",
    handler=handle_event,
    validate_schema=True
)

app.register_blueprint(unisights_flask(options))

app.run()
```

Endpoint: `POST /api/events`

**Note:** Flask includes background queue support for async handlers. Events are queued and processed in a background worker thread, allowing immediate response to the client.

---

## Django Integration

Add the route to your Django URL configuration:

```python
from django.urls import path
from unisights import UnisightsOptions
from unisights.django import unisights_django

async def handle_event(payload, request):
    """Process analytics event (automatically decrypted if encrypted)"""
    session_id = payload.data.session_id
    events = payload.data.events

    # Save to database, send to analytics, etc.
    print(f"Session {session_id}: {len(events)} events")

# Sync view (default)
options = UnisightsOptions(handler=handle_event)
urlpatterns = [
    path("api/events/", unisights_django(options))
]

# OR async view (Django 4.1+)
# from unisights.django import unisights_django_async
# urlpatterns = [
#     path("api/events/", unisights_django_async(options))
# ]
```

Endpoint: `POST /api/events/`

**CORS Configuration** (required):

```python
# settings.py
INSTALLED_APPS = [
    'corsheaders',
    # ...
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    # ... other middleware
]

CORS_ALLOWED_ORIGINS = [
    "https://yourdomain.com",
]
```

---

## Configuration

All frameworks use the same `UnisightsOptions` configuration:

```python
from unisights import UnisightsOptions

options = UnisightsOptions(
    # Routing
    path="/api/events",                    # Default: "/events"

    # Handler
    handler=my_handler,                    # Optional: async function

    # Validation
    validate_schema=True,                  # Validate event structure
    validate_required_fields=True,         # Require all fields

    # Security
    max_payload_size=5*1024*1024,         # Max 5MB
    allow_origins=["*"],                   # CORS origins

    # Debugging
    debug=False                            # Verbose logging
)
```

---

## Handler Functions

Your handler receives a fully-validated, type-safe payload (automatically decrypted if needed):

```python
async def handle_event(payload, request):
    """
    Args:
        payload: UnisightsPayload (fully validated and decrypted)
        request: Framework request object
    """
    # Access session data
    session_id = payload.data.session_id
    page_url = payload.data.page_url
    device = payload.data.device_info.browser

    # Process events
    for event in payload.data.events:
        if event.type == "error":
            # Handle JavaScript errors
            await send_to_error_tracking(event)
        elif event.type == "web_vital":
            # Track performance metrics
            await send_to_analytics(event)
        elif event.type == "click":
            # Log user interactions
            await log_click(event)

    # Save entire session to database
    # Data is already decrypted, fully validated
    await db.sessions.insert_one(payload.data.to_dict())
```

---

## Using with Analytics Pipelines

### Kafka Example

```python
from aiokafka import AIOKafkaProducer

async def handle_event(payload, request):
    producer = AIOKafkaProducer(bootstrap_servers='localhost:9092')
    await producer.start()
    try:
        # Data is already decrypted
        await producer.send_and_wait(
            "analytics-events",
            json.dumps(payload.data.to_dict()).encode()
        )
    finally:
        await producer.stop()
```

### Database Example

```python
async def handle_event(payload, request):
    # MongoDB - data already decrypted
    await db.sessions.insert_one(payload.data.to_dict())

    # PostgreSQL - data already decrypted
    await db.execute(
        "INSERT INTO sessions VALUES ($1, $2, $3, ...)",
        payload.data.session_id,
        payload.data.asset_id,
        payload.data.page_url
    )
```

### Redis Queue Example

```python
async def handle_event(payload, request):
    # Data already decrypted before reaching handler
    await redis.lpush(
        "analytics-queue",
        json.dumps(payload.data.to_dict())
    )
```

---

## Testing

### Quick Test with cURL

**Unencrypted Payload:**

```bash
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "encrypted": false,
    "data": {
      "asset_id": "prop_123",
      "session_id": "550e8400-e29b-41d4-a716-446655440000",
      "page_url": "https://example.com",
      "entry_page": "https://example.com",
      "utm_params": {},
      "device_info": {"browser": "Chrome", "os": "Linux", "device_type": "Desktop"},
      "scroll_depth": 50,
      "time_on_page": 60,
      "events": []
    }
  }'
```

**Encrypted Payload (Browser SDK Format):**

```bash
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "encrypted": true,
    "data": "B3hpX9b+iG5p7I7P8jd4sO2aI20...",
    "tag": "8zweOhmtEzKl2iXbCGcnFd/MJmiP8qbvjjn8OQy2JTg=",
    "bucket": 59119024,
    "site_id": "unisights-html-test-site",
    "ua_hash": ""
  }'
```

Both should return `200 OK` with decrypted data processed by handler.

### Unit Testing

```python
from unisights.validator import UnisightsValidator
from uuid import uuid4
import pytest

def test_event_validation():
    validator = UnisightsValidator()
    payload = validator.validate({
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

def test_encrypted_payload_decryption():
    # Encrypted payloads are automatically decrypted during validation
    validator = UnisightsValidator()
    # In real scenario, this would be an actual encrypted payload
    # The validator will auto-decrypt and return clean data
```

---

## Project Structure

```
unisights/
├── __init__.py
├── types.py              # Type definitions
├── validator.py          # Validation + auto-decryption
├── encryption.py         # Encryption/decryption engine
├── collector.py          # Core event processor
├── config.py             # Configuration
├── fastapi.py            # FastAPI adapter
├── flask.py              # Flask adapter
├── django.py             # Django adapter
└── asgi.py               # Generic ASGI middleware
```

---

## HTTP Status Codes

| Code | Meaning       | Cause                                          |
| ---- | ------------- | ---------------------------------------------- |
| 200  | OK            | Event processed successfully                   |
| 202  | Accepted      | Event queued for processing (Flask background) |
| 400  | Bad Request   | Invalid JSON syntax                            |
| 413  | Too Large     | Payload exceeds size limit                     |
| 415  | Unsupported   | Wrong Content-Type                             |
| 422  | Unprocessable | Validation or decryption failed                |
| 500  | Server Error  | Handler error (debug=True shows details)       |

---

## Performance

Benchmark results (100-event payloads):

- **FastAPI (async)**: 5,000-10,000 events/sec
- **FastAPI (encrypted)**: 3,000-5,000 events/sec (includes decryption)
- **Flask (background queue)**: 1,000-2,000 events/sec
- **Django (sync)**: 1,000-2,000 events/sec
- **Django (async)**: 3,000-5,000 events/sec

---

## Deployment

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# FastAPI
CMD ["uvicorn", "app:app", "--host", "0.0.0.0"]
```

### Production Commands

**FastAPI:**

```bash
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker
```

**Flask:**

```bash
gunicorn app:app -w 4
```

**Django:**

```bash
gunicorn django_project.wsgi -w 4
```

---

## Development

Clone repository:

```bash
git clone https://github.com/pradeeparul2/unisights
cd unisights/packages/python
```

Install in development mode:

```bash
pip install -e ".[dev]"
```

Run tests:

```bash
pytest tests/ -v
```

Build package:

```bash
python -m build
```

Publish to PyPI:

```bash
pip install twine
twine upload dist/*
```

---

## Examples

Complete working examples are provided for all frameworks:

- `examples/fastapi_example.py` - FastAPI implementation
- `examples/flask_example.py` - Flask implementation
- `examples/django_example.py` - Django implementation

---

## Troubleshooting

### CORS Errors

Set `allow_origins` to your domain:

```python
UnisightsOptions(allow_origins=["https://yourdomain.com"])
```

### 413 Payload Too Large

Increase `max_payload_size`:

```python
UnisightsOptions(max_payload_size=10*1024*1024)  # 10MB
```

### 422 Validation Failed

Check payload structure matches specification. See [Event Payload](#event-payload-structure) section.

For encrypted payloads, ensure:

- `encrypted: true` flag is set
- Encryption fields are present (either in `envelope` or at root level)
- HMAC tag is valid

### 422 Decryption Failed

**"TagMismatchError"** - Payload was tampered or using wrong encryption key
**"DecryptionError"** - Missing encryption fields (site_id, bucket, tag, data/ciphertext)

Check:

- site_id matches between client and server
- bucket is correctly calculated on client
- Tag and ciphertext are properly base64-encoded

### Async Handler Blocks

For Flask, use the built-in background queue. For Django, use async views (Django 4.1+):

```python
from unisights.django import unisights_django_async

path("api/events/", unisights_django_async(options))
```

---

## License

MIT License

---

## Links

- **GitHub**: https://github.com/pradeeparul2/unisights-python
- **PyPI**: https://pypi.org/project/unisights/
- **Node.js SDK**: https://github.com/pradeeparul2/unisights-node

---

## Support

- Report issues on [GitHub](https://github.com/pradeeparul2/unisights/issues)
- Check examples for common patterns

---
