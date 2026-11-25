import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execCliSync } from '../../services/safeExec.js';

test('execCliSync runs executables directly with exact arguments', () => {
  const out = execCliSync(process.execPath, ['-e', 'console.log(process.argv[1])', '" & echo PWNED & "'], { encoding: 'utf8' });
  assert.equal(out.trim(), '" & echo PWNED & "');
});

// Mimics an npm-style .cmd shim: forwards %* to a real program (a second cmd.exe parse).
test('cmd shims pass arguments through and cannot be used to inject commands (Windows)', { skip: process.platform !== 'win32' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruxt-exec-'));
  try {
    const shim = path.join(dir, 'echoarg.cmd');
    fs.writeFileSync(shim, `@echo off\r\n"${process.execPath}" -e "console.log(process.argv[1])" %*\r\n`);
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
    const run = (arg) => execCliSync(shim, [arg], { encoding: 'utf8', cwd: dir, env }).trim();

    assert.equal(run('hello world'), 'hello world');

    const marker = path.join(dir, 'pwned.txt');
    for (const payload of [
      `" & echo x > "${marker}" & "`,
      `a | echo x > "${marker}"`,
      `a & echo x > "${marker}"`,
      '%PATH%',
      'x^y',
    ]) {
      run(payload);
      assert.equal(fs.existsSync(marker), false, `injection ran for: ${payload}`);
    }
    assert.equal(run('a&b|c<d>e'), 'a&b|c<d>e');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
