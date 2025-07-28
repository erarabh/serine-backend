// ✅ backend/index.js — updated to support raw-body for webhooks

import express from 'express'
import cors from 'cors'
import 'dotenv/config'

import agentRoutes from './routes/agents.js'
import chatRoute from './routes/chat.js'
import scrapeRoute from './routes/scrape.js'
import qaRoute from './routes/qa.js'
import userRoute from './routes/users.js'
import chatMetricsRouter from './routes/chat_metrics.js'
import chatSentimentsRouter from './routes/chat_sentiments.js'
import usageRoute from './routes/usage.js'
import feedbackRouter from './routes/feedback.js'
import checkoutRouter from './routes/checkout.js'
import webhookRouter from './routes/webhooks.js'

const app = express()
const PORT = process.env.PORT || 3000

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
      return callback(new Error(`CORS policy: Origin ${origin} not allowed`), false)
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
)

// ✅ mount webhooks route BEFORE express.json()
// the router will handle raw-body manually
app.use('/webhooks', webhookRouter)

// ✅ safe to use JSON parser for everything else
app.use(express.json())

// Remaining routes
app.use('/checkout', checkoutRouter)
app.use('/chat', chatRoute)
app.use('/scrape', scrapeRoute)
app.use('/qa', qaRoute)
app.use('/users', userRoute)
app.use('/api/chat_metrics', chatMetricsRouter)
app.use('/api/chat_sentiments', chatSentimentsRouter)
app.use('/api/agents', agentRoutes)
app.use('/api/usage', usageRoute)
app.use('/feedback', feedbackRouter)

app.get('/', (_req, res) => res.send('Serine AI backend running'))

app.listen(PORT, () => {
  console.log(`🚀 Serine backend listening on port ${PORT}`)
})
