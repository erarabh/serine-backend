import express from 'express'
import { supabase } from '../utils/supabaseAdmin.js'

const router = express.Router()

// GET all Q&A for a user
router.get('/:userId', async (req, res) => {
  const { userId } = req.params
  const { data, error } = await supabase
    .from('qa_pairs')
    .select('*')
    .eq('user_id', userId)

  if (error) return res.status(500).json({ error })
  res.json({ data })
})

// POST new Q&A
router.post('/', async (req, res) => {
  const { userId, question, answer } = req.body
  const { error } = await supabase
    .from('qa_pairs')
    .insert([{ user_id: userId, question, answer }])

  if (error) return res.status(500).json({ error })
  res.json({ success: true })
})

// DELETE Q&A
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
