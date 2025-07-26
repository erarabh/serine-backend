// backend/routes/checkout.js
import express from 'express'
import { generateBuyLink } from '../utils/hostedLink.js'

const router = express.Router()

const BUY_LINKS = {
  starter: {
    monthly:  '899349',  // just the variant IDs now
    yearly:   '899351',
  },
  professional: {
    monthly:  '899352',
    yearly:   '899353',
  }
}

router.post('/', async (req, res) => {
  console.log('[checkout] Request body:', req.body)

  const { userId, email, name, plan, billing } = req.body

  if (!userId || !email || !name || !plan || !billing) {
    console.warn('[checkout] Missing fields in body')
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const variantId = BUY_LINKS[plan]?.[billing]
  if (!variantId) {
    console.warn('[checkout] Invalid plan/billing', plan, billing)
    return res.status(400).json({ error: 'Invalid plan/billing' })
  }

  // Build the full URL
  const redirectUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/dashboard`
  const url = generateBuyLink(variantId, userId, email, redirectUrl)

  console.log('[checkout] Redirecting user to:', url)
  res.json({ url })
})

export default router


/*

// backend/routes/checkout.js
import express from 'express'
const router = express.Router()

const BUY_LINKS = {
  starter: {
    monthly:  'https://serine-ai.lemonsqueezy.com/buy/899349',  // LS_VARIANT_MONTHLY_STARTER
    yearly:   'https://serine-ai.lemonsqueezy.com/buy/899351',  // LS_VARIANT_YEARLY_STARTER
  },
  professional: {
    monthly:  'https://serine-ai.lemonsqueezy.com/buy/899352',  // LS_VARIANT_MONTHLY_PROFESSIONAL
    yearly:   'https://serine-ai.lemonsqueezy.com/buy/899353',  // LS_VARIANT_YEARLY_PROFESSIONAL
  }
}

router.post('/checkout', async (req, res) => {
  const { userId, email, name, plan, billing } = req.body

  const baseUrl = BUY_LINKS[plan]?.[billing]
  if (!baseUrl) {
    return res.status(400).json({ error: 'Invalid plan or billing' })
  }

  const query = new URLSearchParams({
    'checkout[email]': email,
    'checkout[name]': name,
    'checkout[custom_data][user_id]': userId,
    'checkout[redirect_url]': `${process.env.NEXT_PUBLIC_FRONTEND_URL}/dashboard`
  })

  const url = `${baseUrl}?${query.toString()}`
  res.json({ url })
})

export default router


*/