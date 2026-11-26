import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import settingsRoutes from './routes/settings.js';
import agentsRoutes from './routes/agents.js';
import tasksRoutes from './routes/tasks.js';
import chatRoutes from './routes/chat.js';
import workspaceRoutes from './routes/workspace.js';
import marketplaceRoutes from './routes/marketplace.js';
import boardroomRoutes from './routes/boardroom.js';
import desktopRoutes from './routes/desktop.js';
import gscRoutes from './routes/gsc.js';
import toolApprovalRoutes from './routes/toolApprovals.js';
import { startGscScheduler } from './services/gscScheduler.js';
import { requestGuard, buildAllowedOriginCheck, rateLimit } from './services/requestGuard.js';
import { migrateSecretsToEncrypted } from './services/secretStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRootDir = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 1234;

// Middlewares
const isAllowedOrigin = buildAllowedOriginCheck(PORT);
app.use(requestGuard(PORT));
app.use(cors({
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
}));
// Large bodies only where needed (screenshots, chat images, .ruxt uploads); 5mb everywhere else
const largeJson = express.json({ limit: '50mb' });
app.use(['/api/desktop', '/api/chat', '/api/boardroom', '/api/agents', '/api/marketplace'], largeJson);
app.use(express.json({ limit: '5mb' }));

// Throttle expensive / destructive endpoints
const strictLimit = rateLimit({ windowMs: 60_000, max: 20 });
app.use(['/api/desktop/execute-live', '/api/desktop/execute-vision', '/api/desktop/execute-agent-s', '/api/desktop/launch', '/api/desktop/open-explorer', '/api/marketplace/import-package', '/api/settings/factory-reset', '/api/settings/clear-history'], strictLimit);
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// API Routes
app.use('/api', workspaceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/boardroom', boardroomRoutes);
app.use('/api/desktop', desktopRoutes);
app.use('/api/gsc', gscRoutes);
app.use('/api/tool-approvals', toolApprovalRoutes);

// Static assets directory resolver (handles dev, production asar, and unpacked asar)
function resolveStaticDir(relName) {
  const candidates = [
    path.join(appRootDir, relName),
    path.join(__dirname, '..', relName),
    path.join(__dirname, '../../', relName),
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', relName) : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar', relName) : null,
    process.resourcesPath ? path.join(process.resourcesPath, relName) : null,
    path.join(process.cwd(), relName)
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.join(appRootDir, relName);
}

const publicDir = resolveStaticDir('public');
const distDir = resolveStaticDir('dist');
const agentsDir = resolveStaticDir('agents');

const avatarDirs = [
  path.join(publicDir, 'agent-avatars'),
  path.join(distDir, 'agent-avatars'),
  publicDir,
  distDir
];

// Robust Avatar Resolver: returns image for any requested agent avatar
app.use('/agent-avatars', (req, res, next) => {
  const cleanName = path.basename(req.path);
  for (const d of avatarDirs) {
    if (fs.existsSync(d)) {
      const f1 = path.join(d, cleanName);
      if (fs.existsSync(f1) && fs.statSync(f1).isFile()) return res.sendFile(f1);
      const f2 = path.join(d, req.path);
      if (fs.existsSync(f2) && fs.statSync(f2).isFile()) return res.sendFile(f2);
    }
  }
  // If specific alias requested (e.g. elena-voss-chess -> elena-voss.png)
  if (cleanName.includes('elena-voss')) {
    for (const d of avatarDirs) {
      const f = path.join(d, 'elena-voss.png');
      if (fs.existsSync(f)) return res.sendFile(f);
    }
  }
  // Default fallback logo
  for (const d of [publicDir, distDir]) {
    const fallback = path.join(d, 'ruxt-logo.png');
    if (fs.existsSync(fallback)) return res.sendFile(fallback);
  }
  next();
});

// Map /agents/<slug>/avatar.png to the corresponding avatar file
app.use('/agents', (req, res, next) => {
  if (req.path.includes('avatar.png')) {
    const slug = req.path.split('/').filter(Boolean)[0] || '';
    for (const d of avatarDirs) {
      if (fs.existsSync(d)) {
        const candidate = path.join(d, `${slug}.png`);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return res.sendFile(candidate);
        }
      }
    }
  }
  if (fs.existsSync(agentsDir)) {
    return express.static(agentsDir)(req, res, next);
  }
  next();
});

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// Serve production built frontend if available
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/hub')) {
      res.sendFile(path.join(distDir, 'index.html'));
    }
  });
}

// Start Server
const HOST = process.env.HOST || '127.0.0.1';
try { migrateSecretsToEncrypted(); } catch (e) { console.warn('[RuXt] Secret migration skipped:', e.message); }

const server = app.listen(PORT, HOST, () => {
  console.log(`[RuXt 2.1 Engine] Server running securely on http://${HOST}:${PORT}`);
  console.log(`[RuXt Hub] Marketplace Portal live at http://${HOST}:${PORT}/hub`);
  startGscScheduler();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[RuXt Error] Port ${PORT} is already in use.`);
    process.exit(98); // distinct code: the desktop shell must not restart-loop on this
  } else {
    console.error('[RuXt Error]', err);
    process.exit(1);
  }
});

// Errors that just mean "the other side went away"; the process state is still sound.
const BENIGN_ERROR_CODES = new Set(['EPIPE', 'ECONNRESET', 'ERR_STREAM_DESTROYED', 'ERR_STREAM_WRITE_AFTER_END']);

// A rejected promise (e.g. an AI request timing out) must not take the engine down, but it must be visible.
process.on('unhandledRejection', (reason) => {
  console.error('[RuXt Engine Unhandled Rejection]:', reason instanceof Error ? reason.stack : reason);
});

// After an unknown uncaught exception the process state can't be trusted: log the stack,
// stop accepting connections and exit non-zero so the desktop shell restarts a clean engine.
process.on('uncaughtException', (err) => {
  if (err && BENIGN_ERROR_CODES.has(err.code)) {
    console.warn('[RuXt Engine] Ignored benign error:', err.code, err.message);
    return;
  }
  console.error('[RuXt Engine Uncaught Exception - exiting]:', err instanceof Error ? err.stack : err);
  const force = setTimeout(() => process.exit(1), 3000);
  force.unref();
  server.close(() => process.exit(1));
});

export default app;
