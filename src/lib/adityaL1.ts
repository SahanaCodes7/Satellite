
export interface AdityaL1Data {
  source: string;
  target: string;
  ephemerisTime: string;
  fetchedAt: string;
  positionKm: {
    x: number;
    y: number;
    z: number;
  };
  velocityKmPerSecond: {
    vx: number;
    vy: number;
    vz: number;
  };
  distanceFromEarthKm: number;
}

const API_URL =
  "https://satellite-backend-bzz3.onrender.com/api/aditya-l1";

export async function fetchAdityaL1(): Promise<AdityaL1Data> {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(`Aditya-L1 API failed: ${response.status}`);
  }

  return response.json() as Promise<AdityaL1Data>;
}
