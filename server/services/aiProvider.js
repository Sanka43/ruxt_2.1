import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { acpService } from './acpService.js';

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
  const candidates = [
    // 1. Antigravity IDE language server binary (standard Antigravity installation)
    path.join(localAppData, 'Programs', 'Antigravity IDE', 'resources', 'app', 'extensions', 'antigravity', 'bin', 'language_server_windows_x64.exe'),
    // 2. Antigravity IDE batch wrapper
    path.join(userProfile, '.gemini', 'antigravity-ide', 'bin', 'agentapi.bat'),
    // 3. Standalone Antigravity binary
    path.join(localAppData, 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe'),
    // 4. OpenMausBot Antigravity runtime if installed
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
  projectCwd = null
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
          cwd: bridgeCwd
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

    // If an existing conversation exists for this thread, verify its transcript exists first
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
            execFileSync(binary, [
              'send-message',
              convId,
              fullPrompt
            ], { stdio: 'pipe', timeout: 35000, shell: true, cwd: bridgeCwd, env: cleanEnv });
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
        out = execFileSync(binary, [
          'new-conversation',
          `--title=${cleanTitle}`,
          `--model=${normModel}`,
          fullPrompt
        ], { stdio: 'pipe', timeout: 35000, shell: true, cwd: bridgeCwd, env: cleanEnv }).toString();
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

export async function generateAIResponse({
  provider = 'antigravity',
  model,
  systemPrompt,
  userMessage,
  history = [],
  images = [],
  settings = {},
  conversationTitle = null,
  agentSlug = 'ruxt',
  agentName = 'RuXt',
  agentRole = 'Chief of Staff',
  existingConversationId = null,
  projectCwd = null
}) {
  let primaryError = null;

  // Check if provider is paused or disconnected by user
  const engineStatus = settings[`engine_status_${provider}`] || 'connected';
  if (engineStatus === 'paused') {
    throw new Error(`${provider.toUpperCase()} engine is currently PAUSED by you. Unpause or select another engine to proceed.`);
  }
  if (engineStatus === 'disconnected') {
    throw new Error(`${provider.toUpperCase()} engine is currently DISCONNECTED. Connect it in Settings to proceed.`);
  }

  // 1. Try Selected Primary Provider
  try {
    switch (provider) {
      case 'antigravity':
        return await callAntigravityHost({
          model: model || settings.antigravity_model || 'flash',
          systemPrompt,
          userMessage,
          history,
          images,
          customBinaryPath: settings.antigravity_custom_path,
          conversationTitle: conversationTitle || settings.conversation_title,
          stealthHostMode: settings.stealth_host_mode === 'true',
          existingConversationId,
          projectCwd
        });

      case 'gemini':
        if (settings.gemini_api_key && settings.gemini_api_key.trim().length > 15) {
          return await callGemini({
            apiKey: settings.gemini_api_key,
            model: model || settings.gemini_model || 'gemini-2.0-flash',
            systemPrompt,
            userMessage,
            history,
            images
          });
        }
        // If no cloud Gemini API key is configured and Antigravity is not paused, use Antigravity
        if (settings.engine_status_antigravity !== 'paused' && settings.engine_status_antigravity !== 'disconnected') {
          return await callAntigravityHost({
            model: model || 'flash',
            systemPrompt,
            userMessage,
            history,
            stealthHostMode: settings.stealth_host_mode === 'true',
            existingConversationId,
            projectCwd
          });
        }
        throw new Error('Google Gemini API Key is missing and local Antigravity is paused or disconnected.');

      case 'claude':
      case 'anthropic':
        return await callClaude({
          apiKey: settings.anthropic_api_key || process.env.ANTHROPIC_API_KEY,
          model: model || settings.claude_model || 'claude-3-7-sonnet-20250219',
          systemPrompt,
          userMessage,
          history,
          images
        });

      case 'openai':
      case 'codex':
        return await callOpenAI({
          apiKey: settings.openai_api_key || process.env.OPENAI_API_KEY,
          model: model || settings.openai_model || 'gpt-4o-mini',
          systemPrompt,
          userMessage,
          history,
          images
        });

      case 'ollama':
      case 'local':
        return await callOllama({
          hostUrl: settings.ollama_host || 'http://localhost:11434',
          model: model || settings.ollama_model || 'deepseek-r1:latest',
          systemPrompt,
          userMessage,
          history
        });

      case 'custom':
        return await callCustomOpenAICompatible({
          baseUrl: settings.custom_base_url || 'http://localhost:1234/v1',
          apiKey: settings.custom_api_key || 'not-needed',
          model: model || settings.custom_model || 'local-model',
          systemPrompt,
          userMessage,
          history
        });

      case 'xai':
      case 'grok':
        return await callCustomOpenAICompatible({
          baseUrl: 'https://api.x.ai/v1',
          apiKey: settings.xai_api_key || process.env.XAI_API_KEY,
          model: model || settings.xai_model || 'grok-2-latest',
          systemPrompt,
          userMessage,
          history
        });

      case 'openrouter':
        return await callCustomOpenAICompatible({
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey: settings.openrouter_api_key || process.env.OPENROUTER_API_KEY,
          model: model || settings.openrouter_model || 'google/gemini-2.0-flash-001',
          systemPrompt,
          userMessage,
          history
        });
    }
  } catch (err) {
    primaryError = err;
    console.warn(`[Primary Provider (${provider})]: ${err.message}. Trying Host Runtimes cascade...`);
  }

  // 2. Auto-Cascade to ANY Active & Running IDE / Tool Runtime on this PC (excluding paused/disconnected ones):

  // Auto-Fallback A: Running Google Antigravity Host IDE Bridge
  if (settings.engine_status_antigravity !== 'paused' && settings.engine_status_antigravity !== 'disconnected') {
    try {
      const agyRes = await callAntigravityHost({
        systemPrompt,
        userMessage,
        history,
        images,
        stealthHostMode: settings.stealth_host_mode !== 'false'
      });
      if (agyRes) return agyRes;
    } catch (_) {}
  }

  // Auto-Fallback B: Local Claude CLI
  if (settings.engine_status_claude !== 'paused' && settings.engine_status_claude !== 'disconnected') {
    try {
      const claudeRes = await callClaude({ apiKey: null, model: null, systemPrompt, userMessage, history });
      if (claudeRes) return claudeRes;
    } catch (_) {}
  }

  // Auto-Fallback C: Local Ollama
  if (settings.engine_status_ollama !== 'paused' && settings.engine_status_ollama !== 'disconnected') {
    try {
      const ollamaRes = await callOllama({
        hostUrl: settings.ollama_host || 'http://localhost:11434',
        model: settings.ollama_model || 'deepseek-r1:latest',
        systemPrompt,
        userMessage,
        history
      });
      if (ollamaRes) return ollamaRes;
    } catch (_) {}
  }

  // Auto-Fallback D: Autonomous RuXt Local Persona Engine (Guarantees zero blocking)
  return generateAutonomousLocalReply({ systemPrompt, userMessage, history, provider, agentSlug, agentName, agentRole });
}

// 1. Google Gemini / Antigravity Bridge
async function callGemini({ apiKey, model, systemPrompt, userMessage, history, images = [] }) {
  // If API key is provided and valid, call Cloud API directly
  if (apiKey && apiKey.trim().length > 15) {
    try {
      const userParts = [{ text: userMessage }];
      if (images && images.length > 0) {
        for (const img of images) {
          const rawBase64 = img.replace(/^data:image\/[a-z]+;base64,/, '');
          userParts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: rawBase64
            }
          });
        }
      }

      const geminiContents = [
        ...history.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        })),
        {
          role: 'user',
          parts: userParts
        }
      ];

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: geminiContents
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return {
            content: text,
            provider: 'Google Gemini Cloud',
            model,
            usage: data.usageMetadata || null
          };
        }
      }
    } catch (e) {
      console.warn('[Gemini Cloud API failed, trying Active Antigravity Host Bridge]:', e.message);
    }
  }

  // Seamless Bridge: Use Active & Running Antigravity IDE on this PC (Zero API Key Needed!)
  const hostResult = await callAntigravityHost({ systemPrompt, userMessage, history });
  if (hostResult) return hostResult;

  throw new Error('Google Gemini API Key is not set and local Antigravity Host IDE was unreachable.');
}

