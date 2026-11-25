const { app, BrowserWindow, ipcMain, shell, Menu, screen, globalShortcut } = require('electron');
const path = require('path');
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
const isDev = process.env.NODE_ENV === 'development';

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
      contextIsolation: true
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
    overlayWindow.loadURL('http://127.0.0.1:1234/overlay.html');
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
  const req = http.get('http://127.0.0.1:1234/api/status', (res) => {
    cb(true);
  });
  req.on('error', () => {
    cb(false);
  });
  req.setTimeout(400, () => {
    req.destroy();
    cb(false);
  });
}

function startBackendServer() {
  checkServerReady((ready) => {
    if (ready) {
      console.log('[RuXt Desktop] Backend server already running on http://localhost:1234');
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
      logStream = fs.createWriteStream(logFile, { flags: 'a' });
      stdioConfig = ['ignore', 'pipe', 'pipe'];
    } catch (_) {}

    serverProcess = spawn(process.execPath, [serverScript], {
      env: { 
        ...process.env, 
        PORT: '1234',
        RUXT_DATA_DIR: userDataDir,
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
      contextIsolation: true
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

  ipcMain.on('desktop-overlay-resume', () => {
    try {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 1234,
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
          port: 1234,
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
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const targetURL = isDev ? 'http://localhost:5173' : 'http://127.0.0.1:1234';

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
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return; // Skip ERR_ABORTED when navigation is superseded
    if (validatedURL && (validatedURL.includes('1234') || validatedURL.includes('5173'))) {
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

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
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

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
