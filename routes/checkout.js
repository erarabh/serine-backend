// backend/routes/checkout.js

import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { createCheckoutLink } from '../utils/hostedLink.js'

const router = express.Router()

// Supabase Admin client for user creation & upsert
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

router.post('/', async (req, res) => {
  const { name, email, password, plan, billing } = req.body

  if (!name || !email || !password || !plan || !billing) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // 1) Check or create Auth user
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
    const existing = listData?.users.find(u => u.email === email)

    let userId
    if (existing) {
      userId = existing.id
      console.log('[checkout] Using existing user:', userId)
    } else {
      const { data, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name }
      })
      if (createErr || !data?.user?.id) {
        throw new Error(createErr?.message || 'Auth creation failed')
      }
      userId = data.user.id
      console.log('[checkout] Created new user:', userId)
    }

    // 2) Upsert into public users table
    const { error: upsertErr } = await supabaseAdmin
      .from('users')
      .upsert({
        id:          userId,
        email,
        name,
        plan:        'free',
        plan_period: billing
      }, { onConflict: 'id' })

    if (upsertErr) {
      throw new Error(upsertErr.message)
    }

    // 3) Generate LemonSqueezy link
    const url = createCheckoutLink({ userId, email, name, plan, billing })

    return res.json({ url })
  } catch (err) {
    console.error('[checkout] Error:', err.stack || err.message)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
})

export default router
