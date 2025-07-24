// /backend/routes/usage.js
import express from 'express'
import { supabase } from '../utils/supabaseAdmin.js'
const router = express.Router()

router.get('/', async (req, res) => {
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const end = now.toISOString().slice(0, 10)

  try {
    const { data, error } = await supabase
      .from('chat_metrics')
      .select('total_messages')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)

    if (error) throw error

    const usage = data.reduce((sum, row) => sum + (row.total_messages || 0), 0)
    return res.json({ usage })
  } catch (err) {
    console.error('❌ Usage route failed:', err)
    return res.status(500).json({ error: 'Failed to calculate usage' })
  }
})


export default router
