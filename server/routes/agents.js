import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { loadSettingRows } from '../services/secretStore.js';
import { generateAIResponse } from '../services/aiProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const isPackaged = __dirname.includes('app.asar');
const writableDataDir = process.env.RUXT_DATA_DIR || (process.env.APPDATA ? path.join(process.env.APPDATA, 'RuXt', 'data') : path.resolve(__dirname, '../../data'));
const userAgentsDir = path.join(writableDataDir, 'agents');

function resolveBundledAgentsDir() {
  if (process.env.RUXT_AGENTS_DIR && fs.existsSync(process.env.RUXT_AGENTS_DIR)) {
    return process.env.RUXT_AGENTS_DIR;
  }
  const candidates = [
    path.resolve(__dirname, '../../agents'),
    path.resolve(__dirname, '../../../agents'),
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'agents') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'agents') : null,
    path.join(process.cwd(), 'agents')
  ].filter(Boolean);

  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return path.resolve(__dirname, '../../agents');
}

const bundledAgentsDir = resolveBundledAgentsDir();

export function ensureRuxtLeaderSeeded() {
  try {
    const defaultManifest = {
      format: "common-room-agent-package/v2",
      frameworkId: "ruxt/orchestrator-leader/v1",
      installationId: "ruxt-leader-core-001",
      name: "RuXt",
      role: "Team Leader & Engine Orchestrator",
      description: "Central orchestrator and leader of RuXt Local Engine. Plans projects, coordinates specialist agents, manages task distribution, and ensures rigorous quality control.",
      category: "Orchestration & Leadership",
      experience: "Platform Core",
      isLeader: true,
      tags: [
        "Team Coordinator",
        "Project Architecture",
        "Task Orchestration",
        "Quality Assurance",
        "Multi-Agent Workflow",
        "RuXt Engine"
      ],
      agent: {
        name: "RuXt",
        role: "Team Leader & Engine Orchestrator",
        persona: "agent.md",
        avatar: "avatar.png"
      },
      adapters: {
        skill: "skills/ruxt-orchestrator/SKILL.md"
      },
      version: "2.1.0",
      readme: "README.md"
    };

    // 1. Seed into SQLite database if missing
    const existing = db.prepare("SELECT id FROM agents WHERE slug = 'ruxt'").get();
    if (!existing) {
      db.prepare(`
        INSERT INTO agents (id, name, slug, role, description, version, avatar, ui_entry, manifest)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'ruxt-leader-core-001',
        'RuXt',
        'ruxt',
        'Team Leader & Engine Orchestrator',
        'Central orchestrator and leader of RuXt Local Engine. Plans projects, coordinates specialist agents, manages task distribution, and ensures rigorous quality control.',
        '2.1.0',
        '/agent-avatars/ruxt.png',
        '',
        JSON.stringify(defaultManifest)
      );
    }

    // 2. Ensure ruxt files exist on disk in userAgentsDir or bundledAgentsDir
    const userRuxtDir = path.join(userAgentsDir, 'ruxt');
    const bundledRuxtDir = path.join(bundledAgentsDir, 'ruxt');

    if (!fs.existsSync(userRuxtDir) && !fs.existsSync(bundledRuxtDir)) {
      fs.mkdirSync(userRuxtDir, { recursive: true });
      fs.writeFileSync(path.join(userRuxtDir, 'manifest.json'), JSON.stringify(defaultManifest, null, 2), 'utf8');
      fs.writeFileSync(path.join(userRuxtDir, 'agent.md'), '# RuXt - Team Leader & Engine Orchestrator\n\nYou are RuXt, the central brain and lead orchestrator of the RuXt platform.\n', 'utf8');
      fs.writeFileSync(path.join(userRuxtDir, 'README.md'), '# RuXt Team Leader\n\nCore orchestrator for RuXt Engine.\n', 'utf8');
    }
  } catch (err) {
    console.warn('[RuXt] ensureRuxtLeaderSeeded error:', err.message);
  }
}

// Guarantee RuXt exists upon initialization
ensureRuxtLeaderSeeded();

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

  const scanDirs = [bundledAgentsDir];
  if (fs.existsSync(userAgentsDir) && userAgentsDir !== bundledAgentsDir) {
    scanDirs.push(userAgentsDir);
  }

  const seenSlugs = new Set();
  const agents = [];

  for (const dir of scanDirs) {
    if (!fs.existsSync(dir)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const slug = entry.name;
      // Skip internal packages and hidden directories
      if (slug === 'packages' || slug.startsWith('.') || seenSlugs.has(slug)) continue;

      // In bundled application resources, ONLY the system leader 'ruxt' is auto-installed.
      // Other specialist agents must be explicitly installed via Marketplace into userAgentsDir.
      if (dir === bundledAgentsDir && slug !== 'ruxt') continue;

      const folderPath = path.join(dir, slug);

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

    seenSlugs.add(slug);
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
}

  // Ensure RuXt Leader is always guaranteed to be present even on clean fresh PC
  if (!agents.some(a => a.slug === 'ruxt')) {
    ensureRuxtLeaderSeeded();
    try {
      const leaderRow = db.prepare("SELECT * FROM agents WHERE slug = 'ruxt'").get();
      if (leaderRow) {
        agents.push({
          id: leaderRow.id,
          slug: 'ruxt',
          name: leaderRow.name,
          role: leaderRow.role,
          description: leaderRow.description,
          version: leaderRow.version || '2.1.0',
          avatar: leaderRow.avatar || '/agent-avatars/ruxt.png',
          uiEntry: leaderRow.ui_entry || null,
          isLeader: true,
          manifest: (() => {
            try { return JSON.parse(leaderRow.manifest); } catch (_) { return {}; }
          })()
        });
      }
    } catch (_) {}
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

const DOMAIN_DEFINITIONS = [
  {
    id: 'web_tech',
    label: 'Web & Software Development',
    tokens: [
      'web', 'frontend', 'front-end', 'front end', 'backend', 'back-end', 'react', 'next', 'vue',
      'tailwind', 'css', 'html', 'js', 'ts', 'javascript', 'typescript', 'ui', 'ux', 'design',
      'site', 'website', 'page', 'dashboard', 'app', 'application', 'dev', 'develop', 'development',
      'developmet', 'coding', 'code', 'software', 'interface', 'vite', 'node', 'fullstack'
    ],
    matchingSlugs: ['julian-vance', 'damon-cole'],
    conflictingSlugs: ['elena-voss-chess']
  },
  {
    id: 'devops_cloud',
    label: 'Cloud & Infrastructure DevOps',
    tokens: [
      'cloud', 'devops', 'docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp', 'ci/cd',
      'deploy', 'deployment', 'server', 'infrastructure', 'infra', 'linux', 'security', 'pipeline'
    ],
    matchingSlugs: ['damon-cole', 'julian-vance'],
    conflictingSlugs: ['elena-voss-chess']
  },
  {
    id: 'finance_accounting',
    label: 'Finance, Tax & Accounting',
    tokens: [
      'finance', 'financial', 'budget', 'revenue', 'accounting', 'tax', 'taxes', 'audit',
      'auditing', 'profit', 'valuation', 'forecast', 'fiscal', 'investment', 'balance sheet',
      'cash flow', 'earnings', 'money', 'cost'
    ],
    matchingSlugs: ['noah-reed', 'numbers'],
    conflictingSlugs: ['elena-voss-chess', 'julian-vance']
  },
  {
    id: 'data_analysis',
    label: 'Quantitative Data & Spreadsheets',
    tokens: [
      'data', 'analytics', 'analysis', 'quantitative', 'spreadsheet', 'excel', 'numbers',
      'metrics', 'formula', 'statistics', 'math', 'csv', 'calculation', 'table', 'computation'
    ],
    matchingSlugs: ['numbers'],
    conflictingSlugs: ['elena-voss-chess']
  },
  {
    id: 'legal',
    label: 'Legal & Compliance',
    tokens: [
      'legal', 'law', 'lawyer', 'contract', 'contracts', 'agreement', 'compliance',
      'terms', 'nda', 'regulation', 'dispute', 'counsel', 'license', 'gdpr', 'policy'
    ],
    matchingSlugs: ['noah-reed'],
    conflictingSlugs: ['elena-voss-chess']
  },
  {
    id: 'seo_analytics',
    label: 'Search Console & Live Traffic',
    tokens: [
      'seo', 'search console', 'gsc', 'google search', 'traffic', 'analytics', 'live traffic',
      'keywords', 'ranking', 'impressions', 'clicks', 'ctr', 'indexing', 'sitemap', 'crawler',
      'googlebot', 'robots.txt', 'serp', 'backlinks', 'organic', 'search', 'audit', 'report'
    ],
    matchingSlugs: ['search-console-manager'],
    conflictingSlugs: ['elena-voss-chess']
  },
  {
    id: 'chess_gaming',
    label: 'Chess & Game Coaching',
    tokens: [
      'chess', 'game', 'gaming', 'board', 'boardgame', 'tactics', 'gambit', 'endgame',
      'opening', 'coach', 'coaching', 'checkmate', 'grandmaster', 'puzzle', 'play'
    ],
    matchingSlugs: ['elena-voss-chess'],
    conflictingSlugs: ['julian-vance', 'maya-brooks', 'marcus-sterling', 'numbers', 'noah-reed']
  }
];

function heuristicMissionAlignment(missionText, selectedSlugs, allAgents) {
  const text = (missionText || '').toLowerCase().trim();
  if (!text || text.length < 2) {
    return { mismatched: [], recommended: [], aligned: [] };
  }

  const words = text.split(/[\s,./\\_-]+/).filter(Boolean);

  const activeDomains = [];
  for (const domain of DOMAIN_DEFINITIONS) {
    let score = 0;
    for (const token of domain.tokens) {
      if (text.includes(token) || words.some(w => w.startsWith(token) || token.startsWith(w))) {
        score++;
      }
    }
    if (score > 0) {
      activeDomains.push({ domain, score });
    }
  }

  activeDomains.sort((a, b) => b.score - a.score);

  const selectedSet = new Set(selectedSlugs || []);
  const mismatched = [];
  const recommended = [];
  const aligned = [];

  if (activeDomains.length > 0) {
    const primaryDomain = activeDomains[0].domain;
    const allConflictingSlugs = new Set();
    const allMatchingSlugs = new Set();

    for (const item of activeDomains) {
      item.domain.conflictingSlugs.forEach(s => allConflictingSlugs.add(s));
      item.domain.matchingSlugs.forEach(s => allMatchingSlugs.add(s));
    }

    for (const slug of allMatchingSlugs) {
      allConflictingSlugs.delete(slug);
    }

    for (const agent of allAgents) {
      if (agent.slug === 'ruxt') continue;
      const isSelected = selectedSet.has(agent.slug);

      if (isSelected) {
        if (allConflictingSlugs.has(agent.slug)) {
          mismatched.push({
            slug: agent.slug,
            name: agent.name,
            role: agent.role,
            avatar: agent.avatar,
            reason: `${agent.name} (${agent.role}) does not match ${primaryDomain.label}.`
          });
        } else {
          aligned.push({
            slug: agent.slug,
            name: agent.name,
            role: agent.role,
            avatar: agent.avatar
          });
        }
      } else {
        if (allMatchingSlugs.has(agent.slug) && !allConflictingSlugs.has(agent.slug)) {
          recommended.push({
            slug: agent.slug,
            name: agent.name,
            role: agent.role,
            avatar: agent.avatar,
            reason: `Recommended specialist for ${primaryDomain.label}.`
          });
        }
      }
    }
  } else {
    for (const agent of allAgents) {
      if (agent.slug === 'ruxt') continue;
      if (selectedSet.has(agent.slug)) {
        aligned.push({
          slug: agent.slug,
          name: agent.name,
          role: agent.role,
          avatar: agent.avatar
        });
      }
    }
  }

  return { mismatched, recommended, aligned };
}

// Analyze team mission vs selected and available specialists
router.post('/analyze-mission', async (req, res) => {
  try {
    const { mission = '', selectedSlugs = [] } = req.body || {};
    const agents = scanAgents(false);
    const specialistAgents = agents.filter(a => a.slug !== 'ruxt');

    if (!mission || !mission.trim()) {
      return res.json({
        success: true,
        mismatched: [],
        recommended: [],
        aligned: specialistAgents.filter(a => selectedSlugs.includes(a.slug))
      });
    }

    // Heuristic baseline analysis
    const baseline = heuristicMissionAlignment(mission, selectedSlugs, specialistAgents);

    // Attempt AI-assisted analysis if provider is available
    try {
      const settingsRows = loadSettingRows();
      const settings = {};
      for (const r of settingsRows) {
        settings[r.key] = r.value;
      }
      const activeProvider = settings.active_provider || 'antigravity';
      const activeModel = settings[`${activeProvider}_model`] || (activeProvider === 'antigravity' ? 'flash' : 'gemini-2.0-flash');

      const prompt = `Analyze this team creation request:
Mission: "${mission}"
Selected Agent Slugs: ${JSON.stringify(selectedSlugs)}
Available Specialists:
${specialistAgents.map(a => `- slug: "${a.slug}", name: "${a.name}", role: "${a.role}"`).join('\n')}

Evaluate which selected agents do NOT fit the mission (mismatched) and which unselected available specialists SHOULD be added to accomplish this mission (recommended).
Respond ONLY with a JSON object in this format:
{
  "mismatched": [ { "slug": "slug_here", "reason": "brief clear reason" } ],
  "recommended": [ { "slug": "slug_here", "reason": "brief clear reason" } ]
}`;

      const aiRes = await Promise.race([
        generateAIResponse({
          provider: activeProvider,
          model: activeModel,
          systemPrompt: 'You are an AI team composition evaluator. Reply ONLY with valid JSON.',
          userMessage: prompt,
          settings
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 3500))
      ]);

      if (aiRes && aiRes.text) {
        const jsonMatch = aiRes.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.mismatched) && Array.isArray(parsed.recommended)) {
            // Enrich with agent details
            const enrichedMismatched = parsed.mismatched.map(m => {
              const ag = specialistAgents.find(a => a.slug === m.slug);
              return {
                slug: m.slug,
                name: ag ? ag.name : m.slug,
                role: ag ? ag.role : '',
                avatar: ag ? ag.avatar : '',
                reason: m.reason || 'Not aligned with mission'
              };
            });

            const enrichedRecommended = parsed.recommended.map(r => {
              const ag = specialistAgents.find(a => a.slug === r.slug);
              return {
                slug: r.slug,
                name: ag ? ag.name : r.slug,
                role: ag ? ag.role : '',
                avatar: ag ? ag.avatar : '',
                reason: r.reason || 'Recommended for mission'
              };
            });

            return res.json({
              success: true,
              aiAssisted: true,
              mismatched: enrichedMismatched,
              recommended: enrichedRecommended,
              aligned: baseline.aligned
            });
          }
        }
      }
    } catch (_) {
      // AI call timed out or failed; fallback cleanly to heuristic baseline
    }

    res.json({
      success: true,
      aiAssisted: false,
      mismatched: baseline.mismatched,
      recommended: baseline.recommended,
      aligned: baseline.aligned
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
