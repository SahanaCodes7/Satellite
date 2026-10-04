export interface AdityaL1Data {
  distanceFromEarth: number
  distanceAU: number
  velocityKmS: number
  distanceChangeKmPerHour: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  lastUpdated: Date
  status: 'ACTIVE'
  isRealData: boolean
}

interface AdityaL1Cache {
  data: AdityaL1Data
  timestamp: number
}

const CACHE_DURATION = 5 * 60 * 1000
const AU_IN_KM = 149597870.7
const HORIZONS_BASE_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api?'

let cache: AdityaL1Cache | null = null

function fallbackData(lastUpdated: Date): AdityaL1Data {
  return {
    x: 1502000,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0.387,
    vz: 0,
    distanceFromEarth: 1502347,
    distanceAU: 0.01004,
    velocityKmS: 0.387,
    distanceChangeKmPerHour: 0,
    lastUpdated,
    status: 'ACTIVE',
    isRealData: false
  }
}

function formatHorizonsTime(date: Date) {
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

function buildUrl(base: string, startDate: Date) {
  const stopDate = new Date(startDate.getTime() + 60000)

  return base +
    'format=json' +
    "&COMMAND='-152'" +
    "&OBJ_DATA='NO'" +
    "&MAKE_EPHEM='YES'" +
    "&EPHEM_TYPE='VECTORS'" +
    "&CENTER='500@399'" +
    `&START_TIME='${formatHorizonsTime(startDate)}'` +
    `&STOP_TIME='${formatHorizonsTime(stopDate)}'` +
    "&STEP_SIZE='1m'" +
    "&VEC_TABLE='2'" +
    "&OUT_UNITS='KM-S'" +
    "&CSV_FORMAT='YES'"
}

function buildUrls(startDate: Date) {
  const directUrl = buildUrl(HORIZONS_BASE_URL, startDate)

  return [
    directUrl,
    `https://corsproxy.io/?${encodeURIComponent(directUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`
  ]
}

async function readHorizonsResult(response: Response) {
  const text = await response.text()

  try {
    const json = JSON.parse(text) as { result?: string }
    return json.result ?? text
  } catch {
    return text
  }
}

function parseHorizonsResult(result: string, lastUpdated: Date): AdityaL1Data | null {
  const soeIndex = result.indexOf('$$SOE')
  const eoeIndex = result.indexOf('$$EOE')
  if (soeIndex === -1 || eoeIndex === -1 || eoeIndex <= soeIndex) return null

  const dataSection = result.slice(soeIndex + 5, eoeIndex).trim()
  const lines = dataSection
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const dataLine = lines.find((line) => line.includes(',') && !line.includes('JDTDB'))
  if (!dataLine) return null

  const values = dataLine.split(',').map((value) => parseFloat(value.trim()))
  const nums = values.filter((value) => !Number.isNaN(value))
  if (nums.length < 7) return null

  const x = nums[1]
  const y = nums[2]
  const z = nums[3]
  const vx = nums[4]
  const vy = nums[5]
  const vz = nums[6]

  if (![x, y, z, vx, vy, vz].every(Number.isFinite)) return null

  const distanceFromEarth = Math.sqrt(x * x + y * y + z * z)
  if (distanceFromEarth < 1000000 || distanceFromEarth > 2000000) return null

  return {
    x,
    y,
    z,
    vx,
    vy,
    vz,
    distanceFromEarth,
    distanceAU: distanceFromEarth / AU_IN_KM,
    velocityKmS: Math.sqrt(vx * vx + vy * vy + vz * vz),
    distanceChangeKmPerHour: 0,
    lastUpdated,
    status: 'ACTIVE',
    isRealData: true
  }
}

async function fetchAtTime(date: Date): Promise<AdityaL1Data | null> {
  for (const url of buildUrls(date)) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000)
      })
      if (!response.ok) continue

      const result = await readHorizonsResult(response)
      const data = parseHorizonsResult(result, date)
      if (data) return data
    } catch {
      continue
    }
  }

  return null
}

export async function fetchAdityaL1Position(): Promise<AdityaL1Data> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data
  }

  const now = new Date()
  const oneHourLater = new Date(now.getTime() + 3600000)

  const [pos1, pos2] = await Promise.all([
    fetchAtTime(now),
    fetchAtTime(oneHourLater)
  ])

  if (pos1 && pos2) {
    const data = {
      ...pos1,
      distanceChangeKmPerHour: pos2.distanceFromEarth - pos1.distanceFromEarth,
      lastUpdated: now,
      isRealData: true
    }
    cache = { data, timestamp: Date.now() }
    return data
  }

  const fallback = fallbackData(now)
  cache = { data: fallback, timestamp: Date.now() }
  return fallback
}

export function clearAdityaL1Cache() {
  cache = null
}
