import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { validateAgentManifest, isSafeRelativePath, manifestVersion } from '../../services/manifestValidator.js';
import { describePermissions } from '../../services/packageMeta.js';
import { McpProcessClient } from '../../services/mcpClientManager.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const agentsRoot = path.resolve(here, '../../../agents');
const omerDir = path.join(agentsRoot, 'omer-balika');
const omerManifest = () => JSON.parse(fs.readFileSync(path.join(omerDir, 'manifest.json'), 'utf8'));

test('manifestVersion reads the format suffix', () => {
  assert.equal(manifestVersion({ format: 'ruxt-agent-package/v3' }), 3);
  assert.equal(manifestVersion({ format: 'something-else' }), null);
  assert.equal(manifestVersion({}), null);
});

test('isSafeRelativePath rejects absolute, drive, UNC and parent paths', () => {
  assert.equal(isSafeRelativePath('outputs/blender-projects'), true);
  for (const bad of ['../x', 'a/../../x', 'C:\\temp', 'C:/temp', '/etc', '\\\\server\\share', '//server/share', '', '  ']) {
    assert.equal(isSafeRelativePath(bad), false, bad);
  }
  assert.equal(isSafeRelativePath(42), false);
});

test('the Omer Balika package is a valid v3 manifest', () => {
  const v = validateAgentManifest(omerManifest(), omerDir);
  assert.deepEqual(v.errors, []);
  assert.equal(v.ok, true);
  assert.equal(v.version, 3);
  assert.deepEqual(v.permissions.apps, ['blender']);
  assert.deepEqual(v.permissions.fsWrite, ['outputs/blender-projects']);
  assert.equal(v.permissions.network, false);
  assert.equal(v.permissions.approval.run_script, 'first-use');
});

test('consent summary lists the app and write folder', () => {
  const { summary } = describePermissions(omerManifest());
  assert.ok(summary.some((s) => /Control these apps: blender/.test(s)));
  assert.ok(summary.some((s) => /outputs\/blender-projects/.test(s)));
});

test('v3 requires slug, name, role and permissions', () => {
  const v = validateAgentManifest({ format: 'ruxt-agent-package/v3', mcpServers: { x: { command: 'python', args: [] } } });
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /slug/.test(e)));
  assert.ok(v.errors.some((e) => /name/.test(e)));
  assert.ok(v.errors.some((e) => /permissions is required/.test(e)));
});

test('rejects an app that is not listed in permissions.apps', () => {
  const m = omerManifest();
  m.permissions.apps = [];
  const v = validateAgentManifest(m, omerDir);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /permissions\.apps must include "blender"/.test(e)));
});

test('rejects unsafe MCP launch config and missing scripts', () => {
  const bad = omerManifest();
  bad.mcpServers.blender = { command: 'powershell', args: ['-c', 'ls'] };
  assert.equal(validateAgentManifest(bad, omerDir).ok, false);

  const escape = omerManifest();
  escape.mcpServers.blender.args = ['../../evil.py'];
  assert.equal(validateAgentManifest(escape, omerDir).ok, false);

  const missing = omerManifest();
  missing.mcpServers.blender.args = ['${agentDir}/mcp/nope.py'];
  const v = validateAgentManifest(missing, omerDir);
  assert.ok(v.errors.some((e) => /missing from the package/.test(e)));
});

test('rejects bad permission values', () => {
  for (const patch of [
    { fsWrite: ['../outside'] },
    { fsWrite: ['C:\\Windows'] },
    { network: 'yes' },
    { filesystem: 'everything' },
    { approval: { run_script: 'sometimes' } }
  ]) {
    const m = omerManifest();
    m.permissions = { ...m.permissions, ...patch };
    assert.equal(validateAgentManifest(m, omerDir).ok, false, JSON.stringify(patch));
  }
});

test('rejects ui entries that leave the package', () => {
  const m = omerManifest();
  m.ui = { entry: '../../outside.html' };
  assert.equal(validateAgentManifest(m, omerDir).ok, false);
});

test('older v1/v2 packages stay valid and only get a warning', () => {
  const v = validateAgentManifest({
    format: 'ruxt-agent-package/v2',
    mcpServers: { s: { command: 'python', args: ['${agentDir}/mcp/blender_mcp.py'] } }
  }, path.join(agentsRoot, 'blender-agent'));
  assert.equal(v.ok, true);
  assert.ok(v.warnings.some((w) => /no permissions declared/.test(w)));
});

test('every bundled agent manifest still validates', () => {
  const failures = [];
  for (const slug of fs.readdirSync(agentsRoot)) {
    const file = path.join(agentsRoot, slug, 'manifest.json');
    if (!fs.existsSync(file)) continue;
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { failures.push(`${slug}: invalid JSON`); continue; }
    const v = validateAgentManifest(manifest, path.join(agentsRoot, slug));
    if (!v.ok) failures.push(`${slug}: ${v.errors.join('; ')}`);
  }
  assert.deepEqual(failures, []);
});

const hasPython = spawnSync('python', ['--version']).status === 0;
test('Omer MCP server starts and answers app_status', { skip: !hasPython && 'python not available' }, async () => {
  const client = new McpProcessClient('omer-balika:blender', { command: 'python', args: [path.join(omerDir, 'mcp', 'blender_server.py')] }, omerDir);
  try {
    const tools = await client.start();
    assert.ok(tools.some((t) => t.name === 'app_status'));
    const res = await client.callTool('app_status', {});
    const status = JSON.parse(res.content[0].text);
    assert.equal(typeof status.installed, 'boolean');
  } finally {
    client.shutdown();
  }
});
