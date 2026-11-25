import { Router } from 'express';
import db, { dbPath, dataDir } from '../db.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawn } from 'child_process';
import { maskSettings, isSecretSettingKey, isMaskedSecret } from '../services/secrets.js';
import { generateAIResponse, findAntigravityBinary, acpService } from '../services/aiProvider.js';

const router = Router();

const localAppData = process.env.LOCALAPPDATA || '';
const roamingAppData = process.env.APPDATA || '';
const userProfile = process.env.USERPROFILE || '';
const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

const pathExts = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').map(e => e.toLowerCase());
const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);

// High-speed zero-subprocess in-memory PATH resolver (0ms fs check)
export function findBinaryInPath(names) {
  const targetNames = Array.isArray(names) ? names : [names];
  for (const dir of pathDirs) {
    for (const name of targetNames) {
      const direct = path.join(dir, name);
      if (fs.existsSync(direct)) {
        try { if (!fs.statSync(direct).isDirectory()) return direct; } catch (_) {}
      }
      for (const ext of pathExts) {
        const full = path.join(dir, name.toLowerCase().endsWith(ext) ? name : name + ext);
        if (fs.existsSync(full)) {
          try { if (!fs.statSync(full).isDirectory()) return full; } catch (_) {}
        }
      }
    }
  }
  return null;
}

// Check system PATH in-memory without spawning where.exe
function checkCliTool(cmdName) {
  return findBinaryInPath(cmdName);
}

// Single-call cached process detector to eliminate event loop blocking
let runningProcessCache = null;
let runningProcessCacheTime = 0;

function getRunningProcessSet() {
  const now = Date.now();
  if (runningProcessCache && (now - runningProcessCacheTime < 12000)) {
    return runningProcessCache;
  }
  const set = new Set();
  try {
    const stdout = execSync('tasklist /FO CSV /NH', { stdio: 'pipe', timeout: 800 }).toString();
    const lines = stdout.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^"([^"]+)"/);
      if (match && match[1]) {
        set.add(match[1].toLowerCase());
      }
    }
  } catch (_) {}
  runningProcessCache = set;
  runningProcessCacheTime = now;
  return set;
}

function getLiveProcessPath(processName) {
  if (!processName) return false;
  const set = getRunningProcessSet();
  const lower = processName.toLowerCase();
  return set.has(lower) || set.has(`${lower}.exe`);
}

