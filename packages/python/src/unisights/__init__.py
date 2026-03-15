"""
Unisights Python - Event collection system for FastAPI, Flask, Django, and ASGI

This package provides event collection endpoints for Python web frameworks,
receiving analytics data from the Unisights browser SDK.
"""

# Core types
from .types import (
    UnisightsPayload,
    UnisightsData,
    UnisightsEvent,
    UnisightsOptions,
    DeviceInfo,
    UtmParams,
    Handler,
)

# Validator
from .validator import (
    UnisightsValidator,
    ValidationError,
    validate_json_payload,
    validate_unisights_payload,
)

# Framework integrations
try:
    from .fastapi import unisights_fastapi
except ImportError:
    pass  # FastAPI not installed

try:
    from .flask import unisights_flask
except ImportError:
    pass  # Flask not installed

try:
    from .django import unisights_django, unisights_django_async
except ImportError:
    pass  # Django not installed

try:
    from .asgi import unisights_asgi
except ImportError:
    pass  # ASGI dependencies not installed

# Version
__version__ = "0.0.1-beta.12"

# Public API
__all__ = [
    # Types
    "UnisightsPayload",
    "UnisightsData",
    "UnisightsEvent",
    "UnisightsOptions",
    "DeviceInfo",
    "UtmParams",
    "Handler",
    # Validator
    "UnisightsValidator",
    "ValidationError",
    "validate_json_payload",
    "validate_unisights_payload",
    # Framework integrations
    "unisights_fastapi",
    "unisights_flask",
    "unisights_django",
    "unisights_django_async",
    "unisights_asgi",
]