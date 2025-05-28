import * as cheerio from 'cheerio'
import fetch from 'node-fetch'

export async function scrapeSite(url) {
  const response = await fetch(url)
  const html = await response.text()
  const $ = cheerio.load(html)

  const content = $('p, h1, h2, h3').map((_, el) => $(el).text().trim()).get()
  return content.filter(Boolean).join('\n')
}
