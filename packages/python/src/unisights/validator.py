"""
Enhanced payload validation matching @pradeeparul2/unisights-node structure.

Validates UnisightsPayload against schema, required fields, and data types.
"""

import json
import logging
from typing import Dict, Any, Optional, Tuple, List
from uuid import UUID

from .types import (
    UnisightsPayload,
    UnisightsData,
    UnisightsEvent,
    UtmParams,
    DeviceInfo,
)

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Raised when payload validation fails."""

    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")


class UnisightsValidator:
    """Comprehensive validator for Unisights payloads.

    Validates structure, types, and required fields according to the
    @pradeeparul2/unisights-node specification.

    Example:
        validator = UnisightsValidator(validate_schema=True)
        try:
            payload = validator.validate(raw_data)
            print(f"Session {payload.data.session_id} from {payload.data.page_url}")
        except ValidationError as e:
            logger.error(f"Validation failed: {e}")
    """

    def __init__(
        self,
        validate_schema: bool = True,
        validate_required_fields: bool = True,
        strict: bool = False,
        max_payload_size: int = 1024 * 1024,
    ):
        """Initialize validator.

        Args:
            validate_schema: Validate structure and types
            validate_required_fields: Require all mandatory fields
            strict: Raise immediately on first error (vs collect all)
            max_payload_size: Maximum payload size in bytes
        """
        self.validate_schema = validate_schema
        self.validate_required_fields = validate_required_fields
        self.strict = strict
        self.max_payload_size = max_payload_size
        self.errors: List[ValidationError] = []

    def validate(self, raw_payload: Dict[str, Any]) -> UnisightsPayload:
        """Validate and parse raw payload.

        Args:
            raw_payload: Dictionary from JSON.parse()

        Returns:
            Parsed UnisightsPayload object

        Raises:
            ValidationError: If validation fails
        """
        self.errors = []

        # Basic structure validation
        if not isinstance(raw_payload, dict):
            raise ValidationError("payload", "Must be a JSON object")

        if not raw_payload:
            raise ValidationError("payload", "Payload cannot be empty")

        # Validate top-level structure
        if "data" not in raw_payload:
            raise ValidationError("data", "Missing required field")

        data_dict = raw_payload.get("data")
        if not isinstance(data_dict, dict):
            raise ValidationError("data", "Must be a JSON object")

        encrypted = raw_payload.get("encrypted", False)
        if not isinstance(encrypted, bool):
            raise ValidationError("encrypted", "Must be boolean")

        # Validate UnisightsData
        try:
            data = self._validate_unisights_data(data_dict)
        except ValidationError as e:
            if self.strict:
                raise
            self.errors.append(e)
            raise

        # Return parsed payload
        return UnisightsPayload(data=data, encrypted=encrypted)

    def _validate_unisights_data(self, data: Dict[str, Any]) -> UnisightsData:
        """Validate UnisightsData structure.

        Args:
            data: Dictionary from payload['data']

        Returns:
            Validated UnisightsData object

        Raises:
            ValidationError: If validation fails
        """
        # Required fields
        required_fields = ["asset_id", "session_id", "page_url", "entry_page"]
        for field in required_fields:
            if field not in data:
                raise ValidationError(field, "Required field missing")

        # Validate field types and content
        asset_id = self._validate_string(data, "asset_id", required=True, min_length=1)
        session_id = self._validate_uuid(data, "session_id", required=True)
        page_url = self._validate_url(data, "page_url", required=True)
        entry_page = self._validate_url(data, "entry_page", required=True)
        exit_page = self._validate_url(data, "exit_page", required=False)

        # Optional fields
        utm_params = self._validate_utm_params(data.get("utm_params", {}))
        device_info = self._validate_device_info(data.get("device_info", {}))

        scroll_depth = self._validate_percentage(data, "scroll_depth", default=0)
        time_on_page = self._validate_integer(data, "time_on_page", default=0, min_value=0)

        # Validate events array
        events = self._validate_events(data.get("events", []))

        return UnisightsData(
            asset_id=asset_id,
            session_id=session_id,
            page_url=page_url,
            entry_page=entry_page,
            exit_page=exit_page,
            utm_params=utm_params,
            device_info=device_info,
            scroll_depth=scroll_depth,
            time_on_page=time_on_page,
            events=events,
        )

    def _validate_string(
        self,
        data: Dict[str, Any],
        field: str,
        required: bool = False,
        min_length: int = 0,
        max_length: Optional[int] = None,
    ) -> Optional[str]:
        """Validate string field."""
        value = data.get(field)

        if value is None:
            if required:
                raise ValidationError(field, "Required field missing")
            return None

        if not isinstance(value, str):
            raise ValidationError(field, f"Must be string, got {type(value).__name__}")

        if len(value) < min_length:
            raise ValidationError(field, f"Must be at least {min_length} characters")

        if max_length and len(value) > max_length:
            raise ValidationError(field, f"Must be at most {max_length} characters")

        return value

    def _validate_integer(
        self,
        data: Dict[str, Any],
        field: str,
        default: Optional[int] = None,
        min_value: Optional[int] = None,
        max_value: Optional[int] = None,
        required: bool = False,
    ) -> int:
        """Validate integer field."""
        value = data.get(field, default)

        if value is None:
            if required:
                raise ValidationError(field, "Required field missing")
            return default or 0

        if not isinstance(value, int) or isinstance(value, bool):
            raise ValidationError(field, f"Must be integer, got {type(value).__name__}")

        if min_value is not None and value < min_value:
            raise ValidationError(field, f"Must be at least {min_value}")

        if max_value is not None and value > max_value:
            raise ValidationError(field, f"Must be at most {max_value}")

        return value

    def _validate_percentage(
        self, data: Dict[str, Any], field: str, default: int = 0
    ) -> int:
        """Validate field as percentage (0-100)."""
        return self._validate_integer(
            data, field, default=default, min_value=0, max_value=100
        )

    def _validate_uuid(
        self, data: Dict[str, Any], field: str, required: bool = False
    ) -> str:
        """Validate UUID v4 format."""
        value = data.get(field)

        if value is None:
            if required:
                raise ValidationError(field, "Required field missing")
            return None

        if not isinstance(value, str):
            raise ValidationError(field, f"Must be string, got {type(value).__name__}")

        try:
            UUID(value, version=4)
        except ValueError:
            try:
                UUID(value)  # Accept any UUID format
            except ValueError:
                raise ValidationError(field, "Invalid UUID format")

        return value

    def _validate_url(
        self, data: Dict[str, Any], field: str, required: bool = False
    ) -> Optional[str]:
        """Validate URL format."""
        value = data.get(field)

        if value is None:
            if required:
                raise ValidationError(field, "Required field missing")
            return None

        if not isinstance(value, str):
            raise ValidationError(field, f"Must be string, got {type(value).__name__}")

        # Basic URL validation
        if not (value.startswith("http://") or value.startswith("https://") or value.startswith("/")):
            raise ValidationError(field, "Must be valid URL or path")

        return value

    def _validate_device_info(self, device_dict: Dict[str, Any]) -> DeviceInfo:
        """Validate device info structure."""
        if not device_dict:
            return DeviceInfo(browser="Unknown", os="Unknown")

        if not isinstance(device_dict, dict):
            raise ValidationError("device_info", "Must be object")

        browser = device_dict.get("browser", "Unknown")
        if not isinstance(browser, str):
            raise ValidationError("device_info.browser", "Must be string")

        os = device_dict.get("os", "Unknown")
        if not isinstance(os, str):
            raise ValidationError("device_info.os", "Must be string")

        device_type = device_dict.get("device_type", "Desktop")
        if device_type not in ["Desktop", "Mobile", "Tablet"]:
            if not isinstance(device_type, str):
                raise ValidationError("device_info.device_type", "Must be string")
            logger.warning(f"Unknown device_type: {device_type}")

        return DeviceInfo(browser=browser, os=os, device_type=device_type)

    def _validate_utm_params(self, utm_dict: Dict[str, Any]) -> UtmParams:
        """Validate UTM parameters."""
        if not utm_dict:
            return UtmParams()

        if not isinstance(utm_dict, dict):
            raise ValidationError("utm_params", "Must be object")

        params = UtmParams()

        # Standard UTM parameters
        for field in ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]:
            value = utm_dict.get(field)
            if value is not None:
                if not isinstance(value, str):
                    raise ValidationError(f"utm_params.{field}", "Must be string")
                setattr(params, field, value)

        # Custom parameters
        standard_fields = {
            "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"
        }
        params.custom_params = {
            k: v for k, v in utm_dict.items()
            if k not in standard_fields and isinstance(v, str)
        }

        return params

    def _validate_events(self, events_list: List[Any]) -> List[UnisightsEvent]:
        """Validate events array."""
        if not isinstance(events_list, list):
            raise ValidationError("events", "Must be array")

        validated_events = []
        for idx, event in enumerate(events_list):
            if not isinstance(event, dict):
                raise ValidationError(f"events[{idx}]", "Must be object")

            try:
                validated_events.append(self._validate_event(event))
            except ValidationError as e:
                if self.strict:
                    raise
                logger.warning(f"Invalid event at index {idx}: {e}")
                continue

        return validated_events

    def _validate_event(self, event: Dict[str, Any]) -> UnisightsEvent:
        """Validate single event."""
        event_type = event.get("type")

        if not event_type:
            raise ValidationError("type", "Event type required")

        if not isinstance(event_type, str):
            raise ValidationError("type", "Event type must be string")

        valid_types = ["page_view", "click", "web_vital", "custom", "error"]
        if event_type not in valid_types:
            raise ValidationError("type", f"Unknown event type: {event_type}")

        event_data = event.get("data", {})
        if not isinstance(event_data, dict):
            raise ValidationError("data", "Event data must be object")

        # Type-specific validation
        self._validate_event_data(event_type, event_data)

        return UnisightsEvent(type=event_type, data=event_data)

    def _validate_event_data(self, event_type: str, data: Dict[str, Any]) -> None:
        """Validate event-specific data structure."""
        if event_type == "page_view":
            if "location" in data and not isinstance(data["location"], str):
                raise ValidationError("events.page_view.location", "Must be string")
            if "title" in data and not isinstance(data["title"], str):
                raise ValidationError("events.page_view.title", "Must be string")

        elif event_type == "click":
            for field in ["x", "y"]:
                if field in data and not isinstance(data[field], (int, float)):
                    raise ValidationError(f"events.click.{field}", "Must be number")

        elif event_type == "web_vital":
            if "name" in data:
                valid_vitals = ["FCP", "LCP", "CLS", "INP", "TTFB", "FID"]
                if data["name"] not in valid_vitals:
                    logger.warning(f"Unknown web vital: {data['name']}")

            if "value" in data and not isinstance(data["value"], (int, float)):
                raise ValidationError("events.web_vital.value", "Must be number")

            if "rating" in data:
                valid_ratings = ["good", "needs-improvement", "poor"]
                if data["rating"] not in valid_ratings:
                    raise ValidationError(
                        "events.web_vital.rating",
                        f"Must be one of: {', '.join(valid_ratings)}"
                    )

        elif event_type == "custom":
            if "name" in data and not isinstance(data["name"], str):
                raise ValidationError("events.custom.name", "Must be string")
            if "data" in data and not isinstance(data["data"], str):
                raise ValidationError("events.custom.data", "Must be string")

        elif event_type == "error":
            if "message" in data and not isinstance(data["message"], str):
                raise ValidationError("events.error.message", "Must be string")
            if "source" in data and not isinstance(data["source"], str):
                raise ValidationError("events.error.source", "Must be string")

    def get_errors(self) -> List[ValidationError]:
        """Get list of all validation errors (non-strict mode)."""
        return self.errors.copy()

    @staticmethod
    def validate_json_payload(body: bytes) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """Parse and validate JSON payload.

        Args:
            body: Raw request body

        Returns:
            Tuple of (is_valid, parsed_data, error_message)
        """
        try:
            payload = json.loads(body.decode("utf-8"))
            if not isinstance(payload, dict):
                return False, None, "Payload must be a JSON object"
            return True, payload, None
        except UnicodeDecodeError:
            return False, None, "Body must be UTF-8 encoded"
        except json.JSONDecodeError as e:
            return False, None, f"Invalid JSON: {str(e)}"


# Convenience function
def validate_unisights_payload(
    raw_payload: Dict[str, Any],
    strict: bool = True,
) -> UnisightsPayload:
    """Validate and parse Unisights payload.

    Args:
        raw_payload: Dictionary from JSON parsing
        strict: Raise on first error if True

    Returns:
        Parsed UnisightsPayload

    Raises:
        ValidationError: If validation fails
    """
    validator = UnisightsValidator(strict=strict)
    return validator.validate(raw_payload)