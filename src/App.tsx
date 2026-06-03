import { useState, useEffect, lazy, Suspense, useCallback } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Satellite, 
  Radio, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Signal,
  Globe,
  Zap,
  RefreshCw,
  Map,
  List,
  Download,
  Database
} from 'lucide-react'
import { 
  initializeTLEData,
  initializeSatelliteRecords, 
  calculateAllSatellitePositions,
  type SatellitePosition,
  type TLEDataSource
} from './lib/satelliteTracker'
import Globe3D from './components/Globe3D'
import NavBar from './components/NavBar'
import { UIProvider } from './contexts/UIContext'

// Lazy load the map component to avoid SSR issues
const SatelliteMap = lazy(() => import('./components/SatelliteMap'))

// Re-export SatellitePosition as SatelliteData for compatibility
type SatelliteData = SatellitePosition

function SatelliteTracker() {
  const [satellites, setSatellites] = useState<SatelliteData[]>([])
  const [selectedSatellite, setSelectedSatellite] = useState<SatelliteData | null>(null)
  const [systemTime, setSystemTime] = useState(new Date())
  const [isLoading, setIsLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('Initializing...')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map')
  const [isInitialized, setIsInitialized] = useState(false)
  const [dataSource, setDataSource] = useState<TLEDataSource>('fallback')
  const [trackingSatelliteId, setTrackingSatelliteId] = useState<number | null>(null)

  // Initialize satellite records on mount
  useEffect(() => {
    let isCancelled = false

    async function initializeTracker() {
      console.log('Starting initialization...')
      setLoadingStatus('Loading current orbital elements...')

      // Add a timeout so we don't hang if TLE fetching stalls
      const timeoutMs = 8000
      const timeoutPromise = new Promise<TLEDataSource>((resolve) => {
        const id = setTimeout(() => {
          console.warn('TLE initialization timed out, falling back to offline data')
          clearTimeout(id)
          resolve('fallback')
        }, timeoutMs)
      })

      let source: TLEDataSource = 'fallback'
      try {
        source = await Promise.race([initializeTLEData(), timeoutPromise])
      } catch (e) {
        console.warn('initializeTLEData failed, using fallback', e)
        source = 'fallback'
      }

      if (isCancelled) return

      setDataSource(source)
      setLoadingStatus('Initializing satellite records...')
      initializeSatelliteRecords()

      console.log('Initialization complete!')
      setIsInitialized(true)
    }

    initializeTracker()

    return () => {
      isCancelled = true
    }
  }, [])

  // Update satellite positions
  const updatePositions = useCallback(() => {
    if (!isInitialized) return
    
    const now = new Date()
    setSystemTime(now)
    const positions = calculateAllSatellitePositions(now)
    console.log('Calculated positions:', positions.length, 'satellites')
    setSatellites(positions)
    
    // Update selected satellite if it exists
    if (selectedSatellite) {
      const updated = positions.find(s => s.id === selectedSatellite.id)
      if (updated) {
        setSelectedSatellite(updated)
      }
    }
  }, [isInitialized, selectedSatellite])

  useEffect(() => {
    if (!isInitialized) return

    // Initial load with delay for UI effect
    const initTimer = setTimeout(() => {
      console.log('Init timer fired, updating positions...')
      updatePositions()
      console.log('Setting isLoading to false')
      setIsLoading(false)
    }, 1500)

    // Update positions every 1 second for smooth tracking
    const updateInterval = setInterval(updatePositions, 1000)

    return () => {
      clearTimeout(initTimer)
      clearInterval(updateInterval)
    }
  }, [isInitialized, updatePositions])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400'
      case 'maintenance': return 'text-yellow-400'
      case 'critical': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />
      case 'maintenance': return <Clock className="w-4 h-4" />
      case 'critical': return <AlertTriangle className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const trackSatellite = (sat: SatelliteData) => {
    setTrackingSatelliteId(sat.id)
    setSelectedSatellite(sat)

    window.setTimeout(() => {
      setViewMode('map')
      setTrackingSatelliteId(null)
    }, 450)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto mb-4"
          >
            <Satellite className="w-full h-full text-green-400" />
          </motion.div>
          <h1 className="text-2xl font-bold text-green-400 glow-green mb-2">ISRO SATELLITE TRACKER</h1>
          <p className="text-green-600 text-sm">{loadingStatus.toUpperCase()}</p>
          <div className="mt-4 w-64 h-1 bg-green-900/30 rounded-full overflow-hidden mx-auto">
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="h-full w-1/2 bg-green-400"
            />
          </div>
          <p className="text-green-800 text-xs mt-2">Using SGP4/SDP4 orbital propagation</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-green-400 p-4 font-mono overflow-x-hidden">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="terminal-panel p-4 mb-4"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Satellite className="w-8 h-8 text-green-400" />
            <div>
              <h1 className="text-xl font-bold glow-green">ISRO SATELLITE TRACKER</h1>
              <div className="flex items-center gap-2 text-xs text-green-600">
                <span>SGP4 ORBITAL PROPAGATION</span>
                <span className="text-green-800">•</span>
                <span className="flex items-center gap-1">
                  {dataSource === 'live' && <Download className="w-3 h-3" />}
                  {dataSource === 'cached' && <Database className="w-3 h-3" />}
                  {dataSource === 'fallback' && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
                  <span className={dataSource === 'fallback' ? 'text-yellow-500' : ''}>
                    {dataSource === 'live' && 'LIVE FROM CELESTRAK'}
                    {dataSource === 'cached' && 'CACHED TLE DATA'}
                    {dataSource === 'fallback' && 'OFFLINE MODE'}
                  </span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end text-right">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" />
              <span className="text-green-600">UTC:</span>
              <span className="font-mono glow-green">{formatTime(systemTime)}</span>
            </div>
            <div className="text-green-600">
              {formatDate(systemTime)}
            </div>
          </div>
        </div>
      </motion.header>

      {/* View Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode('map')}
          className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${
            viewMode === 'map'
              ? 'bg-green-900/50 border border-green-500 text-green-400'
              : 'bg-black/30 border border-green-900/30 text-green-600 hover:bg-green-900/20'
          }`}
        >
          <Map className="w-4 h-4" />
          <span className="text-sm font-bold">MAP VIEW</span>
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${
            viewMode === 'list'
              ? 'bg-green-900/50 border border-green-500 text-green-400'
              : 'bg-black/30 border border-green-900/30 text-green-600 hover:bg-green-900/20'
          }`}
        >
          <List className="w-4 h-4" />
          <span className="text-sm font-bold">LIST VIEW</span>
        </button>
      </div>

      {/* Map View */}
      {viewMode === 'map' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="grid grid-cols-1 lg:grid-cols-4 gap-4"
        >
          {/* Map Panel */}
          <div className="terminal-panel p-4 lg:col-span-3 h-[600px]">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-8 h-8 animate-spin text-green-400" />
                <span className="ml-2">LOADING MAP...</span>
              </div>
            }>
              <SatelliteMap 
                satellites={satellites}
                selectedSatellite={selectedSatellite}
                onSelectSatellite={(sat) => {
                  const fullSatData = satellites.find(s => s.id === sat.id)
                  if (fullSatData) setSelectedSatellite(fullSatData)
                }}
              />
            </Suspense>
          </div>

          {/* Selected Satellite Info */}
          <div className="terminal-panel p-4 lg:col-span-1">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Satellite className="w-5 h-5" />
              SATELLITE INFO
            </h2>
            {selectedSatellite ? (
              <div className="space-y-4">
                <div className="bg-black/30 p-3 rounded border border-green-500">
                  <div className="font-bold text-lg glow-green">{selectedSatellite.name}</div>
                  <div className="text-xs text-green-600 mt-1">{selectedSatellite.type}</div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 bg-black/20 rounded">
                    <span className="text-green-600">NORAD ID</span>
                    <span className="font-bold">{selectedSatellite.noradId}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-black/20 rounded">
                    <span className="text-green-600">LAUNCH DATE</span>
                    <span className="font-bold">{selectedSatellite.launchDate}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-black/20 rounded">
                    <span className="text-green-600">LATITUDE</span>
                    <span className="font-bold">{selectedSatellite.latitude.toFixed(4)}°</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-black/20 rounded">
                    <span className="text-green-600">LONGITUDE</span>
                    <span className="font-bold">{selectedSatellite.longitude.toFixed(4)}°</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-black/20 rounded">
                    <span className="text-green-600">ALTITUDE</span>
                    <span className="font-bold">{selectedSatellite.altitude.toLocaleString()} km</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-black/20 rounded">
                    <span className="text-green-600">VELOCITY</span>
                    <span className="font-bold">{selectedSatellite.velocity} km/s</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-black/20 rounded">
                    <span className="text-green-600">SIGNAL</span>
                    <div className="flex items-center gap-2">
                      <Signal className="w-4 h-4" />
                      <span className="font-bold">{selectedSatellite.signalStrength}%</span>
                    </div>
                  </div>
                </div>

                <div className={`flex items-center justify-center gap-2 p-2 rounded border ${getStatusColor(selectedSatellite.status)} border-current`}>
                  {getStatusIcon(selectedSatellite.status)}
                  <span className="uppercase text-sm font-bold">{selectedSatellite.status}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <Globe className="w-12 h-12 text-green-600 mb-4 opacity-50" />
                <p className="text-sm text-green-600">Click on a satellite on the map to view details</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="grid grid-cols-1 xl:grid-cols-4 gap-4"
        >
          {/* Satellite List Panel */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="terminal-panel p-4 xl:col-span-3"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Radio className="w-5 h-5" />
                TRACKED SATELLITES
              </h2>
              <span className="text-xs text-green-600">[{satellites.length} ONLINE]</span>
            </div>
            <div className="grid grid-cols-[minmax(220px,1fr)_110px_120px_140px] items-center gap-4 border-b border-green-900/50 px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-green-700">
              <span>Satellite Name</span>
              <span className="text-right">NORAD ID</span>
              <span className="text-right">Launch Date</span>
              <span className="text-center">Action</span>
            </div>
            <div className="max-h-[560px] overflow-y-auto custom-scrollbar pr-1">
              {satellites.map((sat) => (
                <motion.div
                  key={sat.id}
                  whileHover={{ scale: 1.01, x: 4 }}
                  onClick={() => setSelectedSatellite(sat)}
                  className={`mt-2 grid grid-cols-[minmax(220px,1fr)_110px_120px_140px] items-center gap-4 rounded border px-3 py-3 cursor-pointer transition-all ${
                    selectedSatellite?.id === sat.id 
                      ? 'bg-green-900/30 border-green-500 shadow-[0_0_18px_rgba(0,255,65,0.18)]' 
                      : 'bg-black/20 border-green-900/30 hover:border-green-600 hover:bg-green-950/20 hover:shadow-[0_0_16px_rgba(0,255,65,0.12)]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        selectedSatellite?.id === sat.id ? 'bg-green-300 animate-pulse shadow-[0_0_12px_#00ff41]' :
                        sat.status === 'active' ? 'bg-green-400 shadow-[0_0_8px_#00ff41]' : 
                        sat.status === 'maintenance' ? 'bg-yellow-400 shadow-[0_0_8px_#ffea00]' : 'bg-red-400 shadow-[0_0_8px_#ff0040]'
                      }`} />
                      <span className="truncate text-sm font-bold text-green-300">{sat.name}</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-green-700">{sat.type}</div>
                  </div>
                  <div className="text-right text-sm font-bold tabular-nums text-green-500">{sat.noradId}</div>
                  <div className="text-right text-sm tabular-nums text-green-500">{sat.launchDate}</div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={(event) => {
                      event.stopPropagation()
                      trackSatellite(sat)
                    }}
                    disabled={trackingSatelliteId === sat.id}
                    className={`flex h-9 items-center justify-center gap-2 rounded border px-3 text-xs font-black tracking-wider transition-all ${
                      trackingSatelliteId === sat.id
                        ? 'border-green-300 bg-green-500/20 text-green-100 shadow-[0_0_18px_rgba(0,255,65,0.45)]'
                        : 'border-green-500/70 bg-black/50 text-green-300 shadow-[0_0_10px_rgba(0,255,65,0.18)] hover:bg-green-500/15 hover:text-green-100 hover:shadow-[0_0_22px_rgba(0,255,65,0.42)]'
                    }`}
                  >
                    {trackingSatelliteId === sat.id ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        LOCKING
                      </>
                    ) : (
                      'TRACK IT'
                    )}
                  </motion.button>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Selected Satellite Detail Panel */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="terminal-panel p-4 xl:col-span-1"
          >
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5" />
              TELEMETRY DATA
            </h2>
            
            {selectedSatellite ? (
              <div className="space-y-4">
                {/* Satellite Header */}
                <div className="bg-black/30 p-4 rounded border border-green-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold glow-green">{selectedSatellite.name}</h3>
                      <p className="text-sm text-green-600">{selectedSatellite.type}</p>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded border ${getStatusColor(selectedSatellite.status)} border-current`}>
                      {getStatusIcon(selectedSatellite.status)}
                      <span className="uppercase text-sm font-bold">{selectedSatellite.status}</span>
                    </div>
                  </div>
                </div>

                {/* Telemetry Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-black/20 p-4 rounded border border-green-900/30">
                    <div className="text-xs text-green-600 mb-1">NORAD ID</div>
                    <div className="text-lg font-bold">{selectedSatellite.noradId}</div>
                  </div>
                  <div className="bg-black/20 p-4 rounded border border-green-900/30">
                    <div className="text-xs text-green-600 mb-1">LAUNCH DATE</div>
                    <div className="text-lg font-bold">{selectedSatellite.launchDate}</div>
                  </div>
                  <div className="bg-black/20 p-4 rounded border border-green-900/30">
                    <div className="text-xs text-green-600 mb-1">LATITUDE</div>
                    <div className="text-lg font-bold">{selectedSatellite.latitude.toFixed(4)}°</div>
                  </div>
                  <div className="bg-black/20 p-4 rounded border border-green-900/30">
                    <div className="text-xs text-green-600 mb-1">LONGITUDE</div>
                    <div className="text-lg font-bold">{selectedSatellite.longitude.toFixed(4)}°</div>
                  </div>
                  <div className="bg-black/20 p-4 rounded border border-green-900/30">
                    <div className="text-xs text-green-600 mb-1">ALTITUDE</div>
                    <div className="text-lg font-bold flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      {selectedSatellite.altitude.toLocaleString()} km
                    </div>
                  </div>
                  <div className="bg-black/20 p-4 rounded border border-green-900/30">
                    <div className="text-xs text-green-600 mb-1">VELOCITY</div>
                    <div className="text-lg font-bold">{selectedSatellite.velocity} km/s</div>
                  </div>
                  <div className="bg-black/20 p-4 rounded border border-green-900/30">
                    <div className="text-xs text-green-600 mb-1">SIGNAL STRENGTH</div>
                    <div className="text-lg font-bold flex items-center gap-2">
                      <Signal className="w-4 h-4" />
                      {selectedSatellite.signalStrength}%
                    </div>
                  </div>
                </div>

                {/* Signal Strength Bar */}
                <div className="bg-black/20 p-4 rounded border border-green-900/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-green-600">SIGNAL QUALITY</span>
                    <span className="text-xs">{selectedSatellite.signalStrength}%</span>
                  </div>
                  <div className="h-3 bg-black/50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${selectedSatellite.signalStrength}%` }}
                      className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <Satellite className="w-16 h-16 text-green-600 mb-4 animate-pulse-slow" />
                <h3 className="text-lg mb-2">SELECT A SATELLITE</h3>
                <p className="text-sm text-green-600">Click on a satellite from the list to view detailed telemetry data</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* Footer Status Bar */}
      <motion.footer 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="terminal-panel p-3 mt-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              SYSTEM ONLINE
            </span>
            <span className="text-green-600">|</span>
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {satellites.length} SATELLITES
            </span>
            <span className="text-green-600">|</span>
            <span>SGP4/SDP4 PROPAGATOR</span>
          </div>
          <div className="text-green-600">
            ISRO SATELLITE TRACKING SYSTEM v2.0 • USING SATELLITE.JS
          </div>
        </div>
      </motion.footer>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <UIProvider>
        <NavBar />
        <Routes>
          <Route path="/" element={<SatelliteTracker />} />
          <Route path="/globe" element={<Globe3D />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </UIProvider>
    </BrowserRouter>
  )
}

export default App
