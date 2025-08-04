import express from 'express'
import crypto from 'crypto'
import getRawBody from 'raw-body'
import { VARIANT_MAP } from '../utils/variantMapping.js'
import { createClient } from '@supabase/supabase-js'

const router = express.Router()
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

// Raw-body parser for signature check
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
  // 1) Validate signature header
  const signature =
    req.headers['x-hook-signature'] ||
    req.headers['x-signature'] ||
    req.headers['x-ls-signature'] ||
    req.headers['x-lemonsqueezy-signature']

  if (!signature || typeof signature !== 'string') {
    console.warn('[webhooks] Missing or invalid signature header')
    return res.status(401).json({ error: 'Invalid signature header' })
  }

  // 2) Compute HMAC over raw body
  const expected = crypto
    .createHmac('sha256', LEMON_SQUEEZY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex')

  if (signature !== expected) {
    console.warn('[webhooks] Signature mismatch', { received: signature, expected })
    return res.status(403).json({ error: 'Invalid signature' })
  }

  // 3) Parse JSON
  let payload
  try {
    payload = JSON.parse(req.rawBody.toString())
  } catch (err) {
    console.error('[webhooks] JSON parse error:', err)
    return res.status(400).json({ error: 'Malformed JSON' })
  }

  // 4) Extract identifiers
  const userId    = payload.meta?.custom_data?.user_id
  const userEmail =
    payload.meta?.custom_data?.email ||
    payload.data?.attributes?.user_email
  const variantId = payload.data?.attributes?.variant_id
  const eventName =
    payload.event ||
    payload.meta?.event_name ||
    payload.meta?.eventName

  if (!userId || !userEmail || !variantId) {
    console.error('[webhooks] Missing identifiers:', { userId, userEmail, variantId })
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // 5) Filter relevant events
  if (
    eventName !== 'subscription_created' &&
    eventName !== 'subscription_payment_success'
  ) {
    console.log('[webhooks] Ignoring event:', eventName)
    return res.status(200).json({ ignored: true })
  }

  // 6) Map variant → plan & billing
  const mapping = VARIANT_MAP[variantId]
  if (!mapping) {
    console.error('[webhooks] Unknown variantId:', variantId)
    return res.status(400).json({ error: 'Unknown variantId' })
  }
  const { plan, billing: plan_period } = mapping

  // 7) Auto-confirm user’s email in Auth
  const { error: confirmErr } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { email_confirmed: true }
  )
  if (confirmErr) {
    console.error('[webhooks] Email confirm failed:', confirmErr)
    return res.status(500).json({ error: 'Email confirm failed' })
  }

  // 8) Update plan & period in users table
  const { error: planErr } = await supabaseAdmin
    .from('users')
    .update({ plan, plan_period })
    .eq('id', userId)
  if (planErr) {
    console.error('[webhooks] Plan update failed:', planErr)
    return res.status(500).json({ error: 'Plan update failed' })
  }

  console.log(`[webhooks] Updated ${userId} → ${plan}/${plan_period}`)

  // 9) Ensure default agent exists
  const { data: existingAgent, error: agentFetchErr } =
    await supabaseAdmin
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
      console.error('[webhooks] Agent creation failed:', agentCreateErr)
    } else {
      console.log('[webhooks] Created default agent for', userId)
    }
  }

  return res.status(200).json({ success: true })
})

export default router
