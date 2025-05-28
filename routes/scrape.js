import express from 'express'
import { scrapeSite } from '../utils/scraper.js'

const router = express.Router()

																 
router.post('/', async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'Missing URL' })

  try {
    const content = await scrapeSite(url)
    res.json({ content })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Scraping failed' })
  }
})

export default router
