// Helpers so stored API keys are never sent back to the browser in full.

const MASK_PREFIX = '********'; // ASCII on purpose: survives any encoding round-trip
const SECRET_KEY_RE = /(api_key|_token|_secret|password)$/i;

export function isSecretSettingKey(key) {
  return SECRET_KEY_RE.test(String(key));
}

export function maskSecret(value) {
  const v = String(value ?? '');
  if (!v) return '';
  return MASK_PREFIX + (v.length > 8 ? v.slice(-4) : '');
}

export function isMaskedSecret(value) {
  return typeof value === 'string' && value.startsWith(MASK_PREFIX);
}

/** Returns a copy of a settings map with secret values masked. */
export function maskSettings(settings) {
  const out = {};
  for (const [k, v] of Object.entries(settings)) {
    out[k] = isSecretSettingKey(k) && typeof v === 'string' ? maskSecret(v) : v;
  }
  return out;
}
