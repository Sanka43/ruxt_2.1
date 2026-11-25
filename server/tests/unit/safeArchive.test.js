import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { extractArchiveSafely, isSafeEntryName } from '../../services/safeArchive.js';

const B = String.fromCharCode(92); // backslash

test('entry names: traversal and absolute paths are rejected', () => {
  assert.equal(isSafeEntryName('manifest.json'), true);
  assert.equal(isSafeEntryName('ui/index.html'), true);
  assert.equal(isSafeEntryName('./agent.md'), true);
  assert.equal(isSafeEntryName('../x'), false);
  assert.equal(isSafeEntryName('a/../../x'), false);
  assert.equal(isSafeEntryName('a' + B + '..' + B + 'b'), false);
  assert.equal(isSafeEntryName('/etc/passwd'), false);
  assert.equal(isSafeEntryName('C:/Windows/x'), false);
  assert.equal(isSafeEntryName(''), false);
});

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruxt-arc-test-'));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('a normal package extracts into the destination', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, 'src/ui'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src/manifest.json'), '{"name":"x"}');
    fs.writeFileSync(path.join(dir, 'src/ui/index.html'), '<html></html>');
    execFileSync('tar', ['-cf', 'good.ruxt', '-C', 'src', '.'], { cwd: dir });

    extractArchiveSafely(path.join(dir, 'good.ruxt'), path.join(dir, 'out'));
    assert.ok(fs.existsSync(path.join(dir, 'out/manifest.json')));
    assert.ok(fs.existsSync(path.join(dir, 'out/ui/index.html')));
  });
});

test('a package with ../ entries is rejected and nothing is written', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, 'a/b'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'a/evil.txt'), 'pwn');
    // -P keeps the ../ in the member name; relative paths avoid GNU tar reading "C:" as a host
    execFileSync('tar', ['-cPf', '../../evil.ruxt', '../evil.txt'], { cwd: path.join(dir, 'a/b') });

    assert.throws(
      () => extractArchiveSafely(path.join(dir, 'evil.ruxt'), path.join(dir, 'out')),
      /Unsafe path/
    );
    assert.equal(fs.existsSync(path.join(dir, 'out')), false);
  });
});
