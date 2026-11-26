import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

// Needs better-sqlite3 (built for Electron's Node). Under plain `node` these are skipped;
// run `npm run test:electron` to include them.
const Database = (await import('better-sqlite3')).default;
let sqliteOk = false;
try { new Database(':memory:').close(); sqliteOk = true; } catch (_) {}
const skip = !sqliteOk && 'better-sqlite3 built for a different Node ABI; run: npm run test:electron';
const t = (name, fn) => test(name, { skip }, fn);

const here = path.dirname(fileURLToPath(import.meta.url));
const repoAgents = path.resolve(here, '../../../agents');
const STUB = path.join(here, 'fixtures', 'mcp-stub.mjs');

const SLUGS = { never: 'zz-tools-never', always: 'zz-tools-always', first: 'zz-tools-first', legacy: 'zz-tools-legacy', unlisted: 'zz-tools-unlisted' };
const created = [];
let dataDir, db, tools, loops, mgr, McpProcessClient;

function makeAgent(slug, permissions) {
  const dir = path.join(repoAgents, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ format: 'ruxt-agent-package/v3', slug, name: slug, role: 'test', permissions }));
  created.push(dir);
}

async function attachStub(slug) {
  const client = new McpProcessClient(`${slug}:stub`, { command: process.execPath, args: [STUB], env: { ELECTRON_RUN_AS_NODE: '1' } }, here);
  await client.start();
  mgr.mcpClientManager.clients.set(`${slug}:stub`, client);
  return client;
}

