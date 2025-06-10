// backend/routes/chat.js
import express from 'express'
import { supabase } from '../utils/supabaseAdmin.js'

const router = express.Router()

router.post('/', async (req, res) => {
  const { message, userId, lang = 'en' } = req.body

  console.log('📥 Chat Request:', { message, userId, lang })
  if (typeof message !== 'string' || !message.trim() || typeof userId !== 'string' || !userId.trim()) {
							
    return res.status(400).json({ error: 'Missing or invalid message or userId' })
  }

  try {
								   
    const { data: qaData, error } = await supabase
      .from('qa_pairs')
      .select('question, answer')
      .eq('user_id', userId)

    if (error) throw error
    if (!qaData || qaData.length === 0) {
      return res.json({
        reply: "You haven't trained your chatbot yet. Go to 'My Agents' and add some Q&A pairs or scrape your site."
      })
    }

    const scored = qaData.map((qa) => {
      const q = qa.question.toLowerCase()
      const m = message.toLowerCase()

      let score = 0
      if (m === q) score = 10
      else if (m.includes(q) || q.includes(m)) score = 7
      else {
        const qWords = q.split(/\s+/), mWords = m.split(/\s+/)
										 
        const overlap = qWords.filter(w => mWords.includes(w))
        score = overlap.length
      }

      return { ...qa, score }
    })

    const topMatches = scored
      .sort((a, b) => b.score - a.score)
      .filter(q => q.score > 0)
      .slice(0, 5)

    const contextText = topMatches
      .map((q, i) => `Q${i+1}: ${q.question}\nA${i+1}: ${q.answer}`)
      .join('\n\n')

    const prompt = `
You are a multilingual AI assistant. The user speaks in ${lang}. Answer accordingly.

Knowledge:
${contextText}

User: ${message}
`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    )
    const data = await geminiRes.json()
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not understand.'

																									  
    console.log('🧠 Gemini Reply:', reply)
    res.json({ reply })
  }
  catch (err) {
    console.error('❌ Chat error:', err)
    res.status(500).json({ error: 'Chat failed' })
  }
})

export default router
