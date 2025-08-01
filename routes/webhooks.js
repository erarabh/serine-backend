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

// 🔄 raw-body middleware before parsing
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
  const signature =
  req.headers['x-hook-signature'] ||     // ✅ LemonSqueezy test mode
  req.headers['x-signature'] ||          // legacy or proxy relays
  req.headers['x-ls-signature'] ||       // some older sandbox flows
  req.headers['x-lemonsqueezy-signature']


  const raw = req.rawBody?.toString() || ''
  const expected = crypto.createHmac('sha256', LEMON_SQUEEZY_WEBHOOK_SECRET)
                         .update(raw)
                         .digest('hex')

  console.log('[webhooks] received signature:', signature)
  console.log('[webhooks] expected signature:', expected)

  if (!signature || signature !== expected) {
    console.warn('[webhooks] Signature mismatch')
    return res.status(403).json({ error: 'Invalid signature' })
  }

  let payload
  try {
    payload = JSON.parse(raw)
  } catch (err) {
    console.error('[webhooks] JSON parse error:', err)
    return res.status(400).json({ error: 'Malformed JSON' })
  }

  const userId    = payload.meta?.custom_data?.user_id
  const variantId = payload.data?.attributes?.variant_id

  if (!userId || !variantId) {
    console.error('[webhooks] missing identifiers:', { userId, variantId })
    return res.status(400).json({ error: 'Missing variantId or userId' })
  }

  const mapping = VARIANT_MAP[variantId]
  if (!mapping) {
    console.error('[webhooks] Unknown variant:', variantId)
    return res.status(400).json({ error: `Unknown variantId: ${variantId}` })
  }

  const { plan, billing } = mapping

  const { error: userErr } = await supabaseAdmin
    .from('users')
    .update({ plan, plan_period: billing })
    .eq('id', userId)

  if (userErr) {
    console.error('[webhooks] update failed:', userErr)
    return res.status(500).json({ error: userErr.message })
  }
  console.log(`[webhooks] Updated ${userId} → ${plan}/${billing}`)

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
