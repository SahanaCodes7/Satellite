import { useCallback, useEffect, useMemo, useRef, useState, useContext } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
// Note: using basic THREE.Line for subtle ground tracks; no Line2 required
import * as satellite from 'satellite.js'
import { Activity, CircleDot, Database, MapPin, Satellite as SatelliteIcon, Zap } from 'lucide-react'
import {
  calculateAllSatellitePositions,
  calculateSatellitePosition,
  initializeSatelliteRecords,
  initializeTLEData,
  SATELLITE_TLE_DATA,
  type SatellitePosition,
  type TLEDataSource
} from '../lib/satelliteTracker'
import { UIContext } from '../contexts/UIContext'

const EARTH_RADIUS_KM = 6371
const EARTH_RADIUS = 2
const EARTH_DAY_TEXTURE_URL = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg'
const EARTH_NIGHT_TEXTURE_URL = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg'
const WORLD_BORDERS_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'
const GROUND_TRACK_RADIUS = EARTH_RADIUS * 1.002

interface GeoJsonGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

interface GeoJsonFeature {
  geometry?: GeoJsonGeometry | null
}

interface GeoJsonFeatureCollection {
  features?: GeoJsonFeature[]
}

interface GlobeSatellite extends SatellitePosition {
  satrec: satellite.SatRec
}

type TrackDisplayMode = 'ground' | 'orbit'

function altitudeToVisualRadius(altitudeKm: number) {
  const compressedAltitude = Math.min(Math.max(altitudeKm, 0), 43000)
  return EARTH_RADIUS + (compressedAltitude / EARTH_RADIUS_KM) * 0.78
}

function latLngToVector3(latitude: number, longitude: number, radius: number) {
  const phi = (90 - latitude) * (Math.PI / 180)
  const theta = (longitude + 180) * (Math.PI / 180)

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

function satelliteToVector3(satellitePosition: SatellitePosition) {
  return latLngToVector3(
    satellitePosition.latitude,
    satellitePosition.longitude,
    altitudeToVisualRadius(satellitePosition.altitude)
  )
}

function ecfToVector3(positionEcf: satellite.EcfVec3<number>, scale: number) {
  return new THREE.Vector3(
    positionEcf.x * scale,
    positionEcf.z * scale,
    -positionEcf.y * scale
  )
}

function createSatelliteRecord(noradId: number): satellite.SatRec | null {
  const data = SATELLITE_TLE_DATA[noradId]
  if (!data) return null

  try {
    return data.omm
      ? satellite.json2satrec(data.omm as satellite.OMMJsonObject)
      : satellite.twoline2satrec(data.tle1, data.tle2)
  } catch (error) {
    console.warn(`Failed to create 3D satrec for ${data.name}`, error)
    return null
  }
}

function attachRecords(positions: SatellitePosition[]) {
  return positions
    .map((position) => {
      const satrec = createSatelliteRecord(position.noradId)
      return satrec ? { ...position, satrec } : null
    })
    .filter((position): position is GlobeSatellite => Boolean(position))
}

function propagateGlobeSatellite(baseSatellite: GlobeSatellite, date: Date): SatellitePosition | null {
  try {
    const state = satellite.propagate(baseSatellite.satrec, date)
    if (!state) return null

    const positionEci = state.position as satellite.EciVec3<number> | boolean
    const velocityEci = state.velocity as satellite.EciVec3<number> | boolean
    if (
      !positionEci ||
      typeof positionEci === 'boolean' ||
      !velocityEci ||
      typeof velocityEci === 'boolean'
    ) {
      return null
    }

    const gmst = satellite.gstime(date)
    const positionGd = satellite.eciToGeodetic(positionEci, gmst)
    const velocity = Math.sqrt(velocityEci.x ** 2 + velocityEci.y ** 2 + velocityEci.z ** 2)

    return {
      ...baseSatellite,
      latitude: satellite.degreesLat(positionGd.latitude),
      longitude: satellite.degreesLong(positionGd.longitude),
      altitude: positionGd.height,
      velocity: parseFloat(velocity.toFixed(2)),
      lastUpdate: date
    }
  } catch {
    return null
  }
}

function createFallbackEarthTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) return null

  const ocean = context.createLinearGradient(0, 0, 0, canvas.height)
  ocean.addColorStop(0, '#0b4d7a')
  ocean.addColorStop(0.48, '#1068a6')
  ocean.addColorStop(1, '#052a4b')
  context.fillStyle = ocean
  context.fillRect(0, 0, canvas.width, canvas.height)

  const landMasses = [
    [[145, 145], [245, 110], [350, 160], [370, 245], [290, 305], [185, 275]],
    [[300, 325], [370, 285], [430, 345], [395, 455], [330, 472], [285, 400]],
    [[475, 135], [575, 105], [705, 145], [735, 225], [655, 275], [530, 250]],
    [[570, 270], [675, 275], [715, 350], [615, 425], [535, 365]],
    [[720, 150], [855, 125], [945, 195], [900, 292], [785, 275]],
    [[805, 335], [880, 318], [945, 370], [905, 438], [820, 418]]
  ]

  context.fillStyle = '#487a38'
  context.strokeStyle = '#9a7a42'
  context.lineWidth = 3
  for (const points of landMasses) {
    context.beginPath()
    points.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.closePath()
    context.fill()
    context.stroke()
  }

  context.strokeStyle = 'rgba(255,255,255,0.18)'
  context.lineWidth = 1
  for (let y = 48; y < canvas.height; y += 72) {
    context.beginPath()
    context.moveTo(0, y)
    context.bezierCurveTo(220, y - 25, 430, y + 25, canvas.width, y - 10)
    context.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function useSafeTexture(url: string) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let isMounted = true
    const loader = new THREE.TextureLoader()

    loader.load(
      url,
      (loadedTexture) => {
        if (!isMounted) {
          loadedTexture.dispose()
          return
        }

        loadedTexture.colorSpace = THREE.SRGBColorSpace
        loadedTexture.anisotropy = 8
        setTexture(loadedTexture)
        setFailed(false)
      },
      undefined,
      () => {
        if (isMounted) setFailed(true)
      }
    )

    return () => {
      isMounted = false
    }
  }, [url])

  useEffect(
    () => () => {
      texture?.dispose()
    },
    [texture]
  )

  return { texture, failed }
}

