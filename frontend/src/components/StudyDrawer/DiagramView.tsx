import React, { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

interface DiagramViewProps {
  code: string | null
  onClear?: () => void
}

const SAMPLE_DIAGRAM = `flowchart TD
    Host["💻 Host (CPU)"] -->|"cudaMalloc & cudaMemcpy (H2D)"| GlobalMem["💾 GPU Global Memory"]
    GlobalMem -->|"Kernel Launch <<<Grid, Block>>>"| SM["⚡ Streaming Multiprocessor"]
    SM -->|"Executes Warps (32 Threads)"| Cores["Core Execution Units"]
    Cores -->|"Store Results"| GlobalMem
    GlobalMem -->|"cudaMemcpy (D2H)"| Host`

export const DiagramView: React.FC<DiagramViewProps> = ({ code, onClear }) => {
  const [sampleCode, setSampleCode] = useState<string | null>(null)
  const activeCode = sampleCode ?? code

  const [svgHtml, setSvgHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [showSource, setShowSource] = useState(false)
  const [copied, setCopied] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize mermaid once
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#09090b',
        primaryColor: '#27272a',
        primaryTextColor: '#f4f4f5',
        primaryBorderColor: '#3f3f46',
        lineColor: '#a1a1aa',
        secondaryColor: '#18181b',
        tertiaryColor: '#09090b',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '13px',
      },
      securityLevel: 'loose',
    })
  }, [])

  // Render diagram asynchronously whenever activeCode changes
  useEffect(() => {
    if (!activeCode) return

    let isMounted = true
    const renderChart = async () => {
      try {
        const id = `mermaid-svg-${Date.now()}`
        const { svg } = await mermaid.render(id, activeCode.trim())
        if (isMounted) {
          setSvgHtml(svg)
          setError(null)
          setIsRendering(false)
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Invalid Mermaid syntax')
          setSvgHtml(null)
          setIsRendering(false)
        }
      }
    }

    renderChart()

    return () => {
      isMounted = false
    }
  }, [activeCode])

  const handleCopy = async () => {
    if (!activeCode) return
    try {
      await navigator.clipboard.writeText(activeCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2.5))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5))
  const handleResetZoom = () => setZoom(1)

  const handleLoadSample = () => {
    setSampleCode(SAMPLE_DIAGRAM)
    setError(null)
  }

  const handleClear = () => {
    setSampleCode(null)
    setSvgHtml(null)
    setError(null)
    onClear?.()
  }

  const displaySvg = activeCode ? svgHtml : null

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0c0c0e]">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 p-3 shrink-0 bg-zinc-950/40">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-800 text-xs">
            📊
          </span>
          <div>
            <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
              Flowchart & Diagram
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono">Interactive Mermaid Canvas</p>
          </div>
        </div>

        {activeCode && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowSource(!showSource)}
              className={`rounded-lg px-2 py-1 text-[10px] font-mono transition-colors ${
                showSource
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
              title="Toggle source code"
            >
              {showSource ? 'Canvas' : 'Code'}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg px-2 py-1 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
              title="Copy Mermaid code"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg px-2 py-1 text-[10px] font-mono text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 transition-colors"
              title="Clear diagram"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 overflow-auto p-4 flex flex-col items-center justify-center">
        {!activeCode && (
          <div className="flex flex-col items-center justify-center max-w-xs text-center space-y-3 py-10">
            <div className="h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl">
              📊
            </div>
            <h4 className="text-xs font-semibold text-zinc-200">No Diagram Active</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Ask your tutor for a flowchart, architecture diagram, or sequence graph. Click the <span className="font-mono text-zinc-200">Open Diagram ↗</span> button in chat to render it here!
            </p>
            <button
              type="button"
              onClick={handleLoadSample}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors"
            >
              <span>Load Sample Flowchart</span>
            </button>
          </div>
        )}

        {isRendering && (
          <div className="flex flex-col items-center justify-center space-y-2 py-8">
            <div className="h-6 w-6 rounded-full border-2 border-zinc-600 border-t-white animate-spin" />
            <span className="text-[11px] font-mono text-zinc-400">Rendering diagram...</span>
          </div>
        )}

        {error && (
          <div className="w-full rounded-xl border border-rose-900/50 bg-rose-950/20 p-3 space-y-2 text-xs text-rose-300">
            <div className="font-semibold font-mono text-[11px] flex items-center gap-1.5">
              <span>✕</span>
              <span>Mermaid Parse Error</span>
            </div>
            <p className="text-[11px] text-rose-400 font-mono leading-relaxed">{error}</p>
            <div className="text-[10px] text-zinc-400">
              Check the raw code below or ask the tutor to fix the diagram syntax.
            </div>
          </div>
        )}

        {activeCode && showSource && (
          <div className="w-full h-full flex flex-col">
            <pre className="flex-1 w-full p-3 rounded-xl border border-zinc-800 bg-zinc-950/80 text-xs text-zinc-200 font-mono overflow-auto leading-relaxed select-text">
              {activeCode}
            </pre>
          </div>
        )}

        {activeCode && !showSource && displaySvg && (
          <div
            ref={containerRef}
            className="w-full h-full flex items-center justify-center overflow-auto p-2"
          >
            <div
              className="transition-transform duration-150 origin-center max-w-full flex items-center justify-center"
              style={{ transform: `scale(${zoom})` }}
              dangerouslySetInnerHTML={{ __html: displaySvg }}
            />
          </div>
        )}
      </div>

      {/* Zoom / Canvas Controls Footer */}
      {activeCode && !showSource && displaySvg && (
        <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-2 bg-zinc-950/60 shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleZoomOut}
              className="h-6 w-6 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center justify-center"
              title="Zoom out"
            >
              -
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="h-6 px-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center justify-center"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="h-6 w-6 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center justify-center"
              title="Zoom in"
            >
              +
            </button>
          </div>

          <span className="text-[10px] font-mono text-zinc-500">
            Interactive Canvas
          </span>
        </div>
      )}
    </div>
  )
}
