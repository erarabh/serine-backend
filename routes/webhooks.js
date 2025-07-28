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

router.post('/', async (req, res) => {
  let rawBody
  try {
    rawBody = await getRawBody(req)
  } catch (err) {
    console.error('[webhook] Failed to read raw body:', err)
    return res.status(400).json({ error: 'Failed to read body' })
  }

  const signature = req.headers['x-signature']
  const rawString = rawBody.toString()

  console.log('--- [webhook] Incoming LemonSqueezy Event ---')
  console.log('[headers] x-signature:', signature)
  console.log('[env] webhook secret:', SECRET)
  console.log('[raw body]', rawString)

  if (!signature || !SECRET) {
    console.warn('[webhook] Missing signature or secret ❌')
    return res.status(400).json({ error: 'Missing signature or secret' })
  }

  const expected = crypto.createHmac('sha256', SECRET).update(rawString).digest('hex')
  console.log('[signature] expected:', expected)

  if (signature !== expected) {
    console.warn('[webhook] Invalid signature ❌')
    return res.status(403).json({ error: 'Invalid signature' })
  }

  let event
  try {
    event = JSON.parse(rawString)
  } catch (err) {
    console.error('[webhook] JSON parse error ❌:', err)
    return res.status(400).json({ error: 'Malformed JSON' })
  }

  const variantId = event?.data?.attributes?.variant_id
  const userId = event?.meta?.custom_data?.user_id

  console.log('[webhook] type:', event?.type)
  console.log('[webhook] variant_id:', variantId)
  console.log('[webhook] user_id:', userId)

  if (!variantId || !userId) {
    console.warn('[webhook] Missing variantId or userId ❌')
    return res.status(400).json({ error: 'Missing variantId or userId' })
  }

  const mapping = VARIANT_MAP[variantId]
  console.log('[variant mapping]', mapping)

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
    console.error('[webhook] Error fetching agent ❌:', agentErr)
  }

  if (!agent) {
    const { error: insertErr } = await supabase
      .from('agents')
      .insert({ user_id: userId, name: 'Default Agent' })

    if (insertErr) {
      console.error('[webhook] Agent creation failed ❌:', insertErr)
    } else {
      console.log(`[webhook] Created default agent for ${userId} ✅`)
    }
  }

  console.log(`[webhook] Sync complete for ${userId} ✅`)
  res.status(200).json({ success: true })
})

export default router
