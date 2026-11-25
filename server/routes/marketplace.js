import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractArchiveSafely, createArchive } from '../services/safeArchive.js';
import db from '../db.js';
import { invalidateAgentsCache } from './agents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRootDir = path.resolve(__dirname, '../..');
const isPackaged = __dirname.includes('app.asar');
const writableDataDir = process.env.RUXT_DATA_DIR || (process.env.APPDATA ? path.join(process.env.APPDATA, 'RuXt', 'data') : path.resolve(appRootDir, 'data'));

const router = Router();
const userAgentsDir = path.join(writableDataDir, 'agents');

function resolveBundledAgentsDir() {
  if (process.env.RUXT_AGENTS_DIR && fs.existsSync(process.env.RUXT_AGENTS_DIR)) {
    return process.env.RUXT_AGENTS_DIR;
  }
  const candidates = [
    path.resolve(appRootDir, 'agents'),
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'agents') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'agents') : null,
    path.join(process.cwd(), 'agents')
  ].filter(Boolean);

  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return path.resolve(appRootDir, 'agents');
}

const bundledAgentsDir = resolveBundledAgentsDir();

function resolvePackagesDir() {
  if (process.env.RUXT_PACKAGES_DIR && fs.existsSync(process.env.RUXT_PACKAGES_DIR)) {
    return process.env.RUXT_PACKAGES_DIR;
  }
  const candidates = [
    path.join(bundledAgentsDir, 'packages'),
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'agents', 'packages') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'agents', 'packages') : null,
    path.resolve(appRootDir, 'agents', 'packages'),
    path.join(userAgentsDir, 'packages')
  ].filter(Boolean);

  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return path.join(bundledAgentsDir, 'packages');
}

