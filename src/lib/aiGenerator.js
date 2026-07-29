const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY

async function callAI(prompt, maxTokens = 2000) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'QuizSynce'
    },
    body: JSON.stringify({
      model: 'openrouter/auto',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: maxTokens
    })
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || 'AI generation failed')
  }

  const data = await response.json()
  const text = data.choices[0]?.message?.content || ''

  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Failed to parse AI response. Please try again.')
  return JSON.parse(jsonMatch[0])
}

export async function generateQuestionsFromTopic(topic, count = 5) {
  if (!OPENROUTER_KEY) {
    throw new Error('OpenRouter API key not configured. Add VITE_OPENROUTER_API_KEY to your environment variables. Get a free key at https://openrouter.ai')
  }

  const prompt = `Generate ${count} multiple choice quiz questions about: "${topic}"

Return ONLY a JSON array starting with [ and ending with ]. No markdown, no backticks, no explanation.
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Brief explanation why this is correct"
  }
]

Rules:
- "correct" is the 0-based index of the correct option
- Make options plausible but clearly distinguishable
- Keep questions concise and clear`

  return await callAI(prompt, 3000)
}

export async function generateOptionsForQuestions(rawQuestions) {
  if (!OPENROUTER_KEY) {
    throw new Error('OpenRouter API key not configured. Add VITE_OPENROUTER_API_KEY to your environment variables.')
  }

  // Process in batches of 5 to avoid AI token limits
  const batchSize = 5
  const batches = []
  for (let i = 0; i < rawQuestions.length; i += batchSize) {
    batches.push(rawQuestions.slice(i, i + batchSize))
  }

  const allQuestions = []

  for (const batch of batches) {
    const prompt = `For each question below, create 3 plausible wrong answer options.

${batch.map((q, i) => `${i + 1}. Question: ${q.question}\n   Correct Answer: ${q.answer}`).join('\n\n')}

Return ONLY a JSON array starting with [ and ending with ]. No markdown, no backticks, no explanation.
[
  {
    "question": "exact question text",
    "options": ["correct answer", "wrong option 1", "wrong option 2", "wrong option 3"],
    "correct": 0,
    "explanation": "brief explanation"
  }
]`

    const questions = await callAI(prompt, 3000)

    const shuffled = questions.map(q => {
      const correctAnswer = q.options[0]
      const opts = [...q.options].sort(() => Math.random() - 0.5)
      return {
        ...q,
        options: opts,
        correct: opts.indexOf(correctAnswer)
      }
    })

    allQuestions.push(...shuffled)
  }

  return allQuestions
}
