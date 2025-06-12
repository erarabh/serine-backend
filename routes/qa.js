// ✅ routes/qa.js
import express from 'express'
import { supabase } from '../utils/supabaseAdmin.js'

const router = express.Router()

// 👇 Dummy embedText — Gemini doesn't support embeddings
async function embedText(text) {
  console.warn('⚠️ Skipping embedding — Gemini does not support it.')
  return null
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

// ✅ POST new Q&A (no embedding used)
router.post('/', async (req, res) => {
  const { userId, question, answer } = req.body
  if (!userId || !question || !answer) {
    return res.status(400).json({ error: 'Missing data' })
  }

  try {
    const { data, error } = await supabase
      .from('qa_pairs')
      .insert([{ user_id: userId, question, answer }])
      .select('id')

    if (error) throw error

    res.json({ success: true, insertedId: data?.[0]?.id })
  } catch (err) {
    console.error('❌ Insert failed:', err)
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
