const { app, BrowserWindow, Tray, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let tray = null;
let serverProcess = null;

const PORT = 42000;

const http = require('http');

function startHubServer() {
  const req = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
    console.log('[Electron] Hub Server already online on port', PORT);
  });
  req.on('error', () => {
    console.log('[Electron] Spawning background Hub Server...');
    const serverPath = path.join(__dirname, '../server/index.js');
    serverProcess = spawn('node', [serverPath], {
      cwd: path.join(__dirname, '..'),
      windowsHide: true,
      stdio: 'inherit'
    });

    serverProcess.on('error', (err) => {
      console.error('[Electron] Failed to start server process:', err);
    });
  });
  req.setTimeout(800, () => {
    req.destroy();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 400,
    minHeight: 600,
    title: 'Personal Assistant',
    backgroundColor: '#131314',
    icon: path.join(__dirname, '../public/gemini-spark.svg'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load local hub server
  const startUrl = process.env.VITE_DEV_SERVER_URL || `http://localhost:${PORT}`;
  
  // Wait slightly for server to spin up
  setTimeout(() => {
    mainWindow.loadURL(startUrl).catch(() => {
      // Retry once if server is still spinning up
      setTimeout(() => mainWindow.loadURL(startUrl), 1500);
    });
  }, 1000);

  mainWindow.on('close', (event) => {
    // Keep running in background when closed, or exit
    // If tray is enabled, we can hide instead of quit
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Intercept in-app navigation to external websites and open in user's default browser (Chrome)
    const isLocal = url.startsWith(`http://localhost:${PORT}`) || url.startsWith(`http://127.0.0.1:${PORT}`);
    if (!isLocal) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

function createTray() {
  // Simple tray icon support
  try {
    const iconPath = path.join(__dirname, '../public/gemini-spark.svg');
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Personal Assistant',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          if (serverProcess) serverProcess.kill();
          app.quit();
        }
      }
    ]);
    tray.setToolTip('Personal Assistant (Worldwide Agent Host)');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.log('[Electron] Tray initialization skipped:', err.message);
  }
}

app.whenReady().then(() => {
  startHubServer();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverProcess) serverProcess.kill();
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
