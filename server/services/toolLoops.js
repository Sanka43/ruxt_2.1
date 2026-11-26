import { mcpClientManager } from './mcpClientManager.js';
import { executeAgentTool, MAX_TOOL_STEPS } from './agentTools.js';

// Multi-step tool loops, one per API family. The model keeps calling tools (every call goes through
// executeAgentTool) until it answers in plain text or MAX_TOOL_STEPS is reached; the last request
// is sent without tools and asks for a summary, so the user always gets a reply.

const FINAL_NUDGE = 'The tool step limit was reached. Summarize what was done, what failed and what is still pending. Do not call more tools.';

async function post(url, headers, body) {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

function providerError(label, status, text, toolCalls) {
  const err = new Error(`${label} error (${status}): ${String(text).slice(0, 300)}`);
  err.afterTools = toolCalls > 0; // true: tools already ran, so callers must not silently fall back to another provider
  return err;
}

function parseArgs(raw) {
  if (raw && typeof raw === 'object') return raw;
  try { return JSON.parse(raw || '{}'); } catch (_) { return {}; }
}

/** OpenAI, Codex, xAI, OpenRouter and any OpenAI-compatible server. */
export async function runOpenAIToolLoop({ url, headers = {}, model, messages, mcpTools = [], agentSlug, label = 'OpenAI' }) {
  const tools = agentSlug ? mcpClientManager.toOpenAITools(mcpTools) : null;
  const mcpEvents = [];
  let usage = null;

  for (let step = 0; step <= MAX_TOOL_STEPS; step++) {
    const lastChance = step === MAX_TOOL_STEPS;
    if (lastChance) messages.push({ role: 'user', content: FINAL_NUDGE });
    const body = { model, messages };
    if (tools && !lastChance) body.tools = tools;

    const res = await post(url, headers, body);
    if (!res.ok) throw providerError(label, res.status, await res.text(), mcpEvents.length);
    const data = await res.json();
    usage = data.usage || usage;
    const msg = data.choices?.[0]?.message || {};
    const calls = lastChance ? [] : (msg.tool_calls || []);
    if (!calls.length) return { content: msg.content || '', usage, mcpEvents };

    messages.push(msg);
    for (const tc of calls) {
      const args = parseArgs(tc.function?.arguments);
      const r = await executeAgentTool(agentSlug, tc.function?.name, args);
      mcpEvents.push({ tool: tc.function?.name, args, result: r.isError ? { error: r.text } : { text: r.text } });
      messages.push({ role: 'tool', tool_call_id: tc.id, content: r.text });
    }
  }
  return { content: '', usage, mcpEvents }; // unreachable: the last iteration always returns
}

/** Anthropic Messages API. */
export async function runClaudeToolLoop({ apiKey, model, system, messages, mcpTools = [], agentSlug, maxTokens = 4096 }) {
  const tools = agentSlug ? mcpClientManager.toClaudeTools(mcpTools) : null;
  const headers = { 'x-api-key': apiKey.trim(), 'anthropic-version': '2023-06-01' };
  const mcpEvents = [];
  let usage = null;

  for (let step = 0; step <= MAX_TOOL_STEPS; step++) {
    const lastChance = step === MAX_TOOL_STEPS;
    if (lastChance) messages.push({ role: 'user', content: FINAL_NUDGE });
    const body = { model, max_tokens: maxTokens, system, messages };
    if (tools && !lastChance) body.tools = tools;

    const res = await post('https://api.anthropic.com/v1/messages', headers, body);
    if (!res.ok) throw providerError('Claude API', res.status, await res.text(), mcpEvents.length);
    const data = await res.json();
    usage = data.usage || usage;
    const toolUses = lastChance ? [] : (data.content || []).filter((c) => c.type === 'tool_use');
    if (!toolUses.length) {
      return { content: (data.content || []).map((c) => c.text || '').join('\n'), usage, mcpEvents };
    }

    messages.push({ role: 'assistant', content: data.content });
    const results = [];
    for (const tu of toolUses) {
      const args = tu.input || {};
      const r = await executeAgentTool(agentSlug, tu.name, args);
      mcpEvents.push({ tool: tu.name, args, result: r.isError ? { error: r.text } : { text: r.text } });
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: r.text, ...(r.isError ? { is_error: true } : {}) });
    }
    messages.push({ role: 'user', content: results });
  }
  return { content: '', usage, mcpEvents };
}

/** Google Gemini generateContent API. */
export async function runGeminiToolLoop({ apiKey, model, systemPrompt, contents, mcpTools = [], agentSlug }) {
  const tools = agentSlug ? mcpClientManager.toGeminiTools(mcpTools) : null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const headers = { 'x-goog-api-key': apiKey.trim() };
  const mcpEvents = [];
  let usage = null;

  for (let step = 0; step <= MAX_TOOL_STEPS; step++) {
    const lastChance = step === MAX_TOOL_STEPS;
    if (lastChance) contents.push({ role: 'user', parts: [{ text: FINAL_NUDGE }] });
    const body = { systemInstruction: { parts: [{ text: systemPrompt }] }, contents };
    if (tools && !lastChance) body.tools = tools;

    const res = await post(url, headers, body);
    if (!res.ok) {
      const text = await res.text();
      let detail = text.slice(0, 180);
      try { detail = JSON.parse(text).error?.message || detail; } catch (_) {}
      throw providerError('Google Gemini API', res.status, detail, mcpEvents.length);
    }
    const data = await res.json();
    usage = data.usageMetadata || usage;
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const calls = lastChance ? [] : parts.filter((p) => p.functionCall);
    if (!calls.length) {
      return { content: parts.filter((p) => p.text && !p.thought).map((p) => p.text).join(''), usage, mcpEvents };
    }

    contents.push(candidate.content);
    const responses = [];
    for (const part of calls) {
      const { name, args = {} } = part.functionCall;
      const r = await executeAgentTool(agentSlug, name, args);
      mcpEvents.push({ tool: name, args, result: r.isError ? { error: r.text } : { text: r.text } });
      responses.push({ functionResponse: { name, response: { content: r.text, isError: r.isError } } });
    }
    contents.push({ role: 'user', parts: responses });
  }
  return { content: '', usage, mcpEvents };
}

/** Text to show when the model finished its tool calls without writing any reply. */
export function summarizeToolEvents(mcpEvents) {
  const lines = mcpEvents.map((e) => `- ${e.tool}: ${e.result?.error ? 'failed' : 'done'}`);
  return `Ran ${mcpEvents.length} tool step${mcpEvents.length === 1 ? '' : 's'}:\n${lines.join('\n')}`;
}
