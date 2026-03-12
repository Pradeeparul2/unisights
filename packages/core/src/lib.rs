pub mod encryption;
pub mod event;
pub mod session;
pub mod tracker;

use base64::{engine::general_purpose, Engine as _};
use js_sys::{Date, Object, Reflect};
use crate::tracker::Tracker as CoreTracker;
use wasm_bindgen::prelude::*;

// ─────────────────────────────────────────────
// WASM-facing Tracker
// Thin glue layer — all logic lives in tracker.rs
// ─────────────────────────────────────────────

#[wasm_bindgen]
pub struct Tracker {
    inner: CoreTracker,
}

#[wasm_bindgen]
impl Tracker {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Tracker {
        Tracker {
            inner: CoreTracker::new(),
        }
    }

    // ─── Event logging ─────────────────────────

    #[wasm_bindgen(js_name = logClick)]
    pub fn log_click(&mut self, x: f64, y: f64) {
        self.inner.log_click(x, y, Date::now());
    }

    #[wasm_bindgen(js_name = logPageView)]
    pub fn log_page_view(&mut self, url: String, title: Option<String>) {
        self.inner.log_page_view(url, title, Date::now());
    }

    #[wasm_bindgen(js_name = logCustomEvent)]
    pub fn log_custom_event(&mut self, name: String, data: String) {
        self.inner.log_custom_event(name, data, Date::now());
    }

    #[wasm_bindgen(js_name = logWebVital)]
    pub fn log_web_vital(
        &mut self,
        name: String,
        value: f64,
        id: String,
        rating: String,
        delta: f64,
        entries: usize,
        navigation_type: String,
    ) {
        self.inner
            .log_web_vital(name, value, id, rating, delta, entries, navigation_type, Date::now());
    }

    #[wasm_bindgen(js_name = logError)]
    pub fn log_error(
        &mut self,
        message: String,
        source: Option<String>,
        lineno: Option<u32>,
        colno: Option<u32>,
    ) {
        self.inner.log_error(message, source, lineno, colno, Date::now());
    }

    // ─── Session ───────────────────────────────

    #[wasm_bindgen(js_name = setSessionInfo)]
    pub fn set_session_info(
        &mut self,
        asset_id: String,
        session_id: String,
        page_url: String,
        utm_params: JsValue,
        device_info: JsValue,
        ua_hash: Option<String>,
    ) {
        let utm = serde_wasm_bindgen::from_value(utm_params).unwrap_or(serde_json::Value::Null);
        let device = serde_wasm_bindgen::from_value(device_info).unwrap_or(serde_json::Value::Null);
        self.inner.set_session(asset_id, session_id, page_url, utm, device, ua_hash);
    }

    #[wasm_bindgen(js_name = setPageUrl)]
    pub fn set_page_url(&mut self, page_url: String) {
        self.inner.session.set_page_url(page_url);
    }

    #[wasm_bindgen(js_name = logEntryPage)]
    pub fn log_entry_page(&mut self, url: String) {
        self.inner.session.set_entry_page(url);
    }

    #[wasm_bindgen(js_name = logExitPage)]
    pub fn log_exit_page(&mut self, url: String) {
        self.inner.session.set_exit_page(url);
    }

    // ─── Scroll / Time ─────────────────────────

    #[wasm_bindgen(js_name = updateScroll)]
    pub fn update_scroll(&mut self, percent: f64) {
        self.inner.update_scroll(percent);
    }

    #[wasm_bindgen(js_name = tick)]
    pub fn tick(&mut self, seconds: f64) {
        self.inner.tick(seconds);
    }

    #[wasm_bindgen(js_name = clearEvents)]
    pub fn clear_events(&mut self) {
        self.inner.clear_events();
    }

    // ─── Encryption ────────────────────────────

    #[wasm_bindgen(js_name = setEncryptionConfig)]
    pub fn set_encryption_config(&mut self, enable: bool) {
        self.inner.encryption.configure(enable);
    }

    // ─── Getters (for testing + JS consumers) ──

    #[wasm_bindgen(js_name = getScrollDepth)]
    pub fn get_scroll_depth(&self) -> f64 {
        self.inner.scroll_depth
    }

    #[wasm_bindgen(js_name = getTimeOnPage)]
    pub fn get_time_on_page(&self) -> f64 {
        self.inner.time_on_page
    }

    #[wasm_bindgen(js_name = getEventCount)]
    pub fn get_event_count(&self) -> usize {
        self.inner.queue.len()
    }

