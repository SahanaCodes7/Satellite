import { useContext, useState } from 'react'
import { Home, Map, Menu, X, Globe2, Camera } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { UIContext } from '../contexts/UIContext'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex h-10 items-center justify-center gap-2 rounded border px-3 text-xs font-black tracking-wider transition-all',
    isActive
      ? 'border-green-400 bg-green-500/15 text-green-200 shadow-[0_0_18px_rgba(0,255,65,0.32)]'
      : 'border-green-900/60 bg-black/40 text-green-600 hover:border-green-500/80 hover:bg-green-500/10 hover:text-green-300'
  ].join(' ')

export default function NavBar() {
  const [isOpen, setIsOpen] = useState(false)
  const { searchQuery, setSearchQuery, totalSatellites, matchCount, emitSearchSubmit, takeScreenshot, showPassesPanel, setShowPassesPanel } = useContext(UIContext)
  const [isFocused, setIsFocused] = useState(false)

  const closeMenu = () => setIsOpen(false)

  return (
    <header className="sticky top-0 z-50 border-b border-green-500/30 bg-[#050805]/95 font-mono text-green-400 shadow-[0_0_22px_rgba(0,255,65,0.12)] backdrop-blur">
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
          📡 SKY PASSES
        </button>
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <div className="relative">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') emitSearchSubmit(searchQuery)
                if (e.key === 'Escape') setSearchQuery('')
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="SEARCH SATELLITE..."
              className={`h-10 w-[280px] ${isFocused ? 'w-[380px]' : ''} transition-all rounded border border-[#003214] bg-black/90 px-3 py-2 font-mono text-sm text-[#00ff41] placeholder-[#064d1b] outline-none focus:border-[#00ff41]`}
            />
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
