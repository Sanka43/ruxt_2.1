// Google Antigravity host bridge: binary discovery, conversation clean-up and the
// send/poll loop. Split out of aiProvider.js unchanged; aiProvider re-exports it.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { acpService } from './acpService.js';
import { execCliSync } from './safeExec.js';

const pathExts = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').map(e => e.toLowerCase());
const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);

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

/**
 * Unified Multi-Provider AI Adapter for RuXt Local Engine
 * Supports:
 * - Google Antigravity Local Engine Bridge (Zero API Key Required - uses local Google sign-in)
 * - Google Gemini Cloud API (API Key)
 * - Anthropic Claude (API & local Claude Code CLI)
 * - OpenAI / Codex (GPT-4o, GPT-4o-mini, Codex)
 * - Local Offline Ollama (DeepSeek-R1, Qwen 2.5 Coder, Llama 3)
 * - Custom OpenAI-Compatible Local/Remote Endpoints (LM Studio, vLLM)
 */

function getOpenMausBotAntigravityCandidates(userProfile) {
  const list = [];
  const versionsDir = path.join(userProfile, '.openmausbot', 'tools', 'antigravity-acp', 'win32-x64', 'versions');
  if (fs.existsSync(versionsDir)) {
    try {
      const subdirs = fs.readdirSync(versionsDir);
      for (const dir of subdirs) {
        list.push(path.join(versionsDir, dir, 'agy_acp_server.exe'));
        list.push(path.join(versionsDir, dir, 'localharness_external.exe'));
      }
    } catch (_) {}
  }
  return list;
}

export function findAntigravityBinary(customPath = null) {
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }
  const localAppData = process.env.LOCALAPPDATA || '';
  const userProfile = process.env.USERPROFILE || '';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';

  // 1. Direct system PATH check (agy or antigravity)
  const inPath = findBinaryInPath(['agy', 'antigravity']);
  if (inPath) return inPath;

  const candidates = [
    // 2. Standalone agy CLI installation
    path.join(localAppData, 'agy', 'bin', 'agy.exe'),
    // 3. Antigravity IDE language server binary (standard Antigravity installation)
    path.join(localAppData, 'Programs', 'Antigravity IDE', 'resources', 'app', 'extensions', 'antigravity', 'bin', 'language_server_windows_x64.exe'),
    // 4. Antigravity IDE main executable
    path.join(localAppData, 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe'),
    path.join(programFiles, 'Antigravity IDE', 'Antigravity IDE.exe'),
    // 5. Antigravity IDE batch wrapper
    path.join(userProfile, '.gemini', 'antigravity-ide', 'bin', 'agentapi.bat'),
    // 6. Standalone Antigravity binary
    path.join(localAppData, 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe'),
    path.join(userProfile, '.gemini', 'antigravity', 'bin', 'language_server.exe'),
    // 7. OpenMausBot Antigravity runtime if installed
    ...getOpenMausBotAntigravityCandidates(userProfile)
  ];
  return candidates.find(c => c && fs.existsSync(c)) || null;
}

function normalizeAntigravityModel(model) {
  if (!model) return 'flash';
  const m = String(model).toLowerCase();
  if (m.includes('pro')) return 'pro';
  if (m.includes('lite')) return 'flash_lite';
  return 'flash';
}

function getIsolatedBridgeWorkspace() {
  const userProfile = process.env.USERPROFILE || '';
  const wsDir = path.join(userProfile, '.ruxt', 'workspace');
  if (!fs.existsSync(wsDir)) {
    fs.mkdirSync(wsDir, { recursive: true });
  }
  return wsDir;
}

export async function stealthPurgeHostConversation(convId) {
  if (!convId) return;
  const userProfile = process.env.USERPROFILE || '';
  const dbPaths = [
    path.join(userProfile, '.gemini', 'antigravity', 'conversations', `${convId}.db`),
    path.join(userProfile, '.gemini', 'antigravity-ide', 'conversations', `${convId}.db`)
  ];

  // Stage 1: Zero out SQLite database tables so host IDE cannot display conversation
  for (const dbPath of dbPaths) {
    if (fs.existsSync(dbPath)) {
      try {
        const db = new Database(dbPath);
        db.exec(`
          DELETE FROM trajectory_meta;
          DELETE FROM steps;
          DELETE FROM gen_metadata;
          DELETE FROM executor_metadata;
          DELETE FROM parent_references;
          DELETE FROM trajectory_metadata_blob;
          DELETE FROM battle_mode_infos;
        `);
        db.close();
      } catch (_) {}
    }
  }

  // Stage 2: Retry unlinking all host artifacts once file locks drop
  const targets = [
    path.join(userProfile, '.gemini', 'antigravity', 'brain', convId),
    path.join(userProfile, '.gemini', 'antigravity-ide', 'brain', convId),
    path.join(userProfile, '.gemini', 'antigravity', 'conversations', `${convId}.db`),
    path.join(userProfile, '.gemini', 'antigravity', 'conversations', `${convId}.db-wal`),
    path.join(userProfile, '.gemini', 'antigravity', 'conversations', `${convId}.db-shm`),
    path.join(userProfile, '.gemini', 'antigravity-ide', 'conversations', `${convId}.db`),
    path.join(userProfile, '.gemini', 'antigravity-ide', 'conversations', `${convId}.db-wal`),
    path.join(userProfile, '.gemini', 'antigravity-ide', 'conversations', `${convId}.db-shm`)
  ];

  for (let attempt = 1; attempt <= 10; attempt++) {
    await new Promise(r => setTimeout(r, 600 * attempt));
    let remaining = 0;
    for (const t of targets) {
      if (fs.existsSync(t)) {
        try {
          if (fs.statSync(t).isDirectory()) {
            fs.rmSync(t, { recursive: true, force: true });
          } else {
            fs.unlinkSync(t);
          }
        } catch (_) {
          remaining++;
        }
      }
    }
    if (remaining === 0) break;
  }
}

function getTranscriptPaths(convId) {
  const userProfile = process.env.USERPROFILE || '';
  return [
    path.join(userProfile, '.gemini', 'antigravity', 'brain', convId, '.system_generated', 'logs', 'transcript_full.jsonl'),
    path.join(userProfile, '.gemini', 'antigravity', 'brain', convId, '.system_generated', 'logs', 'transcript.jsonl'),
    path.join(userProfile, '.gemini', 'antigravity-ide', 'brain', convId, '.system_generated', 'logs', 'transcript_full.jsonl'),
    path.join(userProfile, '.gemini', 'antigravity-ide', 'brain', convId, '.system_generated', 'logs', 'transcript.jsonl')
  ];
}

function getLatestStepIndex(convId) {
  const paths = getTranscriptPaths(convId);
  for (const p of paths) {
    if (fs.existsSync(p)) {
      try {
        const lines = fs.readFileSync(p, 'utf8').trim().split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (!line) continue;
          const step = JSON.parse(line);
          if (typeof step.step_index === 'number') {
            return step.step_index;
          }
        }
      } catch (_) {}
    }
  }
  return -1;
}

