// ✅ backend/routes/webhooks.js — raw-body and signature verification

import express from 'express'
import crypto from 'crypto'
import getRawBody from 'raw-body'
import { VARIANT_MAP } from '../utils/variantMapping.js'
import { createClient } from '@supabase/supabase-js'

const router = express.Router()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET

router.use(async (req, res, next) => {
  try {
    req.rawBody = await getRawBody(req)
    next()
  } catch (err) {
    console.error('[webhook] Failed to read raw body:', err)
    return res.status(400).send('Cannot read raw body')
  }
})

router.post('/lemonsqueezy', async (req, res) => {
  const sig = req.headers['x-signature']
  const raw = req.rawBody?.toString()

  console.log('--- [webhook] Incoming LemonSqueezy Event ---')
  console.log('[headers] x-signature:', sig)
  console.log('[env] webhook secret:', SECRET)
  console.log('[raw body]', raw)

  const expected = crypto.createHmac('sha256', SECRET).update(raw).digest('hex')
  console.log('[signature] expected:', expected)

  if (sig !== expected) {
    console.warn('[webhook] Invalid signature ❌')
    return res.status(403).json({ error: 'Invalid signature' })
  }

  let event
  try {
    event = JSON.parse(raw)
  } catch (err) {
    console.error('[webhook] JSON parse error ❌:', err)
    return res.status(400).json({ error: 'Malformed JSON' })
  }

  const variantId = event?.data?.attributes?.variant_id
  const userId = event?.meta?.custom_data?.user_id

  console.log('[webhook] variant_id:', variantId)
  console.log('[webhook] user_id:', userId)

  if (!variantId || !userId) {
    console.warn('[webhook] Missing variantId or userId ❌')
    return res.status(400).json({ error: 'Missing variantId or userId' })
  }

  const mapping = VARIANT_MAP[variantId]
  if (!mapping) {
    console.warn('[webhook] Unknown variantId ❌:', variantId)
    return res.status(400).json({ error: 'Unknown variantId' })
  }

  const { plan, billing } = mapping

  const { error: userErr } = await supabase
    .from('users')
    .update({ plan, period: billing })
    .eq('id', userId)

  if (userErr) {
    console.error('[webhook] Supabase user update error ❌:', userErr)
    return res.status(500).json({ error: 'Failed to update user' })
  } else {
    console.log(`[webhook] Updated user ${userId} → ${plan}/${billing} ✅`)
  }

  const { data: agent, error: agentErr } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (agentErr) {
    console.error('[webhook] Agent fetch error ❌:', agentErr)
  }

  if (!agent) {
    const { error: insertErr } = await supabase
      .from('agents')
      .insert({ user_id: userId, name: 'Default Agent' })

    if (insertErr) {
      console.error('[webhook] Agent insert error ❌:', insertErr)
    } else {
      console.log(`[webhook] Created default agent for ${userId} ✅`)
    }
  }

  console.log(`[webhook] Sync complete for ${userId} ✅`)
  res.status(200).json({ success: true })
})

export default router
