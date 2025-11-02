import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Editor from '@monaco-editor/react'
import '../App.css'

interface Function {
  name: string
  path: string
  content: string
}

function FunctionsViewer() {
  const [functions, setFunctions] = useState<Function[]>([])
  const [selectedFunction, setSelectedFunction] = useState<Function | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadFunctions()
  }, [])

  const loadFunctions = async () => {
    setLoading(true)
    setError('')
    try {
      const functions = await invoke<Function[]>('get_functions')
      setFunctions(functions)
    } catch (err) {
      setError(`Failed to load functions: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleFunctionClick = async (func: Function) => {
    try {
      const content = await invoke<string>('read_file', { path: func.path })
      setSelectedFunction({ ...func, content })
      setEditedContent(content)
      setHasChanges(false)
    } catch (err) {
      setError(`Failed to read function file: ${err}`)
    }
  }

  const handleSave = async () => {
    if (!selectedFunction) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await invoke('write_file', {
        path: selectedFunction.path,
        content: editedContent
      })
      setSuccess('Function saved successfully')
      setHasChanges(false)
      await loadFunctions()
      // Reload content
      const content = await invoke<string>('read_file', { path: selectedFunction.path })
      setSelectedFunction({ ...selectedFunction, content })
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
      setHasChanges(value !== selectedFunction?.content)
    }
  }

  const getLanguageFromPath = (path: string): string => {
    if (path.endsWith('.fish')) return 'shell'
    if (path.endsWith('.sh')) return 'shell'
    if (path.endsWith('.py')) return 'python'
    if (path.endsWith('.ts')) return 'typescript'
    if (path.endsWith('.js')) return 'javascript'
    if (path.endsWith('.rs')) return 'rust'
    if (path.endsWith('.toml')) return 'toml'
    if (path.endsWith('.json')) return 'json'
    return 'plaintext'
  }

  return (
    <div>
      <div className="card">
        <h2>Fish Functions Viewer</h2>
        
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        {loading && <div>Loading functions...</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
          <div>
            <h3>Available Functions</h3>
            <ul style={{ listStyle: 'none', padding: 0, maxHeight: '600px', overflowY: 'auto' }}>
              {functions.map(func => (
                <li
                  key={func.name}
                  onClick={() => handleFunctionClick(func)}
                  style={{
                    padding: '0.75rem',
                    margin: '0.5rem 0',
                    background: selectedFunction?.name === func.name ? '#646cff' : '#1a1a1a',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{func.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem' }}>
                    {func.path}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {selectedFunction && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>{selectedFunction.name}</h3>
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
                Path: {selectedFunction.path}
              </div>
              <div style={{ border: '1px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
                <Editor
                  height="600px"
                  language={getLanguageFromPath(selectedFunction.path)}
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

export default FunctionsViewer