if (sqliteOk) {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruxt-tools-test-'));
  process.env.RUXT_DATA_DIR = dataDir;
  process.env.RUXT_TOOL_APPROVAL_TIMEOUT_MS = '400';
  db = (await import('../../db.js')).default;
  tools = await import('../../services/agentTools.js');
  loops = await import('../../services/toolLoops.js');
  mgr = await import('../../services/mcpClientManager.js');
  McpProcessClient = mgr.McpProcessClient;

  makeAgent(SLUGS.never, { apps: ['testapp'], approval: { echo: 'never', crash: 'never' } });
  makeAgent(SLUGS.always, { apps: ['testapp'], approval: { echo: 'always' } });
  makeAgent(SLUGS.first, { apps: ['testapp'], approval: { echo: 'first-use' } });
  makeAgent(SLUGS.unlisted, { apps: ['testapp'], approval: {} });
  const legacyDir = path.join(repoAgents, SLUGS.legacy);
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(path.join(legacyDir, 'manifest.json'), JSON.stringify({ permissions: ['filesystem:write'] }));
  created.push(legacyDir);

  for (const slug of Object.values(SLUGS)) await attachStub(slug);

  test.after(() => {
    mgr.mcpClientManager.shutdownAll();
    try { db.close(); } catch (_) {}
    for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
}

const auditRows = (slug) => db.prepare("SELECT message, details FROM activity_logs WHERE type = 'tool_call' AND message LIKE ? ORDER BY id").all(`${slug} %`);
const nextTick = () => new Promise((r) => setTimeout(r, 20));

// ---------------------------------------------------------------- policy

t('policy: manifest decides; unlisted v3 tools ask once; legacy manifests keep working', () => {
  assert.equal(tools.getToolPolicy(SLUGS.never, 'echo'), 'never');
  assert.equal(tools.getToolPolicy(SLUGS.always, 'echo'), 'always');
  assert.equal(tools.getToolPolicy(SLUGS.first, 'echo'), 'first-use');
  assert.equal(tools.getToolPolicy(SLUGS.unlisted, 'echo'), 'first-use');
  assert.equal(tools.getToolPolicy(SLUGS.legacy, 'echo'), 'never');
  assert.equal(tools.getToolPolicy('no-such-agent', 'echo'), 'never');
});

t('toolResultToText flattens MCP content and caps huge results', () => {
  assert.equal(tools.toolResultToText({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }), 'a\nb');
  assert.match(tools.toolResultToText({ content: [{ type: 'image' }] }), /\[image\]/);
  const big = tools.toolResultToText({ content: [{ type: 'text', text: 'x'.repeat(50000) }] });
  assert.ok(big.length < 21000 && /truncated 30000/.test(big));
});

// ---------------------------------------------------------------- gate

t('never: runs at once and is audited', async () => {
  const r = await tools.executeAgentTool(SLUGS.never, 'echo', { text: 'hi' });
  assert.equal(r.isError, false);
  assert.match(r.text, /hi$/);
  const rows = auditRows(SLUGS.never);
  assert.equal(rows.length, 1);
  assert.match(rows[0].message, /ok$/);
});

t('always: waits for the user, shows the args, runs after approve', async () => {
  const call = tools.executeAgentTool(SLUGS.always, 'echo', { text: 'go', script: 'y'.repeat(5000) });
  await nextTick();
  const [p] = tools.listPendingApprovals();
  assert.equal(p.tool, 'echo');
  assert.equal(p.agentSlug, SLUGS.always);
  assert.ok(p.args.script.length < 3200 && /more characters/.test(p.args.script), 'long values are clipped in the prompt');
  assert.deepEqual(tools.resolveApproval(p.id, 'approve'), { success: true, decision: 'approve' });
  const r = await call;
  assert.equal(r.isError, false);
  assert.equal(tools.listGrants().some((g) => g.agentSlug === SLUGS.always), false, '"always" is never remembered');
});

t('deny: the tool is not run and the model is told not to retry', async () => {
  const before = auditRows(SLUGS.always).length;
  const call = tools.executeAgentTool(SLUGS.always, 'echo', { text: 'nope' });
  await nextTick();
  tools.resolveApproval(tools.listPendingApprovals()[0].id, 'deny');
  const r = await call;
  assert.equal(r.denied, true);
  assert.equal(r.isError, true);
  assert.match(r.text, /did not approve/);
  const rows = auditRows(SLUGS.always);
  assert.match(rows[rows.length - 1].message, /denied$/);
  assert.equal(rows.length, before + 1);
});

t('no answer within the timeout counts as deny', async () => {
  const r = await tools.executeAgentTool(SLUGS.always, 'echo', { text: 'ignored' });
  assert.equal(r.denied, true);
  assert.deepEqual(tools.listPendingApprovals(), []);
});

t('first-use: asked once, remembered, revocable', async () => {
  const first = tools.executeAgentTool(SLUGS.first, 'echo', { text: '1' });
  await nextTick();
  tools.resolveApproval(tools.listPendingApprovals()[0].id, 'approve');
  assert.equal((await first).isError, false);
  assert.equal(tools.isToolGranted(SLUGS.first, 'echo'), true);

  const second = await tools.executeAgentTool(SLUGS.first, 'echo', { text: '2' });
  assert.equal(second.isError, false);
  assert.deepEqual(tools.listPendingApprovals(), [], 'no prompt the second time');

  assert.equal(tools.revokeTool(SLUGS.first, 'echo'), true);
  const third = tools.executeAgentTool(SLUGS.first, 'echo', { text: '3' });
  await nextTick();
  assert.equal(tools.listPendingApprovals().length, 1, 'asks again after revoke');
  tools.resolveApproval(tools.listPendingApprovals()[0].id, 'deny');
  assert.equal((await third).denied, true);
});

t('resolveApproval rejects unknown ids and bad decisions', () => {
  assert.equal(tools.resolveApproval('nope', 'approve').success, false);
  assert.equal(tools.resolveApproval('nope', 'maybe').success, false);
});

t('a crashing tool server is reported, not thrown', async () => {
  const slug = SLUGS.never;
  const r = await tools.executeAgentTool(slug, 'crash', {});
  assert.equal(r.isError, true);
  assert.match(r.text, /failed|closed unexpectedly/);
  await attachStub(slug); // restore for later tests
});

t('withLock runs same-key work one at a time and different keys in parallel', async () => {
  const order = [];
  const job = (name, ms) => () => new Promise((r) => setTimeout(() => { order.push(name); r(name); }, ms));
  const a = tools.withLock('app:x', job('a', 60));
  const b = tools.withLock('app:x', job('b', 5));
  const c = tools.withLock('app:y', job('c', 5));
  await Promise.all([a, b, c]);
  assert.deepEqual(order, ['c', 'a', 'b']);
  await assert.rejects(tools.withLock('app:x', () => Promise.reject(new Error('boom'))), /boom/);
  assert.equal(await tools.withLock('app:x', async () => 'still works'), 'still works');
});

// ---------------------------------------------------------------- loops (fetch is mocked)

function mockFetch(responses) {
  const requests = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requests.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    const next = responses.shift();
    if (!next) throw new Error('unexpected extra request');
    return { ok: next.ok !== false, status: next.status || 200, json: async () => next.json, text: async () => JSON.stringify(next.json ?? next.text ?? '') };
  };
  return { requests, restore: () => { globalThis.fetch = original; } };
}
const oaiCall = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });
const oaiToolMsg = (...calls) => ({ json: { choices: [{ message: { role: 'assistant', content: null, tool_calls: calls } }], usage: { total_tokens: 1 } } });
const oaiText = (text) => ({ json: { choices: [{ message: { role: 'assistant', content: text } }] } });