// Fast registry lookup - only queried if candidate paths & PATH yield null
function getRegistryInstallPath(keyword) {
  try {
    const cmd = `reg query HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall /s /f "${keyword}" 2>nul`;
    const out = execSync(cmd, { stdio: 'pipe', timeout: 1000 }).toString();
    const match = out.match(/(?:DisplayIcon|InstallLocation|UninstallString)\s+REG_SZ\s+["']?([^"',\r\n]+)/i);
    if (match && match[1]) {
      let resolved = match[1].trim();
      resolved = resolved.replace(/^["']/, '').split('"')[0].trim();
      if (fs.existsSync(resolved)) {
        if (fs.statSync(resolved).isDirectory()) {
          const files = fs.readdirSync(resolved);
          const exe = files.find(f => f.toLowerCase().endsWith('.exe'));
          if (exe) return path.join(resolved, exe);
        }
        return resolved;
      }
    }
  } catch (_) {}
  return null;
}

// Dynamic Multi-Tier Discovery Helper
function resolveRuntime({
  id,
  name,
  type,
  processName,
  cliNames = [],
  registryKeyword,
  envCandidates = [],
  customPath = null,
  description
}) {
  // Tier 5: User Custom Override
  if (customPath && fs.existsSync(customPath)) {
    const isLive = processName ? getLiveProcessPath(processName) : false;
    return {
      id,
      name,
      type,
      installed: true,
      isRunning: isLive,
      path: customPath,
      source: 'User Custom Path Override',
      description: `Configured via custom path: ${customPath}`
    };
  }

  // Tier 1: Instant Local Application Directory Scan (0ms fs check)
  for (const candidate of envCandidates) {
    if (candidate && fs.existsSync(candidate)) {
      const isLive = processName ? getLiveProcessPath(processName) : false;
      return {
        id,
        name,
        type,
        installed: true,
        isRunning: isLive,
        path: candidate,
        source: 'Local Application Directory',
        description: `Discovered at installation path: ${candidate}`
      };
    }
  }

  // Tier 2: System PATH
  for (const cli of cliNames) {
    const p = checkCliTool(cli);
    if (p) {
      const isLive = processName ? getLiveProcessPath(processName) : false;
      return {
        id,
        name,
        type,
        installed: true,
        isRunning: isLive,
        path: p,
        source: 'System PATH Environment',
        description: `Found in system PATH: ${cli}`
      };
    }
  }

  // Tier 3: Targeted Windows Registry
  if (registryKeyword) {
    const regPath = getRegistryInstallPath(registryKeyword);
    if (regPath) {
      const isLive = processName ? getLiveProcessPath(processName) : false;
      return {
        id,
        name,
        type,
        installed: true,
        isRunning: isLive,
        path: regPath,
        source: 'Windows Application Registry',
        description: `Discovered from Windows Registry (${path.basename(regPath)}).`
      };
    }
  }

  // Tier 4: Live OS Process (if running under different location)
  if (processName) {
    const isLive = getLiveProcessPath(processName);
    if (isLive) {
      return {
        id,
        name,
        type,
        installed: true,
        isRunning: true,
        path: `${processName}.exe`,
        source: 'Live OS Process',
        description: `Active process detected in memory (${processName}.exe).`
      };
    }
  }

  return {
    id,
    name,
    type,
    installed: false,
    isRunning: false,
    path: null,
    source: 'Not Detected',
    description: description || 'Not detected on this machine. You can specify a custom path in Settings.'
  };
}

// 1. Get all settings
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {
      active_provider: 'antigravity',
      antigravity_model: 'flash',
      antigravity_custom_path: '',
      stealth_host_mode: 'true',
      engine_status_antigravity: 'connected',
      engine_status_gemini: 'connected',
      engine_status_claude: 'connected',
      engine_status_openai: 'connected',
      engine_status_ollama: 'connected',
      engine_status_custom: 'connected',
      gemini_model: 'gemini-2.0-flash',
      claude_model: 'claude-3-7-sonnet-20250219',
      openai_model: 'gpt-4o-mini',
      ollama_host: 'http://localhost:11434',
      ollama_model: 'deepseek-r1:latest',
      custom_base_url: 'http://localhost:1234/v1'
    };
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json({ success: true, settings: maskSettings(settings) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Update or set a setting
router.post('/', (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Missing setting key' });
    // The UI only ever sees masked keys; never overwrite a real key with its mask.
    if (isSecretSettingKey(key) && isMaskedSecret(value)) {
      return res.json({ success: true, key, unchanged: true });
    }

    const stmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(key, typeof value === 'object' ? JSON.stringify(value) : String(value));

    if (key === 'engine_status_antigravity' && value === 'disconnected') {
      acpService.shutdown();
    }

    res.json({ success: true, key, value });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2b. Batch update settings
router.post('/batch', (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Missing settings object in body' });
    }

    const insertOrUpdate = db.prepare(`
      INSERT INTO settings (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);

    const updateMany = db.transaction((entries) => {
      for (const [k, v] of Object.entries(entries)) {
        if (isSecretSettingKey(k) && isMaskedSecret(v)) continue;
        insertOrUpdate.run(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
    });

    updateMany(settings);
    res.json({ success: true, updatedCount: Object.keys(settings).length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2c. Engine connection toggle (connect / disconnect)
router.post('/engine-toggle', async (req, res) => {
  try {
    const { engine = 'antigravity', status = 'connected' } = req.body;
    const key = `engine_status_${engine}`;
    const newStatus = status === 'connected' ? 'connected' : 'disconnected';

    db.prepare(`
      INSERT INTO settings (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, newStatus);

    if (engine === 'antigravity') {
      if (newStatus === 'disconnected') {
        acpService.shutdown();
      } else {
        await acpService.ensureReady().catch(() => {});
      }
    }

    res.json({ success: true, engine, status: newStatus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2d. Live ACP runtime status
router.get('/acp-status', (req, res) => {
  try {
    const status = acpService.getStatus();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('engine_status_antigravity');
    const configuredStatus = row?.value || 'connected';
    const account = acpService.getAccountInfo();
    res.json({
      success: true,
      ...status,
      configuredStatus,
      account
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2d-2. Clean leftover files / temporary space
router.post('/clean-temp-files', (req, res) => {
  try {
    const result = acpService.cleanupLeftoverFiles();
    const mbFormatted = (result.bytesFreed / (1024 * 1024)).toFixed(1);
    res.json({
      success: true,
      bytesFreed: result.bytesFreed,
      fileCount: result.fileCount,
      message: result.bytesFreed > 0 ? `Freed ${mbFormatted} MB across ${result.fileCount} temporary files.` : 'Space is clean. No leftover temporary files found.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2d-2b. Test Antigravity local engine connection
router.post('/antigravity/test', async (req, res) => {
  const startTime = Date.now();
  try {
    const customPath = req.body?.customPath || null;
    const binary = acpService.findBinary(customPath) || findAntigravityBinary(customPath);
    if (!binary) {
      return res.status(404).json({
        success: false,
        error: 'Google Antigravity binary (agy.exe) not found on system.'
      });
    }

    let mode = 'acp';
    try {
      await acpService.ensureReady({ customBinaryPath: binary });
    } catch (acpErr) {
      mode = 'cli';
    }

    const latency = Date.now() - startTime;
    res.json({
      success: true,
      binaryPath: binary,
      mode,
      latencyMs: latency,
      message: `Antigravity local engine connected successfully via ${mode.toUpperCase()} (${latency}ms)`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      latencyMs: Date.now() - startTime
    });
  }
});

// 2d-2c. Launch Google account login for Antigravity
router.post('/antigravity/login', (req, res) => {
  try {
    const customPath = req.body?.customPath || null;
    const binary = acpService.findBinary(customPath) || findAntigravityBinary(customPath);
    if (!binary) {
      return res.status(404).json({
        success: false,
        error: 'Google Antigravity binary (agy.exe) not found. Please install agy or specify custom path.'
      });
    }

    if (process.platform === 'win32') {
      const isAgy = path.basename(binary).toLowerCase().startsWith('agy');
      const startArgs = isAgy
        ? ['/d', '/c', 'start', 'Antigravity Google Sign-in', binary, 'acp', '--login']
        : ['/d', '/c', 'start', 'Antigravity IDE', binary];
      spawn('cmd.exe', startArgs, { stdio: 'ignore', detached: true }).unref();
    } else {
      spawn(binary, ['acp', '--login'], { stdio: 'ignore', detached: true }).unref();
    }

    res.json({
      success: true,
      message: 'Antigravity Google login process launched in terminal window. Follow prompt in terminal/browser to complete login.'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Helper to find Codex CLI on the host machine
function findCodexBinary(customPath) {
  if (customPath && fs.existsSync(customPath)) return customPath;
  const inPath = findBinaryInPath(['codex', 'openai', 'code']);
  if (inPath) return inPath;
  const candidates = [
    path.join(localAppData, 'Programs', 'codex', 'codex.exe'),
    path.join(roamingAppData, 'npm', 'codex.cmd'),
    path.join(roamingAppData, 'npm', 'codex'),
    path.join(userProfile, 'AppData', 'Roaming', 'npm', 'codex.cmd'),
    path.join(localAppData, 'OpenAI', 'codex.exe'),
    path.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'),
    path.join(localAppData, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
    path.join(programFiles, 'Microsoft VS Code', 'Code.exe'),
    path.join(programFiles, 'Microsoft VS Code', 'bin', 'code.cmd'),
    path.join(userProfile, '.codex', 'bin', 'codex.exe')
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

// Helper to find Cursor binary
function findCursorBinary(customPath) {
  if (customPath && fs.existsSync(customPath)) return customPath;
  const inPath = findBinaryInPath(['cursor', 'cursor.cmd']);
  if (inPath) return inPath;
  const candidates = [
    path.join(localAppData, 'Programs', 'cursor', 'Cursor.exe'),
    path.join(localAppData, 'Programs', 'cursor', 'resources', 'app', 'bin', 'cursor'),
    path.join(localAppData, 'cursor', 'Cursor.exe'),
    path.join(programFiles, 'Cursor', 'Cursor.exe')
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

// Helper to find Claude Desktop / CLI binary
function findClaudeBinary(customPath) {
  if (customPath && fs.existsSync(customPath)) return customPath;
  const inPath = findBinaryInPath(['claude', 'claude.cmd']);
  if (inPath) return inPath;
  const candidates = [
    path.join(localAppData, 'AnthropicClaude', 'claude.exe'),
    path.join(localAppData, 'Programs', 'Claude', 'Claude.exe'),
    path.join(programFiles, 'Claude', 'Claude.exe'),
    path.join(roamingAppData, 'npm', 'claude.cmd')
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

// Helper to find Ollama binary
function findOllamaBinary(customPath) {
  if (customPath && fs.existsSync(customPath)) return customPath;
  const inPath = findBinaryInPath(['ollama']);
  if (inPath) return inPath;
  const candidates = [
    path.join(localAppData, 'Programs', 'Ollama', 'ollama.exe'),
    path.join(programFiles, 'Ollama', 'ollama.exe')
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

// Helper to inspect Codex / OpenAI CLI login tokens
function getCodexAuthInfo() {
  const candidates = [
    path.join(userProfile, '.codex', 'auth.json'),
    path.join(userProfile, '.codex', 'config.json'),
    path.join(userProfile, '.openai', 'auth.json'),
    path.join(userProfile, '.config', 'codex', 'auth.json')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (data.email || data.user?.email || data.access_token || data.token || data.apiKey) {
          return {
            authenticated: true,
            email: data.email || data.user?.email || null,
            token: data.access_token || data.token || data.apiKey || null
          };
        }
      } catch (_) {}
    }
  }
  return { authenticated: false, email: null, token: null };
}

// 2d-3. Model providers and accounts status (Image 1 & 2 match)
router.get('/providers-status', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;

    const acpBinary = acpService.findBinary(settings.antigravity_custom_path);
    const agyBinary = findAntigravityBinary(settings.antigravity_custom_path);
    const hasAntigravity = Boolean(acpBinary || agyBinary);
    const acpAccount = acpService.getAccountInfo();

    const ready = [];
    const needsSetup = [];

    // 1. Google Gemini (Antigravity ACP Engine)
    if (hasAntigravity) {
      const isAuth = acpAccount.authenticated || Boolean(acpAccount.email);
      ready.push({
        id: 'antigravity',
        name: 'Google Gemini (Antigravity)',
        subtitle: acpAccount.email || (isAuth ? 'Connected via ACP' : `Local Engine Ready (${path.basename(agyBinary || acpBinary)})`),
        email: acpAccount.email || (isAuth ? 'Authenticated Session' : 'Local IDE Engine Active'),
        version: acpAccount.version ? `v${acpAccount.version}` : 'v1.5',
        status: 'ready',
        binaryPath: acpBinary || agyBinary,
        type: 'acp',
        icon: 'antigravity',
        authenticated: isAuth
      });
    } else {
      needsSetup.push({
        id: 'antigravity',
        name: 'Google Gemini (Antigravity)',
        vendor: 'Google DeepMind',
        reason: 'Antigravity IDE / agy CLI binary not detected on this PC.',
        icon: 'antigravity',
        canAuth: true
      });
    }

    // 2. Google Gemini (Cloud API)
    if (settings.gemini_api_key && settings.gemini_api_key.trim().length > 15) {
      ready.push({
        id: 'gemini',
        name: 'Google Gemini (Cloud API)',
        subtitle: `Key: ${settings.gemini_api_key.slice(0, 7)}...`,
        email: 'Direct Cloud API',
        version: 'v2.5 Flash',
        status: 'ready',
        type: 'api',
        icon: 'gemini'
      });
    } else {
      needsSetup.push({
        id: 'gemini',
        name: 'Google Gemini (Cloud API)',
        vendor: 'Google AI Studio',
        reason: 'No API Key - click Set up to enter free key.',
        icon: 'gemini',
        apiKeyTarget: 'gemini_api_key'
      });
    }

    // 3. OpenAI / Codex (Supports both Cloud API Key and local Codex CLI)
    const codexBin = findCodexBinary(settings.codex_custom_path);
    const codexAuth = getCodexAuthInfo();
    const hasOpenAiKey = settings.openai_api_key && settings.openai_api_key.trim().length > 5;

    if (hasOpenAiKey || codexBin || codexAuth.authenticated) {
      const isCli = !hasOpenAiKey && (Boolean(codexBin) || codexAuth.authenticated);
      ready.push({
        id: 'openai',
        name: 'OpenAI (GPT-4o & Codex)',
        subtitle: hasOpenAiKey 
          ? `Key: ${settings.openai_api_key.slice(0, 6)}...` 
          : (codexAuth.email ? `${codexAuth.email} (Codex CLI)` : `Local Codex/VSCode CLI (${path.basename(codexBin || 'codex')})`),
        email: hasOpenAiKey ? 'API Key Active' : (codexAuth.email || 'Codex Session Active'),
        version: 'v4.0',
        status: 'ready',
        type: isCli ? 'cli' : 'api',
        icon: 'openai',
        binaryPath: codexBin,
        authenticated: true
      });
    } else {
      needsSetup.push({
        id: 'openai',
        name: 'OpenAI / Codex',
        vendor: 'OpenAI',
        reason: 'No OpenAI API Key or Codex CLI detected on this PC.',
        icon: 'openai',
        apiKeyTarget: 'openai_api_key'
      });
    }

    // 4. Anthropic Claude (Supports both Cloud API Key and Claude Desktop / CLI)
    const claudeBin = findClaudeBinary(settings.claude_custom_path);
    const hasClaudeKey = settings.anthropic_api_key && settings.anthropic_api_key.trim().length > 5;
    if (hasClaudeKey || claudeBin) {
      ready.push({
        id: 'claude',
        name: 'Anthropic Claude (Sonnet 3.7)',
        subtitle: hasClaudeKey ? `Key: ${settings.anthropic_api_key.slice(0, 8)}...` : `Local Claude (${path.basename(claudeBin)})`,
        email: hasClaudeKey ? 'API Key Active' : 'Claude Desktop / CLI Active',
        version: 'v3.7',
        status: 'ready',
        type: hasClaudeKey ? 'api' : 'cli',
        icon: 'claude',
        binaryPath: claudeBin
      });
    } else {
      needsSetup.push({
        id: 'claude',
        name: 'Anthropic Claude',
        vendor: 'Anthropic',
        reason: 'No Anthropic API Key or Claude CLI detected.',
        icon: 'claude',
        apiKeyTarget: 'anthropic_api_key'
      });
    }

    // 5. Cursor AI (Agent & Editor)
    const cursorBin = findCursorBinary(settings.cursor_custom_path);
    if (cursorBin) {
      ready.push({
        id: 'cursor',
        name: 'Cursor AI (Agent & Editor)',
        subtitle: `Local Agent Active (${path.basename(cursorBin)})`,
        email: 'Local Cursor IDE Session',
        version: 'v0.45+',
        status: 'ready',
        type: 'cli',
        icon: 'cursor',
        binaryPath: cursorBin
      });
    } else {
      needsSetup.push({
        id: 'cursor',
        name: 'Cursor',
        vendor: 'Anysphere',
        reason: 'Cursor IDE / CLI not detected on this machine.',
        icon: 'cursor'
      });
    }

    // 6. Local Ollama Runtime
    const ollamaBin = findOllamaBinary(settings.ollama_custom_path);
    if (ollamaBin) {
      ready.push({
        id: 'ollama',
        name: 'Local Ollama Runtime',
        subtitle: `Local Engine (${path.basename(ollamaBin)})`,
        email: 'Offline Local Models',
        version: 'v0.5+',
        status: 'ready',
        type: 'local',
        icon: 'ollama',
        binaryPath: ollamaBin
      });
    } else {
      needsSetup.push({
        id: 'ollama',
        name: 'Ollama (Local Models)',
        vendor: 'Ollama',
        reason: 'Local Ollama binary not detected.',
        icon: 'ollama'
      });
    }

    // 7. xAI / Grok
    if (settings.xai_api_key && settings.xai_api_key.trim().length > 5) {
      ready.push({
        id: 'xai',
        name: 'Grok (xAI)',
        subtitle: `Key: ${settings.xai_api_key.slice(0, 6)}...`,
        email: 'API Key Active',
        version: 'v2.0',
        status: 'ready',
        type: 'api',
        icon: 'grok'
      });
    } else {
      needsSetup.push({
        id: 'xai',
        name: 'Grok',
        vendor: 'xAI',
        reason: 'No xAI API key configured.',
        icon: 'grok',
        apiKeyTarget: 'xai_api_key'
      });
    }

    // 8. OpenRouter
    if (settings.openrouter_api_key && settings.openrouter_api_key.trim().length > 5) {
      ready.push({
        id: 'openrouter',
        name: 'OpenRouter',
        subtitle: `Key: ${settings.openrouter_api_key.slice(0, 8)}...`,
        email: 'Unified Multi-Model Gateway',
        version: 'v1.0',
        status: 'ready',
        type: 'api',
        icon: 'openrouter'
      });
    }

    // Kimi (Moonshot AI)
    if (settings.kimi_api_key && settings.kimi_api_key.trim().length > 5) {
      ready.push({
        id: 'kimi',
        name: 'Kimi',
        subtitle: `Key: ${settings.kimi_api_key.slice(0, 6)}...`,
        email: 'Moonshot AI Active',
        version: 'v1.5',
        status: 'ready',
        type: 'api',
        icon: 'kimi'
      });
    } else {
      needsSetup.push({ id: 'kimi', name: 'Kimi', vendor: 'Moonshot AI', reason: 'Needs setup', icon: 'kimi', apiKeyTarget: 'kimi_api_key' });
    }

    // Droid (Factory)
    if (settings.droid_api_key && settings.droid_api_key.trim().length > 5) {
      ready.push({
        id: 'droid',
        name: 'Droid',
        subtitle: 'Factory.ai Active Agent',
        email: 'Autonomous Droid Agent',
        version: 'v1.0',
        status: 'ready',
        type: 'api',
        icon: 'droid'
      });
    } else {
      needsSetup.push({ id: 'droid', name: 'Droid', vendor: 'Factory', reason: 'Needs setup', icon: 'droid', apiKeyTarget: 'droid_api_key' });
    }

    // GitHub Copilot
    needsSetup.push({ id: 'copilot', name: 'GitHub Copilot', vendor: 'GitHub', reason: 'Needs setup', icon: 'copilot' });

    // Command Code / Cohere
    if (settings.cohere_api_key && settings.cohere_api_key.trim().length > 5) {
      ready.push({
        id: 'commandcode',
        name: 'Command Code',
        subtitle: `Key: ${settings.cohere_api_key.slice(0, 6)}...`,
        email: 'Cohere Enterprise API',
        version: 'Command R+',
        status: 'ready',
        type: 'api',
        icon: 'commandcode'
      });
    } else {
      needsSetup.push({ id: 'commandcode', name: 'Command Code', vendor: 'Cohere', reason: 'Needs setup', icon: 'commandcode', apiKeyTarget: 'cohere_api_key' });
    }

    res.json({
      success: true,
      ready,
      needsSetup,
      readyCount: ready.length,
      needsSetupCount: needsSetup.length,
      activeProvider: settings.active_provider || (ready.length > 0 ? ready[0].id : 'gemini')
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2e. Storage statistics & SQLite metrics
router.get('/storage-stats', (req, res) => {
  try {
    let dbSizeBytes = 0;
    let walSizeBytes = 0;

    if (fs.existsSync(dbPath)) {
      dbSizeBytes = fs.statSync(dbPath).size;
    }
    const walPath = `${dbPath}-wal`;
    if (fs.existsSync(walPath)) {
      walSizeBytes = fs.statSync(walPath).size;
    }

    const messageCount = db.prepare('SELECT COUNT(*) as count FROM chat_messages').get()?.count || 0;
    const sessionCount = db.prepare('SELECT COUNT(*) as count FROM chat_sessions').get()?.count || 0;
    const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get()?.count || 0;
    const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get()?.count || 0;
    const logCount = db.prepare('SELECT COUNT(*) as count FROM activity_logs').get()?.count || 0;

    res.json({
      success: true,
      dataDir,
      dbPath,
      dbSizeBytes,
      walSizeBytes,
      totalSizeBytes: dbSizeBytes + walSizeBytes,
      dbSizeFormatted: (dbSizeBytes / 1024).toFixed(1) + ' KB',
      totalSizeFormatted: ((dbSizeBytes + walSizeBytes) / 1024).toFixed(1) + ' KB',
      counts: {
        messages: messageCount,
        sessions: sessionCount,
        tasks: taskCount,
        agents: agentCount,
        activityLogs: logCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2d. Compact and Vacuum SQLite Database
router.post('/vacuum', (req, res) => {
  try {
    const beforeSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    db.exec('VACUUM');
    const afterSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

    res.json({
      success: true,
      freedBytes: Math.max(0, beforeSize - afterSize),
      freedFormatted: Math.max(0, (beforeSize - afterSize) / 1024).toFixed(1) + ' KB',
      currentSizeBytes: afterSize,
      currentSizeFormatted: (afterSize / 1024).toFixed(1) + ' KB'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2e. Clear chat messages & session history
router.post('/clear-history', (req, res) => {
  try {
    const { target = 'all' } = req.body;

    if (target === 'messages' || target === 'all') {
      db.prepare('DELETE FROM chat_messages').run();
      db.prepare('DELETE FROM chat_sessions').run();
      try {
        db.prepare('DELETE FROM team_dispatches').run();
      } catch (_) {}
    }
    if (target === 'logs' || target === 'all') {
      db.prepare('DELETE FROM activity_logs').run();
    }

    db.exec('PRAGMA incremental_vacuum');

    res.json({ success: true, message: 'History purged successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2e-2. Reset Workspace to Factory Clean State (Full Clean Reset)
router.post('/factory-reset', (req, res) => {
  try {
    // 1. Purge chat sessions, messages, tasks, logs, boardrooms
    db.prepare('DELETE FROM chat_messages').run();
    db.prepare('DELETE FROM chat_sessions').run();
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM activity_logs').run();
    try { db.prepare('DELETE FROM boardroom_messages').run(); } catch (_) {}
    try { db.prepare('DELETE FROM boardroom_sessions').run(); } catch (_) {}
    try { db.prepare('DELETE FROM agent_dispatches').run(); } catch (_) {}

    // 2. Remove all specialist agents, preserving strictly the core 'ruxt' leader
    db.prepare("DELETE FROM agents WHERE slug != 'ruxt'").run();

    // 3. Remove user-installed agent directories if present in dataDir/agents
    const userAgentsDir = path.join(dataDir, 'agents');
    if (fs.existsSync(userAgentsDir)) {
      try {
        const entries = fs.readdirSync(userAgentsDir);
        for (const e of entries) {
          if (e !== 'ruxt' && e !== 'packages') {
            fs.rmSync(path.join(userAgentsDir, e), { recursive: true, force: true });
          }
        }
      } catch (_) {}
    }

    db.exec('VACUUM');

    res.json({
      success: true,
      message: 'Workspace has been reset to factory fresh state! Only RuXt Leader remains.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2f. Diagnostic system metrics & recent activity logs
router.get('/diagnostics', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 20').all();

    res.json({
      success: true,
      system: {
        os: `${os.type()} ${os.release()} (${os.arch()})`,
        nodeVersion: process.version,
        electronVersion: process.versions.electron || 'Host Browser / Local-First',
        memoryFreeMB: Math.round(os.freemem() / (1024 * 1024)),
        memoryTotalMB: Math.round(os.totalmem() / (1024 * 1024)),
        uptimeSeconds: Math.round(process.uptime()),
        pid: process.pid
      },
      recentLogs: logs
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Scan Local PC using Dynamic 5-Tier Discovery Cascade
router.get('/detect-runtimes', async (req, res) => {
  try {
    // Read saved custom path overrides
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;

    const results = [];

    // --- A. Google Antigravity ---
    const detectedAgyBin = findAntigravityBinary(settings.antigravity_custom_path);
    const hasAcp = acpService.isAvailable(settings.antigravity_custom_path);
    const acpBin = acpService.findBinary(settings.antigravity_custom_path);
    const agyResolved = resolveRuntime({
      id: 'antigravity',
      name: 'Google Antigravity Platform',
      type: hasAcp ? 'Autonomous Agent Platform (Agent Client Protocol - ACP)' : 'Autonomous Agent Platform & IDE (Zero API Key Engine)',
      processName: 'Antigravity',
      cliNames: ['agy', 'antigravity'],
      registryKeyword: 'Antigravity',
      customPath: settings.antigravity_custom_path,
      envCandidates: [
        acpBin,
        detectedAgyBin,
        path.join(localAppData, 'Programs', 'Antigravity IDE', 'resources', 'app', 'extensions', 'antigravity', 'bin', 'language_server_windows_x64.exe'),
        path.join(userProfile, '.gemini', 'antigravity-ide', 'bin', 'agentapi.bat'),
        path.join(localAppData, 'Programs', 'antigravity', 'Antigravity.exe'),
        path.join(localAppData, 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe'),
        path.join(programFiles, 'Antigravity', 'Antigravity.exe'),
        path.join(userProfile, '.gemini', 'antigravity')
      ],
      description: 'Google DeepMind advanced agentic coding environment.'
    });

    results.push({
      ...agyResolved,
      installed: !!(agyResolved.installed || detectedAgyBin || hasAcp),
      path: acpBin || agyResolved.path || detectedAgyBin,
      models: ['flash', 'pro', 'flash_lite'],
      zeroKeySupported: true,
      protocol: hasAcp ? 'Agent Client Protocol (ACP) - JSON-RPC 2.0' : 'Local CLI Process',
      acpSupported: hasAcp,
      description: hasAcp
        ? `Connected via Agent Client Protocol (ACP) [${path.basename(acpBin)}]. Zero API key required!`
        : (detectedAgyBin
          ? `Connected to local Antigravity binary: ${path.basename(detectedAgyBin)}. Zero API key required!`
          : agyResolved.description)
    });

    // --- B. Cursor Editor / Agent ---
    results.push(resolveRuntime({
      id: 'cursor',
      name: 'Cursor Editor / Agent CLI',
      type: 'Local Editor & Agent',
      processName: 'Cursor',
      cliNames: ['cursor'],
      registryKeyword: 'Cursor',
      customPath: settings.cursor_custom_path,
      envCandidates: [
        path.join(localAppData, 'Programs', 'cursor', 'cursor.exe'),
        path.join(localAppData, 'Programs', 'cursor', 'resources', 'app', 'bin', 'cursor'),
        path.join(programFiles, 'Cursor', 'Cursor.exe')
      ],
      description: 'Cursor AI code editor with native agent integration.'
    }));

    // --- C. Anthropic Claude ---
    results.push(resolveRuntime({
      id: 'claude',
      name: 'Anthropic Claude (Desktop & Code CLI)',
      type: 'Desktop Runtime & Agent CLI',
      processName: 'claude',
      cliNames: ['claude'],
      registryKeyword: 'Claude',
      customPath: settings.claude_custom_path,
      envCandidates: [
        path.join(localAppData, 'AnthropicClaude', 'claude.exe'),
        path.join(roamingAppData, 'Claude', 'claude_desktop_config.json'),
        path.join(localAppData, 'Programs', 'Claude', 'Claude.exe'),
        path.join(programFiles, 'Claude', 'Claude.exe')
      ],
      description: 'Anthropic Claude desktop environment & terminal agent.'
    }));

    // --- D. Local Ollama Server & Models ---
    let ollamaServerOnline = false;
    let ollamaModels = [];
    const ollamaHost = settings.ollama_host || 'http://localhost:11434';

    try {
      const ollamaRes = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(1500) });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        ollamaServerOnline = true;
        ollamaModels = data.models ? data.models.map(m => m.name) : [];
      }
    } catch (_) {}

    const ollamaResolved = resolveRuntime({
      id: 'ollama',
      name: 'Local Ollama Runtime',
      type: 'Local Offline LLM Server',
      processName: 'ollama',
      cliNames: ['ollama'],
      registryKeyword: 'Ollama',
      customPath: settings.ollama_custom_path,
      envCandidates: [
        path.join(localAppData, 'Programs', 'Ollama', 'ollama.exe'),
        path.join(programFiles, 'Ollama', 'ollama.exe')
      ],
      description: 'Local offline model runner (Ollama).'
    });

    results.push({
      ...ollamaResolved,
      installed: ollamaResolved.installed || ollamaServerOnline,
      serverOnline: ollamaServerOnline,
      models: ollamaModels,
      description: ollamaServerOnline
        ? `Running online with ${ollamaModels.length} models installed (${ollamaModels.slice(0, 3).join(', ')}).`
        : ollamaResolved.installed
        ? `Ollama binary located via ${ollamaResolved.source}. (Daemon offline)`
        : 'Local offline model runner (Ollama).'
    });

    // --- E. OpenAI / Codex / VS Code ---
    const codexCliPath = findCodexBinary(settings.codex_custom_path);
    const codexAuthStatus = getCodexAuthInfo();
    const codexResolved = resolveRuntime({
      id: 'codex',
      name: 'OpenAI / Codex Environment',
      type: 'Local CLI, Editor & Cloud API',
      processName: 'codex',
      cliNames: ['codex', 'codex.cmd', 'openai', 'openai.cmd', 'code'],
      registryKeyword: 'Visual Studio Code',
      customPath: settings.codex_custom_path,
      envCandidates: [
        codexCliPath,
        path.join(localAppData, 'Programs', 'codex', 'codex.exe'),
        path.join(roamingAppData, 'npm', 'codex.cmd'),
        path.join(userProfile, 'AppData', 'Roaming', 'npm', 'codex.cmd'),
        path.join(localAppData, 'OpenAI', 'codex.exe'),
        path.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'),
        path.join(localAppData, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
        path.join(programFiles, 'Microsoft VS Code', 'Code.exe')
      ],
      description: 'OpenAI GPT-4o, GPT-4o-mini, and Codex CLI / tooling.'
    });

    results.push({
      ...codexResolved,
      installed: codexResolved.installed || Boolean(codexCliPath) || codexAuthStatus.authenticated || Boolean(settings.openai_api_key),
      path: codexCliPath || codexResolved.path,
      source: codexCliPath ? 'Codex CLI Environment' : codexResolved.source,
      models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'codex'],
      description: codexCliPath
        ? `Found Codex CLI at ${codexCliPath}. Zero API key required!`
        : (settings.openai_api_key ? 'Authenticated via OpenAI Cloud API Key.' : codexResolved.description)
    });

    const enrichedResults = results.map(r => ({
      ...r,
      engineStatus: settings[`engine_status_${r.id}`] || 'connected'
    }));

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      runtimes: enrichedResults
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Test connection to selected AI Provider
router.post('/test-connection', async (req, res) => {
  try {
    const { provider, model, hostUrl, baseUrl, customPath } = req.body;
    const apiKey = isMaskedSecret(req.body.apiKey) ? '' : req.body.apiKey;

    const rows = db.prepare('SELECT key, value FROM settings').all();
    const dbSettings = {};
    for (const r of rows) dbSettings[r.key] = r.value;

    const testResult = await generateAIResponse({
      provider: provider || 'antigravity',
      model,
      systemPrompt: 'You are an AI diagnostic tester. Respond with exactly the phrase: "Connection verified successfully!"',
      userMessage: 'Ping diagnostic test.',
      settings: {
        antigravity_model: model || dbSettings.antigravity_model || 'flash',
        antigravity_custom_path: customPath || dbSettings.antigravity_custom_path,
        stealth_host_mode: dbSettings.stealth_host_mode || 'true',
        gemini_api_key: apiKey || dbSettings.gemini_api_key,
        anthropic_api_key: apiKey || dbSettings.anthropic_api_key,
        openai_api_key: apiKey || dbSettings.openai_api_key,
        ollama_host: hostUrl || dbSettings.ollama_host,
        custom_base_url: baseUrl || dbSettings.custom_base_url
      }
    });

    res.json({
      success: true,
      message: 'Connection verified successfully!',
      sample: testResult.content.slice(0, 100),
      model: testResult.model,
      provider: testResult.provider
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
