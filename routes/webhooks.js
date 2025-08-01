// backend/routes/webhooks.js
import express from 'express'
import crypto from 'crypto'
import getRawBody from 'raw-body'
import { VARIANT_MAP } from '../utils/variantMapping.js'
import { createClient } from '@supabase/supabase-js'

const router = express.Router()
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  LEMON_SQUEEZY_WEBHOOK_SECRET
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !LEMON_SQUEEZY_WEBHOOK_SECRET) {
  console.error('[startup] Missing Supabase or webhook secret')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// 1) Mount raw-body middleware BEFORE express.json()
router.use(async (req, res, next) => {
  try {
    req.rawBody = await getRawBody(req)
    next()
  } catch (err) {
    console.error('[webhooks] raw-body error:', err)
    res.status(400).send('Cannot read raw body')
  }
})

router.post('/lemonsqueezy', async (req, res) => {
  // 2) Try all known header names
  const sigHeader =
    req.headers['x-hook-signature'] ||
    req.headers['x-signature'] ||
    req.headers['x-lemonsqueezy-signature']

  console.log('[webhooks] headers:', req.headers)
  const raw = req.rawBody.toString()

  // 3) Compute expected HMAC
  const expected = crypto
    .createHmac('sha256', LEMON_SQUEEZY_WEBHOOK_SECRET)
    .update(raw)
    .digest('hex')

  console.log('[webhooks] signature header:', sigHeader)
  console.log('[webhooks] expected signature:', expected)

  if (sigHeader !== expected) {
    console.warn('[webhooks] Invalid signature')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  // 4) Parse JSON safely
  let payload
  try {
    payload = JSON.parse(raw)
  } catch (err) {
    console.error('[webhooks] JSON parse error:', err)
    return res.status(400).json({ error: 'Malformed JSON' })
  }

  // 5) Extract ids
  const userId    = payload.meta?.custom_data?.user_id
  const variantId = payload.data?.attributes?.variant_id
  if (!userId || !variantId) {
    return res.status(400).json({ error: 'Missing user_id or variant_id' })
  }
  console.log('[webhooks] userId, variantId:', userId, variantId)

  // 6) Map to plan & billing
  const mapping = VARIANT_MAP[variantId]
  if (!mapping) {
    return res.status(400).json({ error: `Unknown variant: ${variantId}` })
  }

  // 7) Update Supabase `users` table
  const { error: uErr } = await supabaseAdmin
    .from('users')
    .update({ plan: mapping.plan, plan_period: mapping.billing })
    .eq('id', userId)
  if (uErr) {
    console.error('[webhooks] user update error:', uErr)
    return res.status(500).json({ error: uErr.message })
  }
  console.log(`[webhooks] Updated ${userId} → ${mapping.plan}/${mapping.billing}`)

  // 8) Ensure default agent
  const { data: agent, error: aErr } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('user_id', userId)
    .single()
  if (aErr && aErr.code !== 'PGRST116') {
    console.error('[webhooks] agent fetch error:', aErr)
  } else if (!agent) {
    await supabaseAdmin
      .from('agents')
      .insert({ user_id: userId, name: 'Default Agent' })
    console.log('[webhooks] Created default agent')
  }

  res.json({ success: true })
})

export default router
