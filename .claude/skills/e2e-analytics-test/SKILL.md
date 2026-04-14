---
name: e2e-analytics-test
description: Generate full Playwright E2E test suite for all Unisights analytics events using backend validation
---

# Unisights Full E2E Test Generator

You are an expert in Playwright and analytics systems.

---

## 🚨 STRICT RULES

- ALWAYS follow existing pattern in `/e2e`
- ALWAYS use backend validation (`/test/events`)
- ALWAYS use:
  - flushNow()
  - expect.poll()
- NEVER use network interception

---

## Objective

Generate a COMPLETE E2E test suite that validates ALL supported events.

---

## Events to Cover (STRICT)

You MUST generate tests for ALL of the following:

### Page

- entry_page
- page_view
- exit_page

### Interaction

- click
- rage_click
- dead_click

### Navigation

- outbound_click

### Downloads

- file_download

### Scroll

- scroll

### User Actions

- copy
- paste

### Errors

- js_error
- unhandled_rejection

### Focus

- tab_focus
- tab_blur

### Engagement

- engaged_time

### Web Vitals

- CLS
- INP
- LCP
- FCP
- TTFB

### Custom

- custom_event

---

## Required Structure

- Use existing:
  frameworks.forEach(({ name, port }) => {})
- Reuse helper: getPayload()
- Use same endpoint pattern

---

## Multi-Framework Support (MANDATORY)

- Tests MUST run across all frameworks defined in `frameworks`
- DO NOT create framework-specific tests
- Use loop:

  frameworks.forEach(({ name, port }) => {})

- Dynamically build endpoint:
  /collect-${name}/event

- Ensure compatibility across:
  Node, Python, Edge, Deno, Bun

---

## Validation Rule

Each test must pass for ALL frameworks.
If a framework behaves differently:

- Add conditional handling
- BUT avoid breaking common structure

---

## Test Strategy

### 1. Trigger Event

Use realistic interaction:

- page_view → page load
- click → page.click()
- scroll → page.evaluate(window.scrollTo)
- error → throw JS error
- web_vital → wait for metric OR simulate
- rage_click → rapid clicks
- engagement_time → wait duration

---

### 2. Flush Data

Call:
window.unisights.flushNow()

---

### 3. Fetch Payload

Use:
GET /test/events

---

### 4. Validate Event

Inside:
response.data.events

Find event:
events.find(e => e.event === "EVENT_NAME")

---

### 5. Assertions

Each event must validate:

- event exists
- timestamp exists
- event-specific fields

---

## Output Format

Generate:

1. Single Playwright file OR multiple files
2. Each event has its own test()
3. Follows exact existing style
4. Minimal duplication

---

## Rules

- DO NOT modify existing tests
- DO NOT introduce new architecture
- DO NOT skip any event
- Keep tests stable (no flaky waits)

---

## Example Prompt

"Generate full E2E test suite for all analytics events"
