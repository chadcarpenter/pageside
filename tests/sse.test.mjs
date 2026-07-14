import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendOpenAiChunkText,
  extractAssistantText,
  parseSseBlock,
  readSseStream,
  sseBlocksFromBuffer,
} from '../extension/lib/sse.mjs';

function sseResponse(chunks) {
  const encoder = new TextEncoder();
  return {
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
  };
}

function chunkEvent(content) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

test('readSseStream assembles deltas split at awkward byte boundaries', async () => {
  const whole = `${chunkEvent('Hel')}${chunkEvent('lo ')}${chunkEvent('world')}data: [DONE]\n\n`;
  const chunks = [whole.slice(0, 25), whole.slice(25, 26), whole.slice(26, 70), whole.slice(70)];
  const deltas = [];
  const text = await readSseStream(sseResponse(chunks), (t) => deltas.push(t));
  assert.equal(text, 'Hello world');
  assert.equal(deltas.at(-1), 'Hello world');
  assert.ok(deltas.length >= 2);
});

test('readSseStream handles CRLF block delimiters', async () => {
  const body = `data: ${JSON.stringify({ choices: [{ delta: { content: 'Hi' } }] })}\r\n\r\ndata: [DONE]\r\n\r\n`;
  const text = await readSseStream(sseResponse([body]), () => {});
  assert.equal(text, 'Hi');
});

test('readSseStream flushes a final block when the stream closes without [DONE]', async () => {
  const chunks = [chunkEvent('Hi'), `data: ${JSON.stringify({ choices: [{ delta: { content: '!' } }] })}`];
  const text = await readSseStream(sseResponse(chunks), () => {});
  assert.equal(text, 'Hi!');
});

test('readSseStream throws on an error payload mid-stream', async () => {
  const chunks = [chunkEvent('partial'), `data: ${JSON.stringify({ error: { message: 'boom' } })}\n\n`];
  await assert.rejects(readSseStream(sseResponse(chunks), () => {}), /boom/);
});

test('readSseStream aborts via signal with an AbortError', async () => {
  const controller = new AbortController();
  controller.abort();
  const neverEnding = {
    body: new ReadableStream({
      start(streamController) {
        streamController.enqueue(new TextEncoder().encode(chunkEvent('x')));
      },
    }),
  };
  await assert.rejects(
    readSseStream(neverEnding, () => {}, { signal: controller.signal }),
    (error) => error.name === 'AbortError',
  );
});

test('appendOpenAiChunkText ignores [DONE] and reads delta or message content', () => {
  assert.equal(appendOpenAiChunkText({ data: '[DONE]' }, 'kept'), 'kept');
  assert.equal(appendOpenAiChunkText({ json: { choices: [{ delta: { content: 'ab' } }] } }, 'x'), 'xab');
  assert.equal(appendOpenAiChunkText({ json: { choices: [{ message: { content: 'whole' } }] } }, 'x'), 'whole');
});

test('extractAssistantText reads a non-streaming chat.completion body', () => {
  assert.equal(extractAssistantText({ choices: [{ message: { content: 'answer' } }] }), 'answer');
  assert.equal(extractAssistantText({ message: { content: 'direct' } }), 'direct');
  assert.equal(extractAssistantText(null), '');
});

test('parseSseBlock and sseBlocksFromBuffer parse events and buffer remainders', () => {
  const event = parseSseBlock('event: message\ndata: {"a":1}');
  assert.equal(event.type, 'message');
  assert.deepEqual(event.json, { a: 1 });

  const { blocks, rest } = sseBlocksFromBuffer('data: one\n\ndata: partial');
  assert.deepEqual(blocks, ['data: one']);
  assert.equal(rest, 'data: partial');

  const flushed = sseBlocksFromBuffer('data: partial', { flush: true });
  assert.deepEqual(flushed.blocks, ['data: partial']);
  assert.equal(flushed.rest, '');
});
