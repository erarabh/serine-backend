import fetch from 'node-fetch'

export async function chatWithAI(message) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-r1:free",
      messages: [
        { role: "system", content: "You are Serine, a helpful multilingual commercial agent." },
        { role: "user", content: message }
      ]
    })
  })

  const data = await response.json()
  return data.choices?.[0]?.message?.content || "Sorry, I couldn’t understand."
}