function createDotTexture(color: string) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = 128
  canvas.height = 128
  if (!ctx) return null

  const rgbaColor = color
  const outerGlow = ctx.createRadialGradient(64, 64, 10, 64, 64, 64)
  outerGlow.addColorStop(0, `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.6)`)
  outerGlow.addColorStop(0.5, `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.2)`)
  outerGlow.addColorStop(1, `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0)`)
  ctx.fillStyle = outerGlow
  ctx.fillRect(0, 0, 128, 128)

  const core = ctx.createRadialGradient(64, 64, 0, 64, 64, 16)
  core.addColorStop(0, 'rgba(255, 255, 255, 1)')
  core.addColorStop(0.5, rgbaColor)
  core.addColorStop(1, `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0)`)
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(64, 64, 16, 0, Math.PI * 2)
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createSatelliteIconTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(document.createElement('canvas'))

  // outer glow ring
  ctx.strokeStyle = 'rgba(0, 255, 65, 0.4)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(64, 64, 50, 0, Math.PI * 2)
  ctx.stroke()

  // satellite body (center rectangle)
  ctx.fillStyle = '#00ff41'
  ctx.fillRect(50, 56, 28, 16)

  // left solar panel
  ctx.fillStyle = '#0088ff'
  ctx.fillRect(14, 58, 32, 12)
  // left panel dividers
  ctx.strokeStyle = '#00ff41'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(25, 58)
  ctx.lineTo(25, 70)
  ctx.moveTo(36, 58)
  ctx.lineTo(36, 70)
  ctx.stroke()

  // right solar panel
  ctx.fillStyle = '#0088ff'
  ctx.fillRect(82, 58, 32, 12)
  // right panel dividers
  ctx.beginPath()
  ctx.moveTo(93, 58)
  ctx.lineTo(93, 70)
  ctx.moveTo(104, 58)
  ctx.lineTo(104, 70)
  ctx.stroke()

  // antenna (line up from body)
  ctx.strokeStyle = '#00ff41'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(64, 56)
  ctx.lineTo(64, 36)
  ctx.stroke()
  // antenna dish
  ctx.beginPath()
  ctx.arc(64, 33, 6, 0, Math.PI * 2)
  ctx.strokeStyle = '#00ff41'
  ctx.lineWidth = 2
  ctx.stroke()

  // bright center glow
  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 20)
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.6)')
  glow.addColorStop(1, 'rgba(0, 255, 65, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(64, 64, 20, 0, Math.PI * 2)
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createTextTexture(text: string, fill = '#ffffff') {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(document.createElement('canvas'))

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = 'rgba(0,0,0,0)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = '700 32px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = fill
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 4
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2)
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function getTypeColor(type: string) {
  switch (type.toUpperCase()) {
    case 'EARTH OBSERVATION':
      return '#00ff41'
    case 'NAVIGATION':
      return '#00ffff'
    case 'COMMUNICATION':
      return '#ffff00'
    case 'METEOROLOGICAL':
      return '#ff8800'
    case 'EXPERIMENTAL':
      return '#aa00ff'
    case 'RADAR IMAGING':
      return '#ff4444'
    default:
      return '#6efc6e'
  }
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
  const sign = seconds < 0 ? '-' : ''
  const absolute = Math.max(0, seconds)
  const hours = Math.floor(absolute / 3600)
  const minutes = Math.floor((absolute % 3600) / 60)
  const secs = absolute % 60
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function calculateNextIndiaPass(satelliteData: GlobeSatellite, from: Date) {
  if (!satelliteData.satrec) return null

  const indiaLat = 20.5937
  const indiaLon = 78.9629
  const stepMs = 30_000
  const maxMs = 24 * 60 * 60 * 1000

  for (let offset = 0; offset <= maxMs; offset += stepMs) {
    const date = new Date(from.getTime() + offset)
    const state = satellite.propagate(satelliteData.satrec, date)
    if (!state) continue

    const positionEci = state.position as satellite.EciVec3<number> | boolean
    if (!positionEci || typeof positionEci === 'boolean') continue

    const gmst = satellite.gstime(date)
    const positionGd = satellite.eciToGeodetic(positionEci, gmst)
    const lat = satellite.degreesLat(positionGd.latitude)
    const lon = satellite.degreesLong(positionGd.longitude)

    if (haversineDistanceKm(lat, lon, indiaLat, indiaLon) < 1000) {
      return date
    }
  }

  return null
}

function calculateOrbit3D(satrec: satellite.SatRec) {
  const points: THREE.Vector3[] = []
  const now = new Date()
  const epochGmst = satellite.gstime(now)
  const periodMinutes = Number.isFinite(satrec.no) && satrec.no > 0 ? (2 * Math.PI) / satrec.no : 95
  const steps = 200
  const stepMinutes = periodMinutes / steps
  const scale = EARTH_RADIUS / EARTH_RADIUS_KM

  for (let index = 0; index <= steps; index += 1) {
    const date = new Date(now.getTime() + index * stepMinutes * 60 * 1000)
    try {
      const state = satellite.propagate(satrec, date)
      if (!state || typeof state.position !== 'object') continue

      const positionEci = state.position as satellite.EciVec3<number>
      const { x, y, z } = positionEci
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue

      const positionEcf = satellite.eciToEcf(positionEci, epochGmst)
      const positionGd = satellite.eciToGeodetic(positionEci, epochGmst)
      const point = ecfToVector3(positionEcf, scale).setLength(altitudeToVisualRadius(positionGd.height))
      points.push(point)
    } catch {
      // Skip bad propagated samples; a partial ring is better than no overlay.
    }
  }

  return points
}

function calculateOrbitPlane(points: THREE.Vector3[]) {
  if (points.length < 3) return null

  const first = points[0].clone().normalize()
  const quarter = points[Math.floor(points.length / 4)]?.clone().normalize()
  if (!quarter) return null

  const normal = first.cross(quarter).normalize()
  if (!Number.isFinite(normal.lengthSq()) || normal.lengthSq() < 0.0001) return null

  const radius = points.reduce((maxRadius, point) => Math.max(maxRadius, point.length()), 0)
  if (!Number.isFinite(radius) || radius <= 0) return null

  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
  return { radius, quaternion }
}

function computeOrbitRingSegments(satelliteData: GlobeSatellite, samples = 120) {
  const segments: THREE.Vector3[][] = []
  if (!satelliteData.satrec) return segments

  const stepMinutes = 90 / samples
  const now = new Date()
  let currentSegment: THREE.Vector3[] = []
  let prevLon: number | null = null

  for (let index = 0; index <= samples; index += 1) {
    const date = new Date(now.getTime() + index * stepMinutes * 60 * 1000)
    const state = satellite.propagate(satelliteData.satrec, date)
    if (!state) continue

    const positionEci = state.position as satellite.EciVec3<number> | boolean
    if (!positionEci || typeof positionEci === 'boolean') continue

    const gmst = satellite.gstime(date)
    const positionGd = satellite.eciToGeodetic(positionEci, gmst)
    const lat = satellite.degreesLat(positionGd.latitude)
    const lon = satellite.degreesLong(positionGd.longitude)
    const radius = altitudeToVisualRadius(positionGd.height)
    const vec = latLngToVector3(lat, lon, radius)

    if (prevLon !== null && Math.abs(lon - prevLon) > 150) {
      if (currentSegment.length > 1) segments.push([...currentSegment])
      currentSegment = []
    }

    currentSegment.push(vec)
    prevLon = lon
  }

  if (currentSegment.length > 1) segments.push(currentSegment)
  return segments
}

function ScreenshotRegistrar({ register }: { register: (canvas: HTMLCanvasElement) => void }) {
  const { gl } = useThree()

  useEffect(() => {
    if (gl.domElement instanceof HTMLCanvasElement) {
      register(gl.domElement)
    }
  }, [gl, register])

  return null
}

function Earth() {
  const { texture: dayTexture, failed: dayTextureFailed } = useSafeTexture(EARTH_DAY_TEXTURE_URL)
  const { texture: nightTexture } = useSafeTexture(EARTH_NIGHT_TEXTURE_URL)
  const fallbackTexture = useMemo(() => createFallbackEarthTexture(), [])
  const earthTexture = dayTexture ?? fallbackTexture

  useEffect(
    () => () => {
      fallbackTexture?.dispose()
    },
    [fallbackTexture]
  )

  return (
    <group>
      <mesh renderOrder={0}>
        <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
        <meshPhongMaterial
          color={earthTexture ? '#ffffff' : '#1f6fa8'}
          map={earthTexture ?? undefined}
          emissive="#020b12"
          emissiveMap={nightTexture ?? undefined}
          emissiveIntensity={nightTexture ? 0.18 : 0.03}
          shininess={24}
          specular="#26485f"
          depthWrite={true}
          depthTest={true}
        />
      </mesh>
      {dayTextureFailed && (
        <mesh renderOrder={0}>
          <sphereGeometry args={[EARTH_RADIUS + 0.003, 64, 64]} />
          <meshBasicMaterial color="#1f6fa8" transparent opacity={0.18} depthWrite={true} depthTest={true} />
        </mesh>
      )}
      <mesh scale={1.045} renderOrder={0}>
        <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
        <meshBasicMaterial
          color="#62d7ff"
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={true}
          depthTest={true}
        />
      </mesh>
    </group>
  )
}

function StarField() {
  const positions = useMemo(() => {
    const values = new Float32Array(1800 * 3)
    for (let index = 0; index < 1800; index += 1) {
      const radius = 38 + Math.random() * 28
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      values[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
      values[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      values[index * 3 + 2] = radius * Math.cos(phi)
    }
    return values
  }, [])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#8cffaa" size={0.045} transparent opacity={0.68} sizeAttenuation />
    </points>
  )
}

function polygonToLineSegments(coordinates: number[][][], output: number[]) {
  for (const ring of coordinates) {
    for (let index = 0; index < ring.length - 1; index += 1) {
      const [lonA, latA] = ring[index]
      const [lonB, latB] = ring[index + 1]
      const a = latLngToVector3(latA, lonA, EARTH_RADIUS * 1.006)
      const b = latLngToVector3(latB, lonB, EARTH_RADIUS * 1.006)
      output.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
  }
}

function CountryBorders() {
  const [linePositions, setLinePositions] = useState<Float32Array | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadBorders() {
      try {
        const response = await fetch(WORLD_BORDERS_URL)
        if (!response.ok) throw new Error(`World borders request failed: ${response.status}`)
        const geoJson = (await response.json()) as GeoJsonFeatureCollection
        const values: number[] = []

        for (const feature of geoJson.features ?? []) {
          const geometry = feature.geometry
          if (!geometry) continue

          if (geometry.type === 'Polygon') {
            polygonToLineSegments(geometry.coordinates as number[][][], values)
          } else if (geometry.type === 'MultiPolygon') {
            for (const polygon of geometry.coordinates as number[][][][]) {
              polygonToLineSegments(polygon, values)
            }
          }
        }

        if (isMounted) setLinePositions(new Float32Array(values))
      } catch (error) {
        console.warn('Country border overlay unavailable', error)
        if (isMounted) setLinePositions(null)
      }
    }

    loadBorders()
    return () => {
      isMounted = false
    }
  }, [])

  if (!linePositions || linePositions.length === 0) return null

  return (
    <lineSegments renderOrder={1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#1a4a1a" transparent opacity={0.25} depthWrite={false} depthTest={true} />
    </lineSegments>
  )
}

function SatelliteSprites({
  satellites,
  selectedId,
  onSelect,
  onSelectedFrame,
  highlightedIds
}: {
  satellites: GlobeSatellite[]
  selectedId: number | null
  onSelect: (satellite: SatellitePosition) => void
  onSelectedFrame: (satellite: SatellitePosition) => void
  highlightedIds: Set<number>
}) {
  const spriteRefs = useRef<(THREE.Sprite | null)[]>([])
  const labelRefs = useRef<(THREE.Sprite | null)[]>([])
  const latestSelectedRef = useRef<SatellitePosition | null>(null)
  const elapsedRef = useRef(0)
  const dotTextures = useMemo(
    () => satellites.map((sat) => createDotTexture(getTypeColor(sat.type))),
    [satellites]
  )
  const satelliteIconTexture = useMemo(() => createSatelliteIconTexture(), [])
  const issLabelTexture = useMemo(() => createTextTexture('ISS', '#ffd86b'), [])

  const dotMaterials = useMemo(
    () =>
      satellites.map((sat, index) =>
        new THREE.SpriteMaterial({
          map: dotTextures[index] ?? undefined,
          color: '#ffffff',
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: true,
          sizeAttenuation: true,
          opacity: highlightedIds.size === 0 || highlightedIds.has(sat.id) ? 1 : 0.2
        })
      ),
    [satellites, dotTextures, highlightedIds]
  )

  const iconMaterials = useMemo(
    () =>
      satellites.map((sat) =>
        new THREE.SpriteMaterial({
          map: satelliteIconTexture ?? undefined,
          color: /ISS/i.test(sat.name) ? '#fff7d1' : '#ffffff',
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: true,
          sizeAttenuation: true,
          opacity: highlightedIds.size === 0 || highlightedIds.has(sat.id) ? 1 : 0.2
        })
      ),
    [satellites, satelliteIconTexture, highlightedIds]
  )

  const issLabelMaterial = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: issLabelTexture ?? undefined,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        sizeAttenuation: true,
        opacity: highlightedIds.size === 0 ? 1 : 1
      }),
    [issLabelTexture, highlightedIds]
  )

  useEffect(
    () => () => {
      dotTextures.forEach((texture) => texture?.dispose())
      satelliteIconTexture?.dispose()
      issLabelTexture?.dispose()
      dotMaterials.forEach((material) => material.dispose())
      iconMaterials.forEach((material) => material.dispose())
      issLabelMaterial.dispose()
    },
    [dotMaterials, dotTextures, iconMaterials, issLabelTexture, issLabelMaterial, satelliteIconTexture]
  )

  useEffect(() => {
    if (selectedId === null) latestSelectedRef.current = null
  }, [selectedId])

  useFrame(({ clock }) => {
    elapsedRef.current = clock.elapsedTime
    const now = new Date(Date.now() + elapsedRef.current * 1000)

    satellites.forEach((sat, index) => {
      const sprite = spriteRefs.current[index]
      const labelSprite = labelRefs.current[index]
      if (!sprite || !sat.satrec) return

      try {
        const state = satellite.propagate(sat.satrec, now)
        if (!state) return
        const positionEci = state.position as satellite.EciVec3<number> | boolean
        const velocityEci = state.velocity as satellite.EciVec3<number> | boolean
        if (!positionEci || typeof positionEci === 'boolean') return
        if (!velocityEci || typeof velocityEci === 'boolean') return

        const gmst = satellite.gstime(now)
        const positionGd = satellite.eciToGeodetic(positionEci, gmst)
        const lat = satellite.degreesLat(positionGd.latitude)
        const lon = satellite.degreesLong(positionGd.longitude)
        const alt = positionGd.height
        const vec = latLngToVector3(lat, lon, EARTH_RADIUS + 0.05)
        const distFromCenter = vec.length()
        if (distFromCenter > EARTH_RADIUS * 1.5 || distFromCenter < EARTH_RADIUS * 0.5) {
          sprite.visible = false
          if (labelSprite) labelSprite.visible = false
          return
        }

        const isSelected = sat.id === selectedId
        const isISS = /ISS/i.test(sat.name)
        const baseScale = isISS ? 0.22 : 0.18
        const selectedScale = isISS ? 0.32 : 0.26
        const material = isSelected ? iconMaterials[index] : dotMaterials[index]

        sprite.position.copy(vec)
        sprite.visible = true

        if (sprite.material !== material) {
          sprite.material = material
          sprite.material.needsUpdate = true
        }
        sprite.material.opacity = highlightedIds.size === 0 || highlightedIds.has(sat.id) ? 1 : 0.2
        sprite.scale.setScalar(isSelected ? selectedScale : baseScale)

        if (labelSprite && isISS) {
          const labelOffset = vec.clone().multiplyScalar(1.08)
          labelSprite.position.set(labelOffset.x, labelOffset.y, labelOffset.z)
          labelSprite.material.opacity = sprite.material.opacity
          labelSprite.visible = true
        }

        const velocity = Math.sqrt(velocityEci.x ** 2 + velocityEci.y ** 2 + velocityEci.z ** 2)

        if (isSelected) {
          latestSelectedRef.current = {
            ...sat,
            latitude: lat,
            longitude: lon,
            altitude: alt,
            velocity: parseFloat(velocity.toFixed(2)),
            lastUpdate: now
          }
        }
      } catch {
        // ignore individual propagation errors
      }
    })

    if (latestSelectedRef.current) onSelectedFrame(latestSelectedRef.current)
  })

  return (
    <group>
      {satellites.map((sat, index) => {
        const isSelected = sat.id === selectedId
        const isISS = /ISS/i.test(sat.name)
        const position = satelliteToVector3(sat)
        return (
          <group key={sat.id}>
            <sprite
              ref={(sprite) => {
                spriteRefs.current[index] = sprite
              }}
              position={position}
              scale={isSelected ? [isISS ? 0.22 : 0.18, isISS ? 0.22 : 0.18, isISS ? 0.22 : 0.18] : [isISS ? 0.15 : 0.12, isISS ? 0.15 : 0.12, isISS ? 0.15 : 0.12]}
              material={isSelected ? iconMaterials[index] : dotMaterials[index]}
              renderOrder={1}
              onClick={(event) => {
                event.stopPropagation()
                const sprite = spriteRefs.current[index]
                if (!sprite || sprite.position.length() > EARTH_RADIUS * 1.2) return
                onSelect(sat)
              }}
            />
            {isISS && (
              <sprite
                ref={(sprite) => {
                  labelRefs.current[index] = sprite
                }}
                position={position.clone().multiplyScalar(1.08)}
                scale={[1.5, 1.5, 1.5]}
                material={issLabelMaterial}
                renderOrder={1}
              />
            )}
          </group>
        )
      })}
    </group>
  )
}

