export function createCheckoutLink({ userId, email, name, plan, billing }) {
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

  const variantId = PRODUCT_VARIANTS?.[plan]?.[billing]
  if (!variantId) {
    throw new Error(`Variant not found for ${plan}/${billing}`)
  }

  const url = `https://serine-ai.lemonsqueezy.com/buy/${variantId}?checkout[custom][user_id]=${userId}&checkout[email]=${email}&checkout[name]=${encodeURIComponent(name)}`
  console.log(`[createCheckoutLink] Generated link for ${email} → ${url}`)
  return url
}
