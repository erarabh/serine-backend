// backend/utils/variantMapping.js
export const VARIANT_MAP = {
  [process.env.STARTER_MONTHLY_VARIANT_ID]:   { plan: 'starter',      billing: 'monthly' },
  [process.env.STARTER_YEARLY_VARIANT_ID]:    { plan: 'starter',      billing: 'yearly'  },
  [process.env.PROFESSIONAL_MONTHLY_VARIANT_ID]: { plan: 'professional', billing: 'monthly' },
  [process.env.PROFESSIONAL_YEARLY_VARIANT_ID]:  { plan: 'professional', billing: 'yearly'  },
}
