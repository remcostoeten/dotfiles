import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import '../App.css'

interface GitStatus {
  branch: string
  status: string
  changes: {
    modified: string[]
    added: string[]
    deleted: string[]
    untracked: string[]
  }
}

function GitManager() {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [commitMessage, setCommitMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [output, setOutput] = useState<string[]>([])

  useEffect(() => {
    loadGitStatus()
  }, [])

  const loadGitStatus = async () => {
    setLoading(true)
    setError('')
    try {
      const status = await invoke<GitStatus>('get_git_status')
      setGitStatus(status)
    } catch (err) {
      setError(`Failed to load git status: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleGitCommand = async (command: string, ...args: string[]) => {
    setLoading(true)
    setError('')
    setSuccess('')
    setOutput([])

    try {
      const result = await invoke<string>('run_git_command', {
        command,
        args: args
      })
      setOutput(result.split('\n').filter(line => line.trim()))
      setSuccess(`Git ${command} completed successfully`)
      await loadGitStatus()
    } catch (err) {
      setError(`Git ${command} failed: ${err}`)
      setOutput([`Error: ${err}`])
    } finally {
      setLoading(false)
    }
  }

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setError('Please enter a commit message')
      return
    }

    await handleGitCommand('commit', '-m', commitMessage)
    setCommitMessage('')
  }

  const handlePush = async () => {
    await handleGitCommand('push')
  }

  const handleAddAll = async () => {
    await handleGitCommand('add', '-A')
  }

  return (
    <div>
      <div className="card">
        <h2>Git Manager</h2>
        
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        {loading && <div>Loading...</div>}

        {gitStatus && (
          <div style={{ marginBottom: '2rem' }}>
            <h3>Current Status</h3>
            <div style={{ background: '#0a0a0a', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Branch:</strong> <span style={{ color: '#6bcfff' }}>{gitStatus.branch}</span>
              </div>
              
              {gitStatus.changes.modified.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong style={{ color: '#ffaa00' }}>Modified:</strong>
                  <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                    {gitStatus.changes.modified.map(file => (
                      <li key={file} style={{ fontSize: '0.9rem' }}>{file}</li>
                    ))}
                  </ul>
                </div>
              )}

              {gitStatus.changes.added.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong style={{ color: '#6bff6b' }}>Added:</strong>
                  <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                    {gitStatus.changes.added.map(file => (
                      <li key={file} style={{ fontSize: '0.9rem' }}>{file}</li>
                    ))}
                  </ul>
                </div>
              )}

              {gitStatus.changes.deleted.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong style={{ color: '#ff6b6b' }}>Deleted:</strong>
                  <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                    {gitStatus.changes.deleted.map(file => (
                      <li key={file} style={{ fontSize: '0.9rem' }}>{file}</li>
                    ))}
                  </ul>
                </div>
              )}

              {gitStatus.changes.untracked.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong style={{ color: '#888' }}>Untracked:</strong>
                  <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                    {gitStatus.changes.untracked.map(file => (
                      <li key={file} style={{ fontSize: '0.9rem' }}>{file}</li>
                    ))}
                  </ul>
                </div>
              )}

              {gitStatus.changes.modified.length === 0 &&
               gitStatus.changes.added.length === 0 &&
               gitStatus.changes.deleted.length === 0 &&
               gitStatus.changes.untracked.length === 0 && (
                <div style={{ color: '#6bff6b', marginTop: '1rem' }}>
                  ✓ Working directory clean
                </div>
              )}
            </div>
          </div>
        )}

        <div className="card">
          <h3>Git Operations</h3>
          
          <div className="button-group" style={{ marginBottom: '1rem' }}>
            <button onClick={loadGitStatus} disabled={loading}>
              Refresh Status
            </button>
            <button onClick={handleAddAll} disabled={loading}>
              Add All Changes
            </button>
          </div>

          <div className="form-group">
            <label>Commit Message:</label>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Enter commit message..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleCommit()
                }
              }}
            />
          </div>

          <div className="button-group">
            <button onClick={handleCommit} disabled={loading || !commitMessage.trim()}>
              {loading ? 'Committing...' : 'Commit'}
            </button>
            <button onClick={handlePush} disabled={loading}>
              {loading ? 'Pushing...' : 'Push'}
            </button>
          </div>
        </div>

        {output.length > 0 && (
          <div className="card">
            <h3>Output</h3>
            <div className="output">
              {output.map((line, index) => (
                <div key={index} className="line output">
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GitManager

