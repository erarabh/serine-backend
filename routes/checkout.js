// backend/routes/checkout.js
import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { createCheckoutLink } from '../utils/hostedLink.js'

const router = express.Router()
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[startup] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
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
    // 1) List users to see if this email already exists
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
    const existing = listData.users.find(u => u.email === email)

    let userId
    if (existing) {
      userId = existing.id
      console.log('[checkout] existing user:', userId)

      // **UPDATE** their password so login works with the latest one
      const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password
      })
      if (pwErr) {
        console.error('[checkout] failed to update password:', pwErr)
        throw new Error(pwErr.message)
      }
      console.log('[checkout] password updated for existing user')
    } else {
      // Create brand new user
      const { data, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name }
      })
      if (createErr || !data.user?.id) {
        throw new Error(createErr?.message || 'Auth creation failed')
      }
      userId = data.user.id
      console.log('[checkout] created new user:', userId)
    }

    // 2) Upsert into `users` table with a default 'free' plan
    const { error: upsertErr } = await supabaseAdmin
      .from('users')
      .upsert({
        id:           userId,
        email,
        name,
        plan:         'free',
        plan_period:  billing
      }, { onConflict: 'id' })

    if (upsertErr) throw new Error(upsertErr.message)

    // 3) Return the LemonSqueezy hosted buy link
    const url = createCheckoutLink({ userId, email, name, plan, billing })
    console.log('[checkout] returning URL →', url)
    return res.json({ url })
  } catch (err) {
    console.error('[checkout] fatal:', err.stack || err.message)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
})

export default router