t('OpenAI loop: several tool steps in a row, then the final answer', async () => {
  const mock = mockFetch([
    oaiToolMsg(oaiCall('c1', 'echo', { text: 'one' })),
    oaiToolMsg(oaiCall('c2', 'echo', { text: 'two' }), oaiCall('c3', 'echo', { text: 'three' })),
    oaiText('all done')
  ]);
  try {
    const messages = [{ role: 'user', content: 'go' }];
    const out = await loops.runOpenAIToolLoop({
      url: 'https://x/v1/chat/completions', headers: { Authorization: 'Bearer k' }, model: 'm', messages,
      mcpTools: [{ name: 'echo', inputSchema: { type: 'object' } }], agentSlug: SLUGS.never
    });
    assert.equal(out.content, 'all done');
    assert.equal(out.mcpEvents.length, 3);
    assert.equal(mock.requests.length, 3);
    assert.ok(mock.requests.every((r) => r.body.tools?.length === 1), 'tools stay available on every step');
    assert.equal(mock.requests[0].headers.Authorization, 'Bearer k');
    const toolMsgs = messages.filter((m) => m.role === 'tool');
    assert.deepEqual(toolMsgs.map((m) => m.tool_call_id), ['c1', 'c2', 'c3']);
  } finally { mock.restore(); }
});

t('OpenAI loop: stops at the step limit with a tool-free summary request', async () => {
  const responses = Array.from({ length: tools.MAX_TOOL_STEPS }, (_, i) => oaiToolMsg(oaiCall(`c${i}`, 'echo', { text: String(i) })));
  responses.push(oaiText('I ran out of steps'));
  const mock = mockFetch(responses);
  try {
    const out = await loops.runOpenAIToolLoop({ url: 'https://x', model: 'm', messages: [{ role: 'user', content: 'loop' }], mcpTools: [{ name: 'echo' }], agentSlug: SLUGS.never });
    assert.equal(out.content, 'I ran out of steps');
    assert.equal(out.mcpEvents.length, tools.MAX_TOOL_STEPS);
    const last = mock.requests[mock.requests.length - 1];
    assert.equal(last.body.tools, undefined);
  } finally { mock.restore(); }
});

t('OpenAI loop: a provider error after tools ran is marked so callers do not retry elsewhere', async () => {
  const mock = mockFetch([oaiToolMsg(oaiCall('c1', 'echo', { text: 'x' })), { ok: false, status: 500, text: 'server down' }]);
  try {
    await assert.rejects(
      loops.runOpenAIToolLoop({ url: 'https://x', model: 'm', messages: [], mcpTools: [{ name: 'echo' }], agentSlug: SLUGS.never }),
      (err) => err.afterTools === true && /500/.test(err.message)
    );
  } finally { mock.restore(); }
});

