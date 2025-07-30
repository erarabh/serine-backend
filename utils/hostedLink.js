// ✅ backend/utils/hostedLink.js
import fetch from 'node-fetch'

const PRODUCT_VARIANTS = {
  starter: {
    monthly: '899349',
    yearly:  '899351'
  },
  professional: {
    monthly: '899352',
    yearly:  '899353'
  }
}

export async function createCheckoutLink({ userId, email, name, plan, billing }) {
  const variantId = PRODUCT_VARIANTS?.[plan]?.[billing]

  if (!variantId) {
    throw new Error(`[createCheckoutLink] Variant not found for plan=${plan} billing=${billing}`)
  }

  const payload = {
    store_id: parseInt(process.env.LS_STORE_ID),
    variant_id: parseInt(variantId),
    custom_data: {
      user_id: userId,
      email,
      name
    },
    checkout_options: {
      embed: false
    }
  }

  const res = await fetch('https://api.lemonsqueezy.com/v1/checkout-links', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const json = await res.json()

  if (!res.ok || !json?.data?.attributes?.url) {
    console.error('[createCheckoutLink] Error response:', json)
    throw new Error(json?.message || 'Failed to create checkout link')
  }

  const url = json.data.attributes.url
  console.log(`[createCheckoutLink] Created for ${email} -> ${url}`)
  return url
}
