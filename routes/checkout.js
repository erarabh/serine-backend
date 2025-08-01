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
  console.log('[checkout] received:', { name, email, plan, billing })

  if (!name || !email || !password || !plan || !billing) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // 1) Create or reuse Auth user with the password they entered
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
    const existing = listData.users.find(u => u.email === email)

    let userId
    if (existing) {
      userId = existing.id
      console.log('[checkout] reusing user:', userId)
    } else {
      const { data, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: name }
      })
      if (createErr) throw new Error(createErr.message)
      userId = data.user.id
      console.log('[checkout] created user:', userId)
    }

    // 2) Upsert a public profile with “free” until the webhook fires
    await supabaseAdmin
      .from('users')
      .upsert({
        id:          userId,
        email, name,
        plan:        'free',
        plan_period: billing
      }, { onConflict: 'id' })

    // 3) Build and return the hosted-buy URL
    const url = createCheckoutLink({ userId, email, name, plan, billing })
    console.log('[checkout] link →', url)
    return res.json({ url })

  } catch (err) {
    console.error('[checkout] fatal error:', err)
    return res.status(500).json({ error: err.message })
  }
})

export default router
