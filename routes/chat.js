import express from 'express'
import { supabase } from '../utils/supabaseAdmin.js'
import fetch from 'node-fetch'

const router = express.Router()
const fallbackCount = {}
const MIN_SIMILARITY = 0.2

async function sendReply(res, user_id, agent_id, replyText) {
  // Log assistant session
  const { data: sess } = await supabase
    .from('sessions')
    .insert([{ user_id, agent_id, role: 'assistant', message: replyText }])
    .select('id')
    .single()

  // Increment bot_messages
  const today = new Date().toISOString().slice(0,10)
  const { data: metricRow } = await supabase
    .from('chat_metrics')
    .select('id, bot_messages')
    .eq('user_id', user_id)
    .eq('agent_id', agent_id)
    .eq('date', today)
    .maybeSingle()

  if (metricRow) {
    await supabase
      .from('chat_metrics')
      .update({ bot_messages: (metricRow.bot_messages||0) + 1 })
      .eq('id', metricRow.id)
  }

  return res.json({ reply: replyText, sessionId: sess?.id || null })
}

router.post('/', async (req, res) => {
  try {
    const body     = req.body || {}
    const message  = (body.message || '').trim()
    const user_id  = body.user_id  || body.userId
    const agent_id = body.agent_id || body.agentId || null

    if (!message || !user_id) {
      return res.status(400).json({ error: 'Missing message or user_id' })
    }

    const lower = message.toLowerCase()
    const today = new Date().toISOString().slice(0,10)
    const start = Date.now()

    // 1) Greeting
    if (/\b(hi|hello|hey|good (morning|afternoon|evening))\b/i.test(lower)) {
      const greet = new Date().getHours() < 12
        ? 'Good morning!'
        : new Date().getHours() < 18
          ? 'Good afternoon!'
          : 'Good evening!'
      return sendReply(res, user_id, agent_id, `${greet} How can I assist you today?`)
    }

    // 2) Farewell
    if (/\b(thank you|thanks|bye|goodbye|see you|take care)\b/i.test(lower)) {
      return sendReply(res, user_id, agent_id,
        "You're welcome! If you have more questions, I'm here anytime."
      )
    }

    // 3) Log user session
    await supabase
      .from('sessions')
      .insert([{ user_id, agent_id, role: 'user', message }])

    // 4) Sentiment scoring & insert
    let sentiment_score = 0.5, sentiment_label = 'neutral'
    if (/great|love|amazing|good|thanks|appreciate/i.test(message)) {
      sentiment_score = 0.9; sentiment_label = 'positive'
    } else if (/hate|bad|terrible|confused|useless/i.test(message)) {
      sentiment_score = 0.2; sentiment_label = 'negative'
    }
    await supabase
      .from('chat_sentiments')
      .insert([{ user_id, agent_id, message, sentiment_score, sentiment_label, created_at: new Date().toISOString() }])

    // 5) Upsert chat_metrics (user side)
    const { data: existing } = await supabase
      .from('chat_metrics')
      .select('*')
      .eq('user_id',  user_id)
      .eq('agent_id', agent_id)
      .eq('date',     today)
      .maybeSingle()

    let rowId
    if (existing) {
      await supabase
        .from('chat_metrics')
        .update({
          total_messages: existing.total_messages + 1,
          user_messages:  (existing.user_messages||0) + 1,
          positive:       existing.positive + (sentiment_label==='positive'?1:0),
          neutral:        existing.neutral  + (sentiment_label==='neutral'?1:0),
          negative:       existing.negative + (sentiment_label==='negative'?1:0)
        })
        .eq('id', existing.id)
      rowId = existing.id
    } else {
      const { data: inserted } = await supabase
        .from('chat_metrics')
        .insert([{
          user_id,
          agent_id,
          date:           today,
          total_messages: 1,
          user_messages:  1,
          bot_messages:   0,
          positive:       sentiment_label==='positive'?1:0,
          neutral:        sentiment_label==='neutral'?1:0,
          negative:       sentiment_label==='negative'?1:0
        }])
        .select('id')
        .single()
      rowId = inserted.id
    }

    // 6) RAG fallback check
    const { data: matches=[] } = await supabase.rpc(
      'match_qa_trigram',
      { user_id_arg:user_id, agent_id_arg:agent_id, query_text:message, match_count:3 }
    )
    if (!matches.length || matches[0].similarity < MIN_SIMILARITY) {
      const attempt = (fallbackCount[user_id]=(fallbackCount[user_id]||0)+1)
      const replies = [
        "I’m here to help but couldn’t find that answer. Try another related question?",
        "Still stuck—I don’t have info on that. Want to ask another?",
        "Sorry, I still can’t find that. Please reach out to support."
      ]
      return sendReply(res, user_id, agent_id, replies[Math.min(attempt-1,2)])
    }
    fallbackCount[user_id] = 0

    // 7) Gemini AI call
    const context = matches.map((q,i)=>`Q${i+1}: ${q.question}\nA${i+1}: ${q.answer}`).join('\n\n')
    const prompt  = `
You are Serine, a customer support assistant.
Use only the knowledge base below.
If not found, say "Sorry, I don’t have that information."

${context}

User: ${message}
Assistant:
    `.trim()

    const gemRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ contents:[{ role:'user', parts:[{ text:prompt }] }] })
      }
    )
    const gemJson      = await gemRes.json()
    const replyText    = gemJson?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Sorry, I didn't understand."
    const responseTime = Date.now() - start

    // 8) Stamp assistant side metrics
    await supabase
      .from('chat_metrics')
      .update({
        bot_messages:         (existing?.bot_messages||0) + 1,
        avg_response_time_ms: responseTime,
        satisfaction_score:   sentiment_score
      })
      .eq('id', rowId)

    // 9) Send back the reply
    return sendReply(res, user_id, agent_id, replyText)
  }
  catch (err) {
    console.error('Chat error:', err)
    return res.status(500).json({ error: err.message })
  }
})

export default router
