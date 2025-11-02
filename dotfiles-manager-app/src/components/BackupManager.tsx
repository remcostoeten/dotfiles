import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface Backup {
  id: string
  name: string
  timestamp: string
  size: number
  path: string
}

export default function BackupManager() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(false)
  const [newBackupName, setNewBackupName] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadBackups()
  }, [])

  const loadBackups = async () => {
    try {
      const result = await invoke<Backup[]>('list_backups')
      setBackups(result)
    } catch (error) {
      console.error('Failed to load backups:', error)
      setMessage({ type: 'error', text: `Failed to load backups: ${error}` })
    }
  }

  const createBackup = async () => {
    if (!newBackupName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a backup name' })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      await invoke('create_backup', { name: newBackupName })
      setMessage({ type: 'success', text: 'Backup created successfully!' })
      setNewBackupName('')
      loadBackups()
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to create backup: ${error}` })
    } finally {
      setLoading(false)
    }
  }

  const restoreBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to restore this backup? Current files will be backed up first.')) {
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const result = await invoke<string>('restore_backup', { backupId })
      setMessage({ type: 'success', text: result })
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to restore backup: ${error}` })
    } finally {
      setLoading(false)
    }
  }

  const deleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) {
      return
    }

    try {
      await invoke('delete_backup', { backupId })
      setMessage({ type: 'success', text: 'Backup deleted successfully' })
      loadBackups()
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to delete backup: ${error}` })
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  return (
    <div className="backup-manager">
      <div className="section">
        <h2>Backup & Restore System</h2>
        <p>Create backups of your dotfiles before making changes. Backups are stored in ~/.dotfiles-backups</p>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="section">
        <h3>Create New Backup</h3>
        <div className="backup-create">
          <input
            type="text"
            value={newBackupName}
            onChange={(e) => setNewBackupName(e.target.value)}
            placeholder="Backup name (e.g., before-major-changes)"
            disabled={loading}
          />
          <button onClick={createBackup} disabled={loading}>
            {loading ? 'Creating...' : 'Create Backup'}
          </button>
        </div>
      </div>

      <div className="section">
        <h3>Available Backups ({backups.length})</h3>
        {backups.length === 0 ? (
          <p className="empty-state">No backups yet. Create your first backup above.</p>
        ) : (
          <div className="backups-list">
            {backups.map((backup) => (
              <div key={backup.id} className="backup-item">
                <div className="backup-info">
                  <div className="backup-name">{backup.name}</div>
                  <div className="backup-details">
                    <span className="backup-date">{formatDate(backup.timestamp)}</span>
                    <span className="backup-size">{formatBytes(backup.size)}</span>
                  </div>
                  <div className="backup-path">{backup.path}</div>
                </div>
                <div className="backup-actions">
                  <button
                    onClick={() => restoreBackup(backup.id)}
                    disabled={loading}
                    className="btn-restore"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => deleteBackup(backup.id)}
                    disabled={loading}
                    className="btn-delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .backup-manager {
          padding: 20px;
        }

        .section {
          margin-bottom: 30px;
        }

        .section h2 {
          margin-bottom: 10px;
        }

        .section h3 {
          margin-bottom: 15px;
          color: #666;
        }

        .message {
          padding: 12px 20px;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .message.success {
          background-color: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .message.error {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .backup-create {
          display: flex;
          gap: 10px;
        }

        .backup-create input {
          flex: 1;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .backup-create button {
          padding: 10px 20px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        .backup-create button:hover:not(:disabled) {
          background-color: #0056b3;
        }

        .backup-create button:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }

        .backups-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .backup-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 6px;
          background-color: #f9f9f9;
        }

        .backup-info {
          flex: 1;
        }

        .backup-name {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 8px;
        }

        .backup-details {
          display: flex;
          gap: 20px;
          font-size: 14px;
          color: #666;
          margin-bottom: 5px;
        }

        .backup-path {
          font-size: 12px;
          color: #999;
          font-family: monospace;
        }

        .backup-actions {
          display: flex;
          gap: 10px;
        }

        .backup-actions button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .btn-restore {
          background-color: #28a745;
          color: white;
        }

        .btn-restore:hover:not(:disabled) {
          background-color: #218838;
        }

        .btn-delete {
          background-color: #dc3545;
          color: white;
        }

        .btn-delete:hover:not(:disabled) {
          background-color: #c82333;
        }

        .backup-actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .empty-state {
          padding: 40px;
          text-align: center;
          color: #999;
          font-style: italic;
        }
      `}</style>
    </div>
  )
}

