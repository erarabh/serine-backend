// backend/utils/lemonsqueezy.server.js

/**
 * All LemonSqueezy secrets and variant IDs live here.
 * This file must reside next to hostedLink.js under utils/.
 */

export const STORE_ID = process.env.LS_STORE_ID
export const API_KEY  = process.env.LEMON_SQUEEZY_API_KEY

export const VARIANT_IDS = {
  starter: {
    monthly:  '899349',
    yearly:   '899351',
  },
  professional: {
    monthly:  '899352',
    yearly:   '899353',
  },
}
