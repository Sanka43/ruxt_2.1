import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_MCP_COMMANDS = new Set(['python', 'python3', 'py', 'node']);
const SCRIPT_ARG_RE = /\.(py|js|mjs|cjs)$/i;
const MAX_RESTARTS = 3;

/**
 * An agent manifest decides which program RuXt launches, so it must not be able to name
 * arbitrary system binaries (powershell, cmd, curl...). Only script interpreters are
 * allowed, and any script they run has to live inside the agent's own folder.
 * Returns { ok: true } or { ok: false, reason }.
 */
export function validateMcpServerConfig(conf, agentDir) {
  const command = String(conf?.command || 'python');
  const base = path.basename(command).toLowerCase().replace(/\.exe$/, '');
  if (command !== path.basename(command) || !ALLOWED_MCP_COMMANDS.has(base)) {
    return { ok: false, reason: `command "${command}" is not an allowed interpreter (python, python3, py, node)` };
  }
  const root = path.resolve(agentDir);
  for (const arg of conf?.args || []) {
    const a = String(arg);
    if (!SCRIPT_ARG_RE.test(a)) continue;
    const resolved = path.resolve(root, a);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      return { ok: false, reason: `script "${a}" is outside the agent folder` };
    }
  }
  return { ok: true };
}

/**
 * Single MCP Server Client managing stdio JSON-RPC 2.0 communication
 */
export class McpProcessClient {
  constructor(serverKey, config, workingDir) {
    this.serverKey = serverKey;
    this.config = config;
    this.workingDir = workingDir;
    this.process = null;
    this.buffer = '';
    this.nextId = 1;
    this.pending = new Map();
    this.tools = [];
    this.isReady = false;
    this.restarts = 0;
  }

  start() {
    if (this.process && this.isReady) return Promise.resolve(this.tools);
    if (!this._starting) {
      // concurrent callers share one launch instead of spawning duplicate servers
      this._starting = this._launch().finally(() => { this._starting = null; });
    }
    return this._starting;
  }

