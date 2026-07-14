# Page Chat

A minimal Chrome (Manifest V3) side-panel extension: a chat sidebar about the page you're on — in the spirit of Dia browser's sidebar — that talks to **any OpenAI-compatible endpoint**.

It is a hard-fork distillation of [hermes-browser-extension](https://github.com/abundantbeing/hermes-browser-extension) by Jon Komet: the page-capture pipeline and its untrusted-content security model are kept nearly intact; the sessions/skills/themes/tools/voice/cloud UI is gone.

## What it does

- One transcript, one **"Ask about this page…"** textarea, one **Include page context** toggle.
- Streams replies from `POST {baseUrl}/v1/chat/completions` (SSE), with a Stop button mid-stream.
- With the toggle on, the active tab's readable text, selection, and metadata are wrapped in `UNTRUSTED_BROWSER_CONTEXT` delimiters and attached to your message. Only the current turn carries page context — history goes up as plain text.
- The last conversation persists across panel closes; **Clear** wipes it.

## Security model (inherited from Hermes Browser Extension)

- Page content is treated as untrusted data: delimited in the prompt, rendered in the UI via `textContent` (assistant markdown goes through a reviewed escaping renderer; markdown images render as links, never `<img>`).
- Secrets (API keys, tokens, JWTs, private keys, `key=value` assignments) are redacted at capture **and** again at prompt build.
- Restricted URLs are never read: browser internals (`chrome://`, `file:` …), credential-bearing URLs, and sensitive pages (banks, crypto, password managers, checkout/billing/payments, medical, tax).

## Install (load unpacked)

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select this repo's `extension/` folder.
2. Click the Page Chat toolbar button — the side panel opens and settings appear on first run.
3. Set **Base URL**, **API key** (blank if the server needs none), and **Model**.

While developing, load it in a dedicated Chrome profile to keep it isolated from your daily-driver profile.

### Endpoint examples

| Server | Base URL | API key |
| --- | --- | --- |
| Hermes local gateway | `http://127.0.0.1:8642` | gateway token |
| Ollama | `http://127.0.0.1:11434` | leave blank |
| LM Studio | `http://127.0.0.1:1234` | leave blank |
| OpenAI-compatible cloud | `https://…` | provider key |

Base URLs with or without a trailing `/v1` both work.

## Development

No build step, no dependencies — the extension loads straight from `extension/`.

```sh
npm run verify   # node --test tests/*.test.mjs + syntax checks
```

Layout:

- `extension/sidepanel.{html,css,js}` — the whole UI and chat loop
- `extension/content.js` — classic content script that captures page text (cannot import modules, hence its inline redaction mirror)
- `extension/lib/browser-context-protocol.mjs` — prompt assembly, restricted-URL privacy guard
- `extension/lib/redaction.mjs` — secret redaction (canonical copy)
- `extension/lib/sse.mjs` — OpenAI SSE stream parsing
- `extension/lib/markdown.mjs` — escaping markdown renderer (no image loading by design)

## License

MIT — see [LICENSE](LICENSE). Derived from [hermes-browser-extension](https://github.com/abundantbeing/hermes-browser-extension), © 2026 Jon Komet.
