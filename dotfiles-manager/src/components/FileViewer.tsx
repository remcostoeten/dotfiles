import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
    } catch (err) {
      setError(`Failed to read file: ${err}`)
    } finally {
      setLoading(false)
    }
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
                  {file.type === 'directory' ? '📁' : '📄'} {file.name}
                </li>
              ))}
            </ul>
          </div>

          {selectedFile && (
            <div>
              <h3>{selectedFile.name}</h3>
              <div className="button-group" style={{ marginBottom: '1rem' }}>
                <button onClick={handleOpenInGitHub}>
                  Open in GitHub
                </button>
                <button onClick={handleOpenInSF}>
                  Open in File Manager
                </button>
              </div>
              <div className="output">
                {fileContent}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FileViewer

