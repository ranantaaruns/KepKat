import { createServer } from 'node:http'
import type { ApiRequest, ApiResponse } from '../api/_lib/types'
import handler from '../api/ai/chat'

try {
  process.loadEnvFile?.('.env.local')
} catch {}

const port = Number(process.env.PORT) || 3000

const server = createServer((req, res) => {
  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', () => {
    const text = Buffer.concat(chunks).toString('utf8')
    const request = req as ApiRequest
    request.body = text || undefined

    const response = res as ApiResponse
    response.status = (code: number) => {
      res.statusCode = code
      return response
    }
    response.json = (value: unknown) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(value))
      return response
    }

    void handler(request, response).catch((reason: unknown) => {
      console.error(reason)
      if (!res.headersSent) res.statusCode = 500
      res.end(JSON.stringify({ error: 'Local API failed.', code: 'unknown' }))
    })
  })
})

server.listen(port, () => {
  console.log(`AI API listening on http://localhost:${port}`)
})
