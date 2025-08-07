import express from 'express'
import crypto from 'crypto'
import { VARIANT_MAP } from '../utils/variantMapping.js'
import { createClient } from '@supabase/supabase-js'

const router = express.Router()
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  LEMON_SQUEEZY_WEBHOOK_SECRET,
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !LEMON_SQUEEZY_WEBHOOK_SECRET) {
  console.error('[startup] Missing webhook env vars')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Only this route uses raw body, so HMAC sees the exact payload
router.post(
  '/lemonsqueezy',
  express.raw({ type: '*/*' }),
  async (req, res) => {
    // 1) Accept any of the known signature headers
    const signature =
      req.headers['x-hook-signature'] ||
      req.headers['x-signature'] ||
      req.headers['x-ls-signature'] ||
      req.headers['x-lemonsqueezy-signature']

    if (typeof signature !== 'string') {
      console.warn('[webhooks] No signature header')
      return res.status(401).json({ error: 'Missing signature header' })
    }

    // 2) Verify HMAC
    const expected = crypto
      .createHmac('sha256', LEMON_SQUEEZY_WEBHOOK_SECRET)
      .update(req.body)
      .digest('hex')

    if (signature !== expected) {
      console.warn('[webhooks] Signature mismatch', {
        received: signature,
        expected,
      })
      return res.status(403).json({ error: 'Invalid signature' })
    }

    // 3) Parse JSON
    let payload
    try {
      payload = JSON.parse(req.body.toString())
    } catch (err) {
      console.error('[webhooks] JSON parse error', err)
      return res.status(400).json({ error: 'Malformed JSON' })
    }

    const userId    = payload.meta?.custom_data?.user_id
    const variantId = payload.data?.attributes?.variant_id
    const eventName = payload.event

    if (!userId || !variantId) {
      console.error('[webhooks] Missing userId or variantId', {
        userId,
        variantId,
      })
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // 4) Only care about creation & successful payments
    if (
      eventName !== 'subscription_created' &&
      eventName !== 'subscription_payment_success'
    ) {
      console.log('[webhooks] Ignoring event', eventName)
      return res.status(200).json({ ignored: true })
    }

    const mapping = VARIANT_MAP[variantId]
    if (!mapping) {
      console.error('[webhooks] Unknown variantId', variantId)
      return res.status(400).json({ error: 'Unknown variantId' })
    }

    // 5) Confirm email (do NOT touch password)
    const { error: confirmErr } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { email_confirmed: true }
    )
    if (confirmErr) {
      console.error('[webhooks] Email confirm failed', confirmErr)
      return res.status(500).json({ error: 'Email confirmation failed' })
    }

    // 6) Update plan & period
    const { error: planErr } = await supabaseAdmin
      .from('users')
      .update({
        plan:        mapping.plan,
        plan_period: mapping.billing,
      })
      .eq('id', userId)
    if (planErr) {
      console.error('[webhooks] Plan update failed', planErr)
      return res.status(500).json({ error: 'Plan update failed' })
    }
    console.log(
      `[webhooks] Updated user ${userId} → ${mapping.plan}/${mapping.billing}`
    )

    // 7) Ensure default agent exists
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('agents')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      console.error('[webhooks] Agent fetch error', fetchErr)
    } else if (!existing) {
      const { error: agentErr } = await supabaseAdmin
        .from('agents')
        .insert({ user_id: userId, name: 'Default Agent' })
      if (agentErr) {
        console.error('[webhooks] Agent creation failed', agentErr)
      } else {
        console.log('[webhooks] Created default agent for', userId)
      }
    }

    return res.status(200).json({ success: true })
  }
)

export default router
