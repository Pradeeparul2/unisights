# tests/test_types.py
"""Unit tests for type definitions."""

import pytest
from dataclasses import asdict
from unisights.types import (
    DeviceInfo,
    UtmParams,
    UnisightsEvent,
    UnisightsData,
    UnisightsPayload,
)


class TestDeviceInfo:
    """Test DeviceInfo dataclass."""

    def test_device_info_creation(self):
        """Test creating DeviceInfo."""
        device = DeviceInfo(
            user_agent="Mozilla/5.0",
            os="Windows",
            platform="Win32",
            device_type="Desktop",
            referrer="https://google.com",
            screen_height=1080,
            screen_width=1920,
        )
        assert device.user_agent == "Mozilla/5.0"
        assert device.os == "Windows"
        assert device.device_type == "Desktop"

    def test_device_info_defaults(self):
        """Test DeviceInfo default values."""
        device = DeviceInfo(user_agent="Mozilla", os="Linux")
        assert device.platform == "Unknown"
        assert device.device_type == "Desktop"
        assert device.screen_height == 0
        assert device.screen_width == 0

    def test_device_info_to_dict(self):
        """Test DeviceInfo.to_dict()."""
        device = DeviceInfo(
            user_agent="Mozilla",
            os="Windows",
            platform="Win32",
        )
        d = device.to_dict()
        assert d["user_agent"] == "Mozilla"
        assert d["os"] == "Windows"
        assert isinstance(d, dict)

    def test_device_info_from_dict(self):
        """Test DeviceInfo.from_dict()."""
        data = {
            "user_agent": "Safari",
            "os": "macOS",
            "platform": "MacIntel",
        }
        device = DeviceInfo.from_dict(data)
        assert device.user_agent == "Safari"
        assert device.os == "macOS"


class TestUtmParams:
    """Test UtmParams dataclass."""

    def test_utm_params_creation(self):
        """Test creating UtmParams."""
        utm = UtmParams(
            utm_source="google",
            utm_medium="cpc",
            utm_campaign="summer_sale",
        )
        assert utm.utm_source == "google"
        assert utm.utm_medium == "cpc"

    def test_utm_params_defaults(self):
        """Test UtmParams default values."""
        utm = UtmParams()
        assert utm.utm_source is None
        assert utm.utm_medium is None
        assert utm.custom_params == {}

    def test_utm_params_to_dict(self):
        """Test UtmParams.to_dict()."""
        utm = UtmParams(utm_source="google", utm_medium="organic")
        d = utm.to_dict()
        assert d["utm_source"] == "google"
        assert d["utm_medium"] == "organic"


class TestUnisightsEvent:
    """Test UnisightsEvent dataclass."""

    def test_custom_event(self):
        """Test creating custom event."""
        event = UnisightsEvent(
            type="custom",
            data={"name": "test", "data": "{}", "timestamp": 123},
        )
        assert event.type == "custom"
        assert event.data["name"] == "test"

    def test_click_event(self):
        """Test creating click event."""
        event = UnisightsEvent(
            type="click",
            data={"x": 100, "y": 200, "timestamp": 123},
        )
        assert event.type == "click"
        assert event.data["x"] == 100

    def test_page_view_event(self):
        """Test creating page_view event."""
        event = UnisightsEvent(
            type="page_view",
            data={"location": "http://test.com", "title": "Test", "timestamp": 123},
        )
        assert event.type == "page_view"
        assert event.data["location"] == "http://test.com"


class TestUnisightsData:
    """Test UnisightsData dataclass."""

    def test_unisights_data_creation(self):
        """Test creating UnisightsData."""
        data = UnisightsData(
            asset_id="test-site",
            session_id="session-123",
            page_url="http://test.com",
            entry_page="http://test.com",
            exit_page="http://test.com",
            device_info=DeviceInfo(user_agent="Test", os="Test"),
            scroll_depth=50.5,
            time_on_page=100.5,
            events=[],
        )
        assert data.asset_id == "test-site"
        assert data.scroll_depth == 50.5
        assert isinstance(data.time_on_page, float)

    def test_unisights_data_to_dict(self):
        """Test UnisightsData.to_dict()."""
        data = UnisightsData(
            asset_id="test",
            session_id="session",
            page_url="http://test.com",
            entry_page="http://test.com",
            exit_page="http://test.com",
            device_info=DeviceInfo(user_agent="Test", os="Test"),
        )
        d = data.to_dict()
        assert d["asset_id"] == "test"
        assert "device_info" in d


class TestUnisightsPayload:
    """Test UnisightsPayload dataclass."""

    def test_payload_creation(self):
        """Test creating UnisightsPayload."""
        data = UnisightsData(
            asset_id="test",
            session_id="session",
            page_url="http://test.com",
            entry_page="http://test.com",
            exit_page="http://test.com",
            device_info=DeviceInfo(user_agent="Test", os="Test"),
        )
        payload = UnisightsPayload(data=data, encrypted=False)
        assert payload.data.asset_id == "test"
        assert payload.encrypted is False

    def test_payload_encrypted(self):
        """Test encrypted payload."""
        data = UnisightsData(
            asset_id="test",
            session_id="session",
            page_url="http://test.com",
            entry_page="http://test.com",
            exit_page="http://test.com",
            device_info=DeviceInfo(user_agent="Test", os="Test"),
        )
        payload = UnisightsPayload(data=data, encrypted=True)
        assert payload.encrypted is True