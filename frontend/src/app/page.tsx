'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Upload,
  FileSpreadsheet,
  Sparkles,
  Send,
  Table as TableIcon,
  BarChart2,
  Code2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
  Trash2,
  Layers,
  Columns,
  Hash,
  Calendar,
  ShieldCheck,
  TrendingUp,
  Award,
  Zap,
  Check,
  X,
  FileText,
  Lightbulb,
  ChevronDown,
  SlidersHorizontal,
  Search,
  PieChart,
  LineChart,
  FileCode,
  Activity,
  Database
} from 'lucide-react'
import {
  uploadDataset,
  runAiAnalysis,
  clearConversation,
  Dataset,
  PreviewResponse,
  InsightItem
} from '../lib/api'
import DataPreviewTable from '../components/DataPreviewTable'
import EChartWrapper from '../components/EChartWrapper'
import SampleDatasetLoader from '../components/SampleDatasetLoader'

interface ChatMessage {
  id?: number
  role: 'user' | 'assistant'
  content: string
  structuredQuery?: any
  queryResult?: any
  chartConfig?: any
  additionalInsights?: InsightItem[]
}

export default function HomePage() {
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const [question, setQuestion] = useState('')
  const [analysisType, setAnalysisType] = useState<string>('auto')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const [conversationId, setConversationId] = useState<number | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [analysisStep, setAnalysisStep] = useState(0)

  const [activeTab, setActiveTab] = useState<'overview' | 'ai' | 'visuals' | 'schema'>('ai')
  const [chartTab, setChartTab] = useState<'chart' | 'table'>('chart')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropzoneRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, analyzing])

  const processFile = async (file: File) => {
    // Validation
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      setUploadError('Invalid file format. Please upload a .csv or .xlsx file.')
      setSelectedFile(null)
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds the 10 MB maximum limit.')
      setSelectedFile(null)
      return
    }

    if (file.size === 0) {
      setUploadError('The uploaded file is empty.')
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
    setUploading(true)
    setUploadError(null)
    setUploadProgress(20)
    setMessages([])
    setConversationId(undefined)

    const timer = setInterval(() => {
      setUploadProgress((p) => (p < 90 ? p + 25 : p))
    }, 150)

    try {
      const ds = await uploadDataset(file)
      setUploadProgress(100)
      await new Promise((r) => setTimeout(r, 200))
      setDataset(ds)
      setActiveTab('ai')
    } catch (err: any) {
      setUploadError(err.response?.data?.message || 'Upload failed. Please verify Python FastAPI analysis backend service is running.')
      setSelectedFile(null)
    } finally {
      clearInterval(timer)
      setUploading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleDropzoneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }

  const handleAsk = async (qText?: string, overrideType?: string) => {
    const q = (qText || question).trim()
    if (!q || !dataset || analyzing) return

    const targetType = overrideType || analysisType
    const userMsg: ChatMessage = { role: 'user', content: q }
    setMessages((prev) => [...prev, userMsg])
    setQuestion('')
    setAnalyzing(true)
    setAnalysisError(null)
    setAnalysisStep(1)

    const t1 = setTimeout(() => setAnalysisStep(2), 500)
    const t2 = setTimeout(() => setAnalysisStep(3), 1000)

    try {
      const res = await runAiAnalysis(dataset.id, q, conversationId, targetType)
      if (!conversationId) {
        setConversationId(res.conversation_id)
      }

      setAnalysisStep(4)
      await new Promise((r) => setTimeout(r, 300))
      setAnalysisStep(5)

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: res.explanation,
        structuredQuery: res.structured_query,
        queryResult: res.result,
        chartConfig: res.chart_config,
        additionalInsights: res.additional_insights,
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: any) {
      setAnalysisError(err.response?.data?.message || "Sorry, I couldn't analyze that question. Try asking something like 'Show revenue by product.'")
    } finally {
      clearTimeout(t1)
      clearTimeout(t2)
      setAnalyzing(false)
      setAnalysisStep(0)
    }
  }

  const handleClearConversation = async () => {
    if (conversationId) {
      try {
        await clearConversation(conversationId)
      } catch (e) {}
    }
    setMessages([])
    setConversationId(undefined)
  }

  const defaultSuggestions = dataset?.suggestedQuestions || [
    'Which product generated the most revenue?',
    'Show the top 10 customers',
    'What is the average order value?',
    'Show revenue by month',
    'Which region has the highest sales?',
    'Find unusual values',
  ]

  const lastAssistantMessage = messages.filter((m) => m.role === 'assistant').slice(-1)[0]

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-16">
      {/* 1. LANDING HERO STATE */}
      {!dataset ? (
        <div className="max-w-4xl mx-auto space-y-8 my-6 sm:my-10">
          {/* Hero Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-pill text-indigo-300 text-xs font-semibold shadow-lg">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Modern Conversational SaaS Analytics Platform</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
              Turn your spreadsheets into{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                insights.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
              Upload any CSV or Excel spreadsheet and ask natural language questions powered by Google Gemini AI & Python Pandas.
            </p>
          </div>

          {/* Upload Dropzone Container */}
          <div
            ref={dropzoneRef}
            tabIndex={0}
            role="button"
            aria-label="Upload CSV or Excel dataset dropzone"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={handleDropzoneKeyDown}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`glass-panel rounded-3xl p-8 sm:p-12 text-center border-2 border-dashed transition-all duration-300 shadow-2xl relative focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer ${
              isDragging
                ? 'border-indigo-400 bg-indigo-500/15 scale-[1.01]'
                : 'border-slate-700/80 hover:border-indigo-500/60 bg-slate-900/60'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv, .xlsx, .xls"
              className="hidden"
              tabIndex={-1}
            />

            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-300 mb-6 shadow-xl shadow-indigo-500/10">
              {uploading ? (
                <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
              ) : (
                <Upload className="w-10 h-10" />
              )}
            </div>

            {uploading ? (
              <div className="space-y-4 max-w-sm mx-auto">
                <div>
                  <h3 className="text-base font-bold text-white">Inspecting & Processing Dataset...</h3>
                  <p className="text-xs text-slate-400 font-mono mt-1">{selectedFile?.name}</p>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : selectedFile && !uploadError ? (
              <div className="space-y-4 max-w-sm mx-auto">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/80 border border-slate-700/80 text-left">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-indigo-400 shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-bold text-white truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFile(null)
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Drop your CSV or Excel file here</h3>
                  <p className="text-xs text-slate-400 mt-1">or click the button below to browse from your device</p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  className="px-7 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 inline-flex items-center gap-2.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Browse Files
                </button>

                <div className="pt-2 text-[11px] text-slate-400 font-mono">
                  CSV, XLSX - max 10 MB
                </div>
              </div>
            )}

            {/* Quick Demo Dataset Launcher */}
            <SampleDatasetLoader onSelectSample={processFile} disabled={uploading} />

            {uploadError && (
              <div className="mt-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 justify-center backdrop-blur-md">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Your file is processed securely and is never used for AI model training.</span>
            </div>
          </div>
        </div>
      ) : (
        /* 2. MODERN SAAS ACTIVE WORKSPACE STATE */
        <div className="space-y-6">
          {/* Active Dataset Header Card */}
          <div className="saas-panel rounded-2xl p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-lg">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  {dataset.originalFilename}
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-3">
                  <span>{dataset.rowCount?.toLocaleString()} rows</span>
                  <span>•</span>
                  <span>{dataset.columnCount} columns</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-bold">{dataset.numericColumnCount ?? 0} numeric</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setDataset(null)
                setSelectedFile(null)
                setMessages([])
                setConversationId(undefined)
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-bold text-slate-200 hover:text-white hover:border-indigo-500/50 transition-colors shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
              Upload New File
            </button>
          </div>

          {/* Modern Workspace Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'ai'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>💬 AI Analyst</span>
              {messages.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] text-white">
                  {messages.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>📊 Data Overview & Table</span>
            </button>

            <button
              onClick={() => setActiveTab('visuals')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'visuals'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>📈 Visual Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('schema')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'schema'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>📜 Schema & Dtypes</span>
            </button>
          </div>

          {/* TAB 1: 📊 DATA OVERVIEW & TABLE */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Key Summary Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="saas-card-interactive rounded-2xl p-5 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Rows</span>
                    <Layers className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-sans">{dataset.rowCount?.toLocaleString()}</div>
                </div>

                <div className="saas-card-interactive rounded-2xl p-5 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Columns</span>
                    <Columns className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-sans">{dataset.columnCount}</div>
                </div>

                <div className="saas-card-interactive rounded-2xl p-5 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Numeric Metrics</span>
                    <Hash className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400 font-sans">{dataset.numericColumnCount ?? 0}</div>
                </div>

                <div className="saas-card-interactive rounded-2xl p-5 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Date Timestamps</span>
                    <Calendar className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-400 font-sans">{dataset.dateColumnCount ?? 0}</div>
                </div>
              </div>

              {/* Data Preview Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-indigo-400" /> Interactive Spreadsheet Slice
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">Showing first 20 rows</span>
                </div>

                <DataPreviewTable datasetId={dataset.id} dtypes={dataset.metadata?.dtypes} />
              </div>
            </div>
          )}

          {/* TAB 2: 💬 AI ANALYST */}
          {activeTab === 'ai' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Question Input Card */}
              <div className="saas-panel rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Ask your dataset</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Ask questions in natural language. Gemini AI converts your intent into exact Pandas operations.
                      </p>
                    </div>
                  </div>

                  {messages.length > 0 && (
                    <button
                      onClick={handleClearConversation}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors self-start sm:self-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear conversation
                    </button>
                  )}
                </div>

                {/* Form Input with Mode Selector */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Analysis Type Option:</span>
                      <span className="text-indigo-400 font-mono font-bold">
                        {analysisType === 'auto' ? 'Auto Detect (AI Reasoning)' : analysisType}
                      </span>
                    </label>
                    {analysisType !== 'auto' && (
                      <button
                        type="button"
                        onClick={() => setAnalysisType('auto')}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Reset to Auto
                      </button>
                    )}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleAsk()
                    }}
                    className="flex flex-col sm:flex-row gap-3"
                  >
                    <div className="relative shrink-0 sm:w-56">
                      <select
                        value={analysisType}
                        onChange={(e) => setAnalysisType(e.target.value)}
                        className="w-full saas-input appearance-none rounded-xl px-3.5 py-3.5 pr-8 text-xs font-semibold text-slate-200 bg-slate-950 border border-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="auto">🤖 Auto Detect (AI)</option>
                        <option value="group_and_sum">📊 Group & Sum</option>
                        <option value="average">📈 Average / Mean</option>
                        <option value="top_n">🏆 Top N Items</option>
                        <option value="date_grouping">📅 Trend over Time</option>
                        <option value="percentage">🍰 Percentage Share</option>
                        <option value="comparison">⚖️ Comparison</option>
                        <option value="filter">🔍 Filter & Sort</option>
                        <option value="minimum">🔢 Minimum Value</option>
                        <option value="maximum">🔢 Maximum Value</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ask anything about your data (e.g. 'Show revenue by product')..."
                      className="flex-1 saas-input rounded-xl px-4 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
                    />

                    <button
                      type="submit"
                      disabled={analyzing || !question.trim()}
                      className="px-7 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Analyze</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Suggested Questions */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    <span>Suggested Questions</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {defaultSuggestions.map((sq, i) => (
                      <button
                        key={i}
                        onClick={() => handleAsk(sq)}
                        disabled={analyzing}
                        className="text-xs px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-indigo-500/60 text-slate-200 hover:text-indigo-300 transition-all text-left cursor-pointer"
                      >
                        "{sq}"
                      </button>
                    ))}
                  </div>
                </div>

                {/* Analysis Steps Progress */}
                {analyzing && (
                  <div className="p-5 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>Executing Pandas AI Pipeline...</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <div className={`flex items-center gap-2 ${analysisStep >= 1 ? 'text-emerald-400 font-semibold' : 'text-slate-600'}`}>
                        <Check className="w-3.5 h-3.5" />
                        <span>Parsing query intent</span>
                      </div>
                      <div className={`flex items-center gap-2 ${analysisStep >= 2 ? 'text-emerald-400 font-semibold' : 'text-slate-600'}`}>
                        <Check className="w-3.5 h-3.5" />
                        <span>Selecting table columns</span>
                      </div>
                      <div className={`flex items-center gap-2 ${analysisStep >= 3 ? 'text-emerald-400 font-semibold' : 'text-slate-600'}`}>
                        <Check className="w-3.5 h-3.5" />
                        <span>Mapping Pandas aggregation</span>
                      </div>
                      <div className={`flex items-center gap-2 ${analysisStep >= 4 ? 'text-emerald-400 font-semibold' : 'text-slate-600'}`}>
                        <Check className="w-3.5 h-3.5" />
                        <span>Calculating dataframe slice</span>
                      </div>
                      <div className={`flex items-center gap-2 ${analysisStep >= 5 ? 'text-emerald-400 font-semibold' : 'text-slate-600'}`}>
                        <Check className="w-3.5 h-3.5" />
                        <span>Generating explanation</span>
                      </div>
                    </div>
                  </div>
                )}

                {analysisError && (
                  <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{analysisError}</span>
                  </div>
                )}
              </div>

              {/* Conversation Thread */}
              {messages.length > 0 && (
                <div className="space-y-6 pt-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" /> Analysis Results & Conversation Thread
                  </h3>

                  {messages.map((msg, idx) => (
                    <div key={idx} className="space-y-4">
                      {msg.role === 'user' ? (
                        <div className="flex justify-end">
                          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl rounded-tr-none px-5 py-3 text-sm font-medium shadow-xl max-w-xl">
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                        <div className="saas-panel rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-6 shadow-2xl">
                          {/* Structured Request Box */}
                          {msg.structuredQuery && (
                            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-indigo-300 bg-slate-950 px-4 py-2.5 rounded-xl border border-indigo-500/30">
                              <Code2 className="w-4 h-4 text-indigo-400 shrink-0" />
                              <span>Pandas Query Operation:</span>
                              <span className="font-bold uppercase text-white bg-indigo-600/40 px-2 py-0.5 rounded border border-indigo-500/30">
                                {msg.structuredQuery.operation}
                              </span>
                              {msg.structuredQuery.group_by && (
                                <span>by <strong className="text-white">{Array.isArray(msg.structuredQuery.group_by) ? msg.structuredQuery.group_by.join(', ') : msg.structuredQuery.group_by}</strong></span>
                              )}
                              {msg.structuredQuery.value_column && (
                                <span>value: <strong className="text-white">{msg.structuredQuery.value_column}</strong></span>
                              )}
                            </div>
                          )}

                          {/* AI Explanation */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Executive Summary</h4>
                            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-slate-100 leading-relaxed font-sans">
                              {msg.content}
                            </div>
                          </div>

                          {/* Visual Chart & Table View */}
                          {msg.queryResult?.data && (
                            <div className="space-y-4 pt-2">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setChartTab('chart')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                      chartTab === 'chart'
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                        : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
                                    }`}
                                  >
                                    <BarChart2 className="w-3.5 h-3.5" /> Visualization
                                  </button>
                                  <button
                                    onClick={() => setChartTab('table')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                      chartTab === 'table'
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                        : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
                                    }`}
                                  >
                                    <TableIcon className="w-3.5 h-3.5" /> Result Table
                                  </button>
                                </div>

                                <span className="text-xs text-slate-400 font-mono">
                                  {msg.queryResult.data.length} row(s) calculated
                                </span>
                              </div>

                              {chartTab === 'chart' ? (
                                <EChartWrapper
                                  title={msg.queryResult.summary}
                                  chartType={msg.queryResult.chart_type || 'bar'}
                                  chartConfig={msg.chartConfig}
                                  columns={msg.queryResult.columns}
                                  data={msg.queryResult.data}
                                />
                              ) : (
                                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
                                  <table className="w-full text-left border-collapse text-xs font-mono">
                                    <thead>
                                      <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                                        {msg.queryResult.columns.map((c: string) => (
                                          <th key={c} className="py-3 px-4">{c}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/40 text-slate-200">
                                      {msg.queryResult.data.map((row: any, rIdx: number) => (
                                        <tr key={rIdx} className="hover:bg-slate-800/40">
                                          {msg.queryResult.columns.map((c: string) => (
                                            <td key={c} className="py-2.5 px-4 whitespace-nowrap">
                                              {typeof row[c] === 'number' ? row[c].toLocaleString() : String(row[c] ?? '')}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          )}

          {/* TAB 3: 📈 VISUAL ANALYTICS */}
          {activeTab === 'visuals' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {lastAssistantMessage?.queryResult?.data ? (
                <EChartWrapper
                  title={lastAssistantMessage.queryResult.summary || 'Visual Analytics'}
                  chartType={lastAssistantMessage.queryResult.chart_type || 'bar'}
                  chartConfig={lastAssistantMessage.chartConfig}
                  columns={lastAssistantMessage.queryResult.columns}
                  data={lastAssistantMessage.queryResult.data}
                />
              ) : (
                <div className="saas-panel rounded-3xl p-12 text-center text-slate-400 space-y-4 border border-slate-800">
                  <BarChart2 className="w-12 h-12 text-indigo-400 mx-auto" />
                  <div>
                    <h3 className="text-base font-bold text-white">No active visual chart generated yet</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      Ask a question in the 💬 AI Analyst tab (e.g., 'Show revenue by product') to generate interactive visual charts here.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('ai')}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" /> Go to AI Analyst
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: 📜 SCHEMA & DTYPES */}
          {activeTab === 'schema' && (
            <div className="saas-panel rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-800 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-indigo-400" /> Dataset Column Schema & Dtypes
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Inspected column datatypes, missing values, and unique counts extracted by Pandas.
                  </p>
                </div>

                <span className="text-xs font-mono text-indigo-400 bg-indigo-950 px-3 py-1 rounded-full border border-indigo-500/30">
                  {dataset.metadata?.columns?.length || dataset.columnCount} total columns
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Column Name</th>
                      <th className="py-3 px-4">Pandas Type</th>
                      <th className="py-3 px-4">Missing Values</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-slate-200">
                    {(dataset.metadata?.columns || []).map((col, idx) => {
                      const dtype = dataset.metadata?.dtypes?.[col] || 'text'
                      const missing = dataset.metadata?.missing_counts?.[col] ?? 0
                      let badge = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                      if (dtype === 'number') badge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      if (dtype === 'datetime') badge = 'bg-amber-500/10 text-amber-400 border-amber-500/30'

                      return (
                        <tr key={col} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4 text-slate-500 text-[10px]">{idx + 1}</td>
                          <td className="py-3 px-4 font-bold text-white">{col}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${badge}`}>
                              {dtype}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {missing > 0 ? (
                              <span className="text-rose-400 font-bold">{missing} nulls</span>
                            ) : (
                              <span className="text-slate-500">0 missing</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
