// backend/routes/webhooks.js
import express from 'express'
import crypto from 'crypto'
import getRawBody from 'raw-body'
import { VARIANT_MAP } from '../utils/variantMapping.js'
import { createClient } from '@supabase/supabase-js'

const router = express.Router()
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LEMON_SQUEEZY_WEBHOOK_SECRET } = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !LEMON_SQUEEZY_WEBHOOK_SECRET) {
  console.error('[startup] Missing required env for webhooks')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// 1) Read raw body for HMAC
router.use(async (req, res, next) => {
  try {
    req.rawBody = await getRawBody(req)
    next()
  } catch (err) {
    console.error('[webhooks] raw-body failed', err)
    res.status(400).send('Cannot read raw body')
  }
})

router.post('/lemonsqueezy', async (req, res) => {
  const signature = req.headers['x-hook-signature']
  const raw = req.rawBody.toString()
  const expected = crypto
    .createHmac('sha256', LEMON_SQUEEZY_WEBHOOK_SECRET)
    .update(raw)
    .digest('hex')

  console.log('[webhooks] signature:', signature, 'expected:', expected)
  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return res.status(400).json({ error: 'Malformed JSON' })
  }

  const userId    = payload.meta?.custom_data?.user_id
  const variantId = payload.data?.attributes?.variant_id
  console.log('[webhooks] user:', userId, 'variant:', variantId)

  if (!userId || !variantId) {
    return res.status(400).json({ error: 'Missing user_id or variant_id' })
  }

  const mapping = VARIANT_MAP[variantId]
  if (!mapping) {
    return res.status(400).json({ error: `Unknown variant_id: ${variantId}` })
  }

  // 2) Update the user’s plan
  await supabaseAdmin
    .from('users')
    .update({ plan: mapping.plan, plan_period: mapping.billing })
    .eq('id', userId)

  console.log(`[webhooks] Updated ${userId} → ${mapping.plan}/${mapping.billing}`)

  // 3) Ensure a default agent
  const { data: agent, error: agentErr } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (agentErr && agentErr.code !== 'PGRST116') {
    console.error('[webhooks] agent fetch error', agentErr)
  } else if (!agent) {
    await supabaseAdmin
      .from('agents')
      .insert({ user_id: userId, name: 'Default Agent' })
    console.log('[webhooks] default agent created')
  }

  res.json({ success: true })
})

export default router
