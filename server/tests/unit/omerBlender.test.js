import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { McpProcessClient } from '../../services/mcpClientManager.js';

// These tests drive Omer's real MCP server against a FAKE blender (fixtures/fake-blender).
// They prove the plumbing, path safety and script guard. They do not prove real Blender behaviour.

const here = path.dirname(fileURLToPath(import.meta.url));
const omerDir = path.resolve(here, '../../../agents/omer-balika');
const serverPy = path.join(omerDir, 'mcp', 'blender_server.py');
const fakeDir = path.join(here, 'fixtures', 'fake-blender');
const hasPython = spawnSync('python', ['--version']).status === 0;
const skip = !hasPython && 'python not available';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'omer-test-'));
const workspace = path.join(tmp, 'workspace');
const launcher = path.join(tmp, process.platform === 'win32' ? 'blender.cmd' : 'blender');
const fakePy = path.join(fakeDir, 'fake_blender.py');
if (process.platform === 'win32') fs.writeFileSync(launcher, `@python "${fakePy}" %*\r\n`);
else { fs.writeFileSync(launcher, `#!/bin/sh\nexec python "${fakePy}" "$@"\n`); fs.chmodSync(launcher, 0o755); }

let client;
const call = async (name, args = {}) => {
  const res = await client.callTool(name, args);
  const text = res.content[0].text;
  let body; try { body = JSON.parse(text); } catch (_) { body = text; }
  return { isError: !!res.isError, body };
};

test.before(async () => {
  if (skip) return;
  client = new McpProcessClient('omer:blender', {
    command: 'python', args: [serverPy, '--workspace', workspace], env: { BLENDER_BIN: launcher }
  }, omerDir);
  await client.start();
});
test.after(() => { client?.shutdown(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('server lists all Omer tools', { skip }, () => {
  assert.deepEqual(client.tools.map((t) => t.name).sort(), [
    'app_status', 'create_project', 'list_projects', 'open_in_blender',
    'render_preview', 'run_script', 'scene_info', 'validate_output'
  ]);
});

test('every approval entry in the manifest names a real tool', { skip }, () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(omerDir, 'manifest.json'), 'utf8'));
  const names = new Set(client.tools.map((t) => t.name));
  for (const tool of Object.keys(manifest.permissions.approval)) assert.ok(names.has(tool), tool);
  for (const tool of names) assert.ok(tool in manifest.permissions.approval, `${tool} has no approval rule`);
});

test('app_status finds the configured Blender and reports its version', { skip }, async () => {
  const { body } = await call('app_status');
  assert.equal(body.installed, true);
  assert.match(body.version, /Blender 4\.2\.0/);
  assert.ok(body.projects_root.startsWith(workspace));
});

test('full workflow: create, script, scene_info, render, validate', { skip }, async () => {
  const created = (await call('create_project', { name: 'Low Poly Car!' })).body;
  assert.match(created.project_id, /^low-poly-car-[0-9a-f]{6}$/);
  const pid = created.project_id;
  assert.ok(fs.statSync(created.dir).isDirectory());

  const ran = await call('run_script', {
    project_id: pid,
    script: 'import bpy\nbpy.data.objects.new("Body")\nbpy.data.objects.new("Wheel")\n',
    save_as: 'car.blend'
  });
  assert.equal(ran.isError, false, JSON.stringify(ran.body));
  assert.equal(ran.body.saved_file, 'car.blend');
  assert.ok(ran.body.new_files.includes('car.blend'));
  assert.ok(fs.existsSync(path.join(workspace, 'outputs', 'blender-projects', ran.body.script_log)), 'script kept as audit log');

  // new work starts empty: the default Cube must not be there
  const info = (await call('scene_info', { project_id: pid, file: 'car.blend' })).body;
  assert.deepEqual(info.scene.objects.map((o) => o.name), ['Body', 'Wheel']);

  // continuing an existing file keeps its content
  const more = await call('run_script', {
    project_id: pid, open_file: 'car.blend', save_as: 'car.blend',
    script: 'import bpy\nbpy.data.objects.new("Light", "LIGHT")\n'
  });
  assert.equal(more.isError, false, JSON.stringify(more.body));
  const info2 = (await call('scene_info', { project_id: pid, file: 'car.blend' })).body;
  assert.deepEqual(info2.scene.objects.map((o) => o.name), ['Body', 'Wheel', 'Light']);

  const render = (await call('render_preview', { project_id: pid, file: 'car.blend', resolution_percentage: 25 })).body;
  assert.equal(render.ok, true);
  const png = fs.readFileSync(path.join(workspace, 'outputs', 'blender-projects', render.preview));
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);

  const valid = (await call('validate_output', { project_id: pid, file: 'car.blend' })).body;
  assert.equal(valid.valid, true);
  assert.equal(valid.object_count, 3);

  const listed = (await call('list_projects')).body;
  assert.deepEqual(listed.projects.find((p) => p.project_id === pid).blend_files, ['car.blend']);
});

