// backend/routes/checkout.js
import express from 'express'
import { createCheckoutLink } from '../utils/hostedLink.js'

const router = express.Router()

router.post('/', async (req, res) => {
  const { userId, email, name, plan, billing } = req.body
  console.log('[checkout] request body →', req.body)

  if (!userId || !email || !name || !plan || !billing) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const url = await createCheckoutLink({ userId, email, name, plan, billing })
    console.log('[checkout] got hosted URL →', url)
    return res.json({ url })
  } catch (err) {
    console.error('[checkout] error creating session →', err)
    const message = err.message || 'Checkout link error'
    return res.status(500).json({ error: message })
  }
})

export default router
