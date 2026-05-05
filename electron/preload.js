const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  runInstall: (config) => ipcRenderer.send('run-install', config),
  onDone: (cb) => ipcRenderer.on('install-done', (_, result) => cb(result)),
  onLog:  (cb) => ipcRenderer.on('install-log',  (_, line)   => cb(line)),
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('install-log')
    ipcRenderer.removeAllListeners('install-done')
  },
  openUrl: (url) => ipcRenderer.send('open-url', url),
  resizeWindow: (w, h) => ipcRenderer.send('resize-window', { width: w, height: h }),
  readGatewayToken: () => ipcRenderer.invoke('read-gateway-token'),
  saveTelegramConfig: (data) => ipcRenderer.invoke('save-telegram-config', data),
  saveSkillsConfig: (skills) => ipcRenderer.invoke('save-skills-config', skills),
  readConfig: () => ipcRenderer.invoke('read-config'),
  checkInstalled: () => ipcRenderer.invoke('check-installed'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  probeGateway: () => ipcRenderer.invoke('probe-gateway'),
  ensureGateway: () => ipcRenderer.invoke('ensure-gateway'),
  onGatewayStage: (cb) => {
    const handler = (_, msg) => cb(msg)
    ipcRenderer.on('gateway-stage', handler)
    return () => ipcRenderer.removeListener('gateway-stage', handler)
  },
  resetTelegramConfig: () => ipcRenderer.invoke('reset-telegram-config'),
  installIntegrationSkill: (data) => ipcRenderer.invoke('install-integration-skill', data),
  readIntegrationSkills: () => ipcRenderer.invoke('read-integration-skills'),
  resetIntegrationSkill: (data) => ipcRenderer.invoke('reset-integration-skill', data),
  factoryReset: () => ipcRenderer.invoke('factory-reset'),
  onGatewayRestart: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('gateway-restart', handler)
    return () => ipcRenderer.removeListener('gateway-restart', handler)
  },
  onUpdateAvailable: (cb) => {
    const handler = (_, info) => cb(info)
    ipcRenderer.on('update-available', handler)
    return () => ipcRenderer.removeListener('update-available', handler)
  },
  onUpdateDownloaded: (cb) => {
    const handler = (_, info) => cb(info)
    ipcRenderer.on('update-downloaded', handler)
    return () => ipcRenderer.removeListener('update-downloaded', handler)
  },
  installUpdate: () => ipcRenderer.send('install-update'),
})
