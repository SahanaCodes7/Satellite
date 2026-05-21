# 🛰️ ISRO Satellite Tracker

A lightweight, hacker-themed satellite tracking system inspired by eDEX-UI, focused on monitoring Indian Space Research Organisation (ISRO) satellites in real-time.

## Demo Mode Notice

**Current Status: Running in Demo Mode**

The application currently uses simulated satellite data due to CORS (Cross-Origin Resource Sharing) restrictions when calling the N2YO API directly from the browser. This is a common limitation for client-side applications accessing third-party APIs.

### To Enable Real-Time Data:
1. Set up a backend proxy server (see instructions below)
2. Use Vite proxy configuration for development
3. Deploy with serverless functions (Vercel, Netlify)

## Features

- **Terminal-Style Interface**: Inspired by eDEX-UI with retro terminal aesthetics
- **Real-Time Tracking**: Live monitoring of 10 key ISRO satellites
- **Status Monitoring**: Active, Inactive, Critical, and Maintenance states
- **Signal Analysis**: Real-time signal strength and orbital data
- **Lightweight & Fast**: Streamlined for performance and focus

## Tracked Satellites

1. **CARTOSAT-2F** - Earth Observation
2. **IRNSS-1G** - Navigation
3. **ASTROSAT** - Space Observatory
4. **RESOURCESAT-2A** - Earth Observation
5. **INSAT-3DR** - Meteorological
6. **SCATSAT-1** - Earth Observation
7. **EMISAT** - Electronic Intelligence
8. **CHANDRAYAAN-2** - Lunar Mission
9. **GSAT-29** - Communication
10. **RISAT-2B** - Radar Imaging

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** - Fast build tool
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **eDEX-UI Inspired** - Terminal aesthetics

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd Satellite

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Setting Up Real-Time Data (Backend Proxy)

To enable real satellite tracking, you need to bypass CORS restrictions:

### Option 1: Express.js Proxy Server

Create a simple backend proxy:

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

const N2YO_API_KEY = 'your_api_key_here';
const N2YO_BASE_URL = 'https://api.n2yo.com/rest/v1/satellite';

app.get('/api/satellite/positions/:id/:lat/:lng/:alt/:seconds', async (req, res) => {
  try {
    const { id, lat, lng, alt, seconds } = req.params;
    const url = `${N2YO_BASE_URL}/positions/${id}/${lat}/${lng}/${alt}/${seconds}&apiKey=${N2YO_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Proxy server running on port 3001');
});
```

### Option 2: Vite Proxy (Development)

Add to `vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://api.n2yo.com/rest/v1/satellite',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  }
});
```

Then update the API base URL in `src/utils/n2yo-api.ts` to use your proxy endpoint.

## Design Philosophy

Inspired by the cyberpunk aesthetics of eDEX-UI, this satellite tracker features:

- **Monospace Terminal Font** - Authentic hacker feel
- **Green-on-Black Theme** - Classic terminal colors
- **Real-Time Animations** - Scanning effects and live updates
- **Minimalist Interface** - Focus on essential satellite data
- **CRT-Style Effects** - Retro computer terminal vibes

## Usage

1. **Search Satellites**: Use the terminal-style search to filter satellites
2. **Track Status**: Monitor real-time satellite health and signals
3. **View Details**: Click on any satellite for detailed orbital information
4. **System Controls**: Start/stop tracking with terminal commands

## Satellite Data

Each satellite displays:
- **Real-time coordinates** (Latitude/Longitude)
- **Orbital altitude** and velocity
- **Signal strength** with visual bars
- **System status** (Active/Inactive/Critical/Maintenance)
- **Mission type** and launch date

## Status Indicators

- 🟢 **ACTIVE** - Operational and transmitting
- 🟡 **MAINTENANCE** - Scheduled maintenance mode
- 🔴 **CRITICAL** - Requires immediate attention
- ⚫ **INACTIVE** - Not currently operational

## 🎯 Future Enhancements

- Real API integration with N2YO
- Orbital prediction algorithms
- Ground station pass predictions
- Radio frequency data
- 3D orbital visualization

---

**Built with ❤️ for satellite enthusiasts and space nerds** 🚀

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **3D Graphics**: Three.js with React Three Fiber
- **Maps**: Leaflet with React Leaflet
- **Styling**: Tailwind CSS with custom animations
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **API**: N2YO Satellite API
- **Date Handling**: date-fns

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd satellite
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your N2YO API key
   ```

4. **Get N2YO API Key**
   - Visit [N2YO API](https://www.n2yo.com/api/)
   - Register for a free account
   - Generate your API key from your profile page
   - Add it to your `.env` file

5. **Start development server**
   ```bash
   npm run dev
   ```

## Deployment

### Build for production
```bash
npm run build
```

### Preview production build
```bash
npm run preview
```

## Mobile Support

The application is fully responsive and optimized for mobile devices:
- Touch-friendly interface
- Optimized layouts for small screens
- Progressive Web App features
- Efficient 3D rendering for mobile GPUs

## API Integration

### N2YO API Endpoints Used:
- **TLE Data**: Get Two Line Elements for satellites
- **Positions**: Real-time satellite coordinates
- **Visual Passes**: Optical visibility predictions
- **Radio Passes**: Communication window predictions
- **Above**: Satellites currently overhead

### Rate Limits:
- TLE: 1000 requests/hour
- Positions: 1000 requests/hour
- Visual Passes: 100 requests/hour
- Radio Passes: 100 requests/hour
- Above: 100 requests/hour

## Popular Satellites

The app includes tracking for popular satellites:
- International Space Station (ISS)
- Hubble Space Telescope
- Starlink constellation
- Weather satellites (NOAA, GOES)
- GPS satellites
- And many more...

## Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure
```
src/
├── components/
│   ├── Background3D.tsx      # 3D background effects
│   ├── SatelliteTracker.tsx  # Main tracking interface
│   ├── PassPredictor.tsx     # Pass prediction tools
│   ├── RadioTools.tsx        # Ham radio utilities
│   ├── EducationHub.tsx      # Learning platform
│   └── DataAnalysis.tsx      # Statistics and charts
├── utils/
│   └── n2yo-api.ts          # API integration utilities
├── App.tsx                   # Main application component
├── main.tsx                  # Application entry point
└── index.css                 # Global styles
```

## Design Features

- **Glassmorphism UI**: Modern glass-like interface elements
- **Space Theme**: Dark gradient backgrounds with cosmic colors
- **Smooth Animations**: Framer Motion powered transitions
- **3D Elements**: Three.js visualizations and effects
- **Responsive Design**: Mobile-first approach
- **Accessibility**: WCAG compliant interface

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

WebGL support required for 3D features.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## Support

- Create an issue for bug reports
- Check existing issues before creating new ones
- Provide detailed information about your environment

## 🔗 Links

- [N2YO API Documentation](https://www.n2yo.com/api/)
- [Three.js Documentation](https://threejs.org/docs/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/)
- [Leaflet Documentation](https://leafletjs.com/reference.html)

## Acknowledgments

- N2YO.com for providing satellite tracking API
- Three.js community for 3D graphics capabilities
- React and Vite teams for excellent development tools
- All contributors and users of this project

---

**SatTrack3D** - Bringing space closer to everyone through technology and education. 🌌
