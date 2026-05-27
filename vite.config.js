import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import dotenv from 'dotenv'

// Load .env into process.env so /api/*.js handlers can read it.
// `override: true` forces .env values to win over any pre-existing process.env
// values inherited from the parent shell (which sometimes has empty stubs of
// ANTHROPIC_API_KEY etc. set by other tools).
dotenv.config({ override: true })

/**
 * Routes /api/* requests through Vercel-style handlers in /api/*.js during
 * local dev. In production on Vercel, /api/ is picked up natively.
 */
function localApiPlugin() {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        res.status = function (code) { this.statusCode = code; return this }
        res.json = function (obj) {
          if (!this.getHeader('Content-Type')) {
            this.setHeader('Content-Type', 'application/json')
          }
          this.end(JSON.stringify(obj))
        }

        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
          let raw = ''
          for await (const chunk of req) raw += chunk
          try {
            req.body = raw ? JSON.parse(raw) : {}
          } catch {
            res.status(400).json({ error: 'Invalid JSON body' })
            return
          }
        }

        const route = req.url.split('?')[0].slice(5)
        try {
          const module = await server.ssrLoadModule(`/api/${route}.js`)
          await module.default(req, res)
        } catch (e) {
          console.error(`[local-api] /api/${route} error:`, e)
          if (!res.writableEnded) {
            res.status(500).json({ error: e.message || 'Internal error' })
          }
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localApiPlugin()],
})
