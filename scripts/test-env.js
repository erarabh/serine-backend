import dotenv from 'dotenv'
dotenv.config()

console.log('URL:', process.env.SUPABASE_URL)
console.log('KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10), '...')
