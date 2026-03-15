# tests/test_integration.py
"""Integration tests for the full package."""

import pytest
import json
from unisights import (
    UnisightsValidator,
    UnisightsOptions,
)


class TestEndToEndValidation:
    """Test end-to-end validation flows."""

    def test_validate_real_payload(self):
        """Test validating real-world payload."""
        validator = UnisightsValidator()
        
        payload = {
            "encrypted": False,
            "data": {
                "asset_id": "unisights-html-test-site",
                "session_id": "ffe6dbd2-1a22-4189-84d8-f2f413690d14",
                "page_url": "http://127.0.0.1:8080/",
                "entry_page": "http://127.0.0.1:8080/",
                "exit_page": "http://127.0.0.1:8080/",
                "utm_params": {},
                "device_info": {
                    "device_type": "Desktop",
                    "os": "Windows",
                    "platform": "Win32",
                    "referrer": "http://127.0.0.1:8080/",
                    "screen_height": 1080,
                    "screen_width": 1920,
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                },
                "events": [
                    {
                        "type": "custom",
                        "data": {
                            "name": "tab_focus",
                            "data": '{"url":"http://127.0.0.1:8080/"}',
                            "timestamp": 1773559220305,
                        },
                    },
                    {
                        "type": "click",
                        "data": {
                            "x": 829,
                            "y": 401,
                            "timestamp": 1773559220462,
                        },
                    },
                ],
                "scroll_depth": 64.23834504602594,
                "time_on_page": 374.7736999999881,
            },
        }
        
        result = validator.validate(payload)
        
        assert result.data.asset_id == "unisights-html-test-site"
        assert result.data.session_id == "ffe6dbd2-1a22-4189-84d8-f2f413690d14"
        assert result.data.scroll_depth == 64.23834504602594
        assert result.data.time_on_page == 374.7736999999881
        assert len(result.data.events) == 2
        assert result.encrypted is False

    def test_validate_with_web_vitals(self):
        """Test validating payload with web vitals."""
        validator = UnisightsValidator()
        
        payload = {
            "encrypted": False,
            "data": {
                "asset_id": "test",
                "session_id": "ff75b604-de8b-4679-80ef-7bcf72363aeb",
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
                        "type": "web_vital",
                        "data": {
                            "name": "FCP",
                            "value": 1296,
                            "rating": "good",
                            "timestamp": 123456789,
                        },
                    },
                    {
                        "type": "web_vital",
                        "data": {
                            "name": "LCP",
                            "value": 2644,
                            "rating": "needs-improvement",
                            "timestamp": 123456790,
                        },
                    },
                ],
            },
        }
        
        result = validator.validate(payload)
        assert len(result.data.events) == 2
        assert result.data.events[0].type == "web_vital"
        assert result.data.events[0].data["name"] == "FCP"

    def test_validate_with_multiple_event_types(self):
        """Test payload with various event types."""
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
                        "type": "page_view",
                        "data": {
                            "location": "http://test.com",
                            "title": "Test Page",
                            "timestamp": 123,
                        },
                    },
                    {
                        "type": "click",
                        "data": {"x": 100, "y": 200, "timestamp": 124},
                    },
                    {
                        "type": "custom",
                        "data": {
                            "name": "test",
                            "data": "{}",
                            "timestamp": 125,
                        },
                    },
                    {
                        "type": "error",
                        "data": {
                            "message": "Test error",
                            "timestamp": 126,
                        },
                    },
                ],
            },
        }
        
        result = validator.validate(payload)
        assert len(result.data.events) == 4
        event_types = [e.type for e in result.data.events]
        assert "page_view" in event_types
        assert "click" in event_types
        assert "custom" in event_types
        assert "error" in event_types

    def test_validate_with_utm_params(self):
        """Test validation with UTM parameters."""
        validator = UnisightsValidator()
        
        payload = {
            "encrypted": False,
            "data": {
                "asset_id": "test",
                "session_id": "ec9925d1-9075-4bd6-80ba-2423bd2f3909",
                "page_url": "http://test.com",
                "entry_page": "http://test.com",
                "exit_page": "http://test.com",
                "utm_params": {
                    "utmSource": "google",
                    "utmMedium": "cpc",
                    "utmCampaign": "summer_sale",
                    "utmTerm": "analytics",
                    "utmContent": "ad_variant_a",
                },
                "device_info": {
                    "user_agent": "Mozilla",
                    "os": "Windows",
                },
                "scroll_depth": 50.0,
                "time_on_page": 100.0,
                "events": [],
            },
        }
        
        result = validator.validate(payload)
        utm = result.data.utm_params
        assert utm.utm_source == "google"
        assert utm.utm_medium == "cpc"
        assert utm.utm_campaign == "summer_sale"
        assert utm.utm_term == "analytics"
        assert utm.utm_content == "ad_variant_a"


class TestTypeIntegration:
    """Test type system integration."""

    def test_payload_serialization(self):
        """Test payload can be serialized to dict."""
        from unisights.types import (
            UnisightsData,
            UnisightsPayload,
            DeviceInfo,
            UnisightsEvent,
        )
        
        data = UnisightsData(
            asset_id="test",
            session_id="session",
            page_url="http://test.com",
            entry_page="http://test.com",
            exit_page="http://test.com",
            device_info=DeviceInfo(
                user_agent="Mozilla",
                os="Windows",
                platform="Win32",
            ),
            scroll_depth=50.5,
            time_on_page=100.5,
            events=[
                UnisightsEvent(
                    type="click",
                    data={"x": 100, "y": 200, "timestamp": 123},
                ),
            ],
        )
        
        payload = UnisightsPayload(data=data, encrypted=False)
        payload_dict = payload.data.to_dict()
        
        assert payload_dict["asset_id"] == "test"
        assert payload_dict["session_id"] == "session"
        assert payload_dict["scroll_depth"] == 50.5
        assert payload_dict["time_on_page"] == 100.5
        assert "device_info" in payload_dict
        assert len(payload_dict["events"]) == 1