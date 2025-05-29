import express from 'express'
import { chatWithAI } from '../utils/geminiClient.js'

const router = express.Router()

router.post('/', async (req, res) => {
  const { message } = req.body
  if (!message) return res.status(400).json({ error: 'Missing message' })

  try {
    const reply = await chatWithAI(message)
    res.json({ reply })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Chat failed' })
  }
})

export default router
