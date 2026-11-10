import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const agentsDir = process.env.RUXT_AGENTS_DIR || path.resolve(__dirname, '../../agents');

function getSafeJson(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (_) {}
  return null;
}

let cachedAgents = null;
let lastScanTime = 0;
const CACHE_TTL_MS = 60000; // 60s memory cache

export function invalidateAgentsCache() {
  cachedAgents = null;
  lastScanTime = 0;
}

function scanAgents(force = false) {
  if (!force && cachedAgents && (Date.now() - lastScanTime < CACHE_TTL_MS)) {
    return cachedAgents;
  }

  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true });
    cachedAgents = [];
    lastScanTime = Date.now();
    return [];
  }

  const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
  const agents = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    // Skip internal packages and hidden directories
    if (slug === 'packages' || slug.startsWith('.')) continue;

    const folderPath = path.join(agentsDir, slug);

    // Look for manifest
    const manifestCandidates = ['manifest.json', 'agent.json', 'ruxt-package.json'];
    let manifest = {};
    for (const mName of manifestCandidates) {
      const parsed = getSafeJson(path.join(folderPath, mName));
      if (parsed) {
        manifest = { ...manifest, ...parsed };
        break;
      }
    }

    // UI entry discovery
    let uiEntry = null;
    const uiCandidates = [
      manifest.ui?.entry,
      manifest.uiEntry,
      'ui/index.html',
      'ui/board.html',
      'index.html'
    ].filter(Boolean);

    for (const uRel of uiCandidates) {
      if (fs.existsSync(path.join(folderPath, uRel))) {
        uiEntry = `/agents/${slug}/${uRel}`;
        break;
      }
    }

    // Avatar discovery
    let avatar = `/agent-avatars/${slug}.png`;
    const avatarCandidates = ['avatar.png', 'avatar.jpg', 'icon.png'];
    for (const aName of avatarCandidates) {
      if (fs.existsSync(path.join(folderPath, aName))) {
        avatar = `/agents/${slug}/${aName}`;
        break;
      }
    }

    const isLeader = slug === 'ruxt' || manifest.isLeader === true;

    const agentObj = {
      id: manifest.id || slug,
      slug,
      name: manifest.name || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      role: manifest.role || manifest.description || 'AI Specialist Agent',
      description: manifest.description || `Autonomous agent workspace for ${slug}`,
      version: manifest.version || '1.0.0',
      avatar,
      uiEntry,
      isLeader,
      manifest
    };

    agents.push(agentObj);

    // Upsert into SQLite
    try {
      db.prepare(`
        INSERT INTO agents (id, name, slug, role, description, version, avatar, ui_entry, manifest)
        VALUES (@id, @name, @slug, @role, @description, @version, @avatar, @uiEntry, @manifestStr)
        ON CONFLICT(slug) DO UPDATE SET 
          name = excluded.name,
          role = excluded.role,
          description = excluded.description,
          avatar = excluded.avatar,
          ui_entry = excluded.ui_entry,
          manifest = excluded.manifest
      `).run({
        ...agentObj,
        uiEntry: agentObj.uiEntry || '',
        manifestStr: JSON.stringify(agentObj.manifest)
      });
    } catch (e) {
      // Ignore conflict errors
    }
  }

  // Sort so Team Leader (RuXt) is always first
  agents.sort((a, b) => {
    if (a.isLeader && !b.isLeader) return -1;
    if (!a.isLeader && b.isLeader) return 1;
    return a.name.localeCompare(b.name);
  });

  cachedAgents = agents;
  lastScanTime = Date.now();
  return agents;
}

// Get all agents
router.get('/', (req, res) => {
  try {
    const force = req.query.refresh === 'true';
    const agents = scanAgents(force);
    res.json({ success: true, count: agents.length, agents, cached: !force && (Date.now() - lastScanTime < CACHE_TTL_MS) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single agent by slug
router.get('/:slug', (req, res) => {
  try {
    const agents = scanAgents(false);
    const agent = agents.find(a => a.slug === req.params.slug || a.id === req.params.slug);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json({ success: true, agent });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
