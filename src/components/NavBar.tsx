import { useContext, useEffect, useMemo, useState } from 'react'
import { Home, Map, Menu, X, Globe2, Camera, Radio } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { UIContext } from '../contexts/UIContext'
import { useSkyPasses, type SkyPassSatellite } from '../hooks/useSkyPasses'
import { getSatelliteList, getSatelliteRecord } from '../lib/satelliteTracker'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex h-10 items-center justify-center gap-2 rounded border px-3 text-xs font-black tracking-wider transition-all',
    isActive
      ? 'border-green-400 bg-green-500/15 text-green-200 shadow-[0_0_18px_rgba(0,255,65,0.32)]'
      : 'border-green-900/60 bg-black/40 text-green-600 hover:border-green-500/80 hover:bg-green-500/10 hover:text-green-300'
  ].join(' ')

export default function NavBar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [usesDefaultLocation, setUsesDefaultLocation] = useState(false)
  const [locationMessage, setLocationMessage] = useState('DETERMINING LOCATION...')

  const {
    searchQuery,
    setSearchQuery,
    totalSatellites,
    emitSearchSubmit,
    takeScreenshot,
    showPassesPanel,
    setShowPassesPanel,
    emitSatelliteSelect
  } = useContext(UIContext)

  const satelliteEntries = useMemo(
    () =>
      getSatelliteList()
        .map((sat): SkyPassSatellite | null => {
          const satrec = getSatelliteRecord(sat.noradId)
          return satrec ? { ...sat, satrec } : null
        })
        .filter((sat): sat is SkyPassSatellite => Boolean(sat)),
    [totalSatellites]
  )

  const satelliteNames = useMemo(
    () => Array.from(new Set(getSatelliteList().map(({ name }) => name))).sort((a, b) => a.localeCompare(b)),
    []
  )

  const { passes, loading } = useSkyPasses(location, satelliteEntries)

  const closeMenu = () => setIsOpen(false)

  useEffect(() => {
    if (!showPassesPanel) return

    if (!navigator.geolocation) {
      setUsesDefaultLocation(true)
      setLocation({ lat: 28.6139, lon: 77.2090 })
      setLocationMessage('USING DEFAULT: NEW DELHI')
      return
    }

    const timeout = window.setTimeout(() => {
      setUsesDefaultLocation(true)
      setLocation({ lat: 28.6139, lon: 77.2090 })
      setLocationMessage('USING DEFAULT: NEW DELHI')
    }, 8000)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timeout)
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setUsesDefaultLocation(false)
        setLocationMessage('LOCATION FOUND')
      },
      () => {
        window.clearTimeout(timeout)
        setUsesDefaultLocation(true)
        setLocation({ lat: 28.6139, lon: 77.2090 })
        setLocationMessage('USING DEFAULT: NEW DELHI')
      },
      { timeout: 8000 }
    )

    return () => {
      window.clearTimeout(timeout)
    }
  }, [showPassesPanel])

  return (
    <header className="sticky top-0 z-[2000] border-b border-green-500/30 bg-[#050805]/95 font-mono text-green-400 shadow-[0_0_22px_rgba(0,255,65,0.12)] backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex items-center gap-2">
        <Link
          to="/"
          onClick={closeMenu}
          className="flex items-center gap-2 text-sm font-black tracking-wider text-green-300 glow-green"
          aria-label="Go to home tracker"
        >
          <Home className="h-4 w-4" />
          <span className="hidden min-[420px]:inline">HOME</span>
        </Link>
        <button
          type="button"
          onClick={() => setShowPassesPanel((v: boolean) => !v)}
          className={`ml-2 flex items-center gap-2 text-sm font-black tracking-wider ${showPassesPanel ? 'text-green-200 border border-green-400 px-2 rounded' : 'text-green-300'}`}
        >
          <Radio className="h-4 w-4" />
          <span>SKY PASSES</span>
        </button>
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <div className="relative">
            <input
              value={searchQuery}
              list="satellite-autosuggest"
              autoComplete="off"
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') emitSearchSubmit(searchQuery)
                if (e.key === 'Escape') setSearchQuery('')
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="SEARCH SATELLITE..."
              style={{ color: '#00ff41', backgroundColor: '#0a0a0a' }}
              className={`h-10 min-w-[300px] ${isFocused ? 'w-[380px]' : ''} transition-all rounded border border-[#00ff41] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-[#00ff41] placeholder:text-[#00ff41]/50 outline-none focus:border-[#00ff41] focus:shadow-[0_0_8px_rgba(0,255,65,0.4)]`}
            />
            <datalist id="satellite-autosuggest">
              {satelliteNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-green-300"
                aria-label="Clear search"
              >
                X
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => takeScreenshot()}
            className="flex h-10 items-center gap-2 rounded border border-green-900/60 bg-black/50 px-3 text-xs font-black tracking-wider text-green-300 hover:border-green-500"
            title="Take screenshot"
          >
            <Camera className="h-4 w-4" />
          </button>

          <NavLink to="/" end className={navLinkClass}>
            <Map className="h-4 w-4" />
            <span>2D MAP</span>
          </NavLink>
          <NavLink to="/globe" className={navLinkClass}>
            <Globe2 className="h-4 w-4" />
            <span>3D GLOBE</span>
          </NavLink>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          className="flex h-10 w-10 items-center justify-center rounded border border-green-900/70 bg-black/50 text-green-300 transition hover:border-green-500 sm:hidden"
          aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {showPassesPanel && (
        <div className="absolute left-3 top-[4.25rem] z-[2100] w-80 rounded border border-green-500/40 bg-black/95 p-3 text-xs text-green-200 shadow-[0_0_18px_rgba(0,255,65,0.12)]">
          <div className="font-black uppercase text-sm mb-2">SKY PASSES</div>
          <div className="mb-2 text-[11px] text-green-600">
            {location
              ? `${location.lat.toFixed(4)}N, ${location.lon.toFixed(4)}E`
              : usesDefaultLocation
                ? 'USING DEFAULT LOCATION: NEW DELHI'
                : locationMessage}
          </div>
          {loading && <div className="text-green-600">Calculating passes...</div>}
          {!loading && passes.length === 0 && (
            <div className="text-green-600">No passes found in next 2 hours.</div>
          )}
          {!loading && passes.length > 0 && (
            <div className="space-y-1">
              {passes.map((pass) => (
                <button
                  key={pass.satellite.id}
                  type="button"
                  onClick={() => {
                    emitSatelliteSelect(pass.satellite)
                    setShowPassesPanel(false)
                  }}
                  className="flex w-full items-center justify-between rounded px-2 py-2 text-left transition hover:bg-black/70"
                >
                  <span className="truncate text-sm font-bold text-green-100">
                    {pass.satellite.name}
                  </span>
                  <span className="text-[11px] text-green-300">{pass.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isOpen && (
        <nav className="grid gap-2 border-t border-green-900/60 bg-black/95 p-3 sm:hidden">
          <NavLink to="/" end className={navLinkClass} onClick={closeMenu}>
            <Map className="h-4 w-4" />
            <span>2D MAP</span>
          </NavLink>
          <NavLink to="/globe" className={navLinkClass} onClick={closeMenu}>
            <Globe2 className="h-4 w-4" />
            <span>3D GLOBE</span>
          </NavLink>
        </nav>
      )}
    </header>
  )
}
