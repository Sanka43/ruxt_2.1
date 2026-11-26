import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { McpProcessClient, mcpClientManager, validateMcpServerConfig } from '../../services/mcpClientManager.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const STUB = path.join(here, 'fixtures', 'mcp-stub.mjs');
const config = (extra = {}) => ({ command: 'node', args: [STUB], ...extra });

// "node" must resolve even when tests run under Electron's embedded Node
const nodeCmd = process.execPath;

test.after(() => mcpClientManager.shutdownAll());

test('validateMcpServerConfig only allows interpreters and scripts inside the agent folder', () => {
  const dir = path.resolve('agents', 'demo');
  assert.equal(validateMcpServerConfig({ command: 'python', args: ['server.py'] }, dir).ok, true);
  assert.equal(validateMcpServerConfig({ command: 'node', args: ['mcp/index.js'] }, dir).ok, true);
  assert.equal(validateMcpServerConfig({ command: 'powershell', args: ['-c', 'ls'] }, dir).ok, false);
  assert.equal(validateMcpServerConfig({ command: 'C:\\Windows\\System32\\cmd.exe', args: [] }, dir).ok, false);
  assert.equal(validateMcpServerConfig({ command: 'curl', args: [] }, dir).ok, false);
  assert.equal(validateMcpServerConfig({ command: 'python', args: ['../../evil.py'] }, dir).ok, false);
  assert.equal(validateMcpServerConfig({ command: 'python', args: ['C:\\temp\\evil.py'] }, dir).ok, false);
});

test('client starts, lists tools and calls one', async () => {
  const client = new McpProcessClient('t:basic', { command: nodeCmd, args: [STUB], env: { ELECTRON_RUN_AS_NODE: '1' } }, here);
  const tools = await client.start();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['crash', 'echo', 'slow']);
  const res = await client.callTool('echo', { text: 'hi' });
  assert.match(res.content[0].text, /hi$/);
  client.shutdown();
});

test('concurrent start() calls share one process', async () => {
  const client = new McpProcessClient('t:concurrent', { command: nodeCmd, args: [STUB], env: { ELECTRON_RUN_AS_NODE: '1' } }, here);
  await Promise.all([client.start(), client.start(), client.start()]);
  const a = (await client.callTool('echo', {})).content[0].text;
  const b = (await client.callTool('echo', {})).content[0].text;
  assert.equal(a.split(':')[1], b.split(':')[1], 'same server pid');
  client.shutdown();
});

test('a request that never gets an answer times out', async () => {
  const client = new McpProcessClient('t:slow', { command: nodeCmd, args: [STUB], timeoutMs: 400, env: { ELECTRON_RUN_AS_NODE: '1' } }, here);
  await client.start();
  await assert.rejects(client.callTool('slow', {}), /timed out/);
  client.shutdown();
});

test('manager restarts a crashed server on the next call', async () => {
  const client = new McpProcessClient('agentx:stub', { command: nodeCmd, args: [STUB], env: { ELECTRON_RUN_AS_NODE: '1' } }, here);
  await client.start();
  mcpClientManager.clients.set('agentx:stub', client);

  const before = (await mcpClientManager.callTool('agentx', 'echo', {})).content[0].text.split(':')[1];
  await assert.rejects(mcpClientManager.callTool('agentx', 'crash', {}), /closed unexpectedly/);
  const after = (await mcpClientManager.callTool('agentx', 'echo', { text: 'back' })).content[0].text;

  assert.match(after, /back$/);
  assert.notEqual(after.split(':')[1], before, 'a new process serves the call');
  assert.equal(client.restarts, 1);
});

test('manager gives up on a server that keeps crashing', async () => {
  const client = new McpProcessClient('agenty:stub', { command: nodeCmd, args: [STUB], env: { ELECTRON_RUN_AS_NODE: '1' } }, here);
  await client.start();
  mcpClientManager.clients.set('agenty:stub', client);

  for (let i = 0; i < 3; i++) {
    await assert.rejects(mcpClientManager.callTool('agenty', 'crash', {}));
    await mcpClientManager.callTool('agenty', 'echo', {}).catch(() => {});
  }
  await assert.rejects(mcpClientManager.callTool('agenty', 'crash', {}));
  await assert.rejects(mcpClientManager.callTool('agenty', 'echo', {}), /keeps crashing/);
});
