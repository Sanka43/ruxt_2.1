import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * RuXt 2.1 Agent Client Protocol (ACP) Service
 * 
 * Implements JSON-RPC 2.0 over stdio with Google Antigravity ACP Server runtime (agy_acp_server.exe)
 * Features:
 * - Persistent process lifecycle with auto-idle cleanup
 * - Zero disk-polling: real-time stdio streaming
 * - Automatic authentication discovery (detects local Google OAuth profile)
 * - Safe workspace filesystem bridge (fs/read_text_file, fs/write_text_file)
 * - Real-time streaming chunks callback support
 */

class AcpEngine {
  constructor() {
    this.child = null;
    this.buffer = '';
    this.nextId = 1;
    this.pending = new Map();
    this.sessionId = null;
    this.activePromptDeferred = null;
    this.idleTimer = null;
    this.idleTimeoutMs = 15 * 60 * 1000; // 15 mins keep-alive
    this.isInitializing = false;
    this.initPromise = null;
    this.authUrl = null;
    this.activeModel = 'flash';
    this.currentCwd = process.cwd();
  }

  findBinary(customPath = null) {
    if (customPath && fs.existsSync(customPath)) {
      return customPath;
    }

    const userProfile = process.env.USERPROFILE || '';
    const localAppData = process.env.LOCALAPPDATA || '';

    const candidates = [];

    // 1. OpenMausBot / standalone Antigravity ACP runtime
    const versionsDir = path.join(userProfile, '.openmausbot', 'tools', 'antigravity-acp', 'win32-x64', 'versions');
    if (fs.existsSync(versionsDir)) {
      try {
        const dirs = fs.readdirSync(versionsDir);
        for (const d of dirs) {
          candidates.push(path.join(versionsDir, d, 'agy_acp_server.exe'));
        }
      } catch (_) {}
    }

    // 2. RuXt tools directory
    const ruxtToolsDir = path.join(userProfile, '.ruxt', 'tools', 'antigravity-acp');
    if (fs.existsSync(ruxtToolsDir)) {
      candidates.push(path.join(ruxtToolsDir, 'agy_acp_server.exe'));
    }

    // 3. Local AppData installations
    candidates.push(
      path.join(localAppData, 'Programs', 'antigravity', 'agy_acp_server.exe'),
      path.join(localAppData, 'Programs', 'Antigravity IDE', 'resources', 'app', 'extensions', 'antigravity', 'bin', 'agy_acp_server.exe')
    );

    return candidates.find(c => c && fs.existsSync(c)) || null;
  }

  findAuthProfileDirectory() {
    const userProfile = process.env.USERPROFILE || '';
    
    // Check OpenMausBot profile where OAuth token is already stored
    const provDir = path.join(userProfile, '.openmausbot', 'providers', 'antigravity');
    if (fs.existsSync(provDir)) {
      try {
        const subs = fs.readdirSync(provDir);
        for (const s of subs) {
          const tokenPath = path.join(provDir, s, 'antigravity-acp', 'acp_token.json');
          if (fs.existsSync(tokenPath)) {
            return path.join(provDir, s);
          }
        }
      } catch (_) {}
    }

    // Check RuXt specific ACP profile
    const ruxtProvDir = path.join(userProfile, '.ruxt', 'providers', 'antigravity');
    if (fs.existsSync(ruxtProvDir)) {
      const tokenPath = path.join(ruxtProvDir, 'antigravity-acp', 'acp_token.json');
      if (fs.existsSync(tokenPath)) {
        return ruxtProvDir;
      }
    }

    // Check Gemini / Antigravity default profile
    const geminiDir = path.join(userProfile, '.gemini', 'antigravity');
    if (fs.existsSync(path.join(geminiDir, 'antigravity-acp', 'acp_token.json'))) {
      return geminiDir;
    }

    // Fallback: create fresh RuXt ACP profile directory
    const defaultProfile = path.join(userProfile, '.ruxt', 'antigravity-acp');
    const subAcp = path.join(defaultProfile, 'antigravity-acp');
    if (!fs.existsSync(subAcp)) {
      fs.mkdirSync(subAcp, { recursive: true });
      fs.writeFileSync(path.join(subAcp, 'settings.json'), JSON.stringify({ auth: { type: 'oauth-personal' } }), 'utf8');
    }
    return defaultProfile;
  }

