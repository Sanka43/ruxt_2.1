#!/usr/bin/env node
// Scaffold a new app-controlling agent package:
//   node agent-kit/new-agent.mjs --app excel --name "Priya Nair" --role "Excel analyst" [--out agents]
// It copies the shared MCP base, writes a manifest/persona/skill/server for the app and validates the result.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateAgentManifest } from '../server/services/manifestValidator.js';

const kitDir = path.dirname(fileURLToPath(import.meta.url));
const SHARED_FILES = ['ruxt_mcp_base.py', 'ruxt_script_guard.py'];

export function scaffoldAgent({ app, name, role, slug, outDir }) {
  const appId = String(app || '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(appId)) throw new Error('--app must be a lowercase id such as "excel"');
  if (!name || !String(name).trim()) throw new Error('--name is required');
  const agentName = String(name).trim();
  const agentSlug = slug || agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const appTitle = appId.charAt(0).toUpperCase() + appId.slice(1);
  const vars = {
    SLUG: agentSlug,
    NAME: agentName.replace(/["\\]/g, ''),
    ROLE: String(role || `${appTitle} specialist`).replace(/["\\]/g, ''),
    APP_ID: appId,
    APP_TITLE: appTitle,
    APP_ENV: `${appId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_BIN`
  };
  const fill = (text) => text.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`template uses unknown placeholder ${key}`);
    return vars[key];
  });

  const dir = path.resolve(outDir, agentSlug);
  if (fs.existsSync(dir)) throw new Error(`${dir} already exists; choose another --name or --slug`);
  fs.mkdirSync(path.join(dir, 'mcp'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'skills', appId), { recursive: true });

  const tpl = (file) => fill(fs.readFileSync(path.join(kitDir, 'templates', file), 'utf8'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), tpl('manifest.json.tmpl'));
  fs.writeFileSync(path.join(dir, 'agent.md'), tpl('agent.md.tmpl'));
  fs.writeFileSync(path.join(dir, 'skills', appId, 'SKILL.md'), tpl('SKILL.md.tmpl'));
  fs.writeFileSync(path.join(dir, 'mcp', `${appId}_server.py`), tpl('server.py.tmpl'));
  for (const f of SHARED_FILES) fs.copyFileSync(path.join(kitDir, f), path.join(dir, 'mcp', f));

  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const verdict = validateAgentManifest(manifest, dir);
  if (!verdict.ok) throw new Error(`generated manifest is invalid: ${verdict.errors.join('; ')}`);
  return { dir, slug: agentSlug };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
  try {
    const { dir, slug } = scaffoldAgent({ ...args, outDir: args.out || path.join(kitDir, '..', 'agents') });
    console.log(`Created ${dir}\nNext: add your tools in mcp/${args.app}_server.py, add avatar.png, then: node agent-kit/pack-agent.mjs ${slug}`);
  } catch (err) {
    console.error(`new-agent: ${err.message}`);
    process.exit(1);
  }
}
