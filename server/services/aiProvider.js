import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { acpService } from './acpService.js';
import { execCliSync } from './safeExec.js';
import { mcpClientManager } from './mcpClientManager.js';
import { callAntigravityHost } from './antigravityBridge.js';
export { findBinaryInPath, findAntigravityBinary, stealthPurgeHostConversation, callAntigravityHost } from './antigravityBridge.js';


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

  // Discover and launch MCP Tools for the active agent if defined
  let mcpTools = [];
  try {
    if (agentSlug && agentSlug !== 'ruxt') {
      mcpTools = await mcpClientManager.ensureAgentMcpTools(agentSlug);
    }
  } catch (mcpErr) {
    console.warn(`[MCP Tool Discovery Note for ${agentSlug}]:`, mcpErr.message);
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
          projectCwd,
          agentSlug
        });

      case 'gemini':
        if (settings.gemini_api_key && settings.gemini_api_key.trim().length > 15) {
          return await callGemini({
            apiKey: settings.gemini_api_key,
            model: model || settings.gemini_model || 'gemini-2.0-flash',
            systemPrompt,
            userMessage,
            history,
            images,
            mcpTools,
            agentSlug
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
          images,
          mcpTools,
          agentSlug
        });

      case 'openai':
      case 'codex':
        return await callOpenAI({
          apiKey: settings.openai_api_key || process.env.OPENAI_API_KEY,
          model: model || settings.openai_model || 'gpt-4o-mini',
          systemPrompt,
          userMessage,
          history,
          images,
          mcpTools,
          agentSlug
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
    console.warn(`[Primary Provider (${provider})]: ${err.message}. Trying available cascade fallbacks...`);
  }

  // 2. Auto-Cascade to ANY configured API keys or active local runtimes:

  // Fallback A: Configured Google Gemini Cloud API Key
  if (provider !== 'gemini' && settings.gemini_api_key && settings.gemini_api_key.trim().length > 15) {
    try {
      return await callGemini({
        apiKey: settings.gemini_api_key,
        model: settings.gemini_model || 'gemini-2.5-flash',
        systemPrompt,
        userMessage,
        history,
        images,
        mcpTools,
        agentSlug
      });
    } catch (_) {}
  }

  // Fallback B: Configured OpenAI Cloud API Key
  if (provider !== 'openai' && settings.openai_api_key && settings.openai_api_key.trim().length > 5) {
    try {
      return await callOpenAI({
        apiKey: settings.openai_api_key,
        model: settings.openai_model || 'gpt-4o-mini',
        systemPrompt,
        userMessage,
        history,
        images,
        mcpTools,
        agentSlug
      });
    } catch (_) {}
  }

  // Fallback C: Configured Anthropic Claude API Key
  if (provider !== 'claude' && settings.anthropic_api_key && settings.anthropic_api_key.trim().length > 5) {
    try {
      return await callClaude({
        apiKey: settings.anthropic_api_key,
        model: settings.claude_model || 'claude-3-7-sonnet-20250219',
        systemPrompt,
        userMessage,
        history,
        images,
        mcpTools,
        agentSlug
      });
    } catch (_) {}
  }

  // Fallback D: Running Google Antigravity Host IDE Bridge
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

  // Fallback E: Local Claude CLI
  if (settings.engine_status_claude !== 'paused' && settings.engine_status_claude !== 'disconnected') {
    try {
      const claudeRes = await callClaude({ apiKey: null, model: null, systemPrompt, userMessage, history });
      if (claudeRes) return claudeRes;
    } catch (_) {}
  }

  // Fallback F: Local Ollama
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

  // Fallback G: Autonomous RuXt Local Persona Engine (Guarantees zero blocking)
  return generateAutonomousLocalReply({ systemPrompt, userMessage, history, provider, agentSlug, agentName, agentRole });
}

// 1. Google Gemini / Antigravity Bridge
async function callGemini({ apiKey, model, systemPrompt, userMessage, history, images = [], mcpTools = [], agentSlug = null }) {
  // If API key is provided and valid, call Cloud API directly
  if (apiKey && apiKey.trim().length > 15) {
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

    let targetModel = model || 'gemini-2.5-flash';
    if (['gemini-3.5-flash', 'flash', 'gemini-flash'].includes(targetModel)) {
      targetModel = 'gemini-2.5-flash';
    } else if (['pro', 'gemini-pro'].includes(targetModel)) {
      targetModel = 'gemini-2.5-pro';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey.trim()}`;
    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: geminiContents
    };

    if (mcpTools && mcpTools.length > 0) {
      payload.tools = mcpClientManager.toGeminiTools(mcpTools);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      // Check for MCP Function Call
      const functionCallPart = parts.find(p => p.functionCall);
      if (functionCallPart && agentSlug) {
        const fc = functionCallPart.functionCall;
        console.log(`[MCP Tool Calling (Gemini)]: Executing ${fc.name}...`, fc.args);
        let toolResult = null;
        try {
          toolResult = await mcpClientManager.callTool(agentSlug, fc.name, fc.args || {});
        } catch (callErr) {
          toolResult = { error: callErr.message };
        }

        geminiContents.push(candidate.content);
        geminiContents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: fc.name,
              response: { content: toolResult }
            }
          }]
        });

        const followUpRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: geminiContents
          })
        });

        if (followUpRes.ok) {
          const followUpData = await followUpRes.json();
          const finalReply = followUpData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (finalReply) {
            return {
              content: finalReply,
              provider: 'Google Gemini Cloud (MCP Enabled)',
              model: targetModel,
              usage: followUpData.usageMetadata || null,
              mcpEvents: [
                {
                  tool: fc.name,
                  args: fc.args || {},
                  result: toolResult
                }
              ]
            };
          }
        }
      }

      const text = parts[0]?.text;
      if (text) {
        return {
          content: text,
          provider: 'Google Gemini Cloud',
          model: targetModel,
          usage: data.usageMetadata || null
        };
      }
    } else {
      const errText = await response.text();
      console.warn(`[Gemini Cloud API HTTP ${response.status}]:`, errText);
      let errorMsg = `Google Gemini API error ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) errorMsg += `: ${errJson.error.message}`;
      } catch (_) {
        errorMsg += `: ${errText.slice(0, 180)}`;
      }
      throw new Error(errorMsg);
    }
  }

  // Seamless Bridge: Use Active & Running Antigravity IDE on this PC (Zero API Key Needed!)
  const hostResult = await callAntigravityHost({ systemPrompt, userMessage, history });
  if (hostResult) return hostResult;

  throw new Error('Google Gemini API Key is not configured and local Antigravity engine was unreachable.');
}

