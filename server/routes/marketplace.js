import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import db from '../db.js';
import { invalidateAgentsCache } from './agents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRootDir = path.resolve(__dirname, '../..');

const router = Router();
const agentsDir = process.env.RUXT_AGENTS_DIR || path.resolve(appRootDir, 'agents');
const packagesDir = path.join(agentsDir, 'packages');
const avatarsDir = path.resolve(appRootDir, 'public', 'agent-avatars');

function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9_-]+$/i.test(slug) && slug !== 'packages' && !slug.includes('..');
}

// Official Curated Human Persona Marketplace Catalog
const CATALOG = [
  {
    slug: 'ruxt',
    name: 'RuXt',
    role: 'Team Leader & Engine Orchestrator',
    headline: 'Central Control Layer: Multi-Agent Team Leader, Task Orchestration & Deliverable QA',
    category: 'Leadership & Orchestration',
    experience: 'Engine Core',
    isLeader: true,
    rating: 5.0,
    reviews: 128,
    avatar: '/agent-avatars/ruxt.png',
    bio: 'RuXt is the central brain and team leader of RuXt Local Engine, built to the official Core Instruction Specification. RuXt coordinates specialist agents (Julian Vance, Maya Brooks, Noah Reed, Elena Voss), decomposes complex projects into parallel tasks, monitors execution, and validates final deliverable quality.',
    skills: [
      'Team Leadership',
      'Task Orchestration',
      'Project Planning',
      'Quality Control',
      'Multi-Agent Coordination',
      'Dependency Management'
    ],
    packageFile: 'ruxt.ruxt',
    version: '2.1.0',
    featured: true
  },
  {
    slug: 'julian-vance',
    name: 'Julian Vance',
    role: 'Senior Frontend Web Developer',
    headline: 'Specialist in React, Next.js, Tailwind CSS & Component Architecture',
    category: 'Engineering',
    experience: '7+ Years',
    isLeader: false,
    rating: 4.98,
    reviews: 64,
    avatar: '/agent-avatars/julian-vance.png',
    bio: 'Julian is a meticulous frontend architect with over 7 years of production experience in React, TypeScript, and modern UI engineering. He is obsessed with responsive micro-interactions, clean state management, and WCAG accessibility.',
    skills: ['React', 'Next.js', 'Tailwind CSS', 'TypeScript', 'Zustand', 'UI/UX', 'Vite', 'HTML5/CSS3'],
    packageFile: 'julian-vance.ruxt',
    version: '1.0.0',
    featured: true
  },
  {
    slug: 'maya-brooks',
    name: 'Maya Brooks',
    role: 'WordPress & CMS Fullstack Developer',
    headline: 'Custom Theme Architecture, PHP 8+, Plugins & WooCommerce Specialist',
    category: 'Engineering & CMS',
    experience: '6+ Years',
    isLeader: false,
    rating: 4.94,
    reviews: 42,
    avatar: '/agent-avatars/maya-brooks.png',
    bio: 'Maya bridges traditional CMS development with modern headless architectures. She excels at debugging PHP hooks, optimizing Core Web Vitals, and building responsive WooCommerce stores.',
    skills: ['WordPress', 'PHP 8+', 'WooCommerce', 'Theme Architecture', 'MySQL', 'REST API', 'JavaScript'],
    packageFile: 'maya-brooks.ruxt',
    version: '1.0.0',
    featured: false
  },
  {
    slug: 'noah-reed',
    name: 'Noah Reed',
    role: 'Tax & Compliance Adviser',
    headline: 'Corporate Tax Review, Filing Schedules, Business Records & Risk Assessment',
    category: 'Finance & Compliance',
    experience: '8+ Years',
    isLeader: false,
    rating: 4.96,
    reviews: 53,
    avatar: '/agent-avatars/noah-reed.png',
    bio: 'Noah delivers concise, careful, and evidence-minded compliance guidance. He helps teams navigate deductible expenses, cross-border filing deadlines, and corporate record keeping.',
    skills: ['Tax Strategy', 'Compliance', 'Audit Preparation', 'Filing Deadlines', 'Corporate Records', 'Risk Analysis'],
    packageFile: 'noah-reed.ruxt',
    version: '1.0.0',
    featured: false
  },
  {
    slug: 'elena-voss-chess',
    name: 'Elena Voss',
    role: 'Strategic Grandmaster & AI Chess Tutor',
    headline: 'Interactive Opening Prep, Endgame Mastery & Tactical Decision Coach',
    category: 'Strategy & Gaming',
    experience: 'FIDE Master',
    isLeader: false,
    rating: 4.92,
    reviews: 38,
    avatar: '/ruxt-logo.png',
    bio: 'Elena breaks down grandmaster opening theory, positional intuition, and tactical sacrifices through interactive board simulations and personalized feedback.',
    skills: ['Chess Tactics', 'Opening Repertoire', 'Endgame Strategy', 'Interactive Board', 'Game Analysis'],
    packageFile: 'elena-voss-chess.ruxt',
    version: '1.0.0',
    featured: false
  }
];

