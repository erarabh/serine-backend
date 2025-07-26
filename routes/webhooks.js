// backend/routes/webhooks.js
import express from 'express'
import crypto  from 'crypto'
import { VARIANT_MAP } from '../utils/variantMapping.js'
import { createClient } from '@supabase/supabase-js'

const router = express.Router()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET

router.post(
  '/',
  express.raw({ type: 'application/json' }),    // raw BEFORE JSON
  async (req, res) => {
    const sig     = req.headers['x-signature']
    const rawBody = req.body?.toString()

    if (!sig || !SECRET) {
      console.warn('[webhook] Missing signature or secret')
      return res.status(400).json({ error: 'Missing signature or secret' })
    }

    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(rawBody)
      .digest('hex')

    if (sig !== expected) {
      console.warn('[webhook] Invalid signature')
      return res.status(403).json({ error: 'Invalid signature' })
    }

    let event
    try {
      event = JSON.parse(rawBody)
    } catch (err) {
      console.error('[webhook] JSON parse error:', err)
      return res.status(400).json({ error: 'Malformed JSON' })
    }

    const variantId = event?.data?.attributes?.variant_id
    const userId    = event?.meta?.custom_data?.user_id

    console.log(
      '[webhook] Event:', event.type,
      'variantId:', variantId,
      'user:', userId
    )

    if (!variantId || !userId) {
      console.warn('[webhook] Missing variantId or userId')
      return res.status(400).json({ error: 'Missing variantId or userId' })
    }

    const mapping = VARIANT_MAP[variantId]
    if (!mapping) {
      console.warn('[webhook] Unknown variantId:', variantId)
      return res.status(400).json({ error: 'Unknown variantId' })
    }

    const { plan, billing } = mapping

    // 1) Update user's plan  
    const { error: userErr } = await supabase
      .from('users')
      .update({ plan, period: billing })
      .eq('id', userId)

    if (userErr) {
      console.error('[webhook] Supabase user update error:', userErr)
      return res.status(500).json({ error: 'Failed to update user' })
    }

    // 2) Ensure a default agent exists  
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (!agent && !agentErr) {
      const { error: insertErr } = await supabase
        .from('agents')
        .insert({ user_id: userId, name: 'Default Agent' })
      if (insertErr) console.error('[webhook] Agent creation failed:', insertErr)
      else             console.log(`[webhook] Created default agent for ${userId}`)
    }

    console.log(`[webhook] Synced user ${userId} → ${plan}/${billing}`)
    res.status(200).json({ success: true })
  }
)

export default router


/*

// backend/routes/webhooks.js

import express from 'express'
import crypto from 'crypto'
import { VARIANT_MAP } from '../utils/variantMapping.js'
import { createClient } from '@supabase/supabase-js'

const router = express.Router()

const SUPABASE_URL     = process.env.SUPABASE_URL
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const WEBHOOK_SECRET   = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

router.post(
  '/webhooks/lemonsqueezy',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['x-signature']
    const rawBody = req.body?.toString()

    if (!signature || !WEBHOOK_SECRET) {
      console.warn('[webhook] Missing signature or secret')
      return res.status(400).json({ error: 'Missing signature or secret' })
    }

    const expected = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex')

    if (expected !== signature) {
      console.warn('[webhook] Invalid signature')
      return res.status(403).json({ error: 'Invalid signature' })
    }

    let event
    try {
      event = JSON.parse(rawBody)
    } catch (err) {
      console.error('[webhook] JSON parse error:', err)
      return res.status(400).json({ error: 'Malformed JSON' })
    }

    const variantId = event?.data?.attributes?.variant_id
    const userId = event?.meta?.custom_data?.user_id

    console.log('[webhook] Event:', event?.type, '→ variantId:', variantId, '→ user:', userId)

    if (!variantId || !userId) {
      console.warn('[webhook] Missing variantId or userId')
      return res.status(400).json({ error: 'Missing variantId or userId' })
    }

    const mapping = VARIANT_MAP[variantId]
    if (!mapping) {
      console.warn('[webhook] Unknown variant ID:', variantId)
      return res.status(400).json({ error: 'Unknown variantId' })
    }

    const { plan, billing } = mapping

    const { error: userErr } = await supabase
      .from('users')
      .update({ plan, period: billing })
      .eq('id', userId)

    if (userErr) {
      console.error('[webhook] Supabase user update error:', userErr)
      return res.status(500).json({ error: 'Failed to update user' })
    }

    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (!agent && !agentErr) {
      const { error: insertErr } = await supabase
        .from('agents')
        .insert({ user_id: userId, name: 'Default Agent' })

      if (insertErr) {
        console.error('[webhook] Agent creation failed:', insertErr)
      } else {
        console.log(`[webhook] Created default agent for ${userId}`)
      }
    }

    console.log(`[webhook] Synced user ${userId} → ${plan}/${billing}`)
    res.status(200).json({ success: true })
  }
)

export default router
*/