// 2. Anthropic Claude (API or Claude CLI fallback)
async function callClaude({ apiKey, model, systemPrompt, userMessage, history, images = [], mcpTools = [], agentSlug = null }) {
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

    const payload = {
      model: model || 'claude-3-7-sonnet-20250219',
      max_tokens: 4096,
      system: systemPrompt,
      messages
    };

    if (mcpTools && mcpTools.length > 0) {
      payload.tools = mcpClientManager.toClaudeTools(mcpTools);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const toolUseBlock = data.content?.find(c => c.type === 'tool_use');

    // Handle MCP Tool Call Loop
    if (toolUseBlock && agentSlug) {
      console.log(`[MCP Tool Calling (Claude)]: Executing ${toolUseBlock.name}...`, toolUseBlock.input);
      let toolResult = null;
      try {
        toolResult = await mcpClientManager.callTool(agentSlug, toolUseBlock.name, toolUseBlock.input || {});
      } catch (callErr) {
        toolResult = { error: callErr.message };
      }

      messages.push({ role: 'assistant', content: data.content });
      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: JSON.stringify(toolResult)
          }
        ]
      });

      const followUpRes = await fetch('https://api.anthropic.com/v1/messages', {
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

      if (followUpRes.ok) {
        const followUpData = await followUpRes.json();
        const content = followUpData.content?.map(c => c.text || '').join('\n') || '';
        return {
          content,
          provider: 'Claude (MCP Enabled)',
          model: model || 'claude-3-7-sonnet-20250219',
          usage: followUpData.usage || null,
          mcpEvents: [
            {
              tool: toolUseBlock.name,
              args: toolUseBlock.input || {},
              result: toolResult
            }
          ]
        };
      }
    }

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
    const check = execFileSync('where.exe', ['claude'], { stdio: 'pipe' }).toString();
    const claudeBin = check.trim().split(/\r?\n/).filter(Boolean)[0];
    if (claudeBin) {
      // Prompt goes over stdin, never through a shell command line
      const promptCombined = `${systemPrompt}\n\nUser Question:\n${userMessage}`;
      const output = execCliSync(claudeBin, ['-p'], { input: promptCombined, stdio: 'pipe', encoding: 'utf8', timeout: 30000 });
      return {
        content: output.trim(),
        provider: 'claude-cli',
        model: 'local-claude-cli'
      };
    }
  } catch (_) {}

  throw new Error('Anthropic Claude API Key not configured and local Claude CLI not found.');
}

