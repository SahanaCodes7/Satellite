import React, { createContext, useCallback, useMemo, useState } from 'react'

type SearchSubmitHandler = (query: string) => void

export const UIContext = createContext({
  searchQuery: '',
  setSearchQuery: (_q: string) => {},
  totalSatellites: 0,
  setTotalSatellites: (_n: number) => {},
  matchCount: 0,
  setMatchCount: (_n: number) => {},
  onSearchSubmit: (_handler: SearchSubmitHandler) => () => {},
  emitSearchSubmit: (_q: string) => {},
  onSatelliteSelect: (_handler: (satellite: any) => void) => () => {},
  emitSatelliteSelect: (_satellite: any) => {},

  showLegend: false,
  setShowLegend: (_v: boolean) => {},
  showPassesPanel: false,
  setShowPassesPanel: (_v: boolean) => {}
} as any)

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [totalSatellites, setTotalSatellites] = useState(0)
  const [matchCount, setMatchCount] = useState(0)

  const [showLegend, setShowLegend] = useState(false)
  const [showPassesPanel, setShowPassesPanel] = useState(false)

  const eventTarget = useMemo(() => new EventTarget(), [])

  const onSearchSubmit = useCallback((handler: SearchSubmitHandler) => {
    const listener = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { query: string }
      handler(detail.query)
    }
    eventTarget.addEventListener('searchSubmit', listener as EventListener)
    return () => eventTarget.removeEventListener('searchSubmit', listener as EventListener)
  }, [eventTarget])

  const emitSearchSubmit = useCallback((q: string) => {
    eventTarget.dispatchEvent(new CustomEvent('searchSubmit', { detail: { query: q } }))
  }, [eventTarget])

  const onSatelliteSelect = useCallback((handler: (satellite: any) => void) => {
    const listener = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { satellite: any }
      handler(detail.satellite)
    }
    eventTarget.addEventListener('satelliteSelect', listener as EventListener)
    return () => eventTarget.removeEventListener('satelliteSelect', listener as EventListener)
  }, [eventTarget])

  const emitSatelliteSelect = useCallback((satellite: any) => {
    eventTarget.dispatchEvent(new CustomEvent('satelliteSelect', { detail: { satellite } }))
  }, [eventTarget])



  return (
    <UIContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        totalSatellites,
        setTotalSatellites,
        matchCount,
        setMatchCount,
        onSearchSubmit,
        emitSearchSubmit,
        onSatelliteSelect,
        emitSatelliteSelect,

        showLegend,
        setShowLegend,
        showPassesPanel,
        setShowPassesPanel
      }}
    >
      {children}
    </UIContext.Provider>
  )
}

export default UIProvider
