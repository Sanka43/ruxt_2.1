const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { commandPath, installCommand, platformInstallMessage } = require('./platform');

let workingDialogProcess = null;
let canvasBridgeProcess = null;
const workingDialogPidFile = path.join(__dirname, 'tools', '.working-popup.pid');

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
      fs.mkdirSync(path.dirname(bin), { recursive: true });
      execFileSync('swiftc', ['-O', '-o', bin, source, '-framework', 'AppKit'], { stdio: 'pipe', cwd: path.dirname(source) });
      fs.chmodSync(bin, 0o755);
    } catch (_) { return null; }
  }
  return bin;
}

function stopWorkingDialog() {
  let pid = workingDialogProcess && workingDialogProcess.pid;
  // The popup is detached, so a bridge reload can lose its ChildProcess
  // handle while the native window remains alive. Persisting only its PID
  // lets every stop/reconnect path clean up that stale window safely.
  if (!pid) {
    try { pid = Number(fs.readFileSync(workingDialogPidFile, 'utf8').trim()) || null; } catch (_) {}
  }
  const pids = new Set(pid ? [pid] : []);
  // Also clean orphaned Nora popups left by a dashboard/bridge restart. The
  // command is matched by its exact absolute path, so other agents' windows
  // (for example Lina's Blender popup) are never touched.
  try {
    const listed = execFileSync('pgrep', ['-f', `^${workingPopupBinaryPath().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    listed.split(/\s+/).forEach((value) => { const candidate = Number(value); if (candidate) pids.add(candidate); });
  } catch (_) {}
  pids.forEach((candidate) => {
    try { process.kill(candidate, 'SIGTERM'); } catch (_) {}
    setTimeout(() => { try { process.kill(candidate, 'SIGKILL'); } catch (_) {} }, 220);
  });
  workingDialogProcess = null;
  try { fs.unlinkSync(workingDialogPidFile); } catch (_) {}
  return { ok: true, stopped: true };
}

function startWorkingDialog() {
  if (process.platform !== 'darwin') return { ok: false, supported: false, message: 'The native Figma indicator is unavailable on this operating system.' };
  if (workingDialogProcess && !workingDialogProcess.killed) return { ok: true, supported: true, reused: true };
  const bin = ensureWorkingPopupBinary();
  if (!bin) return { ok: false, supported: false, message: 'The native Figma working indicator could not be built.' };
  try {
    workingDialogProcess = spawn(bin, [], { stdio: 'ignore', detached: true, env: { ...process.env, NORA_AVATAR_PATH: path.join(__dirname, 'avatar.svg') } });
    try { fs.writeFileSync(workingDialogPidFile, String(workingDialogProcess.pid), 'utf8'); } catch (_) {}
    workingDialogProcess.unref();
    workingDialogProcess.once('exit', () => {
      workingDialogProcess = null;
      try { fs.unlinkSync(workingDialogPidFile); } catch (_) {}
    });
    return { ok: true, supported: true };
  } catch (error) { workingDialogProcess = null; return { ok: false, supported: true, message: error.message }; }
}

function resolveFigmaBin() {
  const windowsRoots = process.platform === 'win32'
    ? [path.join(process.env.LOCALAPPDATA || '', 'Figma'), path.join(process.env.ProgramFiles || '', 'Figma')]
    : [];
  const windowsVersions = windowsRoots.flatMap((root) => {
    try {
      return fs.readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((a, b) => b.name.localeCompare(a.name))
        .map((entry) => path.join(root, entry.name, 'Figma.exe'));
    } catch (_) { return []; }
  });
  const candidates = [
    process.env.FIGMA_BIN,
    process.platform === 'darwin' ? '/Applications/Figma.app/Contents/MacOS/Figma' : null,
    process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'Figma', 'Figma.exe') : null,
    process.platform === 'win32' ? path.join(process.env.ProgramFiles || '', 'Figma', 'Figma.exe') : null,
    ...windowsVersions
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || commandPath(process.platform === 'win32' ? 'figma.exe' : 'figma');
}

function desktopControlBridge() {
  const configured = process.env.RUXT_FIGMA_DESKTOP_BRIDGE || path.join(__dirname, 'tools', 'FigmaDesktopBridge');
  return fs.existsSync(configured) ? configured : null;
}

function pluginWasImported() {
  try { return fs.existsSync(path.join(__dirname, 'tools', '.plugin-seen')); } catch (_) { return false; }
}

function canvasBridgeHealth() {
  return fetch('http://localhost:17451/health', { signal: AbortSignal.timeout(350) })
    .then((response) => response.ok ? response.json() : ({ ok: false }))
    .catch(() => ({ ok: false, pluginConnected: false }));
}

async function ensureCanvasBridge() {
  const script = desktopControlBridge();
  if (!script) return { ok: false, pluginConnected: false, message: 'The Nora Figma bridge files are missing.' };
  let health = await canvasBridgeHealth();
  if (!health.ok) {
    try {
      canvasBridgeProcess = spawn(process.execPath, [script], { detached: true, stdio: 'ignore', env: { ...process.env, RUXT_FIGMA_BRIDGE_QUIET: '1' } });
      canvasBridgeProcess.unref();
    } catch (_) {}
    // Figma’s plugin sandbox may need a few polling cycles after the local
    // bridge starts. Do not fail on the first 180 ms race.
  }
  for (let attempt = 0; attempt < 24 && !health.pluginConnected; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    health = await canvasBridgeHealth();
  }
  return { ...health, installed: true, bridge: script };
}

function canvasEvidence() {
  try {
    const marker = path.join(__dirname, 'tools', '.canvas-updated');
    const stat = fs.statSync(marker);
    return { updatedAt: stat.mtimeMs, pluginConnected: true };
  } catch (_) { return null; }
}

function openFigma(filePath) {
  const bin = resolveFigmaBin();
  if (!bin) return { ok: false, error: 'Figma was not found. Install Figma or set FIGMA_BIN.' };
  try {
    if (process.platform === 'darwin') spawn('open', ['-a', 'Figma'].concat(filePath ? [filePath] : []), { stdio: 'ignore' });
    else spawn(bin, filePath ? [filePath] : [], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
    return { ok: true, via: process.platform === 'win32' ? 'figma.exe' : 'open', bin };
  } catch (error) { return { ok: false, error: error.message }; }
}

function projectRoot(helpers) {
  const root = path.join(helpers && helpers.projectRoot || process.cwd(), 'outputs', 'figma-projects');
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function safeProject(id, helpers) {
  const safe = String(id || ('figma-' + Date.now().toString(36))).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80);
  const dir = path.join(projectRoot(helpers), safe);
  fs.mkdirSync(dir, { recursive: true });
  return { id: safe, dir, relative: path.relative(helpers && helpers.projectRoot || process.cwd(), dir).replace(/\\/g, '/') };
}

function status(extra) {
  const bin = resolveFigmaBin();
  const desktopBridge = desktopControlBridge();
  return Object.assign({
    installed: Boolean(bin),
    ready: Boolean(bin),
    bin: bin || null,
    appPath: bin || null,
    desktopControl: Boolean(desktopBridge),
    desktopControlBridge: desktopBridge,
    pluginDownload: '/api/download?file=agents/nora-vale-figma/tools/Nora-Figma-Plugin.zip',
    pluginGuide: 'Download the plugin, unzip it, then use Figma → Plugins → Development → Import plugin from manifest… and select figma-plugin/manifest.json.',
    capabilityMessage: desktopBridge
      ? 'Figma desktop control is available.'
      : 'Figma is installed, but RuXt has no desktop-control bridge for editing the canvas.'
  }, extra || {});
}

async function ensureFigma() {
  const bin = resolveFigmaBin();
  if (bin) return status({ ok: true, action: 'found', message: 'Figma is ready.' });
  const installer = installCommand();
  if (!installer) return Object.assign(status(), { ok: false, action: 'manual', message: 'Figma is not installed. Install it from figma.com/downloads, or install Homebrew/WinGet and ask Nora again.' });
  try {
    execFileSync(installer.command, installer.args, { cwd: process.env.HOME || process.env.USERPROFILE || process.cwd(), stdio: 'ignore', timeout: 180000 });
    const ready = resolveFigmaBin();
    return Object.assign(status(), { ok: Boolean(ready), action: 'installed', message: ready ? 'Figma installed. Ready when you are.' : platformInstallMessage() });
  } catch (error) {
    return Object.assign(status(), { ok: false, action: 'install-failed', message: error.message || platformInstallMessage() });
  }
}

function projectPath(helpers, requested) {
  const root = helpers && helpers.projectRoot || process.cwd();
  const candidate = path.resolve(root, String(requested || ''));
  return { root, candidate, allowed: path.join(root, 'outputs', 'figma-projects') + path.sep };
}

function hasProjectEvidence(candidate) {
  if (!fs.existsSync(candidate)) return false;
  try {
    const stat = fs.statSync(candidate);
    if (stat.isFile()) return stat.size > 0 && /\.(fig|figma)$/i.test(candidate);
    return fs.readdirSync(candidate).some((name) => /\.(fig|figma)$/i.test(name));
  } catch (_) { return false; }
}

function nearbyFigmaArtifacts(root, candidate) {
  try {
    const dir = fs.statSync(candidate).isDirectory() ? candidate : path.dirname(candidate);
    return fs.readdirSync(dir)
      .filter((name) => /\.(fig|figma|svg|png|html|md)$/i.test(name))
      .slice(0, 12);
  } catch (_) {
    return [];
  }
}

function directCanvasCommands(prompt) {
  const text = String(prompt || '').toLowerCase();
  // Keep this intentionally small and deterministic: it is a reliable fast
  // path for common canvas requests, not a replacement for the selected AI
  // server on complex design work.
  if (/^(?:create|draw|make|paint) (?:a )?colou?rful car[.!]?$/i.test(text.trim())) {
    const layers = [
      ['Road shadow',91,397,623,35,'d9def0'], ['Cabin',228,158,308,188,'ffb63b'],
      ['Rear window',251,176,115,112,'28889f'], ['Front window',376,178,132,110,'66cce1'],
      ['Body',94,247,612,118,'f05d66'], ['Racing stripe',142,294,495,18,'ffc650'],
      ['Headlamp',651,267,40,21,'fff3bd'], ['Tail light',107,280,25,15,'ac2343'],
      ['Rear tyre',170,312,100,100,'252c48'], ['Front tyre',540,312,100,100,'252c48'],
      ['Rear hub',194,336,52,52,'64cec0'], ['Front hub',564,336,52,52,'64cec0']
    ];
    return [{name:'Colorful Car'}, ...layers.map(([name,x,y,width,height,hex]) => {
      const [r,g,b] = hex.match(/../g).map(pair => parseInt(pair,16)/255);
      return {type:'createEllipse',name,x,y,width,height,color:{r,g,b}};
    })];
  }
  if (/^(?:draw|create|make|paint)\s+(?:a\s+)?colou?rful bird[.!]?$/i.test(text.trim())) {
    const layers = [
      ['Backdrop',85,35,630,530,'f3ead6'], ['Perch',140,434,510,16,'795641'],
      ['Tail indigo',212,317,64,159,'394f97'], ['Tail turquoise',244,307,61,153,'169f9c'],
      ['Left foot',330,399,12,42,'ae672f'], ['Right foot',366,399,12,42,'ae672f'],
      ['Body',235,185,245,237,'168e95'], ['Breast',356,214,124,177,'f6aa37'],
      ['Bill',457,166,118,42,'f49326'], ['Head',364,115,137,141,'e7554e'],
      ['Eye ring',443,147,36,39,'ffefcd'], ['Eye',454,158,17,19,'202b40'],
      ['Catchlight',463,160,5,5,'ffffff'], ['Wing',248,228,148,99,'385ea4'],
      ['Wing feather',251,263,114,52,'6589cb'], ['Wing tip',246,289,76,32,'9668ae']
    ];
    return [{name:'Colorful Bird'}, ...layers.map(([name,x,y,width,height,hex]) => {
      const [r,g,b] = hex.match(/../g).map(pair => parseInt(pair,16)/255);
      return {type:'createEllipse',name,x,y,width,height,color:{r,g,b}};
    })];
  }
  if (/^(?:create|make|draw|design)\s+(?:some\s+)?colou?rful\s+3d\s+(?:boxes|cubes)[.!]?$/i.test(text.trim())) {
    return [{ type: 'createFrame', name: 'Colorful 3D Boxes' },
      ...['#eb5946','#4d79eb','#ffb438','#28b89e','#9961e0','#e46fa4'].map((color,index) => ({
        type: 'cube', name: 'Cube ' + (index + 1), color,
        x: 100 + (index % 3) * 235, y: 80 + Math.floor(index / 3) * 215
      }))];
  }
  if (/\bcolou?rful\b/.test(text) && /\bwarm\b/.test(text)) {
    return [
      { type: 'createFrame', name: 'Warm Color Study', width: 800, height: 600, x: 0, y: 0 },
      { type: 'createEllipse', name: 'Sunset', width: 270, height: 190, x: 90, y: 80, color: { r: 1, g: 0.54, b: 0.36 } },
      { type: 'createEllipse', name: 'Apricot', width: 210, height: 210, x: 300, y: 120, color: { r: 1, g: 0.69, b: 0.36 } },
      { type: 'createEllipse', name: 'Coral', width: 180, height: 260, x: 520, y: 75, color: { r: 0.95, g: 0.42, b: 0.36 } },
      { type: 'createEllipse', name: 'Rose', width: 220, height: 170, x: 180, y: 310, color: { r: 0.91, g: 0.36, b: 0.46 } },
      { type: 'createEllipse', name: 'Golden glow', width: 250, height: 180, x: 430, y: 340, color: { r: 1, g: 0.82, b: 0.4 } }
    ];
  }
  if (/^(?:create|draw|make) (?:some )?colou?rful worms[.!]?$/i.test(text.trim())) {
    const commands = [{name:'Colorful Worms'}];
    const colors = [{r:.96,g:.33,b:.42},{r:.12,g:.69,b:.62},{r:.57,g:.36,b:.84}];
    colors.forEach((color,row) => {
      const segment = (label,x,y,size,fill) => commands.push({type:'createEllipse',name:label,x,y,width:size,height:size,color:fill});
      for (let i=0;i<14;i++) {
        const size = 26 + Math.min(i,5)*4;
        const x = 160+i*31;
        const y = 96+row*155+32*Math.sin(i*.49+row);
        segment('Worm '+(row+1)+' segment '+(i+1),x,y,size,color);
        if (i===13) {
          for (const offset of [10,27]) {
            segment('Eye',x+offset,y+8,14,{r:1,g:1,b:1});
            segment('Pupil',x+offset+5,y+11,7,{r:.09,g:.07,b:.15});
          }
        }
      }
    });
    return commands;
  }
  if (/\b(red\s+ball|red\s+circle)\b/.test(text)) return [
    { type: 'createFrame', name: 'Red Ball composition', width: 800, height: 600, x: 0, y: 0 },
    { type: 'createEllipse', name: 'Red ball', width: 160, height: 160, x: 320, y: 220, color: { r: 0.9, g: 0.04, b: 0.04 } },
    { type: 'createText', text: 'Red ball', fontSize: 28, x: 24, y: 24 }
  ];
  if (/\b(colorful\s+balls?|balls?\s+colorful|colou?rful\s+balls?)\b/.test(text)) return [
    { type: 'createFrame', name: 'Colorful Balls', width: 800, height: 600, x: 0, y: 0 },
    { type: 'createEllipse', name: 'Ball red', width: 140, height: 140, x: 80, y: 120, color: { r: 0.92, g: 0.18, b: 0.22 } },
    { type: 'createEllipse', name: 'Ball orange', width: 100, height: 100, x: 260, y: 90, color: { r: 0.98, g: 0.55, b: 0.12 } },
    { type: 'createEllipse', name: 'Ball yellow', width: 160, height: 160, x: 400, y: 180, color: { r: 0.98, g: 0.86, b: 0.16 } },
    { type: 'createEllipse', name: 'Ball green', width: 110, height: 110, x: 180, y: 300, color: { r: 0.22, g: 0.78, b: 0.38 } },
    { type: 'createEllipse', name: 'Ball teal', width: 90, height: 90, x: 520, y: 80, color: { r: 0.12, g: 0.72, b: 0.72 } },
    { type: 'createEllipse', name: 'Ball blue', width: 150, height: 150, x: 560, y: 280, color: { r: 0.18, g: 0.42, b: 0.95 } },
    { type: 'createEllipse', name: 'Ball purple', width: 120, height: 120, x: 340, y: 380, color: { r: 0.58, g: 0.28, b: 0.88 } },
    { type: 'createEllipse', name: 'Ball pink', width: 80, height: 80, x: 120, y: 430, color: { r: 0.95, g: 0.35, b: 0.68 } },
    { type: 'createText', text: 'Colorful Balls', fontSize: 32, x: 24, y: 24 }
  ];
  return null;
}

async function illustrationCommands(prompt, helpers, task) {
  const brief = 'Design the requested illustration with overlapping colored ellipses in an 800x600 Figma frame. Compose a recognizable silhouette with contrasting details. Return only JSON {"name":"title","layers":[["layer name",x,y,width,height,"#rrggbb"]]}. Coordinates are top-left and must fit the frame. Order layers back to front. Use 4 to 45 layers. No tools or file operations. Request: ' + prompt;
  const deadline = AbortSignal.timeout(150000);
  let response;
  try {
    response = await helpers.composeCanvas(brief, deadline);
  } catch (error) {
    return localDesignTemplate(prompt);
  }
  try {
    task.planningProvider = response.providerId;
    task.planningTokenEstimate = Math.ceil((brief.length + response.plan.length) / 4);
    const design = JSON.parse(response.plan.replace(/^`{3}(?:json)?\s*|\s*`{3}$/gi, '').trim());
    if (!Array.isArray(design.layers) || design.layers.length < 2 || design.layers.length > 45) throw Error('invalid layers');
    return [{name: String(design.name || prompt).slice(0,100)}, ...design.layers.map(([name,x,y,width,height,hex]) => {
      if (![x,y,width,height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || x+width > 800 || y+height > 600 || !/^#[0-9a-f]{6}$/i.test(hex)) throw Error('invalid geometry');
      const [r,g,b] = hex.slice(1).match(/../g).map(pair => parseInt(pair,16)/255);
      return {type:'createEllipse',name:String(name),x,y,width,height,color:{r,g,b}};
    })];
  } catch (_) {
    return [{ type: 'createFrame', name: String(prompt).slice(0, 80) || 'Figma concept', width: 800, height: 600, x: 0, y: 0 },
      { type: 'createRect', name: 'Canvas background', x: 0, y: 0, width: 800, height: 600, radius: 24, color: { r: .96, g: .97, b: 1 } },
      { type: 'createText', name: 'Title', text: String(prompt).slice(0, 42), fontSize: 32, x: 44, y: 42, color: { r: .08, g: .1, b: .16 } },
      { type: 'createText', name: 'Subtitle', text: 'A focused visual concept', fontSize: 16, x: 46, y: 90, color: { r: .32, g: .37, b: .48 } },
      ...[{ x: 44, y: 150, color: { r: .2, g: .42, b: .95 }, title: 'Primary direction' }, { x: 292, y: 150, color: { r: .96, g: .37, b: .42 }, title: 'Visual detail' }, { x: 540, y: 150, color: { r: .13, g: .68, b: .62 }, title: 'Next step' }].flatMap((card) => [
        { type: 'createRect', name: card.title, x: card.x, y: card.y, width: 216, height: 300, radius: 18, color: { r: 1, g: 1, b: 1 } },
        { type: 'createEllipse', name: card.title + ' accent', x: card.x + 24, y: card.y + 28, width: 64, height: 64, color: card.color },
        { type: 'createText', name: card.title + ' label', text: card.title, fontSize: 18, x: card.x + 24, y: card.y + 124, color: { r: .08, g: .1, b: .16 } },
        { type: 'createText', name: card.title + ' detail', text: 'Editable Figma block', fontSize: 13, x: card.x + 24, y: card.y + 160, color: { r: .32, g: .37, b: .48 } }
      ])];
  }
}

function localDesignTemplate(prompt) {
  const title = String(prompt || 'Figma concept').slice(0, 42);
  return [{ type: 'createFrame', name: title, width: 800, height: 600, x: 0, y: 0 },
    { type: 'createRect', name: 'Canvas background', x: 0, y: 0, width: 800, height: 600, radius: 24, color: { r: .96, g: .97, b: 1 } },
    { type: 'createText', name: 'Title', text: title, fontSize: 32, x: 44, y: 42, color: { r: .08, g: .1, b: .16 } },
    { type: 'createText', name: 'Subtitle', text: 'A focused visual concept', fontSize: 16, x: 46, y: 90, color: { r: .32, g: .37, b: .48 } },
    ...[{ x: 44, color: { r: .2, g: .42, b: .95 }, title: 'Primary direction' }, { x: 292, color: { r: .96, g: .37, b: .42 }, title: 'Visual detail' }, { x: 540, color: { r: .13, g: .68, b: .62 }, title: 'Next step' }].flatMap(card => [
      { type: 'createRect', name: card.title, x: card.x, y: 150, width: 216, height: 300, radius: 18, color: { r: 1, g: 1, b: 1 } },
      { type: 'createEllipse', name: card.title + ' accent', x: card.x + 24, y: 178, width: 64, height: 64, color: card.color },
      { type: 'createText', name: card.title + ' label', text: card.title, fontSize: 18, x: card.x + 24, y: 274, color: { r: .08, g: .1, b: .16 } },
      { type: 'createText', name: card.title + ' detail', text: 'Editable Figma block', fontSize: 13, x: card.x + 24, y: 310, color: { r: .32, g: .37, b: .48 } }
    ])];
}

async function queueCanvasCommand(command) {
  try {
    const response = await fetch('http://localhost:17451/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(command), signal: AbortSignal.timeout(700) });
    return response.ok && (await response.json()).id;
  } catch (_) { return false; }
}

module.exports = {
  stopWorking: stopWorkingDialog,
  canvasEvidence,
  handle: async ({ method, path: routePath, body, helpers }) => {
    if (method === 'GET' && routePath === '/status') {
      const bridge = await canvasBridgeHealth();
      return status({ connection: 'Configured AI Server (computer-use when available)', desktopControl: Boolean(bridge.pluginConnected), bridgeInstalled: Boolean(desktopControlBridge()), pluginImported: pluginWasImported(), bridge, capabilityMessage: bridge.pluginConnected ? 'I can control the Figma canvas.' : pluginWasImported() ? 'My plugin is installed. Run it in the current Figma file; you do not need to reinstall it.' : 'Figma is installed, but my plugin is not running in the open file.' });
    }
    if (method === 'POST' && routePath === '/ensure') return ensureFigma();
    if (method === 'POST' && routePath === '/ready') {
      const bridge = await ensureCanvasBridge();
      if (!bridge.pluginConnected && pluginWasImported()) return {
        ok: true,
        reconnecting: true,
        message: 'I’m reconnecting to the open Figma file and will continue when the canvas bridge responds.'
      };
      if (!bridge.pluginConnected) return {
        ok: false,
        code: 'FIGMA_DESKTOP_BRIDGE_UNAVAILABLE',
        message: pluginWasImported()
          ? 'My Figma canvas bridge is not responding in the active file yet.'
          : 'My Figma plugin is not installed in this Figma file yet.',
        pluginDownload: '/api/download?file=agents/nora-vale-figma/tools/Nora-Figma-Plugin.zip',
        pluginGuide: 'In Figma choose Plugins → Development → Nora Vale · RuXt Canvas Bridge and run it in the active file.'
      };
      return { ok: true, bridge };
    }
    if (method === 'POST' && routePath === '/working-dialog') {
      if (!body || body.show !== false) {
        const task = helpers && typeof helpers.getTask === 'function' ? helpers.getTask(body && body.taskId) : null;
        // Never open a native working window without a live RuXt task. This
        // prevents late iframe polling/reloads from resurrecting Nora's UI.
        if (!task || task.done || !['running', 'pending', 'working'].includes(String(task.status))) {
          const result = stopWorkingDialog();
          return Object.assign(status(), result, { ignored: true });
        }
      }
      const result = body && body.show === false ? stopWorkingDialog() : startWorkingDialog();
      return Object.assign(status(), result);
    }
    if (method === 'POST' && routePath === '/focus-stop') return Object.assign(status(), stopWorkingDialog());
    if (method === 'POST' && routePath === '/cancel') {
      if (!helpers || typeof helpers.cancelTask !== 'function') return { ok: false, message: 'Task cancellation is unavailable.' };
      const result = helpers.cancelTask(body && (body.taskId || body.task && body.task.id), 'I stopped this Figma task at your request.', 'nora-vale-figma');
      stopWorkingDialog();
      return result;
    }
    if (method === 'POST' && routePath === '/open') {
      const info = projectPath(helpers, body && body.file);
      if (!info.candidate.startsWith(info.allowed) || !/\.(fig|figma)$/i.test(info.candidate) || !fs.existsSync(info.candidate)) {
        throw Error('Choose a downloaded .fig Figma project from outputs/figma-projects.');
      }
      const opened = openFigma(info.candidate);
      if (!opened.ok) throw Error(opened.error);
      return Object.assign(status(), opened);
    }
    if (method === 'POST' && routePath === '/validate') {
      const requested = body && (body.outputFile || body.projectPath || body.projectId);
      const info = projectPath(helpers, requested);
      const valid = info.candidate.startsWith(info.allowed) && hasProjectEvidence(info.candidate);
      const alternatives = valid ? [] : nearbyFigmaArtifacts(info.root, info.candidate);
      return {
        ok: valid,
        valid,
        outputFile: path.relative(info.root, info.candidate).replace(/\\/g, '/'),
        alternatives,
        message: valid
          ? 'Verified native Figma project evidence.'
          : alternatives.length
            ? `Figma is open, but no native .fig/.figma file was saved. Found ${alternatives.join(', ')} instead. Save/export the project from Figma before delivery.`
            : 'No native .fig/.figma file was found. Save/export the project from Figma before delivery.'
      };
    }
    if (method === 'POST' && routePath === '/review-artifact') {
      const outputFile = String(body && body.outputFile || '');
      if (/\.(fig|figma)$/i.test(outputFile)) {
        const info = projectPath(helpers, outputFile);
        const valid = info.candidate.startsWith(info.allowed) && hasProjectEvidence(info.candidate);
        return valid
          ? { ok: true, verdict: 'APPROVE', rating: 4, issues: [], verified: ['A real Figma project file exists in the protected project folder.'], suggestions: ['Open the project in Figma and review the final canvas.'], reviewer: 'local-figma-check' }
          : { ok: true, verdict: 'REJECT', rating: 1, issues: ['The downloaded Figma project could not be verified.'], verified: [], suggestions: ['Export a .fig file from Figma before delivery.'], reviewer: 'local-figma-check' };
      }
      if (!helpers || typeof helpers.reviewArtifact !== 'function') return { ok: false, verdict: 'REJECT', rating: 1, issues: ['The local quality reviewer is unavailable.'], verified: [], suggestions: [] };
      return helpers.reviewArtifact({ prompt: body && body.prompt || '', outputFile: body && body.outputFile || '', attempt: body && body.attempt || 1 });
    }
    if (method === 'POST' && routePath === '/handoff') {
      if (!helpers || typeof helpers.startTask !== 'function') return { ok: false, message: 'RuXt task handoff is unavailable.' };
      const prompt = String(body && (body.prompt || body.message) || '').trim();
      if (!prompt) return { ok: false, message: 'Tell Nora what you want to design in Figma.' };
      const ready = await ensureFigma();
      if (!ready.ok && !ready.installed) return ready;
      const bridge = await ensureCanvasBridge();
      if (!bridge.pluginConnected) {
        stopWorkingDialog();
        const imported = pluginWasImported();
        return {
          ok: false,
          code: 'FIGMA_DESKTOP_BRIDGE_UNAVAILABLE',
          message: imported
            ? 'My Figma plugin is already installed, but it is not running in this file. Open Plugins → Development → Nora Vale · RuXt Canvas Bridge and run it, then try again. You do not need to reinstall it.'
            : 'Figma is installed and my local bridge is ready, but my Figma plugin is not installed yet. Download my plugin, import its manifest in Figma, run it in the open file, then try again. I did not start a fake working task or create preview files.',
          pluginDownload: '/api/download?file=agents/nora-vale-figma/tools/Nora-Figma-Plugin.zip',
          pluginGuide: 'Download and unzip the plugin. In Figma choose Plugins → Development → Import plugin from manifest… and select figma-plugin/manifest.json. Run the imported plugin in this file, then return here and retry.'
        };
      }
      const project = safeProject(body && body.projectId, helpers);
      openFigma();
      const fastCommands = directCanvasCommands(prompt);
      const illustration = !body?.baseFile && /^(?:create|draw|illustrate|paint|make)\b/i.test(prompt) &&
        !/\b(?:export|download|file|prototype|screen|website|layout|dashboard|interface|component|wireframe|app|page|ui|figma file)\b/i.test(prompt);
      const canvasTask = fastCommands || illustration;
      const taskPrompt = canvasTask ? prompt : [
        'Execute this Figma design task; do not only describe steps or give advice.',
        'Use the local Figma desktop app through the available computer-use capability. If Figma is not open, launch it and wait for its canvas to be ready. Create or update the requested frames, components, text, styles, and prototype links.',
        'Work in focused stages: open Figma, create or reopen the project, build the main structure, refine visual details, save or publish, then verify the visible result.',
        'Keep unrelated work intact. If the user asks for a modification, update the existing project instead of starting over.',
        'Use this local project workspace for the downloaded Figma project: ' + project.relative,
        'The agent-only canvas bridge is running at http://localhost:17451. Use it to perform real canvas edits through the running plugin: POST JSON commands to /command. Supported commands are clearPage, createFrame {name,width,height,x,y}, createRect {name,width,height,x,y,color:{r,g,b}}, createEllipse {name,width,height,x,y,color:{r,g,b}}, and createText {text,fontSize,x,y}. Do not merely write an SVG or HTML preview.',
        'Save or export a real .fig or .figma project file there. Do not create a Markdown file as the deliverable. In your final response, state exactly where the .fig file was saved. Do not claim completion if Figma did not visibly complete the requested work.',
        'User request: ' + prompt
      ].join('\n\n');
      const task = helpers.startTask(taskPrompt, 'nora-vale-figma', {
        mode: body && body.baseFile ? 'fix' : 'run',
        execution: 'cli',
        projectId: project.id,
        plan: ['Open Figma and prepare the project', 'Build the requested design in focused stages', 'Save and verify the visible result'],
        continuation: body && body.baseFile ? { priorPrompt: body.priorPrompt || '', priorResult: body.priorResult || '', outputFile: body.baseFile } : null,
        provider: 'auto',
        ...(canvasTask ? { directCanvasCommands: fastCommands || ['illustration'], execution: 'bridge' } : {}),
        timeoutMs: fastCommands ? 90 * 1000 : 3 * 60 * 1000
      });
      if (canvasTask) {
        void (async () => {
        const commands = fastCommands || await illustrationCommands(prompt, helpers, task);
        if (task.done) return;
        const shapes = commands.filter(command => ['createEllipse', 'createRect', 'createText', 'cube'].includes(command.type));
        const id = await queueCanvasCommand({type:'composition', name:commands[0].name, shapes});
          for (let attempt = 0; id && !task.done && attempt < 24; attempt++) {
            await new Promise(resolve => setTimeout(resolve,500));
            const receipt = await fetch('http://localhost:17451/receipt/' + id,{signal:AbortSignal.timeout(750)}).then(r=>r.json()).catch(()=>null);
            if (receipt?.id === id && receipt.frameId && (!shapes.some(shape => shape.type === 'cube') || receipt.nodeIds) && Array.isArray(receipt.nodeIds || receipt.ellipses) && new Set(receipt.nodeIds || receipt.ellipses).size === shapes.length) {
              task.canvasReceipt = receipt;
              return helpers.finishTask(task,'I created the requested shapes in Figma.');
            }
          }
          if (!task.done) helpers.finishTask(task,'I could not confirm the shapes in Figma. Run the updated canvas plugin in this file.',null,'failed');
        })().catch(error => { if (!task.done) helpers.finishTask(task, String(error.message), null, 'failed'); });
      }
      return { ok: true, handedOff: true, project: project.relative, task: helpers.publicTask(task) };
    }
    return { error: 'Unknown route ' + method + ' ' + routePath };
  }
};
