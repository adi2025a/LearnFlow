import { useState, useMemo } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  useParams,
  useLocation,
} from 'react-router-dom'
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import { api } from './api/client'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SearchBox } from './components/SearchBox'
import { NewRoadmapDialog } from './components/NewRoadmapDialog'
import { RoadmapsPage } from './pages/RoadmapsPage'
import { TopicPage } from './pages/TopicPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
})

function AppLayout() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isNewRoadmapOpen, setIsNewRoadmapOpen] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  const { roadmapId } = useParams<{
    roadmapId?: string
  }>()
  const location = useLocation()

  // 1. Fetch all roadmaps
  const { data: roadmaps = [], isLoading: isRoadmapsLoading } = useQuery({
    queryKey: ['roadmaps'],
    queryFn: () => api.listRoadmaps(),
  })

  // 2. Active Roadmap ID resolution
  const activeRoadmapId = useMemo(() => {
    if (roadmapId) return roadmapId
    return roadmaps[0]?.id || null
  }, [roadmapId, roadmaps])

  // 3. Fetch tree for active roadmap
  const { data: roadmapTree = null, isLoading: isTreeLoading } = useQuery({
    queryKey: ['roadmap', activeRoadmapId],
    queryFn: () => (activeRoadmapId ? api.getRoadmap(activeRoadmapId) : null),
    enabled: Boolean(activeRoadmapId),
  })

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white">
      {/* Mobile top navigation header */}
      <div className="flex h-14 w-full items-center justify-between border-b border-zinc-800/80 bg-[#09090b]/90 px-4 backdrop-blur-md lg:hidden fixed top-0 left-0 z-30">
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
          aria-label="Open navigation menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <span className="font-semibold text-xs tracking-tight text-white font-mono">LearnFlow</span>

        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
          aria-label="Search"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      {/* Sidebar */}
      <Sidebar
        roadmap={roadmapTree}
        roadmaps={roadmaps}
        onOpenNewRoadmap={() => setIsNewRoadmapOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-hidden pt-14 lg:pt-0 bg-[#09090b]">
        <Routes>
          <Route
            path="/"
            element={
              <RoadmapsPage
                key={location.pathname}
                currentRoadmap={roadmapTree}
                roadmaps={roadmaps}
                onOpenNewRoadmap={() => setIsNewRoadmapOpen(true)}
              />
            }
          />
          <Route
            path="/roadmaps/:roadmapId"
            element={
              <RoadmapsPage
                key={location.pathname}
                currentRoadmap={roadmapTree}
                roadmaps={roadmaps}
                onOpenNewRoadmap={() => setIsNewRoadmapOpen(true)}
              />
            }
          />
          <Route
            path="/topics/:topicId"
            element={
              <TopicPage
                roadmap={roadmapTree}
                isLoading={isRoadmapsLoading || isTreeLoading}
              />
            }
          />
        </Routes>
      </main>

      {/* Global Modals */}
      <SearchBox
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      <NewRoadmapDialog
        isOpen={isNewRoadmapOpen}
        onClose={() => setIsNewRoadmapOpen(false)}
      />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
