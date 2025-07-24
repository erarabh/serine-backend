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


const app = express()
app.use(cors())

app.use(express.json())

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

app.get('/', (_, res) => res.send('Serine backend running'))

app.listen(process.env.PORT, () => {
  console.log(`🚀 Serine backend listening on port ${process.env.PORT}`)
})

