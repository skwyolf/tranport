
import { GeoLocation } from '../types';

// Simple in-memory cache to avoid hammering the API during a session
const geoCache: Record<string, GeoLocation | null> = {};

/**
 * Geocodes an address using OpenStreetMap Nominatim API.
 * Note: In production, you should use a paid service or your own instance for high volume.
 */
export const geocodeAddress = async (address: string): Promise<GeoLocation | null> => {
  if (!address) return null;
  
  // Check cache
  if (geoCache[address]) {
    return geoCache[address];
  }

  const fetchWithRetry = async (useProxy: boolean) => {
    const endpoint = 'https://nominatim.openstreetmap.org/search';
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
      countrycodes: 'pl', // Focus on Poland per requirements
      addressdetails: '1'
    });

    let url = `${endpoint}?${params.toString()}`;
    if (useProxy) {
        url = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    }

    // We do NOT set User-Agent here because browsers often block setting it in fetch,
    // and it triggers complex CORS preflight requests that might fail.
    // Nominatim will use the browser's Referer header.
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP status ${response.status}`);
    }
    return await response.json();
  };

  try {
    // Rate limit delay: Ensure we don't hit the API faster than 1 req/sec
    // This delay happens BEFORE the request.
    await new Promise(resolve => setTimeout(resolve, 1100));

    let data;
    try {
        // First attempt: Direct
        data = await fetchWithRetry(false);
    } catch (directError) {
        console.warn(`Direct geocoding failed for "${address}", retrying with proxy...`, directError);
        // Second attempt: Via Proxy
        await new Promise(resolve => setTimeout(resolve, 500));
        data = await fetchWithRetry(true);
    }

    if (data && data.length > 0) {
      const result: GeoLocation = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
      geoCache[address] = result;
      return result;
    }
  } catch (error) {
    console.error("Geocoding error for address:", address, error);
  }

  return null;
};