    #[wasm_bindgen(js_name = isEncrypted)]
    pub fn is_encrypted(&self) -> bool {
        self.inner.encryption.enabled
    }

    #[wasm_bindgen(js_name = getEntryPage)]
    pub fn get_entry_page(&self) -> Option<String> {
        self.inner.session.entry_page.clone()
    }

    #[wasm_bindgen(js_name = getExitPage)]
    pub fn get_exit_page(&self) -> Option<String> {
        self.inner.session.exit_page.clone()
    }

    #[wasm_bindgen(js_name = getPageUrl)]
    pub fn get_page_url(&self) -> Option<String> {
        self.inner.session.page_url.clone()
    }

    // ─── Export ────────────────────────────────

    #[wasm_bindgen(js_name = exportEncryptedPayload)]
    pub fn export_encrypted_payload(&self) -> Result<JsValue, JsValue> {
        let payload = self.inner.build_payload()?;

        let json_bytes = serde_json::to_vec(&payload)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))?;

        // Build wrapper JS object manually — keeps booleans as real JS primitives
        // and nested objects as real JS objects (via JSON.parse), not serde wrappers.
        let out = Object::new();

        let site_id = self.inner.session.asset_id.as_deref().unwrap_or("");
        let ua_hash = self.inner.session.ua_hash.as_deref().unwrap_or("");
        let timestamp_ms = Date::now();
        match self.inner.encryption.encrypt(&json_bytes, site_id, ua_hash, timestamp_ms)? {
            None => {
                let json_str = std::str::from_utf8(&json_bytes)
                    .map_err(|e| JsValue::from_str(&format!("UTF-8 error: {}", e)))?;
                let data_js = js_sys::JSON::parse(json_str)
                    .map_err(|e| JsValue::from_str(&format!("JSON.parse error: {:?}", e)))?;
                Reflect::set(&out, &JsValue::from_str("data"), &data_js)
                    .map_err(|_| JsValue::from_str("Reflect.set failed"))?;
                Reflect::set(&out, &JsValue::from_str("encrypted"), &JsValue::FALSE)
                    .map_err(|_| JsValue::from_str("Reflect.set failed"))?;
            }
            Some(enc) => {
                let data_b64 = JsValue::from_str(&general_purpose::STANDARD.encode(&enc.ciphertext));
                let tag_b64 = JsValue::from_str(&general_purpose::STANDARD.encode(&enc.tag));
                Reflect::set(&out, &JsValue::from_str("data"), &data_b64)
                    .map_err(|_| JsValue::from_str("Reflect.set failed"))?;
                Reflect::set(&out, &JsValue::from_str("tag"), &tag_b64)
                    .map_err(|_| JsValue::from_str("Reflect.set failed"))?;
                Reflect::set(&out, &JsValue::from_str("bucket"), &JsValue::from_f64(enc.bucket as f64))
                    .map_err(|_| JsValue::from_str("Reflect.set failed"))?;
                Reflect::set(&out, &JsValue::from_str("site_id"), &JsValue::from_str(site_id))
                    .map_err(|_| JsValue::from_str("Reflect.set failed"))?;
                Reflect::set(&out, &JsValue::from_str("ua_hash"), &JsValue::from_str(ua_hash))
                    .map_err(|_| JsValue::from_str("Reflect.set failed"))?;
                Reflect::set(&out, &JsValue::from_str("encrypted"), &JsValue::TRUE)
                    .map_err(|_| JsValue::from_str("Reflect.set failed"))?;
            }
        }

        Ok(out.into())
    }
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

// #[cfg(test)]
// mod tests {
//     use super::*;
//     use wasm_bindgen::JsValue;
//     use wasm_bindgen_test::*;

//     wasm_bindgen_test_configure!(run_in_browser);

//     fn make_tracker() -> Tracker {
//         Tracker::new()
//     }

//     fn tracker_with_session() -> Tracker {
//         let mut t = Tracker::new();
//         t.set_session_info(
//             "asset-123".into(),
//             "session-abc".into(),
//             "https://example.com/page".into(),
//             JsValue::NULL,
//             JsValue::NULL,
//             Some("ua1234".into()),
//         );
//         t
//     }

//     fn get_field(obj: &JsValue, key: &str) -> JsValue {
//         js_sys::Reflect::get(obj, &JsValue::from_str(key)).unwrap_or(JsValue::NULL)
//     }

//     // ─── 1. Construction ───────────────────────

