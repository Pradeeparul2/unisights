# CLAUDE.md — Unisights AI Guidelines

## 🧠 Project Overview

Unisights is a privacy-first analytics system built as a monorepo:

- `packages/core` → Rust + WASM (tracking engine)
- `packages/unisights` → Browser SDK
- `packages/node` → Node.js receiver
- `packages/python` → Python receiver
- `e2e/` → Playwright end-to-end tests

Architecture:

Browser (WASM) → sendBeacon → Backend → Storage

---

## ⚡ Global Behavior Rules (STRICT)

- Be concise
- Output minimal code only
- Avoid full file generation
- Prefer extending existing code
- Do not repeat context
- Do not scan entire repo unnecessarily

---

## 📚 Context Loading Strategy (CRITICAL)

Each package has its own README.

### MUST follow:

- Load ONLY relevant package context:
  - Browser issues → `packages/unisights`
  - WASM logic → `packages/core`
  - Backend issues → `packages/node` or `packages/python`
  - Testing → `e2e/`

- DO NOT load entire repo unless explicitly required

---

## 🧩 Code Generation Rules

- NEVER generate full files unless asked
- ALWAYS:
  - generate minimal diffs
  - or small code snippets

Assume existing:

- imports
- helpers
- setup

---

## 🧪 E2E Testing Rules (CRITICAL)

Follow existing pattern in `/e2e`:

### Required Flow

1. Load page with endpoint
2. Wait for `window.unisights`
3. Trigger event
4. Call:
   window.unisights.flushNow()
5. Poll backend:
   GET /test/events
6. Validate payload

---

### ❌ Forbidden

- page.on('request')
- network interception

---

### ✅ Required

- expect.poll()
- backend validation
- existing helper (e.g., getPayload)

---

## 🌐 Backend Contract (MANDATORY)

All frameworks must expose:

POST /collect-${name}/event  
GET /test/events  
GET /test/clear

- Use in-memory storage for testing
- Auto-decryption handled by SDK

---

## 🔐 Encryption Awareness

- Encryption is optional (`encrypt: true`)
- Backend auto-decrypts payload
- NEVER suggest manual decryption

---

## 📊 Event Model

Payload:
response.data.events[]

Each event:

- event → string
- timestamp → number
- data → optional

---

## 🎯 Events to Support

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

- CLS, INP, LCP, FCP, TTFB

### Custom

- custom_event

---

## 🧠 Pattern Reuse (MANDATORY)

- Analyze `/e2e` before generating tests
- Follow:
  - naming
  - helper usage
  - assertions

---

## ⚙️ Multi-Framework Rule

All tests must work across:

- Node: Express, NestJS, Fastify, Koa, Hono, Elysia
- Python: FastAPI, Flask, Django
- Edge: Cloudflare, Vercel, Netlify
- Runtimes: Deno, Bun

Use:

frameworks.forEach(({ name, port }) => {})

---

## 🔍 Debugging Flow

When debugging:

1. Client trigger (DOM / SDK)
2. WASM event generation
3. flushNow execution
4. Backend ingestion
5. Payload validation

---

## 🧪 Output Style

Default:

- minimal
- code-first

If user says "detailed":

- include explanation

---

## 🚀 Token Optimization Rules

- Avoid duplicate code
- Skip boilerplate
- Do not reprint existing helpers
- Prefer extending existing tests
- Load only required files

---

## 🧠 Package Awareness

Each package is independent:

- DO NOT mix concerns
- Keep:
  - WASM logic in `core`
  - SDK logic in `unisights`
  - backend logic in `node/python`

---

## 🎯 Goal

Produce:

- Minimal
- Accurate
- Pattern-consistent
- Production-ready code
