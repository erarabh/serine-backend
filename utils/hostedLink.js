// backend/utils/hostedLink.js

/**
 * Generates a hosted LemonSqueezy buy link with user_id and redirect
 * @param {number|string} variantId - Variant ID from LS_VARIANT_* or VARIANT_MAP
 * @param {string} userId - Supabase user.id
 * @param {string} email - Optional user email (prefill)
 * @param {string} redirectUrl - Where user lands after payment
 */
export function generateBuyLink(variantId, userId, email, redirectUrl) {
  const qs = new URLSearchParams({
    'checkout[custom_data][user_id]': userId,
    'checkout[redirect_url]': redirectUrl
  })

  if (email) qs.set('checkout[email]', email)

  return `https://serine-ai.lemonsqueezy.com/buy/${variantId}?${qs.toString()}`
}
