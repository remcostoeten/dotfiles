import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Editor from '@monaco-editor/react'
import '../App.css'

interface Script {
  name: string
  path: string
  content: string
  type: 'file' | 'directory'
}

function ScriptsManager() {
  const [scripts, setScripts] = useState<Script[]>([])
  const [selectedScript, setSelectedScript] = useState<Script | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentPath, setCurrentPath] = useState('')

  useEffect(() => {
    loadScripts()
  }, [])

  const loadScripts = async (path?: string) => {
    setLoading(true)
    setError('')
    try {
      const dotfilesPath = await invoke<string>('get_dotfiles_path')
      const targetPath = path || `${dotfilesPath}/scripts`
      const scripts = await invoke<Script[]>('list_files', { path: targetPath })
      setScripts(scripts)
      setCurrentPath(targetPath)
    } catch (err) {
      setError(`Failed to load scripts: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleScriptClick = async (script: Script) => {
    if (script.type === 'directory') {
      await loadScripts(script.path)
      setSelectedScript(null)
      setEditedContent('')
      return
    }

    setSelectedScript(script)
    setLoading(true)
    setError('')
    try {
      const content = await invoke<string>('read_file', { path: script.path })
      setEditedContent(content)
      setHasChanges(false)
    } catch (err) {
      setError(`Failed to read script: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!selectedScript) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await invoke('write_file', {
        path: selectedScript.path,
        content: editedContent
      })
      setSuccess('Script saved successfully')
      setHasChanges(false)
      await loadScripts(currentPath)
      // Reload content
      const content = await invoke<string>('read_file', { path: selectedScript.path })
      setSelectedScript({ ...selectedScript, content })
      setEditedContent(content)
    } catch (err) {
      setError(`Failed to save: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleContentChange = (value: string | undefined) => {
    if (value !== undefined) {
      setEditedContent(value)
      setHasChanges(value !== selectedScript?.content)
    }
  }

  const getLanguageFromPath = (path: string): string => {
    if (path.endsWith('.fish')) return 'shell'
    if (path.endsWith('.sh')) return 'shell'
    if (path.endsWith('.py')) return 'python'
    if (path.endsWith('.ts')) return 'typescript'
    if (path.endsWith('.tsx')) return 'typescript'
    if (path.endsWith('.js')) return 'javascript'
    if (path.endsWith('.jsx')) return 'javascript'
    if (path.endsWith('.rs')) return 'rust'
    if (path.endsWith('.toml')) return 'toml'
    if (path.endsWith('.json')) return 'json'
    if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml'
    return 'plaintext'
  }

  return (
    <div>
      <div className="card">
        <h2>Scripts Manager</h2>
        
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        {loading && <div>Loading...</div>}

        <div style={{ marginBottom: '1rem' }}>
          <strong>Current Path:</strong> {currentPath}
          {currentPath.includes('/scripts') && currentPath.split('/').length > currentPath.split('/scripts')[0].split('/').length + 1 && (
            <button
              onClick={async () => {
                const dotfilesPath = await invoke<string>('get_dotfiles_path')
                await loadScripts(`${dotfilesPath}/scripts`)
              }}
              style={{ marginLeft: '1rem', padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
            >
              Back to scripts/
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
          <div>
            <h3>Scripts</h3>
            <ul style={{ listStyle: 'none', padding: 0, maxHeight: '600px', overflowY: 'auto' }}>
              {scripts.map(script => (
                <li
                  key={script.path}
                  onClick={() => handleScriptClick(script)}
                  style={{
                    padding: '0.75rem',
                    margin: '0.5rem 0',
                    background: selectedScript?.path === script.path ? '#646cff' : '#1a1a1a',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  {script.type === 'directory' ? '📁' : '📄'} {script.name}
                </li>
              ))}
            </ul>
          </div>

          {selectedScript && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>{selectedScript.name}</h3>
                <div className="button-group">
                  {hasChanges && (
                    <span style={{ color: '#ffaa00', marginRight: '1rem' }}>● Unsaved changes</span>
                  )}
                  <button onClick={handleSave} disabled={loading || !hasChanges}>
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#888' }}>
                Path: {selectedScript.path}
              </div>
              <div style={{ border: '1px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
                <Editor
                  height="600px"
                  language={getLanguageFromPath(selectedScript.path)}
                  value={editedContent}
                  onChange={handleContentChange}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    wordWrap: 'on',
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    formatOnPaste: true,
                    formatOnType: true,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ScriptsManager

