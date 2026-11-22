import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import ForceGraph3D, { type ForceGraph3DInstance } from '3d-force-graph'
import type { GraphNode, KnowledgeGraphResponse } from '../../api/types'

interface KnowledgeUniverseProps {
  data: KnowledgeGraphResponse
  isLoading?: boolean
  onClose?: () => void
}

export const KnowledgeUniverse: React.FC<KnowledgeUniverseProps> = ({
  data,
  isLoading = false,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<ForceGraph3DInstance | null>(null)
  const navigate = useNavigate()

  // State
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [roadmapFilter, setRoadmapFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true)
  const isAutoRotatingRef = useRef<boolean>(true)

  useEffect(() => {
    isAutoRotatingRef.current = isAutoRotating
  }, [isAutoRotating])

  // Timeline Scrubber state
  const [isPlayingTimeline, setIsPlayingTimeline] = useState<boolean>(false)
  const [timelineProgress, setTimelineProgress] = useState<number>(100) // 0 to 100%

  // Compute time bounds for scrubber
  const { minTime, maxTime } = useMemo(() => {
    const times = data.nodes
      .map((n) => new Date(n.created_at).getTime())
      .filter((t) => !isNaN(t))
    if (!times.length) {
      return { minTime: 0, maxTime: 1 }
    }
    const min = Math.min(...times)
    const max = Math.max(...times)
    // Add small buffer so min isn't instant
    return { minTime: min - 1000, maxTime: Math.max(max, min + 5000) }
  }, [data.nodes])

  // Current scrubber cutoff timestamp
  const currentCutoffTime = useMemo(() => {
    return minTime + (timelineProgress / 100) * (maxTime - minTime)
  }, [minTime, maxTime, timelineProgress])

  // Unique roadmaps for filter dropdown
  const roadmapOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const node of data.nodes) {
      if (node.type === 'roadmap') {
        map.set(node.raw_id, node.label)
      }
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }))
  }, [data.nodes])

  // Filtered nodes and links based on roadmap, status, and timeline progress
  const { filteredNodes, filteredLinks } = useMemo(() => {
    // 1. Time filtering
    let visibleNodes = data.nodes.filter((n) => {
      const nodeTime = new Date(n.created_at).getTime()
      return isNaN(nodeTime) || nodeTime <= currentCutoffTime
    })

    // 2. Roadmap filtering
    if (roadmapFilter !== 'all') {
      visibleNodes = visibleNodes.filter(
        (n) =>
          n.raw_id === roadmapFilter ||
          n.roadmap_id === roadmapFilter
      )
    }

    // 3. Status filtering
    if (statusFilter !== 'all') {
      visibleNodes = visibleNodes.filter(
        (n) => n.type !== 'topic' || n.status === statusFilter
      )
    }

    // 4. Search filtering (if query present)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchedNodeIds = new Set(
        visibleNodes
          .filter((n) => n.label.toLowerCase().includes(q))
          .map((n) => n.id)
      )
      // Keep matched nodes plus their parent roadmap / chapter hubs so graph remains connected
      visibleNodes = visibleNodes.filter(
        (n) =>
          matchedNodeIds.has(n.id) ||
          (n.roadmap_id && matchedNodeIds.has(`topic-${n.raw_id}`))
      )
    }

    const visibleNodeIdSet = new Set(visibleNodes.map((n) => n.id))

    // Filter links so both endpoints are visible
    const visibleLinks = data.links.filter((l) => {
      const sourceId = typeof l.source === 'object' && l.source ? (l.source as any).id : l.source
      const targetId = typeof l.target === 'object' && l.target ? (l.target as any).id : l.target
      return visibleNodeIdSet.has(sourceId) && visibleNodeIdSet.has(targetId)
    })

    return { filteredNodes: visibleNodes, filteredLinks: visibleLinks }
  }, [data.nodes, data.links, currentCutoffTime, roadmapFilter, statusFilter, searchQuery])

  // Fly camera to a specific node
  const flyToNode = useCallback((node: GraphNode) => {
    if (!graphRef.current) return
    setSelectedNode(node)
    setIsAutoRotating(false)

    // Camera offset
    const distance = 90
    const x = node.x ?? 0
    const y = node.y ?? 0
    const z = node.z ?? 0
    const hyp = Math.hypot(x, y, z) || 1
    const distRatio = 1 + distance / hyp

    graphRef.current.cameraPosition(
      { x: x * distRatio, y: y * distRatio + 15, z: z * distRatio + distance },
      { x, y, z },
      1400
    )
  }, [])

  // Reset Camera View
  const handleResetCamera = useCallback(() => {
    if (!graphRef.current) return
    setSelectedNode(null)
    graphRef.current.cameraPosition({ x: 0, y: 0, z: 320 }, { x: 0, y: 0, z: 0 }, 1200)
  }, [])

  // Timeline Animation Loop
  useEffect(() => {
    if (!isPlayingTimeline) return

    const interval = setInterval(() => {
      setTimelineProgress((prev) => {
        if (prev >= 100) {
          setIsPlayingTimeline(false)
          return 100
        }
        return Math.min(100, prev + 1.25)
      })
    }, 100)

    return () => clearInterval(interval)
  }, [isPlayingTimeline])

  // Initialize 3D Force Graph
  useEffect(() => {
    if (!containerRef.current) return

    // Clean up any existing instances
    if (graphRef.current) {
      try {
        graphRef.current._destructor()
      } catch {
        // ignore destructor error
      }
      graphRef.current = null
      containerRef.current.innerHTML = ''
    }

    const width = containerRef.current.clientWidth || window.innerWidth
    const height = containerRef.current.clientHeight || window.innerHeight

    // Create ForceGraph3D instance
    const graph = (ForceGraph3D as any)()(containerRef.current)
      .width(width)
      .height(height)
      .backgroundColor('#07080b')
      .showNavInfo(false)
      .enableNodeDrag(true)
      .nodeLabel((node: any) => {
        const typeLabel =
          node.type === 'roadmap'
            ? '🌌 Galaxy Core'
            : node.type === 'chapter'
            ? '🪐 Cluster Hub'
            : node.status === 'solid'
            ? '🌟 Solid Supernova'
            : node.status === 'learning'
            ? '🔥 Active Study'
            : '🌑 Dormant Star'
        return `<div style="background: rgba(9,9,11,0.92); border: 1px solid #27272a; padding: 6px 10px; border-radius: 8px; font-family: system-ui; font-size: 11px; color: #fff; box-shadow: 0 4px 16px rgba(0,0,0,0.5);">
          <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: ${node.color}; font-weight: 600;">${typeLabel}</div>
          <div style="font-weight: 600; margin-top: 2px;">${node.label}</div>
          ${node.message_count ? `<div style="color: #a1a1aa; font-size: 10px; margin-top: 2px;">💬 ${node.message_count} chat messages</div>` : ''}
        </div>`
      })
      .nodeThreeObject((node: any) => {
        const group = new THREE.Group()
        const radius = Math.max(2.2, Math.sqrt(node.val || 4) * 1.6)

        // 1. Core Sphere
        const sphereGeom = new THREE.SphereGeometry(radius, 16, 16)
        const sphereMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(node.color || '#3b82f6'),
          emissive: new THREE.Color(node.color || '#3b82f6'),
          emissiveIntensity: node.growth_level >= 2 ? 0.8 : 0.25,
          roughness: 0.2,
          metalness: 0.1,
        })
        const sphere = new THREE.Mesh(sphereGeom, sphereMat)
        group.add(sphere)

        // 2. Halo ring for masteries and core hubs
        if (node.growth_level >= 2) {
          const haloGeom = new THREE.SphereGeometry(radius * 1.35, 12, 12)
          const haloMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(node.color || '#10b981'),
            wireframe: true,
            transparent: true,
            opacity: node.growth_level === 3 ? 0.35 : 0.2,
          })
          group.add(new THREE.Mesh(haloGeom, haloMat))
        }

        // 3. Crisp text billboard sprite
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 64
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.font = 'bold 22px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          ctx.fillStyle =
            node.growth_level === 3
              ? '#38bdf8'
              : node.growth_level === 2
              ? '#34d399'
              : node.growth_level === 1
              ? '#fbbf24'
              : '#9ca3af'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const labelText =
            node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label
          ctx.fillText(labelText, 128, 32)

          const texture = new THREE.CanvasTexture(canvas)
          const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
          })
          const sprite = new THREE.Sprite(spriteMat)
          sprite.scale.set(30, 7.5, 1)
          sprite.position.set(0, -radius - 5, 0)
          group.add(sprite)
        }

        return group
      })
      .linkWidth((link: any) =>
        link.type === 'synapse' ? 1.6 : link.type === 'structural' ? 1.1 : 0.7
      )
      .linkColor((link: any) => link.color || 'rgba(255,255,255,0.2)')
      .linkCurvature((link: any) => link.curvature || 0)
      .linkDirectionalParticles((link: any) => link.particles || 0)
      .linkDirectionalParticleSpeed(0.006)
      .linkDirectionalParticleWidth((link: any) =>
        link.type === 'synapse' ? 3.2 : 2.0
      )
      .linkOpacity(0.5)
      .onNodeClick((node: any) => {
        flyToNode(node as GraphNode)
      })

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(100, 200, 150)
    graph.scene().add(ambientLight)
    graph.scene().add(dirLight)

    // Starfield background
    const starGeom = new THREE.BufferGeometry()
    const starCount = 700
    const starPositions = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 1800
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const starMat = new THREE.PointsMaterial({
      color: 0x8899aa,
      size: 1.4,
      transparent: true,
      opacity: 0.5,
    })
    const starField = new THREE.Points(starGeom, starMat)
    graph.scene().add(starField)

    // Initial camera position
    graph.cameraPosition({ x: 0, y: 0, z: 320 })

    graphRef.current = graph

    // Resize listener
    const handleResize = () => {
      if (containerRef.current && graphRef.current) {
        graphRef.current
          .width(containerRef.current.clientWidth)
          .height(containerRef.current.clientHeight)
      }
    }
    window.addEventListener('resize', handleResize)

    // Ambient Galactic Auto-Rotation Loop
    let angle = 0
    const autoRotateTimer = setInterval(() => {
      if (isAutoRotatingRef.current && graphRef.current) {
        angle += 0.0018
        const distance = 320
        graphRef.current.cameraPosition({
          x: distance * Math.sin(angle),
          z: distance * Math.cos(angle),
        })
      }
    }, 32)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearInterval(autoRotateTimer)
      if (graphRef.current) {
        try {
          graphRef.current._destructor()
        } catch {
          // ignore destructor error
        }
        graphRef.current = null
      }
    }
  }, [flyToNode])

  // Sync Graph Data when filtered nodes or links update
  useEffect(() => {
    if (!graphRef.current) return
    // Deep clone nodes and links so force-graph doesn't mutate outer state
    const nodesClone = filteredNodes.map((n) => ({ ...n }))
    const linksClone = filteredLinks.map((l) => ({ ...l }))
    graphRef.current.graphData({ nodes: nodesClone, links: linksClone })
  }, [filteredNodes, filteredLinks])

  // Date display for current scrubber
  const currentDateString = useMemo(() => {
    return new Date(currentCutoffTime).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }, [currentCutoffTime])

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#07080b] select-none">
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left Stats & Title */}
        <div className="flex items-center gap-3 pointer-events-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-2.5 backdrop-blur-md shadow-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-mono text-sm">
            🌌
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs sm:text-sm text-zinc-100 tracking-wide">
                Knowledge Universe
              </span>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                {data.total_solid} Mastered
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-0.5">
              <span>{data.total_topics} Stars</span>
              <span>•</span>
              <span>{data.total_roadmaps} Galaxies</span>
              <span>•</span>
              <span className="text-pink-400">{filteredLinks.filter(l => l.type === 'synapse').length} Synapses</span>
            </div>
          </div>
        </div>

        {/* Center / Right Filters & Controls */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Quick Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search universe..."
              className="h-9 w-36 sm:w-48 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 pl-8 text-xs text-zinc-200 placeholder-zinc-500 backdrop-blur-md focus:border-zinc-600 focus:outline-hidden transition-all"
            />
            <span className="absolute left-2.5 top-2.5 text-xs text-zinc-500">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-xs text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Roadmap Galaxy Filter */}
          {roadmapOptions.length > 1 && (
            <select
              value={roadmapFilter}
              onChange={(e) => setRoadmapFilter(e.target.value)}
              className="h-9 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-xs text-zinc-300 backdrop-blur-md focus:border-zinc-600 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Galaxies</option>
              {roadmapOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          )}

          {/* Status Pills */}
          <div className="hidden md:flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950/80 p-1 backdrop-blur-md text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('solid')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                statusFilter === 'solid'
                  ? 'bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 shadow-xs'
                  : 'text-zinc-400 hover:text-emerald-400'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Solid
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('learning')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                statusFilter === 'learning'
                  ? 'bg-amber-950/80 border border-amber-800/80 text-amber-300 shadow-xs'
                  : 'text-zinc-400 hover:text-amber-400'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Active
            </button>
          </div>

          {/* Auto-Rotate Toggle */}
          <button
            type="button"
            onClick={() => setIsAutoRotating((v) => !v)}
            title={isAutoRotating ? 'Pause galaxy auto-rotation' : 'Start galaxy auto-rotation'}
            className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium backdrop-blur-md transition-colors ${
              isAutoRotating
                ? 'border-indigo-500/40 bg-indigo-950/40 text-indigo-300'
                : 'border-zinc-800 bg-zinc-950/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>{isAutoRotating ? '💫 Orbiting' : '⏸ Orbit'}</span>
          </button>

          {/* Reset Camera */}
          <button
            type="button"
            onClick={handleResetCamera}
            title="Recenter camera to galaxy center"
            className="flex h-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-xs text-zinc-300 hover:text-white backdrop-blur-md transition-colors"
          >
            🎯 Recenter
          </button>

          {/* Close / Back to Dashboard */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 backdrop-blur-md transition-colors"
            >
              ✕ Exit Universe
            </button>
          )}
        </div>
      </div>

      {/* Main 3D Canvas Container */}
      <div
        ref={containerRef}
        className="h-full w-full flex-1 cursor-grab active:cursor-grabbing outline-hidden"
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#07080b]/80 backdrop-blur-xs">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            <p className="text-xs font-mono text-zinc-400">Synthesizing 3D Knowledge Universe...</p>
          </div>
        </div>
      )}

      {/* Holographic Target Focus Card (Bottom Right) */}
      {selectedNode && (
        <div className="absolute bottom-24 right-4 sm:right-6 z-20 w-80 sm:w-96 rounded-2xl border border-zinc-800 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-start justify-between gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: `${selectedNode.color}15`,
                borderColor: `${selectedNode.color}40`,
                borderWidth: '1px',
                color: selectedNode.color,
              }}
            >
              {selectedNode.type === 'roadmap'
                ? '🌌 Galaxy Core'
                : selectedNode.type === 'chapter'
                ? '🪐 Cluster Nexus'
                : selectedNode.status === 'solid'
                ? '🌟 Solid Supernova'
                : selectedNode.status === 'learning'
                ? '🔥 Active Study'
                : '🌑 Dormant Protostar'}
            </span>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              ✕
            </button>
          </div>

          <h3 className="mt-2 text-sm font-semibold text-white leading-snug">
            {selectedNode.label}
          </h3>

          {(selectedNode.roadmap_title || selectedNode.chapter_title) && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
              {selectedNode.roadmap_title && <span>{selectedNode.roadmap_title}</span>}
              {selectedNode.chapter_title && <span>› {selectedNode.chapter_title}</span>}
            </div>
          )}

          {selectedNode.summary && (
            <p className="mt-2 text-xs text-zinc-300 leading-relaxed line-clamp-3 bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/50">
              {selectedNode.summary}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-zinc-800/80 pt-3">
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
              <span>💬 {selectedNode.message_count} chat messages</span>
            </div>

            {selectedNode.type === 'topic' ? (
              <button
                type="button"
                onClick={() => navigate(`/topics/${selectedNode.raw_id}`)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition-colors"
              >
                Open Lesson Chat ⚡ →
              </button>
            ) : selectedNode.type === 'roadmap' ? (
              <button
                type="button"
                onClick={() => navigate(`/roadmaps/${selectedNode.raw_id}`)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition-colors"
              >
                Open Galaxy 🚀 →
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Floating Bottom Timeline Scrubber: "Evolution of Your Brain" */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex justify-center pointer-events-none">
        <div className="flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-zinc-800/90 bg-zinc-950/85 px-4 py-2.5 backdrop-blur-md shadow-2xl pointer-events-auto">
          {/* Play / Pause Scrubber Animation */}
          <button
            type="button"
            onClick={() => {
              if (timelineProgress >= 100) {
                setTimelineProgress(0)
              }
              setIsPlayingTimeline((p) => !p)
            }}
            title={isPlayingTimeline ? 'Pause brain evolution playback' : 'Play brain evolution playback'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-bold text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            {isPlayingTimeline ? '⏸' : '▶'}
          </button>

          {/* Timeline Slider */}
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-zinc-400">
                🧬 Brain Growth: <strong className="text-indigo-400">{currentDateString}</strong>
              </span>
              <span className="text-zinc-400">
                <span className="text-emerald-400 font-semibold">{filteredNodes.length}</span> / {data.total_nodes} Unlocked
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={timelineProgress}
              onChange={(e) => {
                setIsPlayingTimeline(false)
                setTimelineProgress(parseFloat(e.target.value))
              }}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-indigo-500 transition-all hover:bg-zinc-700"
            />
          </div>

          {/* Jump to Present */}
          {timelineProgress < 100 && (
            <button
              type="button"
              onClick={() => {
                setIsPlayingTimeline(false)
                setTimelineProgress(100)
              }}
              className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-mono text-zinc-300 hover:text-white transition-colors"
            >
              Today ⚡
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
