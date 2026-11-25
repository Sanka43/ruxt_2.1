import test from 'node:test';
import assert from 'node:assert/strict';
import { requestGuard, buildAllowedOriginCheck, rateLimit } from '../../services/requestGuard.js';

function runGuard(headers, port = 1234) {
  let result = 'allow';
  let status = null;
  requestGuard(port)(
    { headers },
    { status: (s) => { status = s; return { json: () => { result = 'deny'; } }; } },
    () => {}
  );
  return { result, status };
}

test('guard allows the app itself, Vite dev and non-browser clients', () => {
  assert.equal(runGuard({ host: '127.0.0.1:1234', origin: 'http://127.0.0.1:1234' }).result, 'allow');
  assert.equal(runGuard({ host: 'localhost:1234', origin: 'http://localhost:5173' }).result, 'allow');
  assert.equal(runGuard({ host: '127.0.0.1:1234' }).result, 'allow');
});

test('guard blocks foreign origins, cross-site fetches, rebinding hosts and null origin', () => {
  assert.equal(runGuard({ host: '127.0.0.1:1234', origin: 'https://evil.com' }).status, 403);
  assert.equal(runGuard({ host: '127.0.0.1:1234', 'sec-fetch-site': 'cross-site' }).status, 403);
  assert.equal(runGuard({ host: 'evil.com:1234' }).status, 403);
  assert.equal(runGuard({ host: '127.0.0.1:1234', origin: 'null' }).status, 403);
  assert.equal(runGuard({ host: '127.0.0.1:1234', origin: 'http://localhost:3000' }).status, 403);
});

test('allowed origins follow the configured port', () => {
  const check = buildAllowedOriginCheck(4321);
  assert.equal(check('http://127.0.0.1:4321'), true);
  assert.equal(check('http://127.0.0.1:1234'), false);
});

test('rateLimit returns 429 after max hits', () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 3 });
  const req = { ip: '127.0.0.1', baseUrl: '/api', path: '/x' };
  const codes = [];
  for (let i = 0; i < 5; i++) {
    let code = 200;
    limiter(req, { setHeader() {}, status: (c) => { code = c; return { json() {} }; } }, () => {});
    codes.push(code);
  }
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
});
