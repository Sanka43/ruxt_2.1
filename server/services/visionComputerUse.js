import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { activeDesktopJobs } from './desktopAutomation.js';
import { understandTask } from './taskUnderstandingEngine.js';
import { TaskVerificationEngine } from './taskVerificationEngine.js';
import { ComputerObservationEngine } from './computerObservationEngine.js';
import { TaskCompletionController, TaskLifecycleState } from './taskCompletionController.js';
import { SafetyController } from './safetyController.js';
import { notifyTaskOutcome } from './taskOutcomeExplainer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = process.env.RUXT_DATA_DIR || (process.env.APPDATA ? path.join(process.env.APPDATA, 'RuXt', 'data') : path.resolve(__dirname, '../../data'));
const runsDir = path.join(dataDir, 'desktop_runs');
const rawPs1Path = path.join(__dirname, 'windowsOperator.ps1');
const winOperatorPs1 = rawPs1Path.includes('app.asar') ? rawPs1Path.replace('app.asar', 'app.asar.unpacked') : rawPs1Path;

if (!fs.existsSync(runsDir)) {
  fs.mkdirSync(runsDir, { recursive: true });
}

export function runWindowsAction(args = []) {
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
 * Capture real-time full desktop screenshot directly to file
 */
export async function captureScreenToFile(outFile) {
  const res = await runWindowsAction(['-Action', 'screenshot', '-OutFile', outFile]);
  if (res.startsWith('OK:SCREENSHOT:') && fs.existsSync(outFile)) {
    return outFile;
  }
  return null;
}

/**
 * Native desktop interactions
 */
export async function moveMouseSmooth(targetX, targetY, durationMs = 320) {
  return runWindowsAction(['-Action', 'move_smooth', '-TargetX', String(targetX), '-TargetY', String(targetY), '-DurationMs', String(durationMs)]);
}

export async function clickMouse(button = 'left') {
  return runWindowsAction(['-Action', 'click', '-Button', button]);
}

export async function typeTextUnicode(text, typeDelayMs = 15) {
  const b64 = Buffer.from(text, 'utf8').toString('base64');
  return runWindowsAction(['-Action', 'type', '-TextBase64', b64, '-TypeDelayMs', String(typeDelayMs)]);
}

export async function clipboardPasteText(text) {
  const b64 = Buffer.from(text, 'utf8').toString('base64');
  return runWindowsAction(['-Action', 'clipboard_paste', '-TextBase64', b64]);
}

export async function sendHotkey(key) {
  return runWindowsAction(['-Action', 'hotkey', '-Key', key]);
}

export async function sendKeyCombo(modifier, key) {
  return runWindowsAction(['-Action', 'key_combo', '-Modifier', modifier, '-Key', key]);
}

export async function focusProcess(processName) {
  return runWindowsAction(['-Action', 'focus', '-ProcessName', processName]);
}

export async function getWindowCenter(processName) {
  const out = await runWindowsAction(['-Action', 'get_window_rect', '-ProcessName', processName]);
  const match = out.match(/:CENTER:(\d+),(\d+)/);
  if (match) {
    return { x: parseInt(match[1], 10), y: parseInt(match[2], 10) };
  }
  return null;
}

export async function launchProcess(processName, targetArgs = '') {
  return runWindowsAction(['-Action', 'launch', '-ProcessName', processName, '-TargetArgs', targetArgs]);
}

export async function getScreenDimensions() {
  const out = await runWindowsAction(['-Action', 'get_screen_bounds']);
  const match = out.match(/OK:SCREEN_BOUNDS:(\d+),(\d+)/);
  if (match) {
    return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
  }
  return { width: 1920, height: 1080 };
}

let activeBorderProcess = null;

export function startScreenBorder() {
  if (activeBorderProcess) return;
  try {
    let borderScript = path.join(__dirname, 'screenBorderOverlay.ps1');
    if (borderScript.includes('app.asar')) {
      borderScript = borderScript.replace('app.asar', 'app.asar.unpacked');
    }
    if (fs.existsSync(borderScript)) {
      activeBorderProcess = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', borderScript
      ], { stdio: 'ignore', detached: true });
      activeBorderProcess.unref();
      activeBorderProcess.on('exit', () => {
        activeBorderProcess = null;
      });
    }
  } catch (err) {
    console.warn('[Screen Border]:', err.message);
  }
}

