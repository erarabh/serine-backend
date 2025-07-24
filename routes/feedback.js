import express from 'express'
import { supabase } from '../utils/supabaseAdmin.js'

const router = express.Router()

router.post('/', async (req, res) => {
  const { userId, agentId, sessionId, feedback } = req.body
  if (!userId || !sessionId || !['positive', 'negative'].includes(feedback)) {
    return res.status(400).json({ error: 'Invalid data' })
  }

  try {
    // 1) Look up the assistant reply session to get its created_at
    const { data: sess, error: sessErr } = await supabase
      .from('sessions')
      .select('message, created_at')
      .eq('id', sessionId)
      .single()

    if (sessErr || !sess) {
      console.error('Session lookup failed:', sessErr)
      return res.status(500).json({ error: 'Could not find session' })
    }

    // 2) Find the immediately preceding user message
    const { data: prev, error: prevErr } = await supabase
      .from('sessions')
      .select('message')
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .lt('created_at', sess.created_at)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (prevErr) {
      console.warn('Previous user message lookup failed:', prevErr)
    }

    // 3) Determine which text to store: user’s question or (fallback) assistant
    const questionText = (prev && prev.message) ? prev.message : sess.message

    // 4) Insert into chat_sentiments using the question text
    await supabase.from('chat_sentiments').insert([{
      user_id:         userId,
      agent_id:        agentId || null,
      message:         questionText.trim(),
      sentiment_label: feedback
    }])

    return res.json({ success: true })
  }
  catch (err) {
    console.error('Feedback error:', err)
    return res.status(500).json({ error: 'Insert failed' })
  }
})

export default router
