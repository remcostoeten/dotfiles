import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Editor from '@monaco-editor/react'
import '../App.css'

interface FileInfo {
  path: string
  name: string
  type: 'file' | 'directory'
}

function FileViewer() {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [editedContent, setEditedContent] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentPath, setCurrentPath] = useState('')

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async (path?: string) => {
    setLoading(true)
    setError('')
    try {
      const dotfilesPath = await invoke<string>('get_dotfiles_path')
      const targetPath = path || dotfilesPath
      const files = await invoke<FileInfo[]>('list_files', { path: targetPath })
      setFiles(files)
      setCurrentPath(targetPath)
    } catch (err) {
      setError(`Failed to load files: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleFileClick = async (file: FileInfo) => {
    if (file.type === 'directory') {
      await loadFiles(file.path)
      setSelectedFile(null)
      setFileContent('')
      return
    }

    setSelectedFile(file)
    setLoading(true)
    setError('')
    try {
      const content = await invoke<string>('read_file', { path: file.path })
      setFileContent(content)
      setEditedContent(content)
      setHasChanges(false)
    } catch (err) {
      setError(`Failed to read file: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!selectedFile) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await invoke('write_file', {
        path: selectedFile.path,
        content: editedContent
      })
      setSuccess('File saved successfully')
      setHasChanges(false)
      setFileContent(editedContent)
    } catch (err) {
      setError(`Failed to save: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleContentChange = (value: string | undefined) => {
    if (value !== undefined) {
      setEditedContent(value)
      setHasChanges(value !== fileContent)
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
    if (path.endsWith('.md')) return 'markdown'
    if (path.endsWith('.css')) return 'css'
    if (path.endsWith('.html')) return 'html'
    return 'plaintext'
  }

  const handleOpenInGitHub = async () => {
    if (!selectedFile) return
    try {
      await invoke('open_in_github', { path: selectedFile.path })
    } catch (err) {
      setError(`Failed to open in GitHub: ${err}`)
    }
  }

  const handleOpenInSF = async () => {
    if (!selectedFile) return
    try {
      await invoke('open_in_system_file_manager', { path: selectedFile.path })
    } catch (err) {
      setError(`Failed to open in file manager: ${err}`)
    }
  }

  return (
    <div>
      <div className="card">
        <h2>File Viewer</h2>
        
        {error && <div className="error">{error}</div>}
        {loading && <div>Loading...</div>}

        <div style={{ marginBottom: '1rem' }}>
          <strong>Current Path:</strong> {currentPath}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
          <div>
            <h3>Files</h3>
            <ul style={{ listStyle: 'none', padding: 0, maxHeight: '500px', overflowY: 'auto' }}>
              {files.map(file => (
                <li
                  key={file.path}
                  onClick={() => handleFileClick(file)}
                  style={{
                    padding: '0.75rem',
                    margin: '0.5rem 0',
                    background: selectedFile?.path === file.path ? '#646cff' : '#1a1a1a',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  {file.type === 'directory' ? '' : ''} {file.name}
                </li>
              ))}
            </ul>
          </div>

          {selectedFile && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>{selectedFile.name}</h3>
                <div className="button-group">
                  {hasChanges && (
                    <span style={{ color: '#ffaa00', marginRight: '1rem' }}>● Unsaved changes</span>
                  )}
                  <button onClick={handleSave} disabled={loading || !hasChanges}>
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={handleOpenInGitHub}>
                    Open in GitHub
                  </button>
                  <button onClick={handleOpenInSF}>
                    Open in File Manager
                  </button>
                </div>
              </div>
              {error && <div className="error">{error}</div>}
              {success && <div className="success">{success}</div>}
              <div style={{ border: '1px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
                <Editor
                  height="600px"
                  language={getLanguageFromPath(selectedFile.path)}
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
                    readOnly: false,
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

export default FileViewer

