import { useState, useEffect } from 'react'

export default function TestApp() {
  const [status, setStatus] = useState('Starting...')
  const [count, setCount] = useState(0)
  const [tleCount, setTleCount] = useState(0)
  
  useEffect(() => {
    const run = async () => {
      try {
        setStatus('Importing module...')
        
        // Dynamic import to catch any load errors
        const tracker = await import('./lib/satelliteTracker')
        
        setStatus('Checking TLE data...')
        const tleKeys = Object.keys(tracker.SATELLITE_TLE_DATA)
        setTleCount(tleKeys.length)
        setStatus(`TLE data has ${tleKeys.length} entries`)
        
        setStatus('Initializing sat records...')
        tracker.initializeSatelliteRecords()
        
        setStatus('Calculating positions...')
        const positions = await tracker.calculateAllSatellitePositions(new Date())
        setCount(positions.length)
        setStatus(`SUCCESS! Found ${positions.length} satellites!`)
      } catch (err) {
        console.error('Test app error:', err)
        setStatus(`ERROR: ${String(err)}`)
      }
    }
    run()
  }, [])
  
  return (
    <div style={{ 
      backgroundColor: '#0a0a0f', 
      color: '#00ff41', 
      minHeight: '100vh', 
      padding: '20px',
      fontFamily: 'monospace'
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>SATELLITE TRACKER TEST</h1>
      <p style={{ fontSize: '16px', marginBottom: '10px' }}>Status: {status}</p>
      <p style={{ fontSize: '16px', marginBottom: '10px' }}>Satellite positions: {count}</p>
      <p style={{ fontSize: '16px', marginBottom: '10px' }}>TLE data entries: {tleCount}</p>
    </div>
  )
}
