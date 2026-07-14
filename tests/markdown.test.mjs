import test from 'node:test';
import assert from 'node:assert/strict';

import { escapeHtml, renderMarkdown } from '../extension/lib/markdown.mjs';

test('escapeHtml escapes all HTML metacharacters', () => {
  assert.equal(escapeHtml(`<img src="x" onerror='y'> & more`), '&lt;img src=&quot;x&quot; onerror=&#39;y&#39;&gt; &amp; more');
});

test('raw HTML in model output is escaped, never rendered', () => {
  const html = renderMarkdown('<img src=x onerror=alert(1)>');
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test('javascript: links render as plain text', () => {
  const html = renderMarkdown('[click me](javascript:alert(1))');
  assert.doesNotMatch(html, /<a /);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /click me/);
});

test('markdown images render as links, never <img>', () => {
  const inline = renderMarkdown('See ![diagram](https://example.com/x.png) here');
  const block = renderMarkdown('![diagram](https://example.com/x.png)');
  for (const html of [inline, block]) {
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /<a href="https:\/\/example\.com\/x\.png"/);
    assert.match(html, /rel="noopener noreferrer"/);
  }
});

test('code fences escape their contents', () => {
  const html = renderMarkdown('```html\n<script>alert(1)</script>\n```');
  assert.match(html, /<pre><code data-lang="html">/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('secrets in model output are redacted before rendering', () => {
  const html = renderMarkdown('Your key is sk-abcdefghijklmnop123456 — keep it safe.');
  assert.doesNotMatch(html, /sk-abcdefghijklmnop123456/);
  assert.match(html, /\[REDACTED_SECRET\]/);
});

test('basic markdown structure renders', () => {
  assert.equal(renderMarkdown('**bold** and *em*'), '<p><strong>bold</strong> and <em>em</em></p>');
  assert.match(renderMarkdown('- one\n- two'), /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(renderMarkdown('# Title'), /<h1>Title<\/h1>/);
  assert.match(renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |'), /<table>/);
});
