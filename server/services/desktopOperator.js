import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { activeDesktopJobs } from './desktopAutomation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRootDir = path.resolve(__dirname, '../..');
const runsDir = path.join(appRootDir, 'data', 'desktop_runs');
const winOperatorPs1 = path.join(__dirname, 'windowsOperator.ps1');

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
              await new Promise(r => setTimeout(r, 600));
            } catch (_) {}
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
            await new Promise(r => setTimeout(r, 200));
          }
          await moveMouseSmooth(450, 320, 450);
          await new Promise(r => setTimeout(r, 150));
          await clickMouse('left');
        } else if (i === 2) {
          await moveMouseSmooth(720, 480, 400);
        }

        if (i === 3 && plan.appInfo.found && plan.appInfo.exePath) {
          if (plan.appInfo.slug === 'notepad') {
            broadcast({
              type: 'log',
              jobId,
              text: `[Notepad] Typing tasks live into Notepad document...`
            });
            const textToType = plan.scriptCode || '';
            const b64 = Buffer.from(textToType).toString('base64');
            // Safe live typing via base64 in windowsOperator.ps1
            await runWindowsAction(['-Action', 'type', '-TextBase64', b64, '-TypeDelayMs', '10']);
            broadcast({
              type: 'log',
              jobId,
              text: `[Notepad] Live typing completed successfully!`
            });
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
          } else if (plan.appInfo.slug === 'notepad') {
            // Launch Notepad with the generated file
            spawn(plan.appInfo.exePath, [scriptPath], { detached: true, stdio: 'ignore' }).unref();
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
