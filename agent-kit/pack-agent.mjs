#!/usr/bin/env node
// Build agents/packages/<slug>.ruxt from agents/<slug>/ after validating its manifest:
//   node agent-kit/pack-agent.mjs omer-balika
// Per-user or generated files (memory, run logs, caches) are left out of the package.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createArchive } from '../server/services/safeArchive.js';
import { validateAgentManifest } from '../server/services/manifestValidator.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXCLUDE = new Set(['__pycache__', '_runs', '_tmp', 'node_modules', '.git', 'memory.json', 'previews']);

export function packAgent(slug, { agentsDir = path.join(repoRoot, 'agents'), outDir = path.join(repoRoot, 'agents', 'packages') } = {}) {
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(slug)) throw new Error('slug must look like "omer-balika"');
  const src = path.join(agentsDir, slug);
  const manifestFile = path.join(src, 'manifest.json');
  if (!fs.existsSync(manifestFile)) throw new Error(`${manifestFile} not found`);
  const verdict = validateAgentManifest(JSON.parse(fs.readFileSync(manifestFile, 'utf8')), src);
  if (!verdict.ok) throw new Error(`manifest is invalid: ${verdict.errors.join('; ')}`);

  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'ruxt-pack-'));
  try {
    fs.cpSync(src, path.join(stage, slug), { recursive: true, filter: (p) => !EXCLUDE.has(path.basename(p)) });
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, `${slug}.ruxt`);
    createArchive(path.join(stage, slug), out);
    return { out, warnings: verdict.warnings };
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { out, warnings } = packAgent(process.argv[2] || '');
    for (const w of warnings) console.warn(`warning: ${w}`);
    console.log(`Wrote ${out}`);
  } catch (err) {
    console.error(`pack-agent: ${err.message}`);
    process.exit(1);
  }
}
