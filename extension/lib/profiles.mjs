// Endpoint profile storage shape: { profiles: [{ id, name, baseUrl, apiKey, model }], activeProfileId }.
// Replaces the original flat { baseUrl, apiKey, model } object stored under the
// same key; normalizeSettings migrates the old shape so upgrades keep the saved endpoint.

export const DEFAULT_PROFILE_VALUES = Object.freeze({
  baseUrl: 'http://127.0.0.1:11434',
  apiKey: '',
  model: '',
});

const DEFAULT_PROFILE_NAME = 'Default';

function asTrimmedString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function sanitizeProfile(raw, makeId, index) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return {
    id: asTrimmedString(raw.id) || makeId(),
    name: asTrimmedString(raw.name, `Profile ${index + 1}`),
    baseUrl: asTrimmedString(raw.baseUrl, DEFAULT_PROFILE_VALUES.baseUrl),
    apiKey: asTrimmedString(raw.apiKey),
    model: asTrimmedString(raw.model),
  };
}

function defaultProfile(makeId) {
  return { id: makeId(), name: DEFAULT_PROFILE_NAME, ...DEFAULT_PROFILE_VALUES };
}

export function normalizeSettings(stored, makeId = () => crypto.randomUUID()) {
  const source = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};

  let profiles;
  if (Array.isArray(source.profiles)) {
    profiles = source.profiles.map((raw, index) => sanitizeProfile(raw, makeId, index)).filter(Boolean);
  } else if (asTrimmedString(source.baseUrl) || asTrimmedString(source.apiKey) || asTrimmedString(source.model)) {
    // Legacy flat { baseUrl, apiKey, model } shape.
    profiles = [{
      id: makeId(),
      name: DEFAULT_PROFILE_NAME,
      baseUrl: asTrimmedString(source.baseUrl, DEFAULT_PROFILE_VALUES.baseUrl),
      apiKey: asTrimmedString(source.apiKey),
      model: asTrimmedString(source.model),
    }];
  } else {
    profiles = [];
  }

  if (!profiles.length) profiles = [defaultProfile(makeId)];

  const seenIds = new Set();
  for (const profile of profiles) {
    while (seenIds.has(profile.id)) profile.id = makeId();
    seenIds.add(profile.id);
  }

  const activeProfileId = seenIds.has(source.activeProfileId) ? source.activeProfileId : profiles[0].id;
  return { profiles, activeProfileId };
}

export function getActiveProfile(settings) {
  const profiles = Array.isArray(settings?.profiles) ? settings.profiles : [];
  return profiles.find((profile) => profile?.id === settings.activeProfileId) || profiles[0] || null;
}
