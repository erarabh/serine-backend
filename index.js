// backend/index.js

import express from 'express'
import cors from 'cors'
import 'dotenv/config'

// Import your routers
import checkoutRouter from './routes/checkout.js'
import webhookRouter  from './routes/webhooks.js'
import agentRoutes    from './routes/agents.js'
import chatRoute      from './routes/chat.js'
import scrapeRoute    from './routes/scrape.js'
import qaRoute        from './routes/qa.js'
import userRoute      from './routes/users.js'
import chatMetrics    from './routes/chat_metrics.js'
import chatSentiments from './routes/chat_sentiments.js'
import usageRoute     from './routes/usage.js'
import feedbackRouter from './routes/feedback.js'

// 1) Validate all required env vars up front
const requiredEnvs = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FRONTEND_URL',
  'LS_STORE_SLUG',
  'LS_STORE_ID',
  'LEMON_SQUEEZY_API_KEY',
  'LEMON_SQUEEZY_WEBHOOK_SECRET'
]
for (const name of requiredEnvs) {
  if (!process.env[name]) {
    console.error(`[startup] Missing env var: ${name}`)
    process.exit(1)
  }
}

const PORT = process.env.PORT || 3000
const app  = express()

// 2) Configure CORS to allow your frontend only
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  process.env.FRONTEND_URL
]
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true)
      }
      return callback(
        new Error(`CORS policy: Origin ${origin} not allowed`),
        false
      )
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
)

// 3) Mount webhooks **before** body-parsing so we can read raw body
app.use('/webhooks', webhookRouter)

// 4) Body-parser for everything else
app.use(express.json())

// 5) Mount your feature routes
app.use('/checkout', checkoutRouter)
app.use('/chat',     chatRoute)
app.use('/scrape',   scrapeRoute)
app.use('/qa',       qaRoute)
app.use('/users',    userRoute)
app.use('/api/chat_metrics',    chatMetrics)
app.use('/api/chat_sentiments', chatSentiments)
app.use('/api/agents',          agentRoutes)
app.use('/api/usage',           usageRoute)
app.use('/feedback',            feedbackRouter)

// 6) Healthcheck
app.get('/', (_req, res) => {
  res.send('Serine AI backend running 🎉')
})

// 7) Global error handler (any uncaught errors bubble here)
app.use((err, _req, res, _next) => {
  console.error('[error]', err.stack || err)
  res.status(500).json({ error: err.message || 'Internal Server Error' })
})

// 8) Start the server
app.listen(PORT, () => {
  console.log(`🚀 Serine backend listening on port ${PORT}`)
})
