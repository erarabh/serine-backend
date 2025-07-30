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
  let userId

  try {
    // Step 1: Check if user already exists
    const existingUserRes = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUserRes?.data?.users?.find(u => u.email === email)

    if (existingUser) {
      console.log('[checkout] User already exists:', existingUser.id)
      userId = existingUser.id
    } else {
      // Step 2: Create new Auth user
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name }
      })

      if (error || !data?.user?.id) {
        console.error('[checkout] Auth creation failed:', error)
        return res.status(400).json({ error: error?.message || 'Auth creation failed' })
      }

      userId = data.user.id
      console.log('[checkout] Created new Auth user:', userId)
    }

    // Step 3: Upsert public user
    await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        email,
        name,
        plan: 'free',
        plan_period: billing
      }, { onConflict: 'id' })

    // Step 4: Create hosted checkout URL
    const url = await createCheckoutLink({ userId, email, name, plan, billing })
    return res.json({ url })
  } catch (err) {
    console.error('[checkout] fatal error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router
