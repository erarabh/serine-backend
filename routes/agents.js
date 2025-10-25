// backend/routes/agents.js
import express from 'express'
import { supabase } from '../utils/supabaseAdmin.js'

const router = express.Router()

							  
						   
																			 
 

// GET all agents for a user
router.get('/', async (req, res) => {
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
			  
												 
														 
   

  if (error) return res.status(500).json({ error })
  console.log(`[agents] Fetched ${data.length} agents for user ${userId}`)
  res.json({ data })
})

// POST create new agent (enforce plan limit)
router.post('/', async (req, res) => {
  const { userId, name } = req.body
  if (!userId || !name) return res.status(400).json({ error: 'Missing userId or name' })

  // lookup plan & agent-count
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('plan')
    .eq('id', userId)
    .single()
  if (userError) return res.status(500).json({ error: 'User lookup failed' })

  const plan = userData.plan || 'free'
  const maxAgents = plan === 'pro' ? 10 : plan === 'growth' ? 3 : 1

  const { count, error: countError } = await supabase
    .from('agents')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (countError) return res.status(500).json({ error: 'Count error' })
  if (count >= maxAgents) {
    return res
      .status(403)
      .json({ error: `Your ${plan.toUpperCase()} plan allows up to ${maxAgents} agents.` })
  }

  const { data, error } = await supabase
    .from('agents')
    .insert([{ user_id: userId, name }])
    .select()
    .single()
  if (error) return res.status(500).json({ error })
  console.log(`[agents] Fetched ${data.length} agents for user ${userId}`)
  res.json({ data })
})

// PATCH update an agent’s support hotline
router.patch('/:id', async (req, res) => {
  const agentId = req.params.id
  const { support_hotline } = req.body

  if (typeof support_hotline !== 'string') {
    return res.status(400).json({ error: 'support_hotline must be a string' })
  }

  const { data, error } = await supabase
    .from('agents')
    .update({ support_hotline })
    .eq('id', agentId)
    .select()
    .single()

  if (error) {
    console.error('❌ Agent update error:', error)
    return res.status(500).json({ error: 'Failed to update agent' })
  }

  res.json({ agent: data })
})

export default router
