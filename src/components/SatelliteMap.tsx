import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface SatellitePosition {
  id: number
  name: string
  type: string
  noradId: number
  status: string
  latitude: number
  longitude: number
  altitude: number
  velocity: number
  signalStrength?: number
  lastUpdate?: Date
}

interface SatelliteMapProps {
  satellites: SatellitePosition[]
  selectedSatellite: SatellitePosition | null
  onSelectSatellite: (sat: SatellitePosition) => void
}

// Custom satellite icon
const createSatelliteIcon = (status: string, isSelected: boolean) => {
  const color = status === 'active' ? '#00ff41' : status === 'maintenance' ? '#ffea00' : '#ff0040'
  const size = isSelected ? 20 : 14
  
  return L.divIcon({
    className: 'satellite-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 2px solid ${isSelected ? '#fff' : color};
        border-radius: 50%;
        box-shadow: 0 0 ${isSelected ? '15px' : '8px'} ${color}, 0 0 ${isSelected ? '30px' : '15px'} ${color}40;
        animation: ${isSelected ? 'pulse 1.5s infinite' : 'none'};
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// Component to handle map view updates
function MapController({ selectedSatellite }: { selectedSatellite: SatellitePosition | null }) {
  const map = useMap()
  
  useEffect(() => {
    if (selectedSatellite) {
      map.flyTo([selectedSatellite.latitude, selectedSatellite.longitude], 4, {
        duration: 1.5
      })
    }
  }, [selectedSatellite, map])
  
  return null
}

// Generate orbit path (simplified great circle approximation)
function generateOrbitPath(lat: number, lng: number, _altitude: number): [number, number][] {
  const points: [number, number][] = []
  const orbitInclination = Math.abs(lat) < 10 ? 0 : Math.min(Math.abs(lat) + 20, 90)
  
  for (let i = 0; i <= 360; i += 5) {
    const angle = (i * Math.PI) / 180
    const orbitLat = orbitInclination * Math.sin(angle)
    const orbitLng = (lng + i) % 360 - 180
    points.push([orbitLat, orbitLng])
  }
  
  return points
}

export default function SatelliteMap({ satellites, selectedSatellite, onSelectSatellite }: SatelliteMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  
  // Generate orbit path for selected satellite
  const orbitPath = selectedSatellite 
    ? generateOrbitPath(selectedSatellite.latitude, selectedSatellite.longitude, selectedSatellite.altitude)
    : []

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-green-900/50">
      {/* Map Legend */}
      <div className="absolute top-2 right-2 z-[1000] bg-black/80 p-3 rounded border border-green-900/50 text-xs">
        <div className="text-green-400 font-bold mb-2">SATELLITE STATUS</div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_8px_#00ff41]"></span>
          <span className="text-green-400">Active</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_8px_#ffea00]"></span>
          <span className="text-yellow-400">Maintenance</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-400 shadow-[0_0_8px_#ff0040]"></span>
          <span className="text-red-400">Critical</span>
        </div>
      </div>

      {/* Satellite Count */}
      <div className="absolute top-2 left-2 z-[1000] bg-black/80 px-3 py-2 rounded border border-green-900/50">
        <span className="text-green-400 text-xs font-bold">
          {satellites.length} SATELLITES TRACKED
        </span>
      </div>

      <MapContainer
        center={[20.5937, 78.9629]} // Center on India
        zoom={2}
        style={{ height: '100%', width: '100%', background: '#0a0a0f' }}
        ref={mapRef}
        worldCopyJump={true}
        minZoom={2}
        maxZoom={10}
      >
        {/* Dark theme map tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Map controller for animations */}
        <MapController selectedSatellite={selectedSatellite} />

        {/* Orbit path for selected satellite */}
        {selectedSatellite && orbitPath.length > 0 && (
          <Polyline
            positions={orbitPath}
            pathOptions={{
              color: '#00ff41',
              weight: 1,
              opacity: 0.4,
              dashArray: '5, 10'
            }}
          />
        )}

        {/* Satellite markers */}
        {satellites.map((sat) => (
          <Marker
            key={sat.id}
            position={[sat.latitude, sat.longitude]}
            icon={createSatelliteIcon(sat.status, selectedSatellite?.id === sat.id)}
            eventHandlers={{
              click: () => onSelectSatellite(sat)
            }}
          >
            <Popup className="satellite-popup">
              <div className="bg-black/90 text-green-400 p-2 rounded min-w-[200px]">
                <div className="font-bold text-sm mb-2 border-b border-green-900/50 pb-1">
                  🛰️ {sat.name}
                </div>
                <div className="text-xs space-y-1">
                  <div><span className="text-green-600">Type:</span> {sat.type}</div>
                  <div><span className="text-green-600">NORAD:</span> {sat.noradId}</div>
                  <div><span className="text-green-600">Lat:</span> {sat.latitude.toFixed(4)}°</div>
                  <div><span className="text-green-600">Lng:</span> {sat.longitude.toFixed(4)}°</div>
                  <div><span className="text-green-600">Alt:</span> {sat.altitude.toLocaleString()} km</div>
                  <div><span className="text-green-600">Vel:</span> {sat.velocity} km/s</div>
                  <div className="pt-1 border-t border-green-900/50 mt-1">
                    <span className={`uppercase font-bold ${
                      sat.status === 'active' ? 'text-green-400' :
                      sat.status === 'maintenance' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      ● {sat.status}
                    </span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Ground Track Info */}
      {selectedSatellite && (
        <div className="absolute bottom-2 left-2 z-[1000] bg-black/80 px-3 py-2 rounded border border-green-900/50 text-xs">
          <span className="text-green-600">TRACKING: </span>
          <span className="text-green-400 font-bold">{selectedSatellite.name}</span>
          <span className="text-green-600 ml-2">| ALT: </span>
          <span className="text-green-400">{selectedSatellite.altitude.toLocaleString()} km</span>
        </div>
      )}

      {/* CSS for custom styling */}
      <style>{`
        .leaflet-container {
          background: #0a0a0f !important;
          font-family: 'JetBrains Mono', monospace;
        }
        .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
        }
        .leaflet-popup-tip {
          background: rgba(0, 0, 0, 0.9) !important;
        }
        .satellite-marker {
          background: transparent !important;
          border: none !important;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
        .leaflet-control-zoom a {
          background: rgba(0, 0, 0, 0.8) !important;
          color: #00ff41 !important;
          border-color: #00ff4130 !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(0, 255, 65, 0.2) !important;
        }
        .leaflet-control-attribution {
          background: rgba(0, 0, 0, 0.6) !important;
          color: #00ff4180 !important;
        }
        .leaflet-control-attribution a {
          color: #00ff41 !important;
        }
      `}</style>
    </div>
  )
}
