import { Router } from 'express';
import db, { dbPath, dataDir } from '../db.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { generateAIResponse, findAntigravityBinary, acpService } from '../services/aiProvider.js';

const router = Router();

const localAppData = process.env.LOCALAPPDATA || '';
const roamingAppData = process.env.APPDATA || '';
const userProfile = process.env.USERPROFILE || '';
const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

// Fast process query with timeout
function getLiveProcessPath(processName) {
  try {
    const stdout = execSync(`tasklist /FI "IMAGENAME eq ${processName}.exe" /FO CSV /NH`, {
      stdio: 'pipe',
      timeout: 1200
    }).toString();
    if (stdout && stdout.toLowerCase().includes(processName.toLowerCase())) {
      return true;
    }
  } catch (_) {}
  return false;
}

// Check system PATH via where.exe with safety timeout
function checkCliTool(cmdName) {
  try {
    const stdout = execSync(`where.exe ${cmdName}`, { stdio: 'pipe', timeout: 1200 }).toString();
    const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
    return lines.length > 0 ? lines[0] : null;
  } catch (_) {
    return null;
  }
}

// Targeted Registry query with safety timeout
function getRegistryInstallPath(keyword) {
  try {
    const cmd = `reg query HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall /s /f "${keyword}" 2>nul`;
    const out = execSync(cmd, { stdio: 'pipe', timeout: 1500 }).toString();
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
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Update or set a setting
router.post('/', (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Missing setting key' });

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
    if (hasAntigravity && (acpAccount.authenticated || acpAccount.email)) {
      ready.push({
        id: 'antigravity',
        name: 'Google Gemini (Antigravity)',
        subtitle: acpAccount.email || 'isankaerangahtc820@gmail.com',
        email: acpAccount.email || 'isankaerangahtc820@gmail.com',
        version: acpAccount.version ? `v${acpAccount.version}` : 'v1.4.3',
        status: 'ready',
        binaryPath: acpBinary || agyBinary,
        type: 'acp',
        icon: 'antigravity'
      });
    } else {
      needsSetup.push({
        id: 'antigravity',
        name: 'Google Gemini (Antigravity)',
        vendor: 'Google DeepMind',
        reason: hasAntigravity ? 'Not signed in. Click to authenticate Google account.' : 'Antigravity IDE / ACP binary not detected on this PC.',
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
        version: 'v2.0 Flash/Pro',
        status: 'ready',
        type: 'api',
        icon: 'gemini'
      });
    }

    // 3. OpenAI
    if (settings.openai_api_key && settings.openai_api_key.trim().length > 5) {
      ready.push({
        id: 'openai',
        name: 'OpenAI (GPT-4o & Codex)',
        subtitle: `Key: ${settings.openai_api_key.slice(0, 6)}...`,
        email: 'API Key Active',
        version: 'v4.0',
        status: 'ready',
        type: 'api',
        icon: 'openai'
      });
    }

    // 4. Anthropic Claude
    if (settings.anthropic_api_key && settings.anthropic_api_key.trim().length > 5) {
      ready.push({
        id: 'claude',
        name: 'Anthropic Claude (Sonnet 3.7)',
        subtitle: `Key: ${settings.anthropic_api_key.slice(0, 8)}...`,
        email: 'API Key Active',
        version: 'v3.7',
        status: 'ready',
        type: 'api',
        icon: 'claude'
      });
    }

    // 5. xAI / Grok
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

    // 6. OpenRouter
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

    // Remaining providers matching Image 1
    needsSetup.push(
      { id: 'kimi', name: 'Kimi', vendor: 'Moonshot AI', reason: 'Needs setup', icon: 'kimi' },
      { id: 'droid', name: 'Droid', vendor: 'Factory', reason: 'Needs setup', icon: 'droid' },
      { id: 'cursor', name: 'Cursor', vendor: 'Cursor', reason: 'Needs setup', icon: 'cursor' },
      { id: 'copilot', name: 'GitHub Copilot', vendor: 'GitHub', reason: 'Needs setup', icon: 'copilot' },
      { id: 'commandcode', name: 'Command Code', vendor: 'Command Code', reason: 'Needs setup', icon: 'commandcode' }
    );

    if (!settings.gemini_api_key || settings.gemini_api_key.trim().length <= 15) {
      needsSetup.push({
        id: 'gemini_api',
        name: 'Google Gemini (Cloud API)',
        vendor: 'Google AI Studio',
        reason: 'No API Key - click Set up to enter free key.',
        icon: 'gemini',
        apiKeyTarget: 'gemini_api_key'
      });
    }

    if (!settings.openai_api_key || settings.openai_api_key.trim().length <= 5) {
      needsSetup.push({
        id: 'openai_api',
        name: 'OpenAI / Codex',
        vendor: 'OpenAI',
        reason: 'No OpenAI API Key.',
        icon: 'openai',
        apiKeyTarget: 'openai_api_key'
      });
    }

    if (!settings.anthropic_api_key || settings.anthropic_api_key.trim().length <= 5) {
      needsSetup.push({
        id: 'claude_api',
        name: 'Anthropic Claude',
        vendor: 'Anthropic',
        reason: 'No Anthropic API Key.',
        icon: 'claude',
        apiKeyTarget: 'anthropic_api_key'
      });
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
    results.push(resolveRuntime({
      id: 'codex',
      name: 'OpenAI / Codex Environment',
      type: 'API & Editor Adapter',
      processName: 'Code',
      cliNames: ['codex', 'code', 'openai'],
      registryKeyword: 'Visual Studio Code',
      customPath: settings.codex_custom_path,
      envCandidates: [
        path.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'),
        path.join(localAppData, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
        path.join(programFiles, 'Microsoft VS Code', 'Code.exe')
      ],
      description: 'OpenAI GPT-4o, GPT-4o-mini, and VS Code / Codex tooling.'
    }));

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
    const { provider, model, apiKey, hostUrl, baseUrl, customPath } = req.body;

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
