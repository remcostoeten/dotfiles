import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import '../App.css'

interface Alias {
  name: string
  path: string
  content: string
}

function AliasesViewer() {
  const [aliases, setAliases] = useState<Alias[]>([])
  const [selectedAlias, setSelectedAlias] = useState<Alias | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    } catch (err) {
      setError(`Failed to read alias file: ${err}`)
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
              <h3>{selectedAlias.name}</h3>
              <div style={{ marginBottom: '1rem' }}>
                <strong>Path:</strong> {selectedAlias.path}
              </div>
              <div className="output">
                {selectedAlias.content}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AliasesViewer

