import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

function starshipDevApi(): Plugin {
  return {
    name: 'starship-dev-api',
    apply: 'serve',
    configureServer(server) {
      // Simple health check endpoint first
      server.middlewares.use('/api/health', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
      })
      
      async function readBody(req: any): Promise<any> {
        return new Promise((resolve) => {
          let data = ''
          req.on('data', (chunk: any) => { data += chunk })
          req.on('end', () => {
            try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) }
          })
        })
      }
      server.middlewares.use('/api/preview', async (req, res) => {
        if (req.method !== 'POST') { 
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
          return
        }
        
        let body
        try {
          body = await readBody(req)
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }))
          return
        }
        
        const { toml, cwd } = body || {}
        if (!toml || typeof toml !== 'string') { 
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Missing or invalid toml field' }))
          return
        }
        
        if (toml.length > 50000) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'TOML content too large (max 50KB)' }))
          return
        }
        
        const fs = await import('fs')
        const os = await import('os')
        const path = await import('path')
        const { spawn } = await import('child_process')
        const tmpDir = os.tmpdir()
        const tmpPath = path.join(tmpDir, `starship-preview-${Date.now()}-${Math.random().toString(36).substring(7)}.toml`)
        
        let responded = false
        function safeEnd(status: number, payload: any) {
          if (responded) return
          responded = true
          try { fs.unlinkSync(tmpPath) } catch {}
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = status
          res.end(JSON.stringify(payload))
        }
        
        try {
          fs.writeFileSync(tmpPath, toml, 'utf8')
        } catch (e: any) {
          safeEnd(500, { ok: false, error: `Failed to write temp file: ${e?.message}` })
          return
        }
        
        const baseEnv = { 
          ...(process.env as NodeJS.ProcessEnv), 
          STARSHIP_CONFIG: tmpPath,
          STARSHIP_SHELL: 'zsh'
        } as NodeJS.ProcessEnv
        
        const candidates = [
          process.env.STARSHIP_BIN,
          '/usr/local/bin/starship',
          '/usr/bin/starship',
          'starship',
        ].filter(Boolean) as string[]
        
        function tryCandidate(index: number): void {
          if (index >= candidates.length) {
            safeEnd(500, { ok: false, error: 'starship binary not found in PATH', code: 'ENOENT' })
            return
          }
          
          const bin = candidates[index]
          const targetCwd = (cwd && typeof cwd === 'string') ? cwd : process.cwd()
          
          let stdout = ''
          let stderr = ''
          
          const child = spawn(bin, ['prompt'], { 
            cwd: targetCwd,
            env: baseEnv,
            stdio: ['ignore', 'pipe', 'pipe']
          })
          
          const timeoutHandle = setTimeout(() => {
            if (!responded) {
              try { child.kill('SIGTERM') } catch {}
              setTimeout(() => {
                if (!responded) {
                  try { child.kill('SIGKILL') } catch {}
                }
              }, 1000)
              safeEnd(500, { ok: false, error: 'Command execution timeout (2s)', code: 'TIMEOUT' })
            }
          }, 2000)
          
          child.stdout?.on('data', (data: Buffer) => {
            stdout += data.toString()
            if (stdout.length > 8192) {
              clearTimeout(timeoutHandle)
              try { child.kill('SIGTERM') } catch {}
              safeEnd(500, { ok: false, error: 'Output too large (max 8KB)', code: 'ETOOBIG' })
            }
          })
          
          child.stderr?.on('data', (data: Buffer) => {
            stderr += data.toString()
          })
          
          child.on('error', (err: any) => {
            clearTimeout(timeoutHandle)
            if (err?.code === 'ENOENT') {
              tryCandidate(index + 1)
              return
            }
            safeEnd(500, { ok: false, error: `Process error: ${err?.message || 'Unknown error'}`, code: err?.code || 'ERR' })
          })
          
          child.on('close', (code: number) => {
            clearTimeout(timeoutHandle)
            if (responded) return
            
            if (code === 0) {
              safeEnd(200, { ok: true, output: stdout.trim() })
            } else {
              const errorMsg = stderr.trim() || `Process exited with code ${code}`
              safeEnd(500, { ok: false, error: errorMsg, code: 'EXIT_' + code })
            }
          })
        }
        
        tryCandidate(0)
      })
      server.middlewares.use('/api/current-variant', async (_req, res) => {
        try {
          const os = await import('os')
          const fs = await import('fs')
          const path = await import('path')
          const file = path.join(os.homedir(), '.config/dotfiles/starship-variants/.current')
          let variant = ''
          if (fs.existsSync(file)) {
            variant = String(fs.readFileSync(file, 'utf8')).trim()
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ variant }))
        } catch {
          res.statusCode = 500
          res.end(JSON.stringify({ variant: '' }))
        }
      })
      server.middlewares.use('/api/templates', async (_req, res) => {
        try {
          const os = await import('os')
          const fs = await import('fs')
          const path = await import('path')
          const dir = path.join(os.homedir(), '.config/dotfiles/starship-variants')
          const out: any[] = []
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.toml'))
            for (let i = 0; i < files.length; i++) {
              const f = files[i]
              const p = path.join(dir, f)
              const toml = fs.readFileSync(p, 'utf8')
              out.push({ name: f.replace(/\.toml$/, ''), path: p, toml })
            }
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ templates: out }))
        } catch {
          res.statusCode = 500
          res.end(JSON.stringify({ templates: [] }))
        }
      })
      server.middlewares.use('/api/prod-url', async (_req, res) => {
        try {
          const fs = await import('fs')
          const path = await import('path')
          const os = await import('os')
          const aliasFile = path.join(os.homedir(), '.config/dotfiles/logs/studio.alias')
          let url = 'https://dotfiles-studio.vercel.app'
          if (fs.existsSync(aliasFile)) {
            const alias = String(fs.readFileSync(aliasFile, 'utf8')).trim()
            if (alias) url = `https://${alias}.vercel.app`
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ url }))
        } catch {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ url: 'https://dotfiles-studio.vercel.app' }))
        }
      })
      server.middlewares.use('/api/apply', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        const fs = await import('fs')
        const path = await import('path')
        const body = await (async () => await new Promise<any>((resolve) => {
          let data = ''
          req.on('data', (c: any) => { data += c })
          req.on('end', () => { try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) } })
        }))()
        const { toml, targetPath, backup } = body || {}
        if (!toml || typeof toml !== 'string' || !targetPath || typeof targetPath !== 'string') {
          res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing toml or targetPath' })); return
        }
        try {
          const exists = fs.existsSync(targetPath)
          if (exists && backup) {
            const backupPath = `${targetPath}.${Date.now()}.bak`
            fs.copyFileSync(targetPath, backupPath)
          }
          const dir = path.dirname(targetPath)
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }
          fs.writeFileSync(targetPath, toml, 'utf8')
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, path: targetPath }))
        } catch (e: any) {
          res.statusCode = 500
          res.end(JSON.stringify({ ok: false, error: e?.message || 'Failed to apply config' }))
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), starshipDevApi()],
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['@iarna/toml', 'ansi-to-html'],
  },
})