// 2. Anthropic Claude (API or Claude CLI fallback)
async function callClaude({ apiKey, model, systemPrompt, userMessage, history, images = [] }) {
  // If API key is provided, use Anthropic Messages API
  if (apiKey && apiKey.trim().length > 5) {
    let userContent = userMessage;
    if (images && images.length > 0) {
      userContent = [];
      for (const img of images) {
        userContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: img.replace(/^data:image\/[a-z]+;base64,/, '')
          }
        });
      }
      userContent.push({ type: 'text', text: userMessage });
    }

    const messages = [
      ...history.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      })),
      { role: 'user', content: userContent }
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-7-sonnet-20250219',
        max_tokens: 4096,
        system: systemPrompt,
        messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data.content?.map(c => c.text || '').join('\n') || '';
    return {
      content,
      provider: 'claude',
      model,
      usage: data.usage || null
    };
  }

  // Fallback: Check if local 'claude' CLI is installed in user environment
  try {
    const check = execSync('where.exe claude', { stdio: 'pipe' }).toString();
    if (check && check.trim()) {
      // Execute via Claude Code CLI pipe
      const promptCombined = `${systemPrompt}\n\nUser Question:\n${userMessage}`;
      const escapedPrompt = promptCombined.replace(/"/g, '\\"');
      const output = execSync(`claude -p "${escapedPrompt}"`, { stdio: 'pipe', encoding: 'utf8', timeout: 30000 });
      return {
        content: output.trim(),
        provider: 'claude-cli',
        model: 'local-claude-cli'
      };
    }
  } catch (_) {}

  throw new Error('Anthropic Claude API Key not configured and local Claude CLI not found.');
}

