use wasm_bindgen_test::*;
use unisights_core::tracker::Tracker;

wasm_bindgen_test_configure!(run_in_browser);

fn tracker_with_session() -> Tracker {
    let mut t = Tracker::new();
    t.set_session(
        "asset-123".into(),
        "session-abc".into(),
        "https://example.com".into(),
        serde_json::Value::Null,
        serde_json::Value::Null,
        Some("ua1234".into()),
    );
    t
}

// ── Defaults ──────────────────────────────────

#[wasm_bindgen_test]
fn test_new_tracker_defaults() {
    let t = Tracker::new();
    assert_eq!(t.scroll_depth, 0.0);
    assert_eq!(t.time_on_page, 0.0);
    assert_eq!(t.queue.len(), 0);
    assert!(!t.encryption.enabled);
}

// ── Events ────────────────────────────────────

#[wasm_bindgen_test]
fn test_log_click() {
    let mut t = tracker_with_session();
    t.log_click(10.0, 20.0, 1000.0);
    assert_eq!(t.queue.len(), 1);
}

#[wasm_bindgen_test]
fn test_log_page_view() {
    let mut t = tracker_with_session();
    t.log_page_view("https://example.com/about".into(), Some("About".into()), 1000.0);
    assert_eq!(t.queue.len(), 1);
    assert_eq!(t.session.page_url.as_deref(), Some("https://example.com/about"));
}

#[wasm_bindgen_test]
fn test_log_page_view_updates_url() {
    let mut t = tracker_with_session();
    t.log_page_view("https://example.com/new".into(), None, 0.0);
    assert_eq!(t.session.page_url.as_deref(), Some("https://example.com/new"));
}

#[wasm_bindgen_test]
fn test_log_custom_event() {
    let mut t = tracker_with_session();
    t.log_custom_event("signup".into(), r#"{"plan":"pro"}"#.into(), 0.0);
    assert_eq!(t.queue.len(), 1);
}

#[wasm_bindgen_test]
fn test_log_web_vital() {
    let mut t = tracker_with_session();
    t.log_web_vital(
        "LCP".into(), 1200.0, "v1-abc".into(),
        "good".into(), 1200.0, 1, "navigate".into(), 0.0,
    );
    assert_eq!(t.queue.len(), 1);
}

#[wasm_bindgen_test]
fn test_log_error() {
    let mut t = tracker_with_session();
    t.log_error("TypeError".into(), Some("app.js".into()), Some(10), Some(5), 0.0);
    assert_eq!(t.queue.len(), 1);
}

#[wasm_bindgen_test]
fn test_log_error_minimal() {
    let mut t = tracker_with_session();
    t.log_error("oops".into(), None, None, None, 0.0);
    assert_eq!(t.queue.len(), 1);
}

#[wasm_bindgen_test]
fn test_multiple_events_accumulate() {
    let mut t = tracker_with_session();
    t.log_click(1.0, 2.0, 0.0);
    t.log_click(3.0, 4.0, 1.0);
    t.log_custom_event("test".into(), "{}".into(), 2.0);
    assert_eq!(t.queue.len(), 3);
}

// ── Scroll depth ──────────────────────────────

#[wasm_bindgen_test]
fn test_scroll_depth_starts_zero() {
    let t = Tracker::new();
    assert_eq!(t.scroll_depth, 0.0);
}

#[wasm_bindgen_test]
fn test_scroll_depth_updates() {
    let mut t = Tracker::new();
    t.update_scroll(50.0);
    assert_eq!(t.scroll_depth, 50.0);
}

#[wasm_bindgen_test]
fn test_scroll_depth_never_decreases() {
    let mut t = Tracker::new();
    t.update_scroll(80.0);
    t.update_scroll(30.0);
    assert_eq!(t.scroll_depth, 80.0);
}

#[wasm_bindgen_test]
fn test_scroll_depth_max_wins() {
    let mut t = Tracker::new();
    t.update_scroll(20.0);
    t.update_scroll(100.0);
    t.update_scroll(60.0);
    assert_eq!(t.scroll_depth, 100.0);
}

// ── Time on page ──────────────────────────────

#[wasm_bindgen_test]
fn test_time_on_page_starts_zero() {
    let t = Tracker::new();
    assert_eq!(t.time_on_page, 0.0);
}

#[wasm_bindgen_test]
fn test_time_on_page_accumulates() {
    let mut t = Tracker::new();
    t.tick(10.0);
    t.tick(5.0);
    assert_eq!(t.time_on_page, 15.0);
}

// ── Clear events ──────────────────────────────

#[wasm_bindgen_test]
fn test_clear_resets_queue() {
    let mut t = tracker_with_session();
    t.log_click(1.0, 2.0, 0.0);
    t.log_click(3.0, 4.0, 1.0);
    t.clear_events();
    assert_eq!(t.queue.len(), 0);
}

#[wasm_bindgen_test]
fn test_clear_allows_new_events() {
    let mut t = tracker_with_session();
    t.log_click(1.0, 2.0, 0.0);
    t.clear_events();
    t.log_click(3.0, 4.0, 1.0);
    assert_eq!(t.queue.len(), 1);
}

// ── build_payload ─────────────────────────────

#[wasm_bindgen_test]
fn test_build_payload_succeeds() {
    let mut t = tracker_with_session();
    t.log_click(1.0, 2.0, 0.0);
    assert!(t.build_payload().is_ok());
}

#[wasm_bindgen_test]
fn test_build_payload_fails_no_events() {
    let t = tracker_with_session();
    assert!(t.build_payload().is_err());
}

#[wasm_bindgen_test]
fn test_build_payload_fails_no_session() {
    let mut t = Tracker::new();
    t.log_click(1.0, 2.0, 0.0);
    assert!(t.build_payload().is_err());
}

#[wasm_bindgen_test]
fn test_build_payload_fails_after_clear() {
    let mut t = tracker_with_session();
    t.log_click(1.0, 2.0, 0.0);
    t.clear_events();
    assert!(t.build_payload().is_err());
}

#[wasm_bindgen_test]
fn test_payload_fields() {
    let mut t = tracker_with_session();
    t.update_scroll(75.0);
    t.tick(30.0);
    t.log_click(1.0, 2.0, 0.0);
    let p = t.build_payload().unwrap();
    assert_eq!(p.asset_id, "asset-123");
    assert_eq!(p.session_id, "session-abc");
    assert_eq!(p.page_url, "https://example.com");
    assert_eq!(p.scroll_depth, 75.0);
    assert_eq!(p.time_on_page, 30.0);
    assert_eq!(p.events.len(), 1);
}

#[wasm_bindgen_test]
fn test_payload_entry_exit_page() {
    let mut t = tracker_with_session();
    t.session.set_entry_page("https://example.com/landing".into());
    t.session.set_exit_page("https://example.com/bye".into());
    t.log_click(0.0, 0.0, 0.0);
    let p = t.build_payload().unwrap();
    assert_eq!(p.entry_page.as_deref(), Some("https://example.com/landing"));
    assert_eq!(p.exit_page.as_deref(), Some("https://example.com/bye"));
}

// ── Encryption config ─────────────────────────

#[wasm_bindgen_test]
fn test_encryption_disabled_by_default() {
    let t = Tracker::new();
    assert!(!t.encryption.enabled);
}

#[wasm_bindgen_test]
fn test_encryption_enable_disable() {
    let mut t = Tracker::new();
    t.encryption.configure(true);
    assert!(t.encryption.enabled);
    t.encryption.configure(false);
    assert!(!t.encryption.enabled);
}