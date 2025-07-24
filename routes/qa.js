// ✅ routes/qa.js
import express from 'express'
import { supabase } from '../utils/supabaseAdmin.js'

const router = express.Router()

// 👇 Dummy embedText — Gemini doesn't support embeddings
async function embedText(text) {
  console.warn('⚠️ Skipping embedding — Gemini does not support it.')
  return null
}

// ✅ GET all Q&A for user (with optional agent)
router.get('/:userId', async (req, res) => {
  const { userId } = req.params
  const { agentId } = req.query
  console.log('🔍 GET QA for user:', userId, 'agent:', agentId)

										
  let query = supabase.from('qa_pairs').select('*').eq('user_id', userId)
  if (agentId) query = query.eq('agent_id', agentId)

  const { data, error } = await query
  console.log('📦 QAs returned:', data?.length || 0)

  if (error) return res.status(500).json({ error })
  res.json({ data })
})

// ✅ POST new Q&A
router.post('/', async (req, res) => {
  const { userId, question, answer, agentId } = req.body
  if (!userId || !question || !answer) {
    return res.status(400).json({ error: 'Missing data' })
  }

  try {
    const insertPayload = {
      user_id: userId,
      question,
      answer,
      agent_id: agentId || null
    }

    const { data, error } = await supabase
      .from('qa_pairs')
      .insert([insertPayload])
      .select('id')

    if (error) throw error

    res.json({ success: true, insertedId: data?.[0]?.id })
  } catch (err) {
    console.error('❌ Insert failed:', err)
    res.status(500).json({ error: 'Insert failed' })
  }
})

// ✅ DELETE Q&A by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params

  const { error } = await supabase.from('qa_pairs').delete().eq('id', id)
					 
			 
				 

  if (error) return res.status(500).json({ error })
  res.json({ success: true })
})

export default router