test('a failing script is reported with its error and does not crash the server', { skip }, async () => {
  const { project_id } = (await call('create_project', { name: 'fail' })).body;
  const res = await call('run_script', { project_id, script: 'raise ValueError("boom from script")', save_as: 'x.blend' });
  assert.equal(res.isError, true);
  assert.match(res.body.stderr_tail, /boom from script/);
  assert.equal((await call('app_status')).body.installed, true, 'server still answers');
});

test('a script cannot write outside its project, start programs or use the network', { skip }, async () => {
  const { project_id } = (await call('create_project', { name: 'guard' })).body;
  const victim = path.join(tmp, 'outside.txt');
  for (const script of [
    `open(r"${victim}", "w").write("pwned")`,
    'import subprocess; subprocess.run(["cmd", "/c", "echo hi"])',
    'import socket; socket.create_connection(("127.0.0.1", 9), timeout=1)'
  ]) {
    const res = await call('run_script', { project_id, script });
    assert.equal(res.isError, true, script);
    assert.match(res.body.stderr_tail, /script guard blocked/, script);
  }
  assert.equal(fs.existsSync(victim), false);
});

test('validate_output rejects a file that is not a Blender file', { skip }, async () => {
  const { project_id, dir } = (await call('create_project', { name: 'bad' })).body;
  fs.writeFileSync(path.join(dir, 'fake.blend'), 'not a blend file');
  const res = (await call('validate_output', { project_id, file: 'fake.blend' })).body;
  assert.equal(res.valid, false);
  const missing = (await call('validate_output', { project_id, file: 'nope.blend' })).body;
  assert.equal(missing.valid, false);
});

test('ids, file names and options are validated', { skip }, async () => {
  const { project_id } = (await call('create_project', { name: 'v' })).body;
  for (const [tool, args] of [
    ['scene_info', { project_id: '../etc', file: 'a.blend' }],
    ['scene_info', { project_id: 'Nope', file: 'a.blend' }],
    ['scene_info', { project_id, file: '../a.blend' }],
    ['scene_info', { project_id, file: 'sub/a.blend' }],
    ['scene_info', { project_id, file: 'a.txt' }],
    ['run_script', { project_id, script: '   ' }],
    ['run_script', { project_id, script: 'pass', save_as: '..\\x.blend' }],
    ['run_script', { project_id, script: 'pass', timeout_s: 100000 }],
    ['run_script', { project_id: 'missing-project', script: 'pass' }],
    ['render_preview', { project_id, file: 'a.blend', engine: 'EVIL' }],
    ['render_preview', { project_id, file: 'a.blend', resolution_percentage: 500 }],
    ['render_preview', { project_id, file: 'a.blend', output_name: '../x.png' }]
  ]) {
    const res = await call(tool, args);
    assert.equal(res.isError, true, `${tool} ${JSON.stringify(args)}`);
  }
});

test('script guard blocks outside writes, deletes, programs and network but allows project and temp files', { skip }, () => {
  const project = path.join(tmp, 'guard-project');
  const outside = path.join(tmp, 'guard-outside');
  const projectTmp = path.join(project, '_tmp');
  const env = { ...process.env, TEMP: projectTmp, TMP: projectTmp, TMPDIR: projectTmp };
  const run = spawnSync('python', [path.join(fakeDir, 'guard_probe.py'), path.join(omerDir, 'mcp'), project, outside, os.tmpdir()], { encoding: 'utf8', env });
  assert.equal(run.status, 0, run.stderr);
  const r = JSON.parse(run.stdout.trim().split('\n').pop());
  for (const ok of ['write_inside', 'write_temp', 'read_outside', 'delete_inside']) assert.equal(r[ok], 'allowed', ok);
  for (const bad of ['write_real_system_temp', 'write_outside', 'append_outside', 'delete_outside', 'rename_outside', 'rmtree_outside', 'traversal', 'subprocess', 'os_system', 'network']) {
    assert.equal(r[bad], 'blocked', bad);
  }
  assert.equal(r.victim_intact, true);
});