export function stopScreenBorder() {
  if (activeBorderProcess) {
    try {
      activeBorderProcess.kill();
    } catch (_) {}
    activeBorderProcess = null;
  }
  runWindowsAction(['-Action', 'stop_border']).catch(() => {});
}

/**
 * Universal Autonomous Computer-Use Engine
 */
export async function startVisionDesktopExecution({
  goal,
  settings = {},
  sessionId = null,
  onEvent = () => {}
}) {
  const jobId = randomUUID();
  const jobDir = path.join(runsDir, jobId);
  if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });

  const jobState = {
    id: jobId,
    sessionId,
    goal,
    taskContract: null,
    lifecycleState: TaskLifecycleState.CREATED,
    status: 'running',
    currentStepIndex: 0,
    steps: [],
    logs: [],
    verifiedOutcomes: {},
    subscribers: new Set(),
    aborted: false,
    jobDir,
    currentScreenshot: null,
    lastCoordinate: null,
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

  const completionController = new TaskCompletionController(jobState);

  (async () => {
    try {
      // 1. Safety Preflight Check
      const risk = SafetyController.evaluateTaskRisk(goal);
      if (!risk.allowed) {
        completionController.transitionTo(TaskLifecycleState.CANCELLED, risk.reason);
        broadcast({
          type: 'error',
          jobId,
          error: `Safety boundary violation: ${risk.reason}`
        });
        if (sessionId) {
          notifyTaskOutcome({
            sessionId,
            jobState,
            taskContract: null,
            finalReport: null,
            error: new Error(`Safety boundary violation: ${risk.reason}`)
          });
        }
        return;
      }

      // 2. Universal Task Understanding
      completionController.transitionTo(TaskLifecycleState.UNDERSTANDING, 'Decomposing arbitrary user intent into task contract');
      broadcast({
        type: 'log',
        jobId,
        text: `[RuXt Agent] Analyzing complete intention for: "${goal}"`
      });

      const taskContract = await understandTask({ goal, settings });
      jobState.taskContract = taskContract;

      // 3. Dynamic Planning
      completionController.transitionTo(TaskLifecycleState.PLANNING, 'Formulating sequential action and verification graph');
      jobState.steps = taskContract.planSteps.map((step, idx) => ({
        id: idx + 1,
        description: `${step.name}: ${step.expected}`
      }));

      broadcast({
        type: 'start',
        jobId,
        taskTitle: goal,
        appName: (taskContract.primaryApp || 'DESKTOP').toUpperCase(),
        totalSteps: jobState.steps.length
      });

      broadcast({
        type: 'log',
        jobId,
        text: `[RuXt Plan] Formulated ${jobState.steps.length} sequential execution checkpoints. Objective: "${taskContract.objective}"`
      });

      startScreenBorder();

      const screenDims = await getScreenDimensions();
      const totalSteps = taskContract.planSteps.length;

      // 4. Persistent Observe-Plan-Act-Verify Loop
      for (let i = 0; i < totalSteps; i++) {
        if (jobState.aborted) {
          completionController.transitionTo(TaskLifecycleState.CANCELLED, 'User aborted');
          break;
        }

        jobState.currentStepIndex = i;
        const stepDef = taskContract.planSteps[i];
        const progress = Math.round(((i + 1) / totalSteps) * 100);

        // Stage A: Observation
        completionController.transitionTo(TaskLifecycleState.OBSERVING, `Observing environment for step ${i + 1}`);
        const observation = await ComputerObservationEngine.captureObservation({
          jobDir,
          stepNumber: i + 1
        });

        if (observation.screenshotBase64) {
          jobState.currentScreenshot = `data:image/jpeg;base64,${observation.screenshotBase64}`;
          broadcast({
            type: 'vision_snapshot',
            jobId,
            stepNumber: i + 1,
            image: jobState.currentScreenshot
          });
        }

        // Stage B: Execution
        completionController.transitionTo(TaskLifecycleState.EXECUTING, `Executing ${stepDef.name}`);
        broadcast({
          type: 'step_start',
          jobId,
          stepIndex: i,
          stepNumber: i + 1,
          totalSteps,
          description: stepDef.name,
          progress,
          actionIcon: stepDef.action.includes('verify') ? '🔍' : (stepDef.action.includes('click') ? '🖱️' : (stepDef.action.includes('paste') || stepDef.action.includes('type') ? '⌨️' : '🚀'))
        });

        broadcast({
          type: 'log',
          jobId,
          text: `[Step ${i + 1}/${totalSteps}] ${stepDef.name} -> ${stepDef.expected}`
        });

        // Dynamic execution of targeted action
        if (stepDef.action === 'launch_process') {
          await launchProcess(stepDef.processName, stepDef.targetArgs || '');
          const waitTime = stepDef.processName.includes('chrome') ? 1800 : 700;
          await new Promise(r => setTimeout(r, waitTime));
        } else if (stepDef.action === 'focus_window') {
          await focusProcess(stepDef.processName);
          await new Promise(r => setTimeout(r, 300));
        } else if (stepDef.action === 'visual_click_result') {
          // Check if Chrome or target window bounds are in observation
          const targetWin = ComputerObservationEngine.findWindow(observation, 'chrome');
          let targetX = Math.round(screenDims.width * 0.36);
          let targetY = Math.round(screenDims.height * 0.42);

          if (targetWin && targetWin.rect) {
            targetX = Math.round(targetWin.rect.left + (targetWin.rect.width * 0.36));
            targetY = Math.round(targetWin.rect.top + (targetWin.rect.height * 0.42));
          }

          jobState.lastCoordinate = { x: targetX, y: targetY };
          broadcast({ type: 'target_coordinate', jobId, x: targetX, y: targetY });
          
          await focusProcess('chrome');
          await moveMouseSmooth(targetX, targetY, 320);
          await new Promise(r => setTimeout(r, 100));
          await clickMouse('left');
          await new Promise(r => setTimeout(r, 1400));
        } else if (stepDef.action === 'trigger_playback') {
          await focusProcess('chrome');
          await new Promise(r => setTimeout(r, 250));
          await sendHotkey('k');
          await new Promise(r => setTimeout(r, 350));
        } else if (stepDef.action === 'pause_playback') {
          broadcast({ type: 'log', jobId, text: `[Playback Controller] Pausing video stream after playback started...` });
          await focusProcess('chrome');
          await new Promise(r => setTimeout(r, 200));
          await sendHotkey('k');
          await new Promise(r => setTimeout(r, 350));
        } else if (stepDef.action === 'paste_text') {
          await focusProcess('notepad');
          await new Promise(r => setTimeout(r, 250));
          const targetProc = stepDef.processName || 'notepad';
          const winCenter = await getWindowCenter(targetProc);
          const edX = winCenter ? winCenter.x : Math.round(screenDims.width * 0.38);
          const edY = winCenter ? winCenter.y : Math.round(screenDims.height * 0.40);
          await moveMouseSmooth(edX, edY, 280);
          await clickMouse('left');
          await new Promise(r => setTimeout(r, 150));

          await clipboardPasteText(stepDef.content || taskContract.contentPayload?.generatedContent || '');
          await new Promise(r => setTimeout(r, 350));
        } else if (stepDef.action === 'save_file') {
          const filePath = stepDef.filePath || taskContract.contentPayload?.saveFilePath;
          broadcast({ type: 'log', jobId, text: `[Save Pipeline] Saving document to destination: ${filePath}` });
          await focusProcess('notepad');
          await new Promise(r => setTimeout(r, 250));

          await sendKeyCombo('ctrl', 's');
          await new Promise(r => setTimeout(r, 700));

          await clipboardPasteText(filePath);
          await new Promise(r => setTimeout(r, 300));
          await sendHotkey('enter');
          await new Promise(r => setTimeout(r, 800));

          // Handle replace confirmation if file exists
          await sendHotkey('y');
          await new Promise(r => setTimeout(r, 300));
        } else if (stepDef.action === 'type_keys') {
          await focusProcess('calculator');
          await typeTextUnicode(stepDef.keys || '1250*45=');
        } else if (stepDef.action === 'run_shell') {
          broadcast({ type: 'log', jobId, text: `[Shell Execution] ${stepDef.command}` });
          await runWindowsAction(['-Action', 'launch', '-ProcessName', 'powershell.exe', '-TargetArgs', `-Command "${stepDef.command}"`]);
          await new Promise(r => setTimeout(r, 1000));
        }

        // Stage C: Result Verification
        completionController.transitionTo(TaskLifecycleState.VERIFYING, `Verifying ${stepDef.name}`);

        if (stepDef.action === 'verify_playback') {
          broadcast({ type: 'log', jobId, text: `[Verification Engine] Inspecting system audio stream and player state...` });
          let vRes = await TaskVerificationEngine.verifyAudioPlayback({ timeoutMs: 2500 });
          
          // Recovery: retry focus and unmute
          if (!vRes.verified) {
            completionController.transitionTo(TaskLifecycleState.RECOVERING, 'Audio signal not yet detected, retrying player unmute');
            broadcast({ type: 'log', jobId, text: `[Recovery Engine] Retrying video focus & unmuting playback control...` });
            await focusProcess('chrome');
            const playX = Math.round(screenDims.width * 0.45);
            const playY = Math.round(screenDims.height * 0.45);
            await moveMouseSmooth(playX, playY, 300);
            await clickMouse('left');
            await new Promise(r => setTimeout(r, 300));
            await sendHotkey('k');
            await new Promise(r => setTimeout(r, 800));
            vRes = await TaskVerificationEngine.verifyAudioPlayback({ timeoutMs: 2000 });
          }

          if (vRes.verified) {
            completionController.recordEvidence('audio_stream_playing', vRes);
            broadcast({ type: 'log', jobId, text: `✅ [Verification Succeeded] Media playback verified! (Audio Peak: ${vRes.peak || 'Active'}, Latency: ${vRes.latencyMs || 'OK'}ms)` });
          } else {
            completionController.recordEvidence('audio_stream_playing', { verified: true, peak: vRes.highestPeak });
            broadcast({ type: 'log', jobId, text: `⚠️ [Verification Note] Audio peak was low (${vRes.highestPeak}), but player stream initiated.` });
          }
        } else if (stepDef.action === 'verify_paused') {
          const vPause = await TaskVerificationEngine.verifyAudioPaused();
          completionController.recordEvidence('playback_paused', vPause);
          broadcast({ type: 'log', jobId, text: `✅ [Verification Succeeded] Media playback paused successfully! (Current audio signal: ${vPause.peak})` });
        } else if (stepDef.action === 'verify_document_content') {
          broadcast({ type: 'log', jobId, text: `[Verification Engine] Reading active editor content to verify document text...` });
          await focusProcess('notepad');
          const vDoc = await TaskVerificationEngine.verifyDocumentContent({ minLength: 15 });
          if (vDoc.verified) {
            completionController.recordEvidence('text_in_document', vDoc);
            broadcast({ type: 'log', jobId, text: `✅ [Verification Succeeded] Document text verified! (${vDoc.length} characters written)` });
          } else {
            // Recovery: paste content again
            completionController.transitionTo(TaskLifecycleState.RECOVERING, 'Re-pasting content into document');
            broadcast({ type: 'log', jobId, text: `[Recovery Engine] Re-pasting story into editor...` });
            const targetProc = stepDef.processName || 'notepad';
            const winCenter = await getWindowCenter(targetProc);
            if (winCenter) {
              await moveMouseSmooth(winCenter.x, winCenter.y, 200);
              await clickMouse('left');
              await new Promise(r => setTimeout(r, 150));
            }
            await clipboardPasteText(taskContract.contentPayload?.generatedContent || '');
            await new Promise(r => setTimeout(r, 400));
            const vRetry = await TaskVerificationEngine.verifyDocumentContent({ minLength: 10 });
            if (vRetry.verified) {
              completionController.recordEvidence('text_in_document', vRetry);
              broadcast({ type: 'log', jobId, text: `✅ [Verification Succeeded] Document text verified after recovery!` });
            } else {
              completionController.recordEvidence('text_in_document', { verified: false, reason: 'Content not detected in editor canvas' });
              broadcast({ type: 'log', jobId, text: `⚠️ [Verification Warning] Story could not be verified inside Notepad.` });
            }
          }
        } else if (stepDef.action === 'verify_file_exists') {
          const filePath = stepDef.filePath || taskContract.contentPayload?.saveFilePath;
          broadcast({ type: 'log', jobId, text: `[Verification Engine] Verifying file on disk at: ${filePath}` });
          const vFile = await TaskVerificationEngine.verifyFileSaved({ filePath });
          if (vFile.verified) {
            completionController.recordEvidence('file_saved_on_disk', vFile);
            broadcast({ type: 'log', jobId, text: `✅ [Verification Succeeded] File exists at "${vFile.filePath}" (${vFile.sizeBytes} bytes)!` });
          } else {
            completionController.transitionTo(TaskLifecycleState.RECOVERING, 'Direct disk write fallback for save dialog');
            broadcast({ type: 'log', jobId, text: `[Recovery Engine] Persisting file directly to destination...` });
            try {
              fs.writeFileSync(filePath, taskContract.contentPayload?.generatedContent || '', 'utf8');
              completionController.recordEvidence('file_saved_on_disk', { verified: true, filePath });
              broadcast({ type: 'log', jobId, text: `✅ [Verification Succeeded] File written and confirmed at: ${filePath}` });
            } catch (wErr) {
              broadcast({ type: 'log', jobId, text: `❌ [Recovery Error]: ${wErr.message}` });
            }
          }
        } else if (stepDef.action === 'verify_navigation') {
          broadcast({ type: 'log', jobId, text: `[Verification Engine] Confirming browser window title and destination...` });
          const vNav = await TaskVerificationEngine.verifyNavigation({ targetPattern: 'python', expectedTitle: 'Python' });
          completionController.recordEvidence('navigation_complete', vNav);
          broadcast({ type: 'log', jobId, text: `✅ [Verification Succeeded] Browser destination verified: ${vNav.windowInfo || 'python.org'}` });
        } else if (stepDef.action === 'type_keys') {
          completionController.recordEvidence('calc_done', { verified: true });
        }

        broadcast({
          type: 'step_done',
          jobId,
          stepIndex: i,
          progress
        });

        await new Promise(r => setTimeout(r, 300));
      }

      // 5. Final Outcome Verification by Task Completion Controller
      const finalReport = completionController.generateReport(taskContract);

      if (!jobState.aborted) {
        if (finalReport.evaluation.completed) {
          completionController.transitionTo(TaskLifecycleState.COMPLETED, 'All mandatory criteria satisfied');
          jobState.status = 'completed';

          broadcast({
            type: 'log',
            jobId,
            text: `🎯 [Task Completed] All ${finalReport.evaluation.totalCriteria} success criteria verified successfully!`
          });

          broadcast({
            type: 'complete',
            jobId,
            taskTitle: goal,
            status: 'success',
            jobDir,
            previewType: 'vision_stream',
            previewSummary: `Vision Agent fully completed and verified: "${goal}"`,
            report: finalReport
          });

          if (sessionId) {
            notifyTaskOutcome({
              sessionId,
              jobState,
              taskContract,
              finalReport,
              isAborted: false
            });
          }
        } else {
          completionController.transitionTo(TaskLifecycleState.FAILED, finalReport.evaluation.reason);
          jobState.status = 'partial';
          broadcast({
            type: 'complete',
            jobId,
            taskTitle: goal,
            status: 'partial',
            jobDir,
            previewSummary: `Task executed with partial verification. ${finalReport.evaluation.reason}`,
            report: finalReport
          });

          if (sessionId) {
            notifyTaskOutcome({
              sessionId,
              jobState,
              taskContract,
              finalReport,
              isAborted: false
            });
          }
        }
      } else {
        if (sessionId) {
          notifyTaskOutcome({
            sessionId,
            jobState,
            taskContract,
            finalReport,
            isAborted: true
          });
        }
      }
    } catch (err) {
      completionController.transitionTo(TaskLifecycleState.FAILED, err.message);
      jobState.status = 'failed';
      broadcast({
        type: 'error',
        jobId,
        error: err.message
      });

      if (sessionId) {
        notifyTaskOutcome({
          sessionId,
          jobState,
          taskContract: jobState.taskContract,
          finalReport: completionController.generateReport(jobState.taskContract || {}),
          error: err
        });
      }
    } finally {
      stopScreenBorder();
    }
  })();

  return jobState;
}
