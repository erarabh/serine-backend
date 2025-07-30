// ✅ backend/routes/checkout.js

import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { createCheckoutLink } from '../utils/hostedLink.js'

const router = express.Router()

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

router.post('/', async (req, res) => {
  const { name, email, password, plan, billing } = req.body

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name }
    })

    if (error || !data?.user?.id) {
      return res.status(400).json({ error: error?.message || 'Auth creation failed' })
    }

    const userId = data.user.id

    await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        email,
        name,
        plan: 'free',
        plan_period: billing
      }, { onConflict: 'id' })

    const url = await createCheckoutLink({ userId, email, name, plan, billing })
    return res.json({ url })
  } catch (err) {
    console.error('[checkout] fatal error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

/*								 
import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { getHostedLink } from '../utils/hostedLink.js'

const router = express.Router()

// Admin client with service role
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

router.post('/', async (req, res) => {
  const { name, email, password, plan, billing } = req.body
  console.log('[checkout] request body →', req.body)

  let userId

  try {
    // Step 1: Create Supabase Auth user if password provided
    if (email && password && name) {
      console.log('[checkout] creating Supabase Auth user…')
      const { data, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name }
      })

      if (createErr || !data?.user?.id) {
        console.error('[checkout] Supabase Auth error:', createErr)
        return res.status(400).json({ error: createErr?.message || 'Auth creation failed' })
      }

      userId = data.user.id
      console.log('[checkout] user created:', userId)
    }

    // Step 2: If user was already authenticated, use their ID (fallback)
    if (!userId && req.body.userId) {
      userId = req.body.userId
    }

    if (!userId) {
      console.warn('[checkout] missing userId')
      return res.status(400).json({ error: 'Missing userId' })
    }

    // Step 3: Upsert profile
    await supabaseAdmin
      .from('users')
      .upsert({ id: userId, email, name }, { onConflict: 'id' })

    console.log('[checkout] upserted user:', userId)

    // Step 4: Create hosted LemonSqueezy checkout
    const url = await getHostedLink({
      userId,
      email,
      name,
      plan,
      billing
    })

    console.log('[checkout] got hosted URL →', url)
    res.json({ url })
  } catch (err) {
    console.error('[checkout] fatal error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router
*/