function CameraAnimator({
  cameraTargetRef,
  isAnimatingRef,
  orbitControlsRef
}: {
  cameraTargetRef: any
  isAnimatingRef: any
  orbitControlsRef: any
}) {
  const { camera } = useThree()

  useFrame(() => {
    if (!isAnimatingRef.current || !cameraTargetRef.current) return
    if (orbitControlsRef.current) orbitControlsRef.current.enabled = false

    camera.position.lerp(cameraTargetRef.current.position, 0.05)
    camera.lookAt(cameraTargetRef.current.lookAt)

    if (camera.position.distanceTo(cameraTargetRef.current.position) < 0.01) {
      isAnimatingRef.current = false
      if (orbitControlsRef.current) orbitControlsRef.current.enabled = true
    }
  })

  return null
}

function CameraDistanceTracker({ cameraDistanceRef }: { cameraDistanceRef: any }) {
  const { camera } = useThree()

  useFrame(() => {
    cameraDistanceRef.current = camera.position.length()
  })

  return null
}

function DynamicLine({
  points,
  color,
  opacity,
  dashed = false
}: {
  points: THREE.Vector3[]
  color: string
  opacity: number
  dashed?: boolean
}) {
  const positions = useMemo(() => new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])), [points])

  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = dashed
      ? new THREE.LineDashedMaterial({
          color,
          transparent: true,
          opacity,
          dashSize: 0.03,
          gapSize: 0.02,
          depthWrite: false,
          depthTest: true
        })
      : new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
          depthTest: true
        })

    const createdLine = new THREE.Line(geometry, material)
    createdLine.renderOrder = 1
    if (dashed && 'computeLineDistances' in createdLine) {
      try {
        ;(createdLine as THREE.Line).computeLineDistances()
      } catch {}
    }

    return createdLine
  }, [positions, color, opacity, dashed])

  useEffect(
    () => () => {
      line.geometry.dispose()
      const material = line.material
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose())
      } else {
        material.dispose()
      }
    },
    [line]
  )

  if (points.length < 2) return null
  return <primitive object={line} />
}

