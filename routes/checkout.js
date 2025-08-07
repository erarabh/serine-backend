// backend/routes/checkout.js

import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { createCheckoutLink } from '../utils/hostedLink.js'

const router = express.Router()
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env

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
    // 1) Create or fetch Auth user
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
    const existing = listData.users.find(u => u.email === email)

    let userId
    if (existing) {
      userId = existing.id
    } else {
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
    }

    // 2) Upsert intent record
    //    - Use insert + ignoreDuplicates to never overwrite plan
    //    - Persist the true plan choice right away
    const { error: insertErr } = await supabaseAdmin
      .from('users')
      .insert(
        {
          id:          userId,
          email,
          name,
          plan,
          plan_period: billing,
        },
        { ignoreDuplicates: true }
      )
    if (insertErr) throw insertErr

    // 3) Generate the checkout link
    const url = createCheckoutLink({ userId, email, name, plan, billing })
    return res.json({ url })
  } catch (err) {
    console.error('[checkout] fatal:', err)
    return res.status(500).json({ error: err.message })
  }
})

export default router