//     #[wasm_bindgen_test]
//     fn test_new_tracker_defaults() {
//         let t = make_tracker();
//         assert_eq!(t.get_scroll_depth(), 0.0);
//         assert_eq!(t.get_time_on_page(), 0.0);
//         assert_eq!(t.get_event_count(), 0);
//         assert!(!t.is_encrypted());
//         assert!(t.get_entry_page().is_none());
//         assert!(t.get_exit_page().is_none());
//         assert!(t.get_page_url().is_none());
//     }

//     // ─── 2. Click ──────────────────────────────

//     #[wasm_bindgen_test]
//     fn test_click_event_logged() {
//         let mut t = make_tracker();
//         t.log_click(100.0, 200.0);
//         assert_eq!(t.get_event_count(), 1);
//     }

//     #[wasm_bindgen_test]
//     fn test_multiple_clicks_accumulate() {
//         let mut t = make_tracker();
//         t.log_click(10.0, 20.0);
//         t.log_click(30.0, 40.0);
//         t.log_click(50.0, 60.0);
//         assert_eq!(t.get_event_count(), 3);
//     }

//     #[wasm_bindgen_test]
//     fn test_click_payload_fields() {
//         let mut t = tracker_with_session();
//         t.log_click(42.0, 99.0);
//         let result = t.export_encrypted_payload().unwrap();
//         let data = get_field(&result, "data");
//         let events = js_sys::Array::from(&get_field(&data, "events"));
//         let event = events.get(0);
//         assert_eq!(get_field(&event, "type").as_string().unwrap(), "click");
//         let ed = get_field(&event, "data");
//         assert_eq!(get_field(&ed, "x").as_f64().unwrap(), 42.0);
//         assert_eq!(get_field(&ed, "y").as_f64().unwrap(), 99.0);
//     }

//     // ─── 3. PageView ───────────────────────────

//     #[wasm_bindgen_test]
//     fn test_page_view_event() {
//         let mut t = make_tracker();
//         t.log_page_view("https://example.com".into(), Some("Home".into()));
//         assert_eq!(t.get_event_count(), 1);
//         assert_eq!(t.get_page_url().unwrap(), "https://example.com");
//     }

//     #[wasm_bindgen_test]
//     fn test_page_view_without_title() {
//         let mut t = tracker_with_session();
//         t.log_page_view("https://example.com/about".into(), None);
//         let result = t.export_encrypted_payload().unwrap();
//         let data = get_field(&result, "data");
//         let events = js_sys::Array::from(&get_field(&data, "events"));
//         let event = events.get(0);
//         assert_eq!(get_field(&event, "type").as_string().unwrap(), "page_view");
//         let title = get_field(&get_field(&event, "data"), "page_title");
//         assert!(title.is_null() || title.is_undefined());
//     }

//     #[wasm_bindgen_test]
//     fn test_page_view_sets_page_url() {
//         let mut t = make_tracker();
//         t.log_page_view("https://example.com/products".into(), None);
//         assert_eq!(t.get_page_url().unwrap(), "https://example.com/products");
//     }

//     // ─── 4. Custom events ──────────────────────

//     #[wasm_bindgen_test]
//     fn test_custom_event_logged() {
//         let mut t = tracker_with_session();
//         t.log_custom_event("button_click".into(), r#"{"id":"cta-1"}"#.into());
//         assert_eq!(t.get_event_count(), 1);
//         let result = t.export_encrypted_payload().unwrap();
//         let data = get_field(&result, "data");
//         let events = js_sys::Array::from(&get_field(&data, "events"));
//         let event = events.get(0);
//         assert_eq!(get_field(&event, "type").as_string().unwrap(), "custom");
//         assert_eq!(
//             get_field(&get_field(&event, "data"), "name")
//                 .as_string()
//                 .unwrap(),
//             "button_click"
//         );
//     }

//     #[wasm_bindgen_test]
//     fn test_custom_event_empty_data() {
//         let mut t = make_tracker();
//         t.log_custom_event("ping".into(), "{}".into());
//         assert_eq!(t.get_event_count(), 1);
//     }

//     // ─── 5. WebVital ───────────────────────────

//     #[wasm_bindgen_test]
//     fn test_web_vital_logged() {
//         let mut t = tracker_with_session();
//         t.log_web_vital("LCP".into(), 1200.0, "v1".into(), "good".into(), 50.0, 3, "navigate".into());
//         let result = t.export_encrypted_payload().unwrap();
//         let events = js_sys::Array::from(&get_field(&get_field(&result, "data"), "events"));
//         let ed = get_field(&events.get(0), "data");
//         assert_eq!(get_field(&ed, "name").as_string().unwrap(), "LCP");
//         assert_eq!(get_field(&ed, "value").as_f64().unwrap(), 1200.0);
//         assert_eq!(get_field(&ed, "rating").as_string().unwrap(), "good");
//     }

