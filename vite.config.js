import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Em desenvolvimento (npm run dev) o Vite não corre as funções da pasta api/.
// Este plugin faz de "Vercel em ponto pequeno": encaminha /api/... para o ficheiro api/....js.
// Em produção quem trata disto é o próprio Vercel.
const FUNCOES = ['/api/precos', '/api/promocoes', '/api/folhetos/atualizar']

function apiLocal() {
  return {
    name: 'api-local',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        if (!FUNCOES.includes(url.pathname)) return next()

        const { default: handler } = await server.ssrLoadModule(`${url.pathname}.js`)
        req.query = Object.fromEntries(url.searchParams)
        // Imita os métodos res.status() e res.json() do Vercel
        res.status = (codigo) => {
          res.statusCode = codigo
          return res
        }
        res.json = (dados) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(dados))
        }
        try {
          await handler(req, res)
        } catch (e) {
          res.status(500).json({ erro: e.message })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiLocal()],
  server: {
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
})