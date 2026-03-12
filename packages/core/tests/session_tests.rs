use wasm_bindgen_test::*;
use unisights_core::session::SessionContext;

wasm_bindgen_test_configure!(run_in_browser);

fn make_session() -> SessionContext {
    let mut s = SessionContext::new();
    s.set(
        "asset-123".into(),
        "session-abc".into(),
        "https://example.com".into(),
        serde_json::Value::Null,
        serde_json::Value::Null,
        Some("ua1234".into()),
    );
    s
}

// ── Defaults ──────────────────────────────────

#[wasm_bindgen_test]
fn test_new_session_not_ready() {
    let s = SessionContext::new();
    assert!(!s.is_ready());
}

#[wasm_bindgen_test]
fn test_new_session_fields_none() {
    let s = SessionContext::new();
    assert!(s.asset_id.is_none());
    assert!(s.session_id.is_none());
    assert!(s.page_url.is_none());
    assert!(s.entry_page.is_none());
    assert!(s.exit_page.is_none());
    assert!(s.ua_hash.is_none());
}

// ── is_ready ──────────────────────────────────

#[wasm_bindgen_test]
fn test_ready_after_full_set() {
    let s = make_session();
    assert!(s.is_ready());
}

#[wasm_bindgen_test]
fn test_not_ready_missing_asset_id() {
    let mut s = SessionContext::new();
    s.set(
        "".into(), "session-abc".into(), "https://example.com".into(),
        serde_json::Value::Null, serde_json::Value::Null, None,
    );
    // asset_id is Some("") — is_ready checks is_some() not non-empty
    // so this is ready; test that missing (None) is what blocks it
    let mut s2 = SessionContext::new();
    s2.session_id = Some("session-abc".into());
    s2.page_url = Some("https://example.com".into());
    assert!(!s2.is_ready());
}

#[wasm_bindgen_test]
fn test_not_ready_missing_session_id() {
    let mut s = SessionContext::new();
    s.asset_id = Some("asset-123".into());
    s.page_url = Some("https://example.com".into());
    assert!(!s.is_ready());
}

#[wasm_bindgen_test]
fn test_not_ready_missing_page_url() {
    let mut s = SessionContext::new();
    s.asset_id = Some("asset-123".into());
    s.session_id = Some("session-abc".into());
    assert!(!s.is_ready());
}

#[wasm_bindgen_test]
fn test_ready_without_ua_hash() {
    // ua_hash is optional — should not block is_ready
    let mut s = SessionContext::new();
    s.set(
        "asset-123".into(), "session-abc".into(), "https://example.com".into(),
        serde_json::Value::Null, serde_json::Value::Null,
        None, // no ua_hash
    );
    assert!(s.is_ready());
}

// ── set() ─────────────────────────────────────

#[wasm_bindgen_test]
fn test_set_stores_all_fields() {
    let s = make_session();
    assert_eq!(s.asset_id.as_deref(), Some("asset-123"));
    assert_eq!(s.session_id.as_deref(), Some("session-abc"));
    assert_eq!(s.page_url.as_deref(), Some("https://example.com"));
    assert_eq!(s.ua_hash.as_deref(), Some("ua1234"));
}

#[wasm_bindgen_test]
fn test_set_overwrites_previous() {
    let mut s = make_session();
    s.set(
        "new-asset".into(), "new-session".into(), "https://new.com".into(),
        serde_json::Value::Null, serde_json::Value::Null,
        Some("new-ua".into()),
    );
    assert_eq!(s.asset_id.as_deref(), Some("new-asset"));
    assert_eq!(s.ua_hash.as_deref(), Some("new-ua"));
}

#[wasm_bindgen_test]
fn test_ua_hash_not_in_serialized_payload() {
    let s = make_session();
    let json = serde_json::to_string(&s).unwrap();
    // ua_hash is #[serde(skip)] — must not appear in payload body
    assert!(!json.contains("ua_hash"), "ua_hash must not be serialized into payload");
    assert!(!json.contains("ua1234"), "ua_hash value must not appear in payload");
}

// ── Page URL ──────────────────────────────────

#[wasm_bindgen_test]
fn test_set_page_url() {
    let mut s = make_session();
    s.set_page_url("https://example.com/new-page".into());
    assert_eq!(s.page_url.as_deref(), Some("https://example.com/new-page"));
}

#[wasm_bindgen_test]
fn test_set_page_url_overwrites() {
    let mut s = make_session();
    s.set_page_url("https://first.com".into());
    s.set_page_url("https://second.com".into());
    assert_eq!(s.page_url.as_deref(), Some("https://second.com"));
}

// ── Entry / exit page ─────────────────────────

#[wasm_bindgen_test]
fn test_set_entry_page() {
    let mut s = make_session();
    s.set_entry_page("https://example.com/entry".into());
    assert_eq!(s.entry_page.as_deref(), Some("https://example.com/entry"));
}

#[wasm_bindgen_test]
fn test_set_exit_page() {
    let mut s = make_session();
    s.set_exit_page("https://example.com/exit".into());
    assert_eq!(s.exit_page.as_deref(), Some("https://example.com/exit"));
}

#[wasm_bindgen_test]
fn test_entry_exit_independent() {
    let mut s = make_session();
    s.set_entry_page("https://example.com/in".into());
    s.set_exit_page("https://example.com/out".into());
    assert_eq!(s.entry_page.as_deref(), Some("https://example.com/in"));
    assert_eq!(s.exit_page.as_deref(), Some("https://example.com/out"));
}