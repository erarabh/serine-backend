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
  console.log('[checkout] received payload:', { name, email, plan, billing })

  if (!name || !email || !password || !plan || !billing) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // 1) See if user already exists
    const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
    if (listErr) throw listErr

    const existing = listData.users.find(u => u.email === email)
    let userId

    if (existing) {
      // 2a) Reuse existing user — do NOT overwrite their password
      userId = existing.id
      console.log('[checkout] reusing user:', userId)
    } else {
      // 2b) Create new user with their chosen password, auto-confirm email
      const { data: created, error: createErr } = 
        await supabaseAdmin.auth.admin.createUser({
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

    // 3) Upsert into your users table as a free trial
    const { error: upsertErr } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          id:          userId,
          email,
          name,
          plan:        'free',
          plan_period: billing,
        },
        { onConflict: 'id' }
      )
    if (upsertErr) throw upsertErr

    // 4) Generate LemonSqueezy checkout link
    const url = createCheckoutLink({ userId, email, name, plan, billing })
    console.log('[checkout] buy link →', url)
    return res.json({ url })
  } catch (err) {
    console.error('[checkout] fatal:', err.stack || err.message)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
})

export default router
