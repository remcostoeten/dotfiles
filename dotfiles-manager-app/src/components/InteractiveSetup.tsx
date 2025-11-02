import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

interface PackageStatus {
  name: string
  display_name: string
  installed: boolean
  version: string | null
}

interface SetupSection {
  name: string
  description: string
  packages: PackageStatus[]
  estimated_time: number
}

interface OutputLine {
  type: string
  message: string
  raw: string
}

export default function InteractiveSetup() {
  const [sections, setSections] = useState<SetupSection[]>([])
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set())
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<OutputLine[]>([])
  const [stats, setStats] = useState({ success: 0, errors: 0, warnings: 0 })
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadSections()
    
    // Listen for setup output
    const unlistenOutput = listen<OutputLine>('setup-output', (event) => {
      const line = event.payload
      setOutput(prev => [...prev, line])
      
      // Update stats
      if (line.type === 'success') {
        setStats(prev => ({ ...prev, success: prev.success + 1 }))
      } else if (line.type === 'error') {
        setStats(prev => ({ ...prev, errors: prev.errors + 1 }))
      } else if (line.type === 'warning') {
        setStats(prev => ({ ...prev, warnings: prev.warnings + 1 }))
      }
    })

    // Listen for setup completion
    const unlistenComplete = listen<OutputLine>('setup-complete', (event) => {
      const line = event.payload
      setOutput(prev => [...prev, line])
      setRunning(false)
    })

    return () => {
      unlistenOutput.then(fn => fn())
      unlistenComplete.then(fn => fn())
    }
  }, [])

  const loadSections = async () => {
    try {
      const result = await invoke<SetupSection[]>('get_setup_sections')
      setSections(result)
      setLoading(false)
    } catch (error) {
      console.error('Failed to load sections:', error)
      setLoading(false)
    }
  }

  const toggleSection = (sectionName: string) => {
    setSelectedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionName)) {
        next.delete(sectionName)
        // Remove all packages from this section
        const section = sections.find(s => s.name === sectionName)
        if (section) {
          section.packages.forEach(pkg => {
            setSelectedPackages(p => {
              const np = new Set(p)
              np.delete(pkg.name)
              return np
            })
          })
        }
      } else {
        next.add(sectionName)
        // Auto-select uninstalled packages
        const section = sections.find(s => s.name === sectionName)
        if (section) {
          section.packages.forEach(pkg => {
            if (!pkg.installed) {
              setSelectedPackages(p => new Set(p).add(pkg.name))
            }
          })
        }
      }
      return next
    })
  }

  const togglePackage = (packageName: string) => {
    setSelectedPackages(prev => {
      const next = new Set(prev)
      if (next.has(packageName)) {
        next.delete(packageName)
      } else {
        next.add(packageName)
      }
      return next
    })
  }

  const toggleSectionExpanded = (sectionName: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionName)) {
        next.delete(sectionName)
      } else {
        next.add(sectionName)
      }
      return next
    })
  }

  const selectAllUninstalled = () => {
    sections.forEach(section => {
      setSelectedSections(prev => new Set(prev).add(section.name))
      section.packages.forEach(pkg => {
        if (!pkg.installed) {
          setSelectedPackages(prev => new Set(prev).add(pkg.name))
        }
      })
    })
  }

  const deselectAll = () => {
    setSelectedSections(new Set())
    setSelectedPackages(new Set())
  }

  const runSetup = async (dryRun: boolean = false) => {
    setRunning(true)
    setOutput([])
    setStats({ success: 0, errors: 0, warnings: 0 })

    try {
      if (selectedSections.size === 0) {
        // Run full setup
        if (dryRun) {
          await invoke('run_setup_dry_run')
        } else {
          await invoke('run_setup')
        }
      } else {
        // Run selected sections
        for (const section of selectedSections) {
          if (dryRun) {
            await invoke('run_setup_dry_run_section', { section })
          } else {
            await invoke('run_setup_section', { section })
          }
        }
      }
    } catch (error) {
      console.error('Setup failed:', error)
      setOutput(prev => [...prev, {
        type: 'error',
        message: `Setup failed: ${error}`,
        raw: String(error)
      }])
      setRunning(false)
    }
  }

  const getTotalEstimatedTime = () => {
    let total = 0
    sections.forEach(section => {
      if (selectedSections.has(section.name)) {
        const uninstalledCount = section.packages.filter(
          p => selectedPackages.has(p.name) && !p.installed
        ).length
        total += uninstalledCount * 2 // 2 seconds per package
      }
    })
    return total
  }

  const getSelectedPackageCount = () => {
    return selectedPackages.size
  }

  const getUninstalledCount = () => {
    let count = 0
    sections.forEach(section => {
      count += section.packages.filter(p => !p.installed).length
    })
    return count
  }

  if (loading) {
    return <div className="loading">Loading setup configuration...</div>
  }

  return (
    <div className="interactive-setup">
      <div className="header">
        <h2>Interactive Setup Wizard</h2>
        <p>Select which packages to install. Already installed packages are marked with ✅</p>
      </div>

      <div className="stats-bar">
        <div className="stat">
          <strong>{sections.length}</strong> sections
        </div>
        <div className="stat">
          <strong>{getUninstalledCount()}</strong> packages need installation
        </div>
        <div className="stat">
          <strong>{getSelectedPackageCount()}</strong> selected
        </div>
        <div className="stat">
          <strong>~{getTotalEstimatedTime()}s</strong> estimated time
        </div>
      </div>

      <div className="quick-actions">
        <button onClick={selectAllUninstalled} disabled={running}>
          ✓ Select All Uninstalled
        </button>
        <button onClick={deselectAll} disabled={running}>
          ✗ Deselect All
        </button>
        <button onClick={() => runSetup(true)} disabled={running || selectedPackages.size === 0} className="btn-dry-run">
          Preview Changes
        </button>
        <button onClick={() => runSetup(false)} disabled={running || selectedPackages.size === 0} className="btn-install">
          {running ? 'Installing...' : 'Install Selected'}
        </button>
      </div>

      <div className="sections-list">
        {sections.map(section => {
          const isExpanded = expandedSections.has(section.name)
          const isSelected = selectedSections.has(section.name)
          const installedCount = section.packages.filter(p => p.installed).length
          const totalCount = section.packages.length

          return (
            <div key={section.name} className={`section-card ${isSelected ? 'selected' : ''}`}>
              <div className="section-header" onClick={() => toggleSectionExpanded(section.name)}>
                <div className="section-info">
                  <label className="checkbox-label" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSection(section.name)}
                      disabled={running}
                    />
                    <strong>{section.name}</strong>
                  </label>
                  <span className="section-stats">
                    {installedCount}/{totalCount} installed • ~{section.estimated_time}s
                  </span>
                </div>
                <button className="expand-btn">
                  {isExpanded ? '▼' : '▶'}
                </button>
              </div>

              {isExpanded && (
                <div className="packages-list">
                  {section.packages.map(pkg => (
                    <div key={pkg.name} className={`package-item ${pkg.installed ? 'installed' : ''}`}>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={selectedPackages.has(pkg.name)}
                          onChange={() => togglePackage(pkg.name)}
                          disabled={running || pkg.installed}
                        />
                        <span className="package-name">
                          {pkg.installed ? '' : ''} {pkg.display_name}
                        </span>
                      </label>
                      {pkg.version && (
                        <span className="package-version">{pkg.version}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {output.length > 0 && (
        <div className="output-section">
          <div className="output-header">
            <h3>Installation Output</h3>
            <div className="output-stats">
              <span className="stat-success">{stats.success}</span>
              <span className="stat-error">{stats.errors}</span>
              <span className="stat-warning">{stats.warnings}</span>
            </div>
          </div>
          <div className="output-content">
            {output.map((line, idx) => (
              <div key={idx} className={`output-line ${line.type}`}>
                {line.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .interactive-setup {
          padding: 20px;
          max-width: 1200px;
        }

        .header {
          margin-bottom: 20px;
        }

        .header h2 {
          margin-bottom: 8px;
        }

        .stats-bar {
          display: flex;
          gap: 20px;
          padding: 15px;
          background-color: #2a2a2a;
          border-radius: 6px;
          margin-bottom: 20px;
          border: 1px solid #444;
        }

        .stat {
          font-size: 14px;
          color: #ccc;
        }

        .stat strong {
          color: #fff;
          font-size: 18px;
          margin-right: 5px;
        }

        .quick-actions {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }

        .quick-actions button {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .quick-actions button:not(.btn-dry-run):not(.btn-install) {
          background-color: #6c757d;
          color: white;
        }

        .quick-actions button:not(.btn-dry-run):not(.btn-install):hover:not(:disabled) {
          background-color: #5a6268;
        }

        .btn-dry-run {
          background-color: #17a2b8;
          color: white;
        }

        .btn-dry-run:hover:not(:disabled) {
          background-color: #138496;
        }

        .btn-install {
          background-color: #28a745;
          color: white;
        }

        .btn-install:hover:not(:disabled) {
          background-color: #218838;
        }

        .quick-actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sections-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .section-card {
          border: 2px solid #444;
          border-radius: 6px;
          background-color: #2a2a2a;
          transition: all 0.2s;
        }

        .section-card.selected {
          border-color: #007bff;
          background-color: #1a3a52;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          cursor: pointer;
          user-select: none;
        }

        .section-info {
          display: flex;
          align-items: center;
          gap: 15px;
          flex: 1;
        }

        .section-stats {
          font-size: 14px;
          color: #ccc;
        }

        .expand-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 5px 10px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .packages-list {
          border-top: 1px solid #444;
          padding: 15px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .package-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-radius: 4px;
          background-color: #1a1a1a;
        }

        .package-item.installed {
          background-color: #1a3a1a;
        }

        .package-name {
          font-size: 14px;
          color: #ccc;
        }

        .package-version {
          font-size: 12px;
          color: #888;
          font-family: monospace;
        }

        .output-section {
          margin-top: 30px;
          border: 1px solid #444;
          border-radius: 6px;
          overflow: hidden;
        }

        .output-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          background-color: #2a2a2a;
          border-bottom: 1px solid #444;
        }

        .output-header h3 {
          margin: 0;
        }

        .output-stats {
          display: flex;
          gap: 15px;
          font-size: 14px;
        }

        .stat-success {
          color: #28a745;
        }

        .stat-error {
          color: #dc3545;
        }

        .stat-warning {
          color: #ffc107;
        }

        .output-content {
          max-height: 400px;
          overflow-y: auto;
          background-color: #1e1e1e;
          color: #d4d4d4;
          font-family: 'Courier New', monospace;
          font-size: 13px;
        }

        .output-line {
          padding: 4px 15px;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .output-line.success {
          color: #4ec9b0;
        }

        .output-line.error {
          color: #f48771;
        }

        .output-line.warning {
          color: #dcdcaa;
        }

        .output-line.status {
          color: #569cd6;
        }

        .output-line.info {
          color: #9cdcfe;
        }

        .loading {
          padding: 40px;
          text-align: center;
          font-size: 18px;
          color: #ccc;
        }
      `}</style>
    </div>
  )
}

