// ✅ routes/chat.js
import express from 'express'
import { supabase } from '../utils/supabaseAdmin.js'
import fetch from 'node-fetch'

const router = express.Router()

router.post('/', async (req, res) => {
  const { message, userId, lang = 'en' } = req.body
  console.log('📥 Chat Request:', { message, userId })

  if (!message || !userId) {
    return res.status(400).json({ error: 'Missing message or userId' })
  }

  try {
    const { data: qaData, error } = await supabase
      .from('qa_pairs')
      .select('question, answer')
      .eq('user_id', userId)

    if (error) throw error
    if (!qaData || qaData.length === 0) {
      return res.json({ reply: "You haven't trained your chatbot yet. Please add some Q&A pairs in your dashboard." })
    }

    // 🧠 Naive text similarity scoring
    const scored = qaData.map((qa) => {
      const question = qa.question.toLowerCase()
      const input = message.toLowerCase()

      let score = 0
      if (input === question) score = 10
      else if (input.includes(question) || question.includes(input)) score = 7
      else {
        const qWords = question.split(/\s+/)
        const mWords = input.split(/\s+/)
        const overlap = qWords.filter(w => mWords.includes(w))
        score = overlap.length
      }

      return { ...qa, score }
    })

    const topMatches = scored
      .sort((a, b) => b.score - a.score)
      .filter(q => q.score > 0)
      .slice(0, 5)

    const contextText = topMatches.map(
      (q, i) => `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.answer}`
    ).join('\n\n')

    const prompt = `You are Serine, a helpful commercial assistant. The user speaks ${lang}. Use the following Q&A context to answer their question:
${contextText}

User: ${message}`

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
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
