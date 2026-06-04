import { useEffect, useState } from 'react'
import * as satellite from 'satellite.js'

export interface SkyPassSatellite {
  id: number
  name: string
  type: string
  noradId: number
  satrec: satellite.SatRec
}

export interface SkyPassResult {
  satellite: SkyPassSatellite
  start: Date | null
  status: 'overhead' | 'upcoming' | 'no-pass'
  label: string
  secondsUntil: number
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return 6371 * c
}

function formatDuration(seconds: number) {
  const absolute = Math.max(0, seconds)
  const hours = Math.floor(absolute / 3600)
  const minutes = Math.floor((absolute % 3600) / 60)
  const secs = absolute % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function computeDistanceToLocation(
  satrec: satellite.SatRec,
  date: Date,
  lat: number,
  lon: number
) {
  try {
    const state = satellite.propagate(satrec, date)
    if (!state) return null

    const positionEci = state.position as satellite.EciVec3<number> | boolean
    if (!positionEci || typeof positionEci === 'boolean') return null

    const gmst = satellite.gstime(date)
    const positionGd = satellite.eciToGeodetic(positionEci, gmst)
    const latP = satellite.degreesLat(positionGd.latitude)
    const lonP = satellite.degreesLong(positionGd.longitude)
    return haversineDistanceKm(latP, lonP, lat, lon)
  } catch {
    return null
  }
}

function findNextSkyPass(
  sat: SkyPassSatellite,
  lat: number,
  lon: number
): SkyPassResult {
  const now = new Date()
  const maxSearchMs = 2 * 60 * 60 * 1000
  const stepMs = 30_000

  const currentDistance = computeDistanceToLocation(sat.satrec, now, lat, lon)
  if (currentDistance !== null && currentDistance < 2000) {
    return {
      satellite: sat,
      start: now,
      status: 'overhead',
      label: 'OVERHEAD NOW',
      secondsUntil: 0
    }
  }

  for (let offset = stepMs; offset <= maxSearchMs; offset += stepMs) {
    const date = new Date(now.getTime() + offset)
    const distance = computeDistanceToLocation(sat.satrec, date, lat, lon)
    if (distance !== null && distance < 2000) {
      const secondsUntil = Math.max(1, Math.floor((date.getTime() - now.getTime()) / 1000))
      return {
        satellite: sat,
        start: date,
        status: 'upcoming',
        label: `in ${formatDuration(secondsUntil)}`,
        secondsUntil
      }
    }
  }

  return {
    satellite: sat,
    start: null,
    status: 'no-pass',
    label: 'NO PASS < 2H',
    secondsUntil: Number.POSITIVE_INFINITY
  }
}

export function useSkyPasses(
  location: { lat: number; lon: number } | null,
  satelliteList: SkyPassSatellite[]
) {
  const [passes, setPasses] = useState<SkyPassResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!location || satelliteList.length === 0) {
      setPasses([])
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)

    const results: SkyPassResult[] = []
    for (const sat of satelliteList) {
      const nextPass = findNextSkyPass(sat, location.lat, location.lon)
      results.push(nextPass)
    }

    if (!active) return
    results.sort((a, b) => {
      if (a.status === 'overhead' && b.status !== 'overhead') return -1
      if (b.status === 'overhead' && a.status !== 'overhead') return 1
      return a.secondsUntil - b.secondsUntil
    })
    setPasses(results.slice(0, 6))
    setLoading(false)

    return () => {
      active = false
    }
  }, [location?.lat, location?.lon, satelliteList])

  return { passes, loading }
}
