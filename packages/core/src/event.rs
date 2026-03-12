use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(tag = "type", content = "data")]
pub enum Event {
    #[serde(rename = "click")]
    Click {
        x: f64,
        y: f64,
        timestamp: f64,
    },
    #[serde(rename = "page_view")]
    PageView {
        location: String,
        title: Option<String>,
        timestamp: f64,
    },
    #[serde(rename = "web_vital")]
    WebVital {
        name: String,
        value: f64,
        id: String,
        rating: String,
        delta: f64,
        entries: usize,
        navigation_type: String,
        timestamp: f64,
    },
    #[serde(rename = "custom")]
    Custom {
        name: String,
        data: String,
        timestamp: f64,
    },
    #[serde(rename = "error")]
    Error {
        message: String,
        source: Option<String>,
        lineno: Option<u32>,
        colno: Option<u32>,
        timestamp: f64,
    },
}

/// A fixed-capacity event queue with optional deduplication window.
pub struct EventQueue {
    events: Vec<Event>,
    /// Maximum number of events before the queue signals it's full.
    pub capacity: usize,
}

impl EventQueue {
    pub fn new(capacity: usize) -> Self {
        Self {
            events: Vec::new(),
            capacity,
        }
    }

    /// Returns true if the queue has reached capacity.
    pub fn is_full(&self) -> bool {
        self.events.len() >= self.capacity
    }

    pub fn push(&mut self, event: Event) {
        self.events.push(event);
    }

    pub fn len(&self) -> usize {
        self.events.len()
    }

    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }

    pub fn clear(&mut self) {
        self.events.clear();
    }

    /// Drain all events out of the queue (used for export).
    pub fn drain(&mut self) -> Vec<Event> {
        std::mem::take(&mut self.events)
    }

    /// Peek at events without consuming (used for serialization without clearing).
    pub fn as_slice(&self) -> &[Event] {
        &self.events
    }
}