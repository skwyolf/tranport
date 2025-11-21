
export interface PipedrivePerson {
  id: number;
  name: string;
  phone?: { value: string }[];
  email?: { value: string }[];
  org_id?: {
    name: string;
    address?: string;
  };
  formatted_address?: string;
  postal_address?: string;
  // Allow access to dynamic custom fields (hashes like '29d06...')
  [key: string]: any;
}

export interface PipedriveProjectPhase {
  id: number;
  name: string;
}

export interface PipedriveProject {
  id: number;
  title: string;
  status: string; // 'open', 'completed', 'canceled'
  phase_id: number;
  person_id?: number | { // API often returns just ID or simplified object
    value: number;
    name: string;
  }; 
  org_id?: number | {
    value: number;
    name: string;
    address?: string;
  };
  // Description or other fields can be added here
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface LogisticsProject {
  id: number;
  title: string; // Machine name
  clientName: string; // Person Name
  address: string;
  coordinates: GeoLocation | null;
  status: 'open' | 'completed' | 'geocoding_error';
  pipedriveLink: string;
  phaseName?: string; // Display Phase (e.g. "W transporcie")
  phone?: string; // Contact phone
  notes?: string;
  value?: string; // Optional now, might not be in projects
  personId?: number | null; // Added for direct link to Person
  type: 'transport' | 'service'; // Rozróżnienie typu projektu
}

export interface AppConfig {
  pipedriveApiKey: string;
  useMockData: boolean;
}

export const DEFAULTS = {
  // Center of Poland
  CENTER_LAT: 52.0693,
  CENTER_LNG: 19.4803,
  ZOOM: 6
};
