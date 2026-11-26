import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

// Exercises the real /api/marketplace/import-package route. Needs better-sqlite3 (Electron ABI):
// skipped under plain `node`, run by `npm run test:electron`.
const Database = (await import('better-sqlite3')).default;
let sqliteOk = false;
try { new Database(':memory:').close(); sqliteOk = true; } catch (_) {}
const skip = !sqliteOk && 'better-sqlite3 built for a different Node ABI; run: npm run test:electron';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ruxt-import-test-'));
const avatarFile = path.join(repo, 'public', 'agent-avatars', 'omer-balika.png');
const avatarExisted = fs.existsSync(avatarFile);
let server, base, db, createArchive;

if (sqliteOk) {
  process.env.RUXT_DATA_DIR = path.join(tmp, 'data');
  process.env.RUXT_PACKAGES_DIR = fs.mkdirSync(path.join(tmp, 'packages'), { recursive: true }) && path.join(tmp, 'packages');
  const express = (await import('express')).default;
  const router = (await import('../../routes/marketplace.js')).default;
  db = (await import('../../db.js')).default;
  ({ createArchive } = await import('../../services/safeArchive.js'));
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use('/api/marketplace', router);
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  test.after(() => {
    server.close();
    try { db.close(); } catch (_) {}
    if (!avatarExisted) fs.rmSync(avatarFile, { force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  });
}

const upload = async (file, fileName) => {
  const res = await fetch(`${base}/api/marketplace/import-package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64: fs.readFileSync(file).toString('base64'), fileName })
  });
  return { status: res.status, body: await res.json() };
};

function buildPackage(slug, manifest, files = {}) {
  const dir = path.join(tmp, `src-${slug}`, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(dir, 'agent.md'), '# test');
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  const out = path.join(tmp, `${slug}.ruxt`);
  createArchive(dir, out);
  return out;
}

test('importing the real Omer Balika package installs him and shows what he may do', { skip }, async () => {
  const { status, body } = await upload(path.join(repo, 'agents', 'packages', 'omer-balika.ruxt'), 'omer-balika.ruxt');
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.agent.slug, 'omer-balika');
  assert.ok(body.access.summary.some((s) => /Control these apps: blender/.test(s)));
  assert.ok(body.access.summary.some((s) => /outputs\/blender-projects/.test(s)));
  const row = db.prepare('SELECT name, role FROM agents WHERE slug = ?').get('omer-balika');
  assert.equal(row.name, 'Omer Balika');
  assert.ok(fs.existsSync(path.join(tmp, 'data', 'agents', 'omer-balika', 'mcp', 'blender_server.py')));
});

test('a package that tries to launch a system program is rejected and leaves nothing behind', { skip }, async () => {
  const pkg = buildPackage('zz-evil-pkg', {
    format: 'ruxt-agent-package/v3', slug: 'zz-evil-pkg', name: 'Evil', role: 'x',
    mcpServers: { x: { command: 'powershell', args: ['-c', 'calc'] } },
    permissions: { apps: [], approval: {} }
  });
  const { status, body } = await upload(pkg, 'zz-evil-pkg.ruxt');
  assert.equal(status, 422);
  assert.match(body.error, /not an allowed interpreter/);
  assert.equal(fs.existsSync(path.join(tmp, 'data', 'agents', 'zz-evil-pkg')), false);
  assert.equal(db.prepare('SELECT 1 FROM agents WHERE slug = ?').get('zz-evil-pkg'), undefined);
  assert.equal(fs.existsSync(path.join(tmp, 'packages', 'zz-evil-pkg.ruxt')), false);
});

test('a package whose MCP script is missing is rejected', { skip }, async () => {
  const pkg = buildPackage('zz-missing-script', {
    format: 'ruxt-agent-package/v3', slug: 'zz-missing-script', name: 'Missing', role: 'x',
    mcpServers: { x: { command: 'python', args: ['${agentDir}/mcp/nope.py'] } },
    permissions: { apps: [], approval: {} }
  });
  const { status, body } = await upload(pkg, 'zz-missing-script.ruxt');
  assert.equal(status, 422);
  assert.match(body.error, /missing from the package/);
});
