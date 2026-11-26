import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { sha256, describePermissions } from '../../services/packageMeta.js';

test('sha256 matches the known digest of a buffer', () => {
  assert.equal(sha256(Buffer.from('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const data = crypto.randomBytes(1024);
  assert.equal(sha256(data), crypto.createHash('sha256').update(data).digest('hex'));
});

test('a manifest with no permissions is described as needing none', () => {
  const info = describePermissions({ name: 'x' });
  assert.equal(info.declared, false);
  assert.deepEqual(info.summary, ['No special permissions']);
  assert.equal(info.permissions.network, false);
  assert.equal(info.permissions.filesystem, 'none');
});

test('declared permissions are listed in plain language', () => {
  const info = describePermissions({
    permissions: { network: true, filesystem: 'user', desktopControl: true, shell: true }
  });
  assert.equal(info.declared, true);
  assert.deepEqual(info.summary, [
    'Connect to the internet',
    'Read and write files in your user folders',
    'Control your mouse, keyboard and screen',
    'Run shell commands'
  ]);
});

test('MCP servers are always reported, even if the manifest does not declare permissions', () => {
  const info = describePermissions({ mcpServers: { blender: { command: 'python' } } });
  assert.deepEqual(info.permissions.mcpServers, ['blender']);
  assert.match(info.summary.join(' '), /local tool servers: blender/);
});

test('malformed or hostile values fall back to the safest option', () => {
  const info = describePermissions({ permissions: { network: 'yes', filesystem: '../../etc', shell: 1 }, mcpServers: 'x' });
  assert.equal(info.permissions.network, false);
  assert.equal(info.permissions.filesystem, 'none');
  assert.equal(info.permissions.shell, false);
  assert.deepEqual(info.permissions.mcpServers, []);
  assert.doesNotThrow(() => describePermissions(null));
  assert.doesNotThrow(() => describePermissions('nonsense'));
});
