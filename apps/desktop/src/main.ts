import { app, BrowserWindow } from 'electron';
import path from 'node:path';

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  const devServerUrl = process.env.DESIGNBUDDY_DEV_SERVER_URL;
  if (!app.isPackaged && devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    // The packaging configuration must copy the built renderer to this location.
    const rendererIndex = path.resolve(__dirname, '../../web/dist/index.html');
    void win.loadFile(rendererIndex);
  }

  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
