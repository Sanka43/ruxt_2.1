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
  overlayWindow.loadFile(path.join(__dirname, '../public/overlay.html'));

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
    const serverScript = path.join(__dirname, '../server/index.js');
    const userDataDir = isDev ? path.join(__dirname, '../data') : path.join(app.getPath('userData'), 'data');

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
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMinimized()) {
        mainWindow.minimize();
      }
      const win = createOrGetOverlayWindow();
      if (win) {
        win.setIgnoreMouseEvents(true, { forward: true });
        win.show();
        win.webContents.send('banner-update-data', data);
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

  ipcMain.on('desktop-overlay-abort', () => {
    try {
      try { globalShortcut.unregister('Escape'); } catch (_) {}
      mainWindow?.webContents.send('desktop-task-aborted');
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('banner-update-data', {
          stepText: 'Operation aborted by user',
          progress: 100,
          actionIcon: '⏹️'
        });
        setTimeout(() => {
          if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
          if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isMinimized()) {
            mainWindow.restore();
            mainWindow.focus();
          }
        }, 800);
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
  const loadWithRetry = (retries = 40, delay = 500) => {
    if (!mainWindow || mainWindow.isDestroyed() || hasLoaded) return;
    mainWindow.loadURL(targetURL)
      .then(() => {
        hasLoaded = true;
      })
      .catch((err) => {
        if (retries > 0 && !hasLoaded) {
          setTimeout(() => loadWithRetry(retries - 1, delay), delay);
        } else if (!hasLoaded) {
          console.error('Failed to load application URL after retries:', err);
        }
      });
  };

  loadWithRetry();

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

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
  // Brief delay to allow backend to bind port
  setTimeout(createWindow, 800);
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