function DynamicLineSegments({
  segments,
  color,
  opacity,
  dashed = false
}: {
  segments: THREE.Vector3[][]
  color: string
  opacity: number
  dashed?: boolean
}) {
  return (
    <>
      {segments.map((segment, index) => (
        <DynamicLine
          key={`${color}-${index}`}
          points={segment}
          color={color}
          opacity={opacity}
          dashed={dashed}
        />
      ))}
    </>
  )
}

function SelectionConnectorLine({ selectedSatellite }: { selectedSatellite: SatellitePosition | null }) {
  const points = useMemo(() => {
    if (!selectedSatellite) return null

    return [
      latLngToVector3(selectedSatellite.latitude, selectedSatellite.longitude, GROUND_TRACK_RADIUS),
      latLngToVector3(
        selectedSatellite.latitude,
        selectedSatellite.longitude,
        altitudeToVisualRadius(selectedSatellite.altitude)
      )
    ]
  }, [selectedSatellite])

  if (!points) return null

  return <DynamicLine points={points} color="#00ffff" opacity={0.85} dashed />
}

function SelectedOrbitRing({ selectedSatellite }: { selectedSatellite: SatellitePosition | null }) {
  const satrec = (selectedSatellite as GlobeSatellite | null)?.satrec
  const orbitPoints = useMemo(() => {
    return satrec ? calculateOrbit3D(satrec) : []
  }, [selectedSatellite?.id, satrec])

  const orbitPlane = useMemo(() => calculateOrbitPlane(orbitPoints), [orbitPoints])

  if (orbitPoints.length < 3) return null

  return (
    <>
      {orbitPlane && (
        <mesh quaternion={orbitPlane.quaternion} renderOrder={1}>
          <circleGeometry args={[orbitPlane.radius, 64]} />
          <meshBasicMaterial
            color="#00ffff"
            transparent
            opacity={0.03}
            side={THREE.DoubleSide}
            depthWrite={false}
            depthTest={true}
          />
        </mesh>
      )}
      <DynamicLine points={orbitPoints} color="#00ffff" opacity={0.8} />
      <DynamicLine points={orbitPoints} color="#8fffff" opacity={0.22} />
    </>
  )
}

