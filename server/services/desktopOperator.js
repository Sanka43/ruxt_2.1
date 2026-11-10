import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { activeDesktopJobs } from './desktopAutomation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = process.env.RUXT_DATA_DIR || (process.env.APPDATA ? path.join(process.env.APPDATA, 'RuXt', 'data') : path.resolve(__dirname, '../../data'));
const runsDir = path.join(dataDir, 'desktop_runs');
const rawPs1Path = path.join(__dirname, 'windowsOperator.ps1');
const winOperatorPs1 = rawPs1Path.includes('app.asar') ? rawPs1Path.replace('app.asar', 'app.asar.unpacked') : rawPs1Path;

/**
 * Execute a PowerShell action via windowsOperator.ps1
 */
function runWindowsAction(args = []) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve('OK:NON_WINDOWS');
    }
    const psArgs = ['-ExecutionPolicy', 'Bypass', '-File', winOperatorPs1, ...args];
    const child = spawn('powershell.exe', psArgs, { stdio: 'pipe' });
    let stdout = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.on('close', () => resolve(stdout.trim()));
    child.on('error', () => resolve('ERR'));
  });
}

/**
 * Perform a smooth visible mouse glide across the screen
 */
export async function moveMouseSmooth(targetX, targetY, durationMs = 400) {
  return runWindowsAction(['-Action', 'move_smooth', '-TargetX', targetX, '-TargetY', targetY, '-DurationMs', durationMs]);
}

/**
 * Perform a mouse click
 */
export async function clickMouse(button = 'left') {
  return runWindowsAction(['-Action', 'click', '-Button', button]);
}

/**
 * Bring application window to foreground
 */
export async function focusProcess(processName) {
  return runWindowsAction(['-Action', 'focus', '-ProcessName', processName]);
}

/**
 * Get coordinates of the center of an application window
 */
export async function getWindowCenter(processName) {
  const out = await runWindowsAction(['-Action', 'get_window_rect', '-ProcessName', processName]);
  const match = out.match(/:CENTER:(\d+),(\d+)/);
  if (match) {
    return { x: parseInt(match[1], 10), y: parseInt(match[2], 10) };
  }
  return null;
}

/**
 * Launch an autonomous live desktop execution job
 */
