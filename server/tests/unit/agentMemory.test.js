import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

// agentMemory resolves its data folder at import time
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruxt-memory-test-'));
process.env.RUXT_DATA_DIR = dataDir;
const mem = await import('../../services/agentMemory.js');
const SLUG = 'unit-test-memory-agent';

test.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

test('a new agent starts with empty memory', () => {
  assert.deepEqual(
    { ...mem.memoryOverview(SLUG), updatedAt: null },
    { slug: SLUG, memories: 0, experiences: 0, preferences: 0, updatedAt: null }
  );
});

test('memories are stored, deduplicated and counted', () => {
  mem.addMemory(SLUG, { content: 'Always answer in Sinhala', importance: 0.9 });
  mem.addMemory(SLUG, { content: 'always answer in sinhala' }); // same text, different case
  mem.addMemory(SLUG, { content: 'Prefer short replies' });
  assert.equal(mem.memoryOverview(SLUG).memories, 2);
});

test('a single memory can be deleted by id', () => {
  const [first] = mem.loadMemory(SLUG).memories;
  assert.equal(mem.deleteMemory(SLUG, first.id), true);
  assert.equal(mem.memoryOverview(SLUG).memories, 1);
  assert.equal(mem.deleteMemory(SLUG, 'does-not-exist'), false);
});

test('clearMemory can forget one section or everything', () => {
  mem.recordExperience(SLUG, { task: 'demo', summary: 'did a thing', score: 8 });
  const data = mem.loadMemory(SLUG);
  data.preferences.push({ id: 'p1', content: 'dark mode' });
  mem.saveMemory(SLUG, data);

  mem.clearMemory(SLUG, 'memories');
  const afterOne = mem.memoryOverview(SLUG);
  assert.equal(afterOne.memories, 0);
  assert.ok(afterOne.experiences + afterOne.preferences > 0, 'other sections untouched');

  mem.clearMemory(SLUG, 'all');
  const afterAll = mem.memoryOverview(SLUG);
  assert.equal(afterAll.memories + afterAll.experiences + afterAll.preferences, 0);
});

test('unknown scopes are rejected', () => {
  assert.throws(() => mem.clearMemory(SLUG, 'secrets'), /scope must be one of/);
});

test('memory is persisted to memory.json inside the agent folder', () => {
  mem.addMemory(SLUG, { content: 'persisted lesson' });
  const file = path.join(dataDir, 'agents', SLUG, 'memory.json');
  assert.ok(fs.existsSync(file));
  assert.match(fs.readFileSync(file, 'utf8'), /persisted lesson/);
});
