import express from 'express'
import { supabase } from '../utils/supabaseAdmin.js'
import fetch from 'node-fetch'

const router = express.Router()

router.post('/', async (req, res) => {
  const { message, userId } = req.body

  console.log('📥 Chat Request:', { message, userId })

  if (!message || !userId) {
    return res.status(400).json({ error: 'Missing message or userId' })
  }

  try {
    // 1. Load Q&A memory
    const { data: qaData, error } = await supabase
      .from('qa_pairs')
      .select('question, answer')
      .eq('user_id', userId)

    if (error) throw error

    // 2. Match top 5 Q&A (very basic matching)
    const contextExamples = qaData
      .filter((qa) => message.toLowerCase().includes(qa.question.toLowerCase().split(' ')[0]))
      .slice(0, 5)

    const contextText = contextExamples.map(
      (q, i) => `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.answer}`
    ).join('\n\n')

    const prompt = `You are Serine, a helpful AI assistant. Use the following knowledge base to answer the user question:\n\n${contextText}\n\nUser: ${message}`

    // 3. Call Gemini
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      })
    })

    const data = await geminiRes.json()

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not understand.'
    console.log('🧠 Gemini Reply:', reply)
    res.json({ reply })
  } catch (err) {
    console.error('❌ Chat error:', err)
    res.status(500).json({ error: 'Chat failed' })
  }
})

export default router
