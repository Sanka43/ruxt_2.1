const { app, BrowserWindow, ipcMain, shell, Menu, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let overlayWindow = null;
let serverProcess = null;
const isDev = process.env.NODE_ENV === 'development';

function createOrGetOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;
  const overlayWidth = 660;
  const overlayHeight = 72;

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: Math.round((width - overlayWidth) / 2),
    y: 18,
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

    serverProcess = spawn(process.execPath, [serverScript], {
      env: { 
        ...process.env, 
        PORT: '1234',
        RUXT_DATA_DIR: userDataDir,
        ELECTRON_RUN_AS_NODE: '1'
      },
      stdio: 'inherit'
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start RuXt background engine:', err);
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
      const win = createOrGetOverlayWindow();
      if (win) {
        win.show();
        win.webContents.send('banner-update-data', data);
      }
    } catch (err) {
      console.error('Failed to show overlay window:', err);
    }
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
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.hide();
      }
    } catch (err) {
      console.error('Failed to hide overlay window:', err);
    }
  });

  ipcMain.on('desktop-overlay-abort', () => {
    try {
      mainWindow?.webContents.send('desktop-task-aborted');
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('banner-update-data', {
          stepText: 'Operation aborted by user',
          progress: 100,
          actionIcon: '⏹️'
        });
        setTimeout(() => {
          if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
        }, 1200);
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

  const loadWithRetry = (retries = 20, delay = 500) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.loadURL(targetURL).catch((err) => {
      if (retries > 0) {
        setTimeout(() => loadWithRetry(retries - 1, delay), delay);
      } else {
        console.error('Failed to load application URL:', err);
      }
    });
  };

  loadWithRetry();

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL && (validatedURL.includes('1234') || validatedURL.includes('5173'))) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(targetURL);
        }
      }, 1000);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  startBackendServer();
  // Brief delay to allow backend to bind port
  setTimeout(createWindow, 800);

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
