#!/usr/bin/env node

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { load }        from 'cheerio'

import { supabase }    from '../utils/supabaseClient.js'
import { fetchHTML }   from './fetchWithFallback.js'

//
// ─── ENV BOILERPLATE ───────────────────────────────────────────────
//
const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
dotenv.config({ path: resolve(__dirname, '../.env') })

// pull your exact IDs from .env
const USER_ID  = process.env.DEFAULT_USER_ID
const AGENT_ID = process.env.DEFAULT_AGENT_ID
if (!USER_ID || !AGENT_ID) {
  console.error('Missing DEFAULT_USER_ID or DEFAULT_AGENT_ID in .env')
  process.exit(1)
}

//
// ─── CORE SCRAPER + INGEST ─────────────────────────────────────────
//
async function run(url) {
  // 1) fetch & render HTML (static or CSR)
  const html = await fetchHTML(url)
  const $    = load(html)

  // 2) page title (.page-title → first <h1>)
  let pageTitle = $('h1.page-title').text().trim()
  if (!pageTitle) {
    pageTitle = $('h1').first().text().trim()
    console.warn('⚠️ .page-title missing; using:', pageTitle)
  }
  if (!pageTitle) throw new Error('No <h1> found for title')

  // 3) scrape products via Next.js attribute
  const products = []
  $('[data-type="product"]').each((_, el) => {
    const $el   = $(el)
    const name  = $el.find('h2').text().trim()
    const desc  = $el.find('p.text-gray-600').text().trim()
    const price = $el.find('p.text-purple-700').text().trim()
    const cta   = $el.find('button').text().trim()
    if (name) products.push({ name, desc, price, cta })
  })
  if (!products.length) throw new Error('No products found')

  // 4) build your Q&A array
  const qaPairs = [
    { question: 'What is this page about?',       answer: pageTitle },
    { question: 'How many products are listed?',  answer: `${products.length}` }
  ]
  for (const p of products) {
    qaPairs.push(
      { question: `What is ${p.name}?`,     answer: p.desc   || 'No description' },
      { question: `How much is ${p.name}?`, answer: p.price  || 'No price'       },
      { question: `How do I buy ${p.name}?`,
        answer: p.cta
          ? `${p.cta} — grab your ${p.name} today!`
          : `Visit the site to add ${p.name} to your cart.`
      }
    )
  }

  // 5) insert into Supabase with correct IDs
  let success = 0
  for (const { question, answer } of qaPairs) {
    const { error } = await supabase
      .from('qa_pairs')
      .insert([{
        question,
        answer,
        source_url: url,
        user_id:    USER_ID,
        agent_id:   AGENT_ID
      }])
    if (error) {
      console.error('❌ Failed to insert:', question, error.message)
    } else {
      success++
    }
  }

  console.log(`✅ Ingested ${success}/${qaPairs.length} QA pairs for ${url}`)
}

//
// ─── ESM ENTRYPOINT ────────────────────────────────────────────────
//
const url = process.argv[2]
if (!url) {
  console.error('Usage: node scripts/train-from-website.js <url>')
  process.exit(1)
}

run(url).catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