  _launch() {

    return new Promise((resolve, reject) => {
      try {
        const command = this.config.command || 'python';
        const args = this.config.args || [];
        const env = {
          ...process.env,
          ...(this.config.env || {}),
          PYTHONUNBUFFERED: '1'
        };

        this.process = spawn(command, args, {
          cwd: this.workingDir,
          env,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stdout.setEncoding('utf8');
        this.process.stderr.setEncoding('utf8');

        this.process.stdout.on('data', chunk => this.handleData(chunk));
        this.process.stderr.on('data', errChunk => {
          // MCP servers can log diagnostic info to stderr without failing
          console.log(`[MCP ${this.serverKey} stderr]: ${errChunk.trim()}`);
        });

        this.process.on('close', code => {
          this.isReady = false;
          this.process = null; // a dead process must never look alive to start()
          for (const [id, { reject: pReject }] of this.pending.entries()) {
            pReject(new Error(`MCP server ${this.serverKey} closed unexpectedly with code ${code}`));
          }
          this.pending.clear();
        });

        this.process.on('error', err => {
          reject(new Error(`Failed to start MCP server ${this.serverKey}: ${err.message}`));
        });

        // Initialize MCP handshake
        this.initialize()
          .then(() => this.listTools())
          .then(tools => {
            this.tools = tools;
            this.isReady = true;
            resolve(tools);
          })
          .catch(reject);

      } catch (err) {
        reject(err);
      }
    });
  }

  handleData(chunk) {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop(); // keep trailing incomplete fragment

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        }
      } catch (_) {
        // Non-JSON stdout message, ignore or log
      }
    }
  }

  sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.process || this.process.killed) {
        return reject(new Error(`MCP server ${this.serverKey} is not running.`));
      }

      const id = this.nextId++;
      const payload = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      const timeoutMs = Number(this.config.timeoutMs) > 0 ? Number(this.config.timeoutMs) : 30000;
      const timeout = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP request ${method} timed out after ${Math.round(timeoutMs / 1000)}s`));
        }
      }, timeoutMs);

      this.pending.set(id, {
        resolve: res => { clearTimeout(timeout); resolve(res); },
        reject: err => { clearTimeout(timeout); reject(err); }
      });

      this.process.stdin.write(JSON.stringify(payload) + '\n');
    });
  }

  async initialize() {
    return this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'RuXt-Studio-Engine', version: '2.1.0' }
    });
  }

  async listTools() {
    const res = await this.sendRequest('tools/list', {});
    return res?.tools || [];
  }

  async callTool(name, argumentsObj = {}) {
    const res = await this.sendRequest('tools/call', {
      name,
      arguments: argumentsObj
    });
    return res;
  }

  shutdown() {
    if (this.process && !this.process.killed) {
      try { this.process.kill(); } catch (_) {}
    }
    this.process = null;
    this.isReady = false;
  }
}

/**
 * Universal MCP Client Manager for RuXt Platform
 */
class McpClientManager {
  constructor() {
    this.clients = new Map(); // key: `${agentSlug}:${serverKey}` -> McpProcessClient
  }

  /**
   * Resolves agent directory on disk
   */
  resolveAgentDir(agentSlug) {
    const userProfile = process.env.USERPROFILE || '';
    const appData = process.env.APPDATA || (userProfile ? path.join(userProfile, 'AppData', 'Roaming') : '');

    const candidates = [
      path.resolve(__dirname, '../../agents', agentSlug),
      path.resolve(__dirname, '../../../agents', agentSlug),
      path.join(appData, 'RuXt', 'data', 'agents', agentSlug),
      path.resolve(__dirname, '../../data/agents', agentSlug)
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return candidates[0];
  }

  /**
   * Reads mcpServers configuration from agent manifest
   */
  getAgentMcpManifest(agentSlug) {
    const agentDir = this.resolveAgentDir(agentSlug);
    const manifestPath = path.join(agentDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return {};

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      return manifest.mcpServers || {};
    } catch (_) {
      return {};
    }
  }

  /**
   * Returns ACP-compatible mcpServers list for session/new in Antigravity
   */
  getAcpConfigForAgent(agentSlug) {
    const mcpServers = this.getAgentMcpManifest(agentSlug);
    const agentDir = this.resolveAgentDir(agentSlug);
    const userProfile = process.env.USERPROFILE || '';
    const workspace = path.join(userProfile, '.ruxt', 'workspace');

    const acpList = [];
    for (const [key, conf] of Object.entries(mcpServers)) {
      const resolvedArgs = (conf.args || []).map(arg => 
        String(arg).replace(/\$\{agentDir\}/g, agentDir).replace(/\$\{workspace\}/g, workspace)
      );
      acpList.push({
        id: `${agentSlug}-${key}`,
        command: conf.command || 'python',
        args: resolvedArgs,
        env: conf.env || {}
      });
    }
    return acpList;
  }

  /**
   * Starts all declared MCP servers for an agent and discovers tools
   */
  async ensureAgentMcpTools(agentSlug) {
    const mcpServers = this.getAgentMcpManifest(agentSlug);
    const agentDir = this.resolveAgentDir(agentSlug);
    const userProfile = process.env.USERPROFILE || '';
    const workspace = path.join(userProfile, '.ruxt', 'workspace');

    const allTools = [];

    for (const [key, rawConf] of Object.entries(mcpServers)) {
      const clientKey = `${agentSlug}:${key}`;
      const resolvedArgs = (rawConf.args || []).map(arg => 
        String(arg).replace(/\$\{agentDir\}/g, agentDir).replace(/\$\{workspace\}/g, workspace)
      );

      const conf = {
        ...rawConf,
        args: resolvedArgs
      };

      const check = validateMcpServerConfig(conf, agentDir);
      if (!check.ok) {
        console.warn(`[RuXt MCP Manager]: Refusing to start ${clientKey}: ${check.reason}`);
        continue;
      }

      let client = this.clients.get(clientKey);
      if (!client || !client.isReady) {
        client = new McpProcessClient(clientKey, conf, agentDir);
        this.clients.set(clientKey, client);
      }

      try {
        const tools = await client.start();
        for (const t of tools) {
          allTools.push({
            ...t,
            _mcpServerKey: clientKey
          });
        }
      } catch (err) {
        console.warn(`[RuXt MCP Manager]: Failed to initialize ${clientKey}:`, err.message);
      }
    }

    return allTools;
  }

  /**
   * Executes a tool across the active agent's MCP servers
   */
  async callTool(agentSlug, toolName, args) {
    for (const [clientKey, client] of this.clients.entries()) {
      if (!clientKey.startsWith(`${agentSlug}:`)) continue;
      if (!client.tools.some(t => t.name === toolName)) continue;

      // A server that crashed since its last use is restarted (a few times) instead of staying dead
      if (!client.isReady) {
        if (client.restarts >= MAX_RESTARTS) {
          throw new Error(`MCP server ${clientKey} keeps crashing; not restarting it again.`);
        }
        client.restarts++;
        console.warn(`[RuXt MCP Manager]: Restarting ${clientKey} (attempt ${client.restarts}/${MAX_RESTARTS})`);
        await client.start();
      }
      return await client.callTool(toolName, args);
    }
    throw new Error(`Tool ${toolName} not found in any running MCP server for ${agentSlug}`);
  }

  /**
   * Formats MCP tools into Google Gemini Function Declarations
   */
  toGeminiTools(mcpTools) {
    if (!mcpTools || mcpTools.length === 0) return null;
    return [{
      functionDeclarations: mcpTools.map(t => ({
        name: t.name,
        description: t.description || '',
        parameters: t.inputSchema || { type: 'object', properties: {} }
      }))
    }];
  }

  /**
   * Formats MCP tools into OpenAI / Ollama Tool schema
   */
  toOpenAITools(mcpTools) {
    if (!mcpTools || mcpTools.length === 0) return null;
    return mcpTools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description || '',
        parameters: t.inputSchema || { type: 'object', properties: {} }
      }
    }));
  }

  /**
   * Formats MCP tools into Anthropic Claude Tool schema
   */
  toClaudeTools(mcpTools) {
    if (!mcpTools || mcpTools.length === 0) return null;
    return mcpTools.map(t => ({
      name: t.name,
      description: t.description || '',
      input_schema: t.inputSchema || { type: 'object', properties: {} }
    }));
  }

  /**
   * Graceful shutdown of all MCP servers
   */
  shutdownAll() {
    for (const client of this.clients.values()) {
      client.shutdown();
    }
    this.clients.clear();
  }
}

export const mcpClientManager = new McpClientManager();
