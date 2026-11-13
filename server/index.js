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
import { startGscScheduler } from './services/gscScheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRootDir = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 1234;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// Static assets
const publicDir = path.join(appRootDir, 'public');
const distDir = path.join(appRootDir, 'dist');
const agentsDir = path.join(appRootDir, 'agents');

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
const server = app.listen(PORT, HOST, () => {
  console.log(`[RuXt 2.1 Engine] Server running securely on http://${HOST}:${PORT}`);
  console.log(`[RuXt Hub] Marketplace Portal live at http://${HOST}:${PORT}/hub`);
  startGscScheduler();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[RuXt Error] Port ${PORT} is already in use.`);
  } else {
    console.error('[RuXt Error]', err);
  }
});

// Guard against unexpected unhandled exceptions / AI timeout crashes
process.on('uncaughtException', (err) => {
  console.error('[RuXt Engine Uncaught Exception]:', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[RuXt Engine Unhandled Rejection]:', reason?.message || reason);
});

export default app;