//     #[wasm_bindgen_test]
//     fn test_web_vital_poor_rating() {
//         let mut t = tracker_with_session();
//         t.log_web_vital("CLS".into(), 0.35, "v2".into(), "poor".into(), 0.1, 1, "reload".into());
//         let result = t.export_encrypted_payload().unwrap();
//         let events = js_sys::Array::from(&get_field(&get_field(&result, "data"), "events"));
//         assert_eq!(
//             get_field(&get_field(&events.get(0), "data"), "rating")
//                 .as_string()
//                 .unwrap(),
//             "poor"
//         );
//     }

//     // ─── 6. Error events ───────────────────────

//     #[wasm_bindgen_test]
//     fn test_error_event_logged() {
//         let mut t = tracker_with_session();
//         t.log_error(
//             "TypeError: cannot read property".into(),
//             Some("app.js".into()),
//             Some(42),
//             Some(10),
//         );
//         assert_eq!(t.get_event_count(), 1);
//         let result = t.export_encrypted_payload().unwrap();
//         let events = js_sys::Array::from(&get_field(&get_field(&result, "data"), "events"));
//         let event = events.get(0);
//         assert_eq!(get_field(&event, "type").as_string().unwrap(), "error");
//         let ed = get_field(&event, "data");
//         assert_eq!(
//             get_field(&ed, "message").as_string().unwrap(),
//             "TypeError: cannot read property"
//         );
//         assert_eq!(get_field(&ed, "source").as_string().unwrap(), "app.js");
//         assert_eq!(get_field(&ed, "lineno").as_f64().unwrap(), 42.0);
//     }

//     #[wasm_bindgen_test]
//     fn test_error_event_minimal() {
//         let mut t = make_tracker();
//         t.log_error("Something went wrong".into(), None, None, None);
//         assert_eq!(t.get_event_count(), 1);
//     }

//     // ─── 7. Event ordering ─────────────────────

//     #[wasm_bindgen_test]
//     fn test_multiple_events_order_preserved() {
//         let mut t = tracker_with_session();
//         t.log_click(1.0, 2.0);
//         t.log_page_view("https://example.com".into(), None);
//         t.log_custom_event("signup".into(), "{}".into());
//         let result = t.export_encrypted_payload().unwrap();
//         let events = js_sys::Array::from(&get_field(&get_field(&result, "data"), "events"));
//         assert_eq!(get_field(&events.get(0), "type").as_string().unwrap(), "click");
//         assert_eq!(get_field(&events.get(1), "type").as_string().unwrap(), "page_view");
//         assert_eq!(get_field(&events.get(2), "type").as_string().unwrap(), "custom");
//     }

//     // ─── 8. Entry / Exit page ──────────────────

//     #[wasm_bindgen_test]
//     fn test_entry_exit_page() {
//         let mut t = make_tracker();
//         t.log_entry_page("https://example.com/landing".into());
//         t.log_exit_page("https://example.com/checkout".into());
//         assert_eq!(t.get_entry_page().unwrap(), "https://example.com/landing");
//         assert_eq!(t.get_exit_page().unwrap(), "https://example.com/checkout");
//     }

//     #[wasm_bindgen_test]
//     fn test_entry_page_only() {
//         let mut t = make_tracker();
//         t.log_entry_page("https://example.com".into());
//         assert!(t.get_exit_page().is_none());
//     }

//     #[wasm_bindgen_test]
//     fn test_exit_page_only() {
//         let mut t = make_tracker();
//         t.log_exit_page("https://example.com/bye".into());
//         assert!(t.get_entry_page().is_none());
//     }

//     // ─── 9. Scroll depth ───────────────────────

//     #[wasm_bindgen_test]
//     fn test_scroll_depth_tracking() {
//         let mut t = make_tracker();
//         t.update_scroll(40.0);
//         assert_eq!(t.get_scroll_depth(), 40.0);
//     }

//     #[wasm_bindgen_test]
//     fn test_scroll_depth_never_decreases() {
//         let mut t = make_tracker();
//         t.update_scroll(80.0);
//         t.update_scroll(20.0);
//         assert_eq!(t.get_scroll_depth(), 80.0);
//     }