t('OpenAI loop: an error on the first request is safe to fall back from', async () => {
  const mock = mockFetch([{ ok: false, status: 401, text: 'bad key' }]);
  try {
    await assert.rejects(
      loops.runOpenAIToolLoop({ url: 'https://x', model: 'm', messages: [], mcpTools: [], agentSlug: SLUGS.never }),
      (err) => err.afterTools === false
    );
  } finally { mock.restore(); }
});

t('Claude loop: tool_use blocks are answered with tool_result blocks, over several steps', async () => {
  const use = (id, text) => ({ type: 'tool_use', id, name: 'echo', input: { text } });
  const mock = mockFetch([
    { json: { content: [{ type: 'text', text: 'working' }, use('u1', 'a'), use('u2', 'b')] } },
    { json: { content: [use('u3', 'c')] } },
    { json: { content: [{ type: 'text', text: 'finished' }], usage: { output_tokens: 3 } } }
  ]);
  try {
    const messages = [{ role: 'user', content: 'go' }];
    const out = await loops.runClaudeToolLoop({ apiKey: 'key', model: 'm', system: 's', messages, mcpTools: [{ name: 'echo', inputSchema: { type: 'object' } }], agentSlug: SLUGS.never });
    assert.equal(out.content, 'finished');
    assert.equal(out.mcpEvents.length, 3);
    const results = messages.filter((m) => m.role === 'user' && Array.isArray(m.content)).flatMap((m) => m.content);
    assert.deepEqual(results.map((r) => r.tool_use_id), ['u1', 'u2', 'u3']);
    assert.equal(mock.requests[0].headers['x-api-key'], 'key');
  } finally { mock.restore(); }
});

t('Gemini loop: sends the API key header on every request, handles parallel calls', async () => {
  const fc = (name, args) => ({ functionCall: { name, args } });
  const mock = mockFetch([
    { json: { candidates: [{ content: { role: 'model', parts: [fc('echo', { text: '1' }), fc('echo', { text: '2' })] } }] } },
    { json: { candidates: [{ content: { role: 'model', parts: [{ text: 'gemini is done' }] } }] } }
  ]);
  try {
    const contents = [{ role: 'user', parts: [{ text: 'go' }] }];
    const out = await loops.runGeminiToolLoop({ apiKey: 'gkey', model: 'gemini-2.5-flash', systemPrompt: 's', contents, mcpTools: [{ name: 'echo', inputSchema: { type: 'object' } }], agentSlug: SLUGS.never });
    assert.equal(out.content, 'gemini is done');
    assert.equal(out.mcpEvents.length, 2);
    assert.ok(mock.requests.every((r) => r.headers['x-goog-api-key'] === 'gkey'), 'key header on follow-up requests too');
    assert.ok(mock.requests.every((r) => !String(r.url).includes('gkey')), 'key never in the URL');
    const reply = contents[contents.length - 1];
    assert.equal(reply.parts.length, 2, 'both parallel calls answered in one turn');
  } finally { mock.restore(); }
});

t('a denied tool is reported to the model as an error result', async () => {
  const mock = mockFetch([oaiToolMsg(oaiCall('c1', 'echo', { text: 'x' })), oaiText('ok, I will not run it')]);
  try {
    const messages = [];
    const call = loops.runOpenAIToolLoop({ url: 'https://x', model: 'm', messages, mcpTools: [{ name: 'echo' }], agentSlug: SLUGS.always });
    await new Promise((r) => setTimeout(r, 50));
    tools.resolveApproval(tools.listPendingApprovals()[0].id, 'deny');
    const out = await call;
    assert.match(messages.find((m) => m.role === 'tool').content, /did not approve/);
    assert.equal(out.content, 'ok, I will not run it');
  } finally { mock.restore(); }
});
