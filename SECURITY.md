# Security Policy

Pageside feeds untrusted web page content into an LLM prompt and renders LLM
output into extension UI, so its security posture is central to the project.
Reports about weaknesses in that pipeline are very welcome.

## Reporting a vulnerability

Please use [GitHub private vulnerability reporting](../../security/advisories/new)
rather than opening a public issue. You should hear back within a week. This is
an unpaid hobby project — there is no bug bounty, but reporters are credited in
the fix unless they prefer otherwise.

## Scope

Reports of particular interest:

- **Secret-redaction bypass** — page content that reaches the prompt with API
  keys, tokens, or other secrets intact despite `extension/lib/redaction.mjs`
  (and its inline mirror in `extension/content.js`).
- **Restricted-URL guard bypass** — capture running on pages that
  `isRestrictedUrl` in `extension/lib/browser-context-protocol.mjs` should
  block (browser internals, credential-bearing URLs, banking/password/medical
  pages).
- **Markdown renderer injection** — assistant output that escapes
  `extension/lib/markdown.mjs` into script execution, `<img>`/network fetches,
  or other active content.
- **Prompt-context boundary issues** — page content escaping the
  `UNTRUSTED_BROWSER_CONTEXT` delimiters in a way the model is likely to treat
  as instructions from the user.

Out of scope: the behavior of whatever model or endpoint you connect the
extension to, and social-engineering attacks that require the user to paste
secrets into the chat themselves.

## Supported versions

Only the latest commit on `main` is supported.
