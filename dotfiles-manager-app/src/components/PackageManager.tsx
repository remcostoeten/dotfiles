import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import '../App.css'

interface PackageArray {
  name: string
  packages: string[]
}

function PackageManager() {
  const [arrays, setArrays] = useState<PackageArray[]>([])
  const [selectedArray, setSelectedArray] = useState<string>('')
  const [packageEntry, setPackageEntry] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadArrays()
  }, [])

  const loadArrays = async () => {
    try {
      const arrays = await invoke<PackageArray[]>('get_package_arrays')
      setArrays(arrays)
      if (arrays.length > 0 && !selectedArray) {
        setSelectedArray(arrays[0].name)
      }
    } catch (err) {
      setError(`Failed to load arrays: ${err}`)
    }
  }

  const handleAddPackage = async () => {
    if (!selectedArray || !packageEntry.trim()) {
      setError('Please enter a package entry')
      return
    }

    // Validate format: should be "package:Display Name" or just "package"
    const entry = packageEntry.trim()
    if (!entry.match(/^[^:]+(:[^:]+)?$/)) {
      setError('Invalid format. Use: "package-name" or "package-name:Display Name"')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await invoke('add_package_to_array', {
        arrayName: selectedArray,
        packageName: entry
      })
      setSuccess(`Added ${entry} to ${selectedArray}`)
      setPackageEntry('')
      await loadArrays()
    } catch (err) {
      setError(`Failed to add package: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleEditPackage = (index: number, currentValue: string) => {
    setEditingIndex(index)
    setEditValue(currentValue)
  }

  const handleSaveEdit = async () => {
    if (!selectedArray || editingIndex === null || !editValue.trim()) {
      setError('Invalid edit')
      return
    }

    const entry = editValue.trim()
    if (!entry.match(/^[^:]+(:[^:]+)?$/)) {
      setError('Invalid format. Use: "package-name" or "package-name:Display Name"')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Remove old, add new
      await invoke('remove_package_from_array', {
        arrayName: selectedArray,
        packageIndex: editingIndex
      })
      await invoke('add_package_to_array', {
        arrayName: selectedArray,
        packageName: entry
      })
      setSuccess(`Updated package in ${selectedArray}`)
      setEditingIndex(null)
      setEditValue('')
      await loadArrays()
    } catch (err) {
      setError(`Failed to update package: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditValue('')
  }

  const handleRemovePackage = async (arrayName: string, packageIndex: number) => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await invoke('remove_package_from_array', {
        arrayName: arrayName,
        packageIndex: packageIndex
      })
      setSuccess('Package removed')
      await loadArrays()
    } catch (err) {
      setError(`Failed to remove package: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const currentArray = arrays.find(a => a.name === selectedArray)

  return (
    <div>
      <div className="card">
        <h2>Package Array Management</h2>
        
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <div className="form-group">
          <label>Select Array:</label>
          <select 
            value={selectedArray} 
            onChange={(e) => setSelectedArray(e.target.value)}
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
            {arrays.map(arr => (
              <option key={arr.name} value={arr.name}>{arr.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Package Entry:</label>
          <input
            type="text"
            value={packageEntry}
            onChange={(e) => setPackageEntry(e.target.value)}
            placeholder='e.g., "my-package" or "my-package:My Package Display Name"'
          />
          <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem' }}>
            Format: package-name or package-name:Display Name
          </div>
        </div>

        <div className="button-group">
          <button onClick={handleAddPackage} disabled={loading}>
            {loading ? 'Adding...' : 'Add Package'}
          </button>
        </div>
      </div>

      {currentArray && (
        <div className="card">
          <h3>Packages in {currentArray.name}</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {currentArray.packages.map((pkg, index) => (
              <li 
                key={index}
                style={{
                  padding: '0.75rem',
                  margin: '0.5rem 0',
                  background: '#0a0a0a',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {editingIndex === index ? (
                  <>
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.9rem' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit()
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      autoFocus
                    />
                    <button
                      onClick={handleSaveEdit}
                      disabled={loading}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={loading}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1 }}>{pkg}</span>
                    <button
                      onClick={() => handleEditPackage(index, pkg)}
                      disabled={loading}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRemovePackage(currentArray.name, index)}
                      disabled={loading}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', background: '#4a1a1a' }}
                    >
                      Remove
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default PackageManager

