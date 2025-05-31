// ✅ UPDATED FILE: /serine-app/backend/routes/scrape.js

import express from 'express'
import { scrapeSite } from '../utils/scraper.js'
import { supabase } from '../utils/supabaseAdmin.js'

const router = express.Router()

router.post('/', async (req, res) => {
  const { url, userId } = req.body
  if (!url || !userId) return res.status(400).json({ error: 'Missing URL or userId' })

  try {
    const content = await scrapeSite(url)
    if (!content) {
      return res.status(400).json({ error: 'Empty content scraped' })
    }

    // Naive Q&A extraction from text
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
    const qaPairs = []

    for (let i = 0; i < lines.length - 1; i++) {
      const q = lines[i]
      const a = lines[i + 1]
      if ((q.endsWith('?') || /^[A-Z]/.test(q)) && a.length > 30) {
        qaPairs.push({ question: q, answer: a })
      }
    }

    // Save to Supabase
    const inserts = qaPairs.map(pair => ({
      user_id: userId,
      question: pair.question,
      answer: pair.answer
    }))

    const { error: insertError } = await supabase.from('qa_pairs').insert(inserts)

    if (insertError) {
      console.error('❌ Supabase insert error:', insertError)
      return res.status(500).json({ error: 'Failed to save Q&A pairs' })
    }

    res.json({ success: true, count: qaPairs.length })
  } catch (err) {
    console.error('❌ Scraping failed:', err)
    res.status(500).json({ error: 'Scraping failed' })
  }
})

export default router
