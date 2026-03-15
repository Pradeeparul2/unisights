"""
Types and validation for unisights-python

Mirrors the structure from @pradeeparul2/unisights-node TypeScript definitions.
"""

from typing import Any, Dict, List, Literal, Optional, Union, TypedDict
from dataclasses import dataclass, field
from enum import Enum
import json
from datetime import datetime


# ── Event Data Types ──────────────────────────────────────────────────────────

class PageViewEventData(TypedDict, total=False):
    """Page view event data."""
    location: str
    title: str
    timestamp: int


class ClickEventData(TypedDict, total=False):
    """Click event data."""
    x: int
    y: int
    timestamp: int


class WebVitalEventData(TypedDict, total=False):
    """Web Vital event data (Core Web Vitals)."""
    name: Literal["FCP", "LCP", "CLS", "INP", "TTFB", "FID"]
    value: float
    rating: Literal["good", "needs-improvement", "poor"]
    delta: float
    id: str
    entries: int
    navigation_type: str
    timestamp: int


class CustomEventData(TypedDict, total=False):
    """Custom event data."""
    name: str
    data: str  # JSON-encoded string of arbitrary custom data
    timestamp: int


class ErrorEventData(TypedDict, total=False):
    """JavaScript error event data."""
    message: str
    source: str
    lineno: int
    colno: int
    timestamp: int


# Union types for events
UnisightsEventType = Literal["page_view", "click", "web_vital", "custom", "error"]


@dataclass
class UnisightsEvent:
    """Discriminated union of all event types."""
    type: UnisightsEventType
    data: Union[
        PageViewEventData,
        ClickEventData,
        WebVitalEventData,
        CustomEventData,
        ErrorEventData
    ]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {"type": self.type, "data": self.data}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UnisightsEvent":
        """Create from dictionary with validation."""
        event_type = data.get("type")
        event_data = data.get("data", {})

        if not event_type:
            raise ValueError("Event must have a 'type' field")

        if event_type not in ["page_view", "click", "web_vital", "custom", "error"]:
            raise ValueError(f"Unknown event type: {event_type}")

        return cls(type=event_type, data=event_data)


# ── Device & Session Info ─────────────────────────────────────────────────────

class DeviceType(str, Enum):
    """Device type enumeration."""
    DESKTOP = "Desktop"
    MOBILE = "Mobile"
    TABLET = "Tablet"


@dataclass
class DeviceInfo:
    """Device and browser information."""
    user_agent: str = "Unknown"
    os: str = "Unknown"
    platform: str = "Unknown"
    device_type: str = "Desktop"
    referrer: str = "Unknown"
    screen_height: int = 0
    screen_width: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "user_agent": self.user_agent,
            "os": self.os,
            "platform": self.platform,
            "referrer": self.referrer,
            "device_type": self.device_type,
            "screen_height": self.screen_height,
            "screen_width": self.screen_width,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DeviceInfo":
        """Create from dictionary with validation."""
        return cls(
            user_agent=data.get("user_agent", "Unknown"),
            os=data.get("os", "Unknown"),
            platform=data.get("platform", "Unknown"),
            referrer=data.get("referrer", "Unknown"),
            device_type=data.get("device_type", "Desktop"),
            screen_height=data.get("screen_height", 0),
            screen_width=data.get("screen_width", 0),
        )


