// Minimal MCP server over stdio used by the tests. Tool "crash" kills the process, "slow" never answers.
import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin });
const send = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');

rl.on('line', (line) => {
  const msg = JSON.parse(line);
  if (msg.method === 'initialize') return send({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: {} } });
  if (msg.method === 'tools/list') {
    return send({ jsonrpc: '2.0', id: msg.id, result: { tools: ['echo', 'crash', 'slow'].map((name) => ({ name, inputSchema: { type: 'object' } })) } });
  }
  if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params;
    if (name === 'crash') process.exit(1);
    if (name === 'slow') return; // never answers
    return send({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: `pid:${process.pid}:${args?.text ?? ''}` }] } });
  }
});
