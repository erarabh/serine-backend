// backend/index.js

import express from 'express'
import cors from 'cors'
import 'dotenv/config'

// Import your routers
import checkoutRouter  from './routes/checkout.js'
import webhookRouter   from './routes/webhooks.js'
import agentRoutes     from './routes/agents.js'
import chatRoute       from './routes/chat.js'
import scrapeRoute     from './routes/scrape.js'
import qaRoute         from './routes/qa.js'
import userRoute       from './routes/users.js'
import chatMetrics     from './routes/chat_metrics.js'
import chatSentiments  from './routes/chat_sentiments.js'
import usageRoute      from './routes/usage.js'
import feedbackRouter  from './routes/feedback.js'

// 1) Validate essential env vars
const requiredEnvs = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FRONTEND_URL',
  'LEMON_SQUEEZY_API_KEY',
  'LEMON_SQUEEZY_WEBHOOK_SECRET',
]
for (const name of requiredEnvs) {
  if (!process.env[name]) {
    console.error(`[startup] Missing env var: ${name}`)
    process.exit(1)
  }
}

// 2) Warn if optional but relevant LemonSqueezy config is missing
if (!process.env.LS_STORE_SLUG) {
  console.warn('[startup] Warning: LS_STORE_SLUG not set; hosted buy links may break')
}
if (!process.env.LS_STORE_ID) {
  console.warn('[startup] Warning: LS_STORE_ID not set; webhook parsing may skip store check')
}

// 3) Validate variant mapping env vars for your plans
const variantEnvs = [
  'LS_VARIANT_MONTHLY_STARTER',
  'LS_VARIANT_YEARLY_STARTER',
  'LS_VARIANT_MONTHLY_PROFESSIONAL',
  'LS_VARIANT_YEARLY_PROFESSIONAL',
]
variantEnvs.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`[startup] Warning: missing variant env ${key}`)
  }
})

const PORT = process.env.PORT || 3000
const app  = express()

// 4) CORS config – allow only your frontend
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  process.env.FRONTEND_URL,
]
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true)
      }
      return callback(new Error(`CORS policy: Origin ${origin} not allowed`), false)
    },
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
  })
)

// 5) Webhooks must mount before any body-parser, using raw body
app.use('/api/webhooks', webhookRouter)

// 6) JSON parser for all other /api routes
app.use(express.json())

// 7) Feature routes, all under /api
app.use('/api/checkout',       checkoutRouter)
app.use('/api/chat',           chatRoute)
app.use('/api/scrape',         scrapeRoute)
app.use('/api/qa',             qaRoute)
app.use('/api/users',          userRoute)
app.use('/api/chat_metrics',   chatMetrics)
app.use('/api/chat_sentiments',chatSentiments)
app.use('/api/agents',         agentRoutes)
app.use('/api/usage',          usageRoute)
app.use('/api/feedback',       feedbackRouter)

// 8) Healthcheck
app.get('/', (_req, res) => {
  res.send('Serine AI backend running 🎉')
})

// 9) Global error handler
app.use((err, _req, res, _next) => {
  console.error('[error]', err.stack || err)
  res.status(500).json({ error: err.message || 'Internal Server Error' })
})

// 10) Start the server
app.listen(PORT, () => {
  console.log(`🚀 Serine backend listening on port ${PORT}`)
})
