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
  const [packageName, setPackageName] = useState('')
  const [installCommand, setInstallCommand] = useState('')
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
    if (!selectedArray || !packageName || !installCommand) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await invoke('add_package_to_array', {
        arrayName: selectedArray,
        packageName: packageName,
        installCommand: installCommand
      })
      setSuccess(`Added ${packageName} to ${selectedArray}`)
      setPackageName('')
      setInstallCommand('')
      await loadArrays()
    } catch (err) {
      setError(`Failed to add package: ${err}`)
    } finally {
      setLoading(false)
    }
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
          <label>Package Name (semantic):</label>
          <input
            type="text"
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            placeholder="e.g., my-package:My Package Display Name"
          />
        </div>

        <div className="form-group">
          <label>Install Script/Command:</label>
          <input
            type="text"
            value={installCommand}
            onChange={(e) => setInstallCommand(e.target.value)}
            placeholder="e.g., apt install my-package"
          />
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
                  alignItems: 'center'
                }}
              >
                <span>{pkg}</span>
                <button
                  onClick={() => handleRemovePackage(currentArray.name, index)}
                  disabled={loading}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default PackageManager

