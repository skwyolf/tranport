import { GeoLocation } from '../types';

// Klucz cache v4 uwzględniający pełną obsługę klientów zagranicznych w Europie
const GEO_CACHE_STORAGE_KEY = 'lupus_geo_cache_v4';

const loadGeoCache = (): Record<string, GeoLocation | null> => {
  try {
    const raw = localStorage.getItem(GEO_CACHE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Błąd odczytu geo cache z localStorage:", e);
  }
  return {};
};

const geoCache: Record<string, GeoLocation | null> = loadGeoCache();

const saveGeoCache = () => {
  try {
    localStorage.setItem(GEO_CACHE_STORAGE_KEY, JSON.stringify(geoCache));
  } catch (e) {
    console.error("Błąd zapisu geo cache do localStorage:", e);
  }
};

/**
 * Baza sprawdzonych koordynatów dla krajów europejskich i kluczowych ośrodków rolniczych.
 * Zapewnia natychmiastowe umieszczenie punktu na mapie nawet przy braku połączenia z Nominatim
 * lub przy podaniu samej nazwy kraju/regionu przez dyspozytora.
 */
const EUROPE_KNOWN_LOCATIONS: Record<string, GeoLocation> = {
  // Słowacja (np. Klient LUKA KOMAR)
  'słowacja': { lat: 48.6690, lng: 19.6990 },
  'slovakia': { lat: 48.6690, lng: 19.6990 },
  'slovensko': { lat: 48.6690, lng: 19.6990 },
  'nitra': { lat: 48.3061, lng: 18.0764 },
  'bratislava': { lat: 48.1486, lng: 17.1077 },
  'komarno': { lat: 47.7636, lng: 18.1265 },
  'komárno': { lat: 47.7636, lng: 18.1265 },
  'nove zamky': { lat: 47.9854, lng: 18.1619 },
  'nové zámky': { lat: 47.9854, lng: 18.1619 },
  'trnava': { lat: 48.3775, lng: 17.5883 },
  'kosice': { lat: 48.7164, lng: 21.2611 },
  'košice': { lat: 48.7164, lng: 21.2611 },
  'zvolen': { lat: 48.5744, lng: 19.1532 },
  'banska bystrica': { lat: 48.7363, lng: 19.1462 },
  'banská bystrica': { lat: 48.7363, lng: 19.1462 },
  'lucenec': { lat: 48.3323, lng: 19.6671 },
  'lučenec': { lat: 48.3323, lng: 19.6671 },
  'levice': { lat: 48.2156, lng: 18.6071 },
  'dunajska streda': { lat: 47.9927, lng: 17.6121 },
  'dunajská streda': { lat: 47.9927, lng: 17.6121 },

  // Czechy
  'czechy': { lat: 49.8175, lng: 15.4730 },
  'czech republic': { lat: 49.8175, lng: 15.4730 },
  'cesko': { lat: 49.8175, lng: 15.4730 },
  'česko': { lat: 49.8175, lng: 15.4730 },
  'praha': { lat: 50.0755, lng: 14.4378 },
  'praga': { lat: 50.0755, lng: 14.4378 },
  'brno': { lat: 49.1951, lng: 16.6068 },
  'ostrava': { lat: 49.8209, lng: 18.2625 },
  'olomouc': { lat: 49.5938, lng: 17.2509 },
  'hradec kralove': { lat: 50.2104, lng: 15.8252 },

  // Niemcy
  'niemcy': { lat: 51.1657, lng: 10.4515 },
  'germany': { lat: 51.1657, lng: 10.4515 },
  'deutschland': { lat: 51.1657, lng: 10.4515 },
  'berlin': { lat: 52.5200, lng: 13.4050 },
  'dresden': { lat: 51.0504, lng: 13.7373 },
  'drezno': { lat: 51.0504, lng: 13.7373 },
  'leipzig': { lat: 51.3397, lng: 12.3731 },
  'lipsk': { lat: 51.3397, lng: 12.3731 },
  'frankfurt': { lat: 50.1109, lng: 8.6821 },
  'munchen': { lat: 48.1351, lng: 11.5820 },
  'monachium': { lat: 48.1351, lng: 11.5820 },

  // Litwa
  'litwa': { lat: 55.1694, lng: 23.8813 },
  'lithuania': { lat: 55.1694, lng: 23.8813 },
  'lietuva': { lat: 55.1694, lng: 23.8813 },
  'vilnius': { lat: 54.6872, lng: 25.2797 },
  'wilno': { lat: 54.6872, lng: 25.2797 },
  'kaunas': { lat: 54.8985, lng: 23.9036 },
  'kowno': { lat: 54.8985, lng: 23.9036 },
  'klaipeda': { lat: 55.7033, lng: 21.1443 },

  // Łotwa i Estonia
  'łotwa': { lat: 56.8796, lng: 24.6032 },
  'latvia': { lat: 56.8796, lng: 24.6032 },
  'riga': { lat: 56.9496, lng: 24.1052 },
  'ryga': { lat: 56.9496, lng: 24.1052 },
  'estonia': { lat: 58.5953, lng: 25.0136 },
  'tallinn': { lat: 59.4370, lng: 24.7536 },

  // Ukraina
  'ukraina': { lat: 48.3794, lng: 31.1656 },
  'ukraine': { lat: 48.3794, lng: 31.1656 },
  'lviv': { lat: 49.8397, lng: 24.0297 },
  'lwów': { lat: 49.8397, lng: 24.0297 },
  'kyiv': { lat: 50.4501, lng: 30.5234 },
  'kijów': { lat: 50.4501, lng: 30.5234 },
  'luck': { lat: 50.7472, lng: 25.3254 },
  'łuck': { lat: 50.7472, lng: 25.3254 },

  // Węgry
  'węgry': { lat: 47.1625, lng: 19.5033 },
  'hungary': { lat: 47.1625, lng: 19.5033 },
  'magyarorszag': { lat: 47.1625, lng: 19.5033 },
  'budapest': { lat: 47.4979, lng: 19.0402 },
  'budapeszt': { lat: 47.4979, lng: 19.0402 },
  'debrecen': { lat: 47.5316, lng: 21.6273 },

  // Rumunia
  'rumunia': { lat: 45.9432, lng: 24.9668 },
  'romania': { lat: 45.9432, lng: 24.9668 },
  'bucuresti': { lat: 44.4268, lng: 26.1025 },
  'bukareszt': { lat: 44.4268, lng: 26.1025 },
  'cluj': { lat: 46.7712, lng: 23.6236 },
  'timisoara': { lat: 45.7489, lng: 21.2087 },

  // Austria
  'austria': { lat: 47.5162, lng: 14.5501 },
  'osterreich': { lat: 47.5162, lng: 14.5501 },
  'wien': { lat: 48.2082, lng: 16.3738 },
  'wiedeń': { lat: 48.2082, lng: 16.3738 },
  'graz': { lat: 47.0707, lng: 15.4395 },
  'linz': { lat: 48.3069, lng: 14.2858 }
};

/**
 * Normalizuje tekst adresu do wyszukiwania w Polsce i Europie
 */
const normalizeAddress = (addr: string): string => {
  return addr.trim().replace(/\s+/g, ' ');
};

/**
 * Sprawdza czy podany ciąg to bezpośrednie współrzędne GPS (np. "48.3061, 18.0764" lub "52.866405 20.618454")
 */
const parseCoordinatesDirectly = (text: string): GeoLocation | null => {
  const clean = text.trim();
  const match = clean.match(/^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)[,\s]+[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/);
  if (match) {
    const parts = clean.split(/[,\s]+/).filter(Boolean);
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
  }
  return null;
};

/**
 * Generuje inteligentne warianty zapytań dla adresów w Polsce i całej Europie.
 */
const prepareQueryVariants = (address: string): string[] => {
  const normalized = normalizeAddress(address);
  const variants: string[] = [normalized];

  // Tłumaczenie polskich nazw krajów na formaty międzynarodowe (zwiększa skuteczność w OSM)
  const international = normalized
    .replace(/\bsłowacj[aei]\b/gi, 'Slovakia')
    .replace(/\bczechy\b/gi, 'Czech Republic')
    .replace(/\bniemcy\b/gi, 'Germany')
    .replace(/\bwęgry\b/gi, 'Hungary')
    .replace(/\blitwa\b/gi, 'Lithuania')
    .replace(/\błotwa\b/gi, 'Latvia')
    .replace(/\bestoni[aei]\b/gi, 'Estonia')
    .replace(/\bukrain[aei]\b/gi, 'Ukraine')
    .replace(/\brumuni[aei]\b/gi, 'Romania')
    .replace(/\baustri[aei]\b/gi, 'Austria')
    .replace(/\bfrancj[aei]\b/gi, 'France')
    .replace(/\bwłochy\b/gi, 'Italy')
    .replace(/\bholandi[aei]\b/gi, 'Netherlands')
    .replace(/\bbelgi[aei]\b/gi, 'Belgium')
    .replace(/\bdani[aei]\b/gi, 'Denmark')
    .replace(/\bszwecj[aei]\b/gi, 'Sweden');

  if (international !== normalized) {
    variants.push(international);
  }

  // Oczyszczenie z nazw klientów lub zbędnych słów (np. "Klient: Luka Komar, Nitra, Słowacja")
  const strippedPrefix = normalized
    .replace(/^(klient|odbiorca|zlecenie|gospodarstwo|firma|agro)\s*[:\-]\s*/gi, '')
    .trim();
  if (strippedPrefix !== normalized && strippedPrefix.length > 2) {
    variants.push(strippedPrefix);
  }

  // Warianty częściowe przy adresach z przecinkami
  const parts = normalized.split(/[,;\-]+/).map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const cityCountry = `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
    variants.push(cityCountry);
    const cityCountryInt = cityCountry
      .replace(/\bsłowacj[aei]\b/gi, 'Slovakia')
      .replace(/\bczechy\b/gi, 'Czech Republic')
      .replace(/\bniemcy\b/gi, 'Germany');
    if (cityCountryInt !== cityCountry) {
      variants.push(cityCountryInt);
    }
    variants.push(parts[parts.length - 1]);
  }

  // Oczyszczenie z nawiasów i cudzysłowów
  const cleaned = normalized.replace(/\(.*?\)/g, '').replace(/[„”"']/g, '').trim();
  if (cleaned !== normalized && cleaned.length > 3) {
    variants.push(cleaned);
  }

  return Array.from(new Set(variants));
};

/**
 * Geokoduje adres za pomocą OpenStreetMap Nominatim bez ograniczenia do jednego kraju.
 * W pełni obsługuje Polskę, Słowację (np. klient Luka Komar), Czechy, Niemcy i całą Europę.
 */
export const geocodeAddress = async (address: string): Promise<GeoLocation | null> => {
  if (!address || !address.trim()) return null;
  
  // 1. Sprawdzenie czy użytkownik wkleił bezpośrednie współrzędne GPS
  const directCoords = parseCoordinatesDirectly(address);
  if (directCoords) {
    return directCoords;
  }

  const normalized = normalizeAddress(address);

  // 2. Sprawdzenie pamięci podręcznej (LocalStorage)
  if (normalized in geoCache && geoCache[normalized] !== null) {
    return geoCache[normalized];
  }

  // 3. Sprawdzenie szybkiego słownika znanych lokalizacji w Europie
  const lowerAddr = normalized.toLowerCase().replace(/[,\.\-]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [key, coords] of Object.entries(EUROPE_KNOWN_LOCATIONS)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (lowerAddr === key || regex.test(lowerAddr)) {
      if (lowerAddr.includes('nitra') && key === 'nitra') {
        geoCache[normalized] = coords;
        saveGeoCache();
        return coords;
      }
      if (lowerAddr === key) {
        geoCache[normalized] = coords;
        saveGeoCache();
        return coords;
      }
    }
  }

  const queriesToTry = prepareQueryVariants(address);

  // 4. Odpytanie OpenStreetMap Nominatim dla całej Europy
  for (const query of queriesToTry) {
    try {
      await new Promise(resolve => setTimeout(resolve, 950));

      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '1',
        addressdetails: '1'
      });

      const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'LupusAgriLogisticsMap/3.0'
        }
      });
      
      if (!response.ok) {
        console.warn(`Geocoding HTTP error: ${response.status} dla zapytania: "${query}"`);
        continue;
      }

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        const result: GeoLocation = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
        geoCache[normalized] = result;
        saveGeoCache();
        return result;
      }
    } catch (error) {
      console.error("Geocoding exception dla zapytania:", query, error);
    }
  }

  // 5. Ostatnia deska ratunku dla klientów w Europie
  for (const [key, coords] of Object.entries(EUROPE_KNOWN_LOCATIONS)) {
    if (lowerAddr.includes(key)) {
      geoCache[normalized] = coords;
      saveGeoCache();
      return coords;
    }
  }

  geoCache[normalized] = null;
  saveGeoCache();
  return null;
};

/**
 * Aktualizuje lub wymusza wpis w cache (np. po ręcznej edycji adresu przez użytkownika)
 */
export const updateGeoCache = (address: string, coords: GeoLocation | null) => {
  const normalized = normalizeAddress(address);
  geoCache[normalized] = coords;
  saveGeoCache();
};