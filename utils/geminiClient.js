import fetch from 'node-fetch'

export async function chatWithAI(message) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: message }]
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

/*
import fetch from 'node-fetch'

export async function chatWithAI(message) {
  console.log('✅ Using OpenRouter API Key:', process.env.OPENROUTER_API_KEY)

const body = {
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: "You are Serine, a helpful commercial AI assistant.",
      },
      {
        role: "user",
        content: message,
      },
    ],
  }				

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
										 
*/	 
		 
						 
																					
		  
		 
					   
						  
		 
	   
	  
  })

  const data = await res.json()
  console.log('🧠 OpenRouter Response:', JSON.stringify(data, null, 2))

  return data?.choices?.[0]?.message?.content || "Sorry, I couldn’t understand."
}
