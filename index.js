import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import agentsRoute from './routes/agents.js'

import chatRoute from './routes/chat.js'
import scrapeRoute from './routes/scrape.js'
import qaRoute from './routes/qa.js'
import userRoute from './routes/users.js'

const app = express()
app.use(cors())

app.use(express.json())

app.use('/chat', chatRoute)
app.use('/scrape', scrapeRoute)
app.use('/qa', qaRoute)
app.use('/users', userRoute)
app.use('/agents', agentsRoute)

app.get('/', (_, res) => res.send('Serine backend running'))

app.listen(process.env.PORT, () => {
  console.log(`🚀 Serine backend listening on port ${process.env.PORT}`)
})

