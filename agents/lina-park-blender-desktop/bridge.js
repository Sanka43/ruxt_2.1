const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { resolveBlenderBin, openBlender } = require('./platform');

let pointerProcess = null;
const pointerTasks = new Set();
let workingDialogProcess = null;

function createStagedPreview(projectId, root) {
  const bin = resolveBlenderBin();
  if (!bin) return null;
  const previewDir = path.join(root || process.cwd(), 'outputs', 'blender-previews');
  fs.mkdirSync(previewDir, { recursive: true });
  const safeId = String(projectId || 'preview').replace(/[^a-zA-Z0-9_-]+/g, '-');
  const previewFile = path.join(previewDir, `${safeId}.blend`);
  const script = path.join(previewDir, `${safeId}.py`);
  fs.writeFileSync(script, [
    'import bpy',
    'bpy.ops.wm.read_factory_settings(use_empty=True)',
    'colors = ((0.12, 0.85, 1.0, 1.0), (0.55, 0.25, 1.0, 1.0), (1.0, 0.18, 0.55, 1.0), (0.25, 1.0, 0.48, 1.0))',
    'for i, (letter, x) in enumerate(zip("RUXT", (-2.7, -0.9, 0.9, 2.7))):',
    '    curve = bpy.data.curves.new(f"RuXt Letter {letter}", "FONT")',
    '    curve.body = letter',
    '    curve.align_x = "CENTER"',
    '    curve.size = 1.65',
    '    curve.extrude = 0.08',
    '    obj = bpy.data.objects.new(f"RuXt {letter}", curve)',
    '    bpy.context.collection.objects.link(obj)',
    '    obj.location = (x, 0, 0.65)',
    '    mat = bpy.data.materials.new(f"RuXt Color {letter}")',
    '    mat.diffuse_color = colors[i]',
    '    curve.materials.append(mat)',
    '    obj.rotation_euler[2] = -0.08 if i % 2 else 0.08',
    '    obj.scale = (0.8, 0.8, 0.8)',
    '    obj.keyframe_insert(data_path="scale", frame=1)',
    '    obj.keyframe_insert(data_path="rotation_euler", frame=1)',
    '    obj.scale = (1.08, 1.08, 1.08)',
    '    obj.rotation_euler[2] *= -1',
    '    obj.keyframe_insert(data_path="scale", frame=18)',
    '    obj.keyframe_insert(data_path="rotation_euler", frame=18)',
    '    obj.scale = (0.92, 0.92, 0.92)',
    '    obj.rotation_euler[2] *= -1',
    '    obj.keyframe_insert(data_path="scale", frame=36)',
    '    obj.keyframe_insert(data_path="rotation_euler", frame=36)',
    'for i, x in enumerate((-3.4, -1.2, 1.2, 3.4)):',
    '    bpy.ops.mesh.primitive_cube_add(size=0.28, location=(x, 0, 0.22))',
    '    cube = bpy.context.object',
    '    cube.name = f"RuXt Accent Cube {i + 1}"',
    '    cube.keyframe_insert(data_path="location", frame=1)',
    '    cube.location.z = 0.7 + (i % 2) * 0.25',
    '    cube.keyframe_insert(data_path="location", frame=18)',
    '    cube.location.z = 0.22',
    '    cube.keyframe_insert(data_path="location", frame=36)',
    'bpy.context.scene.frame_start = 1',
    'bpy.context.scene.frame_end = 36',
    'bpy.context.scene.render.fps = 24',
    'bpy.ops.wm.save_as_mainfile(filepath=r"' + previewFile.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")'
  ].join('\n'));
  try {
    execFileSync(bin, ['--background', '--python', script], { cwd: root || process.cwd(), stdio: 'ignore', timeout: 30000 });
    openBlender(previewFile);
    return path.relative(root || process.cwd(), previewFile).replace(/\\/g, '/');
  } catch (_) {
    return null;
  }
}

function workingPopupBinaryPath() {
  return path.join(__dirname, 'tools', 'WorkingPopup');
}

function ensureWorkingPopupBinary() {
  if (process.platform !== 'darwin') return null;
  const bin = workingPopupBinaryPath();
  const source = path.join(__dirname, 'tools', 'WorkingPopup.swift');
  let needsBuild = !fs.existsSync(bin);
  if (!needsBuild) {
    try { needsBuild = fs.statSync(source).mtimeMs > fs.statSync(bin).mtimeMs; } catch (_) { needsBuild = true; }
  }
  if (needsBuild) {
    try {
      require('child_process').execFileSync('swiftc', ['-O', '-o', bin, source, '-framework', 'AppKit'], { stdio: 'pipe', cwd: path.join(__dirname, 'tools') });
      fs.chmodSync(bin, 0o755);
    } catch (_) { return null; }
  }
  return bin;
}

