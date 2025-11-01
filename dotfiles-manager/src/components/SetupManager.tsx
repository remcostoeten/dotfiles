import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import '../App.css'

interface OutputLine {
  type: 'info' | 'success' | 'error' | 'output'
  message: string
  timestamp: number
}

function SetupManager() {
  const [output, setOutput] = useState<OutputLine[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [selectedSection, setSelectedSection] = useState('')
  const [error, setError] = useState('')

  const sections = [
    'dev',
    'cli',
    'browsers',
    'snaps',
    'config-apps',
    'git',
    'fish',
    'fonts',
    'communication',
    'media',
    'devops',
    'system',
    'automation',
    'media-playback',
    'gnome',
    'tools',
    'android'
  ]

  const addOutputLine = (type: OutputLine['type'], message: string) => {
    setOutput(prev => [...prev, { type, message, timestamp: Date.now() }])
  }

  const handleRunSetup = async () => {
    setIsRunning(true)
    setOutput([])
    setError('')

    try {
      if (dryRun) {
        if (selectedSection) {
          await invoke('run_setup_dry_run_section', { section: selectedSection })
        } else {
          await invoke('run_setup_dry_run')
        }
      } else {
        if (selectedSection) {
          await invoke('run_setup_section', { section: selectedSection })
        } else {
          await invoke('run_setup')
        }
      }
    } catch (err) {
      setError(`Setup failed: ${err}`)
      addOutputLine('error', `❌ ERROR: ${err}`)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Setup Manager</h2>
        
        {error && <div className="error">{error}</div>}

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              style={{ marginRight: '0.5rem' }}
            />
            Dry Run Mode
          </label>
        </div>

        <div className="form-group">
          <label>Run Specific Section (optional):</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '0.6em 1em',
              borderRadius: '8px',
              border: '1px solid #444',
              background: '#1a1a1a',
              color: 'white',
              fontSize: '1em'
            }}
          >
            <option value="">All Sections</option>
            {sections.map(section => (
              <option key={section} value={section}>{section}</option>
            ))}
          </select>
        </div>

        <div className="button-group">
          <button onClick={handleRunSetup} disabled={isRunning}>
            {isRunning ? 'Running...' : dryRun ? 'Run Dry Run' : 'Run Setup'}
          </button>
          <button onClick={() => setOutput([])} disabled={isRunning}>
            Clear Output
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Output</h3>
        <div className="output">
          {output.length === 0 ? (
            <div style={{ color: '#888' }}>No output yet. Click "Run Setup" to start.</div>
          ) : (
            output.map((line, index) => (
              <div key={index} className={`line ${line.type}`}>
                {line.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default SetupManager

