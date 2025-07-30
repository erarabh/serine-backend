// backend/routes/checkout.js

import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { createCheckoutLink } from '../utils/hostedLink.js'

const router = express.Router()

// 1) Pull in and validate your Supabase env vars
const SUPABASE_URL            = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[startup] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// 2) Init your Admin client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

router.post('/', async (req, res) => {
  const { name, email, password, plan, billing } = req.body

  if (!name || !email || !password || !plan || !billing) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // 3) List or create the Auth user
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
    const existing = listData?.users.find(u => u.email === email)

    let userId
    if (existing) {
      userId = existing.id
      console.log('[checkout] existing user:', userId)
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
      console.log('[checkout] created user:', userId)
    }

    // 4) Upsert into your public `users` table
    const { error: upsertErr } = await supabaseAdmin
      .from('users')
      .upsert({
        id:          userId,
        email,
        name,
        plan:        'free',
        plan_period: billing
      }, { onConflict: 'id' })

    if (upsertErr) throw new Error(upsertErr.message)

    // 5) Generate your Lemon Squeezy URL
    const url = await createCheckoutLink({ userId, email, name, plan, billing })
    return res.json({ url })
  } catch (err) {
    console.error('[checkout] fatal error:', err.stack || err.message)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
})

export default router
