const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('designBuddyDesktop', Object.freeze({
  setRuntimeSleepBlocker(active) {
    if (typeof active !== 'boolean') return Promise.reject(new TypeError('active must be boolean'));
    return ipcRenderer.invoke('designbuddy:runtime-sleep-blocker', active);
  },
}));
