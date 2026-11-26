import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROVIDERS, getProvider, hasStoredKey, shouldShowOnboarding,
  checkApiKey, buildTestPayload, buildSettingsPayload
} from '../../../src/lib/onboarding.js';

const fresh = { settings: { active_provider: 'antigravity' }, workspace: { stats: { conversations: 0 } } };

test('a brand-new install sees the wizard', () => {
  assert.equal(shouldShowOnboarding(fresh), true);
});

test('nothing is shown before settings have loaded', () => {
  assert.equal(shouldShowOnboarding({}), false);
  assert.equal(shouldShowOnboarding({ workspace: { stats: { conversations: 0 } } }), false);
});

test('existing users are never interrupted', () => {
  assert.equal(shouldShowOnboarding({ ...fresh, settings: { onboarding_completed: 'true' } }), false);
  assert.equal(shouldShowOnboarding({ ...fresh, settings: { gemini_api_key: '********1234' } }), false);
  assert.equal(shouldShowOnboarding({ ...fresh, workspace: { stats: { conversations: 3 } } }), false);
});

test('empty key fields do not count as a stored key', () => {
  assert.equal(hasStoredKey({ gemini_api_key: '', openai_api_key: '  ' }), false);
  assert.equal(hasStoredKey({ openai_api_key: '********abcd', theme_preset: 'light' }), true);
});

test('provider catalogue is consistent', () => {
  assert.deepEqual(PROVIDERS.map((p) => p.id), ['gemini', 'openai', 'claude', 'ollama', 'antigravity']);
  for (const p of PROVIDERS.filter((x) => x.needsKey)) {
    assert.match(p.keyField, /_api_key$/);
    assert.match(p.keyUrl, /^https:\/\//);
  }
  assert.equal(getProvider('nope'), null);
});

test('API key checks block obvious mistakes and only warn about prefixes', () => {
  const gemini = getProvider('gemini');
  assert.equal(checkApiKey(gemini, '').ok, false);
  assert.equal(checkApiKey(gemini, 'AIza short').ok, false);
  assert.equal(checkApiKey(gemini, 'AIza with spaces inside the key value').ok, false);
  assert.equal(checkApiKey(gemini, 'x'.repeat(10)).ok, false);

  const wrongPrefix = checkApiKey(gemini, 'sk-' + 'a'.repeat(30));
  assert.equal(wrongPrefix.ok, true);
  assert.match(wrongPrefix.warning, /usually start with "AIza"/);

  assert.deepEqual(checkApiKey(gemini, 'AIza' + 'b'.repeat(30)), { ok: true, warning: null });
  assert.deepEqual(checkApiKey(getProvider('ollama'), ''), { ok: true, warning: null });
});

test('test payloads carry the key only for providers that need one', () => {
  assert.deepEqual(buildTestPayload(getProvider('gemini'), '  AIzaKEY  '), { provider: 'gemini', apiKey: 'AIzaKEY' });
  assert.deepEqual(buildTestPayload(getProvider('ollama'), 'ignored'), { provider: 'ollama', hostUrl: 'http://localhost:11434' });
  assert.deepEqual(buildTestPayload(getProvider('antigravity'), 'ignored'), { provider: 'antigravity' });
});

test('saved settings select the provider, store the key under the right field and mark setup done', () => {
  assert.deepEqual(buildSettingsPayload(getProvider('claude'), ' sk-ant-123 '), {
    active_provider: 'claude', onboarding_completed: 'true', anthropic_api_key: 'sk-ant-123'
  });
  assert.deepEqual(buildSettingsPayload(getProvider('antigravity'), ''), {
    active_provider: 'antigravity', onboarding_completed: 'true'
  });
  assert.equal(buildSettingsPayload(getProvider('ollama')).ollama_host, 'http://localhost:11434');
});

import { interpretTestResult } from '../../../src/lib/onboarding.js';

test('a connection test only passes when the chosen provider itself answered', () => {
  const gemini = getProvider('gemini');
  assert.equal(interpretTestResult(gemini, { success: true, provider: 'gemini' }).ok, true);

  const ollama = getProvider('ollama');
  const fallback = interpretTestResult(ollama, { success: true, provider: 'Google Antigravity (ACP Engine)' });
  assert.equal(fallback.ok, false);
  assert.match(fallback.message, /Ollama \(local\) did not respond.*Antigravity/);

  assert.equal(interpretTestResult(getProvider('antigravity'), { success: true, provider: 'Google Antigravity (ACP Engine)' }).ok, true);
  assert.equal(interpretTestResult(getProvider('claude'), { success: true, provider: 'claude-cli' }).ok, true);
  assert.deepEqual(interpretTestResult(gemini, { success: false, error: 'API key not valid' }), { ok: false, message: 'API key not valid' });
  assert.equal(interpretTestResult(gemini, null).ok, false);
});
