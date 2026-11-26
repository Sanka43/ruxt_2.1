import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { redactSecrets, tailFile } from '../../services/diagnostics.js';
import { boardroomToMarkdown, exportFileName } from '../../services/boardroomExport.js';

test('redactSecrets scrubs common credential formats', () => {
  const dirty = [
    'key AIzaSyA1234567890abcdefghijklmnop',
    'openai sk-proj-abcdefghijklmnop1234',
    'github ghp_abcdefghijklmnopqrstuvwx',
    'Authorization: Bearer abcdefghijklmnop.qrstuvwxyz123456',
    'gemini_api_key=SuperSecretValue123',
    '"token": "abcdef123456"',
    'stored enc:v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'account jane.doe+test@example.co.uk signed in'
  ].join('\n');
  const clean = redactSecrets(dirty);
  for (const leak of ['A1234567890', 'proj-abcdef', 'ghp_abcdef', 'qrstuvwxyz123456', 'SuperSecretValue123', 'abcdef123456', 'AAAAAAAAAAAA', 'jane.doe', 'example.co.uk']) {
    assert.ok(!clean.includes(leak), `leaked: ${leak}`);
  }
  assert.match(clean, /\[REDACTED\]/);
});

test('redactSecrets keeps ordinary text and hides the home folder', () => {
  assert.equal(redactSecrets('Server running on http://127.0.0.1:1234'), 'Server running on http://127.0.0.1:1234');
  const home = os.homedir();
  assert.equal(redactSecrets(`opened ${home}${path.sep}Documents`), `opened ~${path.sep}Documents`);
  assert.equal(redactSecrets(undefined), '');
});

test('tailFile returns only the last lines and tolerates missing files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruxt-tail-'));
  try {
    const file = path.join(dir, 'server.log');
    fs.writeFileSync(file, Array.from({ length: 500 }, (_, i) => `line ${i + 1}`).join('\n'));
    const tail = tailFile(file, 3).split('\n');
    assert.deepEqual(tail, ['line 498', 'line 499', 'line 500']);
    assert.equal(tailFile(path.join(dir, 'nope.log')), '');
    assert.equal(tailFile(undefined), '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('boardroom sessions export to readable Markdown', () => {
  const md = boardroomToMarkdown({
    session: { topic: 'Launch a bakery site', status: 'completed', squad_name: 'Core Board', decision: 'Build it with Astro.' },
    messages: [
      { agent_name: 'Julian Vance', agent_role: 'Frontend', message: 'Astro is fast.', phase: 'debate' },
      { agent_name: 'Damon Cole', agent_role: 'Backend', message: 'Keep it static.', phase: 'debate' },
      { agent_name: 'RuXt Leader', agent_role: 'Architect', message: 'Approved.', phase: 'decision' }
    ],
    tasks: [
      { title: 'Design homepage', status: 'done', agent_id: 'julian-vance' },
      { title: 'Set up hosting', status: 'pending' }
    ]
  });
  assert.match(md, /^# Launch a bakery site/);
  assert.match(md, /## Decision\n\nBuild it with Astro\./);
  assert.equal(md.match(/## Debate/g).length, 1, 'phase heading appears once per phase');
  assert.match(md, /\*\*Julian Vance\*\* \(Frontend\)/);
  assert.match(md, /- \[x\] Design homepage \(julian-vance\)/);
  assert.match(md, /- \[ \] Set up hosting/);
});

test('export file names are safe', () => {
  assert.equal(exportFileName('Launch a Bakery Site!'), 'launch-a-bakery-site.md');
  assert.equal(exportFileName('../../etc/passwd'), 'etc-passwd.md');
  assert.equal(exportFileName(''), 'boardroom.md');
});
