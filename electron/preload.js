const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Installer
  runInstall: (config) => ipcRenderer.send('run-install', config),
  onLog: (cb) => ipcRenderer.on('install-log', (_, msg) => cb(msg)),
  onDone: (cb) => ipcRenderer.on('install-done', (_, result) => cb(result)),
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('install-log')
    ipcRenderer.removeAllListeners('install-done')
  },
  openUrl: (url) => ipcRenderer.send('open-url', url),
  // Dashboard
  resizeWindow: (w, h) => ipcRenderer.send('resize-window', { width: w, height: h }),
  readGatewayToken: () => ipcRenderer.invoke('read-gateway-token'),
  saveTelegramConfig: (data) => ipcRenderer.invoke('save-telegram-config', data),
  saveSkillsConfig: (skills) => ipcRenderer.invoke('save-skills-config', skills),
  readConfig: () => ipcRenderer.invoke('read-config'),
  checkInstalled: () => ipcRenderer.invoke('check-installed'),
  ensureGateway: () => ipcRenderer.invoke('ensure-gateway'),
})
