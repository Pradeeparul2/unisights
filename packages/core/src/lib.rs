pub mod encryption;
pub mod event;
pub mod session;
pub mod tracker;

#[cfg(test)]
mod tests;

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