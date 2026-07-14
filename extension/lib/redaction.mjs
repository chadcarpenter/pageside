/**
 * Shared secret redaction helpers for browser-context surfaces.
 */

// Allow an optional quote after the key and before the value so secrets in
// quoted JSON/config are redacted, not just bare key=value assignments.
const SECRET_ASSIGNMENT_RE = /\b(api[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|session[_-]?token|client[_-]?secret|aws[_-]?secret[_-]?access[_-]?key|secret[_-]?access[_-]?key|password|passwd|secret|private[_-]?key)\b["'`]?\s*[:=]\s*["'`]?([^\s'"`;&]+)/gi;
const BEARER_RE = /\bBearer\s+[^\s'"`;&]+/gi;
const OPENAI_STYLE_RE = new RegExp('\\bsk-[A-Za-z0-9_-]{12,}\\b', 'g');
const STRIPE_KEY_RE = /\b[sr]k_(?:live|test)_[0-9A-Za-z]{16,}\b/g;
const AWS_ACCESS_KEY_RE = /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g;
const GITHUB_TOKEN_RE = /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/g;
const GOOGLE_API_KEY_RE = /\bAIza[0-9A-Za-z_-]{35}\b/g;
const SLACK_TOKEN_RE = /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const PEM_PRIVATE_KEY_RE = /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g;

const CREDENTIAL_URL_PARAMETER_NAMES = new Set([
  'apikey',
  'xapikey',
  'accesstoken',
  'authtoken',
  'refreshtoken',
  'sessiontoken',
  'idtoken',
  'csrftoken',
  'bearertoken',
  'token',
  'clientsecret',
  'password',
  'passwd',
  'secret',
  'privatekey',
  'awssecretaccesskey',
  'secretaccesskey',
  'awsaccesskeyid',
  'xamzcredential',
  'xamzsignature',
  'xamzsecuritytoken',
  'xgoogcredential',
  'xgoogsignature',
  'googleaccessid',
  'credential',
  'signature',
  'sig',
]);

function decodedUrlLayers(value = '') {
  const layers = [String(value || '')];
  for (let index = 0; index < 3; index += 1) {
    const current = layers[layers.length - 1].replace(/\+/g, ' ');
    let decoded;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      decoded = current.replace(/%([0-9a-fA-F]{2})/g, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
    }
    if (decoded === layers[layers.length - 1]) break;
    layers.push(decoded);
  }
  return layers;
}

function normalizedCredentialParameterName(value = '') {
  const layers = decodedUrlLayers(value);
  return layers[layers.length - 1].trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function credentialParameterNames(value = '') {
  const names = new Set();
  for (const layer of decodedUrlLayers(value)) {
    const assignment = /(?:^|[?&#;\s])([^=?#&;\s]+)\s*=/g;
    let match;
    while ((match = assignment.exec(layer)) !== null) {
      names.add(normalizedCredentialParameterName(match[1]));
    }
  }
  return names;
}

export function redactSensitiveText(value = '') {
  return String(value || '')
    .replace(PEM_PRIVATE_KEY_RE, '[REDACTED_PRIVATE_KEY]')
    .replace(BEARER_RE, 'Bearer [REDACTED_BEARER]')
    .replace(OPENAI_STYLE_RE, '[REDACTED_SECRET]')
    .replace(STRIPE_KEY_RE, '[REDACTED_SECRET]')
    .replace(AWS_ACCESS_KEY_RE, '[REDACTED_SECRET]')
    .replace(GITHUB_TOKEN_RE, '[REDACTED_SECRET]')
    .replace(GOOGLE_API_KEY_RE, '[REDACTED_SECRET]')
    .replace(SLACK_TOKEN_RE, '[REDACTED_SECRET]')
    .replace(JWT_RE, '[REDACTED_JWT]')
    .replace(SECRET_ASSIGNMENT_RE, (_match, key) => `${key}=[REDACTED_SECRET]`);
}

/**
 * Detect credential-bearing URL metadata before a tab URL crosses a prompt,
 * receipt, diagnostic, persistence, or transport boundary.
 */
export function hasCredentialBearingUrl(value = '') {
  let parsed;
  try {
    parsed = value instanceof URL ? value : new URL(String(value || ''));
  } catch {
    return true;
  }

  if (parsed.username || parsed.password) return true;
  const names = new Set([
    ...credentialParameterNames(parsed.search),
    ...credentialParameterNames(parsed.hash),
  ]);
  return [...names].some((name) => CREDENTIAL_URL_PARAMETER_NAMES.has(name));
}
