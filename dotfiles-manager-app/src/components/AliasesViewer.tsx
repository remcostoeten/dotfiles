import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Editor from '@monaco-editor/react'
import '../App.css'

interface Alias {
  name: string
  path: string
  content: string
}

function AliasesViewer() {
  const [aliases, setAliases] = useState<Alias[]>([])
  const [selectedAlias, setSelectedAlias] = useState<Alias | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadAliases()
  }, [])

  const loadAliases = async () => {
    setLoading(true)
    setError('')
    try {
      const aliases = await invoke<Alias[]>('get_aliases')
      setAliases(aliases)
    } catch (err) {
      setError(`Failed to load aliases: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAliasClick = async (alias: Alias) => {
    try {
      const content = await invoke<string>('read_file', { path: alias.path })
      setSelectedAlias({ ...alias, content })
      setEditedContent(content)
      setHasChanges(false)
    } catch (err) {
      setError(`Failed to read alias file: ${err}`)
    }
  }

  const handleSave = async () => {
    if (!selectedAlias) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await invoke('write_file', {
        path: selectedAlias.path,
        content: editedContent
      })
      setSuccess('Alias saved successfully')
      setHasChanges(false)
      await loadAliases()
      // Reload content
      const content = await invoke<string>('read_file', { path: selectedAlias.path })
      setSelectedAlias({ ...selectedAlias, content })
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
      setHasChanges(value !== selectedAlias?.content)
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Aliases Viewer</h2>
        
        {error && <div className="error">{error}</div>}
        {loading && <div>Loading aliases...</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
          <div>
            <h3>Available Aliases</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {aliases.map(alias => (
                <li
                  key={alias.name}
                  onClick={() => handleAliasClick(alias)}
                  style={{
                    padding: '0.75rem',
                    margin: '0.5rem 0',
                    background: selectedAlias?.name === alias.name ? '#646cff' : '#1a1a1a',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{alias.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem' }}>
                    {alias.path}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {selectedAlias && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>{selectedAlias.name}</h3>
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
                Path: {selectedAlias.path}
              </div>
              {error && <div className="error">{error}</div>}
              {success && <div className="success">{success}</div>}
              <div style={{ border: '1px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
                <Editor
                  height="600px"
                  language="shell"
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

export default AliasesViewer

