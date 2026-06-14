
# 🛰️ SatTrack3D — ISRO Satellite Tracker

<div align="center">

[![React 18](https://img.shields.io/badge/React-18.0%2B-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5.0%2B-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Three.js](https://img.shields.io/badge/Three.js-r140%2B-000000?style=flat-square&logo=three.js&logoColor=white)](https://threejs.org)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9%2B-31A049?style=flat-square&logo=leaflet&logoColor=white)](https://leafletjs.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

</div>

---

## 🚀 Live Demo

🔗 **[https://studentofstars.github.io/Satellite/](https://studentofstars.github.io/Satellite/)**

> 📹 **Demo Video**
>
> https://github.com/studentofstars/Satellite/assets/demo.mp4
>
> *(Screen recording embedded above — GitHub renders .mp4 files natively
>   when uploaded via GitHub web interface to the repository assets)*

> 💡 **To add your recording**: Go to your GitHub repo → Issues →
> drag and drop your .mp4 file → copy the generated link →
> replace the video URL above with your link

---

## 📡 About

**SatTrack3D** is a real-time satellite tracking platform that monitors 85 ISRO satellites with live SGP4 orbital propagation. Built with a hacker/terminal aesthetic inspired by eDEX-UI, this collaborative project by two students delivers both 2D map and 3D interactive globe views for complete orbital awareness. Track live satellite positions, predict passes over your location, and explore space from your browser.

---

## 🚀 What Makes This Special

| Feature | Details |
|---------|---------|
| 🛰️ Satellites Tracked | 85 ISRO satellites + Aditya-L1 |
| 🌍 Views | Interactive 2D Map + 3D Globe |
| ⚡ Propagation | Real-time SGP4 orbital mechanics |
| ☀️ Deep Space | NASA JPL HORIZONS for Aditya-L1 |
| 📡 Sky Passes | GPS-based pass predictions |
| 🎨 UI Style | Hacker/terminal aesthetic (eDEX-UI inspired) |
| 🔍 Search | Live satellite name + mission type filter |
| 📸 Screenshot | One-click globe image capture |

---

## ✨ Features

### 🗺️ 2D Map View

- Real-time tracking of 85 ISRO satellites on a world map
- Live satellite movement with ground track paths
- Click any satellite to see details (latitude, longitude, altitude, velocity, status)
- Color-coded satellites by mission type
- Satellite status indicators (Active, Maintenance, Critical, Inactive)
- Special Aditya-L1 solar observatory tracking via NASA JPL HORIZONS API

### 🌍 3D Globe View

- Interactive 3D Earth with real satellite texture
- All 85 satellites rendered as glowing colored dots (correctly hidden behind globe)
- Live SGP4 orbital propagation — satellites move in real-time
- Click satellite → auto-zoom camera to that satellite
- Satellite icon replaces dot for selected satellite (with pulsing animation)
- **Ground Track mode**: past 20 min (orange) + future 40 min (cyan) path on Earth surface
- **Orbit Ring mode**: full 3D orbital trajectory floating in space at correct altitude
- Toggle between Ground Track and Orbit Ring in info panel
- Aditya-L1 symbolic gold marker showing direction to Sun-Earth L1 point

### 🧭 Navigation & UI

- Home / 2D Map / 3D Globe buttons in navbar
- Search satellite by name or mission type (filters all 85 live)
- Screenshot button — captures and downloads globe image
- UTC live clock in top-left panel
- Mission type color legend (toggleable)

### 🌅 Sky Passes

- "Sky Passes" button in navbar
- Uses your real GPS location (or defaults to New Delhi)
- Shows next 6 satellites passing over your location in next 2 hours
- Live countdown timers for each pass
- Click satellite name → selects and zooms on globe
- Works on both 2D and 3D views

### 📊 Satellite Info Panel

- Name, mission type, status badge
- Live latitude, longitude, altitude, velocity
- Next pass over India countdown timer

### ☀️ Aditya-L1 Special Tracking

- India's solar observatory tracked separately via **NASA JPL HORIZONS API**
- Real position data: distance from Earth, velocity, distance in AU
- Distance change tracking (moving toward/away from Earth)
- Auto-refreshes every 5 minutes with countdown timer
- Gold/yellow theme to distinguish from Earth-orbiting satellites
- Explains why it cannot be shown on standard Earth map
- Available in both 2D sidebar and 3D globe as symbolic marker

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| Frontend Framework | React 18 + TypeScript |
| Build Tool | Vite |
| 3D Graphics | Three.js + React Three Fiber |
| 2D Maps | Leaflet + React Leaflet |
| Orbital Mechanics | satellite.js (SGP4 propagation) |
| Deep Space Tracking | NASA JPL HORIZONS API |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Icons | Lucide React |

---

## 📁 Project Structure

```
src/
├── components/
│   ├── Globe3D.tsx           # 3D interactive globe with satellites
│   ├── NavBar.tsx            # Navigation + search + sky passes
│   └── SatelliteMap.tsx      # 2D Leaflet map view
├── contexts/
│   └── UIContext.tsx         # Global UI state management
├── hooks/
│   └── useSkyPasses.ts       # Sky passes calculation hook
├── lib/
│   └── satelliteTracker.ts   # Orbital calculations & utilities
├── services/
│   └── adityaL1Service.ts    # NASA JPL HORIZONS API for Aditya-L1
├── App.tsx                   # Routing and layout
├── main.tsx                  # Entry point
└── index.css                 # Global styles
```

---

## 🚀 Installation & Setup

### Prerequisites

- Node.js 18.0+ ([Download](https://nodejs.org/))
- npm 9.0+

### Quick Start

```bash
# Clone the repository
git clone https://github.com/studentofstars/Satellite
cd Satellite

# Install dependencies
npm install

# Run development server
npm run dev
# Open http://localhost:5173

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📖 How to Use

1. **Open the Application** — Visit the live link or run locally with `npm run dev`
2. **Choose Your View** — Click "2D MAP" for flat world map or "3D GLOBE" for interactive globe
3. **Explore Satellites** — In 3D globe, click any glowing satellite dot to see details and zoom in
4. **Search** — Use the search bar to find a specific satellite by name or mission type
5. **Check Sky Passes** — Click "SKY PASSES" to see what satellites are passing over your location now

---

## 🎨 Satellite Color Legend

| Color | Mission Type |
|-------|-------------|
| 🟢 Green | Earth Observation |
| 🔵 Cyan | Navigation |
| 🟡 Yellow | Communication |
| 🟠 Orange | Meteorological |
| 🟣 Purple | Experimental / Technology |
| 🔴 Red | Radar Imaging |
| 🟡 Gold | Solar Observatory (Aditya-L1) |

---

## 👥 Contributors

- Built with ❤️ for space enthusiasts
- [Mrutyunjaya Muduli](https://github.com/studentofstars)
- [Sahana L](https://github.com/SahanaCodes7)

---

## 📜 License

MIT License — See [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **satellite.js** — SGP4 orbital propagation engine
- **N2YO** — TLE data and satellite information
- **NASA JPL HORIZONS** — Real-time deep space trajectory data for Aditya-L1
- **Three.js & React Three Fiber** — 3D graphics community
- **Leaflet** — Web mapping library
- **eDEX-UI** — Design inspiration for hacker/terminal aesthetics
- **ISRO** — Making India proud in space exploration 🇮🇳

---
