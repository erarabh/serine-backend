// backend/utils/variantMapping.js

export const VARIANT_MAP = {
  [process.env.LS_VARIANT_MONTHLY_STARTER]: {
    plan: 'starter',
    billing: 'monthly'
  },
  [process.env.LS_VARIANT_YEARLY_STARTER]: {
    plan: 'starter',
    billing: 'yearly'
  },
  [process.env.LS_VARIANT_MONTHLY_PROFESSIONAL]: {
    plan: 'professional',
    billing: 'monthly'
  },
  [process.env.LS_VARIANT_YEARLY_PROFESSIONAL]: {
    plan: 'professional',
    billing: 'yearly'
  }
}
