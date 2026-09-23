import type { Metadata } from 'next'
import './globals.css'
import { Sparkles, Activity, Layers, Database, HelpCircle, UserCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'DataPilot AI - Modern Conversational Data Analytics',
  description: 'Upload CSV or XLSX spreadsheets and ask questions in natural language powered by Gemini & Pandas.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="font-sans antialiased text-slate-100 bg-slate-900 bg-grid-pattern min-h-screen flex flex-col relative overflow-x-hidden selection:bg-indigo-500 selection:text-white">
        {/* Background Ambient Glows */}
        <div aria-hidden="true" className="fixed top-[-10%] left-[-10%] w-[550px] h-[550px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
        <div aria-hidden="true" className="fixed top-[20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none -z-10" />
        <div aria-hidden="true" className="fixed bottom-[-10%] left-[20%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[150px] pointer-events-none -z-10" />

        {/* Top Modern SaaS Header */}
        <header className="sticky top-0 z-50 bg-slate-900/90 border-b border-slate-800 backdrop-blur-xl px-4 sm:px-8 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Brand Logo */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-violet-600 flex items-center justify-center font-black text-white shadow-lg shadow-indigo-500/25 text-lg">
                  Δ
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-black tracking-tight text-white font-sans">
                    DataPilot <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">AI</span>
                  </span>
                  <span className="hidden sm:inline text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                    SaaS v1.5
                  </span>
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-300">
                <a
                  href="/"
                  className="px-3 py-1.5 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-500/30 flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" /> Analytics Workspace
                </a>
                <a
                  href="#"
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
                >
                  <Database className="w-3.5 h-3.5" /> Datasets
                </a>
                <a
                  href="#"
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
                >
                  <HelpCircle className="w-3.5 h-3.5" /> Documentation
                </a>
              </nav>
            </div>

            {/* Right Status Controls */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full shadow-sm font-mono">
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-[11px] font-medium text-emerald-400">Engine Connected</span>
              </div>

              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold border border-indigo-400/40 shadow-md">
                AI
              </div>
            </div>
          </div>
        </header>

        {/* Main Workspace Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
          {children}
        </main>

        {/* Muted SaaS Footer */}
        <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 font-mono flex items-center justify-center gap-4">
          <span>DataPilot AI • Modern SaaS Analytics Engine</span>
          <span>•</span>
          <span className="text-slate-400">Gemini 1.5 + Pandas Backend</span>
        </footer>
      </body>
    </html>
  )
}
