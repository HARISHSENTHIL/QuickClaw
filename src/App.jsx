import { useState, useEffect } from 'react'
import logoSrc from './assets/octoclaw-logo.webp?inline'
import Welcome from './steps/Welcome'
import ProviderModel from './steps/ProviderModel'
import ApiKey from './steps/ApiKey'
import Installing from './steps/Installing'
import Dashboard from './Dashboard'

const NO_KEY_PROVIDERS = ['ollama']

const STEP_PROGRESS = {
  welcome: 0,
  provider: 20,
  apikey: 55,
  installing: 80,
  dashboard: 100,
}

export default function App() {
  const [step, setStep] = useState('welcome')
  const [config, setConfig] = useState({ provider: 'openai', model: 'gpt-4o', apiKey: '' })
  const [checking, setChecking] = useState(true)

  // On launch: check if already installed → skip wizard and go straight to dashboard
  useEffect(() => {
    window.electronAPI?.checkInstalled().then((result) => {
      if (result) {
        setConfig((c) => ({ ...c, provider: result.provider, model: result.model }))
        window.electronAPI?.resizeWindow(1100, 720)
        setStep('dashboard')
      }
    }).catch(() => {}).finally(() => setChecking(false))
  }, [])

  const go = (s) => setStep(s)
  const updateConfig = (patch) => setConfig((c) => ({ ...c, ...patch }))

  const handleProviderNext = () => {
    go(NO_KEY_PROVIDERS.includes(config.provider) ? 'installing' : 'apikey')
  }

  const handleInstallDone = (ok) => {
    if (ok) {
      // Resize window for dashboard before switching
      window.electronAPI?.resizeWindow(1100, 720)
      go('dashboard')
    } else {
      go(NO_KEY_PROVIDERS.includes(config.provider) ? 'provider' : 'apikey')
    }
  }

  const progress = STEP_PROGRESS[step] ?? 0
  const isDashboard = step === 'dashboard'

  // Show nothing while checking — avoids flash of the welcome screen
  if (checking) return <div className="app-shell" />

  return (
    <div className="app-shell">
      {!isDashboard && (
        <>
          <div className="titlebar">
            <div className="titlebar-brand">
              <img src={logoSrc} alt="" className="titlebar-logo-img" />
              <span className="titlebar-name">OctoClaw</span>
            </div>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}

      {step === 'welcome' && <Welcome onNext={() => go('provider')} />}
      {step === 'provider' && (
        <ProviderModel config={config} onChange={updateConfig} onNext={handleProviderNext} onBack={() => go('welcome')} />
      )}
      {step === 'apikey' && (
        <ApiKey config={config} onChange={updateConfig} onNext={() => go('installing')} onBack={() => go('provider')} />
      )}
      {step === 'installing' && <Installing config={config} onDone={handleInstallDone} />}
      {step === 'dashboard' && <Dashboard config={config} onReset={() => go('welcome')} />}
    </div>
  )
}
