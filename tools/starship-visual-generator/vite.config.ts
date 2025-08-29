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
          const env = { ...process.env, STARSHIP_CONFIG: tmpPath }
          const child = spawn('starship', ['prompt'], { cwd: cwd && typeof cwd === 'string' ? cwd : process.cwd(), env })
          let stdout = ''
          let stderr = ''
          child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
          child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
          child.on('close', (code: number) => {
            fs.unlink(tmpPath, () => {})
            res.setHeader('Content-Type', 'application/json')
            if (code === 0) {
              res.end(JSON.stringify({ ok: true, output: stdout }))
            } else {
              res.statusCode = 500
              res.end(JSON.stringify({ ok: false, error: stderr || `starship exited with code ${code}` }))
            }
          })
        } catch (e: any) {
          try { fs.unlinkSync(tmpPath) } catch {}
          res.statusCode = 500
          res.end(JSON.stringify({ ok: false, error: e?.message || 'Internal error' }))
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
