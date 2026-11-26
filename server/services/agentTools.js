import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { mcpClientManager } from './mcpClientManager.js';

// Everything an agent's MCP tool call goes through, whichever AI provider made the call:
//   1. approval  - the agent manifest's permissions.approval says never | first-use | always
//   2. app lock  - one tool call at a time per desktop app (two agents must not fight over Blender)
//   3. audit     - every call, allowed or denied, lands in activity_logs
//   4. result    - MCP content is flattened to text and capped before a model sees it

export const MAX_TOOL_STEPS = 12;
const RESULT_CHAR_LIMIT = 20_000;
const approvalTimeoutMs = () => Number(process.env.RUXT_TOOL_APPROVAL_TIMEOUT_MS) || 120_000;
const AUDIT_ARG_LIMIT = 500;
const APPROVAL_PREVIEW_LIMIT = 3000;
const MODES = new Set(['never', 'first-use', 'always']);

db.exec(`
  CREATE TABLE IF NOT EXISTS tool_grants (
    agent_slug TEXT NOT NULL,
    tool TEXT NOT NULL,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (agent_slug, tool)
  );
`);

// ---------------------------------------------------------------- manifest policy

const manifestCache = new Map(); // slug -> { mtimeMs, manifest }

function loadManifest(agentSlug) {
  try {
    const file = path.join(mcpClientManager.resolveAgentDir(agentSlug), 'manifest.json');
    const { mtimeMs } = fs.statSync(file);
    const hit = manifestCache.get(agentSlug);
    if (hit && hit.mtimeMs === mtimeMs) return hit.manifest;
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    manifestCache.set(agentSlug, { mtimeMs, manifest });
    return manifest;
  } catch (_) {
    return null;
  }
}

function permissionsOf(agentSlug) {
  const p = loadManifest(agentSlug)?.permissions;
  return p && typeof p === 'object' && !Array.isArray(p) ? p : null;
}

/** never | first-use | always. Older manifests without a permissions object keep their old behaviour (never). */
export function getToolPolicy(agentSlug, tool) {
  const p = permissionsOf(agentSlug);
  if (!p) return 'never';
  const mode = p.approval?.[tool];
  return MODES.has(mode) ? mode : 'first-use'; // a v3 agent that did not list a tool gets asked once
}

function lockKeyFor(agentSlug) {
  const app = permissionsOf(agentSlug)?.apps?.[0];
  return app ? `app:${app}` : `agent:${agentSlug}`;
}

// ---------------------------------------------------------------- grants ("don't ask again")

export function isToolGranted(agentSlug, tool) {
  return !!db.prepare('SELECT 1 FROM tool_grants WHERE agent_slug = ? AND tool = ?').get(agentSlug, tool);
}
export function grantTool(agentSlug, tool) {
  db.prepare('INSERT OR IGNORE INTO tool_grants (agent_slug, tool) VALUES (?, ?)').run(agentSlug, tool);
}
export function revokeTool(agentSlug, tool) {
  return db.prepare('DELETE FROM tool_grants WHERE agent_slug = ? AND tool = ?').run(agentSlug, tool).changes > 0;
}
export function listGrants() {
  return db.prepare('SELECT agent_slug AS agentSlug, tool, granted_at AS grantedAt FROM tool_grants ORDER BY granted_at DESC').all();
}

// ---------------------------------------------------------------- approvals

const pending = new Map(); // id -> { ...public fields, resolve, timer }

function clip(value, limit) {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.length > limit ? `${s.slice(0, limit)}... [${s.length - limit} more characters]` : s;
}

function previewArgs(args, perValueLimit) {
  const out = {};
  for (const [k, v] of Object.entries(args || {})) out[k] = typeof v === 'string' ? clip(v, perValueLimit) : v;
  return out;
}

function agentDisplayName(agentSlug) {
  try { return db.prepare('SELECT name FROM agents WHERE slug = ?').get(agentSlug)?.name || agentSlug; } catch (_) { return agentSlug; }
}

