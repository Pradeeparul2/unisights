# Unisights Python

Unisights Python package provides a lightweight event collection endpoint for Python web frameworks.
It allows your backend to receive analytics events from the Unisights client library and process them using a custom handler.

The package exposes a **single POST API endpoint** that receives event payloads and forwards them to your handler for processing.

Supported frameworks:

- FastAPI
- Flask
- Django
- ASGI-compatible frameworks (Starlette, Quart, etc.)

---

# Features

- Simple event ingestion endpoint
- Works with multiple Python frameworks
- Async + sync handler support
- Framework-agnostic core
- Easy integration with analytics pipelines (Kafka, DB, queue, etc.)

---

# Installation

```bash
pip install unisights
```

---

# Event Payload Example

The endpoint expects a JSON payload.

```json
{
  "type": "event",
  "name": "page_view",
  "session_id": "abc123",
  "timestamp": 1710000000,
  "data": {
    "url": "/home",
    "referrer": "google.com"
  }
}
```

---

# FastAPI Integration

```python
from fastapi import FastAPI
from unisights.fastapi import unisights_fastapi

app = FastAPI()

async def handler(payload, request):
    print(payload)

app.include_router(
    unisights_fastapi("/collect/event", handler)
)
```

Start server:

```bash
uvicorn main:app --reload
```

Endpoint:

```
POST /collect/event
```

---

# Flask Integration

```python
from flask import Flask
from unisights.flask import unisights_flask

app = Flask(__name__)

async def handler(payload, request):
    print(payload)

app.register_blueprint(
    unisights_flask("/collect/event", handler)
)

app.run()
```

Endpoint:

```
POST /collect/event
```

---

# Django Integration

Add the route in your Django project.

```python
from django.urls import path
from unisights.django import unisights_django

async def handler(payload, request):
    print(payload)

urlpatterns = [
    path("collect/event", unisights_django(handler))
]
```

Endpoint:

```
POST /collect/event
```

---

# Using with Message Queues or Databases

Your handler can forward events to any system.

Example: Kafka

```python
async def handler(payload, request):
    kafka_producer.send("analytics-events", payload)
```

Example: Save to database

```python
async def handler(payload, request):
    db.events.insert_one(payload)
```

---

# Project Structure

```
unisights/
├── collector.py
├── fastapi.py
├── flask.py
├── django.py
└── asgi.py
```

- `collector.py` → Core event processor
- `fastapi.py` → FastAPI adapter
- `flask.py` → Flask adapter
- `django.py` → Django adapter
- `asgi.py` → Generic ASGI middleware

---

# Development

Clone repository:

```bash
git clone https://github.com/pradeeparul/unisights
cd unisights-python
```

Install dependencies:

```bash
pip install -e .
```

Build package:

```bash
python -m build
```

Publish to PyPI:

```bash
twine upload dist/*
```

---

# License

MIT License

---

# Links

GitHub
https://github.com/pradeeparul2/unisights
