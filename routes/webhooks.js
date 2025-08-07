// backend/routes/webhooks.js

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

// Use express.raw on this endpoint only
router.post(
  '/lemonsqueezy',
  express.raw({ type: '*/*' }),
  async (req, res) => {
    const signature = req.headers['x-hook-signature']
    if (!signature) {
      console.warn('[webhooks] No signature header')
      return res.status(401).end()
    }

    const expected = crypto
      .createHmac('sha256', LEMON_SQUEEZY_WEBHOOK_SECRET)
      .update(req.body)
      .digest('hex')

    if (signature !== expected) {
      console.warn('[webhooks] Signature mismatch')
      return res.status(403).end()
    }

    let payload
    try {
      payload = JSON.parse(req.body.toString())
    } catch (err) {
      console.error('[webhooks] JSON parse error', err)
      return res.status(400).end()
    }

    const userId    = payload.meta?.custom_data?.user_id
    const variantId = payload.data?.attributes?.variant_id
    const eventName = payload.event

    if (!userId || !variantId) {
      console.error('[webhooks] Missing userId or variantId')
      return res.status(400).end()
    }

    if (
      eventName !== 'subscription_created' &&
      eventName !== 'subscription_payment_success'
    ) {
      console.log('[webhooks] Ignored event', eventName)
      return res.status(200).json({ ignored: true })
    }

    const mapping = VARIANT_MAP[variantId]
    if (!mapping) {
      console.error('[webhooks] Unknown variant', variantId)
      return res.status(400).end()
    }

    // 1) Confirm email without touching password
    const { error: confirmErr } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        email_confirmed: true,
      })
    if (confirmErr) {
      console.error('[webhooks] Email confirm failed', confirmErr)
      return res.status(500).end()
    }

    // 2) Update the plan
    const { error: planErr } = await supabaseAdmin
      .from('users')
      .update({
        plan:        mapping.plan,
        plan_period: mapping.billing,
      })
      .eq('id', userId)
    if (planErr) {
      console.error('[webhooks] Plan update failed', planErr)
      return res.status(500).end()
    }
    console.log(`[webhooks] ${userId} → ${mapping.plan}/${mapping.billing}`)

    // 3) Create default agent if none exists
    const { data: existingAgent, error: fetchErr } =
      await supabaseAdmin
        .from('agents')
        .select('id')
        .eq('user_id', userId)
        .single()

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      console.error('[webhooks] Agent fetch error', fetchErr)
    } else if (!existingAgent) {
      const { error: createErr } = await supabaseAdmin
        .from('agents')
        .insert({ user_id: userId, name: 'Default Agent' })
      if (createErr) {
        console.error('[webhooks] Agent create failed', createErr)
      } else {
        console.log('[webhooks] Created default agent for', userId)
      }
    }

    return res.status(200).json({ success: true })
  }
)

export default router
