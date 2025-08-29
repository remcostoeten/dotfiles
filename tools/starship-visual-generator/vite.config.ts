import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

function starshipDevApi(): Plugin {
  return {
    name: 'starship-dev-api',
    apply: 'serve',
    configureServer(server) {
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
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        const body = await readBody(req)
        const { toml, cwd } = body || {}
        if (!toml || typeof toml !== 'string') { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing toml' })); return }
        const fs = await import('fs')
        const os = await import('os')
        const path = await import('path')
        const { spawn } = await import('child_process')
        const tmpDir = os.tmpdir()
        const tmpPath = path.join(tmpDir, `starship-preview-${Date.now()}.toml`)
        try {
          fs.writeFileSync(tmpPath, toml, 'utf8')
          const baseEnv = { ...(process.env as NodeJS.ProcessEnv), STARSHIP_CONFIG: tmpPath } as NodeJS.ProcessEnv
          const candidates = [
            process.env.STARSHIP_BIN,
            '/usr/local/bin/starship',
            '/usr/bin/starship',
            'starship',
          ].filter(Boolean) as string[]
          let stdout = ''
          let stderr = ''
          let responded = false
          function safeEnd(status: number, payload: any) {
            if (responded) return
            responded = true
            fs.unlink(tmpPath, () => {})
            res.setHeader('Content-Type', 'application/json')
            if (status === 200) {
              res.end(JSON.stringify(payload))
            } else {
              res.statusCode = status
              res.end(JSON.stringify(payload))
            }
          }
          function runWith(index: number) {
            if (index >= candidates.length) {
              safeEnd(500, { ok: false, error: 'starship not found', code: 'ENOENT' })
              return
            }
            const bin = candidates[index]
            const env = { ...baseEnv, PATH: `${(baseEnv.PATH || '')}:/usr/local/bin:/usr/bin` } as NodeJS.ProcessEnv
            const child = spawn(bin, ['prompt'], { cwd: cwd && typeof cwd === 'string' ? cwd : process.cwd(), env })
            child.on('error', (err: any) => {
              if (String(err?.code || '') === 'ENOENT') {
                runWith(index + 1)
                return
              }
              safeEnd(500, { ok: false, error: String(err?.message || 'starship error'), code: err?.code || 'ERR' })
            })
            child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
            child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
            child.on('close', (code: number) => {
              if (code === 0) {
                safeEnd(200, { ok: true, output: stdout })
              } else {
                safeEnd(500, { ok: false, error: stderr || `starship exited with code ${code}` })
              }
            })
          }
          runWith(0)
        } catch (e: any) {
          try { fs.unlinkSync(tmpPath) } catch {}
          res.statusCode = 500
          res.end(JSON.stringify({ ok: false, error: e?.message || 'Internal error' }))
        }
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
