import { GeoLocation } from '../types';

// Simple in-memory cache to avoid hammering the API during a session
const geoCache: Record<string, GeoLocation | null> = {};

/**
 * Geocodes an address using proxied OpenStreetMap Nominatim API via Netlify.
 */
export const geocodeAddress = async (address: string): Promise<GeoLocation | null> => {
  if (!address) return null;
  
  const trimmedAddress = address.trim();
  if (geoCache[trimmedAddress]) {
    return geoCache[trimmedAddress];
  }

  const fetchWithProxy = async () => {
    const params = new URLSearchParams({
      q: trimmedAddress,
      format: 'json',
      limit: '1',
      countrycodes: 'pl',
      addressdetails: '1'
    });

    // Używamy proxy /geo skonfigurowanego w _redirects
    const isNetlify = typeof window !== 'undefined' && (window.location.hostname.includes('netlify.app') || window.location.hostname !== 'localhost');
    const url = isNetlify 
      ? `/geo/search?${params.toString()}`
      : `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP status ${response.status}`);
    }
    return await response.json();
  };

  try {
    // Nominatim rate limit safety - wait at least 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1100));

    const data = await fetchWithProxy();

    if (data && data.length > 0) {
      const result: GeoLocation = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
      geoCache[trimmedAddress] = result;
      return result;
    }
  } catch (error) {
    console.error("Geocoding error for address:", trimmedAddress, error);
  }

  return null;
};