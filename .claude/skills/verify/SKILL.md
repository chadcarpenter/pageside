---
name: verify
description: Verify Pageside side-panel changes by running the real sidepanel UI in a plain browser tab with a chrome.* shim and a mock OpenAI-compatible SSE endpoint.
---

# Verifying Pageside changes

The extension is MV3 and can't be loaded into a managed/automated browser pane, but the
side panel is just HTML/JS/CSS — it runs in a normal tab if you shim the `chrome.*` APIs.

## Recipe (scratchpad harness, ~3 files)

1. **harness.html** — generate from the real page so markup never drifts:
   `sed -e 's|href="sidepanel.css"|href="ext/sidepanel.css"|' -e 's|<script type="module" src="sidepanel.js"></script>|<script src="chrome-shim.js"></script>\n<script type="module" src="ext/sidepanel.js"></script>|' extension/sidepanel.html > harness.html`
2. **chrome-shim.js** — classic script defining `window.chrome` before the module loads:
   - `storage.local.get/set` backed by `localStorage` key `shim-chrome-storage`
     (JSON object keyed like chrome storage) — persistence survives reload, and you can
     seed legacy shapes via devtools/`javascript_tool` before a reload.
   - `tabs.query` → `[{ id: 1, url: 'https://example.com/article', title: 'Example Article', active: true }]`
   - `tabs.sendMessage` → a fake ok page-context `{ ok: true, title, url, text, selectedText: '', meta: { headings: [] } }`
   - `tabs.onActivated/onUpdated` → `{ addListener() {} }`; `scripting.executeScript` → `[{ result: null }]`
3. **server.mjs** — one node `http` server (no deps) serving `/` → harness.html,
   `/chrome-shim.js`, `/ext/*` → the repo's `extension/` dir (set `Content-Type:
   text/javascript` for `.js`/`.mjs` — ES modules fail on wrong MIME), **plus** a mock
   `POST /v1/chat/completions` that streams a few SSE deltas echoing `body.model`, then
   `data: [DONE]`, and logs `model=… auth=…` so you can assert which profile's config hit
   the wire. Same origin as the harness → no CORS setup. Point a profile's Base URL at it.

## Driving it

- Resize the Browser pane to ~420×800 (side-panel proportions).
- Seed states through `localStorage.setItem('shim-chrome-storage', …)` + reload.
- The automation's synthetic Return key does NOT trigger the textarea's Enter-to-send
  handler — click the Send button instead (the handler itself is fine; verified via
  dispatched `KeyboardEvent`).
- Error path: point the active profile at an unused port and send — expect the friendly
  "Can't reach …" bubble.
