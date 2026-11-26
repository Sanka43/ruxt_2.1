import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { scaffoldAgent } from '../../../agent-kit/new-agent.mjs';
import { packAgent } from '../../../agent-kit/pack-agent.mjs';
import { extractArchiveSafely } from '../../services/safeArchive.js';
import { validateAgentManifest } from '../../services/manifestValidator.js';
import { McpProcessClient } from '../../services/mcpClientManager.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const kit = path.join(repo, 'agent-kit');
const hasPython = spawnSync('python', ['--version']).status === 0;
const skip = !hasPython && 'python not available';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-kit-test-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('Omer ships the same shared files as the kit (no drift)', () => {
  for (const f of ['ruxt_mcp_base.py', 'ruxt_script_guard.py']) {
    assert.equal(
      fs.readFileSync(path.join(repo, 'agents', 'omer-balika', 'mcp', f), 'utf8'),
      fs.readFileSync(path.join(kit, f), 'utf8'),
      `${f} differs; copy agent-kit/${f} into the agent`
    );
  }
});

test('scaffold: a new Excel agent is valid, complete and starts', { skip }, async () => {
  const { dir, slug } = scaffoldAgent({ app: 'excel', name: 'Priya Nair', role: 'Excel analyst', outDir: tmp });
  assert.equal(slug, 'priya-nair');
  for (const f of ['manifest.json', 'agent.md', 'skills/excel/SKILL.md', 'mcp/excel_server.py', 'mcp/ruxt_mcp_base.py', 'mcp/ruxt_script_guard.py']) {
    assert.ok(fs.existsSync(path.join(dir, f)), f);
  }
  assert.ok(!/\{\{/.test(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')), 'no placeholder left');

  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  assert.equal(validateAgentManifest(manifest, dir).ok, true);

  const ws = path.join(tmp, 'ws');
  const client = new McpProcessClient('priya:excel', { command: 'python', args: [path.join(dir, 'mcp', 'excel_server.py'), '--workspace', ws] }, dir);
  try {
    const tools = await client.start();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, ['app_status', 'create_project', 'list_projects']);
    assert.deepEqual(Object.keys(manifest.permissions.approval).sort(), names, 'every tool has an approval rule');
    const created = JSON.parse((await client.callTool('create_project', { name: 'Q3 budget' })).content[0].text);
    assert.match(created.project_id, /^q3-budget-[0-9a-f]{6}$/);
    assert.ok(created.dir.startsWith(path.join(ws, 'outputs', 'excel-projects')));
    const status = JSON.parse((await client.callTool('app_status', {})).content[0].text);
    assert.equal(typeof status.installed, 'boolean');
  } finally { client.shutdown(); }
});

test('scaffold refuses bad input and existing folders', () => {
  assert.throws(() => scaffoldAgent({ app: 'Bad App!', name: 'X', outDir: tmp }), /--app/);
  assert.throws(() => scaffoldAgent({ app: 'excel', name: '', outDir: tmp }), /--name/);
  fs.mkdirSync(path.join(tmp, 'taken-name'), { recursive: true }); // must not rely on another (possibly skipped) test
  assert.throws(() => scaffoldAgent({ app: 'excel', name: 'Taken Name', outDir: tmp }), /already exists/);
});

test('pack: Omer packs to a .ruxt that extracts, validates and leaves out generated files', () => {
  const stray = path.join(repo, 'agents', 'omer-balika', 'mcp', '__pycache__');
  fs.mkdirSync(stray, { recursive: true });
  fs.writeFileSync(path.join(stray, 'x.pyc'), 'x');
  const { out } = packAgent('omer-balika', { outDir: path.join(tmp, 'packages') });
  const extracted = path.join(tmp, 'extracted');
  extractArchiveSafely(out, extracted);
  const manifest = JSON.parse(fs.readFileSync(path.join(extracted, 'manifest.json'), 'utf8'));
  assert.equal(manifest.slug, 'omer-balika');
  assert.equal(validateAgentManifest(manifest, extracted).ok, true);
  assert.ok(fs.existsSync(path.join(extracted, 'avatar.png')));
  assert.ok(fs.existsSync(path.join(extracted, 'mcp', 'blender_server.py')));
  assert.equal(fs.existsSync(path.join(extracted, 'mcp', '__pycache__')), false);
});

test('pack refuses an invalid manifest', () => {
  const agents = path.join(tmp, 'agents');
  fs.mkdirSync(path.join(agents, 'broken-one'), { recursive: true });
  fs.writeFileSync(path.join(agents, 'broken-one', 'manifest.json'), JSON.stringify({ format: 'ruxt-agent-package/v3', slug: 'broken-one' }));
  assert.throws(() => packAgent('broken-one', { agentsDir: agents, outDir: path.join(tmp, 'p2') }), /manifest is invalid/);
});
