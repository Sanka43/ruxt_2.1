// Protects the local API from drive-by requests by websites the user happens to
// have open in a normal browser (CSRF / DNS rebinding against localhost).
//
// A request is allowed when ALL hold:
//   - Host header is a loopback name (blocks DNS rebinding)
//   - Sec-Fetch-Site is not "cross-site"
//   - Origin, if present, is a loopback origin on an allowed port
// Requests without an Origin (Electron main process, curl, Vite proxy) pass.

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function hostnameOf(hostHeader = '') {
  const h = String(hostHeader).trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1);
  return h.split(':')[0];
}

export function buildAllowedOriginCheck(port) {
  const ports = new Set([String(port), '5173']);
  const extra = new Set(
    (process.env.RUXT_ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  return function isAllowedOrigin(origin) {
    if (!origin) return true; // non-browser client
    const o = String(origin).toLowerCase();
    if (extra.has(o)) return true;
    try {
      const u = new URL(o);
      if (u.protocol !== 'http:') return false;
      const hostname = u.hostname === '::1' ? '[::1]' : u.hostname;
      const effectivePort = u.port || '80';
      return LOOPBACK_HOSTS.has(hostname) && ports.has(effectivePort);
    } catch (_) {
      return false; // includes the literal "null" origin
    }
  };
}

export function requestGuard(port) {
  const isAllowedOrigin = buildAllowedOriginCheck(port);
  return function guard(req, res, next) {
    const deny = (reason) => res.status(403).json({ success: false, error: `Forbidden: ${reason}` });

    if (!LOOPBACK_HOSTS.has(hostnameOf(req.headers.host))) return deny('invalid host');
    if (req.headers['sec-fetch-site'] === 'cross-site') return deny('cross-site request');
    if (!isAllowedOrigin(req.headers.origin)) return deny('origin not allowed');
    next();
  };
}
