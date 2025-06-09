import express from 'express'
import { supabase } from '../utils/supabaseAdmin.js'
const router = express.Router()

// Get all agents for a user
router.get('/:userId', async (req, res) => {
  const { userId } = req.params
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
  if (error) return res.status(500).json({ error })
  res.json({ agents: data })
})

// Create new agent
router.post('/', async (req, res) => {
  const { userId, name } = req.body
  const { data, error } = await supabase
    .from('agents')
    .insert([{ user_id: userId, name }])
    .select()
  if (error) return res.status(500).json({ error })
  res.json({ agent: data[0] })
})

// Get individual agent performance
router.get('/detail/:agentId', async (req, res) => {
  const { agentId } = req.params
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single()
  if (error) return res.status(500).json({ error })
  res.json({ agent: data })
})

export default router
