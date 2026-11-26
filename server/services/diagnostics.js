import fs from 'fs';
import os from 'os';

// Support bundles get pasted into bug reports, so anything that looks like a credential
// (or the user's home folder) is scrubbed before it leaves the machine.

const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_-]{20,}/g,                       // Google API keys
  /sk-[A-Za-z0-9_-]{16,}/g,                        // OpenAI / Anthropic style keys
  /gh[pousr]_[A-Za-z0-9]{20,}/g,                   // GitHub tokens
  /enc:v1:[A-Za-z0-9+/=]{16,}/g,                   // our own encrypted settings values
  /Bearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi,           // Authorization headers
  /((?:api[_-]?key|token|secret|password|passwd)["']?\s*[:=]\s*["']?)[^\s"',;}]{6,}/gi, // key=value pairs
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g                    // e-mail addresses
];

export function redactSecrets(text) {
  let out = String(text ?? '');
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match, prefix) => (prefix ? `${prefix}[REDACTED]` : '[REDACTED]'));
  }
  const home = os.homedir();
  if (home) out = out.split(home).join('~');
  return out;
}

/** Last `lines` lines of a text file (reads only the tail), or '' if it cannot be read. */
export function tailFile(filePath, lines = 200, maxBytes = 256 * 1024) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return '';
    const size = fs.statSync(filePath).size;
    const start = Math.max(0, size - maxBytes);
    const fd = fs.openSync(filePath, 'r');
    try {
      const buf = Buffer.alloc(size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      return buf.toString('utf8').split(/\r?\n/).slice(-lines).join('\n');
    } finally {
      fs.closeSync(fd);
    }
  } catch (_) {
    return '';
  }
}