function pushGroundTrackPoint(
  segments: THREE.Vector3[][],
  currentSegment: THREE.Vector3[],
  previousLongitude: number | null,
  latitude: number,
  longitude: number
) {
  // break segment when longitude jump is large (anti-meridian handling)
  if (previousLongitude !== null && Math.abs(longitude - previousLongitude) > 150) {
    if (currentSegment.length > 1) segments.push([...currentSegment])
    currentSegment.length = 0
  }

  currentSegment.push(latLngToVector3(latitude, longitude, GROUND_TRACK_RADIUS))
}

type Tracks = {
  orbitPast: THREE.Vector3[]
  orbitFuture: THREE.Vector3[]
  groundPast: THREE.Vector3[][]
  groundFuture: THREE.Vector3[][]
}

function calculateTracksForSatellite(selectedSatellite: SatellitePosition | null, nowMs: number): Tracks {
  const empty: Tracks = { orbitPast: [], orbitFuture: [], groundPast: [], groundFuture: [] }
  if (!selectedSatellite) return empty

  const orbitPast: THREE.Vector3[] = []
  const orbitFuture: THREE.Vector3[] = []
  const groundPast: THREE.Vector3[][] = []
  const groundFuture: THREE.Vector3[][] = []
  const groundPastSegment: THREE.Vector3[] = []
  const groundFutureSegment: THREE.Vector3[] = []
  let previousPastLongitude: number | null = null
  let previousFutureLongitude: number | null = null
  const satrec = (selectedSatellite as GlobeSatellite).satrec
  const orbitalPeriodMinutes = Number.isFinite(satrec?.no) && satrec.no > 0
    ? Math.min((2 * Math.PI) / satrec.no, 24 * 60)
    : 95
  const sampleCount = Math.max(121, Math.min(361, Math.round(orbitalPeriodMinutes * 2) + 1))
  const stepMinutes = orbitalPeriodMinutes / (sampleCount - 1)
  const startOffsetMinutes = -orbitalPeriodMinutes / 2

  // Use satellite.propagate to compute actual geodetic subpoint per sample synchronously
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const minute = startOffsetMinutes + stepMinutes * sampleIndex
    const date = new Date(nowMs + minute * 60 * 1000)
    // prefer satrec if available
    let lat: number | null = null
    let lon: number | null = null
    let alt: number | null = null
    if (satrec) {
      try {
        const state = satellite.propagate(satrec, date)
        if (!state) continue
        const positionEci = state.position as satellite.EciVec3<number> | boolean
        if (!positionEci || typeof positionEci === 'boolean') continue
        const gmst = satellite.gstime(date)
        const positionGd = satellite.eciToGeodetic(positionEci, gmst)
        lat = satellite.degreesLat(positionGd.latitude)
        lon = satellite.degreesLong(positionGd.longitude)
        alt = positionGd.height
      } catch {
        // fallback to calculateSatellitePosition if propagate fails
      }
    }

    // fallback path
    if (lat === null || lon === null) {
      const sample = calculateSatellitePosition(selectedSatellite.noradId, date)
      if (!sample) continue
      lat = sample.latitude
      lon = sample.longitude
      alt = sample.altitude
    }

    const orbitPoint = latLngToVector3(lat, lon, altitudeToVisualRadius(alt ?? selectedSatellite.altitude))

    if (minute <= 0) {
      orbitPast.push(orbitPoint)
      pushGroundTrackPoint(groundPast, groundPastSegment, previousPastLongitude, lat, lon)
      previousPastLongitude = lon
    }
    if (minute >= 0) {
      orbitFuture.push(orbitPoint)
      pushGroundTrackPoint(groundFuture, groundFutureSegment, previousFutureLongitude, lat, lon)
      previousFutureLongitude = lon
    }
  }

  if (groundPastSegment.length > 1) groundPast.push(groundPastSegment)
  if (groundFutureSegment.length > 1) groundFuture.push(groundFutureSegment)

  return { orbitPast, orbitFuture, groundPast, groundFuture }
}

