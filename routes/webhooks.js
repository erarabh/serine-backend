import express from 'express'
import crypto from 'crypto'
import getRawBody from 'raw-body'
import { VARIANT_MAP } from '../utils/variantMapping.js'
import { createClient } from '@supabase/supabase-js'

const router = express.Router()

// 🔐 Validate critical env vars
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  LEMON_SQUEEZY_WEBHOOK_SECRET,
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !LEMON_SQUEEZY_WEBHOOK_SECRET) {
  console.error('[startup] Missing required env for webhooks')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// 🧼 Raw body middleware for signature verification
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
  const headers = req.headers
  const signature =
    headers['x-hook-signature'] ||
    headers['x-signature'] ||
    headers['x-ls-signature'] ||
    headers['x-lemonsqueezy-signature']

  if (!signature || typeof signature !== 'string') {
    console.warn('[webhooks] Missing or invalid signature format')
    return res.status(403).json({ error: 'Invalid signature format' })
  }

  const expectedSignature = crypto
    .createHmac('sha256', LEMON_SQUEEZY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex')

  if (signature !== expectedSignature) {
    console.warn('[webhooks] Signature mismatch')
    console.log('[webhooks] received:', signature)
    console.log('[webhooks] expected:', expectedSignature)
    return res.status(403).json({ error: 'Invalid signature' })
  }

  let payload
  try {
    payload = JSON.parse(req.rawBody.toString())
  } catch (err) {
    console.error('[webhooks] JSON parse error:', err)
    return res.status(400).json({ error: 'Malformed JSON' })
  }

  const userId    = payload.meta?.custom_data?.user_id
  const userEmail = payload.meta?.custom_data?.email || payload.data?.attributes?.user_email
  const variantId = payload.data?.attributes?.variant_id

  if (!userId || !variantId || !userEmail) {
    console.error('[webhooks] missing identifiers:', { userId, variantId, userEmail })
    return res.status(400).json({ error: 'Missing variantId, userId, or email' })
  }

  const mapping = VARIANT_MAP[variantId]
  if (!mapping) {
    console.error('[webhooks] Unknown variant:', variantId)
    return res.status(400).json({ error: `Unknown variantId: ${variantId}` })
  }

  const { plan, billing } = mapping

  const { error: planUpdateErr } = await supabaseAdmin
    .from('users')
    .update({ plan, plan_period: billing })
    .eq('id', userId)

  if (planUpdateErr) {
    console.error('[webhooks] Failed to update user plan:', planUpdateErr)
    return res.status(500).json({ error: planUpdateErr.message })
  }

  console.log(`[webhooks] Updated ${userId} → ${plan}/${billing}`)

  // 🧠 Agent creation if not exists
  const { data: existingAgent, error: agentFetchErr } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (agentFetchErr && agentFetchErr.code !== 'PGRST116') {
    console.error('[webhooks] Agent fetch error:', agentFetchErr)
  } else if (!existingAgent) {
    const { error: agentCreateErr } = await supabaseAdmin
      .from('agents')
      .insert({ user_id: userId, name: 'Default Agent' })

    if (agentCreateErr) {
      console.error('[webhooks] Agent insert error:', agentCreateErr)
    } else {
      console.log('[webhooks] Created default agent')
    }
  }

  return res.json({ success: true })
})

export default router