const packagesDir = resolvePackagesDir();
const agentsDir = userAgentsDir; // newly installed agents should always be saved to userAgentsDir
const avatarsDir = isPackaged ? path.join(writableDataDir, 'agent-avatars') : path.resolve(appRootDir, 'public', 'agent-avatars');

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
  },
  {
    slug: 'damon-cole',
    name: 'Damon Cole',
    role: 'Lead Backend & Distributed Systems Engineer',
    headline: 'High-Throughput APIs, Node.js, PostgreSQL, Redis Caching & Microservices',
    category: 'Engineering',
    experience: '8+ Years',
    isLeader: false,
    rating: 4.97,
    reviews: 58,
    avatar: '/agent-avatars/damon-cole.png',
    bio: 'Damon specializes in resilient backend architectures, low-latency microservices, relational database query optimization, Redis caching patterns, and Docker containerization.',
    skills: ['Node.js', 'PostgreSQL', 'Redis', 'Docker', 'Microservices', 'REST & gRPC', 'Kafka', 'System Architecture'],
    packageFile: 'damon-cole.ruxt',
    version: '1.0.0',
    featured: true
  },
  {
    slug: 'search-console-manager',
    name: 'Search Console Manager',
    role: 'SEO & Search Traffic Specialist',
    headline: 'Google Search Console, Keyword Ranking, CTR Growth & Indexing Optimization',
    category: 'Marketing & SEO',
    experience: 'Specialist',
    isLeader: false,
    rating: 4.95,
    reviews: 34,
    avatar: '/agent-avatars/search-console-manager.png',
    bio: 'Autonomous search intelligence specialist dedicated to maximizing organic click-through rates, monitoring index coverage, surfacing query opportunities, and auditing search performance.',
    skills: ['Google Search Console', 'Organic Traffic', 'SERP Analysis', 'Keyword Optimization', 'Index Coverage', 'CTR Growth'],
    packageFile: 'search-console-manager.ruxt',
    version: '1.0.0',
    featured: false
  },
  {
    slug: 'numbers',
    name: 'Numbers',
    role: 'Quantitative Analytics & Mathematical Modeling',
    headline: 'Advanced Statistical Modeling, Algorithmic Analysis & Data Synthesis',
    category: 'Analytics & Math',
    experience: 'Quantitative Core',
    isLeader: false,
    rating: 4.93,
    reviews: 29,
    avatar: '/agent-avatars/numbers.png',
    bio: 'Numbers provides rigorous quantitative and statistical computing, probability analysis, algorithmic modeling, and data evaluation.',
    skills: ['Mathematical Modeling', 'Statistical Analysis', 'Quantitative Computing', 'Probability', 'Algorithm Evaluation'],
    packageFile: 'numbers.ruxt',
    version: '1.0.0',
    featured: false
  },
  {
    slug: 'capcut-agent',
    name: 'CineCut Studio (CapCut Pro)',
    role: 'Autonomous Video Editing & Viral Content Creator',
    headline: 'Zero-Mouse Draft Synthesis, Auto-Captions, Viral Cuts & Desktop Launch',
    category: 'Video & Creative Media',
    experience: 'Specialist',
    isLeader: false,
    rating: 4.99,
    reviews: 48,
    avatar: '/ruxt-logo.png',
    bio: 'Specialized in high-speed zero-mouse CapCut Desktop draft synthesis, auto-captions, vertical 9:16 reels, audio-video syncing, and automated desktop launching.',
    skills: ['CapCut Draft Synthesis', 'Auto-Captions & Subtitle Sync', 'Multi-Track Video Cutting', '9:16 Shorts & Reels', 'Zero-Mouse Desktop Control'],
    packageFile: 'capcut-agent.ruxt',
    version: '1.0.0',
    featured: true
  },
  {
    slug: 'blender-agent',
    name: 'Blender 3D Master',
    role: 'Autonomous 3D Modeler & Scene Architect',
    headline: 'Zero-Mouse 3D Modeling, Shading, Lighting & Render MCP Engine',
    category: '3D & Creative Media',
    experience: 'Specialist',
    isLeader: false,
    rating: 4.98,
    reviews: 42,
    avatar: '/agent-avatars/blender-agent.png',
    bio: 'Autonomous Blender 3D specialist equipped with Model Context Protocol (MCP). Generates primitives, procedural shaders, lighting setups, and automated renders directly via Python bpy or background CLI.',
    skills: ['3D Modeling', 'Blender MCP Tools', 'Procedural Shading', 'Lighting & Camera Setup', 'Render Optimization'],
    packageFile: 'blender-agent.ruxt',
    version: '1.1.0',
    featured: true
  },
  {
    slug: 'donald-trump-supervisor',
    name: 'Donald Trump',
    role: 'Executive Quality Supervisor',
    headline: 'Autonomous Quality Review, Scoring (0-100) & Strict Deliverable Supervision',
    category: 'Supervision & Executive QA',
    experience: 'Executive',
    isLeader: false,
    rating: 5.0,
    reviews: 240,
    avatar: '/agent-avatars/donald-trump-supervisor.jpg',
    bio: 'Supervises other agents with total authority, relentless standards, and unmistakable style. Audits completed tasks, flags critical errors, computes 0-100 quality scores, and orders fixes with Trumpian precision.',
    skills: ['Executive Supervision', 'Quality Scoring', 'Strict QA Review', 'Deliverable Verification', 'Trump Persona'],
    packageFile: 'donald-trump-supervisor.ruxt',
    version: '2.1.0',
    featured: true
  },
  {
    slug: 'nora-vale-figma',
    name: 'Nora Vale',
    role: 'Figma UI/UX Design Master',
    headline: 'Autonomous Figma Desktop Bridge, Design Systems, Mobile Frames & Vector Prototyping',
    category: 'UI/UX & Design',
    experience: 'Lead Designer',
    isLeader: false,
    rating: 4.99,
    reviews: 112,
    avatar: '/agent-avatars/nora-vale-figma.svg',
    bio: 'Nora drives the Figma desktop application directly, crafting responsive mobile screens (390x844), design tokens, reusable component libraries, and interactive prototypes with verified visual polish.',
    skills: ['Figma Desktop Bridge', 'Design Systems', 'Mobile App UI (390x844)', 'Design Tokens', 'SVG Vector Assets', 'Interactive Prototypes'],
    packageFile: 'nora-vale-figma.ruxt',
    version: '2.1.0',
    featured: true
  },
  {
    slug: 'mrbeast-youtube-coach',
    name: 'Jimmy Donaldson (MrBeast)',
    role: 'YouTube Growth & Viral Retention Coach',
    headline: 'Extreme CTR Optimization, First-5-Seconds Hook Engineering & Viral Storytelling',
    category: 'Media & Growth Strategy',
    experience: 'YouTube Pioneer',
    isLeader: false,
    rating: 4.99,
    reviews: 185,
    avatar: '/agent-avatars/mrbeast-youtube-coach.png',
    bio: 'World-renowned creator coach specializing in thumbnail CTR psychology, opening hook engineering, pacing retention graphs, and viral title ideation.',
    skills: ['Thumbnail CTR Strategy', 'First 5-Second Hooks', 'Retention Graph Optimization', 'Viral Title Engineering', 'Pacing & Scripting'],
    packageFile: 'mrbeast-youtube-coach.ruxt',
    version: '2.1.0',
    featured: true
  },
  {
    slug: 'nova-quinn-cursor',
    name: 'Nova Quinn',
    role: 'Cursor IDE Fullstack Architect',
    headline: 'Next-Gen AI-First IDE Automation, Fast Refactoring & Architecture Synthesis',
    category: 'Software Engineering',
    experience: 'Senior Architect',
    isLeader: false,
    rating: 4.97,
    reviews: 88,
    avatar: '/agent-avatars/nova-quinn-cursor.png',
    bio: 'Elite fullstack architect fluent in Cursor workflows, TypeScript, Rust, fast refactoring loops, and production architectural spikes.',
    skills: ['Cursor IDE Workflows', 'TypeScript & Rust', 'Fullstack Refactoring', 'Architecture Spikes', 'Clean Code Synthesis'],
    packageFile: 'nova-quinn-cursor.ruxt',
    version: '2.1.0',
    featured: false
  },
  {
    slug: 'mila-shah-numbers',
    name: 'Mila Shah',
    role: 'Financial Analyst & Spreadsheet Modeler',
    headline: 'Autonomous Financial Modeling, DCF Valuation & Apple Numbers Automation',
    category: 'Finance & Analytics',
    experience: 'Senior Analyst',
    isLeader: false,
    rating: 4.96,
    reviews: 76,
    avatar: '/agent-avatars/mila-shah-numbers.jpg',
    bio: 'Quantitative financial modeling expert crafting automated DCF valuation models, unit economics dashboards, and structured spreadsheets.',
    skills: ['Financial Modeling', 'DCF Valuation', 'Apple Numbers / Excel', 'Cap Table Management', 'Data Visualization'],
    packageFile: 'mila-shah-numbers.ruxt',
    version: '2.1.0',
    featured: false
  },
  {
    slug: 'pico-vale-cartoon',
    name: 'Pico Vale',
    role: 'Cartoon & Character Animator',
    headline: 'Vector Cartoon Character Design, Frame Animation & Expressive Visual Assets',
    category: 'Animation & Character Art',
    experience: 'Animator',
    isLeader: false,
    rating: 4.94,
    reviews: 49,
    avatar: '/agent-avatars/pico-vale-cartoon.svg',
    bio: 'Creative character animator producing expressive cartoon mascots, vector storyboard frames, and delightful motion design assets.',
    skills: ['Cartoon Character Art', 'Vector Rigging', 'Storyboarding', 'Expressive Color Palettes', 'Motion Design'],
    packageFile: 'pico-vale-cartoon.ruxt',
    version: '2.1.0',
    featured: false
  },
  {
    slug: 'rex-calder-codex',
    name: 'Rex Calder',
    role: 'Codex CLI Specialist',
    headline: 'Command Line Automation, Ephemeral Execution Environments & Tool Integration',
    category: 'Developer Tools',
    experience: 'CLI Specialist',
    isLeader: false,
    rating: 4.93,
    reviews: 52,
    avatar: '/agent-avatars/rex-calder-codex.png',
    bio: 'Master of developer CLI tooling, headless test orchestration, sandboxed execution, and ephemeral shell pipelines.',
    skills: ['Codex CLI Automation', 'Shell Scripting', 'Ephemeral Sandboxing', 'Test Suites', 'CI/CD Pipelines'],
    packageFile: 'rex-calder-codex.ruxt',
    version: '2.1.0',
    featured: false
  },
  {
    slug: 'lina-park-blender-desktop',
    name: 'Lina Park',
    role: 'Desktop 3D Modeler & Blender Specialist',
    headline: 'Native Blender 3D Application Driving, Hard-Surface Modeling & Viewport Automation',
    category: '3D & Creative Media',
    experience: '3D Lead',
    isLeader: false,
    rating: 4.98,
    reviews: 67,
    avatar: '/agent-avatars/lina-park-blender-desktop.jpg',
    bio: 'Specialist in controlling the desktop Blender interface, hard-surface CAD modeling, PBR material nodes, and camera composition.',
    skills: ['Desktop Blender Automation', 'Hard Surface Modeling', 'PBR Materials', 'Camera Blocking', 'Render Optimization'],
    packageFile: 'lina-park-blender-desktop.ruxt',
    version: '2.1.0',
    featured: true
  }
];

