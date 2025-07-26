// backend/utils/hostedLink.js
import fetch from 'node-fetch'
import {
  STORE_ID,
  API_KEY,
  VARIANT_IDS
} from './lemonsqueezy.server.js'

/**
 * Create a LemonSqueezy checkout session and return the hosted URL
 */
export async function createCheckoutLink({ userId, email, name, plan, billing }) {
  const variantId = VARIANT_IDS[plan]?.[billing]
  if (!variantId) {
    throw new Error(`Invalid plan/billing: ${plan}/${billing}`)
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  const payload = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email,
          name,
          custom: { user_id: userId }
        },
        product_options: {
          redirect_url: `${process.env.FRONTEND_URL}/dashboard`,
          receipt_button_text: 'Go to Dashboard',
          receipt_link_url: `${process.env.FRONTEND_URL}/dashboard`,
          receipt_thank_you_note: 'Thanks for joining Serine!'
        },
        expires_at: expiresAt
      },
      relationships: {
        store:   { data: { type: 'stores',   id: STORE_ID } },
        variant: { data: { type: 'variants', id: variantId } }
      }
    }
  }

  console.log('[hostedLink] creating checkout →', JSON.stringify(payload, null, 2))
  console.log('[hostedLink] STORE_ID →', STORE_ID)

  const res = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json'
    },
    body: JSON.stringify(payload)
  })

  const text = await res.text()
  console.log('[hostedLink] response status →', res.status)
  console.log('[hostedLink] response body →', text)

  if (!res.ok) {
    throw new Error(`LemonSqueezy API error: ${res.status} ${text}`)
  }

  const { data } = JSON.parse(text)
  return data?.attributes?.url
}
