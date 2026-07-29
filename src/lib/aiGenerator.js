const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY

export async function generateQuestionsFromTopic(topic, count = 5) {
  if (!OPENROUTER_KEY) {
    throw new Error('OpenRouter API key not configured. Add VITE_OPENROUTER_API_KEY to your environment variables. Get a free key at https://openrouter.ai')
  }

  const prompt = `Generate ${count} multiple choice quiz questions about: "${topic}"

Return ONLY a valid JSON array. No markdown, no explanation. Format:
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
- Questions should test real understanding, not just memorization
- Keep questions concise and clear`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'QuizSynce'
    },
    body: JSON.stringify({
      model: 'mistralai/mistral-small-3.2-24b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000
    })
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || 'AI generation failed')
  }

  const data = await response.json()
  const text = data.choices[0]?.message?.content || ''

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array found in response')
    return JSON.parse(jsonMatch[0])
  } catch {
    throw new Error('Failed to parse AI response. Please try again.')
  }
}

export async function generateOptionsForQuestions(rawQuestions) {
  if (!OPENROUTER_KEY) {
    throw new Error('OpenRouter API key not configured. Add VITE_OPENROUTER_API_KEY to your environment variables.')
  }

  const prompt = `For each question below, create 3 plausible wrong answer options. The correct answer is provided.

Questions:
${rawQuestions.map((q, i) => `${i + 1}. Q: ${q.question}\n   Correct Answer: ${q.answer}`).join('\n\n')}

Return ONLY a valid JSON array. No markdown. Format:
[
  {
    "question": "exact question text",
    "options": ["correct answer", "wrong 1", "wrong 2", "wrong 3"],
    "correct": 0,
    "explanation": "brief explanation"
  }
]

The correct answer must always be at index 0 in options (it will be shuffled later).`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'QuizSynce'
    },
    body: JSON.stringify({
      model: 'mistralai/mistral-7b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 3000
    })
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || 'AI generation failed')
  }

  const data = await response.json()
  const text = data.choices[0]?.message?.content || ''

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array found in response')
    const questions = JSON.parse(jsonMatch[0])

    return questions.map(q => {
      const correctAnswer = q.options[q.correct]
      const shuffled = [...q.options].sort(() => Math.random() - 0.5)
      return {
        ...q,
        options: shuffled,
        correct: shuffled.indexOf(correctAnswer)
      }
    })
  } catch {
    throw new Error('Failed to parse AI response. Please try again.')
  }
}