//     #[wasm_bindgen_test]
//     fn test_scroll_depth_increments_to_max() {
//         let mut t = make_tracker();
//         for pct in [10.0_f64, 25.0, 60.0, 100.0, 50.0] {
//             t.update_scroll(pct);
//         }
//         assert_eq!(t.get_scroll_depth(), 100.0);
//     }

//     // ─── 10. Time on page ──────────────────────

//     #[wasm_bindgen_test]
//     fn test_time_on_page() {
//         let mut t = make_tracker();
//         t.tick(3.0);
//         t.tick(5.0);
//         assert_eq!(t.get_time_on_page(), 8.0);
//     }

//     #[wasm_bindgen_test]
//     fn test_time_on_page_starts_zero() {
//         let t = make_tracker();
//         assert_eq!(t.get_time_on_page(), 0.0);
//     }

//     #[wasm_bindgen_test]
//     fn test_time_on_page_accumulates() {
//         let mut t = make_tracker();
//         for _ in 0..10 { t.tick(1.0); }
//         assert_eq!(t.get_time_on_page(), 10.0);
//     }

//     // ─── 11. set_page_url ──────────────────────

//     #[wasm_bindgen_test]
//     fn test_set_page_url_updates_url() {
//         let mut t = make_tracker();
//         t.set_page_url("https://example.com/new-page".into());
//         assert_eq!(t.get_page_url().unwrap(), "https://example.com/new-page");
//     }

//     #[wasm_bindgen_test]
//     fn test_set_page_url_overwrites_previous() {
//         let mut t = make_tracker();
//         t.set_page_url("https://example.com/old".into());
//         t.set_page_url("https://example.com/new".into());
//         assert_eq!(t.get_page_url().unwrap(), "https://example.com/new");
//     }

//     // ─── 12. Encryption ────────────────────────

//     #[wasm_bindgen_test]
//     fn test_encryption_enabled() {
//         let mut t = make_tracker();
//         t.set_encryption_config(true);
//         assert!(t.is_encrypted());
//     }

//     #[wasm_bindgen_test]
//     fn test_encryption_disabled() {
//         let mut t = make_tracker();
//         t.set_encryption_config(true);
//         t.set_encryption_config(false);
//         assert!(!t.is_encrypted());
//     }

//     #[wasm_bindgen_test]
//     fn test_encryption_disabled_returns_plain_object() {
//         let mut t = tracker_with_session();
//         t.set_encryption_config(false);
//         t.log_click(1.0, 2.0);
//         let result = t.export_encrypted_payload().unwrap();
//         let encrypted = js_sys::Reflect::get(&result, &JsValue::from_str("encrypted"))
//             .unwrap_or(JsValue::UNDEFINED);
//         assert_eq!(encrypted, JsValue::FALSE);
//         assert!(get_field(&result, "data").is_object());
//     }

//     #[wasm_bindgen_test]
//     fn test_encryption_enabled_returns_encrypted_object() {
//         let mut t = tracker_with_session();
//         t.set_encryption_config(true);
//         t.log_click(5.0, 10.0);
//         let result = t.export_encrypted_payload().unwrap();

//         // encrypted flag
//         let encrypted = js_sys::Reflect::get(&result, &JsValue::from_str("encrypted"))
//             .unwrap_or(JsValue::UNDEFINED);
//         assert_eq!(encrypted, JsValue::TRUE);

//         // ciphertext — base64 string
//         assert!(get_field(&result, "data").as_string().is_some(), "data should be base64");

//         // authentication tag — base64 string
//         assert!(get_field(&result, "tag").as_string().is_some(), "tag should be present");

//         // bucket — numeric
//         assert!(get_field(&result, "bucket").as_f64().is_some(), "bucket should be a number");

//         // server needs these to reproduce client_key
//         assert_eq!(
//             get_field(&result, "site_id").as_string().unwrap(),
//             "asset-123",
//             "site_id should match asset_id"
//         );
//         assert!(
//             get_field(&result, "ua_hash").as_string().is_some(),
//             "ua_hash should be present"
//         );
//     }

//     // ─── 13. clear_events ──────────────────────

//     #[wasm_bindgen_test]
//     fn test_clear_events_prevents_export() {
//         let mut t = tracker_with_session();
//         t.log_click(1.0, 2.0);
//         t.clear_events();
//         assert!(t.export_encrypted_payload().is_err());
//     }

//     #[wasm_bindgen_test]
//     fn test_clear_events_resets_count() {
//         let mut t = make_tracker();
//         t.log_click(1.0, 2.0);
//         t.log_custom_event("test".into(), "{}".into());
//         t.clear_events();
//         assert_eq!(t.get_event_count(), 0);
//     }