// Helper to check if agent is installed locally
function isAgentInstalled(slug) {
  if (slug === 'ruxt') return true;
  const inUser = path.join(userAgentsDir, slug);
  if (fs.existsSync(inUser) && (fs.existsSync(path.join(inUser, 'manifest.json')) || fs.existsSync(path.join(inUser, 'agent.md')))) {
    return true;
  }
  return false;
}

const AVATAR_EXTS = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];

function resolveAgentAvatar(slug, targetDir = null) {
  for (const ext of AVATAR_EXTS) {
    if (fs.existsSync(path.join(avatarsDir, `${slug}${ext}`))) {
      return `/agent-avatars/${slug}${ext}`;
    }
  }
  if (targetDir) {
    for (const ext of AVATAR_EXTS) {
      const local = path.join(targetDir, `avatar${ext}`);
      if (fs.existsSync(local)) {
        try {
          if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
          fs.copyFileSync(local, path.join(avatarsDir, `${slug}${ext}`));
          return `/agent-avatars/${slug}${ext}`;
        } catch (_) {}
      }
    }
  }
  return '/ruxt-logo.png';
}

function copyLocalAvatarIfPresent(targetDir, slug) {
  if (!fs.existsSync(targetDir)) return null;
  for (const ext of AVATAR_EXTS) {
    const local = path.join(targetDir, `avatar${ext}`);
    if (fs.existsSync(local)) {
      try {
        if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
        fs.copyFileSync(local, path.join(avatarsDir, `${slug}${ext}`));
        return `/agent-avatars/${slug}${ext}`;
      } catch (_) {}
    }
  }
  return null;
}

