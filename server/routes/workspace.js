import { Router } from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';
import db from '../db.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json({
    status: 'online',
    version: '2.1.0',
    mode: process.env.NODE_ENV || 'production',
    uptime: process.uptime(),
    port: 1234,
    platform: process.platform,
    arch: process.arch
  });
});

router.get('/workspace', (req, res) => {
  try {
    const agentsCount = db.prepare('SELECT COUNT(*) as count FROM agents').get().count;
    const tasksCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
    const chatCount = db.prepare('SELECT COUNT(*) as count FROM chat_sessions').get().count;

    res.json({
      success: true,
      workspace: {
        root: process.cwd(),
        name: path.basename(process.cwd()),
        platform: os.platform(),
        memory: {
          free: Math.round(os.freemem() / 1024 / 1024) + ' MB',
          total: Math.round(os.totalmem() / 1024 / 1024) + ' MB'
        },
        stats: {
          agents: agentsCount,
          tasks: tasksCount,
          conversations: chatCount
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/tools', (req, res) => {
  res.json({
    success: true,
    tools: [
      { id: 'ruxt_engine', name: 'RuXt Engine 2.1', status: 'connected', ready: true },
      { id: 'sqlite', name: 'SQLite Storage', status: 'connected', ready: true },
      { id: 'ai_bridge', name: 'AI API Bridge', status: 'ready', ready: true }
    ]
  });
});

export default router;
