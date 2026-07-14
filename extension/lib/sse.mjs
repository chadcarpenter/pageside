/**
 * SSE parsing for OpenAI-compatible /v1/chat/completions streams.
 * parseSseBlock/sseBlocksFromBuffer/appendOpenAiChunkText/extractAssistantText
 * are carried over from the Hermes Browser Extension; readSseStream keeps only
 * the OpenAI event branches.
 */

export function parseSseBlock(block) {
  const event = { type: 'message', data: '' };
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) event.type = line.slice(6).trim();
    if (line.startsWith('data:')) event.data += `${line.slice(5).trim()}\n`;
  }
  event.data = event.data.trim();
  if (!event.data) return event;
  try {
    event.json = JSON.parse(event.data);
  } catch {
    event.json = null;
  }
  return event;
}

export function sseBlocksFromBuffer(buffer, { flush = false } = {}) {
  const blocks = [];
  let match;
  const boundary = /\r?\n\r?\n/g;
  let start = 0;
  while ((match = boundary.exec(buffer)) !== null) {
    blocks.push(buffer.slice(start, match.index));
    start = boundary.lastIndex;
  }
  const rest = buffer.slice(start);
  if (flush && rest.trim()) {
    blocks.push(rest);
    return { blocks, rest: '' };
  }
  return { blocks, rest };
}

export function appendOpenAiChunkText(event = {}, finalText = '') {
  if (event?.data === '[DONE]') return finalText;
  const choice = (event?.json || {}).choices?.[0] || {};
  const delta = choice.delta?.content;
  if (delta) return `${finalText}${delta}`;
  const message = choice.message?.content;
  if (message) return String(message);
  return finalText;
}

export function extractAssistantText(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (payload.message?.content) return String(payload.message.content);
  const choiceText = payload.choices?.[0]?.message?.content;
  if (choiceText) return String(choiceText);
  if (Array.isArray(payload.output)) {
    const chunks = [];
    for (const item of payload.output) {
      if (item?.type === 'message' && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part?.text) chunks.push(part.text);
        }
      }
      if (item?.type === 'output_text' && item.text) chunks.push(item.text);
    }
    if (chunks.length) return chunks.join('\n');
  }
  if (payload.output_text) return String(payload.output_text);
  if (payload.output) return String(payload.output);
  return '';
}

export async function readSseStream(response, onDelta, { signal } = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalText = '';

  function processBlock(block) {
    const event = parseSseBlock(block);
    const data = event.json || {};
    if (event.type === 'error' || data.error) {
      const detail = data.error?.message || data.message || (typeof data.error === 'string' ? data.error : '') || event.data;
      throw new Error(detail || 'Stream error');
    }
    if (event.type === 'message' || event.type === 'chat.completion.chunk') {
      const nextText = appendOpenAiChunkText(event, finalText);
      if (nextText !== finalText) {
        finalText = nextText;
        onDelta(finalText);
      }
    }
  }

  while (true) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => {});
      throw new DOMException('Generation stopped by user', 'AbortError');
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = sseBlocksFromBuffer(buffer);
    buffer = parsed.rest;
    for (const block of parsed.blocks) processBlock(block);
  }

  buffer += decoder.decode();
  const parsed = sseBlocksFromBuffer(buffer, { flush: true });
  for (const block of parsed.blocks) processBlock(block);
  return finalText;
}