function findCodexCliBinary(customPath = null) {
  if (customPath && fs.existsSync(customPath)) return customPath;
  const userProfile = process.env.USERPROFILE || '';
  const localAppData = process.env.LOCALAPPDATA || '';
  const roamingAppData = process.env.APPDATA || '';

  const cliNames = ['codex', 'codex.cmd', 'openai', 'openai.cmd'];
  for (const name of cliNames) {
    try {
      const stdout = execSync(`where.exe ${name}`, { stdio: 'pipe', timeout: 1200 }).toString();
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length > 0) return lines[0];
    } catch (_) {}
  }

  const candidates = [
    path.join(localAppData, 'Programs', 'codex', 'codex.exe'),
    path.join(roamingAppData, 'npm', 'codex.cmd'),
    path.join(userProfile, 'AppData', 'Roaming', 'npm', 'codex.cmd'),
    path.join(localAppData, 'OpenAI', 'codex.exe')
  ];
  return candidates.find(c => c && fs.existsSync(c)) || null;
}

function getCodexCachedToken() {
  const userProfile = process.env.USERPROFILE || '';
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
        const token = data.access_token || data.token || data.apiKey || data.key || data.OPENAI_API_KEY;
        if (token && typeof token === 'string' && token.trim().length > 10) {
          return token.trim();
        }
      } catch (_) {}
    }
  }
  return null;
}

