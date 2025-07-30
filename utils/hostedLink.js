// ✅ backend/utils/hostedLink.js

import fetch from 'node-fetch'

const PRODUCT_VARIANTS = {
  starter: {
    monthly: '899349',   // <-- replace with actual variant ID
    yearly:  '899351'
  },
  pro: {
    monthly: '899352',
    yearly:  '899353'
  }
}

export async function createCheckoutLink({ userId, email, name, plan, billing }) {
  const variant = PRODUCT_VARIANTS?.[plan]?.[billing]

  if (!variant) {
    throw new Error(`Variant not found for plan=${plan} billing=${billing}`)
  }

  const payload = {
    checkout_data: {
      custom_data: {
        user_id: userId,
        email,
        name
      }
    },
    variant_id: variant
  }

  const res = await fetch('https://api.lemonsqueezy.com/v1/checkout-links', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const json = await res.json()

  if (!res.ok || !json?.data?.url) {
    console.error('[createCheckoutLink] Error response:', json)
    throw new Error(json?.error || 'Failed to create checkout link')
  }

  console.log(`[createCheckoutLink] Created for ${email} -> ${json.data.url}`)
  return json.data.url
}
