// scripts/fetchWithFallback.js
import fetch from 'node-fetch'
import { chromium } from 'playwright'

export async function fetchHTML(url) {
  // 1) quick static fetch
  const res  = await fetch(url)
  const text = await res.text()
  // if products already in HTML, skip rendering
  if (text.includes('data-type="product"')) return text

  // 2) otherwise render in headless Chrome
  const browser = await chromium.launch()
  const page    = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })
  const html    = await page.content()
  await browser.close()
  return html
}
