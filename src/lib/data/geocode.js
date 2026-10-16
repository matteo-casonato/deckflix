// @ts-check
// Position of the home city, for "Tornei vicino a te". One request to OpenStreetMap's free
// geocoder (Nominatim) when the city is saved; nothing else leaves the phone.

/**
 * @param {string} city
 * @param {string} country ISO code, e.g. "IT"
 * @returns {Promise<import('../domain/players.js').HomePlace | null>}
 */
export async function geocodeCity(city, country) {
  const params = new URLSearchParams({ city: city.trim(), country: country.trim(), format: 'json', limit: '1', 'accept-language': 'it' });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!res.ok) throw new Error(`Ricerca della città non riuscita (${res.status})`);
  const [hit] = await res.json();
  if (!hit) return null;
  return { name: String(hit.name ?? city).trim(), country: country.trim().toUpperCase(), lat: Number(hit.lat), lng: Number(hit.lon) };
}

/**
 * Position of the phone, without any external service (the browser asks for permission).
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Posizione non disponibile su questo browser'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error('Permesso per la posizione negato')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 3600_000 },
    );
  });
}