function SelectedTracks({ selectedSatellite, now, externalTracks }: { selectedSatellite: SatellitePosition | null; now: Date; externalTracks?: Tracks | null }) {
  // If parent provided tracks (computed synchronously on selection), render them immediately
  if (externalTracks) {
    return (
      <>
        <DynamicLineSegments segments={externalTracks.groundPast} color="#ffaa00" opacity={0.7} />
        <DynamicLineSegments segments={externalTracks.groundFuture} color="#00ffff" opacity={0.5} dashed={true} />
        <SelectionConnectorLine selectedSatellite={selectedSatellite} />
      </>
    )
  }

  // Fallback: if no external tracks provided, compute locally at most every 30s
  const [tracks, setTracks] = useState<Tracks>({ orbitPast: [], orbitFuture: [], groundPast: [], groundFuture: [] })
  const lastComputedRef = useRef(0)

  useEffect(() => {
    if (!selectedSatellite) {
      setTracks({ orbitPast: [], orbitFuture: [], groundPast: [], groundFuture: [] })
      lastComputedRef.current = 0
      return
    }

    const nowMs = now.getTime()
    if (nowMs - lastComputedRef.current < 30000 && tracks.orbitPast.length) return

    const computed = calculateTracksForSatellite(selectedSatellite, nowMs)
    setTracks(computed)
    lastComputedRef.current = nowMs
  }, [now, selectedSatellite])

  return (
    <>
      <DynamicLineSegments segments={tracks.groundPast} color="#ffaa00" opacity={0.7} />
      <DynamicLineSegments segments={tracks.groundFuture} color="#00ffff" opacity={0.5} dashed={true} />
      <SelectionConnectorLine selectedSatellite={selectedSatellite} />
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'border-green-400 text-green-300',
    maintenance: 'border-yellow-400 text-yellow-300',
    critical: 'border-red-400 text-red-300',
    inactive: 'border-gray-400 text-gray-300'
  }

  return (
    <span className={`rounded border px-2 py-1 text-[11px] font-black uppercase ${colors[status] ?? colors.inactive}`}>
      {status}
    </span>
  )
}

