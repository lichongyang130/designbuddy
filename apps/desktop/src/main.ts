import { app, BrowserWindow, ipcMain, powerSaveBlocker } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const managedWebContents = new Set<number>();
const runtimePowerBlockers = new Map<number, number>();

function releaseRuntimePowerBlocker(contentsId: number) {
  const blockerId = runtimePowerBlockers.get(contentsId);
  if (blockerId === undefined) return;
  try {
    if (powerSaveBlocker.isStarted(blockerId)) powerSaveBlocker.stop(blockerId);
  } finally {
    runtimePowerBlockers.delete(contentsId);
  }
}

ipcMain.handle('designbuddy:runtime-sleep-blocker', (event, requested: unknown) => {
  const contentsId = event.sender.id;
  if (!managedWebContents.has(contentsId)) throw new Error('Untrusted renderer cannot control runtime sleep behavior.');
  if (typeof requested !== 'boolean') throw new TypeError('Runtime sleep request must be boolean.');
  if (requested && !runtimePowerBlockers.has(contentsId)) {
    runtimePowerBlockers.set(contentsId, powerSaveBlocker.start('prevent-display-sleep'));
  } else if (!requested) {
    releaseRuntimePowerBlocker(contentsId);
  }
});

function resolveRendererEntry(): string {
  const stagedRenderer = path.join(__dirname, 'renderer', 'index.html');
  if (fs.existsSync(stagedRenderer)) return stagedRenderer;
  return path.resolve(__dirname, '../../web/dist/index.html');
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const contentsId = win.webContents.id;
  managedWebContents.add(contentsId);
  win.webContents.once('destroyed', () => {
    managedWebContents.delete(contentsId);
    releaseRuntimePowerBlocker(contentsId);
  });

  win.once('ready-to-show', () => win.show());

  const devServerUrl = process.env.DESIGNBUDDY_DEV_SERVER_URL;
  if (!app.isPackaged && devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    void win.loadFile(resolveRendererEntry());
  }

  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  for (const contentsId of runtimePowerBlockers.keys()) releaseRuntimePowerBlocker(contentsId);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
