import { useState, useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import PackageManager from './components/PackageManager'
import AliasesViewer from './components/AliasesViewer'
import FunctionsViewer from './components/FunctionsViewer'
import ScriptsManager from './components/ScriptsManager'
import ConfigsBrowser from './components/ConfigsBrowser'
import FileViewer from './components/FileViewer'
import GitManager from './components/GitManager'
import SetupManager from './components/SetupManager'
import BackupManager from './components/BackupManager'
import InteractiveSetup from './components/InteractiveSetup'
import Terminal from './components/Terminal'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState<'packages' | 'aliases' | 'functions' | 'scripts' | 'configs' | 'files' | 'git' | 'setup' | 'interactive' | 'backup' | 'terminal'>('interactive')

  useEffect(() => {
    // Listen for system tray quick actions
    const unlisten = listen<string>('quick-action', (event) => {
      const action = event.payload
      switch (action) {
        case 'backup':
          setActiveTab('backup')
          break
        case 'git-status':
          setActiveTab('git')
          break
        case 'terminal':
          setActiveTab('terminal')
          break
      }
    })

    return () => {
      unlisten.then(fn => fn())
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Dotfiles Manager</h1>
        <nav className="tabs">
          <button 
            className={activeTab === 'interactive' ? 'active' : ''}
            onClick={() => setActiveTab('interactive')}
          >
            Interactive Setup
          </button>
          <button 
            className={activeTab === 'backup' ? 'active' : ''}
            onClick={() => setActiveTab('backup')}
          >
            Backup
          </button>
          <button 
            className={activeTab === 'terminal' ? 'active' : ''}
            onClick={() => setActiveTab('terminal')}
          >
            Terminal
          </button>
          <button 
            className={activeTab === 'packages' ? 'active' : ''}
            onClick={() => setActiveTab('packages')}
          >
            Packages
          </button>
          <button 
            className={activeTab === 'aliases' ? 'active' : ''}
            onClick={() => setActiveTab('aliases')}
          >
            Aliases
          </button>
          <button 
            className={activeTab === 'functions' ? 'active' : ''}
            onClick={() => setActiveTab('functions')}
          >
            Functions
          </button>
          <button 
            className={activeTab === 'git' ? 'active' : ''}
            onClick={() => setActiveTab('git')}
          >
            Git
          </button>
          <button 
            className={activeTab === 'files' ? 'active' : ''}
            onClick={() => setActiveTab('files')}
          >
            Files
          </button>
          <button 
            className={activeTab === 'setup' ? 'active' : ''}
            onClick={() => setActiveTab('setup')}
          >
            Setup
          </button>
        </nav>
      </header>

      <main className="app-content">
        {activeTab === 'interactive' && <InteractiveSetup />}
        {activeTab === 'backup' && <BackupManager />}
        {activeTab === 'terminal' && <Terminal />}
        {activeTab === 'packages' && <PackageManager />}
        {activeTab === 'aliases' && <AliasesViewer />}
        {activeTab === 'functions' && <FunctionsViewer />}
        {activeTab === 'scripts' && <ScriptsManager />}
        {activeTab === 'configs' && <ConfigsBrowser />}
        {activeTab === 'files' && <FileViewer />}
        {activeTab === 'git' && <GitManager />}
        {activeTab === 'setup' && <SetupManager />}
      </main>
    </div>
  )
}

export default App

