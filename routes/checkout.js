// backend/routes/checkout.js

import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { createCheckoutLink } from '../utils/hostedLink.js'

const router = express.Router()
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[startup] Missing Supabase env vars')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

router.post('/', async (req, res) => {
  const { name, email, password, plan, billing } = req.body
  if (!name || !email || !password || !plan || !billing) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // 1) Create or fetch the Auth user
    const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
    if (listErr) throw listErr

    let userId
    const existing = listData.users.find(u => u.email === email)
    if (existing) {
      userId = existing.id
      console.log('[checkout] reusing user:', userId)
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        email_confirmed: true,
        user_metadata: { full_name: name },
      })
      if (createErr) throw createErr
      userId = created.user.id
      console.log('[checkout] created new user:', userId)
    }

    // 2) Upsert the users row: insert-if-new, ignore-if-existing
    const { error: upsertErr } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          id:          userId,
          email,
          name,
          plan,                    // records the actual chosen plan
          plan_period: billing,
        },
        {
          onConflict: ['id'],      // key column
          ignoreDuplicates: true,  // do NOT overwrite existing
        }
      )
    if (upsertErr) throw upsertErr
    console.log('[checkout] users table upsert OK')

    // 3) Generate hosted checkout link
    const url = createCheckoutLink({ userId, email, name, plan, billing })
    console.log('[checkout] buy link →', url)
    return res.json({ url })

  } catch (err) {
    console.error('[checkout] fatal:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
})

export default router
