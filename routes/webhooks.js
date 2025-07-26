import express from 'express'
import crypto from 'crypto'
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
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['x-signature']
    const rawBody = req.body?.toString()

    console.log('--- [webhook] Incoming LemonSqueezy Event ---')
    console.log('[headers] x-signature:', sig)
    console.log('[env] webhook secret:', SECRET)
    console.log('[raw body]', rawBody)

    if (!sig || !SECRET) {
      console.warn('[webhook] Missing signature or secret')
      return res.status(400).json({ error: 'Missing signature or secret' })
    }

    // Signature verification
    const expected = crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex')
    console.log('[signature] expected:', expected)

    if (sig !== expected) {
      console.warn('[webhook] Invalid signature')
      return res.status(403).json({ error: 'Invalid signature' })
    }

    // JSON parsing
    let event
    try {
      event = JSON.parse(rawBody)
    } catch (err) {
      console.error('[webhook] JSON parse error:', err)
      return res.status(400).json({ error: 'Malformed JSON' })
    }

    const variantId = event?.data?.attributes?.variant_id
    const userId = event?.meta?.custom_data?.user_id

    console.log('[webhook] type:', event?.type)
    console.log('[webhook] variant_id:', variantId)
    console.log('[webhook] user_id:', userId)

    if (!variantId || !userId) {
      console.warn('[webhook] Missing variantId or userId')
      return res.status(400).json({ error: 'Missing variantId or userId' })
    }

    // Map variant ID to plan/billing
    const mapping = VARIANT_MAP[variantId]
    console.log('[variant mapping]', mapping)

    if (!mapping) {
      console.warn('[webhook] Unknown variantId:', variantId)
      return res.status(400).json({ error: 'Unknown variantId' })
    }

    const { plan, billing } = mapping

    // Update user in Supabase
    const { error: userErr } = await supabase
      .from('users')
      .update({ plan, period: billing })
      .eq('id', userId)

    if (userErr) {
      console.error('[webhook] Supabase user update error:', userErr)
      return res.status(500).json({ error: 'Failed to update user' })
    } else {
      console.log(`[webhook] Updated user ${userId} → ${plan}/${billing}`)
    }

    // Ensure a default agent exists
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (agentErr) {
      console.error('[webhook] Error fetching agent:', agentErr)
    }

    if (!agent) {
      const { error: insertErr } = await supabase
        .from('agents')
        .insert({ user_id: userId, name: 'Default Agent' })

      if (insertErr) {
        console.error('[webhook] Agent creation failed:', insertErr)
      } else {
        console.log(`[webhook] Created default agent for ${userId}`)
      }
    }

    console.log(`[webhook] Sync complete for ${userId}`)
    res.status(200).json({ success: true })
  }
)

export default router
