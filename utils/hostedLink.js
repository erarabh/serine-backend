// backend/utils/hostedLink.js

import { URLSearchParams } from 'url'

// Pre-generated buy‐link UUIDs from your LemonSqueezy dashboard
const LINKS = {
  starter: {
    monthly:      '3da07d0e-8b89-4986-a590-e414dc64958c',
    yearly:       '3745e74b-307e-4f3f-90c1-4ce7b2826a77'
  },
  professional: {
    monthly:      '97043936-f85c-48b7-9345-2e81631cabda',
    yearly:       '204edcdf-71cb-4fd0-afe0-a26d83d9d1f8'
  }
}

// Grab your store slug—no fallback here, we want you to set it explicitly
const STORE_SLUG = process.env.LS_STORE_SLUG
if (!STORE_SLUG) {
  throw new Error('[startup] Missing LS_STORE_SLUG – set this in your env')
}

/**
 * @param {{ userId:string, email:string, name:string, plan:string, billing:string }} opts
 * @returns {string} fully-formed hosted buy link
 */
export function createCheckoutLink({ userId, email, name, plan, billing }) {
  const linkId = LINKS[plan]?.[billing]
  if (!linkId) {
    throw new Error(`[checkout] No buy-link for plan="${plan}" billing="${billing}"`)
  }

  const params = new URLSearchParams({
    'checkout[custom][user_id]': userId,
    'checkout[email]':           email,
    'checkout[name]':            name
  })

  return `https://${STORE_SLUG}.lemonsqueezy.com/buy/${linkId}?${params}`
}
