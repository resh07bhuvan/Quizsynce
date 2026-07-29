import * as XLSX from 'xlsx'

export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

        if (rows.length < 2) {
          reject(new Error('Excel file must have at least a header row and one question.'))
          return
        }

        const headers = rows[0].map(h => String(h).trim().toLowerCase())
        const dataRows = rows.slice(1).filter(r => r.some(cell => cell !== ''))

        const hasOptions = headers.some(h =>
          h.includes('option') || h.includes('choice') || h === 'a' || h === 'b' || h === 'c' || h === 'd'
        )

        let questions = []
        let needsAI = false

        if (hasOptions) {
          const qIdx = headers.findIndex(h => h.includes('question') || h.includes('q'))
          const correctIdx = headers.findIndex(h => h.includes('correct') || h.includes('answer') || h === 'ans')
          const explainIdx = headers.findIndex(h => h.includes('explain') || h.includes('reason'))

          const optionIndices = []
          headers.forEach((h, i) => {
            if (h.includes('option') || h.includes('choice') || ['a', 'b', 'c', 'd'].includes(h)) {
              optionIndices.push(i)
            }
          })

          if (qIdx === -1 || optionIndices.length < 2) {
            reject(new Error('Could not find Question and Option columns. Check your Excel format.'))
            return
          }

          questions = dataRows.map((row, idx) => {
            const options = optionIndices.map(i => String(row[i] || '').trim()).filter(Boolean)
            const correctRaw = String(row[correctIdx] || '0').trim().toLowerCase()

            let correct = 0
            if (correctRaw === 'a' || correctRaw === '1') correct = 0
            else if (correctRaw === 'b' || correctRaw === '2') correct = 1
            else if (correctRaw === 'c' || correctRaw === '3') correct = 2
            else if (correctRaw === 'd' || correctRaw === '4') correct = 3
            else correct = parseInt(correctRaw) || 0

            return {
              id: `q_${idx}`,
              question: String(row[qIdx] || '').trim(),
              options,
              correct: Math.min(correct, options.length - 1),
              explanation: explainIdx >= 0 ? String(row[explainIdx] || '').trim() : ''
            }
          }).filter(q => q.question)

        } else {
          needsAI = true
          const qIdx = headers.findIndex(h => h.includes('question') || h.includes('q') || h === '')
          const aIdx = headers.findIndex(h => h.includes('answer') || h.includes('a') || h === 'ans')

          if (qIdx === -1) {
            reject(new Error('Could not find a Question column. Check your Excel format.'))
            return
          }

          questions = dataRows.map((row, idx) => ({
            id: `q_${idx}`,
            question: String(row[qIdx] || '').trim(),
            answer: String(row[aIdx >= 0 ? aIdx : 1] || '').trim()
          })).filter(q => q.question && q.answer)
        }

        if (questions.length === 0) {
          reject(new Error('No valid questions found in the file.'))
          return
        }

        resolve({ questions, needsAI })
      } catch (err) {
        reject(new Error('Failed to read Excel file: ' + err.message))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsArrayBuffer(file)
  })
}

export function downloadExcelTemplate() {
  const wb = XLSX.utils.book_new()

  const fullData = [
    ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct (A/B/C/D)', 'Explanation'],
    ['What is the capital of France?', 'Paris', 'London', 'Berlin', 'Madrid', 'A', 'Paris is the capital and largest city of France.'],
    ['Which planet is closest to the Sun?', 'Venus', 'Mercury', 'Earth', 'Mars', 'B', 'Mercury is the closest planet to the Sun.']
  ]

  const simpleData = [
    ['Question', 'Answer'],
    ['What is the capital of France?', 'Paris'],
    ['Which planet is closest to the Sun?', 'Mercury'],
    ['Who wrote Romeo and Juliet?', 'William Shakespeare']
  ]

  const ws1 = XLSX.utils.aoa_to_sheet(fullData)
  const ws2 = XLSX.utils.aoa_to_sheet(simpleData)

  XLSX.utils.book_append_sheet(wb, ws1, 'Full Format (No AI needed)')
  XLSX.utils.book_append_sheet(wb, ws2,
