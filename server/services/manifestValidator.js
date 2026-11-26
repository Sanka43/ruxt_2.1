import fs from 'fs';
import path from 'path';
import { validateMcpServerConfig } from './mcpClientManager.js';

// Validates an agent package manifest.json (format ruxt-agent-package/vN).
//
// v1/v2 packages predate the permission model, so they only get the security checks
// (MCP launch config, UI path) and a warning. v3+ is strict: the manifest has to state what
// the agent is allowed to touch, and the import flow can show that to the user for consent.

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const APP_ID_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const FORMAT_RE = /^ruxt-agent-package\/v(\d+)$/;
const APPROVAL_MODES = new Set(['never', 'first-use', 'always']);

export function manifestVersion(manifest) {
  const m = FORMAT_RE.exec(String(manifest?.format || ''));
  return m ? Number(m[1]) : null;
}

/** A path the package is allowed to name: relative, no "..", no drive letter, no UNC. */
export function isSafeRelativePath(p) {
  if (typeof p !== 'string' || !p.trim()) return false;
  if (path.isAbsolute(p) || path.win32.isAbsolute(p) || path.posix.isAbsolute(p)) return false;
  if (/^[a-zA-Z]:/.test(p) || p.startsWith('\\\\') || p.startsWith('//')) return false;
  return !p.split(/[\\/]+/).includes('..');
}

function isStringArray(v) {
  return Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim());
}

/**
 * @returns {{ ok: boolean, errors: string[], warnings: string[], version: number|null,
 *            permissions: { apps: string[], fsWrite: string[], network: boolean, approval: Record<string,string> } }}
 */
export function validateAgentManifest(manifest, agentDir = null) {
  const errors = [];
  const warnings = [];
  const permissions = { apps: [], fsWrite: [], network: false, filesystem: 'none', desktopControl: false, shell: false, approval: {} };

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, errors: ['manifest.json must be a JSON object'], warnings, version: null, permissions };
  }

  const version = manifestVersion(manifest);
  const strict = version !== null && version >= 3;

  if (strict) {
    if (!SLUG_RE.test(String(manifest.slug || ''))) errors.push('slug must be 2-64 chars of a-z, 0-9, "-" or "_"');
    if (typeof manifest.name !== 'string' || !manifest.name.trim()) errors.push('name is required');
    if (typeof manifest.role !== 'string' || !manifest.role.trim()) errors.push('role is required');
  } else if (manifest.format !== undefined && version === null) {
    warnings.push(`unknown format "${manifest.format}"`);
  }

  // app: which desktop program this agent drives
  if (manifest.app !== undefined) {
    const app = manifest.app;
    if (!app || typeof app !== 'object' || Array.isArray(app)) {
      errors.push('app must be an object');
    } else {
      if (!APP_ID_RE.test(String(app.id || ''))) errors.push('app.id must be a lowercase identifier such as "blender"');
      if (app.detect !== undefined && !isStringArray(app.detect)) errors.push('app.detect must be an array of strings');
      if (app.minVersion !== undefined && !/^\d+(\.\d+){0,2}$/.test(String(app.minVersion))) {
        errors.push('app.minVersion must look like "3.6" or "4.1.0"');
      }
    }
  }

  // mcpServers: security checks apply to every format version
  const servers = manifest.mcpServers;
  if (servers !== undefined && (!servers || typeof servers !== 'object' || Array.isArray(servers))) {
    errors.push('mcpServers must be an object');
  } else if (servers) {
    const root = agentDir ? path.resolve(agentDir) : null;
    for (const [key, conf] of Object.entries(servers)) {
      if (!conf || typeof conf !== 'object') { errors.push(`mcpServers.${key} must be an object`); continue; }
      if (conf.args !== undefined && !Array.isArray(conf.args)) { errors.push(`mcpServers.${key}.args must be an array`); continue; }
      const args = (conf.args || []).map((a) => String(a));
      // ${agentDir} is what RuXt expands at launch; expand it the same way before checking
      const expanded = args.map((a) => (root ? a.replace(/\$\{agentDir\}/g, root) : a.replace(/\$\{agentDir\}\/?/g, '')));
      const check = validateMcpServerConfig({ ...conf, args: expanded }, root || process.cwd());
      if (!check.ok) { errors.push(`mcpServers.${key}: ${check.reason}`); continue; }
      if (root) {
        for (const a of expanded) {
          if (/\.(py|js|mjs|cjs)$/i.test(a)) {
            const file = path.resolve(root, a);
            if (!fs.existsSync(file)) errors.push(`mcpServers.${key}: script "${path.relative(root, file)}" is missing from the package`);
          }
        }
      }
    }
  }

  // ui entry must stay inside the package
  const uiEntry = manifest.ui?.entry ?? manifest.uiEntry;
  if (uiEntry !== undefined && !isSafeRelativePath(uiEntry)) errors.push('ui.entry must be a relative path inside the package');

  // permissions
  const hasServers = servers && Object.keys(servers).length > 0;
  const p = manifest.permissions;
  if (p === undefined) {
    if (strict && (hasServers || manifest.app)) errors.push('permissions is required for agents that run an MCP server or drive an app');
    else if (hasServers) warnings.push('no permissions declared; this older package runs with the default trust level');
  } else if (Array.isArray(p) && !strict && isStringArray(p)) {
    // Older packages list permissions as strings such as "filesystem:write"
    warnings.push('legacy permission list; it is not enforced. Use the v3 permissions object');
  } else if (!p || typeof p !== 'object' || Array.isArray(p)) {
    errors.push('permissions must be an object');
  } else {
    if (p.apps !== undefined) {
      if (!isStringArray(p.apps) || !p.apps.every((a) => APP_ID_RE.test(a))) errors.push('permissions.apps must be an array of app ids');
      else permissions.apps = [...p.apps];
    }
    if (p.fsWrite !== undefined) {
      if (!isStringArray(p.fsWrite) || !p.fsWrite.every(isSafeRelativePath)) errors.push('permissions.fsWrite must be relative folders without ".."');
      else permissions.fsWrite = p.fsWrite.map((x) => x.replace(/\\/g, '/').replace(/\/+$/, ''));
    }
    if (p.network !== undefined) {
      if (typeof p.network !== 'boolean') errors.push('permissions.network must be true or false');
      else permissions.network = p.network;
    }
    // Keys that describePermissions() (packageMeta.js) already understands
    if (p.filesystem !== undefined) {
      if (!['none', 'agent', 'user'].includes(p.filesystem)) errors.push('permissions.filesystem must be none, agent or user');
      else permissions.filesystem = p.filesystem;
    }
    for (const flag of ['desktopControl', 'shell']) {
      if (p[flag] === undefined) continue;
      if (typeof p[flag] !== 'boolean') errors.push(`permissions.${flag} must be true or false`);
      else permissions[flag] = p[flag];
    }
    if (p.approval !== undefined) {
      if (!p.approval || typeof p.approval !== 'object' || Array.isArray(p.approval)) {
        errors.push('permissions.approval must map tool names to never | first-use | always');
      } else {
        for (const [tool, mode] of Object.entries(p.approval)) {
          if (!APPROVAL_MODES.has(mode)) errors.push(`permissions.approval.${tool} must be never, first-use or always`);
          else permissions.approval[tool] = mode;
        }
      }
    }
    if (manifest.app?.id && APP_ID_RE.test(String(manifest.app.id)) && !permissions.apps.includes(manifest.app.id)) {
      errors.push(`permissions.apps must include "${manifest.app.id}" because the agent drives that app`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, version, permissions };
}
