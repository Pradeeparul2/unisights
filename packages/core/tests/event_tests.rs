use wasm_bindgen_test::*;
use unisights_core::event::{Event, EventQueue};

wasm_bindgen_test_configure!(run_in_browser);

// ── EventQueue ────────────────────────────────

#[wasm_bindgen_test]
fn test_queue_starts_empty() {
    let q = EventQueue::new(10);
    assert_eq!(q.len(), 0);
    assert!(q.is_empty());
}

#[wasm_bindgen_test]
fn test_push_increases_len() {
    let mut q = EventQueue::new(10);
    q.push(Event::Click { x: 1.0, y: 2.0, timestamp: 0.0 });
    assert_eq!(q.len(), 1);
    assert!(!q.is_empty());
}

#[wasm_bindgen_test]
fn test_is_full_at_capacity() {
    let mut q = EventQueue::new(2);
    assert!(!q.is_full());
    q.push(Event::Click { x: 0.0, y: 0.0, timestamp: 0.0 });
    assert!(!q.is_full());
    q.push(Event::Click { x: 1.0, y: 1.0, timestamp: 1.0 });
    assert!(q.is_full());
}

#[wasm_bindgen_test]
fn test_clear_resets_len() {
    let mut q = EventQueue::new(10);
    q.push(Event::Click { x: 0.0, y: 0.0, timestamp: 0.0 });
    q.push(Event::Click { x: 1.0, y: 1.0, timestamp: 1.0 });
    q.clear();
    assert_eq!(q.len(), 0);
    assert!(q.is_empty());
}

#[wasm_bindgen_test]
fn test_drain_returns_all_events() {
    let mut q = EventQueue::new(10);
    q.push(Event::Click { x: 1.0, y: 2.0, timestamp: 0.0 });
    q.push(Event::Custom { name: "test".into(), data: "{}".into(), timestamp: 1.0 });
    let drained = q.drain();
    assert_eq!(drained.len(), 2);
    assert!(q.is_empty());
}

#[wasm_bindgen_test]
fn test_as_slice_preserves_order() {
    let mut q = EventQueue::new(10);
    q.push(Event::Click { x: 1.0, y: 0.0, timestamp: 100.0 });
    q.push(Event::Click { x: 2.0, y: 0.0, timestamp: 200.0 });
    q.push(Event::Click { x: 3.0, y: 0.0, timestamp: 300.0 });
    let slice = q.as_slice();
    assert_eq!(slice.len(), 3);
    // verify timestamps are in insertion order
    if let Event::Click { timestamp, .. } = slice[0] { assert_eq!(timestamp, 100.0); }
    if let Event::Click { timestamp, .. } = slice[2] { assert_eq!(timestamp, 300.0); }
}

// ── Event variants ────────────────────────────

#[wasm_bindgen_test]
fn test_click_event_fields() {
    let mut q = EventQueue::new(10);
    q.push(Event::Click { x: 42.5, y: 99.1, timestamp: 123.0 });
    if let Event::Click { x, y, timestamp } = &q.as_slice()[0] {
        assert_eq!(*x, 42.5);
        assert_eq!(*y, 99.1);
        assert_eq!(*timestamp, 123.0);
    } else {
        panic!("expected Click event");
    }
}

#[wasm_bindgen_test]
fn test_page_view_with_title() {
    let mut q = EventQueue::new(10);
    q.push(Event::PageView {
        location: "https://example.com".into(),
        title: Some("Home".into()),
        timestamp: 0.0,
    });
    if let Event::PageView { location, title, .. } = &q.as_slice()[0] {
        assert_eq!(location, "https://example.com");
        assert_eq!(title.as_deref(), Some("Home"));
    } else {
        panic!("expected PageView event");
    }
}

#[wasm_bindgen_test]
fn test_page_view_without_title() {
    let mut q = EventQueue::new(10);
    q.push(Event::PageView {
        location: "https://example.com".into(),
        title: None,
        timestamp: 0.0,
    });
    if let Event::PageView { title, .. } = &q.as_slice()[0] {
        assert!(title.is_none());
    }
}

#[wasm_bindgen_test]
fn test_web_vital_event_fields() {
    let mut q = EventQueue::new(10);
    q.push(Event::WebVital {
        name: "LCP".into(),
        value: 1200.0,
        id: "v1-abc".into(),
        rating: "good".into(),
        delta: 1200.0,
        entries: 1,
        navigation_type: "navigate".into(),
        timestamp: 0.0,
    });
    if let Event::WebVital { name, rating, .. } = &q.as_slice()[0] {
        assert_eq!(name, "LCP");
        assert_eq!(rating, "good");
    } else {
        panic!("expected WebVital event");
    }
}

#[wasm_bindgen_test]
fn test_custom_event_fields() {
    let mut q = EventQueue::new(10);
    q.push(Event::Custom {
        name: "purchase".into(),
        data: r#"{"amount":99}"#.into(),
        timestamp: 0.0,
    });
    if let Event::Custom { name, data, .. } = &q.as_slice()[0] {
        assert_eq!(name, "purchase");
        assert_eq!(data, r#"{"amount":99}"#);
    } else {
        panic!("expected Custom event");
    }
}

#[wasm_bindgen_test]
fn test_error_event_fields() {
    let mut q = EventQueue::new(10);
    q.push(Event::Error {
        message: "TypeError: null".into(),
        source: Some("app.js".into()),
        lineno: Some(42),
        colno: Some(7),
        timestamp: 0.0,
    });
    if let Event::Error { message, source, lineno, colno, .. } = &q.as_slice()[0] {
        assert_eq!(message, "TypeError: null");
        assert_eq!(source.as_deref(), Some("app.js"));
        assert_eq!(*lineno, Some(42));
        assert_eq!(*colno, Some(7));
    } else {
        panic!("expected Error event");
    }
}

#[wasm_bindgen_test]
fn test_error_event_minimal() {
    let mut q = EventQueue::new(10);
    q.push(Event::Error {
        message: "oops".into(),
        source: None,
        lineno: None,
        colno: None,
        timestamp: 0.0,
    });
    if let Event::Error { source, lineno, colno, .. } = &q.as_slice()[0] {
        assert!(source.is_none());
        assert!(lineno.is_none());
        assert!(colno.is_none());
    }
}