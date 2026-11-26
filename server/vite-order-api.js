import { Readable } from 'node:stream'
import { createOrderHandler } from '../api/place-order.js'

export function localOrderApi(env) {
  const handler = createOrderHandler(env, fetch, { local: true })
  function install({ middlewares }) {
    middlewares.use(async (req, res, next) => {
      if (req.url?.split('?')[0] !== '/api/place-order') return next()
      try {
        const response = await handler(new Request('http://localhost/api/place-order', {
          method: req.method,
          headers: req.headers,
          ...(req.method !== 'GET' && req.method !== 'HEAD' && { body: Readable.toWeb(req), duplex: 'half' }),
        }))
        res.writeHead(response.status, Object.fromEntries(response.headers))
        res.end(await response.text())
      } catch {
        res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        res.end(JSON.stringify({ error: 'ORDER_SERVICE_UNAVAILABLE' }))
      }
    })
  }
  return { name: 'black-bean-local-orders', configureServer: install, configurePreviewServer: install }
}
