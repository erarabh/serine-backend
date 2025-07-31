// Centralize your secret & store IDs
export const STORE_ID = process.env.LS_STORE_ID
export const API_KEY  = process.env.LEMON_SQUEEZY_API_KEY

if (!STORE_ID) throw new Error('Missing LS_STORE_ID')
if (!API_KEY)  throw new Error('Missing LEMON_SQUEEZY_API_KEY')