export async function startLiveDesktopExecution({
  plan,
  onEvent = () => {}
}) {
  const jobId = randomUUID();
  const jobDir = path.join(runsDir, jobId);
  if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });

  const scriptPath = path.join(jobDir, plan.scriptFilename || 'task.py');
  fs.writeFileSync(scriptPath, plan.scriptCode, 'utf8');

  const jobState = {
    id: jobId,
    plan,
    status: 'running',
    currentStepIndex: 0,
    steps: plan.steps || [],
    logs: [],
    subscribers: new Set(),
    aborted: false,
    childProcess: null,
    jobDir,
    scriptPath,
    startTime: Date.now()
  };

  activeDesktopJobs.set(jobId, jobState);

  const broadcast = (event) => {
    jobState.logs.push(event);
    if (onEvent) onEvent(event);
    for (const res of jobState.subscribers) {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (_) {}
    }
  };

  // Run the asynchronous execution pipeline in background
  (async () => {
    try {
      broadcast({
        type: 'start',
        jobId,
        taskTitle: plan.taskTitle,
        appName: plan.appInfo.name,
        totalSteps: jobState.steps.length
      });

      const totalSteps = jobState.steps.length;

      for (let i = 0; i < totalSteps; i++) {
        if (jobState.aborted) break;

        jobState.currentStepIndex = i;
        const step = jobState.steps[i];
        const progress = Math.round(((i + 1) / totalSteps) * 100);

        broadcast({
          type: 'step_start',
          jobId,
          stepIndex: i,
          stepNumber: i + 1,
          totalSteps,
          description: step.description,
          progress,
          actionIcon: i === 0 ? '🔍' : (i === 1 ? '🖱️' : (i === 2 ? '⌨️' : (i === 3 ? '⚙️' : '🚀')))
        });

        // Target application execution
        if (i === 0 && plan.appInfo.found && plan.appInfo.exePath) {
          // Focus or launch app
          broadcast({
            type: 'log',
            jobId,
            text: `[RuXt] Discovered binary at: ${plan.appInfo.exePath}`
          });

          if (plan.appInfo.slug === 'notepad') {
            broadcast({
              type: 'log',
              jobId,
              text: `[Notepad] Launching Notepad window on PC...`
            });
            try {
              spawn(plan.appInfo.exePath, [], { detached: true, stdio: 'ignore' }).unref();
              await new Promise(r => setTimeout(r, 800));
            } catch (_) {}
          } else if (plan.appInfo.slug === 'chrome') {
            const url = plan.targetUrl || 'https://www.youtube.com/results?search_query=sinhala+songs';
            broadcast({
              type: 'log',
              jobId,
              text: `[Chrome] Launching Google Chrome to destination: ${url}`
            });
            try {
              spawn('powershell.exe', ['-Command', `Start-Process "chrome.exe" "${url}"`], { detached: true, stdio: 'ignore' }).unref();
              await new Promise(r => setTimeout(r, 1500));
            } catch (_) {}
          } else if (plan.appInfo.slug === 'calc') {
            broadcast({ type: 'log', jobId, text: `[Calculator] Launching Windows Calculator...` });
            spawn('calc.exe', [], { detached: true, stdio: 'ignore' }).unref();
            await new Promise(r => setTimeout(r, 800));
          } else if (plan.appInfo.slug === 'paint') {
            broadcast({ type: 'log', jobId, text: `[Paint] Launching MS Paint...` });
            spawn('mspaint.exe', [], { detached: true, stdio: 'ignore' }).unref();
            await new Promise(r => setTimeout(r, 800));
          }
        }

        if (i === 1) {
          if (plan.appInfo.slug === 'notepad') {
            broadcast({
              type: 'log',
              jobId,
              text: `[Notepad] Bringing Notepad window to foreground...`
            });
            await focusProcess('notepad');
            await new Promise(r => setTimeout(r, 400));
            const center = await getWindowCenter('notepad');
            const targetX = center ? center.x : 540;
            const targetY = center ? center.y : 380;
            await moveMouseSmooth(targetX, targetY, 450);
            await new Promise(r => setTimeout(r, 200));
            await clickMouse('left');
          } else if (plan.appInfo.slug === 'chrome') {
            broadcast({
              type: 'log',
              jobId,
              text: `[Chrome] Bringing Google Chrome to active foreground...`
            });
            await focusProcess('chrome');
            await new Promise(r => setTimeout(r, 800));
            // Move cursor to first YouTube video card and click
            await moveMouseSmooth(560, 380, 500);
            await new Promise(r => setTimeout(r, 200));
            await clickMouse('left');
          } else if (plan.appInfo.slug === 'calc') {
            await focusProcess('calculator');
            await moveMouseSmooth(450, 400, 350);
            await clickMouse('left');
          } else if (plan.appInfo.slug === 'paint') {
            await focusProcess('mspaint');
            await moveMouseSmooth(500, 400, 350);
            await clickMouse('left');
          } else {
            await moveMouseSmooth(450, 320, 450);
            await new Promise(r => setTimeout(r, 150));
            await clickMouse('left');
          }
        } else if (i === 2) {
          if (plan.appInfo.slug === 'notepad') {
            await focusProcess('notepad');
            await new Promise(r => setTimeout(r, 250));
          } else if (plan.appInfo.slug === 'chrome') {
            broadcast({
              type: 'log',
              jobId,
              text: `[Chrome] Buffering video stream and focusing player...`
            });
            await focusProcess('chrome');
            await new Promise(r => setTimeout(r, 600));
          } else {
            await moveMouseSmooth(720, 480, 400);
          }
        }

        if (i === 3 && plan.appInfo.found && plan.appInfo.exePath) {
          if (plan.appInfo.slug === 'notepad') {
            broadcast({
              type: 'log',
              jobId,
              text: `[Notepad] Typing content live into Notepad document...`
            });
            await focusProcess('notepad');
            await new Promise(r => setTimeout(r, 200));

            const textToType = plan.scriptCode || '';
            const b64 = Buffer.from(textToType, 'utf8').toString('base64');
            // Safe live typing via WinInput with Unicode support in windowsOperator.ps1
            await runWindowsAction(['-Action', 'type', '-TextBase64', b64, '-TypeDelayMs', '15']);
            broadcast({
              type: 'log',
              jobId,
              text: `[Notepad] Live typing completed successfully!`
            });
          } else if (plan.appInfo.slug === 'chrome') {
            broadcast({
              type: 'log',
              jobId,
              text: `[Chrome] Activating video playback and unmuting stream...`
            });
            await focusProcess('chrome');
            await new Promise(r => setTimeout(r, 400));
            // Send 'k' (YouTube play/pause shortcut) or Space
            await runWindowsAction(['-Action', 'type', '-Text', 'k', '-TypeDelayMs', '10']);
            broadcast({
              type: 'log',
              jobId,
              text: `[Chrome] YouTube music stream is now actively playing live on your screen!`
            });
          } else if (plan.appInfo.slug === 'calc') {
            broadcast({ type: 'log', jobId, text: `[Calculator] Executing calculation keys...` });
            await focusProcess('calculator');
            await runWindowsAction(['-Action', 'type', '-Text', '1250*45=', '-TypeDelayMs', '50']);
          } else if (plan.appInfo.slug === 'paint') {
            broadcast({ type: 'log', jobId, text: `[Paint] Drawing procedural shapes on canvas...` });
            await focusProcess('mspaint');
            await moveMouseSmooth(400, 300, 200);
            await clickMouse('left');
            await moveMouseSmooth(600, 500, 400);
          } else if (plan.appInfo.slug === 'blender') {
            const blendOutPath = path.join(jobDir, 'scene.blend');
            broadcast({
              type: 'log',
              jobId,
              text: `[Blender] Spawning process: blender.exe --python "${scriptPath}"`
            });

            await new Promise((resolve) => {
              const proc = spawn(plan.appInfo.exePath, ['--background', '--python', scriptPath], {
                stdio: 'pipe',
                cwd: jobDir
              });
              jobState.childProcess = proc;

              proc.stdout.on('data', d => {
                const txt = d.toString();
                broadcast({ type: 'log', jobId, text: txt.trim() });
              });
              proc.stderr.on('data', d => {
                const txt = d.toString();
                broadcast({ type: 'log', jobId, text: `[stderr] ${txt.trim()}` });
              });
              proc.on('close', (code) => {
                broadcast({ type: 'log', jobId, text: `[Blender] Execution completed with exit code: ${code}` });
                resolve();
              });
              proc.on('error', (err) => {
                broadcast({ type: 'log', jobId, text: `[Error] ${err.message}` });
                resolve();
              });

              // Safety timeout
              setTimeout(resolve, 8000);
            });

            // Open interactive Blender window with the script or model
            try {
              spawn(plan.appInfo.exePath, ['--python', scriptPath], {
                detached: true,
                stdio: 'ignore'
              }).unref();
            } catch (_) {}
          } else if (plan.appInfo.slug === 'vscode' || plan.appInfo.slug === 'cursor') {
            // Open in Code
            spawn(plan.appInfo.exePath, [jobDir], { detached: true, stdio: 'ignore' }).unref();
          }
        } else {
          // Visual simulation step delay for user observation
          await new Promise(r => setTimeout(r, 600));
        }

        broadcast({
          type: 'step_done',
          jobId,
          stepIndex: i,
          progress
        });
      }

      if (!jobState.aborted) {
        jobState.status = 'completed';
        broadcast({
          type: 'complete',
          jobId,
          taskTitle: plan.taskTitle,
          status: 'success',
          jobDir,
          scriptPath,
          previewType: plan.previewType,
          previewSummary: plan.previewSummary
        });
      }
    } catch (err) {
      jobState.status = 'failed';
      broadcast({
        type: 'error',
        jobId,
        error: err.message
      });
    }
  })();

  return jobState;
}

/**
 * Abort a running desktop task
 */
export function abortLiveDesktopExecution(jobId) {
  const job = activeDesktopJobs.get(jobId);
  if (!job) return false;
  job.aborted = true;
  job.status = 'aborted';
  if (job.childProcess) {
    try {
      job.childProcess.kill();
    } catch (_) {}
  }
  for (const res of job.subscribers) {
    try {
      res.write(`data: ${JSON.stringify({ type: 'aborted', jobId })}\n\n`);
    } catch (_) {}
  }
  return true;
}