export function requestToolApproval({ agentSlug, tool, args, policy }) {
  const id = randomUUID();
  const timeoutMs = approvalTimeoutMs();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve(false); // nobody answered: deny
    }, timeoutMs);
    pending.set(id, {
      id,
      agentSlug,
      agentName: agentDisplayName(agentSlug),
      tool,
      policy,
      args: previewArgs(args, APPROVAL_PREVIEW_LIMIT),
      createdAt: Date.now(),
      expiresAt: Date.now() + timeoutMs,
      resolve,
      timer
    });
  });
}

export function listPendingApprovals() {
  return [...pending.values()].map(({ resolve, timer, ...publicFields }) => publicFields);
}

export function resolveApproval(id, decision) {
  const entry = pending.get(id);
  if (!entry) return { success: false, error: 'No such approval is pending' };
  if (decision !== 'approve' && decision !== 'deny') return { success: false, error: 'decision must be "approve" or "deny"' };
  clearTimeout(entry.timer);
  pending.delete(id);
  entry.resolve(decision === 'approve');
  return { success: true, decision };
}

// ---------------------------------------------------------------- locks

const locks = new Map();

export function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const run = prev.then(fn);
  const tail = run.catch(() => {});
  locks.set(key, tail);
  tail.then(() => { if (locks.get(key) === tail) locks.delete(key); });
  return run;
}

// ---------------------------------------------------------------- results and audit

export function toolResultToText(result) {
  let text;
  if (Array.isArray(result?.content)) {
    text = result.content.map((c) => (c?.type === 'text' ? c.text : `[${c?.type || 'content'}]`)).join('\n');
  } else {
    text = typeof result === 'string' ? result : JSON.stringify(result ?? null);
  }
  return text.length > RESULT_CHAR_LIMIT ? `${text.slice(0, RESULT_CHAR_LIMIT)}\n... [truncated ${text.length - RESULT_CHAR_LIMIT} characters]` : text;
}

function audit(agentSlug, tool, args, outcome) {
  try {
    db.prepare("INSERT INTO activity_logs (type, message, details) VALUES ('tool_call', ?, ?)").run(
      `${agentSlug} called ${tool}: ${outcome.status}`,
      JSON.stringify({ agent: agentSlug, tool, args: previewArgs(args, AUDIT_ARG_LIMIT), ...outcome })
    );
  } catch (_) { /* auditing must never break a tool call */ }
}

/**
 * Run one MCP tool call for an agent.
 * @returns {{ text: string, isError: boolean, denied?: boolean }}
 */
export async function executeAgentTool(agentSlug, tool, args = {}) {
  const started = Date.now();
  const policy = getToolPolicy(agentSlug, tool);

  if (policy !== 'never' && !(policy === 'first-use' && isToolGranted(agentSlug, tool))) {
    const approved = await requestToolApproval({ agentSlug, tool, args, policy });
    if (!approved) {
      audit(agentSlug, tool, args, { status: 'denied', policy, ms: Date.now() - started });
      return {
        text: `The user did not approve running ${tool}. Do not retry it; tell the user it was not run and ask how to proceed.`,
        isError: true,
        denied: true
      };
    }
    if (policy === 'first-use') grantTool(agentSlug, tool);
  }

  try {
    const raw = await withLock(lockKeyFor(agentSlug), () => mcpClientManager.callTool(agentSlug, tool, args));
    const isError = !!raw?.isError;
    audit(agentSlug, tool, args, { status: isError ? 'tool-error' : 'ok', policy, ms: Date.now() - started });
    return { text: toolResultToText(raw), isError };
  } catch (err) {
    audit(agentSlug, tool, args, { status: 'failed', policy, error: String(err.message).slice(0, 300), ms: Date.now() - started });
    return { text: `Tool ${tool} failed: ${err.message}`, isError: true };
  }
}
