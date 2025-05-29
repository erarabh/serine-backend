import fetch from 'node-fetch'

export async function chatWithAI(message) {
  console.log('✅ Using Gemini API Key:', process.env.GEMINI_API_KEY)

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: message }
          ]
        }
      ]
    })
  })

  const data = await res.json()
  console.log('🧠 Gemini Response:', JSON.stringify(data, null, 2))

  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    'Sorry, I couldn’t understand.'
  )
}
