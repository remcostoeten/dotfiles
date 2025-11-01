import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import PackageManager from './components/PackageManager'
import AliasesViewer from './components/AliasesViewer'
import FileViewer from './components/FileViewer'
import SetupManager from './components/SetupManager'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState<'packages' | 'aliases' | 'files' | 'setup'>('packages')

  return (
    <div className="app">
      <header className="app-header">
        <h1>📁 Dotfiles Manager</h1>
        <nav className="tabs">
          <button 
            className={activeTab === 'packages' ? 'active' : ''}
            onClick={() => setActiveTab('packages')}
          >
            Package Arrays
          </button>
          <button 
            className={activeTab === 'aliases' ? 'active' : ''}
            onClick={() => setActiveTab('aliases')}
          >
            Aliases
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
            Setup Manager
          </button>
        </nav>
      </header>

      <main className="app-content">
        {activeTab === 'packages' && <PackageManager />}
        {activeTab === 'aliases' && <AliasesViewer />}
        {activeTab === 'files' && <FileViewer />}
        {activeTab === 'setup' && <SetupManager />}
      </main>
    </div>
  )
}

export default App