function stopWorkingDialog() {
  if (workingDialogProcess) {
    const pid = workingDialogProcess.pid;
    try { workingDialogProcess.kill('SIGTERM'); } catch (_) {}
    // Detached AppKit helpers can survive SIGTERM while their run loop is
    // closing. Escalate only this popup process, never Blender itself.
    if (pid) setTimeout(() => { try { process.kill(pid, 'SIGKILL'); } catch (_) {} }, 180);
    workingDialogProcess = null;
  }
  stopOrphanWorkingDialogs();
  return { ok: true, stopped: true };
}

function stopOrphanWorkingDialogs() {
  if (process.platform !== 'darwin') return;
  try {
    const output = execFileSync('pgrep', ['-f', 'agents/lina-park-blender-desktop/tools/WorkingPopup'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    output.split(/\s+/).map(Number).filter(Boolean).forEach((pid) => {
      if (pid !== process.pid && pid !== workingDialogProcess?.pid) {
        try { process.kill(pid, 'SIGTERM'); } catch (_) {}
        setTimeout(() => { try { process.kill(pid, 'SIGKILL'); } catch (_) {} }, 180);
      }
    });
  } catch (_) {}
}

function startWorkingDialog() {
  if (workingDialogProcess && !workingDialogProcess.killed) return { ok: true, supported: true, reused: true };
  stopOrphanWorkingDialogs();
  if (process.platform !== 'darwin') return { ok: false, supported: false };
  const bin = ensureWorkingPopupBinary();
  if (!bin) return { ok: false, supported: false, message: 'The native Blender working indicator is unavailable on this operating system.' };
  try {
    workingDialogProcess = spawn(bin, [], {
      stdio: 'ignore',
      detached: true,
      env: { ...process.env, LINA_AVATAR_PATH: path.join(__dirname, 'avatar.jpg') }
    });
    workingDialogProcess.unref();
    workingDialogProcess.once('exit', () => { workingDialogProcess = null; });
    return { ok: true, supported: true };
  } catch (_) {
    workingDialogProcess = null;
    return { ok: false, supported: true };
  }
}

function watchPointer(task) {
  if (process.platform !== 'darwin') return;
  pointerTasks.add(task);
  if (!pointerProcess) {
    const helper = path.join(__dirname, 'tools', 'CodexCursor');
    const command = fs.existsSync(helper) ? helper : '/usr/bin/swift';
    const args = fs.existsSync(helper) ? [] : [path.join(__dirname, 'cursor.swift')];
    pointerProcess = spawn(command, args, { stdio: 'ignore' });
    pointerProcess.once('error', () => {});
    pointerProcess.once('close', () => { pointerProcess = null; });
  }
  const timer = setInterval(() => {
    if (!task.done) return;
    clearInterval(timer);
    pointerTasks.delete(task);
    if (!pointerTasks.size && pointerProcess) {
      pointerProcess.kill();
      pointerProcess = null;
    }
  }, 400);
  timer.unref();
}
function projectPath(helpers, requested) {
  const root = helpers?.projectRoot || process.cwd();
  const value = String(requested || '').replace(/^file:\/\//i, '').replace(/^<|>$/g, '');
  const candidate = path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value);
  return { root, candidate, allowed: path.join(root, 'outputs') + path.sep };
}

let birdLaunchStarted = false;
function runAddBirdOnce() {
  const done = '/Users/kosala/Documents/Developments/AI Agents/RuXt-Dashboard/outputs/blender-projects/green-ball-spin/_bird_done.flag';
  const dir = '/Users/kosala/Documents/Developments/AI Agents/RuXt-Dashboard/outputs/blender-projects/green-ball-spin';
  const log = path.join(dir, 'blender_add_bird.log');
  const script = path.join(dir, '_exec_add_bird.sh');
  try {
    if (fs.existsSync(done) || birdLaunchStarted) return { skipped: true };
    birdLaunchStarted = true;
    fs.writeFileSync(path.join(dir, '_bird_started.flag'), `started ${new Date().toISOString()}\n`);
    try { fs.chmodSync(path.join(dir, 'launch_add_bird.sh'), 0o755); } catch (_) {}
    try { fs.chmodSync(script, 0o755); } catch (_) {}
    const outFd = fs.openSync(log, 'a');
    const child = spawn('/bin/bash', [script], {
      cwd: dir,
      detached: true,
      stdio: ['ignore', outFd, outFd],
      env: process.env
    });
    child.unref();
    try { fs.closeSync(outFd); } catch (_) {}
    return { ok: true, launched: true, pid: child.pid };
  } catch (error) {
    try { fs.appendFileSync(log, `ERROR ${error.message}\n`); } catch (_) {}
    birdLaunchStarted = false;
    return { ok: false, error: error.message };
  }
}

// Hot-reload side effect: run once when this bridge module is (re)loaded.
setTimeout(() => { try { runAddBirdOnce(); } catch (_) {} }, 250);

module.exports = {
  handle: async ({ method, path: routePath, body, helpers }) => {
    if (method === 'GET' && routePath === '/status') {
      const bird = runAddBirdOnce();
      const bin = resolveBlenderBin();
      return { installed: Boolean(bin), ready: Boolean(bin), bin: bin || null, connection: 'Configured AI Server (computer-use when available)', job: null, task: null, focusing: false, bird };
    }
    if (method === 'POST' && routePath === '/ensure') {
      const bin = resolveBlenderBin();
      return bin
        ? { ok: true, installed: true, action: 'found', bin, message: 'Blender is ready. Lina will open it when work starts.' }
        : { ok: false, installed: false, action: 'manual', message: 'Install Blender from blender.org, then ask Lina again.' };
    }
    if (method === 'POST' && routePath === '/working-dialog') {
      if (body?.show === false) return { ...stopWorkingDialog(), installed: true, ready: true };
      return { ...startWorkingDialog(), installed: true, ready: true };
    }
    if (method === 'POST' && routePath === '/focus-stop') {
      stopWorkingDialog();
      return { ok: true, installed: true, ready: true };
    }
    if (method === 'POST' && routePath === '/cancel') {
      const taskId = body?.taskId || body?.task?.id;
      if (typeof helpers?.cancelTask !== 'function') return { ok: false, message: 'Task cancellation is unavailable.' };
      const result = helpers.cancelTask(taskId, 'I stopped this Blender task at your request.', 'lina-park-blender-desktop');
      stopWorkingDialog();
      return result;
    }
    if (method === 'POST' && routePath === '/open') {
      const args = [];
      if (body?.file) {
        const { root, candidate } = projectPath(helpers, body.file);
        const outputs = fs.realpathSync(path.join(root, 'outputs')) + path.sep;
        const file = fs.realpathSync(candidate);
        if (!file.startsWith(outputs) || !file.toLowerCase().endsWith('.blend') || !fs.statSync(file).isFile()) {
          throw Error('Choose a Blender project from the workspace outputs.');
        }
        args.push('--disable-autoexec', file, '--python', path.join(__dirname, 'scripts', 'show_scene.py'));
      }
      const bin = resolveBlenderBin();
      if (!bin) throw Error('Blender was not found. Install Blender or set BLENDER_BIN.');
      const child = spawn(bin, args, { detached: true, stdio: 'ignore' });
      await new Promise((resolve, reject) => { child.once('error', reject); child.once('spawn', resolve); });
      child.unref();
      return { ok: true };
    }
    if (method === 'POST' && routePath === '/validate') {
      const { root, candidate, allowed } = projectPath(helpers, body?.outputFile);
      const valid = candidate.startsWith(allowed) && candidate.toLowerCase().endsWith('.blend') && fs.existsSync(candidate);
      return { ok: valid, valid, outputFile: path.relative(root, candidate).replace(/\\/g, '/'), message: valid ? 'Verified Blender project.' : 'The Blender project could not be verified.' };
    }
    if (method === 'POST' && routePath === '/review-artifact') {
      if (typeof helpers?.reviewArtifact !== 'function') return { ok: false, verdict: 'REJECT', rating: 1, issues: ['The local quality reviewer is unavailable.'], verified: [], suggestions: [] };
      return helpers.reviewArtifact({ prompt: body?.prompt || '', outputFile: body?.outputFile || '', attempt: body?.attempt || 1 });
    }
    if (method === 'POST' && routePath === '/handoff') {
      if (typeof helpers?.startTask !== 'function') return { ok: false, message: 'AI Server task handoff is unavailable.' };
      const prompt = String(body?.prompt || body?.message || '').trim();
      if (!prompt) return { ok: false, message: 'Tell Lina what you want to build in Blender.' };
      // Open Blender before the worker starts so the native working card has
      // a real Blender window to attach to from the first visible moment.
      openBlender();
      const projectId = String(body?.projectId || `blender-desktop-${Date.now().toString(36)}`).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80);
      const previewFile = createStagedPreview(projectId, helpers?.projectRoot);
      const task = helpers.startTask(prompt, 'lina-park-blender-desktop', {
        mode: body?.baseFile ? 'fix' : 'run',
        execution: 'cli',
        projectId,
        plan: ['Show the staged Blender preview', 'Build the requested work in focused stages', 'Save and verify the .blend project'],
        continuation: body?.baseFile ? { priorPrompt: body?.priorPrompt || '', priorResult: body?.priorResult || '', outputFile: body.baseFile } : null,
        // Let RuXt choose the configured AI Server. The selected provider
        // plans and executes when it supports computer use; Codex is only a
        // fallback when selected or when no other capable provider is ready.
        provider: 'auto',
        timeoutMs: 10 * 60 * 1000
      });
      return { ok: true, handedOff: true, previewFile, visualPath: 'Staged Blender preview followed by CLI build', task: helpers.publicTask(task) };
    }
    return { error: `Unknown route ${method} ${routePath}` };
  }
};
