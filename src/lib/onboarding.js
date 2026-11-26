// Pure logic for the first-run setup wizard (kept free of React so it can be unit tested).

export const PROVIDERS = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    badge: 'Recommended',
    description: 'Fast, with a generous free tier.',
    keyField: 'gemini_api_key',
    keyPrefix: 'AIza',
    keyUrl: 'https://aistudio.google.com/apikey',
    needsKey: true
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT models through your OpenAI account.',
    keyField: 'openai_api_key',
    keyPrefix: 'sk-',
    keyUrl: 'https://platform.openai.com/api-keys',
    needsKey: true
  },
  {
    id: 'claude',
    label: 'Anthropic Claude',
    description: 'Claude models through your Anthropic account.',
    keyField: 'anthropic_api_key',
    keyPrefix: 'sk-ant-',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    needsKey: true
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    badge: 'No key',
    description: 'Run open models on this PC. Ollama must be installed and running.',
    needsKey: false,
    hostField: 'ollama_host',
    defaultHost: 'http://localhost:11434'
  },
  {
    id: 'antigravity',
    label: 'Google Antigravity (local)',
    badge: 'No key',
    description: 'Use the Antigravity app already signed in on this PC.',
    needsKey: false
  }
];

export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) || null;
}

/** Keys the settings API returns for a stored secret look like "********1234". */
export function hasStoredKey(settings = {}) {
  return Object.entries(settings).some(
    ([k, v]) => /_api_key$/.test(k) && typeof v === 'string' && v.trim().length > 0
  );
}

/**
 * The wizard is for brand-new installs only: never finished/skipped it, no API key saved yet
 * and no conversation started. Existing users are never interrupted.
 */
export function shouldShowOnboarding({ settings, workspace } = {}) {
  if (!settings) return false; // not loaded yet
  if (settings.onboarding_completed === 'true') return false;
  if (hasStoredKey(settings)) return false;
  const conversations = Number(workspace?.stats?.conversations ?? 0);
  return conversations === 0;
}

/** Light sanity check; a mismatch is only a warning because providers do change key formats. */
export function checkApiKey(provider, rawKey) {
  const key = String(rawKey || '').trim();
  if (!provider?.needsKey) return { ok: true, warning: null };
  if (!key) return { ok: false, warning: 'Paste your API key to continue.' };
  if (/\s/.test(key)) return { ok: false, warning: 'The key contains spaces. Copy it again without extra characters.' };
  if (key.length < 16) return { ok: false, warning: 'That looks too short for an API key.' };
  if (provider.keyPrefix && !key.startsWith(provider.keyPrefix)) {
    return { ok: true, warning: `${provider.label} keys usually start with "${provider.keyPrefix}". Double-check it.` };
  }
  return { ok: true, warning: null };
}

/** Body for POST /api/settings/test-connection */
export function buildTestPayload(provider, rawKey) {
  const payload = { provider: provider.id };
  if (provider.needsKey) payload.apiKey = String(rawKey || '').trim();
  if (provider.id === 'ollama') payload.hostUrl = provider.defaultHost;
  return payload;
}

/** Settings written (via /api/settings/batch) when the wizard finishes. */
export function buildSettingsPayload(provider, rawKey) {
  const settings = { active_provider: provider.id, onboarding_completed: 'true' };
  if (provider.needsKey) settings[provider.keyField] = String(rawKey || '').trim();
  if (provider.id === 'ollama') settings[provider.hostField] = provider.defaultHost;
  return settings;
}

const PROVIDER_NAME_TOKENS = {
  gemini: ['gemini'],
  openai: ['openai', 'codex'],
  claude: ['claude', 'anthropic'],
  ollama: ['ollama'],
  antigravity: ['antigravity']
};

/**
 * The engine silently falls back to another available AI when the chosen one is down. That is fine
 * for chatting but wrong for a connection test, so only report success when the provider the
 * user picked actually answered.
 */
export function interpretTestResult(provider, data) {
  if (!data || !data.success) {
    return { ok: false, message: (data && data.error) || 'The connection test failed.' };
  }
  const used = String(data.provider || '').toLowerCase();
  const tokens = PROVIDER_NAME_TOKENS[provider.id] || [provider.id];
  if (used && !tokens.some((t) => used.includes(t))) {
    return {
      ok: false,
      message: `${provider.label} did not respond, so RuXt answered with "${data.provider}" instead.`
    };
  }
  return { ok: true, message: `Connected to ${data.provider || provider.label}.` };
}