  isAvailable(customPath = null) {
    return Boolean(this.findBinary(customPath));
  }

  getStatus(customPath = null) {
    const binary = this.findBinary(customPath);
    const profile = this.findAuthProfileDirectory();
    return {
      available: Boolean(binary),
      connected: Boolean(this.child && !this.child.killed && this.sessionId),
      sessionId: this.sessionId,
      binaryPath: binary,
      profileDir: profile
    };
  }

  touchIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      console.log('[RuXt ACP]: Idle timeout reached. Terminating ACP server gracefully to conserve resources.');
      this.shutdown();
    }, this.idleTimeoutMs);
  }

  async ensureReady({ customBinaryPath = null, cwd = null } = {}) {
    if (this.child && !this.child.killed && this.sessionId) {
      this.touchIdleTimer();
      return true;
    }

    if (this.initPromise) {
      return await this.initPromise;
    }

    this.initPromise = (async () => {
      const binary = this.findBinary(customBinaryPath);
      if (!binary) {
        throw new Error('Agent Client Protocol runtime (agy_acp_server.exe) not found on system.');
      }

      const authDir = this.findAuthProfileDirectory();
      console.log(`[RuXt ACP]: Starting ACP Server from ${binary}`);
      console.log(`[RuXt ACP]: Using Profile Directory: ${authDir}`);

      const projectCwd = cwd || process.cwd();
      this.currentCwd = projectCwd;

      // Environment for ACP process
      const env = {
        ...process.env,
        GEMINI_HOME: authDir,
        AGY_ACP_FORCE_FILE_STORAGE: '1',
        PYTHONUNBUFFERED: '1',
        ELECTRON_RUN_AS_NODE: '1'
      };

      // Strip colliding keys that could force cloud API key mode
      delete env.GEMINI_API_KEY;
      delete env.GOOGLE_API_KEY;
      delete env.GOOGLE_APPLICATION_CREDENTIALS;

      this.child = spawn(binary, [], {
        cwd: projectCwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.child.stdout.setEncoding('utf8');
      this.child.stderr.setEncoding('utf8');
      this.buffer = '';

      this.child.stdout.on('data', chunk => this.handleStdout(chunk));
      this.child.stderr.on('data', chunk => this.handleStderr(chunk));

      this.child.on('close', (code, sig) => {
        console.log(`[RuXt ACP]: Process closed (code: ${code}, signal: ${sig})`);
        this.cleanupState(new Error(`ACP server process exited unexpectedly with code ${code}`));
      });

      this.child.on('error', err => {
        console.error('[RuXt ACP]: Process error:', err);
        this.cleanupState(err);
      });

      // 1. Initialize Handshake
      console.log('[RuXt ACP]: Sending initialize request...');
      const initRes = await this.sendRequest('initialize', {
        protocolVersion: 1,
        clientInfo: { name: 'ruxt-desktop', version: '2.1.0' },
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: true },
          terminal: true
        }
      }, 60000);
      console.log('[RuXt ACP]: Handshake confirmed, version:', initRes?.protocolVersion);

      // 2. Authenticate
      console.log('[RuXt ACP]: Authenticating session via oauth-personal...');
      try {
        await this.sendRequest('authenticate', { methodId: 'oauth-personal' }, 30000);
        console.log('[RuXt ACP]: Authentication successful.');
      } catch (authErr) {
        console.warn('[RuXt ACP]: Authentication note:', authErr.message);
      }

      // 3. Create Session
      console.log('[RuXt ACP]: Creating session...');
      const sessionRes = await this.sendRequest('session/new', {
        cwd: projectCwd,
        mcpServers: []
      }, 30000);

      this.sessionId = sessionRes?.sessionId;
      if (!this.sessionId) {
        throw new Error('ACP did not return a valid sessionId from session/new');
      }

      console.log(`[RuXt ACP]: Session created successfully (ID: ${this.sessionId})`);
      this.touchIdleTimer();
      return true;
    })();

    try {
      return await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  sendRequest(method, params, timeoutMs = 45000) {
    if (!this.child || this.child.killed) {
      return Promise.reject(new Error('ACP Server is not running'));
    }

    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`ACP request '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer, method });

      const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      this.child.stdin.write(payload, 'utf8');
    });
  }

  sendResponse(id, result, error = null) {
    if (!this.child || this.child.killed) return;
    const msg = { jsonrpc: '2.0', id };
    if (error) {
      msg.error = { code: -32000, message: error.message || String(error) };
    } else {
      msg.result = result;
    }
    this.child.stdin.write(JSON.stringify(msg) + '\n', 'utf8');
  }

  handleStdout(chunk) {
    this.buffer += chunk;
    let nl;
    while ((nl = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (!line) continue;

      try {
        const msg = JSON.parse(line);
        this.processIncomingMessage(msg);
      } catch (e) {
        // Skip unparseable debug lines
      }
    }
  }

  handleStderr(chunk) {
    const text = chunk.trim();
    if (!text) return;
    
    // Check if auth link is presented
    if (text.includes('Open the following link to authenticate the ACP server:')) {
      const parts = text.split('Open the following link to authenticate the ACP server:');
      this.authUrl = parts[1]?.trim();
      console.warn('[RuXt ACP Auth Needed]: Please authenticate at:', this.authUrl);
    }
  }

  processIncomingMessage(msg) {
    // 1. Response to a pending client request
    if (typeof msg.id === 'number' && this.pending.has(msg.id)) {
      const req = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      clearTimeout(req.timer);

      if (msg.error) {
        req.reject(new Error(msg.error.message || `ACP error code ${msg.error.code}`));
      } else {
        req.resolve(msg.result);
      }
      return;
    }

    // 2. Incoming request from Agent to Host (e.g. filesystem or permission)
    if (msg.id !== undefined && msg.method) {
      this.handleHostMethodCall(msg);
      return;
    }

    // 3. Notifications from Agent (e.g. session/update)
    if (msg.method === 'session/update') {
      const update = msg.params?.update;
      if (!update) return;

      if (update.sessionUpdate === 'agent_message_chunk') {
        const delta = update.content?.text || '';
        if (delta && this.activePromptDeferred?.onDelta) {
          this.activePromptDeferred.onDelta(delta);
        }
        if (delta && this.activePromptDeferred) {
          this.activePromptDeferred.accumulatedText += delta;
        }
      }
    }
  }

  handleHostMethodCall(msg) {
    const { id, method, params } = msg;

    try {
      if (method === 'fs/read_text_file') {
        const filePath = path.resolve(this.currentCwd, params.path);
        // Security check: restrict read to workspace root
        if (!filePath.startsWith(this.currentCwd) && !filePath.startsWith(process.cwd())) {
          return this.sendResponse(id, null, new Error('Permission denied: Path outside workspace'));
        }
        if (!fs.existsSync(filePath)) {
          return this.sendResponse(id, null, new Error('File not found'));
        }
        const content = fs.readFileSync(filePath, 'utf8');
        return this.sendResponse(id, { content });
      }

      if (method === 'fs/write_text_file') {
        const filePath = path.resolve(this.currentCwd, params.path);
        // Security check
        if (!filePath.startsWith(this.currentCwd) && !filePath.startsWith(process.cwd())) {
          return this.sendResponse(id, null, new Error('Permission denied: Path outside workspace'));
        }
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, params.content, 'utf8');
        return this.sendResponse(id, { success: true });
      }

      if (method === 'session/request_permission') {
        // Automatically allow standard operations in assistant mode
        return this.sendResponse(id, { outcome: 'allow' });
      }

      // Default acknowledgement for unknown notifications/calls
      this.sendResponse(id, {});
    } catch (err) {
      this.sendResponse(id, null, err);
    }
  }

  /**
   * Primary entry point for sending a prompt to the ACP Agent
   */
  async prompt({
    promptText,
    systemPrompt = null,
    history = [],
    images = [],
    model = 'flash',
    customBinaryPath = null,
    cwd = null,
    onDelta = null
  }) {
    await this.ensureReady({ customBinaryPath, cwd });
    this.touchIdleTimer();

    // Prepare unified prompt text
    let fullPrompt = '';
    if (systemPrompt) fullPrompt += `System Context: ${systemPrompt}\n\n`;
    if (history && history.length > 0) {
      fullPrompt += 'Recent Conversation:\n';
      for (const h of history.slice(-4)) {
        fullPrompt += `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}\n`;
      }
      fullPrompt += '\n';
    }
    fullPrompt += `User Request: ${promptText}\n\nImportant: Reply directly in conversational natural language as your agent persona. Do not invoke filesystem or shell commands unless explicitly requested.`;

    // Track real-time accumulator
    const deferred = {
      accumulatedText: '',
      onDelta
    };
    this.activePromptDeferred = deferred;

    try {
      const promptItems = [{ type: 'text', text: fullPrompt }];
      if (images && Array.isArray(images) && images.length > 0) {
        for (const img of images) {
          if (!img) continue;
          const rawBase64 = img.replace(/^data:image\/[a-z]+;base64,/, '');
          promptItems.push({
            type: 'image',
            data: rawBase64,
            mimeType: 'image/jpeg'
          });
        }
      }

      const res = await this.sendRequest('session/prompt', {
        sessionId: this.sessionId,
        prompt: promptItems
      }, 60000);

      const outputContent = deferred.accumulatedText.trim();
      return {
        content: outputContent || 'Done.',
        stopReason: res?.stopReason || 'end_turn',
        usage: res?.usage || null,
        sessionId: this.sessionId
      };
    } finally {
      this.activePromptDeferred = null;
    }
  }

  getAccountInfo() {
    const userProfile = process.env.USERPROFILE || '';
    
    // Check openmausbot engine-status.json
    const engineStatusPath = path.join(userProfile, '.openmausbot', 'providers', 'engine-status.json');
    if (fs.existsSync(engineStatusPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(engineStatusPath, 'utf8'));
        const agy = raw.engines?.find(e => e.instanceId === 'antigravity');
        if (agy?.snapshot?.account?.email) {
          return {
            email: agy.snapshot.account.email,
            version: agy.snapshot.version || '1.4.3',
            authenticated: Boolean(agy.snapshot.authenticated),
            method: agy.snapshot.account.method || 'login'
          };
        }
      } catch (_) {}
    }

    // Check acp_token.json or profile
    const profile = this.findAuthProfileDirectory();
    if (profile) {
      const tokenPath = path.join(profile, 'antigravity-acp', 'acp_token.json');
      if (fs.existsSync(tokenPath)) {
        try {
          const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
          return {
            email: tokenData.email || 'isankaerangahtc820@gmail.com',
            version: '1.4.3',
            authenticated: true,
            method: 'oauth-personal'
          };
        } catch (_) {}
      }
    }

    return {
      email: null,
      version: '1.4.3',
      authenticated: false,
      method: null
    };
  }

  cleanupLeftoverFiles() {
    let bytesFreed = 0;
    let fileCount = 0;
    const userProfile = process.env.USERPROFILE || '';
    const tempDir = os.tmpdir();

    try {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        if (/^(antigravity|agy|mausbot)/i.test(file)) {
          const fullPath = path.join(tempDir, file);
          try {
            const stat = fs.statSync(fullPath);
            bytesFreed += stat.size;
            if (stat.isDirectory()) {
              fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(fullPath);
            }
            fileCount++;
          } catch (_) {}
        }
      }
    } catch (_) {}

    const mbTmp = path.join(userProfile, '.openmausbot', 'tmp');
    if (fs.existsSync(mbTmp)) {
      try {
        const entries = fs.readdirSync(mbTmp);
        for (const e of entries) {
          const p = path.join(mbTmp, e);
          try {
            const stat = fs.statSync(p);
            bytesFreed += stat.size;
            fs.rmSync(p, { recursive: true, force: true });
            fileCount++;
          } catch (_) {}
        }
      } catch (_) {}
    }

    return { bytesFreed, fileCount };
  }

  cleanupState(err = null) {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.sessionId = null;
    this.buffer = '';

    for (const [id, req] of this.pending.entries()) {
      clearTimeout(req.timer);
      req.reject(err || new Error('ACP connection closed'));
    }
    this.pending.clear();

    if (this.child) {
      try {
        this.child.stdin?.end();
        this.child.kill();
      } catch (_) {}
      this.child = null;
    }
  }

  shutdown() {
    this.cleanupState();
  }
}

// Singleton ACP instance for RuXt
export const acpService = new AcpEngine();
