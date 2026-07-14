/**
 * Escaping markdown renderer for assistant output, carried over from the
 * Hermes Browser Extension with the image pipeline removed: markdown images
 * render as plain links (never <img>), so model output influenced by untrusted
 * page content cannot trigger zero-click network fetches.
 */
import { redactSensitiveText } from './redaction.mjs';

export function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHref(value = '') {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return '';
    return escapeHtml(url.href);
  } catch {
    return '';
  }
}

function renderInlineMarkdown(value = '') {
  const parts = String(value || '').split(/(`[^`]+`)/g);
  return parts.map((part) => {
    if (/^`[^`]+`$/.test(part)) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
    let html = escapeHtml(part);
    html = html.replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, (_match, alt, href) => {
      const safe = safeHref(href);
      return safe ? `<a href="${safe}" target="_blank" rel="noopener noreferrer">${alt || safe}</a>` : '';
    });
    html = html.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_match, text, href) => {
      const safe = safeHref(href);
      return safe ? `<a href="${safe}" target="_blank" rel="noopener noreferrer">${text}</a>` : text;
    });
    html = html.replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_\n][\s\S]*?[^_\n])__/g, '<strong>$1</strong>');
    html = html.replace(/~~([^~\n][\s\S]*?[^~\n])~~/g, '<del>$1</del>');
    html = html.replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,;:!?])/g, '$1<em>$2</em>');
    html = html.replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,;:!?])/g, '$1<em>$2</em>');
    return html;
  }).join('');
}

function isHorizontalRule(line = '') {
  return /^\s{0,3}(([-*_])\s*){3,}\s*$/.test(String(line || ''));
}

function isTableDivider(line = '') {
  return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line);
}

function tableCells(line = '') {
  return String(line || '').trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function renderTableBlock(lines = []) {
  const headers = tableCells(lines[0]);
  const body = lines.slice(2).filter((line) => line.includes('|')).map(tableCells);
  const head = headers.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join('');
  const rows = body.map((row) => `<tr>${headers.map((_header, index) => `<td>${renderInlineMarkdown(row[index] || '')}</td>`).join('')}</tr>`).join('');
  return `<div class="md-table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function flushParagraph(out, paragraph) {
  if (!paragraph.length) return;
  out.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
  paragraph.length = 0;
}

function flushList(out, list) {
  if (!list.items.length) return;
  const tag = list.ordered ? 'ol' : 'ul';
  out.push(`<${tag}>${list.items.map((item) => `<li>${renderListItem(item)}</li>`).join('')}</${tag}>`);
  list.items = [];
  list.ordered = false;
}

function renderListItem(item = '') {
  const task = /^\[([ xX])\]\s+(.+)$/.exec(String(item || ''));
  if (!task) return renderInlineMarkdown(item);
  const checked = task[1].trim().toLowerCase() === 'x';
  return `<span class="md-task ${checked ? 'checked' : ''}" aria-hidden="true">${checked ? '✓' : '□'}</span>${renderInlineMarkdown(task[2])}`;
}

export function renderMarkdown(value = '') {
  const text = redactSensitiveText(String(value || ''));
  if (!text.trim()) return '';
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const paragraph = [];
  const list = { ordered: false, items: [] };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      flushParagraph(out, paragraph);
      flushList(out, list);
      const lang = trimmed.slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      out.push(`<pre><code${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (!trimmed) {
      flushParagraph(out, paragraph);
      flushList(out, list);
      continue;
    }
    if (isHorizontalRule(line)) {
      flushParagraph(out, paragraph);
      flushList(out, list);
      out.push('<hr />');
      continue;
    }
    if (line.includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      flushParagraph(out, paragraph);
      flushList(out, list);
      const tableLines = [line, lines[index + 1]];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        tableLines.push(lines[index]);
        index += 1;
      }
      index -= 1;
      out.push(renderTableBlock(tableLines));
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph(out, paragraph);
      flushList(out, list);
      const level = Math.min(6, heading[1].length);
      out.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const quote = /^>\s+(.+)$/.exec(trimmed);
    if (quote) {
      flushParagraph(out, paragraph);
      flushList(out, list);
      out.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }
    const bullet = /^[-*+]\s+(.+)$/.exec(trimmed);
    const ordered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (bullet || ordered) {
      flushParagraph(out, paragraph);
      const wantOrdered = Boolean(ordered);
      if (list.items.length && list.ordered !== wantOrdered) flushList(out, list);
      list.ordered = wantOrdered;
      list.items.push((bullet || ordered)[1]);
      continue;
    }
    flushList(out, list);
    paragraph.push(trimmed);
  }
  flushParagraph(out, paragraph);
  flushList(out, list);
  return out.join('');
}
