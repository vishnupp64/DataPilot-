'use client'

import React from 'react'
import { Zap, FileSpreadsheet } from 'lucide-react'

interface SampleDatasetLoaderProps {
  onSelectSample: (file: File) => void
  disabled?: boolean
}

const SAMPLE_CSV_CONTENT = `order_id,order_date,customer,product,category,region,quantity,unit_price,revenue
1001,2026-01-05,John Doe,Wireless Headphones,Electronics,North,2,150,300
1002,2026-01-06,Jane Smith,Mechanical Keyboard,Electronics,West,1,120,120
1003,2026-01-07,Bob Johnson,Ergonomic Chair,Furniture,East,1,350,350
1004,2026-01-08,Alice Brown,Wireless Headphones,Electronics,South,3,150,450
1005,2026-01-09,Charlie Davis,Standing Desk,Furniture,North,1,600,600
1006,2026-01-10,Eva Wilson,USB-C Hub,Electronics,West,5,30,150
1007,2026-01-11,Frank Miller,Mechanical Keyboard,Electronics,North,2,120,240
1008,2026-01-12,Grace Lee,Standing Desk,Furniture,South,2,600,1200
1009,2026-01-13,Henry Taylor,Ergonomic Chair,Furniture,West,2,350,700
1010,2026-01-14,Ivy Clark,Wireless Headphones,Electronics,East,4,150,600`

export default function SampleDatasetLoader({ onSelectSample, disabled }: SampleDatasetLoaderProps) {
  const handleLoadSample = (e: React.MouseEvent) => {
    e.stopPropagation()
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv' })
    const file = new File([blob], 'sample_sales_orders.csv', { type: 'text/csv' })
    onSelectSample(file)
  }

  return (
    <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
      <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        Want to try immediately?
      </span>
      <button
        type="button"
        onClick={handleLoadSample}
        disabled={disabled}
        className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-indigo-500/60 text-slate-200 hover:text-white text-xs font-semibold shadow-md transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
      >
        <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
        <span>⚡ Launch Sample Sales Dataset (.csv)</span>
      </button>
    </div>
  )
}
