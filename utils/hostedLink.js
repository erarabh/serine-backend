// backend/utils/hostedLink.js

/**
 * Creates a hosted-buy URL using the **pre-generated** Buy Link IDs
 * from your LemonSqueezy dashboard Share buttons.
 *
 * After deploying, hitting your /checkout route will return URLs like:
 *   https://serine-ai.lemonsqueezy.com/buy/3da07d0e-8b89-4986-a590-e414dc64958c...
 */

import { URLSearchParams } from 'url'

// Replace these IDs with the ones you copied from your dashboard
const HOSTED_BUY_LINKS = {
  starter: {
    monthly:      '3da07d0e-8b89-4986-a590-e414dc64958c',
    yearly:       '3745e74b-307e-4f3f-90c1-4ce7b2826a77'
  },
  professional: {
    monthly:      '97043936-f85c-48b7-9345-2e81631cabda',
    yearly:       '204edcdf-71cb-4fd0-afe0-a26d83d9d1f8'
  }
}

// Your store subdomain, e.g. "serine-ai" → "serine-ai.lemonsqueezy.com"
const STORE_SLUG = process.env.LS_STORE_SLUG || 'serine-ai'
if (!STORE_SLUG) {
  throw new Error('Missing LS_STORE_SLUG in your .env')
}

export function createCheckoutLink({ userId, email, name, plan, billing }) {
  const linkId = HOSTED_BUY_LINKS[plan]?.[billing]
  if (!linkId) {
    throw new Error(`No hosted buy-link for plan=${plan} billing=${billing}`)
  }

  // Build a query string safely, encoding [ ] @ spaces etc.
  const params = new URLSearchParams()
  params.set('checkout[custom][user_id]', userId)
  params.set('checkout[email]',             email)
  params.set('checkout[name]',              name)

  // Final hosted checkout URL
  return `https://${STORE_SLUG}.lemonsqueezy.com/buy/${linkId}?${params.toString()}`
}
