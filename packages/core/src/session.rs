use serde::Serialize;

/// Holds all session-scoped metadata attached to every exported payload.
#[derive(Clone, Serialize, Default)]
pub struct SessionContext {
    pub asset_id: Option<String>,
    pub session_id: Option<String>,
    pub page_url: Option<String>,
    pub entry_page: Option<String>,
    pub exit_page: Option<String>,
    pub utm_params: serde_json::Value,
    pub device_info: serde_json::Value,

    /// SHA256 hash of the user agent string.
    /// Used only for rolling key derivation — NOT serialized into the analytics
    /// payload body (it appears in the encrypted envelope separately).
    #[serde(skip)]
    pub ua_hash: Option<String>,
}

impl SessionContext {
    pub fn new() -> Self {
        Self {
            utm_params: serde_json::Value::Null,
            device_info: serde_json::Value::Null,
            ..Default::default()
        }
    }

    /// Returns true when the minimum required fields for export are present.
    /// ua_hash is NOT required — encryption is optional.
    pub fn is_ready(&self) -> bool {
        self.asset_id.is_some() && self.session_id.is_some() && self.page_url.is_some()
    }

    pub fn set(
        &mut self,
        asset_id: String,
        session_id: String,
        page_url: String,
        utm_params: serde_json::Value,
        device_info: serde_json::Value,
        ua_hash: Option<String>,
    ) {
        self.asset_id = Some(asset_id);
        self.session_id = Some(session_id);
        self.page_url = Some(page_url);
        self.utm_params = utm_params;
        self.device_info = device_info;
        self.ua_hash = ua_hash;
    }

    pub fn set_page_url(&mut self, url: String) {
        self.page_url = Some(url);
    }

    pub fn set_entry_page(&mut self, url: String) {
        self.entry_page = Some(url);
    }

    pub fn set_exit_page(&mut self, url: String) {
        self.exit_page = Some(url);
    }
}