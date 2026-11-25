import crypto from 'crypto';
import db from '../db.js';
import { isSecretSettingKey, isMaskedSecret } from './secrets.js';

// Encryption at rest for secret settings (API keys, tokens).
//
// The master key is created by the Electron main process, protected with the OS
// (Electron safeStorage / Windows DPAPI) and handed to this server through the
// RUXT_MASTER_KEY environment variable. Without it (plain `npm run server`),
// values stay plaintext exactly as before so development keeps working.

const PREFIX = 'enc:v1:';

function loadMasterKey() {
  const b64 = process.env.RUXT_MASTER_KEY;
  if (!b64) return null;
  const key = Buffer.from(b64, 'base64');
  return key.length === 32 ? key : null;
}

const MASTER_KEY = loadMasterKey();
delete process.env.RUXT_MASTER_KEY; // don't leak it to child processes we spawn

export const encryptionEnabled = Boolean(MASTER_KEY);

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptSecret(plain) {
  const text = String(plain ?? '');
  if (!MASTER_KEY || !text || isEncrypted(text)) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

export function decryptSecret(value) {
  if (!isEncrypted(value)) return value; // legacy plaintext
  if (!MASTER_KEY) return '';
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch (_) {
    console.warn('[secretStore] Could not decrypt a stored secret (master key changed?). Re-enter it in Settings.');
    return '';
  }
}

/** Value to store in SQLite for a setting. */
export function encodeSettingForStorage(key, value) {
  return isSecretSettingKey(key) ? encryptSecret(value) : value;
}

/** All settings rows with secrets decrypted. Use instead of SELECT key, value FROM settings. */
export function loadSettingRows() {
  return db.prepare('SELECT key, value FROM settings').all().map((r) => ({
    key: r.key,
    value: isSecretSettingKey(r.key) ? decryptSecret(r.value) : r.value,
  }));
}

/** One decrypted setting value (or undefined). */
export function loadSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return undefined;
  return isSecretSettingKey(key) ? decryptSecret(row.value) : row.value;
}

/** Encrypts any secret rows that are still stored as plaintext. */
export function migrateSecretsToEncrypted() {
  if (!MASTER_KEY) return 0;
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const update = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
  let n = 0;
  db.transaction(() => {
    for (const r of rows) {
      if (isSecretSettingKey(r.key) && r.value && !isEncrypted(r.value)) {
        update.run(encryptSecret(r.value), r.key);
        n++;
      }
    }
  })();
  if (n) console.log(`[secretStore] Encrypted ${n} stored secret(s).`);
  return n;
}

/** Env vars for child processes (Python agent) so keys never appear on a command line. */
export function providerKeyEnv(chosenKey) {
  const s = Object.fromEntries(loadSettingRows().map((r) => [r.key, r.value]));
  const env = {};
  if (s.gemini_api_key) env.GEMINI_API_KEY = s.gemini_api_key;
  if (s.openai_api_key) env.OPENAI_API_KEY = s.openai_api_key;
  if (s.anthropic_api_key) env.ANTHROPIC_API_KEY = s.anthropic_api_key;
  if (s.openrouter_api_key) env.OPENROUTER_API_KEY = s.openrouter_api_key;
  if (chosenKey && !isMaskedSecret(chosenKey)) env.RUXT_AI_KEY = chosenKey;
  return env;
}
