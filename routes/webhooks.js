import express from 'express'
import crypto from 'crypto'
import getRawBody from 'raw-body'
import { VARIANT_MAP } from '../utils/variantMapping.js'
import { createClient } from '@supabase/supabase-js'

const router = express.Router()

// 1) Supabase Admin client
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[startup] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// 2) Raw-body middleware
router.use(async (req, res, next) => {
  try {
    req.rawBody = await getRawBody(req)
    next()
  } catch (err) {
    console.error('[webhooks] Could not read raw body', err)
    res.status(400).send('Cannot read raw body')
  }
})

router.post('/lemonsqueezy', async (req, res) => {
  const signatureHeader = req.headers['x-ls-signature']
  const secret          = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET
  const rawBody         = req.rawBody?.toString() || ''

  console.log('[webhooks] Incoming event, signature:', signatureHeader)

  // 3) Verify signature with timing-safe equal
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  if (
    typeof signatureHeader !== 'string' ||
    signatureHeader.length !== expected.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signatureHeader, 'hex'),
      Buffer.from(expected, 'hex')
    )
  ) {
    console.warn('[webhooks] Invalid signature', { expected, signatureHeader })
    return res.status(401).json({ error: 'Invalid signature' })
  }

  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch (err) {
    console.error('[webhooks] JSON parse failed', err)
    return res.status(400).json({ error: 'Malformed JSON' })
  }

  // 4) Extract metadata
  const variantId = payload.data?.attributes?.variant_id
  const userId    = payload.meta?.custom_data?.user_id

  console.log('[webhooks] variantId:', variantId, 'userId:', userId)

  if (!variantId || !userId) {
    return res.status(400).json({ error: 'Missing variantId or userId' })
  }

  const mapping = VARIANT_MAP[variantId]
  if (!mapping) {
    return res.status(400).json({ error: 'Unknown variantId' })
  }

  const { plan, billing } = mapping

  // 5) Update profile plan
  const { error: userErr } = await supabaseAdmin
    .from('users')
    .update({ plan, plan_period: billing })
    .eq('id', userId)

  if (userErr) {
    console.error('[webhooks] Failed to update user plan', userErr)
    return res.status(500).json({ error: userErr.message })
  }
  console.log(`[webhooks] Updated ${userId} → ${plan}/${billing}`)

  // 6) Ensure default agent exists
  const { data: agent, error: agentErr } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (agentErr && agentErr.code !== 'PGRST116') {
    console.error('[webhooks] Agent fetch error', agentErr)
  } else if (!agent) {
    const { error: insertErr } = await supabaseAdmin
      .from('agents')
      .insert({ user_id: userId, name: 'Default Agent' })
    if (insertErr) {
      console.error('[webhooks] Agent insert error', insertErr)
    } else {
      console.log('[webhooks] Created default agent')
    }
  }

  return res.json({ success: true })
})

export default router