async function pollForModelResponse(convId, minStepIndex = -1, timeoutMs = 45000) {
  const paths = getTranscriptPaths(convId);
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    for (const cPath of paths) {
      if (fs.existsSync(cPath)) {
        try {
          const content = fs.readFileSync(cPath, 'utf8');
          const lines = content.trim().split('\n');
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (!line) continue;
            const step = JSON.parse(line);
            if (step.source === 'MODEL' && step.content && (minStepIndex < 0 || step.step_index > minStepIndex)) {
              let text = step.content.trim();
              if (!text.startsWith('Created At:') && !text.startsWith('Command exited') && text.length > 0) {
                return text;
              }
            }
          }
        } catch (_) {}
      }
    }
    await new Promise(r => setTimeout(r, 600));
  }
  return null;
}

// 0. Active Google Antigravity Local Engine Bridge (Zero API Key Needed!)
export async function callAntigravityHost({
  model = 'flash',
  systemPrompt,
  userMessage,
  history = [],
  images = [],
  customBinaryPath = null,
  conversationTitle = null,
  stealthHostMode = false,
  existingConversationId = null,
  projectCwd = null,
  agentSlug = null
}) {
  const binary = findAntigravityBinary(customBinaryPath);
  if (!binary) {
    throw new Error('Google Antigravity engine binary not found. Please install Antigravity IDE or specify custom binary path in Settings.');
  }

  try {
    let fullPrompt = '';
    if (systemPrompt) fullPrompt += `System Context: ${systemPrompt}\n\n`;
    if (history && history.length > 0) {
      fullPrompt += 'Recent Conversation:\n';
      for (const h of history.slice(-4)) {
        fullPrompt += `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}\n`;
      }
      fullPrompt += '\n';
    }
    fullPrompt += `User Request: ${userMessage}\n\nCRITICAL DIRECTIVE: Reply directly with your conversational response as your agent persona. DO NOT invoke any tools, shell commands, or filesystem operations. Provide your complete, structured answer immediately as text.`;

    const normModel = normalizeAntigravityModel(model);
    const bridgeCwd = projectCwd || process.cwd();
    const cleanTitle = conversationTitle ? `[RuXt] ${conversationTitle.slice(0, 50)}` : '[RuXt Chat]';

    // Sanitize Antigravity environment to prevent attaching to this active project conversation
    const cleanEnv = { ...process.env };
    delete cleanEnv.ANTIGRAVITY_CONVERSATION_ID;
    delete cleanEnv.ANTIGRAVITY_SOURCE_METADATA;
    delete cleanEnv.ANTIGRAVITY_TRAJECTORY_ID;

    let convId = existingConversationId;
    let minStepIndex = -1;

    const displayModel = normModel === 'pro'
      ? 'Gemini 2.0 Pro (Antigravity)'
      : normModel === 'flash_lite'
      ? 'Gemini 2.0 Flash-Lite (Antigravity)'
      : 'Gemini 2.0 Flash (Antigravity)';

    // PRIMARY PATH: Agent Client Protocol (ACP) Engine (High-Performance Zero-Disk-Polling JSON-RPC)
    if (acpService.isAvailable(customBinaryPath)) {
      try {
        console.log('[Antigravity Host]: Routing request through high-speed ACP engine...');
        const acpResult = await acpService.prompt({
          promptText: userMessage,
          systemPrompt,
          history,
          images,
          model: normModel,
          customBinaryPath,
          cwd: bridgeCwd,
          agentSlug
        });

        if (acpResult && acpResult.content) {
          return {
            content: acpResult.content,
            provider: 'Google Antigravity (ACP Engine)',
            model: `${displayModel} [ACP]`,
            conversationId: acpResult.sessionId
          };
        }
      } catch (acpErr) {
        console.warn('[Antigravity ACP fallback to legacy CLI]:', acpErr.message);
      }
    }

    // Modern Google Antigravity CLI fallback (agy.exe -p headless mode)
    const isAgy = path.basename(binary).toLowerCase().startsWith('agy') && !path.basename(binary).toLowerCase().includes('server');
    if (isAgy) {
      try {
        const args = ['-p', fullPrompt, '--output-format', 'text', '--dangerously-skip-permissions'];
        if (normModel && normModel !== 'flash') {
          const modelArg = normModel === 'pro' ? 'gemini-3.8-flash-high' : normModel === 'flash_lite' ? 'gemini-3.8-flash-low' : 'gemini-3.8-flash-medium';
          args.push('--model', modelArg);
        }
        const out = execFileSync(binary, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 45000,
          cwd: bridgeCwd,
          env: cleanEnv
        }).toString().trim();

        if (out) {
          return {
            content: out,
            provider: 'Google Antigravity (Local Engine)',
            model: displayModel,
            conversationId: convId || 'cli-direct'
          };
        }
      } catch (cliErr) {
        console.warn('[Antigravity Direct CLI error]:', cliErr.message);
      }
    }

    // Legacy IDE fallback: If an existing conversation exists for this thread, verify its transcript exists first
    if (convId) {
      const paths = getTranscriptPaths(convId);
      const convExists = paths.some(p => fs.existsSync(p));
      if (!convExists) {
        console.log(`[Antigravity]: Existing conversation ID ${convId} transcript not found on disk. Creating fresh thread.`);
        convId = null;
      } else {
        minStepIndex = getLatestStepIndex(convId);
        try {
          if (binary.toLowerCase().endsWith('.bat')) {
            execCliSync(binary, [
              'send-message',
              convId,
              fullPrompt
            ], { stdio: 'pipe', timeout: 35000, cwd: bridgeCwd, env: cleanEnv });
          } else {
            execFileSync(binary, [
              'agentapi',
              'send-message',
              convId,
              fullPrompt
            ], { stdio: 'pipe', timeout: 35000, cwd: bridgeCwd, env: cleanEnv });
          }

          // Poll for reply in existing thread (25s)
          const replyText = await pollForModelResponse(convId, minStepIndex, 25000);
          if (replyText) {
            return {
              content: replyText,
              provider: 'Google Antigravity (Local Engine)',
              model: displayModel,
              conversationId: convId
            };
          }
          console.warn(`[Antigravity]: send-message to ${convId} timed out. Starting fresh thread.`);
          convId = null;
        } catch (sendErr) {
          console.warn(`[Antigravity send-message fallback]: Existing conversation ${convId} could not receive message, starting new one:`, sendErr.message);
          convId = null;
        }
      }
    }

    // If no existing conversation or send-message failed, create a fresh thread
    if (!convId) {
      let out;
      if (binary.toLowerCase().endsWith('.bat')) {
        out = execCliSync(binary, [
          'new-conversation',
          `--title=${cleanTitle}`,
          `--model=${normModel}`,
          fullPrompt
        ], { stdio: 'pipe', timeout: 35000, cwd: bridgeCwd, env: cleanEnv }).toString();
      } else {
        out = execFileSync(binary, [
          'agentapi',
          'new-conversation',
          `--title=${cleanTitle}`,
          `--model=${normModel}`,
          fullPrompt
        ], { stdio: 'pipe', timeout: 35000, cwd: bridgeCwd, env: cleanEnv }).toString();
      }

      const json = JSON.parse(out);
      convId = json.response?.newConversation?.conversationId;
      minStepIndex = -1;
    }

    if (!convId) {
      throw new Error('Antigravity did not return a valid conversation ID.');
    }

    const replyText = await pollForModelResponse(convId, minStepIndex, 45000);
    if (!replyText) {
      throw new Error('Antigravity request timed out waiting for engine response.');
    }

    return {
      content: replyText,
      provider: 'Google Antigravity (Local Engine)',
      model: displayModel,
      conversationId: convId
    };
  } catch (err) {
    console.warn('[Antigravity Local Engine warning]:', err.message);
    throw err;
  }
}
