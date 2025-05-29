import express from 'express'
import { supabase } from '../utils/supabaseAdmin.js'

const router = express.Router()

// GET all Q&A for a user
router.get('/:userId', async (req, res) => {
  const { userId } = req.params
  console.log('📥 GET /qa/:userId called with:', userId)

  const { data, error } = await supabase
    .from('qa_pairs')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('❌ Supabase SELECT error:', error)
    return res.status(500).json({ error })
  }

  res.json({ data })
})

// POST new Q&A
router.post('/', async (req, res) => {
  const { userId, question, answer } = req.body
  const { data, error } = await supabase
    .from('qa_pairs')
    .insert([{ user_id: userId, question, answer }])
    .select('id') // 🆕 get the UUID back

  if (error) return res.status(500).json({ error })
  res.json({ success: true, insertedId: data?.[0]?.id }) // 🆕 return real ID
})


// DELETE Q&A
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  console.log('📥 DELETE /qa/:id called with:', id)

  const { error } = await supabase
    .from('qa_pairs')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('❌ Supabase DELETE error:', error)
    return res.status(500).json({ error })
  }

  console.log('🗑️ Q&A deleted:', id)
  res.json({ success: true })
})

export default router
