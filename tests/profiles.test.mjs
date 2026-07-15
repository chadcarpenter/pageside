import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PROFILE_VALUES,
  getActiveProfile,
  normalizeSettings,
} from '../extension/lib/profiles.mjs';

function sequentialIds() {
  let next = 0;
  return () => `id-${(next += 1)}`;
}

test('normalizeSettings creates a single default profile from nothing', () => {
  for (const stored of [undefined, null, {}, 'garbage', 42, []]) {
    const settings = normalizeSettings(stored, sequentialIds());
    assert.equal(settings.profiles.length, 1);
    assert.deepEqual(settings.profiles[0], { id: 'id-1', name: 'Default', ...DEFAULT_PROFILE_VALUES });
    assert.equal(settings.activeProfileId, 'id-1');
  }
});

test('normalizeSettings migrates the legacy flat shape, preserving values', () => {
  const settings = normalizeSettings(
    { baseUrl: 'http://127.0.0.1:8642', apiKey: 'secret', model: 'hermes-agent' },
    sequentialIds(),
  );
  assert.deepEqual(settings, {
    profiles: [{ id: 'id-1', name: 'Default', baseUrl: 'http://127.0.0.1:8642', apiKey: 'secret', model: 'hermes-agent' }],
    activeProfileId: 'id-1',
  });
});

test('normalizeSettings passes an already-migrated shape through unchanged', () => {
  const stored = {
    profiles: [
      { id: 'a', name: 'Hermes', baseUrl: 'http://127.0.0.1:8642', apiKey: 'k', model: 'hermes-agent' },
      { id: 'b', name: 'Ollama', baseUrl: 'http://127.0.0.1:11434', apiKey: '', model: 'llama3.1:8b' },
    ],
    activeProfileId: 'b',
  };
  assert.deepEqual(normalizeSettings(stored, sequentialIds()), stored);
});

test('normalizeSettings is idempotent on a migrated legacy shape', () => {
  const once = normalizeSettings({ baseUrl: 'http://x', model: 'm' }, sequentialIds());
  assert.deepEqual(normalizeSettings(once, sequentialIds()), once);
});

test('normalizeSettings repairs a dangling activeProfileId', () => {
  const settings = normalizeSettings(
    { profiles: [{ id: 'a', name: 'One' }], activeProfileId: 'gone' },
    sequentialIds(),
  );
  assert.equal(settings.activeProfileId, 'a');
});

test('normalizeSettings drops malformed entries and fills missing fields', () => {
  const settings = normalizeSettings(
    { profiles: [null, 'junk', ['nope'], { apiKey: 42, model: '  m1  ' }], activeProfileId: 'x' },
    sequentialIds(),
  );
  assert.deepEqual(settings.profiles, [
    { id: 'id-1', name: 'Profile 4', baseUrl: DEFAULT_PROFILE_VALUES.baseUrl, apiKey: '', model: 'm1' },
  ]);
  assert.equal(settings.activeProfileId, 'id-1');
});

test('normalizeSettings replaces an empty profiles array with a default profile', () => {
  const settings = normalizeSettings({ profiles: [], activeProfileId: 'x' }, sequentialIds());
  assert.equal(settings.profiles.length, 1);
  assert.equal(settings.profiles[0].name, 'Default');
  assert.equal(settings.activeProfileId, settings.profiles[0].id);
});

test('normalizeSettings deduplicates colliding profile ids', () => {
  const settings = normalizeSettings(
    { profiles: [{ id: 'a', name: 'One' }, { id: 'a', name: 'Two' }], activeProfileId: 'a' },
    sequentialIds(),
  );
  const ids = settings.profiles.map((profile) => profile.id);
  assert.equal(new Set(ids).size, 2);
  assert.equal(settings.activeProfileId, 'a');
  assert.equal(getActiveProfile(settings).name, 'One');
});

test('getActiveProfile returns the matching profile or falls back to the first', () => {
  const settings = {
    profiles: [{ id: 'a', name: 'One' }, { id: 'b', name: 'Two' }],
    activeProfileId: 'b',
  };
  assert.equal(getActiveProfile(settings).name, 'Two');
  assert.equal(getActiveProfile({ ...settings, activeProfileId: 'gone' }).name, 'One');
  assert.equal(getActiveProfile({}), null);
});
