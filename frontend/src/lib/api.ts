import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3333/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface InsightItem {
  title: string
  value: string
  detail: string
}

export interface Dataset {
  id: number
  name: string
  originalFilename: string
  fileType: string
  fileSize: number
  rowCount: number
  columnCount: number
  numericColumnCount?: number
  dateColumnCount?: number
  metadata: {
    columns: string[]
    columns_info?: Array<{ name: string; type: string; missing_values: number; unique_values: number }>
    dtypes: Record<string, string>
    missing_counts: Record<string, number>
    sample_rows: any[]
  }
  suggestedQuestions?: string[]
  createdAt: string
}

export interface PreviewResponse {
  total_rows: number
  page: number
  page_size: number
  total_pages: number
  columns: string[]
  rows: any[]
}

export interface AnalysisResponse {
  conversation_id: number
  structured_query: any
  result: {
    status: string
    operation: string
    summary: string
    columns: string[]
    data: any[]
    total_count: number
    chart_type: string
    additional_insights?: InsightItem[]
  }
  explanation: string
  chart_config: any
  additional_insights?: InsightItem[]
  message: any
}

export const fetchDatasets = async (): Promise<Dataset[]> => {
  const res = await api.get('/datasets')
  return res.data.datasets || []
}

export const fetchDatasetById = async (id: string | number): Promise<Dataset> => {
  const res = await api.get(`/datasets/${id}`)
  return res.data.dataset
}

export const uploadDataset = async (file: File, name?: string): Promise<Dataset> => {
  const formData = new FormData()
  formData.append('file', file)
  if (name) formData.append('name', name)

  const res = await api.post('/datasets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.dataset
}

export const fetchDatasetPreview = async (
  id: string | number,
  params: {
    page?: number
    page_size?: number
    sort_by?: string
    sort_order?: string
    filters?: any[]
  }
): Promise<PreviewResponse> => {
  const res = await api.post(`/datasets/${id}/preview`, params)
  return res.data
}

export const deleteDataset = async (id: string | number) => {
  const res = await api.delete(`/datasets/${id}`)
  return res.data
}

export const runAiAnalysis = async (
  id: string | number,
  question: string,
  conversationId?: number,
  analysisType?: string
): Promise<AnalysisResponse> => {
  const res = await api.post(`/datasets/${id}/analyze`, {
    question,
    conversation_id: conversationId,
    analysis_type: analysisType,
  })
  return res.data
}

export const clearConversation = async (conversationId: string | number) => {
  const res = await api.delete(`/conversations/${conversationId}`)
  return res.data
}

export const fetchConversations = async (datasetId: string | number) => {
  const res = await api.get(`/datasets/${datasetId}/conversations`)
  return res.data.conversations || []
}

export const fetchMessages = async (conversationId: string | number) => {
  const res = await api.get(`/conversations/${conversationId}/messages`)
  return res.data
}
