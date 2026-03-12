use crate::encryption::EncryptionConfig;
use crate::event::{Event, EventQueue};
use crate::session::SessionContext;
use wasm_bindgen::JsValue;

const DEFAULT_QUEUE_CAPACITY: usize = 100;

pub struct Tracker {
    pub queue: EventQueue,
    pub scroll_depth: f64,
    pub time_on_page: f64,
    pub session: SessionContext,
    pub encryption: EncryptionConfig,
}

impl Tracker {
    pub fn new() -> Self {
        Self {
            queue: EventQueue::new(DEFAULT_QUEUE_CAPACITY),
            scroll_depth: 0.0,
            time_on_page: 0.0,
            session: SessionContext::new(),
            encryption: EncryptionConfig::new(),
        }
    }

    // ─── Events ────────────────────────────────

    pub fn log_click(&mut self, x: f64, y: f64, timestamp: f64) {
        self.queue.push(Event::Click { x, y, timestamp });
    }

    pub fn log_page_view(&mut self, url: String, title: Option<String>, timestamp: f64) {
        self.session.set_page_url(url.clone());
        self.queue.push(Event::PageView {
            location: url,
            title,
            timestamp,
        });
    }

    pub fn log_custom_event(&mut self, name: String, data: String, timestamp: f64) {
        self.queue.push(Event::Custom { name, data, timestamp });
    }

    pub fn log_web_vital(
        &mut self,
        name: String,
        value: f64,
        id: String,
        rating: String,
        delta: f64,
        entries: usize,
        navigation_type: String,
        timestamp: f64,
    ) {
        self.queue.push(Event::WebVital {
            name,
            value,
            id,
            rating,
            delta,
            entries,
            navigation_type,
            timestamp,
        });
    }

    pub fn log_error(
        &mut self,
        message: String,
        source: Option<String>,
        lineno: Option<u32>,
        colno: Option<u32>,
        timestamp: f64,
    ) {
        self.queue.push(Event::Error {
            message,
            source,
            lineno,
            colno,
            timestamp,
        });
    }

    // ─── Session ───────────────────────────────

    pub fn set_session(
        &mut self,
        asset_id: String,
        session_id: String,
        page_url: String,
        utm_params: serde_json::Value,
        device_info: serde_json::Value,
        ua_hash: Option<String>,
    ) {
        self.session.set(asset_id, session_id, page_url, utm_params, device_info, ua_hash);
    }

    // ─── Scroll / Time ─────────────────────────

    pub fn update_scroll(&mut self, percent: f64) {
        self.scroll_depth = self.scroll_depth.max(percent);
    }

    pub fn tick(&mut self, seconds: f64) {
        self.time_on_page += seconds;
    }

    pub fn clear_events(&mut self) {
        self.queue.clear();
    }

    // ─── Export ────────────────────────────────

    pub fn build_payload(&self) -> Result<AnalyticsPayload, JsValue> {
        if self.queue.is_empty() {
            return Err(JsValue::from_str("No events to export"));
        }
        if !self.session.is_ready() {
            return Err(JsValue::from_str(
                "Session info incomplete: asset_id, session_id, and page_url are required",
            ));
        }

        Ok(AnalyticsPayload {
            asset_id: self.session.asset_id.clone().unwrap(),
            session_id: self.session.session_id.clone().unwrap(),
            page_url: self.session.page_url.clone().unwrap(),
            entry_page: self.session.entry_page.clone(),
            exit_page: self.session.exit_page.clone(),
            utm_params: self.session.utm_params.clone(),
            device_info: self.session.device_info.clone(),
            events: self.queue.as_slice().to_vec(),
            scroll_depth: self.scroll_depth,
            time_on_page: self.time_on_page,
        })
    }
}

// ─────────────────────────────────────────────
// Payload
// ─────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct AnalyticsPayload {
    pub asset_id: String,
    pub session_id: String,
    pub page_url: String,
    pub entry_page: Option<String>,
    pub exit_page: Option<String>,
    pub utm_params: serde_json::Value,
    pub device_info: serde_json::Value,
    pub events: Vec<Event>,
    pub scroll_depth: f64,
    pub time_on_page: f64,
}