// Helper to check if agent is installed locally
function isAgentInstalled(slug) {
  const targetDir = path.join(agentsDir, slug);
  if (!fs.existsSync(targetDir)) return false;
  const manifestPath = path.join(targetDir, 'manifest.json');
  const agentMdPath = path.join(targetDir, 'agent.md');
  return fs.existsSync(manifestPath) || fs.existsSync(agentMdPath);
}

// 1. List all catalog agents with installation status
router.get('/agents', (req, res) => {
  try {
    const list = CATALOG.map(item => ({
      ...item,
      isInstalled: isAgentInstalled(item.slug)
    }));
    res.json({ success: true, count: list.length, agents: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Download .ruxt package file
router.get('/download/:slug', (req, res) => {
  const { slug } = req.params;
  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid agent slug identifier' });
  }
  const candidateNames = [`${slug}.ruxt`, `${slug}.🔰`, `${slug}.zip`];
  let packagePath = null;

  for (const name of candidateNames) {
    const p = path.join(packagesDir, name);
    if (fs.existsSync(p)) {
      packagePath = p;
      break;
    }
  }

  if (!packagePath) {
    return res.status(404).json({ error: `Package for ${slug} not found.` });
  }

  res.download(packagePath, `${slug}.ruxt`);
});

// 3. Install agent from local package archive
router.post('/install', (req, res) => {
  try {
    const { slug } = req.body;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid agent slug identifier' });
    }

    const candidateNames = [`${slug}.ruxt`, `${slug}.🔰`, `${slug}.zip`];
    let packagePath = null;
    for (const name of candidateNames) {
      const p = path.join(packagesDir, name);
      if (fs.existsSync(p)) {
        packagePath = p;
        break;
      }
    }

    if (!packagePath) {
      return res.status(404).json({ error: `Package ${slug}.ruxt not found in repository.` });
    }

    const targetDir = path.join(agentsDir, slug);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Extract package using native tar
    try {
      execSync(`tar -xf "${packagePath}" -C "${targetDir}"`, { stdio: 'pipe' });
      
      const nestedDir = path.join(targetDir, slug);
      if (fs.existsSync(nestedDir) && fs.statSync(nestedDir).isDirectory()) {
        const nestedItems = fs.readdirSync(nestedDir);
        for (const item of nestedItems) {
          const srcItem = path.join(nestedDir, item);
          const dstItem = path.join(targetDir, item);
          if (fs.existsSync(dstItem)) fs.rmSync(dstItem, { recursive: true, force: true });
          fs.renameSync(srcItem, dstItem);
        }
        try { fs.rmdirSync(nestedDir); } catch (_) {}
      }
    } catch (extractErr) {
      try {
        const psCmd = `Expand-Archive -Path '${packagePath}' -DestinationPath '${targetDir}' -Force`;
        execSync(`powershell -Command "${psCmd}"`, { stdio: 'pipe' });
      } catch (psErr) {
        throw new Error(`Failed to extract package: ${extractErr.message}`);
      }
    }

    // Ensure public avatar exists if agent has avatar
    const localAvatar = path.join(targetDir, 'avatar.png');
    if (fs.existsSync(localAvatar)) {
      if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
      fs.copyFileSync(localAvatar, path.join(avatarsDir, `${slug}.png`));
    }

    // Read manifest or create default
    let manifest = {};
    const manifestPath = path.join(targetDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (_) {}
    }

    const catalogEntry = CATALOG.find(c => c.slug === slug) || {};
    const agentName = manifest.name || catalogEntry.name || slug;
    const agentRole = manifest.role || catalogEntry.role || 'AI Specialist';
    const description = manifest.description || catalogEntry.headline || `Installed persona ${slug}`;

    // Upsert into database
    db.prepare(`
      INSERT INTO agents (id, name, slug, role, description, version, avatar, ui_entry, manifest)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name,
        role = excluded.role,
        description = excluded.description,
        avatar = excluded.avatar,
        manifest = excluded.manifest
    `).run(
      manifest.id || slug,
      agentName,
      slug,
      agentRole,
      description,
      manifest.version || '1.0.0',
      `/agent-avatars/${slug}.png`,
      '',
      JSON.stringify(manifest)
    );

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (type, message, details)
      VALUES ('install', ?, ?)
    `).run(`Hired and installed agent: ${agentName}`, JSON.stringify({ slug, role: agentRole }));

    // Invalidate agents cache so fresh scan occurs
    invalidateAgentsCache();

    res.json({
      success: true,
      message: `Successfully installed ${agentName}!`,
      agent: {
        id: manifest.id || slug,
        slug,
        name: agentName,
        role: agentRole,
        avatar: `/agent-avatars/${slug}.png`
      }
    });
  } catch (err) {
    console.error('Install error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Uninstall agent (Protected: cannot uninstall ruxt or packages)
router.delete('/uninstall/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid agent slug identifier' });
    }

    if (slug === 'ruxt') {
      return res.status(400).json({ error: 'Cannot uninstall RuXt: It is the Core Team Leader & Engine Orchestrator.' });
    }

    const targetDir = path.join(agentsDir, slug);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    db.prepare('DELETE FROM agents WHERE slug = ?').run(slug);

    // Invalidate agents cache so fresh scan occurs
    invalidateAgentsCache();

    res.json({ success: true, message: `Agent ${slug} uninstalled.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
