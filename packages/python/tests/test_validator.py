# tests/test_validator.py
"""Unit tests for payload validation."""

import pytest
from unisights.validator import UnisightsValidator, ValidationError
from unisights.types import DeviceInfo


class TestValidatorBasics:
    """Test basic validator functionality."""

    def test_validator_creation(self):
        """Test creating validator."""
        validator = UnisightsValidator()
        assert validator is not None

    def test_validator_with_options(self):
        """Test validator with options."""
        validator = UnisightsValidator(
            validate_schema=True,
            validate_required_fields=True,
            strict=True,
        )
        assert validator.validate_schema is True
        assert validator.strict is True


class TestDeviceInfoValidation:
    """Test device_info validation."""

    def test_valid_device_info(self):
        """Test validating valid device info."""
        validator = UnisightsValidator()
        device_dict = {
            "user_agent": "Mozilla/5.0",
            "os": "Windows",
            "platform": "Win32",
            "device_type": "Desktop",
            "referrer": "https://google.com",
            "screen_height": 1080,
            "screen_width": 1920,
        }
        device = validator._validate_device_info(device_dict)
        assert device.user_agent == "Mozilla/5.0"
        assert device.os == "Windows"
        assert device.device_type == "Desktop"

    def test_device_info_with_defaults(self):
        """Test device info validation with defaults."""
        validator = UnisightsValidator()
        device_dict = {
            "user_agent": "Mozilla",
            "os": "Windows",
        }
        device = validator._validate_device_info(device_dict)
        assert device.user_agent == "Mozilla"
        assert device.platform == "Unknown"
        assert device.device_type == "Desktop"

    def test_device_info_empty(self):
        """Test empty device info returns defaults."""
        validator = UnisightsValidator()
        device = validator._validate_device_info({})
        assert device.user_agent == "Unknown"
        assert device.os == "Unknown"

    def test_device_info_invalid_type(self):
        """Test invalid device info type."""
        validator = UnisightsValidator()
        with pytest.raises(ValidationError):
            validator._validate_device_info("not a dict")

    def test_device_info_invalid_user_agent(self):
        """Test invalid user_agent type."""
        validator = UnisightsValidator()
        with pytest.raises(ValidationError):
            validator._validate_device_info({"user_agent": 123, "os": "Test"})


class TestNumberValidation:
    """Test numeric field validation."""

    def test_validate_percentage_int(self):
        """Test percentage validation with integer."""
        validator = UnisightsValidator()
        result = validator._validate_percentage({"scroll": 50}, "scroll")
        assert result == 50.0
        assert isinstance(result, float)

    def test_validate_percentage_float(self):
        """Test percentage validation with float."""
        validator = UnisightsValidator()
        result = validator._validate_percentage({"scroll": 64.238}, "scroll")
        assert result == 64.238

    def test_validate_percentage_out_of_range(self):
        """Test percentage out of range."""
        validator = UnisightsValidator()
        with pytest.raises(ValidationError):
            validator._validate_percentage({"scroll": 150}, "scroll")

    def test_validate_numeric(self):
        """Test numeric field validation."""
        validator = UnisightsValidator()
        result = validator._validate_numeric(
            {"time": 374.773}, "time", min_value=0
        )
        assert result == 374.773


class TestFullPayloadValidation:
    """Test full payload validation."""

    def test_valid_payload(self):
        """Test validating valid payload."""
        validator = UnisightsValidator()
        payload = {
            "encrypted": False,
            "data": {
                "asset_id": "test-site",
                "session_id": "ff75b604-de8b-4679-80ef-7bcf72363aeb",
                "page_url": "http://test.com",
                "entry_page": "http://test.com",
                "exit_page": "http://test.com",
                "utm_params": {},
                "device_info": {
                    "user_agent": "Mozilla",
                    "os": "Windows",
                    "platform": "Win32",
                },
                "scroll_depth": 50.5,
                "time_on_page": 100.5,
                "events": [],
            },
        }
        result = validator.validate(payload)
        assert result.data.asset_id == "test-site"
        assert result.data.scroll_depth == 50.5
        assert result.encrypted is False

    def test_payload_missing_data(self):
        """Test payload without data field."""
        validator = UnisightsValidator()
        with pytest.raises(ValidationError):
            validator.validate({"encrypted": False})

    def test_payload_invalid_type(self):
        """Test invalid payload type."""
        validator = UnisightsValidator()
        with pytest.raises(ValidationError):
            validator.validate("not a dict")

    def test_payload_with_events(self):
        """Test payload with events."""
        validator = UnisightsValidator()
        payload = {
            "encrypted": False,
            "data": {
                "asset_id": "test",
                "session_id": "4b0584ec-2ca4-4825-b159-cd007cbaa5e7",
                "page_url": "http://test.com",
                "entry_page": "http://test.com",
                "exit_page": "http://test.com",
                "utm_params": {},
                "device_info": {
                    "user_agent": "Mozilla",
                    "os": "Windows",
                },
                "scroll_depth": 50.0,
                "time_on_page": 100.0,
                "events": [
                    {
                        "type": "custom",
                        "data": {
                            "name": "test_event",
                            "data": "{}",
                            "timestamp": 1234567890,
                        },
                    },
                ],
            },
        }
        result = validator.validate(payload)
        assert len(result.data.events) == 1
        assert result.data.events[0].type == "custom"

    def test_payload_with_click_event(self):
        """Test payload with click event."""
        validator = UnisightsValidator()
        payload = {
            "encrypted": False,
            "data": {
                "asset_id": "test",
                "session_id": "ec9925d1-9075-4bd6-80ba-2423bd2f3909",
                "page_url": "http://test.com",
                "entry_page": "http://test.com",
                "exit_page": "http://test.com",
                "utm_params": {},
                "device_info": {
                    "user_agent": "Mozilla",
                    "os": "Windows",
                },
                "scroll_depth": 50.0,
                "time_on_page": 100.0,
                "events": [
                    {
                        "type": "click",
                        "data": {
                            "x": 100,
                            "y": 200,
                            "timestamp": 1234567890,
                        },
                    },
                ],
            },
        }
        result = validator.validate(payload)
        assert result.data.events[0].type == "click"
        assert result.data.events[0].data["x"] == 100


class TestJSONParsing:
    """Test JSON parsing."""

    def test_parse_json_string(self):
        """Test parsing JSON string."""
        validator = UnisightsValidator()
        json_str = b'{"test": "value"}'
        is_valid, data, error = validator.validate_json_payload(json_str)
        assert is_valid is True
        assert data["test"] == "value"

    def test_parse_invalid_json(self):
        """Test parsing invalid JSON."""
        validator = UnisightsValidator()
        json_str = b'{"test": invalid}'
        is_valid, data, error = validator.validate_json_payload(json_str)
        assert is_valid is False
        assert error is not None

    def test_parse_empty_json(self):
        """Test parsing empty JSON."""
        validator = UnisightsValidator()
        json_str = b'{}'
        is_valid, data, error = validator.validate_json_payload(json_str)
        assert is_valid is True
        assert data == {}