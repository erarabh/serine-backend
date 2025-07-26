import express from 'express'
import cors from 'cors'
import 'dotenv/config'

import agentRoutes from './routes/agents.js'
import chatRoute from './routes/chat.js'
import chatRouter from './routes/chat.js'
import scrapeRoute from './routes/scrape.js'
import qaRoute from './routes/qa.js'
import userRoute from './routes/users.js'
import chatMetricsRouter from './routes/chat_metrics.js'
import chatSentimentsRouter from './routes/chat_sentiments.js'
import usageRoute from './routes/usage.js'
import feedbackRouter from './routes/feedback.js'

// ✅ Correct webhook router import
import webhookRouter from './routes/webhooks.js'

const app = express()
const PORT = process.env.PORT || 3000

// ✅ CORS middleware
app.use(cors())

// ✅ JSON parser for regular routes
app.use(express.json())

// ✅ Raw body parser ONLY for webhook route
app.use('/webhooks/lemonsqueezy', express.raw({ type: 'application/json' }), webhookRouter)

// ✅ All other routes
app.use('/chat', chatRoute)
app.use('/scrape', scrapeRoute)
app.use('/qa', qaRoute)
app.use('/users', userRoute)
app.use('/api/chat_metrics', chatMetricsRouter)
app.use('/api/chat_sentiments', chatSentimentsRouter)
app.use('/api/chat', chatRouter)
app.use('/api/agents', agentRoutes)
app.use('/api/usage', usageRoute)
app.use('/feedback', feedbackRouter)

// ✅ Health check route
app.get('/', (_, res) => res.send('Serine backend running'))

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Serine backend listening on port ${PORT}`)
})
