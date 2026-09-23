import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import axios from 'axios'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3333
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

app.use(
  cors({
    origin: true,
    credentials: true,
  })
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const uploadsDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/\s+/g, '_')
    cb(null, `${Date.now()}_${cleanName}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Please upload a .csv or .xlsx spreadsheet file.'))
    }
  },
})

const datasetsStore = new Map()
const conversationsStore = new Map()
const messagesStore = new Map()
let datasetIdCounter = 1
let conversationIdCounter = 1
let messageIdCounter = 1

class PythonAnalysisClient {
  static async getMetadata(filePath) {
    const res = await axios.post(`${PYTHON_SERVICE_URL}/metadata`, { file_path: filePath })
    return res.data
  }

  static async getPreview(payload) {
    const res = await axios.post(`${PYTHON_SERVICE_URL}/preview`, payload)
    return res.data
  }

  static async runAnalysis(payload) {
    const res = await axios.post(`${PYTHON_SERVICE_URL}/analyze`, payload)
    return res.data
  }
}

class AiService {
  static async generateStructuredQuery(userQuestion, metadata, history = [], explicitType = 'auto') {
    const columnsList = metadata.columns || (metadata.columns_info && metadata.columns_info.map((c) => c.name)) || []
    const columnsStr = columnsList.join(', ')
    const dtypesStr = JSON.stringify(metadata.dtypes || {})

    const typeInstruction = explicitType && explicitType !== 'auto'
      ? `PREFERRED OPERATION TYPE DIRECTIVE: Strictly use operation "${explicitType}" if applicable to the columns.`
      : ''

    const historyStr = history.length > 0
      ? `Previous Conversation History:\n` + history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
      : ''

    if (GEMINI_API_KEY) {
      try {
        const prompt = `
You are an expert AI data analyst planning engine for DataPilot AI.
Translate the user's natural language question into a safe structured JSON analysis request for Python Pandas calculations.

${typeInstruction}
${historyStr}

Dataset Schema:
Columns: [${columnsStr}]
Column Types: ${dtypesStr}

User Question: "${userQuestion}"

Allowed Operations:
- sum
- average
- count
- minimum
- maximum
- group_and_sum
- group_and_average
- percentage
- date_grouping
- comparison
- top_n
- bottom_n
- filter
- sort

Rules:
1. Reference ONLY column names that exist in [${columnsStr}].
2. Choose the operation (or follow directive "${explicitType}" if specified).
3. Return ONLY a raw valid JSON object (NO markdown backticks, NO code blocks):

{
  "operation": "group_and_sum",
  "group_by": "product",
  "value_column": "revenue",
  "date_column": null,
  "date_period": "month",
  "filter_column": null,
  "filter_operator": "eq",
  "filter_value": null,
  "sort": "desc",
  "limit": 10
}
`
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
        const res = await axios.post(url, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        })

        const textResponse = (res.data && res.data.candidates && res.data.candidates[0] && res.data.candidates[0].content && res.data.candidates[0].content.parts && res.data.candidates[0].content.parts[0] && res.data.candidates[0].content.parts[0].text) || ''
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          return this.sanitizeQuery(parsed, columnsList, explicitType)
        }
      } catch (err) {
        console.warn('Gemini API call failed, falling back to heuristic engine:', err.message)
      }
    }

    return this.heuristicFallbackQuery(userQuestion, columnsList, metadata.dtypes || {}, explicitType)
  }

  static sanitizeQuery(query, availableColumns, explicitType) {
    const colMap = new Map(availableColumns.map((c) => [c.toLowerCase(), c]))
    const findCol = (name) => (name ? colMap.get(String(name).toLowerCase()) : undefined)

    let groupBy = query.group_by
    if (typeof groupBy === 'string') {
      groupBy = findCol(groupBy)
    } else if (Array.isArray(groupBy)) {
      groupBy = groupBy.map(findCol).filter(Boolean)
    }

    const validOps = [
      'sum',
      'average',
      'count',
      'minimum',
      'maximum',
      'group_and_sum',
      'group_and_average',
      'top_n',
      'bottom_n',
      'filter',
      'sort',
      'percentage',
      'date_grouping',
      'comparison',
    ]

    let op = validOps.includes(query.operation) ? query.operation : 'count'
    if (explicitType && explicitType !== 'auto' && validOps.includes(explicitType)) {
      op = explicitType
    }

    return {
      operation: op,
      group_by: groupBy,
      value_column: findCol(query.value_column),
      date_column: findCol(query.date_column),
      date_period: query.date_period || 'month',
      filter_column: findCol(query.filter_column),
      filter_operator: query.filter_operator || 'eq',
      filter_value: query.filter_value,
      sort: query.sort === 'asc' ? 'asc' : 'desc',
      limit: typeof query.limit === 'number' ? Math.min(query.limit, 100) : 10,
    }
  }

  static heuristicFallbackQuery(q, cols, dtypes, explicitType) {
    const lowerQ = q.toLowerCase()
    const numericCols = cols.filter((c) => dtypes[c] === 'number')
    const textCols = cols.filter((c) => dtypes[c] === 'text' || dtypes[c] === 'datetime')
    const dateCols = cols.filter((c) => dtypes[c] === 'datetime' || c.toLowerCase().includes('date') || c.toLowerCase().includes('year'))

    let matchedGroupCol = textCols.find((c) => lowerQ.includes(c.toLowerCase())) || textCols[0]
    let matchedValCol = numericCols.find((c) => lowerQ.includes(c.toLowerCase())) || numericCols[0]
    let matchedDateCol = dateCols.find((c) => lowerQ.includes(c.toLowerCase())) || dateCols[0]

    if (explicitType && explicitType !== 'auto') {
      return {
        operation: explicitType,
        group_by: matchedGroupCol,
        value_column: matchedValCol,
        date_column: matchedDateCol,
        date_period: 'month',
        sort: 'desc',
        limit: 10,
      }
    }

    if (lowerQ.includes('month') || lowerQ.includes('trend') || lowerQ.includes('over time') || lowerQ.includes('by date')) {
      return {
        operation: 'date_grouping',
        date_column: matchedDateCol,
        value_column: matchedValCol,
        date_period: lowerQ.includes('year') ? 'year' : 'month',
      }
    }

    if (lowerQ.includes('percentage') || lowerQ.includes('share') || lowerQ.includes('portion')) {
      return {
        operation: 'percentage',
        group_by: matchedGroupCol,
        value_column: matchedValCol,
      }
    }

    if (lowerQ.includes('compare') || lowerQ.includes('versus') || lowerQ.includes('vs')) {
      return {
        operation: 'comparison',
        group_by: matchedGroupCol,
        value_column: matchedValCol,
      }
    }

    if (lowerQ.includes('top') || lowerQ.includes('highest') || lowerQ.includes('most')) {
      if (matchedGroupCol && matchedValCol) {
        return { operation: 'group_and_sum', group_by: matchedGroupCol, value_column: matchedValCol, sort: 'desc', limit: 10 }
      }
      return { operation: 'top_n', value_column: matchedValCol, sort: 'desc', limit: 10 }
    }

    if (lowerQ.includes('average') || lowerQ.includes('mean') || lowerQ.includes('avg')) {
      if (matchedGroupCol && matchedValCol) {
        return { operation: 'group_and_average', group_by: matchedGroupCol, value_column: matchedValCol, sort: 'desc', limit: 10 }
      }
      return { operation: 'average', value_column: matchedValCol }
    }

    if (lowerQ.includes('sum') || lowerQ.includes('total') || lowerQ.includes('revenue')) {
      if (matchedGroupCol && matchedValCol) {
        return { operation: 'group_and_sum', group_by: matchedGroupCol, value_column: matchedValCol, sort: 'desc', limit: 10 }
      }
      return { operation: 'sum', value_column: matchedValCol }
    }

    return { operation: 'count', limit: 10 }
  }

  static async generateExplanation(userQuestion, result) {
    if (GEMINI_API_KEY) {
      try {
        const prompt = `
User asked: "${userQuestion}"
Pandas calculation summary: ${result.summary}
Calculated dataset output: ${JSON.stringify(result.data.slice(0, 5))}

Write a clear, professional 2-3 sentence narrative explaining these calculated findings to the user.
Important: Base your response STRICTLY on the calculated output above. Do NOT invent numbers.
`
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
        const res = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] })
        const text = res.data && res.data.candidates && res.data.candidates[0] && res.data.candidates[0].content && res.data.candidates[0].content.parts && res.data.candidates[0].content.parts[0] && res.data.candidates[0].content.parts[0].text
        if (text) return text
      } catch (err) {
        // fallback
      }
    }

    if (!result.data || result.data.length === 0) {
      return `No records matched your criteria for "${userQuestion}".`
    }

    if (result.columns.length >= 2 && typeof result.data[0][result.columns[1]] === 'number') {
      const top = result.data[0]
      const nameCol = result.columns[0]
      const valCol = result.columns[1]
      const valStr = typeof top[valCol] === 'number' ? top[valCol].toLocaleString() : top[valCol]
      return `Based on your dataset, **${top[nameCol]}** led with a total ${valCol} of **${valStr}**. ${result.summary}.`
    }

    return `Analysis completed: ${result.summary}. Retreived ${result.data.length} calculated item(s).`
  }

  static generateSuggestedQuestions(columns = [], dtypes = {}) {
    const numCols = columns.filter((c) => dtypes[c] === 'number')
    const textCols = columns.filter((c) => dtypes[c] === 'text' || dtypes[c] === 'datetime')
    const dateCols = columns.filter((c) => dtypes[c] === 'datetime' || c.toLowerCase().includes('date'))

    const suggestions = []

    const textCol = textCols[0] || 'product'
    const numCol = numCols[0] || 'revenue'

    suggestions.push(`Which ${textCol} generated the most ${numCol}?`)
    suggestions.push(`Show the top 10 ${textCols[1] || textCol}s`)
    suggestions.push(`What is the average ${numCol}?`)

    if (dateCols.length > 0) {
      suggestions.push(`Show ${numCol} by month`)
    } else if (textCols.length > 1) {
      suggestions.push(`Which ${textCols[1]} has the highest sales?`)
    } else {
      suggestions.push(`Which region has the highest sales?`)
    }

    return suggestions
  }
}

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'datapilot-api' }))

app.post('/api/datasets/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded or file extension invalid.' })
    }

    const filePath = path.resolve(req.file.path).replace(/\\/g, '/')
    const originalFilename = req.file.originalname
    const fileType = path.extname(originalFilename).toLowerCase() === '.csv' ? 'csv' : 'xlsx'

    const metadata = await PythonAnalysisClient.getMetadata(filePath)
    const suggestedQuestions = AiService.generateSuggestedQuestions(metadata.column_names || metadata.columns, metadata.dtypes)

    const id = datasetIdCounter++
    const dataset = {
      id,
      userId: 1,
      name: req.body.name || originalFilename.replace(/\.[^/.]+$/, ''),
      originalFilename,
      fileType,
      fileSize: req.file.size,
      filePath,
      rowCount: metadata.rows || metadata.row_count || 0,
      columnCount: metadata.columns || metadata.column_count || 0,
      numericColumnCount: metadata.numeric_columns_count || 0,
      dateColumnCount: metadata.date_columns_count || 0,
      metadata: {
        columns: metadata.column_names || metadata.columns || [],
        columns_info: metadata.columns_info || [],
        dtypes: metadata.dtypes || {},
        missing_counts: metadata.missing_counts || {},
        sample_rows: metadata.sample_rows || [],
      },
      suggestedQuestions,
      createdAt: new Date().toISOString(),
    }

    datasetsStore.set(id, dataset)
    return res.status(201).json({ dataset })
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path)
      } catch (e) {}
    }
    return res.status(400).json({ message: `Failed to process dataset: ${err.message}` })
  }
})

app.get('/api/datasets', (req, res) => {
  const datasets = Array.from(datasetsStore.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  res.json({ datasets })
})

app.get('/api/datasets/:id', (req, res) => {
  const dataset = datasetsStore.get(Number(req.params.id))
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' })
  res.json({ dataset })
})

app.post('/api/datasets/:id/preview', async (req, res) => {
  const dataset = datasetsStore.get(Number(req.params.id))
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' })

  const { page, page_size, sort_by, sort_order, filters } = req.body || {}
  try {
    const previewData = await PythonAnalysisClient.getPreview({
      file_path: dataset.filePath,
      page: page || 1,
      page_size: page_size || 20,
      sort_by,
      sort_order,
      filters,
    })
    res.json(previewData)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

app.delete('/api/datasets/:id', (req, res) => {
  const id = Number(req.params.id)
  const dataset = datasetsStore.get(id)
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' })

  if (fs.existsSync(dataset.filePath)) {
    try {
      fs.unlinkSync(dataset.filePath)
    } catch (e) {}
  }
  datasetsStore.delete(id)
  res.json({ message: 'Dataset deleted successfully' })
})

app.post('/api/datasets/:id/analyze', async (req, res) => {
  const datasetId = Number(req.params.id)
  const dataset = datasetsStore.get(datasetId)
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' })

  const { question, conversation_id, analysis_type } = req.body || {}
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ message: 'Question is required' })
  }

  let conversationId = conversation_id
  if (!conversationId || !conversationsStore.has(conversationId)) {
    conversationId = conversationIdCounter++
    const title = question.length > 50 ? `${question.substring(0, 47)}...` : question
    conversationsStore.set(conversationId, { id: conversationId, datasetId, userId: 1, title, createdAt: new Date().toISOString() })
    messagesStore.set(conversationId, [])
  }

  const convMessages = messagesStore.get(conversationId)
  const previousHistory = convMessages.map(m => ({ role: m.role, content: m.content }))
  
  const userMsgId = messageIdCounter++
  convMessages.push({ id: userMsgId, role: 'user', content: question, createdAt: new Date().toISOString() })

  try {
    const structuredQuery = await AiService.generateStructuredQuery(question, dataset.metadata, previousHistory, analysis_type)

    const calculationResult = await PythonAnalysisClient.runAnalysis({
      file_path: dataset.filePath,
      operation: structuredQuery.operation,
      group_by: structuredQuery.group_by,
      value_column: structuredQuery.value_column,
      date_column: structuredQuery.date_column,
      date_period: structuredQuery.date_period,
      filter_column: structuredQuery.filter_column,
      filter_operator: structuredQuery.filter_operator,
      filter_value: structuredQuery.filter_value,
      sort: structuredQuery.sort,
      limit: structuredQuery.limit,
    })

    const explanation = await AiService.generateExplanation(question, calculationResult)

    let chartConfig = null
    const chartType = calculationResult.chart_type || 'bar'
    
    if (calculationResult.columns.length >= 2 && calculationResult.data.length > 0) {
      const xCol = calculationResult.columns[0]
      const yCol = calculationResult.columns[1]
      chartConfig = {
        type: chartType,
        xAxis: calculationResult.data.map((d) => String(d[xCol])),
        series: [
          {
            name: yCol,
            data: calculationResult.data.map((d) => d[yCol]),
          },
        ],
      }
    }

    const assistantMsg = {
      id: messageIdCounter++,
      role: 'assistant',
      content: explanation,
      structuredQuery,
      queryResult: calculationResult,
      chartConfig,
      additional_insights: calculationResult.additional_insights || [],
      createdAt: new Date().toISOString(),
    }
    convMessages.push(assistantMsg)

    return res.json({
      conversation_id: conversationId,
      structured_query: structuredQuery,
      result: calculationResult,
      explanation,
      chart_config: chartConfig,
      additional_insights: calculationResult.additional_insights || [],
      message: assistantMsg,
    })
  } catch (err) {
    const errorMsg = `Sorry, I couldn't analyze that question. Try asking something like 'Show revenue by product.'`
    convMessages.push({ id: messageIdCounter++, role: 'assistant', content: errorMsg, createdAt: new Date().toISOString() })
    return res.status(400).json({ message: errorMsg })
  }
})

app.delete('/api/conversations/:id', (req, res) => {
  const id = Number(req.params.id)
  conversationsStore.delete(id)
  messagesStore.delete(id)
  res.json({ message: 'Conversation cleared' })
})

app.get('/api/datasets/:id/conversations', (req, res) => {
  const datasetId = Number(req.params.id)
  const convs = Array.from(conversationsStore.values()).filter((c) => c.datasetId === datasetId)
  res.json({ conversations: convs })
})

app.get('/api/conversations/:id/messages', (req, res) => {
  const conversationId = Number(req.params.id)
  const conversation = conversationsStore.get(conversationId)
  if (!conversation) return res.status(404).json({ message: 'Conversation not found' })

  const messages = messagesStore.get(conversationId) || []
  res.json({ conversation, messages })
})

app.listen(PORT, () => {
  console.log(`DataPilot Backend API Server running on http://127.0.0.1:${PORT}`)
})
