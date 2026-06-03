import React, { createContext, useCallback, useMemo, useState } from 'react'

type SearchSubmitHandler = (query: string) => void

export const UIContext = createContext({
  searchQuery: '',
  setSearchQuery: (q: string) => {},
  totalSatellites: 0,
  setTotalSatellites: (n: number) => {},
  matchCount: 0,
  setMatchCount: (n: number) => {},
  onSearchSubmit: (handler: SearchSubmitHandler) => () => {},
  emitSearchSubmit: (q: string) => {},
  registerCanvas: (canvas: HTMLCanvasElement | null) => {},
  takeScreenshot: () => {},
  showLegend: false,
  setShowLegend: (v: boolean) => {},
  showPassesPanel: false,
  setShowPassesPanel: (v: boolean) => {}
} as any)

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [totalSatellites, setTotalSatellites] = useState(0)
  const [matchCount, setMatchCount] = useState(0)
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null)
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

  const registerCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    setCanvasEl(canvas)
  }, [])

  const takeScreenshot = useCallback(() => {
    if (!canvasEl) return
    const dataUrl = canvasEl.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `isro-satellite-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
    link.click()
  }, [canvasEl])

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
        registerCanvas,
        takeScreenshot,
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
