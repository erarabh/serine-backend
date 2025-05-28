import fetch from 'node-fetch'

export async function chatWithAI(message) {
  console.log('✅ Using OpenRouter API Key:', process.env.OPENROUTER_API_KEY)

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer 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`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-r1:free',
      messages: [
        {
          role: 'system',
          content: 'You are Serine, a helpful multilingual commercial AI assistant.'
        },
        {
          role: 'user',
          content: message
        }
      ]
    })
  })

  const data = await response.json()
  console.log('🧠 OpenRouter Response:', JSON.stringify(data, null, 2))

  return data.choices?.[0]?.message?.content || "Sorry, I couldn’t understand."
}
