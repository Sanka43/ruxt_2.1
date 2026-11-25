import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

// better-sqlite3 is compiled for Electron's Node ABI in this project. Under plain `node`
// it may not load; then these tests are skipped (run `npm run test:electron` to include them).
const Database = (await import('better-sqlite3')).default;
let sqliteOk = false;
try { new Database(':memory:').close(); sqliteOk = true; } catch (_) {}

const SKIP = 'better-sqlite3 built for a different Node ABI; run: npm run test:electron';
const t = (name, fn) => (sqliteOk ? test(name, fn) : test(name, { skip: SKIP }, () => {}));

let store;
let db;
let dataDir;

if (sqliteOk) {
  // secretStore reads its master key and db.js reads the data dir at import time.
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruxt-secret-test-'));
  process.env.RUXT_DATA_DIR = dataDir;
  process.env.RUXT_MASTER_KEY = crypto.randomBytes(32).toString('base64');
  store = await import('../../services/secretStore.js');
  db = (await import('../../db.js')).default;
  test.after(() => {
    try { db.close(); } catch (_) {}
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
}

t('encryption is enabled and round-trips', () => {
  assert.equal(store.encryptionEnabled, true);
  const enc = store.encryptSecret('AIzaSyREALKEY123456789');
  assert.ok(enc.startsWith('enc:v1:'));
  assert.ok(!enc.includes('REALKEY'));
  assert.equal(store.decryptSecret(enc), 'AIzaSyREALKEY123456789');
});

t('each encryption uses a fresh IV', () => {
  assert.notEqual(store.encryptSecret('same'), store.encryptSecret('same'));
});

t('tampered ciphertext decrypts to empty string instead of throwing', () => {
  const enc = store.encryptSecret('secret-value');
  const raw = Buffer.from(enc.slice('enc:v1:'.length), 'base64');
  raw[raw.length - 1] ^= 0xff;
  assert.equal(store.decryptSecret('enc:v1:' + raw.toString('base64')), '');
});

t('legacy plaintext values pass through unchanged', () => {
  assert.equal(store.decryptSecret('plain-old-key'), 'plain-old-key');
});

t('only secret settings are encrypted when stored', () => {
  assert.ok(store.encodeSettingForStorage('openai_api_key', 'sk-123').startsWith('enc:v1:'));
  assert.equal(store.encodeSettingForStorage('active_provider', 'openai'), 'openai');
});

t('migration encrypts existing plaintext keys and loadSettingRows decrypts them', () => {
  const put = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  put.run('gemini_api_key', 'AIzaPlainBeforeMigration');
  put.run('active_provider', 'gemini');

  assert.ok(store.migrateSecretsToEncrypted() >= 1);

  const raw = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key').value;
  assert.ok(raw.startsWith('enc:v1:'));
  const rows = Object.fromEntries(store.loadSettingRows().map((r) => [r.key, r.value]));
  assert.equal(rows.gemini_api_key, 'AIzaPlainBeforeMigration');
  assert.equal(rows.active_provider, 'gemini');
  assert.equal(store.loadSetting('gemini_api_key'), 'AIzaPlainBeforeMigration');
});

t('providerKeyEnv exposes decrypted keys as env vars', () => {
  const env = store.providerKeyEnv('chosen-key');
  assert.equal(env.GEMINI_API_KEY, 'AIzaPlainBeforeMigration');
  assert.equal(env.RUXT_AI_KEY, 'chosen-key');
  assert.equal(store.providerKeyEnv('********1234').RUXT_AI_KEY, undefined);
});
