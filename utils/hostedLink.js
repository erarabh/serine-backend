// backend/utils/hostedLink.js
import { URLSearchParams } from 'url'

// These are your Hosted Buy Link UUIDs, from the LS dashboard
const LINKS = {
  starter: {
    monthly: '3da07d0e-8b89-4986-a590-e414dc64958c',
    yearly:  '3745e74b-307e-4f3f-90c1-4ce7b2826a77'
  },
  professional: {
    monthly: '97043936-f85c-48b7-9345-2e81631cabda',
    yearly:  '204edcdf-71cb-4fd0-afe0-a26d83d9d1f8'
  }
}

const STORE_SLUG = process.env.LS_STORE_SLUG
if (!STORE_SLUG) {
  throw new Error('[startup] Missing LS_STORE_SLUG in your .env')
}

export function createCheckoutLink({ userId, email, name, plan, billing }) {
  const linkId = LINKS[plan]?.[billing]
  if (!linkId) {
    throw new Error(`[checkout] No buy-link for ${plan}/${billing}`)
  }

  const params = new URLSearchParams({
    'checkout[custom][user_id]': userId,
    'checkout[email]':           email,
    'checkout[name]':            name
  })

  return `https://${STORE_SLUG}.lemonsqueezy.com/buy/${linkId}?${params}`
}
