'use client'

import React, { useState, useEffect } from 'react'
import { fetchDatasetPreview, PreviewResponse } from '../lib/api'
import { ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react'

interface DataPreviewTableProps {
  datasetId: number
  dtypes?: Record<string, string>
}

export default function DataPreviewTable({ datasetId, dtypes }: DataPreviewTableProps) {
  const [data, setData] = useState<PreviewResponse | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    fetchDatasetPreview(datasetId, { page, page_size: pageSize })
      .then((res) => {
        if (isMounted) setData(res)
      })
      .catch((err) => {
        if (isMounted) setError(err.response?.data?.message || err.message || 'Failed to load preview data')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [datasetId, page, pageSize])

  if (loading) {
    return (
      <div className="saas-panel rounded-2xl p-12 text-center text-indigo-300 flex items-center justify-center gap-3 shadow-xl">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-xs font-medium font-mono">Fetching spreadsheet slice...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="saas-panel rounded-2xl p-6 text-center text-rose-400 flex items-center justify-center gap-2">
        <AlertCircle className="w-4 h-4" />
        <span className="text-xs font-medium">{error || 'Unable to preview dataset'}</span>
      </div>
    )
  }

  return (
    <div className="saas-panel rounded-2xl border border-slate-800 overflow-hidden space-y-4 shadow-2xl">
      {/* Table container */}
      <div className="overflow-x-auto max-h-[500px]">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead className="sticky top-0 bg-slate-950 shadow-md z-10 border-b border-slate-700 text-slate-200">
            <tr>
              <th className="py-3.5 px-4 text-slate-400 font-bold uppercase text-[10px] w-12 text-center">#</th>
              {data.columns.map((col) => {
                const dt = dtypes?.[col] || 'text'
                let badgeStyle = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                if (dt === 'number') badgeStyle = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                if (dt === 'datetime') badgeStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/40'

                return (
                  <th key={col} className="py-3.5 px-4 text-white font-bold whitespace-nowrap">
                    {col}
                    <span className={`ml-1.5 text-[9px] uppercase px-1.5 py-0.5 rounded font-bold border ${badgeStyle}`}>
                      {dt}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/90 text-slate-100 font-sans">
            {data.rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-indigo-600/10 transition-colors">
                <td className="py-2.5 px-4 text-slate-400 text-[10px] text-center font-bold font-mono">
                  {(page - 1) * pageSize + idx + 1}
                </td>
                {data.columns.map((col) => {
                  const val = row[col]
                  return (
                    <td key={col} className="py-2.5 px-4 whitespace-nowrap font-mono text-xs text-slate-200">
                      {val === null || val === undefined ? (
                        <span className="text-slate-500 italic font-sans text-[11px]">null</span>
                      ) : typeof val === 'number' ? (
                        <span className="text-emerald-400 font-bold">{val.toLocaleString()}</span>
                      ) : (
                        String(val)
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-700/80 flex items-center justify-between text-xs text-slate-300 bg-slate-950">
        <div>
          Showing <span className="font-bold text-white font-mono">{(page - 1) * pageSize + 1}</span> to{' '}
          <span className="font-bold text-white font-mono">{Math.min(page * pageSize, data.total_rows)}</span> of{' '}
          <span className="font-bold text-white font-mono">{data.total_rows.toLocaleString()}</span> rows
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:border-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs text-slate-300">
            Page {page} of {data.total_pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
            disabled={page >= data.total_pages}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:border-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
