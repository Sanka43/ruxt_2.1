import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { 
  findInstalledApplication, 
  synthesizeTaskPlanAndScript, 
  resolveTargetAppFromPrompt,
  activeDesktopJobs 
} from '../services/desktopAutomation.js';
import { 
  startLiveDesktopExecution, 
  abortLiveDesktopExecution 
} from '../services/desktopOperator.js';
import db from '../db.js';

const router = Router();

// 1. Get status of common desktop applications on the host machine
router.get('/apps', (req, res) => {
  try {
    const list = ['blender', 'vscode', 'cursor', 'notepad', 'paint', 'chrome'];
    const apps = list.map(slug => findInstalledApplication(slug));
    res.json({ success: true, apps });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Start a live autonomous desktop execution job
router.post('/execute-live', async (req, res) => {
  try {
    const { userMessage, targetApp, settings = {} } = req.body;
    if (!userMessage) {
      return res.status(400).json({ error: 'userMessage is required' });
    }

    const resolvedApp = targetApp || resolveTargetAppFromPrompt(userMessage);

    // Dynamic AI plan & script synthesis (zero hardcoded files)
    const plan = await synthesizeTaskPlanAndScript({
      userMessage,
      targetApp: resolvedApp,
      settings
    });

    // Start live operator execution
    const job = await startLiveDesktopExecution({ plan });

    res.json({
      success: true,
      jobId: job.id,
      plan: job.plan
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Server-Sent Events (SSE) stream for live step progress and terminal logs
router.get('/stream/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = activeDesktopJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send current cached logs
  for (const log of job.logs) {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  }

  job.subscribers.add(res);

  req.on('close', () => {
    job.subscribers.delete(res);
  });
});

// 4. Abort a running desktop task
router.post('/abort/:jobId', (req, res) => {
  const { jobId } = req.params;
  const success = abortLiveDesktopExecution(jobId);
  res.json({ success });
});

// 5. Open project folder in Windows File Explorer
router.post('/open-explorer', (req, res) => {
  try {
    const { targetPath } = req.body;
    if (targetPath && fs.existsSync(targetPath)) {
      spawn('explorer.exe', [targetPath], { detached: true, stdio: 'ignore' }).unref();
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Path not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Direct launch application
router.post('/launch', (req, res) => {
  try {
    const { appName, args = [] } = req.body;
    const appInfo = findInstalledApplication(appName);
    if (appInfo.found && appInfo.exePath) {
      spawn(appInfo.exePath, args, { detached: true, stdio: 'ignore' }).unref();
      return res.json({ success: true, appInfo });
    }
    res.status(404).json({ error: 'Application not found on system' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
