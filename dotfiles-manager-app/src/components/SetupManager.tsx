import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import '../App.css'

interface OutputLine {
  type: 'info' | 'success' | 'error' | 'warning' | 'status' | 'dry-run' | 'output'
  message: string
  raw: string
}

function SetupManager() {
  const [output, setOutput] = useState<OutputLine[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [selectedSection, setSelectedSection] = useState('')
  const [error, setError] = useState('')
  const [successCount, setSuccessCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [currentStep, setCurrentStep] = useState('')

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

  // Listen for setup output events
  useEffect(() => {
    const setupOutputListener = listen<OutputLine>('setup-output', (event) => {
      const line = event.payload
      setOutput(prev => [...prev, line])
      
      // Update counters
      if (line.type === 'success') {
        setSuccessCount(prev => prev + 1)
      } else if (line.type === 'error') {
        setErrorCount(prev => prev + 1)
      }
      
      // Update current step
      if (line.type === 'status' || line.type === 'info') {
        setCurrentStep(line.message)
      }
    })

    const setupCompleteListener = listen<OutputLine>('setup-complete', (event) => {
      const completion = event.payload
      setOutput(prev => [...prev, completion])
      setIsRunning(false)
      
      if (completion.type === 'error') {
        setError(completion.message)
      }
    })

    return () => {
      setupOutputListener.then(unlisten => unlisten())
      setupCompleteListener.then(unlisten => unlisten())
    }
  }, [])

  const handleRunSetup = async () => {
    setIsRunning(true)
    setOutput([])
    setError('')
    setSuccessCount(0)
    setErrorCount(0)
    setCurrentStep('')

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
      setIsRunning(false)
    }
  }

  const scrollToBottom = () => {
    const outputElement = document.getElementById('setup-output')
    if (outputElement) {
      outputElement.scrollTop = outputElement.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [output])

  return (
    <div>
      <div className="card">
        <h2>Setup Manager</h2>
        
        {error && <div className="error">{error}</div>}

        {/* Progress Stats */}
        {(isRunning || output.length > 0) && (
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '1rem',
            padding: '1rem',
            background: '#0a0a0a',
            borderRadius: '8px'
          }}>
            <div>
              <strong style={{ color: '#6bff6b' }}>Success:</strong> {successCount}
            </div>
            <div>
              <strong style={{ color: '#ff6b6b' }}>Errors:</strong> {errorCount}
            </div>
            {currentStep && (
              <div style={{ flex: 1, textAlign: 'right' }}>
                <strong>Current:</strong> <span style={{ color: '#6bcfff' }}>{currentStep}</span>
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              style={{ marginRight: '0.5rem' }}
            />
            Dry Run Mode (Preview without installing)
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
          <button onClick={() => {
            setOutput([])
            setSuccessCount(0)
            setErrorCount(0)
            setCurrentStep('')
          }} disabled={isRunning}>
            Clear Output
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Output {isRunning && <span style={{ color: '#6bcfff' }}>(Running...)</span>}</h3>
        <div id="setup-output" className="output" style={{ maxHeight: '600px' }}>
          {output.length === 0 ? (
            <div style={{ color: '#888' }}>No output yet. Click "Run Setup" to start.</div>
          ) : (
            output.map((line, index) => (
              <div key={index} className={`line ${line.type}`}>
                {line.type === 'success' && <span style={{ color: '#6bff6b' }}></span>}
                {line.type === 'error' && <span style={{ color: '#ff6b6b' }}></span>}
                {line.type === 'warning' && <span style={{ color: '#ffaa00' }}></span>}
                {line.type === 'status' && <span style={{ color: '#6bcfff' }}></span>}
                {line.type === 'info' && <span style={{ color: '#6bcfff' }}></span>}
                {' '}
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
