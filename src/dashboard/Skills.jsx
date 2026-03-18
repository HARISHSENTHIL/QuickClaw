import { useState } from 'react'

const DEFAULT_SKILLS = [
  { id: 'web_search',   label: 'Web Search',        desc: 'Search the internet for up-to-date info',   icon: '🔍', enabled: true  },
  { id: 'shell',        label: 'Shell / Terminal',   desc: 'Execute shell commands on your machine',    icon: '💻', enabled: true  },
  { id: 'file_manager', label: 'File Manager',       desc: 'Read, write and manage local files',        icon: '📁', enabled: true  },
  { id: 'code_runner',  label: 'Code Runner',        desc: 'Run Python, JS and other code snippets',    icon: '⚡', enabled: false },
  { id: 'browser',      label: 'Browser Automation', desc: 'Control a headless browser for scraping',   icon: '🌐', enabled: false },
  { id: 'memory',       label: 'Long-term Memory',   desc: 'Persist knowledge across sessions',         icon: '🧠', enabled: true  },
]

export default function Skills() {
  const [skills, setSkills] = useState(DEFAULT_SKILLS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const toggle = (id) => {
    setSaved(false)
    setSkills((prev) =>
      prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s)
    )
  }

  const handleSave = async () => {
    setSaving(true)
    const skillMap = Object.fromEntries(skills.map((s) => [s.id, { enabled: s.enabled }]))
    await window.electronAPI?.saveSkillsConfig(skillMap)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <p className="dash-page-label">AGENT</p>
        <h1 className="dash-page-title">Skills</h1>
        <p className="dash-page-sub">Choose what capabilities your agent has access to.</p>
      </div>

      <div className="skills-grid">
        {skills.map((skill) => (
          <button
            key={skill.id}
            className={`skill-card${skill.enabled ? ' skill-on' : ''}`}
            onClick={() => toggle(skill.id)}
          >
            <div className="skill-icon">{skill.icon}</div>
            <div className="skill-info">
              <span className="skill-name">{skill.label}</span>
              <span className="skill-desc">{skill.desc}</span>
            </div>
            <div className={`skill-toggle${skill.enabled ? ' toggle-on' : ''}`} />
          </button>
        ))}
      </div>

      <div className="skills-footer">
        <button className="dash-btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Skills'}
        </button>
      </div>
    </div>
  )
}
