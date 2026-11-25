const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const session = {
  running: false,
  stopRequested: false,
  process: null,
  project: null,
  mode: 'agent',
  prompt: '',
  log: [],
  lastStatus: 'Idle',
  error: null,
  startedAt: null,
  finishedAt: null
};

function resolveCursorBin() {
  const candidates = [
    process.env.CURSOR_BIN,
    '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
    '/Applications/Cursor.app/Contents/MacOS/Cursor'
  ].filter(Boolean);
  for (const item of candidates) {
    try {
      if (fs.existsSync(item)) return item;
    } catch (_) {}
  }
  try {
    const which = execFileSync('which', ['cursor'], { encoding: 'utf8' }).trim();
    if (which) return which.split(/\r?\n/)[0];
  } catch (_) {}
  return null;
}

function cursorInstalled() {
  return Boolean(resolveCursorBin() || fs.existsSync('/Applications/Cursor.app'));
}

function cursorRunning() {
  try {
    execFileSync('pgrep', ['-f', 'Cursor\\.app|/MacOS/Cursor\\b'], { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}

function slugify(name) {
  return String(name || 'cursor-project')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'cursor-project';
}

function projectsDir(helpers) {
  const dir = path.join(helpers.projectRoot || process.cwd(), 'outputs', 'cursor-projects');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function pushLog(text) {
  const line = String(text || '').trim();
  if (!line) return;
  session.log = [...session.log, { text: line.slice(0, 400), at: Date.now() }].slice(-80);
  session.lastStatus = line.slice(0, 180);
}

function publicSession() {
  return {
    running: session.running,
    mode: session.mode,
    prompt: session.prompt,
    project: session.project,
    log: session.log.slice(-30),
    lastStatus: session.lastStatus,
    error: session.error,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt
  };
}

function createProject({ name, prompt }, helpers) {
  const cleanedName = String(name || '').trim() || 'cursor-project';
  const cleanedPrompt = String(prompt || '').trim();
  if (!cleanedPrompt) throw Error('Give Cursor Agent a prompt.');
  const dir = path.join(projectsDir(helpers), `${slugify(cleanedName)}-${Date.now().toString(36)}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'README.md'), `# ${cleanedName}\n\n## Task\n${cleanedPrompt}\n\nOpened by Nova Quinn for Cursor.\n`);
  fs.writeFileSync(path.join(dir, 'PROMPT.md'), `${cleanedPrompt}\n`);
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), [
    '# Project agent notes',
    '',
    'Complete the task in PROMPT.md.',
    'Prefer small, working changes. Keep localhost:1234 reserved for RuXt.',
    ''
  ].join('\n'));
  fs.writeFileSync(path.join(dir, '.ruxt-cursor-project.json'), JSON.stringify({
    name: cleanedName,
    prompt: cleanedPrompt,
    createdAt: Date.now()
  }, null, 2));
  try {
    execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['-c', 'user.email=nova@ruxt.local', '-c', 'user.name=Nova Quinn', 'commit', '-m', 'Initial Cursor project'], {
      cwd: dir,
      stdio: 'ignore'
    });
  } catch (_) {}
  return {
    id: path.basename(dir),
    name: cleanedName,
    prompt: cleanedPrompt,
    path: dir
  };
}

function openCursorOnProject(projectPath) {
  const bin = resolveCursorBin();
  if (!bin) throw Error('Cursor is not installed on this Mac.');
  if (projectPath && fs.existsSync(projectPath)) {
    spawn(bin, ['-n', projectPath], { cwd: projectPath, stdio: 'ignore', detached: true }).unref();
  } else {
    spawn(bin, ['-n'], { stdio: 'ignore', detached: true }).unref();
  }
}

function finishSession(message, error = null) {
  if (session.process && session.process.exitCode === null && !session.process.killed) {
    try { session.process.kill('SIGTERM'); } catch (_) {}
  }
  session.process = null;
  session.running = false;
  session.finishedAt = Date.now();
  if (error) {
    session.error = error;
    session.lastStatus = error;
  } else if (message) {
    pushLog(message);
  }
}

function startCursorAgentRun({ project, prompt, mode }) {
  if (session.running) throw Error('Nova is already running a Cursor Agent job.');
  const bin = resolveCursorBin();
  if (!bin) throw Error('Cursor CLI was not found. Install Cursor, then try again.');

  const cleanedMode = ['plan', 'ask', 'agent'].includes(mode) ? mode : 'agent';
  const args = ['agent', '-p', '--force', '--workspace', project.path, '--output-format', 'text'];
  if (cleanedMode === 'plan') args.push('--mode', 'plan');
  if (cleanedMode === 'ask') args.push('--mode', 'ask');
  args.push(prompt);

  session.running = true;
  session.stopRequested = false;
  session.error = null;
  session.mode = cleanedMode;
  session.prompt = prompt;
  session.project = project;
  session.log = [];
  session.startedAt = Date.now();
  session.finishedAt = null;
  pushLog(`Opening Cursor on ${project.path}`);
  try { openCursorOnProject(project.path); } catch (_) {}

  pushLog(`Starting Cursor Agent (${cleanedMode})…`);
  const child = spawn(bin, args, {
    cwd: project.path,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  session.process = child;

  let buffer = '';
  const ingest = (chunk, isErr = false) => {
    buffer += chunk.toString();
    const parts = buffer.split(/\r?\n/);
    buffer = parts.pop() || '';
    parts.forEach((line) => {
      const text = line.trim();
      if (!text) return;
      pushLog(isErr ? `stderr: ${text}` : text);
    });
  };

  child.stdout.on('data', (chunk) => ingest(chunk, false));
  child.stderr.on('data', (chunk) => ingest(chunk, true));
  child.on('error', (err) => finishSession(null, err.message || 'Cursor Agent failed to start.'));
  child.on('close', (code) => {
    if (buffer.trim()) pushLog(buffer.trim());
    if (session.stopRequested) finishSession('Stopped by user.');
    else if (code === 0) finishSession('Cursor Agent finished.');
    else finishSession(null, `Cursor Agent exited with code ${code}.`);
  });
}

module.exports = {
  async handle({ method, path: routePath, body, helpers }) {
    if (method === 'POST' && (routePath === '/status' || routePath === '/')) {
      return {
        ok: true,
        available: cursorInstalled(),
        runningApp: cursorRunning(),
        bin: resolveCursorBin(),
        session: publicSession()
      };
    }

    if (method === 'POST' && routePath === '/stop') {
      session.stopRequested = true;
      if (session.process && session.process.exitCode === null) {
        try { session.process.kill('SIGTERM'); } catch (_) {}
      }
      session.lastStatus = 'Stop requested…';
      return { ok: true, session: publicSession(), message: 'Stopping Cursor Agent run.' };
    }

    if (method === 'POST' && routePath === '/open') {
      const target = body.path
        ? (helpers.safeWorkspacePath ? helpers.safeWorkspacePath(body.path) : body.path)
        : null;
      openCursorOnProject(target);
      return {
        ok: true,
        message: target ? `Opened Cursor on ${target}` : 'Opened Cursor.'
      };
    }

    if (method === 'POST' && routePath === '/launch') {
      const name = String(body.name || body.projectName || 'cursor-project').trim() || 'cursor-project';
      const prompt = String(body.prompt || body.goal || '').trim();
      const mode = String(body.mode || 'agent').toLowerCase();
      const confirmed = body.confirmed === true || body.permission === true || body.allow === true;
      if (!prompt) throw Error('Write the coding prompt for Cursor Agent.');

      if (!confirmed) {
        return {
          ok: true,
          needsPermission: true,
          preview: {
            name,
            prompt,
            mode: ['plan', 'ask', 'agent'].includes(mode) ? mode : 'agent'
          },
          message: 'Approve permission in RuXt to open Cursor and run this agent prompt.'
        };
      }

      if (!cursorInstalled()) throw Error('Cursor is not installed on this Mac.');
      const project = createProject({ name, prompt }, helpers);
      startCursorAgentRun({
        project,
        prompt,
        mode: ['plan', 'ask', 'agent'].includes(mode) ? mode : 'agent'
      });
      return {
        ok: true,
        needsPermission: false,
        project,
        session: publicSession(),
        message: 'Permission granted. Cursor is open and Agent is working on your prompt.'
      };
    }

    throw Error(`Unknown Nova Quinn bridge route: ${method} ${routePath}`);
  }
};
