export type ProjectGroup = 'transport' | 'service' | 'production';

export interface PipedrivePerson {
  id: number;
  name: string;
  phone?: { value: string }[];
  email?: { value: string }[];
  org_id?: {
    name: string;
    address?: string;
  } | number;
  formatted_address?: string;
  postal_address?: string;
  [key: string]: any;
}

export interface PipedriveOrganization {
  id: number;
  name: string;
  address?: string;
  [key: string]: any;
}

export interface PipedriveProjectBoard {
  id: number;
  name: string;
  order_nr?: number;
}

export interface PipedriveProjectPhase {
  id: number;
  name: string;
  board_id: number;
  order_nr?: number;
}

export interface PipedriveProject {
  id: number;
  title: string;
  status: string; // 'open', 'completed', 'canceled'
  phase_id: number;
  board_id?: number;
  person_id?: number | {
    id?: number;
    value?: number;
    name?: string;
  }; 
  org_id?: number | {
    id?: number;
    value?: number;
    name?: string;
    address?: string;
  };
  deal_id?: number | {
    id?: number;
    value?: number;
    title?: string;
  };
  [key: string]: any;
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface LogisticsProject {
  id: number;
  title: string;          // Maszyna / zlecenie
  clientName: string;     // Klient (osoba lub organizacja)
  address: string;
  coordinates: GeoLocation | null;
  displayCoordinates?: GeoLocation; // Pozycja z uwzględnieniem rozsuwania (spiderfy)
  status: 'open' | 'completed' | 'geocoding_error';
  pipedriveLink: string;
  phaseId: number;
  phaseName: string;      // Etap
  boardId: number;
  boardName: string;      // Lejek
  phone?: string;         // Telefon kontaktowy
  notes?: string;
  value?: string;
  personId?: number | null;
  orgId?: number | null;
  dealId?: number | null;
  type: ProjectGroup;     // Grupa procesu: 'production' | 'transport' | 'service'
}

export interface AppConfig {
  pipedriveApiKey: string;
  useMockData: boolean;
}

export interface ProjectDiagnosticItem {
  id: number;
  title: string;
  phaseId: number;
  phaseName: string;
  boardId: number;
  boardName: string;
  status: string;
  personRaw: any;
  orgRaw: any;
  dealRaw: any;
  clientExtracted: string;
  addressExtracted: string;
  hasGPS: boolean;
  coords: { lat: number; lng: number } | null;
  isInPanel: boolean;
  exclusionReason: string | null;
}

export interface SyncDiagnosticReport {
  timestamp: string;
  totalRawProjectsInAPI: number;
  allBoards: { id: number; name: string; isMatched: boolean; matchedGroup?: string }[];
  deliveryBoard: { id: number; name: string } | null;
  deliveryPhases: { id: number; name: string; projectCountInPipedrive: number }[];
  phasesBreakdown: Record<string, number>;
  totalDeliveryProjectsInAPI: number;
  totalDeliveryInPanel: number;
  totalDeliveryWithGPS: number;
  totalUniqueGPSLocations: number;
  deliveryProjects: ProjectDiagnosticItem[];
  allProjectsSummary: {
    total: number;
    production: number;
    transport: number;
    service: number;
    errors: number;
  };
}

export const DEFAULTS = {
  // Baza LUPUS - Ciechanów, ul. Mleczarska 6
  BASE_LAT: 52.866405,
  BASE_LNG: 20.618454,
  CENTER_LAT: 52.0693,
  CENTER_LNG: 19.4803,
  ZOOM: 6
};
