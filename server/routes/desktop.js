import { Router } from 'express';
import { spawn } from 'child_process';
import { isMaskedSecret } from '../services/secrets.js';
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
import { 
  startVisionDesktopExecution, 
  stopScreenBorder,
  setAiCursor,
  resumeVisionDesktopJob
} from '../services/visionComputerUse.js';
import { generateAIResponse } from '../services/aiProvider.js';
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

/**
 * Intelligent Speed-Based AI Priority Cascade:
 * Priority 1: Google Gemini 2.0 Flash (Ultra-fast direct API ~0.8s)
 * Priority 2: OpenAI GPT-4o-mini (Fast direct API ~1.2s)
 * Priority 3: Custom / User explicitly chosen active_provider
 * Priority 4: Zero-API Local Antigravity Host (Fallback ~6s-30s)
 */
export function resolveFastestProvider(explicitProvider = null, explicitModel = null, explicitApiKey = null) {
  let settings = {};
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    for (const r of rows) settings[r.key] = r.value;
  } catch (_) {}

  // 1. Explicit provider override
  if (explicitProvider) {
    const resolvedKey = (isMaskedSecret(explicitApiKey) ? '' : explicitApiKey) || settings[`${explicitProvider}_api_key`] || '';
    return {
      provider: explicitProvider,
      model: explicitModel || settings[`${explicitProvider}_model`] || (explicitProvider === 'gemini' ? 'gemini-2.0-flash' : explicitProvider === 'openai' ? 'gpt-4o-mini' : 'flash'),
      apiKey: resolvedKey,
      settings
    };
  }

  // Priority 1: Gemini 2.0 / 3.5 Flash (Fastest)
  const geminiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey && geminiKey.trim().length > 10) {
    return {
      provider: 'gemini',
      model: settings.gemini_model || 'gemini-3.5-flash',
      apiKey: geminiKey.trim(),
      settings
    };
  }

  // Priority 2: Anthropic Claude 3.5/3.7 Sonnet Computer Use
  const anthropicKey = settings.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && anthropicKey.trim().length > 10) {
    return {
      provider: 'anthropic',
      model: settings.anthropic_model || 'claude-3-5-sonnet-20241022',
      apiKey: anthropicKey.trim(),
      settings
    };
  }

  // Priority 2: OpenAI GPT-4o-mini
  const openaiKey = settings.openai_api_key || process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey.trim().length > 10) {
    return {
      provider: 'openai',
      model: settings.openai_model || 'gpt-4o-mini',
      apiKey: openaiKey.trim(),
      settings
    };
  }

  // Priority 3: Custom active_provider if set
  if (settings.active_provider && settings.active_provider !== 'antigravity') {
    const p = settings.active_provider;
    return {
      provider: p,
      model: settings[`${p}_model`] || 'default',
      apiKey: settings[`${p}_api_key`] || '',
      settings
    };
  }

  // Priority 4: Zero-API Local Antigravity Fallback
  return {
    provider: 'antigravity',
    model: settings.antigravity_model || 'flash',
    apiKey: '',
    settings
  };
}