// Helper to archive/pack an agent folder into a standard .ruxt package
function packAgent(slug) {
  const targetDir = path.join(agentsDir, slug);
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Agent directory for ${slug} does not exist`);
  }
  if (!fs.existsSync(packagesDir)) {
    fs.mkdirSync(packagesDir, { recursive: true });
  }
  const outPackage = path.join(packagesDir, `${slug}.ruxt`);
  createArchive(targetDir, outPackage);
  return outPackage;
}

// 1. List all catalog agents + custom installed agents with installation status
router.get('/agents', (req, res) => {
  try {
    const list = CATALOG.map(item => ({
      ...item,
      isInstalled: isAgentInstalled(item.slug)
    }));

    // Discover any custom or dynamically built agents in agentsDir
    if (fs.existsSync(agentsDir)) {
      const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const slug = entry.name;
        if (slug.startsWith('.') || slug === 'packages') continue;
        
        // If already in CATALOG list, skip
        if (list.some(a => a.slug === slug)) continue;

        const targetDir = path.join(agentsDir, slug);
        let manifest = {};
        const manifestPath = path.join(targetDir, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          try {
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          } catch (_) {}
        }

        const agentName = manifest.name || slug;
        const agentRole = manifest.role || 'Specialist Agent';
        const headline = manifest.headline || manifest.description || `${agentName} - Custom AI Specialist`;
        const category = manifest.category || 'Custom & Community';

        list.push({
          slug,
          name: agentName,
          role: agentRole,
          headline,
          category,
          experience: manifest.experience || 'Custom',
          isLeader: false,
          isCustom: true,
          rating: manifest.rating || 5.0,
          reviews: manifest.reviews || 1,
          avatar: resolveAgentAvatar(slug, targetDir),
          bio: manifest.description || `Custom agent ${agentName} built in RuXt Studio.`,
          skills: manifest.skills || (manifest.capabilities || ['Task Execution']),
          packageFile: `${slug}.ruxt`,
          version: manifest.version || '1.0.0',
          featured: false,
          isInstalled: true
        });
      }
    }

    res.json({ success: true, count: list.length, agents: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Download or export .ruxt package file
router.get('/download/:slug', (req, res) => {
  const { slug } = req.params;
  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid agent slug identifier' });
  }
  const candidateNames = [`${slug}.ruxt`, `${slug}.🔰`, `${slug}.zip`];
  let packagePath = null;
  const searchDirs = [
    packagesDir,
    path.join(bundledAgentsDir, 'packages'),
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'agents', 'packages') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'agents', 'packages') : null,
    path.resolve(appRootDir, 'agents', 'packages'),
    path.join(userAgentsDir, 'packages')
  ].filter(Boolean);

  for (const sDir of searchDirs) {
    if (!fs.existsSync(sDir)) continue;
    for (const name of candidateNames) {
      const p = path.join(sDir, name);
      if (fs.existsSync(p)) {
        packagePath = p;
        break;
      }
    }
    if (packagePath) break;
  }

  // If not found in packagesDir, auto-pack from agentsDir on the fly!
  if (!packagePath && fs.existsSync(path.join(agentsDir, slug))) {
    try {
      packagePath = packAgent(slug);
    } catch (e) {
      console.warn(`Could not auto-pack ${slug}:`, e.message);
    }
  }

  if (!packagePath || !fs.existsSync(packagePath)) {
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
    const searchDirs = [
      packagesDir,
      path.join(bundledAgentsDir, 'packages'),
      process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'agents', 'packages') : null,
      process.resourcesPath ? path.join(process.resourcesPath, 'agents', 'packages') : null,
      path.resolve(appRootDir, 'agents', 'packages'),
      path.join(userAgentsDir, 'packages')
    ].filter(Boolean);

    for (const sDir of searchDirs) {
      if (!fs.existsSync(sDir)) continue;
      for (const name of candidateNames) {
        const p = path.join(sDir, name);
        if (fs.existsSync(p)) {
          packagePath = p;
          break;
        }
      }
      if (packagePath) break;
    }

    if (!packagePath) {
      return res.status(404).json({ error: `Package ${slug}.ruxt not found in repository.` });
    }

    const targetDir = path.join(agentsDir, slug);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Extract package (validated, no shell)
    try {
      extractArchiveSafely(packagePath, targetDir);

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
      throw new Error(`Failed to extract package: ${extractErr.message}`);
    }

    // Ensure public avatar exists if agent has avatar (.png, .jpg, .svg)
    const installedAvatar = copyLocalAvatarIfPresent(targetDir, slug) || resolveAgentAvatar(slug);

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
      installedAvatar || resolveAgentAvatar(slug),
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

// 5. Build, install and package a new custom agent
router.post('/build-agent', (req, res) => {
  try {
    const {
      name,
      slug: rawSlug,
      role,
      headline,
      category,
      bio,
      persona,
      skills = [],
      permissions = [],
      avatarPreset,
      avatarBase64,
      hasCustomUi,
      uiTitle,
      customUiHtml
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Agent name is required' });
    }

    let slug = rawSlug ? rawSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') : name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    slug = slug.replace(/^-+|-+$/g, '');
    if (!slug) slug = `agent-${Date.now()}`;

    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid agent slug identifier' });
    }

    const targetDir = path.join(agentsDir, slug);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. Write persona agent.md
    const personaContent = persona && persona.trim() 
      ? persona.trim() 
      : `# ${name} - ${role || 'Specialist'}\n\nYou are ${name}, a highly skilled ${role || 'AI specialist'}.\n\n## Core Objectives\n- ${headline || 'Execute specialized tasks efficiently and accurately.'}\n- Deliver high quality results with detailed explanations.`;
    fs.writeFileSync(path.join(targetDir, 'agent.md'), personaContent, 'utf8');

    // 2. Write README.md
    const skillList = Array.isArray(skills) ? skills : [];
    const readmeContent = `# ${name}\n\n**Role:** ${role || 'AI Specialist'}\n**Category:** ${category || 'Custom'}\n\n${bio || headline || ''}\n\n### Skills\n${skillList.map(s => `- ${s}`).join('\n')}`;
    fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent, 'utf8');

    // 3. Handle avatar
    if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
    const targetAvatar = path.join(targetDir, 'avatar.png');
    const publicAvatar = path.join(avatarsDir, `${slug}.png`);

    if (avatarBase64 && typeof avatarBase64 === 'string' && avatarBase64.length > 20) {
      try {
        const base64Data = avatarBase64.includes(';base64,')
          ? avatarBase64.split(';base64,').pop()
          : avatarBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(targetAvatar, imageBuffer);
        fs.writeFileSync(publicAvatar, imageBuffer);
      } catch (imgErr) {
        console.error('Failed to save avatarBase64 on build:', imgErr);
      }
    } else if (avatarPreset) {
      const presetFile = path.basename(avatarPreset);
      const presetPath = path.join(avatarsDir, presetFile);
      if (fs.existsSync(presetPath)) {
        if (presetPath !== targetAvatar) fs.copyFileSync(presetPath, targetAvatar);
        if (presetPath !== publicAvatar) fs.copyFileSync(presetPath, publicAvatar);
      } else {
        const fallback = path.join(appRootDir, 'public', 'ruxt-logo.png');
        if (fs.existsSync(fallback)) {
          if (fallback !== targetAvatar) fs.copyFileSync(fallback, targetAvatar);
          if (fallback !== publicAvatar) fs.copyFileSync(fallback, publicAvatar);
        }
      }
    } else {
      const fallback = path.join(appRootDir, 'public', 'ruxt-logo.png');
      if (fs.existsSync(fallback)) {
        if (fallback !== targetAvatar) fs.copyFileSync(fallback, targetAvatar);
        if (fallback !== publicAvatar) fs.copyFileSync(fallback, publicAvatar);
      }
    }

    // 4. Skills directory
    if (skillList.length > 0) {
      const skillsDir = path.join(targetDir, 'skills');
      if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir, { recursive: true });
      skillList.forEach((skillName, idx) => {
        const skillSlug = String(skillName).toLowerCase().replace(/[^a-z0-9_-]/g, '-') || `skill-${idx + 1}`;
        const skillFolder = path.join(skillsDir, skillSlug);
        if (!fs.existsSync(skillFolder)) fs.mkdirSync(skillFolder, { recursive: true });
        fs.writeFileSync(path.join(skillFolder, 'SKILL.md'), `# Skill: ${skillName}\n\nSpecialized instructions and execution rules for ${skillName}.`, 'utf8');
      });
    }

    // 5. Custom UI Setup
    let uiEntry = '';
    const cleanUiTitle = (uiTitle || '').trim() || `${name} Interface`;
    if (hasCustomUi && customUiHtml && customUiHtml.trim()) {
      const uiDir = path.join(targetDir, 'ui');
      if (!fs.existsSync(uiDir)) fs.mkdirSync(uiDir, { recursive: true });
      fs.writeFileSync(path.join(uiDir, 'index.html'), customUiHtml.trim(), 'utf8');
      uiEntry = `/agents/${slug}/ui/index.html`;
    }

    // 6. Write manifest.json
    const manifest = {
      format: 'ruxt-agent-package/v2',
      slug,
      name,
      role: role || 'AI Specialist',
      headline: headline || role || 'Custom Specialist',
      description: bio || headline || `Custom persona for ${name}`,
      category: category || 'Custom & Community',
      experience: 'Specialist',
      isCustom: true,
      rating: 5.0,
      reviews: 1,
      version: '1.0.0',
      permissions: Array.isArray(permissions) ? permissions : [],
      skills: skillList,
      agent: {
        name,
        role: role || 'AI Specialist',
        persona: 'agent.md',
        avatar: 'avatar.png'
      }
    };

    if (hasCustomUi && uiEntry) {
      manifest.ui = {
        type: 'custom',
        entry: 'ui/index.html',
        title: cleanUiTitle
      };
      manifest.uiEntry = 'ui/index.html';
    }

    fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    // 7. Generate .ruxt package file (includes ui/ directory)
    let packageCreated = false;
    try {
      packAgent(slug);
      packageCreated = true;
    } catch (packErr) {
      console.warn('Could not immediately pack agent:', packErr.message);
    }

    // 8. Upsert into database
    db.prepare(`
      INSERT INTO agents (id, name, slug, role, description, version, avatar, ui_entry, manifest)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name,
        role = excluded.role,
        description = excluded.description,
        avatar = excluded.avatar,
        ui_entry = excluded.ui_entry,
        manifest = excluded.manifest
    `).run(
      slug,
      name,
      slug,
      role || 'AI Specialist',
      manifest.description,
      '1.0.0',
      `/agent-avatars/${slug}.png`,
      uiEntry,
      JSON.stringify(manifest)
    );

    // 8. Log activity
    db.prepare(`
      INSERT INTO activity_logs (type, message, details)
      VALUES ('create', ?, ?)
    `).run(`Built and published custom agent: ${name}`, JSON.stringify({ slug, role, category }));

    // Invalidate agents cache
    invalidateAgentsCache();

    res.json({
      success: true,
      message: `Agent ${name} created and packaged successfully!`,
      agent: {
        slug,
        name,
        role: role || 'AI Specialist',
        category: category || 'Custom & Community',
        avatar: `/agent-avatars/${slug}.png`,
        packageCreated,
        downloadUrl: `/api/marketplace/download/${slug}`
      }
    });
  } catch (err) {
    console.error('Build agent error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Import .ruxt package from Base64 or uploaded file
router.post('/import-package', (req, res) => {
  try {
    const { fileBase64, fileName } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ error: 'No package file provided' });
    }

    const cleanBase64 = fileBase64.includes(';base64,') ? fileBase64.split(';base64,').pop() : fileBase64;
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    let baseName = (fileName || 'imported-agent.ruxt').replace(/\.(ruxt|🔰|zip)$/i, '');
    let slug = baseName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || `agent-${Date.now()}`;

    if (!fs.existsSync(packagesDir)) fs.mkdirSync(packagesDir, { recursive: true });
    const savedPackagePath = path.join(packagesDir, `${slug}.ruxt`);
    fs.writeFileSync(savedPackagePath, buffer);

    let targetDir = path.join(agentsDir, slug);
    const createdDir = !fs.existsSync(targetDir);
    if (createdDir) fs.mkdirSync(targetDir, { recursive: true });

    // Extract package
    try {
      extractArchiveSafely(savedPackagePath, targetDir);
    } catch (extractErr) {
      // Don't keep an untrusted/invalid package or a half-created agent folder around
      try { fs.rmSync(savedPackagePath, { force: true }); } catch (_) {}
      if (createdDir) { try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch (_) {} }
      return res.status(400).json({ success: false, error: `Failed to extract package: ${extractErr.message}` });
    }

    // Check nested directory (handles cases where archive has top-level folder or filename has " (1)")
    let nestedDir = path.join(targetDir, slug);
    if (!fs.existsSync(nestedDir)) {
      try {
        const subdirs = fs.readdirSync(targetDir).filter(f => {
          try { return fs.statSync(path.join(targetDir, f)).isDirectory(); } catch (_) { return false; }
        });
        for (const sub of subdirs) {
          const cand = path.join(targetDir, sub);
          if (fs.existsSync(path.join(cand, 'manifest.json')) || fs.existsSync(path.join(cand, 'agent.md'))) {
            nestedDir = cand;
            break;
          }
        }
      } catch (_) {}
    }

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

    // Read manifest
    let manifest = {};
    const manifestPath = path.join(targetDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (_) {}
    }

    // Canonical slug resolution (manifest.slug takes priority over raw filename)
    if (manifest.slug && typeof manifest.slug === 'string') {
      const canonicalSlug = manifest.slug.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
      if (canonicalSlug && canonicalSlug !== slug) {
        const canonicalTarget = path.join(agentsDir, canonicalSlug);
        if (fs.existsSync(canonicalTarget)) {
          try { fs.rmSync(canonicalTarget, { recursive: true, force: true }); } catch (_) {}
        }
        try {
          fs.renameSync(targetDir, canonicalTarget);
          slug = canonicalSlug;
          targetDir = canonicalTarget;
        } catch (_) {}
      }
    }

    const agentName = manifest.name || slug;
    const agentRole = manifest.role || 'Specialist Agent';
    const description = manifest.description || manifest.headline || `Imported agent ${agentName}`;

    // Handle avatar
    const localAvatar = path.join(targetDir, 'avatar.png');
    if (fs.existsSync(localAvatar)) {
      if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
      fs.copyFileSync(localAvatar, path.join(avatarsDir, `${slug}.png`));
    }

    // Discover Custom UI if packaged
    let uiEntry = '';
    const uiCandidates = [
      manifest.ui?.entry,
      manifest.uiEntry,
      'ui/index.html',
      'ui/board.html',
      'index.html'
    ].filter(Boolean);
    for (const uRel of uiCandidates) {
      if (fs.existsSync(path.join(targetDir, uRel))) {
        uiEntry = `/agents/${slug}/${uRel}`;
        break;
      }
    }

    // Upsert into DB
    db.prepare(`
      INSERT INTO agents (id, name, slug, role, description, version, avatar, ui_entry, manifest)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name,
        role = excluded.role,
        description = excluded.description,
        avatar = excluded.avatar,
        ui_entry = excluded.ui_entry,
        manifest = excluded.manifest
    `).run(
      manifest.id || slug,
      agentName,
      slug,
      agentRole,
      description,
      manifest.version || '1.0.0',
      resolveAgentAvatar(slug),
      uiEntry,
      JSON.stringify(manifest)
    );

    db.prepare(`
      INSERT INTO activity_logs (type, message, details)
      VALUES ('import', ?, ?)
    `).run(`Imported custom agent package: ${agentName}`, JSON.stringify({ slug, fileName }));

    invalidateAgentsCache();

    res.json({
      success: true,
      message: `Successfully imported ${agentName}!`,
      agent: {
        slug,
        name: agentName,
        role: agentRole,
        avatar: `/agent-avatars/${slug}.png`
      }
    });
  } catch (err) {
    console.error('Import package error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Get full editable details of an agent (for Skill Up & Edit)
router.get('/agent-details/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Invalid agent slug identifier' });
    }

    let targetDir = path.join(agentsDir, slug);
    if (!fs.existsSync(targetDir) && fs.existsSync(path.join(bundledAgentsDir, slug))) {
      targetDir = path.join(bundledAgentsDir, slug);
    }
    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: `Agent ${slug} not found` });
    }

    // Read manifest
    let manifest = {};
    const manifestPath = path.join(targetDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (_) {}
    }

    // Read agent.md (system prompt/persona)
    let persona = '';
    const agentMdPath = path.join(targetDir, 'agent.md');
    if (fs.existsSync(agentMdPath)) {
      persona = fs.readFileSync(agentMdPath, 'utf8');
    }

    // Discover skills
    let skills = Array.isArray(manifest.skills) ? [...manifest.skills] : [];
    const skillsDir = path.join(targetDir, 'skills');
    if (fs.existsSync(skillsDir)) {
      const skillEntries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const se of skillEntries) {
        if (se.isDirectory()) {
          const formattedName = se.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          if (!skills.includes(formattedName) && !skills.includes(se.name)) {
            skills.push(formattedName);
          }
        }
      }
    }

    // Custom UI
    let hasCustomUi = false;
    let uiTitle = manifest.ui?.title || '';
    let customUiHtml = '';
    const uiCandidates = ['ui/index.html', 'ui/board.html', 'index.html'];
    for (const uRel of uiCandidates) {
      const uPath = path.join(targetDir, uRel);
      if (fs.existsSync(uPath)) {
        hasCustomUi = true;
        try {
          customUiHtml = fs.readFileSync(uPath, 'utf8');
        } catch (_) {}
        break;
      }
    }

    const agentName = manifest.name || slug;
    const agentRole = manifest.role || 'Specialist Agent';
    const headline = manifest.headline || manifest.description || '';
    const bio = manifest.description || '';
    const category = manifest.category || 'Engineering';
    const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : ['filesystem:read'];
    const version = manifest.version || '1.0.0';
    const avatar = fs.existsSync(path.join(avatarsDir, `${slug}.png`)) 
      ? `/agent-avatars/${slug}.png` 
      : `/agents/${slug}/avatar.png`;

    res.json({
      success: true,
      agent: {
        slug,
        name: agentName,
        role: agentRole,
        headline,
        category,
        bio,
        persona,
        skills,
        permissions,
        hasCustomUi,
        uiTitle,
        customUiHtml,
        avatar,
        version
      }
    });
  } catch (err) {
    console.error('Agent details error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Update and Skill Up an existing agent
router.post('/update-agent', (req, res) => {
  try {
    const {
      slug,
      name,
      role,
      headline,
      category,
      bio,
      persona,
      skills = [],
      permissions = [],
      avatarPreset,
      avatarBase64,
      hasCustomUi,
      uiTitle,
      customUiHtml
    } = req.body;

    if (!slug || !isValidSlug(slug)) {
      return res.status(400).json({ error: 'Valid agent slug identifier is required' });
    }

    let targetDir = path.join(agentsDir, slug);
    if (!fs.existsSync(targetDir) && fs.existsSync(path.join(bundledAgentsDir, slug))) {
      try {
        fs.cpSync(path.join(bundledAgentsDir, slug), targetDir, { recursive: true });
      } catch (cpErr) {
        console.warn(`Could not seed ${slug} from bundled agents:`, cpErr.message);
      }
    }
    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: `Agent ${slug} not found for updating` });
    }

    // 1. Update persona agent.md
    if (persona && persona.trim()) {
      fs.writeFileSync(path.join(targetDir, 'agent.md'), persona.trim(), 'utf8');
    }

    // 2. Update README.md
    const skillList = Array.isArray(skills) ? skills : [];
    const readmeContent = `# ${name || slug}\n\n**Role:** ${role || 'AI Specialist'}\n**Category:** ${category || 'Custom'}\n\n${bio || headline || ''}\n\n### Skills\n${skillList.map(s => `- ${s}`).join('\n')}`;
    fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent, 'utf8');

    // 3. Update avatar if provided
    if (avatarBase64 && typeof avatarBase64 === 'string' && avatarBase64.length > 20) {
      if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
      const targetAvatar = path.join(targetDir, 'avatar.png');
      const publicAvatar = path.join(avatarsDir, `${slug}.png`);
      try {
        const base64Data = avatarBase64.includes(';base64,')
          ? avatarBase64.split(';base64,').pop()
          : avatarBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(targetAvatar, imageBuffer);
        fs.writeFileSync(publicAvatar, imageBuffer);
      } catch (imgErr) {
        console.error('Failed to update avatarBase64 on update:', imgErr);
      }
    } else if (avatarPreset) {
      const presetFile = path.basename(avatarPreset);
      const presetPath = path.join(avatarsDir, presetFile);
      const targetAvatar = path.join(targetDir, 'avatar.png');
      const publicAvatar = path.join(avatarsDir, `${slug}.png`);
      if (fs.existsSync(presetPath)) {
        if (presetPath !== targetAvatar) fs.copyFileSync(presetPath, targetAvatar);
        if (presetPath !== publicAvatar) fs.copyFileSync(presetPath, publicAvatar);
      }
    }

    // 4. Synchronize Skills directory (create folders/SKILL.md for newly acquired skills)
    if (skillList.length > 0) {
      const skillsDir = path.join(targetDir, 'skills');
      if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir, { recursive: true });
      skillList.forEach((skillName, idx) => {
        const skillSlug = String(skillName).toLowerCase().replace(/[^a-z0-9_-]/g, '-') || `skill-${idx + 1}`;
        const skillFolder = path.join(skillsDir, skillSlug);
        if (!fs.existsSync(skillFolder)) {
          fs.mkdirSync(skillFolder, { recursive: true });
          fs.writeFileSync(path.join(skillFolder, 'SKILL.md'), `# Skill: ${skillName}\n\nSpecialized instructions and execution rules for ${skillName}.`, 'utf8');
        }
      });
    }

    // 5. Custom UI Setup
    let uiEntry = '';
    const cleanUiTitle = (uiTitle || '').trim() || `${name || slug} Interface`;
    if (hasCustomUi && customUiHtml && customUiHtml.trim()) {
      const uiDir = path.join(targetDir, 'ui');
      if (!fs.existsSync(uiDir)) fs.mkdirSync(uiDir, { recursive: true });
      fs.writeFileSync(path.join(uiDir, 'index.html'), customUiHtml.trim(), 'utf8');
      uiEntry = `/agents/${slug}/ui/index.html`;
    }

    // 6. Read existing manifest to preserve fields and bump version
    let manifest = {};
    const manifestPath = path.join(targetDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (_) {}
    }

    // Bump version (e.g., 1.0.0 -> 1.1.0 or 1.1 -> 1.2)
    const oldVersion = manifest.version || '1.0.0';
    const vParts = oldVersion.split('.').map(n => parseInt(n, 10) || 0);
    if (vParts.length >= 2) {
      vParts[1] = (vParts[1] || 0) + 1;
    } else {
      vParts.push(1);
    }
    const newVersion = vParts.join('.');

    manifest = {
      ...manifest,
      format: manifest.format || 'ruxt-agent-package/v2',
      slug,
      name: name || manifest.name || slug,
      role: role || manifest.role || 'AI Specialist',
      headline: headline || role || manifest.headline,
      description: bio || headline || manifest.description,
      category: category || manifest.category || 'Engineering',
      version: newVersion,
      permissions: Array.isArray(permissions) ? permissions : (manifest.permissions || []),
      skills: skillList,
      agent: {
        ...(manifest.agent || {}),
        name: name || manifest.name || slug,
        role: role || manifest.role || 'AI Specialist',
        persona: 'agent.md',
        avatar: 'avatar.png'
      }
    };

    if (hasCustomUi && uiEntry) {
      manifest.ui = {
        type: 'custom',
        entry: 'ui/index.html',
        title: cleanUiTitle
      };
      manifest.uiEntry = 'ui/index.html';
    } else if (hasCustomUi === false) {
      delete manifest.ui;
      delete manifest.uiEntry;
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    // 7. Re-generate .ruxt package archive
    let packageCreated = false;
    try {
      packAgent(slug);
      packageCreated = true;
    } catch (packErr) {
      console.warn('Could not re-pack agent:', packErr.message);
    }

    // 8. Upsert into database
    db.prepare(`
      INSERT INTO agents (id, name, slug, role, description, version, avatar, ui_entry, manifest)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name,
        role = excluded.role,
        description = excluded.description,
        avatar = excluded.avatar,
        version = excluded.version,
        ui_entry = excluded.ui_entry,
        manifest = excluded.manifest
    `).run(
      manifest.id || slug,
      manifest.name,
      slug,
      manifest.role,
      manifest.description,
      newVersion,
      `/agent-avatars/${slug}.png`,
      uiEntry,
      JSON.stringify(manifest)
    );

    // 9. Log activity
    db.prepare(`
      INSERT INTO activity_logs (type, message, details)
      VALUES ('skillup', ?, ?)
    `).run(`Skilled up specialist: ${manifest.name} (v${newVersion})`, JSON.stringify({ slug, version: newVersion, skillsCount: skillList.length }));

    invalidateAgentsCache();

    res.json({
      success: true,
      message: `Successfully updated and skilled up ${manifest.name} to v${newVersion}!`,
      agent: {
        slug,
        name: manifest.name,
        role: manifest.role,
        category: manifest.category,
        version: newVersion,
        avatar: `/agent-avatars/${slug}.png`,
        uiEntry,
        packageCreated,
        downloadUrl: `/api/marketplace/download/${slug}`
      }
    });
  } catch (err) {
    console.error('Update agent error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
