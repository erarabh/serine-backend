import express from 'express'
import { supabase } from '../utils/supabaseAdmin.js'
import fetch from 'node-fetch'

const router = express.Router()

// 👇 Embedding utility (gte-small via Supabase)
async function embedText(text) {
  const response = await fetch('https://api.supabase.com/v1/ai/embed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      input: text,
      model: 'gte-small' // Supabase built-in model
    })
  })

  const data = await response.json()
  if (!data.embedding) {
    console.error('❌ Embedding failed:', data)
    throw new Error('Embedding failed')
  }

  return data.embedding
}

// ✅ GET all Q&A for user
router.get('/:userId', async (req, res) => {
  const { userId } = req.params
  const { data, error } = await supabase
    .from('qa_pairs')
    .select('*')
    .eq('user_id', userId)

  if (error) return res.status(500).json({ error })
  res.json({ data })
})

// ✅ POST new Q&A with embeddings
router.post('/', async (req, res) => {
  const { userId, question, answer } = req.body
  if (!userId || !question || !answer) {
    return res.status(400).json({ error: 'Missing data' })
  }

  try {
    const fullText = `${question} ${answer}`
    const embedding = await embedText(fullText)

    const { data, error } = await supabase
      .from('qa_pairs')
      .insert([{ user_id: userId, question, answer, embedding }])
      .select('id')

    if (error) throw error

    res.json({ success: true, insertedId: data?.[0]?.id })
  } catch (err) {
    console.error('❌ Insert with embedding failed:', err)
    res.status(500).json({ error: 'Insert failed' })
  }
})

// ✅ DELETE Q&A
router.delete('/:id', async (req, res) => {
  const { id } = req.params

  const { error } = await supabase
    .from('qa_pairs')
    .delete()
    .eq('id', id)

  if (error) return res.status(500).json({ error })
  res.json({ success: true })
})

export default router