//     #[wasm_bindgen_test]
//     fn test_clear_events_allows_new_events() {
//         let mut t = tracker_with_session();
//         t.log_click(1.0, 2.0);
//         t.clear_events();
//         t.log_custom_event("after_clear".into(), "{}".into());
//         assert_eq!(t.get_event_count(), 1);
//         assert!(t.export_encrypted_payload().is_ok());
//     }

//     // ─── 14. Export guards ─────────────────────

//     #[wasm_bindgen_test]
//     fn test_export_fails_without_session_info() {
//         let mut t = make_tracker();
//         t.log_click(1.0, 2.0);
//         assert!(t.export_encrypted_payload().is_err());
//     }

//     #[wasm_bindgen_test]
//     fn test_export_fails_with_no_events() {
//         let t = tracker_with_session();
//         assert!(t.export_encrypted_payload().is_err());
//     }

//     // ─── 15. Session payload fields ────────────

//     #[wasm_bindgen_test]
//     fn test_session_info_reflected_in_payload() {
//         let mut t = Tracker::new();
//         t.set_session_info(
//             "my-asset".into(), "my-session".into(),
//             "https://example.com".into(),
//             JsValue::NULL, JsValue::NULL,
//             None,
//         );
//         t.log_click(0.0, 0.0);
//         let result = t.export_encrypted_payload().unwrap();
//         let data = get_field(&result, "data");
//         assert_eq!(get_field(&data, "asset_id").as_string().unwrap(), "my-asset");
//         assert_eq!(get_field(&data, "session_id").as_string().unwrap(), "my-session");
//         assert_eq!(get_field(&data, "page_url").as_string().unwrap(), "https://example.com");
//     }

//     #[wasm_bindgen_test]
//     fn test_scroll_depth_in_payload() {
//         let mut t = tracker_with_session();
//         t.update_scroll(65.0);
//         t.log_click(0.0, 0.0);
//         let result = t.export_encrypted_payload().unwrap();
//         assert_eq!(get_field(&get_field(&result, "data"), "scroll_depth").as_f64().unwrap(), 65.0);
//     }

//     #[wasm_bindgen_test]
//     fn test_time_on_page_in_payload() {
//         let mut t = tracker_with_session();
//         t.tick(12.0);
//         t.log_click(0.0, 0.0);
//         let result = t.export_encrypted_payload().unwrap();
//         assert_eq!(get_field(&get_field(&result, "data"), "time_on_page").as_f64().unwrap(), 12.0);
//     }

//     #[wasm_bindgen_test]
//     fn test_entry_exit_in_payload() {
//         let mut t = tracker_with_session();
//         t.log_entry_page("https://example.com/in".into());
//         t.log_exit_page("https://example.com/out".into());
//         t.log_click(0.0, 0.0);
//         let result = t.export_encrypted_payload().unwrap();
//         let data = get_field(&result, "data");
//         assert_eq!(get_field(&data, "entry_page").as_string().unwrap(), "https://example.com/in");
//         assert_eq!(get_field(&data, "exit_page").as_string().unwrap(), "https://example.com/out");
//     }

//     // ─── 16. EventQueue capacity ───────────────

//     #[wasm_bindgen_test]
//     fn test_queue_is_full_signal() {
//         use crate::event::EventQueue;
//         use crate::event::Event;
//         let mut q = EventQueue::new(3);
//         assert!(!q.is_full());
//         q.push(Event::Custom { name: "a".into(), data: "{}".into(), timestamp: 0.0 });
//         q.push(Event::Custom { name: "b".into(), data: "{}".into(), timestamp: 0.0 });
//         q.push(Event::Custom { name: "c".into(), data: "{}".into(), timestamp: 0.0 });
//         assert!(q.is_full());
//     }

//     // ─── 17. SessionContext readiness ──────────

//     #[wasm_bindgen_test]
//     fn test_session_not_ready_without_fields() {
//         use crate::session::SessionContext;
//         let s = SessionContext::new();
//         assert!(!s.is_ready());
//     }

//     #[wasm_bindgen_test]
//     fn test_session_ready_after_set() {
//         use crate::session::SessionContext;
//         let mut s = SessionContext::new();
//         s.set(
//             "a".into(), "b".into(), "https://x.com".into(),
//             serde_json::Value::Null, serde_json::Value::Null,
//             None,
//         );
//         assert!(s.is_ready());
//     }
// }