@dataclass
class UtmParams:
    """UTM tracking parameters."""
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_term: Optional[str] = None
    utm_content: Optional[str] = None
    custom_params: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary, excluding None values."""
        result = {}
        if self.utm_source:
            result["utm_source"] = self.utm_source
        if self.utm_medium:
            result["utm_medium"] = self.utm_medium
        if self.utm_campaign:
            result["utm_campaign"] = self.utm_campaign
        if self.utm_term:
            result["utm_term"] = self.utm_term
        if self.utm_content:
            result["utm_content"] = self.utm_content
        result.update(self.custom_params)
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, str]) -> "UtmParams":
        """Create from dictionary."""
        standard_params = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]
        standard = {k: data.get(k) for k in standard_params}
        custom = {k: v for k, v in data.items() if k not in standard_params}

        return cls(
            utm_source=standard.get("utm_source"),
            utm_medium=standard.get("utm_medium"),
            utm_campaign=standard.get("utm_campaign"),
            utm_term=standard.get("utm_term"),
            utm_content=standard.get("utm_content"),
            custom_params=custom
        )


# ── Main Data Structures ──────────────────────────────────────────────────────

@dataclass
class UnisightsData:
    """Core payload data structure sent by unisights client SDK."""

    # Session & Identity
    asset_id: str
    session_id: str

    # Navigation
    page_url: str
    entry_page: str
    exit_page: Optional[str] = None

    # Tracking
    utm_params: UtmParams = field(default_factory=UtmParams)
    device_info: DeviceInfo = field(default_factory=lambda: DeviceInfo("Unknown", "Unknown"))

    # Engagement
    scroll_depth: float = 0  # 0-100 percentage (can be float)
    time_on_page: float = 0  # seconds (can be float for precision)

    # Events
    events: List[UnisightsEvent] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "asset_id": self.asset_id,
            "session_id": self.session_id,
            "page_url": self.page_url,
            "entry_page": self.entry_page,
            "exit_page": self.exit_page,
            "utm_params": self.utm_params.to_dict(),
            "device_info": self.device_info.to_dict(),
            "scroll_depth": self.scroll_depth,
            "time_on_page": self.time_on_page,
            "events": [event.to_dict() for event in self.events],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UnisightsData":
        """Create from dictionary with validation."""
        # Required fields
        asset_id = data.get("asset_id")
        session_id = data.get("session_id")
        page_url = data.get("page_url")
        entry_page = data.get("entry_page")

        if not all([asset_id, session_id, page_url, entry_page]):
            raise ValueError(
                "Missing required fields: asset_id, session_id, page_url, entry_page"
            )

        # Parse events
        events = []
        for event_data in data.get("events", []):
            try:
                events.append(UnisightsEvent.from_dict(event_data))
            except ValueError as e:
                raise ValueError(f"Invalid event: {e}")

        # Parse device info
        device_info = DeviceInfo.from_dict(data.get("device_info", {}))

        # Parse UTM params
        utm_params = UtmParams.from_dict(data.get("utm_params", {}))

        return cls(
            asset_id=asset_id,
            session_id=session_id,
            page_url=page_url,
            entry_page=entry_page,
            exit_page=data.get("exit_page"),
            utm_params=utm_params,
            device_info=device_info,
            scroll_depth=data.get("scroll_depth", 0),
            time_on_page=data.get("time_on_page", 0),
            events=events,
        )


@dataclass
class UnisightsPayload:
    """Top-level payload POSTed by unisights client SDK."""

    data: UnisightsData
    encrypted: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "data": self.data.to_dict(),
            "encrypted": self.encrypted,
        }

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "UnisightsPayload":
        """Create from dictionary with validation."""
        data_dict = payload.get("data")
        if not data_dict or not isinstance(data_dict, dict):
            raise ValueError("Payload must contain 'data' field with object value")

        data = UnisightsData.from_dict(data_dict)
        encrypted = payload.get("encrypted", False)

        return cls(data=data, encrypted=encrypted)


# ── Handler & Options ─────────────────────────────────────────────────────────

from typing import Callable, Awaitable

Handler = Callable[
    [UnisightsPayload, Any],
    Union[None, Awaitable[None]]
]


@dataclass
class UnisightsOptions:
    """Configuration options for unisights middleware."""

    # Routing
    path: str = "/events"

    # Handler
    handler: Optional[Handler] = None

    # Validation
    validate_schema: bool = True
    validate_required_fields: bool = True

    # Security
    max_payload_size: int = 1024 * 1024  # 1MB
    allow_origins: List[str] = field(default_factory=lambda: ["*"])

    # Processing
    debug: bool = False