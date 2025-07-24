// backend/utils/trainWebsite.js
import { scrapeSite } from './scraper.js'
import { supabase }   from './supabaseClient.js'

export async function trainWebsite({ url, userId, agentId }) {
  // 1) scrape raw page text
  const text = await scrapeSite(url)

  // 2) build basic Q&A pairs
  const qaPairs = [
    { question: 'What is this page about?',      answer: text.slice(0, 200) + '…' },
    { question: 'Show me the full text of this page', answer: text }
  ]

  // 3) insert into qa_pairs
  let insertedCount = 0
  for (const { question, answer } of qaPairs) {
    const { error } = await supabase
      .from('qa_pairs')
      .insert([{
        question,
        answer,
        source_url: url,
        user_id:    userId,
        agent_id:   agentId
      }])
    if (!error) insertedCount++
  }

  return insertedCount
}