export default function Globe3D() {
  const [satellites, setSatellites] = useState<GlobeSatellite[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedSatellite, setSelectedSatellite] = useState<SatellitePosition | null>(null)
  const [trackDisplayMode, setTrackDisplayMode] = useState<TrackDisplayMode>('ground')
  const [now, setNow] = useState(() => new Date())
  const [computedTracks, setComputedTracks] = useState<Tracks | null>(null)
  const [dataSource, setDataSource] = useState<TLEDataSource>('fallback')
  const [isInitializing, setIsInitializing] = useState(true)
  const { searchQuery, setTotalSatellites, setMatchCount, registerCanvas, onSearchSubmit, onSatelliteSelect } = useContext(UIContext)
  const [isLegendOpen, setIsLegendOpen] = useState(false)
  const [nextPassDate, setNextPassDate] = useState<Date | null>(null)
  const [lastPassSatId, setLastPassSatId] = useState<number | null>(null)
  // canvas element is registered via UIContext.registerCanvas
  const selectedIdRef = useRef<number | null>(null)
  const latestSelectedPositionRef = useRef<SatellitePosition | null>(null)
  const lastTracksForIdRef = useRef<number | null>(null)
  const lastTracksTimeRef = useRef(0)
  const cameraDistanceRef = useRef(EARTH_RADIUS * 2.5)
  const cameraTargetRef = useRef<any>(null)
  const isAnimatingRef = useRef(false)
  const orbitControlsRef = useRef<any>(null)

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  const searchLower = searchQuery.trim().toLowerCase()
  const searchMatches = useMemo(
    () =>
      satellites.filter((sat) =>
        !searchLower ||
        sat.name.toLowerCase().includes(searchLower) ||
        sat.type.toLowerCase().includes(searchLower)
      ),
    [satellites, searchLower]
  )

  const highlightedIds = useMemo(
    () => new Set(searchMatches.map((sat) => sat.id)),
    [searchMatches]
  )

  useEffect(() => {
    try {
      setTotalSatellites(satellites.length)
    } catch {}
  }, [satellites, setTotalSatellites])

  useEffect(() => {
    try {
      setMatchCount(searchMatches.length)
    } catch {}
  }, [searchMatches, setMatchCount])

  

  const issSatellite = useMemo(
    () => satellites.find((sat) => /ISS/i.test(sat.name)),
    [satellites]
  )

  const issOrbitSegments = useMemo(
    () => (issSatellite ? computeOrbitRingSegments(issSatellite, 140) : []),
    [issSatellite]
  )

  useEffect(() => {
    if (!selectedId || selectedId === lastPassSatId) return
    const globeSat = satellites.find((sat) => sat.id === selectedId) ?? null
    if (!globeSat) {
      setNextPassDate(null)
      return
    }

    const nextPass = calculateNextIndiaPass(globeSat, new Date())
    setNextPassDate(nextPass)
    setLastPassSatId(selectedId)
  }, [selectedId, satellites, lastPassSatId])

  const refreshAllSatellites = useCallback((date: Date) => {
    const positions = attachRecords(calculateAllSatellitePositions(date))
    setSatellites(positions)
    const currentSelectedId = selectedIdRef.current

    setSelectedSatellite((currentSelected) => {
      const targetId = currentSelectedId ?? currentSelected?.id
      if (targetId === undefined || targetId === null) {
        latestSelectedPositionRef.current = null
        return null
      }

      const updated = positions.find((sat) => sat.id === targetId) ?? null
      latestSelectedPositionRef.current = updated
      if (!updated) setSelectedId(null)
      return updated
    })
  }, [])

  useEffect(() => {
    let isCancelled = false

    async function initializeGlobeData() {
      setIsInitializing(true)
      initializeSatelliteRecords()

      const fallbackDate = new Date()
      setNow(fallbackDate)
      refreshAllSatellites(fallbackDate)

      try {
        const source = await initializeTLEData()
        if (isCancelled) return

        setDataSource(source)
        initializeSatelliteRecords()
        const date = new Date()
        setNow(date)
        const positions = attachRecords(calculateAllSatellitePositions(date))
        setSatellites(positions)
        const currentSelectedId = selectedIdRef.current
        const updatedSelection = currentSelectedId !== null
          ? positions.find((sat) => sat.id === currentSelectedId) ?? null
          : null
        setSelectedSatellite(updatedSelection)
        latestSelectedPositionRef.current = updatedSelection
        if (!updatedSelection) setSelectedId(null)
      } finally {
        if (!isCancelled) setIsInitializing(false)
      }
    }

    initializeGlobeData()
    return () => {
      isCancelled = true
    }
  }, [refreshAllSatellites])

  const clearSelectedSatellite = useCallback(() => {
    setSelectedId(null)
    selectedIdRef.current = null
    setSelectedSatellite(null)
    latestSelectedPositionRef.current = null
    setComputedTracks(null)
    setTrackDisplayMode('ground')
    setNextPassDate(null)
    setLastPassSatId(null)
  }, [])

  const handleSelectSatellite = useCallback((satellite: SatellitePosition) => {
    // Immediately update selection
    selectedIdRef.current = satellite.id
    setSelectedId(satellite.id)
    setSelectedSatellite(satellite)
    latestSelectedPositionRef.current = satellite
    setTrackDisplayMode('ground')

    // Instantly hide any old tracks by clearing computedTracks
    setComputedTracks({ orbitPast: [], orbitFuture: [], groundPast: [], groundFuture: [] })

    // Synchronously compute new tracks now and set them so lines update immediately
    const nowMs = Date.now()
    const tracks = calculateTracksForSatellite(satellite, nowMs)
    setComputedTracks(tracks)
    lastTracksForIdRef.current = satellite.id
    lastTracksTimeRef.current = nowMs

    const globeSatellite = satellite as GlobeSatellite
    const propagated = globeSatellite.satrec ? propagateGlobeSatellite(globeSatellite, new Date()) : null
    if (!propagated) return

    const satVec = latLngToVector3(propagated.latitude, propagated.longitude, EARTH_RADIUS + 0.05)
    const dir = satVec.clone().normalize()
    const targetCamPos = dir.multiplyScalar(Math.max(cameraDistanceRef.current, EARTH_RADIUS * 2.5))

    cameraTargetRef.current = {
      position: targetCamPos,
      lookAt: new THREE.Vector3(0, 0, 0)
    }
    isAnimatingRef.current = true
  }, [])

  const handleSelectedFrame = useCallback((satellite: SatellitePosition) => {
    if (selectedIdRef.current !== satellite.id) return
    latestSelectedPositionRef.current = satellite
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const date = new Date()
      setNow(date)

      const latestSelectedPosition = latestSelectedPositionRef.current
      if (latestSelectedPosition) {
        setSelectedSatellite(latestSelectedPosition)
        return
      }

      const targetId = selectedIdRef.current
      if (!targetId) return

      const updated = calculateSatellitePosition(targetId, date)
      if (updated) setSelectedSatellite(updated)
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!onSearchSubmit) return
    const unsubscribe = onSearchSubmit((query: string) => {
      if (!query) return
      const lower = query.trim().toLowerCase()
      const matches = satellites.filter((sat) => sat.name.toLowerCase().includes(lower) || sat.type.toLowerCase().includes(lower))
      if (matches[0]) handleSelectSatellite(matches[0])
    })
    return () => unsubscribe()
  }, [onSearchSubmit, satellites, handleSelectSatellite])

  useEffect(() => {
    if (!onSatelliteSelect) return
    const unsubscribe = onSatelliteSelect((satellite: SatellitePosition) => {
      if (!satellite) return
      const fullSatellite = satellites.find((sat) => sat.id === satellite.id)
      if (fullSatellite) handleSelectSatellite(fullSatellite)
    })
    return () => unsubscribe()
  }, [onSatelliteSelect, satellites, handleSelectSatellite])

  return (
    <main className="relative h-[calc(100vh-3.5rem)] overflow-hidden bg-[#0a0a0a] font-mono text-green-400 scanlines">
      <Canvas
        camera={{ position: [0, 2.8, 8.5], fov: 48, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false }}
        className="h-full w-full"
        onPointerMissed={clearSelectedSatellite}
      >
        <color attach="background" args={['#020402']} />
        <ambientLight intensity={0.28} />
        <hemisphereLight args={['#b7eaff', '#052414', 0.5]} />
        <directionalLight position={[5, 3, 5]} intensity={1.45} color="#ffffff" />
        <pointLight position={[-4, -2, -4]} intensity={0.45} color="#00ff41" />
        <StarField />
        <Earth />
        <CameraAnimator
          cameraTargetRef={cameraTargetRef}
          isAnimatingRef={isAnimatingRef}
          orbitControlsRef={orbitControlsRef}
        />
        <CameraDistanceTracker cameraDistanceRef={cameraDistanceRef} />
        <CountryBorders />
        {trackDisplayMode === 'ground' ? (
          <SelectedTracks selectedSatellite={selectedSatellite} now={now} externalTracks={computedTracks} />
        ) : (
          <SelectedOrbitRing selectedSatellite={selectedSatellite} />
        )}
        {trackDisplayMode === 'ground' && issOrbitSegments.length > 0 && (
          <DynamicLineSegments segments={issOrbitSegments} color="#ffd86b" opacity={0.4} />
        )}
        <SatelliteSprites
          satellites={satellites}
          selectedId={selectedId}
          onSelect={handleSelectSatellite}
          onSelectedFrame={handleSelectedFrame}
          highlightedIds={highlightedIds}
        />
        <ScreenshotRegistrar register={registerCanvas} />
        {/* No HTML labels on the globe per spec */}
        <OrbitControls
          ref={orbitControlsRef}
          enablePan={false}
          minDistance={3.2}
          maxDistance={17}
          autoRotate
          autoRotateSpeed={0.12}
        />
      </Canvas>

      <div className="absolute left-3 top-3 rounded border border-green-500/40 bg-black/85 px-3 py-2 text-xs shadow-[0_0_18px_rgba(0,255,65,0.16)] sm:left-4 sm:top-4">
        <div className="flex items-center gap-2 font-black tracking-wider text-green-200">
          <SatelliteIcon className="h-4 w-4" />
          ISRO 3D ORBITAL VIEW
        </div>
        <div className="mt-1 flex items-center gap-2 text-green-600">
          <span className="font-bold">UTC</span>
          <span className="font-mono text-green-200">{now.toISOString().slice(11, 19)}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-green-700">
          <Database className="h-3 w-3" />
          {isInitializing ? 'SYNCING ORBITAL DATA' : `${dataSource.toUpperCase()} DATA / ${satellites.length} OBJECTS`}
        </div>
      </div>

      {/* Screenshot is now handled by NavBar via UIContext */}

      {/* Search moved to NavBar */}

      <div className="absolute right-3 bottom-3 z-20 sm:right-4 sm:bottom-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsLegendOpen((v: boolean) => !v)}
            className="flex items-center gap-2 rounded border border-green-900/60 bg-black/80 px-3 py-2 text-xs font-black text-green-200"
          >
            ◉ LEGEND
          </button>
          {isLegendOpen && (
            <div className="absolute -top-44 right-0 w-52 rounded border border-green-500/40 bg-black/85 p-3 text-xs text-green-200 shadow-[0_0_18px_rgba(0,255,65,0.12)]">
              {[
                ['EARTH OBSERVATION', 'bg-[#00ff41] shadow-[0_0_10px_#00ff41]'],
                ['NAVIGATION', 'bg-[#00ffff] shadow-[0_0_10px_#00ffff]'],
                ['COMMUNICATION', 'bg-[#ffff00] shadow-[0_0_10px_#ffff00]'],
                ['METEOROLOGICAL', 'bg-[#ff8800] shadow-[0_0_10px_#ff8800]'],
                ['EXPERIMENTAL', 'bg-[#aa00ff] shadow-[0_0_10px_#aa00ff]'],
                ['RADAR IMAGING', 'bg-[#ff4444] shadow-[0_0_10px_#ff4444]']
              ].map(([label, classes]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`${classes} h-2.5 w-2.5 rounded-full`} />
                  <span className="text-[11px] uppercase text-green-200">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedSatellite && (
        <aside className="terminal-panel absolute bottom-3 left-3 right-3 max-w-md bg-black/90 p-4 text-sm shadow-[0_0_28px_rgba(0,255,65,0.20)] sm:bottom-4 sm:left-4 sm:right-auto">
          <div className="mb-3 flex items-start justify-between gap-3 border-b border-green-900/70 pb-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black text-green-200 glow-green">{selectedSatellite.name}</h1>
              <p className="mt-1 text-xs uppercase tracking-wider text-green-700">{selectedSatellite.type}</p>
            </div>
            <StatusBadge status={selectedSatellite.status} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-green-900/50 bg-black/35 p-2">
              <div className="text-green-700">LATITUDE</div>
              <div className="mt-1 font-bold text-green-300">{selectedSatellite.latitude.toFixed(4)} deg</div>
            </div>
            <div className="rounded border border-green-900/50 bg-black/35 p-2">
              <div className="text-green-700">LONGITUDE</div>
              <div className="mt-1 font-bold text-green-300">{selectedSatellite.longitude.toFixed(4)} deg</div>
            </div>
            <div className="rounded border border-green-900/50 bg-black/35 p-2">
              <div className="flex items-center gap-1 text-green-700">
                <Zap className="h-3 w-3" />
                ALTITUDE
              </div>
              <div className="mt-1 font-bold text-green-300">{Math.round(selectedSatellite.altitude).toLocaleString()} km</div>
            </div>
            <div className="rounded border border-green-900/50 bg-black/35 p-2">
              <div className="flex items-center gap-1 text-green-700">
                <Activity className="h-3 w-3" />
                VELOCITY
              </div>
              <div className="mt-1 font-bold text-green-300">{selectedSatellite.velocity.toFixed(2)} km/s</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1 rounded border border-green-900/50 bg-black/35 p-1 text-xs">
            <button
              type="button"
              onClick={() => setTrackDisplayMode('ground')}
              className={`flex min-h-9 items-center justify-center gap-2 rounded border px-2 font-black uppercase transition ${
                trackDisplayMode === 'ground'
                  ? 'border-green-400/70 bg-green-400/15 text-green-200 shadow-[0_0_12px_rgba(0,255,65,0.16)]'
                  : 'border-transparent text-green-700 hover:border-green-900/80 hover:text-green-300'
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>GROUND TRACK</span>
            </button>
            <button
              type="button"
              onClick={() => setTrackDisplayMode('orbit')}
              className={`flex min-h-9 items-center justify-center gap-2 rounded border px-2 font-black uppercase transition ${
                trackDisplayMode === 'orbit'
                  ? 'border-cyan-300/70 bg-cyan-300/15 text-cyan-100 shadow-[0_0_12px_rgba(0,255,255,0.16)]'
                  : 'border-transparent text-green-700 hover:border-green-900/80 hover:text-cyan-200'
              }`}
            >
              <CircleDot className="h-3.5 w-3.5" />
              <span>ORBIT RING</span>
            </button>
          </div>
          {nextPassDate && (
            <div className="mt-3 rounded border border-green-900/50 bg-black/35 px-3 py-2 text-xs text-green-200">
              <span className="font-bold">🛰 NEXT PASS OVER INDIA: {formatDuration(Math.max(0, Math.floor((nextPassDate.getTime() - now.getTime()) / 1000)))}</span>
            </div>
          )}
        </aside>
      )}
    </main>
  )
}