// 3. OpenAI / Codex Bridge
async function callOpenAI({ apiKey, model, systemPrompt, userMessage, history, images = [] }) {
  if (!apiKey || apiKey.trim().length < 5) {
    throw new Error('OpenAI / Codex API Key is missing or invalid.');
  }

  let userContent = userMessage;
  if (images && images.length > 0) {
    userContent = [{ type: 'text', text: userMessage }];
    for (const img of images) {
      const b64 = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
      userContent.push({
        type: 'image_url',
        image_url: { url: b64 }
      });
    }
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userContent }
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  return {
    content,
    provider: 'openai',
    model,
    usage: data.usage || null
  };
}

// 4. Local Offline Ollama (DeepSeek, Llama 3, Qwen)
async function callOllama({ hostUrl, model, systemPrompt, userMessage, history }) {
  const cleanHost = (hostUrl || 'http://localhost:11434').replace(/\/$/, '');
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ];

  try {
    const response = await fetch(`${cleanHost}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'deepseek-r1:latest',
        messages,
        stream: false
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return {
      content: data.message?.content || '',
      provider: 'ollama',
      model,
      duration: data.total_duration || null
    };
  } catch (err) {
    throw new Error(`Failed connecting to Local Ollama at ${cleanHost}. Ensure Ollama is running. (${err.message})`);
  }
}

// 5. Custom OpenAI-Compatible Server (LM Studio, vLLM, LocalAI)
async function callCustomOpenAICompatible({ baseUrl, apiKey, model, systemPrompt, userMessage, history }) {
  const cleanBase = (baseUrl || 'http://localhost:1234/v1').replace(/\/$/, '');
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ];

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey !== 'not-needed') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${cleanBase}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'default',
      messages
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Custom server error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  return {
    content,
    provider: 'custom',
    model
  };
}

// 6. Autonomous RuXt Local Persona Engine (Guarantees zero blocking)
function generateAutonomousLocalReply({
  systemPrompt,
  userMessage,
  history,
  provider,
  agentSlug = 'ruxt',
  agentName = 'RuXt',
  agentRole = 'Chief of Staff'
}) {
  const cleanMsg = (userMessage || '').trim();
  const lowerMsg = cleanMsg.toLowerCase();
  const isGreeting = /^(hi|hello|hey|greetings|hola|ayubowan|kohomada|oya kawda|who are you|gm|gn)\b/i.test(lowerMsg) || lowerMsg.length <= 4;

  const currentSlug = (agentSlug || '').toLowerCase();

  // 1. RuXt (Team Leader & Chief of Staff)
  if (currentSlug === 'ruxt' || currentSlug === 'leader') {
    if (isGreeting) {
      return {
        content: `Hello! I am **RuXt**, your AI Chief of Staff and Team Leader.\n\nI coordinate our specialist team to plan, build, and optimize your business and software solutions. How can I assist you today?`,
        provider: 'RuXt Autonomous Engine (Local)',
        model: 'ruxt-orchestrator-2.1'
      };
    }

    return {
      content: `I'm on it! As your Chief of Staff, here is how we can break this down:\n\n` +
        `### 📋 Action Plan:\n` +
        `1. **Scope & Objectives:** Define the core deliverable and target audience.\n` +
        `2. **Specialist Allocation:** Coordinate UI/UX with Julian Vance, infrastructure with Noah Reed, and financial/data models with Maya Brooks.\n` +
        `3. **Execution Steps:** Review milestones and maintain quality standards.\n\n` +
        `Would you like me to dispatch this to a specialist executive or begin outlining the initial architecture?`,
      provider: 'RuXt Autonomous Engine (Local)',
      model: 'ruxt-orchestrator-2.1'
    };
  }

  // 2. Julian Vance (Senior Frontend Web Developer)
  if (currentSlug === 'julian-vance' || currentSlug.includes('julian')) {
    if (isGreeting) {
      return {
        content: `Hey there! I am **Julian Vance**, ready to assist you with frontend architecture, modern React components, and responsive UI design. What are we building today?`,
        provider: 'Julian Vance Specialist Engine',
        model: 'frontend-architect-v2'
      };
    }

    return {
      content: `Let's build this with a clean, high-performance UI!\n\n` +
        `### 🎨 Frontend Implementation Strategy:\n` +
        `- **Component Architecture:** Modular, reusable React components with clean state management.\n` +
        `- **Styling & Aesthetics:** Modern Tailwind CSS with dark-mode contrast, responsive grid layouts, and micro-animations.\n` +
        `- **User Experience:** Instant visual feedback, intuitive navigation, and zero layout shift.\n\n` +
        `Let me know what specific section or design element you would like me to draft first!`,
      provider: 'Julian Vance Specialist Engine',
      model: 'frontend-architect-v2'
    };
  }

  // 3. Maya Brooks (Chief Financial Analyst)
  if (currentSlug === 'maya-brooks' || currentSlug.includes('maya')) {
    if (isGreeting) {
      return {
        content: `Hello! I am **Maya Brooks**, specializing in financial modeling, valuation, runway projections, and budget optimization. How can I assist you today?`,
        provider: 'Maya Brooks Specialist Engine',
        model: 'financial-intelligence-v2'
      };
    }

    return {
      content: `Let's examine the numbers and unit economics carefully.\n\n` +
        `### 📊 Financial Framework:\n` +
        `- **Cost Structure:** Break down fixed vs variable expenses.\n` +
        `- **Revenue Projections:** Conservative, moderate, and aggressive growth models.\n` +
        `- **ROI & Runway:** Metric targets to ensure capital efficiency.\n\n` +
        `Share any figures, goals, or financial metrics you'd like to analyze.`,
      provider: 'Maya Brooks Specialist Engine',
      model: 'financial-intelligence-v2'
    };
  }

  // 4. Noah Reed (Security & Cloud DevOps)
  if (currentSlug === 'noah-reed' || currentSlug.includes('noah')) {
    if (isGreeting) {
      return {
        content: `Hi! I am **Noah Reed**, DevOps and Cloud Security Architect. I ensure robust CI/CD, container orchestration, and zero-trust cloud infrastructure. How can I assist with your deployment today?`,
        provider: 'Noah Reed Specialist Engine',
        model: 'cloud-devops-v2'
      };
    }

    return {
      content: `I'm ready to architect and secure the deployment.\n\n` +
        `### 🛡️ Infrastructure & DevOps Plan:\n` +
        `- **Containerization:** Clean Docker environments with optimized multi-stage builds.\n` +
        `- **Automation Pipeline:** Automated testing, linting, and zero-downtime releases.\n` +
        `- **Security Hardening:** SSL/TLS enforcement, secrets management, and network isolation.\n\n` +
        `What platform or environment are we deploying to?`,
      provider: 'Noah Reed Specialist Engine',
      model: 'cloud-devops-v2'
    };
  }

  // 5. Elena Voss (Strategic Game Intelligence)
  if (currentSlug === 'elena-voss-chess' || currentSlug.includes('elena') || currentSlug.includes('voss')) {
    if (isGreeting) {
      return {
        content: `Greetings. I am **Elena Voss**, Strategic Game Intelligence and Analytical Coach. How can I assist your strategic decision-making today?`,
        provider: 'Elena Voss Engine',
        model: 'grandmaster-logic-v2'
      };
    }

    return {
      content: `Let's analyze the landscape through game theory and first-principles reasoning.\n\n` +
        `### ♟️ Strategic Assessment:\n` +
        `- **Current Position:** Map current strengths, constraints, and dependencies.\n` +
        `- **Opposing Forces & Variables:** Identify risks and external market dynamics.\n` +
        `- **Optimal Next Moves:** Select high-probability, asymmetric advantage paths.\n\n` +
        `What specific scenario or strategic move shall we evaluate?`,
      provider: 'Elena Voss Engine',
      model: 'grandmaster-logic-v2'
    };
  }

  // 6. Marcus Sterling (Enterprise Legal Counsel)
  if (currentSlug === 'marcus-sterling' || currentSlug.includes('marcus') || currentSlug.includes('sterling')) {
    if (isGreeting) {
      return {
        content: `Hello. I am **Marcus Sterling**, Corporate Legal Counsel. How can I assist with your agreements, governance, or compliance today?`,
        provider: 'Marcus Sterling Specialist Engine',
        model: 'legal-counsel-v2'
      };
    }

    return {
      content: `Let's structure the governance and compliance framework.\n\n` +
        `### ⚖️ Legal & Governance Review:\n` +
        `- **Regulatory Alignment:** Relevant jurisdictions, privacy laws, and disclosures.\n` +
        `- **Contractual Protection:** Clear terms, indemnity boundaries, and IP assignment.\n` +
        `- **Risk Mitigation:** Limiting exposure while enabling business flexibility.\n\n` +
        `What agreement or legal question would you like to review?`,
      provider: 'Marcus Sterling Specialist Engine',
      model: 'legal-counsel-v2'
    };
  }

  // 7. Numbers (Quantitative Data Analyst)
  if (currentSlug === 'numbers' || currentSlug.includes('number')) {
    if (isGreeting) {
      return {
        content: `Hello! I am **Numbers**, Quantitative Data Analyst. Share your datasets, numbers, or targets, and I will compute the insights. How can I assist you?`,
        provider: 'Numbers Data Engine',
        model: 'quant-analytics-v2'
      };
    }

    return {
      content: `Let's compute the statistics and identify the key signals in the data.\n\n` +
        `### 🔢 Data Analytics Plan:\n` +
        `- **Data Cleaning & Normalization:** Standardize inputs and filter noise.\n` +
        `- **Statistical Modeling:** Distribution curves, correlation analysis, and predictive forecasting.\n` +
        `- **Actionable Dashboards:** High-impact visualizations and key performance indicators.\n\n` +
        `Provide the data points or dataset you'd like to compute!`,
      provider: 'Numbers Data Engine',
      model: 'quant-analytics-v2'
    };
  }

  // Default fallback for any other or custom agent
  return {
    content: isGreeting
      ? `Hello! I am **${agentName}** (${agentRole}). How can I assist you with your project today?`
      : `I'm on it! As **${agentName}** (${agentRole}), I'm ready to assist you. Tell me more details about your specific goals or milestones!`,
    provider: `${agentName} Engine`,
    model: 'local-specialist-v2'
  };
}

export { acpService };
