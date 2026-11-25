import test from 'node:test';
import assert from 'node:assert/strict';
import { maskSettings, maskSecret, isMaskedSecret, isSecretSettingKey } from '../../services/secrets.js';

test('secret keys are detected by name', () => {
  for (const k of ['gemini_api_key', 'openai_api_key', 'github_token', 'db_password', 'x_secret']) {
    assert.equal(isSecretSettingKey(k), true, k);
  }
  for (const k of ['active_provider', 'gemini_model', 'ollama_host']) {
    assert.equal(isSecretSettingKey(k), false, k);
  }
});

test('maskSettings hides secrets but keeps normal values', () => {
  const masked = maskSettings({ gemini_api_key: 'AIzaSyREALKEY123456789', active_provider: 'gemini', openai_api_key: '' });
  assert.equal(masked.active_provider, 'gemini');
  assert.equal(masked.openai_api_key, '');
  assert.ok(!masked.gemini_api_key.includes('REALKEY'));
  assert.ok(masked.gemini_api_key.endsWith('6789'));
  assert.equal(isMaskedSecret(masked.gemini_api_key), true);
});

test('short secrets reveal nothing', () => {
  assert.equal(isMaskedSecret(maskSecret('abc')), true);
  assert.ok(!maskSecret('abc').includes('abc'));
});

test('real keys are never mistaken for masks', () => {
  assert.equal(isMaskedSecret('AIzaSyREALKEY123456789'), false);
  assert.equal(isMaskedSecret(undefined), false);
});
