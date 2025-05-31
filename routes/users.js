// backend/routes/users.js
import express from 'express'
import { supabase } from '../utils/supabaseAdmin.js'

const router = express.Router()

// GET user plan by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params
  const { data, error } = await supabase
    .from('users')
    .select('plan')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // Supabase returns this when no rows match in `.single()`
      return res.status(404).json({ error: 'User not found' })
    }
    return res.status(500).json({ error })
  }

  res.json({ plan: data.plan })
})

// POST create user (if doesn't exist)
router.post('/', async (req, res) => {
  const { id, email, plan = 'free' } = req.body

  if (!id || !email) {
    return res.status(400).json({ error: 'Missing id or email' })
  }

  // Check if user already exists
  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .eq('id', id)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    return res.status(500).json({ error: fetchError.message })
  }

  if (!existingUser) {
    const { error: insertError } = await supabase
      .from('users')
      .insert([{ id, email, plan }])

    if (insertError) {
      return res.status(500).json({ error: insertError.message })
    }

    return res.json({ success: true, created: true })
  }

  res.json({ success: true, created: false })
})

export default router
