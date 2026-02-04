import { GeoLocation } from '../types';

const geoCache: Record<string, GeoLocation | null> = {};

/**
 * Geocodes an address using OpenStreetMap Nominatim API.
 * Zawsze używamy pełnego URL, aby uniknąć błędu 'Invalid URL'.
 */
export const geocodeAddress = async (address: string): Promise<GeoLocation | null> => {
  if (!address) return null;
  
  const trimmedAddress = address.trim();
  if (geoCache[trimmedAddress]) {
    return geoCache[trimmedAddress];
  }

  try {
    // Safety delay for Nominatim (wymagane przez TOS)
    await new Promise(resolve => setTimeout(resolve, 1100));

    const params = new URLSearchParams({
      q: trimmedAddress,
      format: 'json',
      limit: '1',
      countrycodes: 'pl',
      addressdetails: '1'
    });

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`Geocoding HTTP error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const result: GeoLocation = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
      geoCache[trimmedAddress] = result;
      return result;
    }
  } catch (error) {
    console.error("Geocoding exception for address:", trimmedAddress, error);
  }

  return null;
};