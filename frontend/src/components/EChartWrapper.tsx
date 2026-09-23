'use client'

import React from 'react'
import ReactECharts from 'echarts-for-react'

interface EChartWrapperProps {
  title?: string
  chartType?: 'bar' | 'line' | 'pie' | 'horizontal_bar' | 'kpi' | 'table' | string
  chartConfig?: any
  columns?: string[]
  data?: any[]
}

export default function EChartWrapper({
  title,
  chartType = 'bar',
  chartConfig,
  columns = [],
  data = [],
}: EChartWrapperProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs italic">
        No chart data available for visualization.
      </div>
    )
  }

  // Handle KPI card view
  if (chartType === 'kpi' || (data.length === 1 && columns.includes('metric') && columns.includes('value'))) {
    const item = data[0]
    const metricName = item.metric || columns[0] || 'Metric'
    const rawVal = item.value !== undefined ? item.value : item[columns[1]]
    const formattedVal = typeof rawVal === 'number' ? rawVal.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(rawVal ?? '')

    return (
      <div className="glass-panel rounded-2xl p-6 sm:p-8 text-center border border-indigo-500/30 max-w-sm mx-auto shadow-2xl my-4 glass-glow">
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 font-mono">{metricName}</span>
        <div className="text-3xl sm:text-4xl font-black text-white mt-2 font-sans tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
          {formattedVal}
        </div>
        <p className="text-[11px] text-slate-400 mt-2 font-mono">{title || 'Calculated from actual dataset'}</p>
      </div>
    )
  }

  let option: any = null

  if (columns.length >= 2) {
    const xCol = columns[0]
    const yCol = columns[1]

    const categories = data.map((d) => String(d[xCol] ?? ''))
    const values = data.map((d) => (typeof d[yCol] === 'number' ? d[yCol] : parseFloat(d[yCol]) || 0))

    if (chartType === 'pie' || chartType === 'donut') {
      const pieData = data.map((d) => ({
        name: String(d[xCol] ?? ''),
        value: typeof d[yCol] === 'number' ? d[yCol] : parseFloat(d[yCol]) || 0,
      }))

      option = {
        backgroundColor: 'transparent',
        title: {
          text: title || `${yCol} share by ${xCol}`,
          textStyle: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold' },
          left: 'center',
        },
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {c} ({d}%)',
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          borderColor: 'rgba(99, 102, 241, 0.3)',
          textStyle: { color: '#f8fafc' },
        },
        legend: {
          bottom: '0',
          textStyle: { color: '#94a3b8', fontSize: 11 },
        },
        series: [
          {
            name: yCol,
            type: 'pie',
            radius: chartType === 'donut' ? ['40%', '70%'] : '65%',
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 6,
              borderColor: '#0f172a',
              borderWidth: 2,
            },
            label: {
              show: true,
              color: '#cbd5e1',
              fontSize: 11,
            },
            data: pieData,
          },
        ],
      }
    } else if (chartType === 'horizontal_bar') {
      option = {
        backgroundColor: 'transparent',
        title: {
          text: title || `Top ${yCol} by ${xCol}`,
          textStyle: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold' },
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          borderColor: 'rgba(99, 102, 241, 0.3)',
          textStyle: { color: '#f8fafc' },
        },
        grid: {
          left: '3%',
          right: '5%',
          bottom: '5%',
          top: '15%',
          containLabel: true,
        },
        xAxis: {
          type: 'value',
          axisLine: { lineStyle: { color: '#334155' } },
          splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
          axisLabel: { color: '#94a3b8', fontSize: 11 },
        },
        yAxis: {
          type: 'category',
          data: categories.reverse(),
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#94a3b8', fontSize: 11 },
        },
        series: [
          {
            name: yCol,
            type: 'bar',
            data: values.reverse(),
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                  { offset: 0, color: '#6366f1' },
                  { offset: 1, color: '#a855f7' },
                ],
              },
              borderRadius: [0, 6, 6, 0],
            },
          },
        ],
      }
    } else {
      // Default Bar or Line chart
      option = {
        backgroundColor: 'transparent',
        title: {
          text: title || `${yCol} by ${xCol}`,
          textStyle: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold' },
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          borderColor: 'rgba(99, 102, 241, 0.3)',
          textStyle: { color: '#f8fafc' },
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '10%',
          top: '18%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: categories,
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#94a3b8', fontSize: 11, rotate: categories.length > 6 ? 25 : 0 },
        },
        yAxis: {
          type: 'value',
          axisLine: { lineStyle: { color: '#334155' } },
          splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
          axisLabel: { color: '#94a3b8', fontSize: 11 },
        },
        series: [
          {
            name: yCol,
            type: chartType === 'line' ? 'line' : 'bar',
            data: values,
            smooth: true,
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: '#6366f1' },
                  { offset: 1, color: '#8b5cf6' },
                ],
              },
              borderRadius: chartType === 'line' ? 0 : [6, 6, 0, 0],
            },
          },
        ],
      }
    }
  }

  if (!option) {
    return (
      <div className="p-6 text-center text-slate-400 text-xs">
        Calculation output format: tabular. Switch to Result Table view to view all items.
      </div>
    )
  }

  return (
    <div className="w-full glass-panel rounded-2xl p-4 border border-slate-800/80 shadow-2xl">
      <ReactECharts option={option} style={{ height: '320px', width: '100%' }} />
    </div>
  )
}