// 1b. Multimodal vision prompt with Speed-Based Priority Ladder (Gemini 2.0 Flash first, Antigravity fallback)
router.post('/vision-prompt', async (req, res) => {
  try {
    const userPrompt = req.body.userPrompt || req.body.prompt;
    const systemPrompt = req.body.systemPrompt || req.body.system || '';
    const imageBase64 = req.body.imageBase64 || req.body.image || null;

    if (!userPrompt) {
      return res.status(400).json({ error: 'userPrompt is required' });
    }

    const fastest = resolveFastestProvider(req.body.provider, req.body.model, req.body.apiKey);

    const aiRes = await generateAIResponse({
      provider: fastest.provider,
      model: fastest.model,
      apiKey: fastest.apiKey,
      systemPrompt,
      userMessage: userPrompt,
      images: imageBase64 ? [imageBase64] : [],
      settings: fastest.settings
    });

    res.json({
      success: true,
      content: aiRes.content,
      model: aiRes.model,
      provider: aiRes.provider
    });
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

// 2b. Start an autonomous vision-based computer use task
router.post('/execute-vision', async (req, res) => {
  try {
    const { goal, settings = {}, sessionId = null } = req.body;
    if (!goal) {
      return res.status(400).json({ error: 'goal is required' });
    }

    const job = await startVisionDesktopExecution({
      goal,
      settings,
      sessionId
    });

    res.json({
      success: true,
      jobId: job.id,
      goal: job.goal,
      steps: job.steps,
      taskContract: job.taskContract
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2c. Start autonomous Agent-S Vision Desktop execution
router.post('/execute-agent-s', async (req, res) => {
  try {
    const { goal, provider, model, apiKey, baseUrl, cursorMode, maxSteps = 25 } = req.body;
    if (!goal) {
      return res.status(400).json({ error: 'goal is required' });
    }

    const { randomUUID } = await import('crypto');
    const jobId = randomUUID();
    let scriptPath = path.resolve(__dirname, '../../RuXt-AI-Vision-Desktop/run_agent.py');
    if (scriptPath.includes('app.asar')) {
      scriptPath = scriptPath.replace('app.asar', 'app.asar.unpacked');
    }

    const jobState = {
      id: jobId,
      goal,
      appName: 'AGENT-S VISION',
      status: 'running',
      steps: [],
      logs: [],
      subscribers: new Set(),
      childProcess: null,
      startTime: Date.now()
    };

    activeDesktopJobs.set(jobId, jobState);

    const fastest = resolveFastestProvider(provider, model, apiKey);

    const args = ['--task', goal, '--json', '--max-steps', String(maxSteps)];
    args.push('--provider', fastest.provider);
    args.push('--model', fastest.model);
    if (fastest.apiKey) args.push('--api-key', fastest.apiKey);
    if (baseUrl) args.push('--base-url', baseUrl);
    if (cursorMode) args.push('--cursor-mode', cursorMode);

    const pythonBin = process.platform === 'win32' ? 'python.exe' : 'python3';
    const child = spawn(pythonBin, [scriptPath, ...args], {
      cwd: path.dirname(scriptPath),
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    jobState.childProcess = child;

    const broadcast = (event) => {
      jobState.logs.push(event);
      for (const sub of jobState.subscribers) {
        try {
          sub.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch (_) {}
      }
    };

    let buffer = '';
    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep unfinished line in buffer
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line.trim());
          broadcast({ type: 'agent_s_event', jobId, ...parsed });
          if (parsed.event === 'finish') {
            jobState.status = parsed.success ? 'completed' : 'failed';
          }
        } catch (_) {
          broadcast({ type: 'log', jobId, text: line.trim() });
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      const errTxt = chunk.toString().trim();
      if (errTxt) {
        broadcast({ type: 'log', jobId, text: `[agent-s stderr] ${errTxt}` });
      }
    });

    child.on('close', (code) => {
      jobState.childProcess = null;
      if (jobState.status === 'running') {
        jobState.status = code === 0 ? 'completed' : 'failed';
      }
      broadcast({ type: 'complete', jobId, status: jobState.status, exitCode: code });
    });

    child.on('error', (err) => {
      jobState.status = 'failed';
      broadcast({ type: 'error', jobId, error: err.message });
    });

    res.json({
      success: true,
      jobId,
      goal,
      engine: 'Agent-S'
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
  stopScreenBorder();
  setAiCursor(false);
  res.json({ success });
});

// 4b. Emergency stop all running desktop / vision tasks
router.post('/abort-active', (req, res) => {
  let count = 0;
  for (const [id, job] of activeDesktopJobs.entries()) {
    if (job.status !== 'completed' && job.status !== 'aborted') {
      abortLiveDesktopExecution(id);
      count++;
    }
  }
  // Even if activeDesktopJobs map had no running job, ensure signals and cursor are cleared
  abortLiveDesktopExecution('emergency_all');
  stopScreenBorder();
  setAiCursor(false);
  res.json({ success: true, abortedCount: count });
});

// 4c. Get status of running desktop task for UI indicator
router.get('/active-status', (req, res) => {
  let activeJob = null;
  for (const [id, job] of activeDesktopJobs.entries()) {
    if (job.status === 'running') {
      activeJob = { id, goal: job.goal, appName: job.appName || 'PC Task' };
      break;
    }
  }
  res.json({ active: !!activeJob, job: activeJob });
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

// 7. Human-in-the-Loop: Resume autonomous execution after user takeover
router.post('/resume', (req, res) => {
  try {
    const { jobId } = req.body || {};
    const success = resumeVisionDesktopJob(jobId);
    res.json({ success, message: 'Resume signal dispatched' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
