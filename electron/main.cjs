const { app, BrowserWindow, ipcMain, shell, Menu, screen, globalShortcut, session, safeStorage } = require('electron');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
  if (autoUpdater) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
  }
} catch (e) {
  console.warn('[RuXt Desktop] Could not initialize electron-updater:', e.message);
}

let mainWindow = null;
let overlayWindow = null;
let lastBannerData = null;
let serverProcess = null;
let serverPort = 1234;
let quitting = false;
let serverRestarts = [];
const isDev = process.env.NODE_ENV === 'development';
const net = require('net');

// ---- Backend port selection -------------------------------------------------
// Reuse an already-running RuXt engine on 1234, else take 1234 if it is free, else any free port.
function fetchStatus(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/status', timeout: 600 }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(res.statusCode === 200 ? JSON.parse(body) : null); } catch (_) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function resolveServerPort() {
  if (isDev) return 1234; // Vite proxy targets 1234
  const status = await fetchStatus(1234);
  if (status && status.app === 'ruxt') return 1234;
  if (await isPortFree(1234)) return 1234;
  return getFreePort();
}

// Master key used by the backend to encrypt stored API keys. It is protected by the
// OS (DPAPI/Keychain via safeStorage), so the SQLite file alone is not enough to read keys.
function getOrCreateMasterKey() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const keyFile = path.join(app.getPath('userData'), 'master.key');
    if (fs.existsSync(keyFile)) {
      return safeStorage.decryptString(fs.readFileSync(keyFile));
    }
    const key = crypto.randomBytes(32).toString('base64');
    fs.mkdirSync(path.dirname(keyFile), { recursive: true });
    fs.writeFileSync(keyFile, safeStorage.encryptString(key));
    return key;
  } catch (e) {
    console.warn('[RuXt Desktop] Secret encryption unavailable:', e.message);
    return null;
  }
}

function isSafeExternalUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch (_) {
    return false;
  }
}

// Strict CSP for the main app document only (agent UIs and the overlay use inline scripts).
function installContentSecurityPolicy() {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; ');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    let apply = false;
    if (!isDev && details.resourceType === 'mainFrame') {
      try {
        const u = new URL(details.url);
        apply = u.origin === `http://127.0.0.1:${serverPort}` &&
          !/^\/(agents|hub|overlay\.html)/.test(u.pathname) && !u.pathname.startsWith('/api');
      } catch (_) {}
    }
    if (!apply) return callback({ responseHeaders: details.responseHeaders });
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } });
  });
}

function createOrGetOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.bounds;

  overlayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  try {
    // Windows WDA_EXCLUDEFROMCAPTURE: Keeps overlay 100% visible to user eyes,
    // but automatically excludes it from MSS / BitBlt screen capture so AI vision model
    // analyzes pure desktop pixels with zero border/island obstruction!
    overlayWindow.setContentProtection(true);
  } catch (_) {}

  const candidatePaths = [
    path.join(__dirname, '../public/overlay.html'),
    path.join(__dirname, '../dist/overlay.html'),
    path.join(process.resourcesPath || '', 'app.asar/public/overlay.html'),
    path.join(process.resourcesPath || '', 'app.asar/dist/overlay.html'),
    path.join(process.resourcesPath || '', 'public/overlay.html'),
    path.join(process.resourcesPath || '', 'dist/overlay.html')
  ];

  let loaded = false;
  for (const cp of candidatePaths) {
    if (fs.existsSync(cp)) {
      overlayWindow.loadFile(cp);
      loaded = true;
      break;
    }
  }
  if (!loaded) {
    overlayWindow.loadURL(`http://127.0.0.1:${serverPort}/overlay.html`);
  }

  overlayWindow.webContents.on('did-finish-load', () => {
    if (lastBannerData && overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('banner-update-data', lastBannerData);
    }
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

function checkServerReady(cb) {
  // In production the answer must come from RuXt itself, not some other app on the port
  fetchStatus(serverPort).then((status) => cb(Boolean(status) && (isDev || status.app === 'ruxt')));
}

function startBackendServer() {
  checkServerReady((ready) => {
    if (ready) {
      console.log('[RuXt Desktop] Backend server already running on http://localhost:' + serverPort);
      return;
    }
    let serverScript = path.join(__dirname, '../server/index.js');
    if (!isDev) {
      const unpackedServer = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'server', 'index.js');
      if (fs.existsSync(unpackedServer)) {
        serverScript = unpackedServer;
      }
    }
    const userDataDir = isDev ? path.join(__dirname, '../data') : path.join(app.getPath('userData'), 'data');

    // Resolve bundled agents and packages path safely in dev and production
    let bundledAgentsDir = path.join(__dirname, '../agents');
    if (!isDev) {
      const unpackedAgents = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'agents');
      const directAgents = path.join(process.resourcesPath || '', 'agents');
      if (fs.existsSync(unpackedAgents)) {
        bundledAgentsDir = unpackedAgents;
      } else if (fs.existsSync(directAgents)) {
        bundledAgentsDir = directAgents;
      }
    }
    const bundledPackagesDir = path.join(bundledAgentsDir, 'packages');

    let stdioConfig = 'inherit';
    let logStream = null;
    try {
      const logDir = app.getPath('userData');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logFile = path.join(logDir, 'server.log');
      // Rotate so the log cannot grow forever: keep the previous run as server.log.1
      try {
        if (fs.existsSync(logFile) && fs.statSync(logFile).size > 5 * 1024 * 1024) {
          fs.renameSync(logFile, logFile + '.1');
        }
      } catch (_) {}
      process.env.RUXT_LOG_FILE = logFile;
      logStream = fs.createWriteStream(logFile, { flags: 'a' });
      stdioConfig = ['ignore', 'pipe', 'pipe'];
    } catch (_) {}

    const masterKey = isDev ? null : getOrCreateMasterKey();
    serverProcess = spawn(process.execPath, [serverScript], {
      env: {
        ...process.env,
        ...(masterKey ? { RUXT_MASTER_KEY: masterKey } : {}),
        PORT: String(serverPort),
        RUXT_DATA_DIR: userDataDir,
        RUXT_LOG_FILE: process.env.RUXT_LOG_FILE || '',
        RUXT_AGENTS_DIR: bundledAgentsDir,
        RUXT_PACKAGES_DIR: bundledPackagesDir,
        ELECTRON_RUN_AS_NODE: '1'
      },
      stdio: stdioConfig
    });

    if (logStream && serverProcess.stdout && serverProcess.stderr) {
      serverProcess.stdout.pipe(logStream);
      serverProcess.stderr.pipe(logStream);
    }

    serverProcess.on('exit', (code, signal) => {
      console.warn(`[RuXt Desktop] Backend server process exited with code ${code}, signal ${signal}`);
      if (logStream) {
        try { logStream.write(`\n[RuXt Desktop] Backend server process exited with code ${code}, signal ${signal}\n`); } catch (_) {}
      }
      // Crash recovery: restart after an unexpected exit (max 5 per minute, with backoff)
      if (!quitting && typeof code === 'number' && code !== 0 && code !== 98) {
        const now = Date.now();
        serverRestarts = serverRestarts.filter((t) => now - t < 60000);
        if (serverRestarts.length < 5) {
          serverRestarts.push(now);
          const delay = 500 * serverRestarts.length;
          console.warn(`[RuXt Desktop] Restarting backend in ${delay}ms (attempt ${serverRestarts.length}/5)`);
          setTimeout(() => { if (!quitting) startBackendServer(); }, delay);
        } else {
          console.error('[RuXt Desktop] Backend keeps crashing; giving up. See server.log in the app data folder.');
        }
      }
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start RuXt background engine:', err);
      if (logStream) {
        try { logStream.write(`\n[RuXt Desktop] Failed to start engine: ${err.message}\n`); } catch (_) {}
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0b0f19',
    frame: true,
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../public/ruxt-logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.removeMenu();

  // Window IPC handlers
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window-close', () => mainWindow?.close());

  // Desktop Overlay HUD Handlers
  ipcMain.on('desktop-overlay-show', (_event, data) => {
    try {
      lastBannerData = data;
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMinimized()) {
        mainWindow.minimize();
      }
      const win = createOrGetOverlayWindow();
      if (win) {
        win.setAlwaysOnTop(true, 'screen-saver');
        win.setIgnoreMouseEvents(true, { forward: true });
        win.showInactive();
        if (win.webContents.isLoading()) {
          win.webContents.once('did-finish-load', () => {
            win.webContents.send('banner-update-data', data);
          });
        } else {
          win.webContents.send('banner-update-data', data);
        }
      }
      try {
        globalShortcut.unregister('Escape');
        globalShortcut.register('Escape', () => {
          ipcMain.emit('desktop-overlay-abort');
        });
      } catch (_) {}
    } catch (err) {
      console.error('Failed to show overlay window:', err);
    }
  });

  ipcMain.on('desktop-overlay-set-ignore-mouse', (_event, ignore, options) => {
    try {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setIgnoreMouseEvents(ignore, options || { forward: true });
      }
    } catch (_) {}
  });

  ipcMain.on('desktop-overlay-update', (_event, data) => {
    try {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('banner-update-data', data);
      }
    } catch (err) {
      console.error('Failed to update overlay window:', err);
    }
  });

  ipcMain.on('desktop-overlay-hide', () => {
    try {
      try { globalShortcut.unregister('Escape'); } catch (_) {}
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.hide();
      }
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isMinimized()) {
        mainWindow.restore();
        mainWindow.focus();
      }
    } catch (err) {
      console.error('Failed to hide overlay window:', err);
    }
  });

  ipcMain.on('desktop-overlay-approval', (_event, decision) => {
    if (decision !== 'approve' && decision !== 'deny') return;
    try {
      const body = JSON.stringify({ decision });
      const req = http.request({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/desktop/approval',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, (res) => { res.resume(); });
      req.on('error', (err) => console.warn('Failed to dispatch approval to backend:', err.message));
      req.write(body);
      req.end();
    } catch (err) {
      console.error('Failed to dispatch approval:', err);
    }
  });

  ipcMain.on('desktop-overlay-resume', () => {
    try {
      const req = http.request({
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/desktop/resume',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('banner-update-data', {
            type: 'resumed',
            stepText: 'Resuming autonomous desktop execution...',
            actionIcon: '⚡'
          });
        }
      });
      req.on('error', (err) => {
        console.warn('Failed to dispatch resume to backend:', err.message);
      });
      req.write(JSON.stringify({}));
      req.end();
    } catch (err) {
      console.error('Failed to dispatch resume:', err);
    }
  });

  ipcMain.on('desktop-overlay-abort', () => {
    try {
      try { globalShortcut.unregister('Escape'); } catch (_) {}
      
      // Send emergency abort to backend Express server immediately
      try {
        const abortReq = http.request({
          hostname: '127.0.0.1',
          port: serverPort,
          path: '/api/desktop/abort-active',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        abortReq.on('error', (err) => {
          console.warn('Failed to dispatch abort-active to backend:', err.message);
        });
        abortReq.write(JSON.stringify({}));
        abortReq.end();
      } catch (reqErr) {
        console.warn('Error initiating abort-active HTTP request:', reqErr.message);
      }

      mainWindow?.webContents.send('desktop-task-aborted');
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('banner-update-data', {
          stepText: 'Operation stopped by user',
          progress: 100,
          actionIcon: '⏹️'
        });
        setTimeout(() => {
          if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
          if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isMinimized()) {
            mainWindow.restore();
            mainWindow.focus();
          }
        }, 250);
      }
    } catch (err) {
      console.error('Failed to abort desktop task:', err);
    }
  });

  // External links opened in user's browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // The app never navigates away from its own origin; send everything else to the browser.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    let sameOrigin = false;
    try {
      const o = new URL(url).origin;
      sameOrigin = o === `http://127.0.0.1:${serverPort}` || (isDev && o === 'http://localhost:5173');
    } catch (_) {}
    if (!sameOrigin && !url.startsWith('file:')) {
      event.preventDefault();
      if (isSafeExternalUrl(url)) shell.openExternal(url);
    }
  });

  const targetURL = isDev ? 'http://localhost:5173' : `http://127.0.0.1:${serverPort}`;

  let hasLoaded = false;
  const loadWithRetry = (retries = 80, delay = 150) => {
    if (!mainWindow || mainWindow.isDestroyed() || hasLoaded) return;
    
    // In production, wait until backend server actually answers on port 1234
    if (!isDev) {
      checkServerReady((ready) => {
        if (!mainWindow || mainWindow.isDestroyed() || hasLoaded) return;
        if (ready) {
          mainWindow.loadURL(targetURL)
            .then(() => {
              hasLoaded = true;
            })
            .catch((err) => {
              if (retries > 0 && !hasLoaded) {
                setTimeout(() => loadWithRetry(retries - 1, delay), delay);
              }
            });
        } else {
          if (retries > 0 && !hasLoaded) {
            setTimeout(() => loadWithRetry(retries - 1, delay), delay);
          } else if (!hasLoaded) {
            // Fallback: try loading index.html directly from disk
            const candidatePaths = [
              path.join(process.resourcesPath || '', 'app.asar.unpacked/dist/index.html'),
              path.join(process.resourcesPath || '', 'dist/index.html'),
              path.join(__dirname, '../dist/index.html')
            ];
            for (const cp of candidatePaths) {
              if (fs.existsSync(cp)) {
                mainWindow.loadFile(cp);
                hasLoaded = true;
                break;
              }
            }
          }
        }
      });
    } else {
      mainWindow.loadURL(targetURL)
        .then(() => {
          hasLoaded = true;
        })
        .catch((err) => {
          if (retries > 0 && !hasLoaded) {
            setTimeout(() => loadWithRetry(retries - 1, delay), delay);
          }
        });
    }
  };

  loadWithRetry();

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Allow F12 or Ctrl+Shift+I to toggle DevTools for diagnosis
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!isDev) return; // DevTools shortcuts are development-only
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return; // Skip ERR_ABORTED when navigation is superseded
    if (validatedURL && (validatedURL.includes(String(serverPort)) || validatedURL.includes('5173'))) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !hasLoaded) {
          mainWindow.loadURL(targetURL).then(() => { hasLoaded = true; }).catch(() => {});
        }
      }, 1000);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupAutoUpdater() {
  if (!autoUpdater) return;

  autoUpdater.on('checking-for-update', () => {
    console.log('[RuXt Updater] Checking for update...');
    mainWindow?.webContents.send('updater-checking');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[RuXt Updater] Update available:', info.version);
    mainWindow?.webContents.send('updater-update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes || '',
      files: info.files
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[RuXt Updater] Already on latest version:', info?.version || app.getVersion());
    mainWindow?.webContents.send('updater-not-available', {
      version: info?.version || app.getVersion()
    });
  });

  autoUpdater.on('error', (err) => {
    console.warn('[RuXt Updater] Error:', err?.message || err);
    mainWindow?.webContents.send('updater-error', {
      message: err?.message || 'Error checking for updates'
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow?.webContents.send('updater-progress', {
      percent: Math.round(progressObj.percent),
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[RuXt Updater] Update downloaded successfully');
    mainWindow?.webContents.send('updater-downloaded', {
      version: info.version,
      releaseDate: info.releaseDate
    });
  });

  ipcMain.handle('app-get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app-check-for-updates', async () => {
    if (isDev) {
      return { status: 'dev-mode', version: app.getVersion(), message: 'Auto-updates are inactive in development mode.' };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return { status: 'ok', updateInfo: result?.updateInfo };
    } catch (err) {
      console.warn('[RuXt Updater] Check failed:', err.message);
      return { status: 'error', message: err.message };
    }
  });

  ipcMain.handle('app-download-update', async () => {
    if (isDev) {
      return { status: 'dev-mode' };
    }
    try {
      await autoUpdater.downloadUpdate();
      return { status: 'downloading' };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  });

  ipcMain.on('app-quit-and-install', () => {
    if (!isDev) {
      autoUpdater.quitAndInstall();
    }
  });
}

app.whenReady().then(async () => {
  try {
    serverPort = await resolveServerPort();
  } catch (e) {
    console.warn('[RuXt Desktop] Port selection failed, using 1234:', e.message);
  }
  Menu.setApplicationMenu(null);
  // Must exist before any window loads: preload.cjs calls it synchronously
  ipcMain.on('app-get-version-sync', (event) => {
    event.returnValue = app.getVersion();
  });
  installContentSecurityPolicy();
  startBackendServer();
  // Create window immediately with instant retry polling for zero UI startup delay
  createWindow();
  setTimeout(createOrGetOverlayWindow, 800);
  setupAutoUpdater();

  // Auto-check in background on launch (packaged only)
  if (!isDev && autoUpdater) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.warn('[RuXt Updater] Silent launch check:', err?.message);
      });
    }, 8000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('will-quit', () => {
  quitting = true;
  if (serverProcess) {
    serverProcess.kill();
  }
});