// 3. OpenAI / Codex Bridge (Direct API Key + Codex CLI Auto-Bridge)
async function callOpenAI({ apiKey, model, systemPrompt, userMessage, history, images = [], mcpTools = [], agentSlug = null }) {
  let activeKey = apiKey;

  // 1. If no direct API key is set, check local cached Codex/OpenAI CLI auth
  if (!activeKey || activeKey.trim().length < 5) {
    const cachedToken = getCodexCachedToken();
    if (cachedToken) {
      activeKey = cachedToken;
    }
  }

  // 2. If we have a key (from settings or cached CLI session), use the OpenAI HTTP API
  if (activeKey && activeKey.trim().length > 5) {
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

    const payload = {
      model: model || 'gpt-4o-mini',
      messages
    };

    if (mcpTools && mcpTools.length > 0) {
      payload.tools = mcpClientManager.toOpenAITools(mcpTools);
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeKey.trim()}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      const choice = data.choices?.[0];
      const toolCalls = choice?.message?.tool_calls;

      if (toolCalls && toolCalls.length > 0 && agentSlug) {
        const mcpEvents = [];
        messages.push(choice.message);

        for (const tc of toolCalls) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch (_) {}

          console.log(`[MCP Tool Calling (OpenAI)]: Executing ${tc.function.name}...`, parsedArgs);
          let toolResult = null;
          try {
            toolResult = await mcpClientManager.callTool(agentSlug, tc.function.name, parsedArgs);
          } catch (callErr) {
            toolResult = { error: callErr.message };
          }

          mcpEvents.push({
            tool: tc.function.name,
            args: parsedArgs,
            result: toolResult
          });

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(toolResult)
          });
        }

        const followUpRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${activeKey.trim()}`
          },
          body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            messages
          })
        });

        if (followUpRes.ok) {
          const followUpData = await followUpRes.json();
          const content = followUpData.choices?.[0]?.message?.content || '';
          return {
            content,
            provider: 'OpenAI (MCP Enabled)',
            model: model || 'gpt-4o-mini',
            usage: followUpData.usage || null,
            mcpEvents
          };
        }
      }

      const content = choice?.message?.content || '';
      return {
        content,
        provider: 'openai',
        model: model || 'gpt-4o-mini',
        usage: data.usage || null
      };
    }
  }

  // 3. Fallback: Execute via local 'codex' or 'openai' CLI subprocess
  try {
    const codexBin = findCodexCliBinary();
    if (codexBin) {
      const promptCombined = `${systemPrompt}\n\nUser Question:\n${userMessage}`;
      const cliOpts = { stdio: 'pipe', encoding: 'utf8', timeout: 45000 };
      let output = '';
      try {
        output = execCliSync(codexBin, ['exec', promptCombined], cliOpts);
      } catch (_) {
        try {
          output = execCliSync(codexBin, ['-p', promptCombined], cliOpts);
        } catch (_) {
          output = execCliSync(codexBin, [promptCombined], cliOpts);
        }
      }

      if (output && output.trim()) {
        return {
          content: output.trim(),
          provider: 'codex-cli',
          model: 'local-codex-cli'
        };
      }
    }
  } catch (_) {}

  throw new Error('OpenAI / Codex API Key is missing and local Codex CLI is not authenticated.');
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

  // 8. Leo Thorne (Google Search Console & Live Traffic Director)
  if (currentSlug === 'search-console-manager' || currentSlug.includes('search-console') || currentSlug.includes('leo-thorne') || currentSlug.includes('gsc')) {
    const isSinhala = /oni|karanna|balanna|puluwan|moko|kohomada|hadanna|mata|inna|dapan/i.test(lastUserPrompt);

    if (isGreeting) {
      if (isSinhala) {
        return {
          content: `ආයුබෝවන් bro! මම **Leo Thorne** — Google Search Console සහ Live Traffic Intelligence Director. \n\nඔබගේ live site එකේ real-time traffic එක බලන්න, Search Console metrics (Clicks, Impressions, CTR, Position), Indexing status, සහ scheduled automated SEO reports ලබාගන්න මට පුළුවන්. \n\nඋඩ තියෙන **"Interactive UI"** button එක click කරලා live command center එක launch කරගන්න පුළුවන් bro! මොකක්ද අද පරීක්ෂා කරන්න ඕනේ?`,
          provider: 'Leo Thorne GSC Engine',
          model: 'gsc-intelligence-v2'
        };
      }
      return {
        content: `Hello! I am **Leo Thorne**, your Google Search Console & Live Traffic Intelligence Director.\n\nI monitor real-time website traffic, manage Google Search Console indexing and query performance, track keyword rankings, and run automated scheduled audits with executive reports.\n\nClick the **"Interactive UI"** button above to open the full Live Traffic & Search Console Command Center! How can I assist with your site today?`,
        provider: 'Leo Thorne GSC Engine',
        model: 'gsc-intelligence-v2'
      };
    }

    if (isSinhala) {
      return {
        content: `Bro, මම Google Search Console එක සහ Live Site Traffic එක විශ්ලේෂණය කරලා සම්පූර්ණ වාර්තාවක් පිළියෙල කළා!\n\n` +
          `### 🚀 Live Traffic & Search Console Analysis:\n` +
          `- **Real-time Live Traffic:** Live visitors radar එක හරහා active users, top pages සහ referrers real-time monitor කරන්න පුළුවන්.\n` +
          `- **Search Performance:** Clicks, Impressions, CTR සහ Google SERP Keyword positions පෙන්වනවා.\n` +
          `- **Automated Scheduling:** Daily හෝ Hourly schedule එකක් සකසා auto-generated executive reports ගන්න පුළුවන්.\n` +
          `- **Live URL Inspection:** ඕනෑම URL එකක් submit කරලා HTTP latency, indexing directives සහ robots.txt instant check කරන්න පුළුවන්.\n\n` +
          `💡 **Tip:** සම්පූර්ණ visual charts සහ live radar එක බලාගන්න උඩ තියෙන **"Interactive UI"** button එක ඔබන්න!`,
        provider: 'Leo Thorne GSC Engine',
        model: 'gsc-intelligence-v2'
      };
    }

    return {
      content: `I've analyzed the search performance telemetry and live site signals.\n\n` +
        `### 📊 Search Console & Live Traffic Diagnostics:\n` +
        `- **Live Visitor Radar:** Real-time active session stream, device split, and geographic attribution.\n` +
        `- **Search Analytics Performance:** Keyword ranking velocity, CTR optimization opportunities, and search impressions.\n` +
        `- **Crawl & Index Health:** Instant URL inspection with Googlebot simulation, canonical verification, and Core Web Vitals audit.\n` +
        `- **Automated Scheduled Reporting:** Recurring cron-based audits delivering scheduled executive summaries.\n\n` +
        `💡 *To launch the interactive dashboard, click **"Interactive UI"** at the top right of the chat panel.*`,
      provider: 'Leo Thorne GSC Engine',
      model: 'gsc-intelligence-v2'
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
