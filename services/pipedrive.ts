import axios from 'axios';
import { LogisticsProject } from '../types';
import { geocodeAddress } from './geocoding';

// ZMIENNE KONFIGURACYJNE
const ADDRESS_HASH_KEY = '29d06d3e2226db5e54236028b71cc4189a9b0828';
const COMPANY_DOMAIN = 'lupus';
const CACHE_KEY = 'cached_projects';
const CACHE_TIMESTAMP_KEY = 'last_update';

/**
 * Konstruujemy BASE_URL tak, aby zawsze był poprawnym URL-em.
 * Na Netlify używamy ścieżki relatywnej zaczynającej się od /api, 
 * ale dla axiosa/fetcha w przeglądarce musi to być rozpoznawalne.
 */
const getBaseUrl = () => {
  if (typeof window === 'undefined') return 'https://api.pipedrive.com/v1';
  
  const isProduction = window.location.hostname.includes('netlify.app') || window.location.hostname !== 'localhost';
  
  // Jeśli jesteśmy na produkcji, używamy proxy /api (skonfigurowanego w _redirects)
  // Jeśli lokalnie, łączymy się bezpośrednio
  return isProduction ? `${window.location.origin}/api/v1` : 'https://api.pipedrive.com/v1';
};

const BASE_URL = getBaseUrl();

// MOCK DATA
const MOCK_PROJECTS: Partial<LogisticsProject>[] = [
  { id: 101, title: "Kombajn Zbożowy CX8", clientName: "Jan Kowalski", address: "ul. Polna 5, Płońsk", phaseName: "Przygotowanie maszyny", phone: "500-100-100", personId: 1, type: 'transport' },
  { id: 102, title: "Siewnik Precyzyjny 4m", clientName: "Adam Nowak", address: "Szamotuły, Dworcowa 10", phaseName: "Transport LUPUS lub inny", phone: "600-200-200", personId: 2, type: 'transport' },
  { id: 103, title: "Naprawa gwarancyjna talerzówki", clientName: "Piotr Zieliński", address: "Mława, Warszawska 1", phaseName: "Zgłoszenie usterki", phone: "700-300-300", personId: 3, type: 'service' },
];

export const getCachedProjects = (): LogisticsProject[] | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error("Błąd odczytu cache:", e);
  }
  return null;
};

export const removeProjectFromCache = (projectId: number) => {
  try {
    const cached = getCachedProjects();
    if (cached) {
      const updated = cached.filter(p => p.id !== projectId);
      localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error("Błąd aktualizacji cache:", e);
  }
};

/**
 * Funkcja pomocnicza do bezpiecznych zapytań z logowaniem (zgodnie z prośbą użytkownika)
 */
async function pipedriveGet(endpoint: string, apiKey: string) {
  const url = `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_token=${apiKey}`;
  console.log('Final URL:', url);
  
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Status błędu:', error.response.status);
      console.error('Treść błędu z serwera:', error.response.data);
    } else {
      console.error('Błąd połączenia (brak odpowiedzi):', error.message);
    }
    throw error;
  }
}

export const fetchPipedriveProjects = async (apiKey: string, useMock: boolean): Promise<LogisticsProject[] | null> => {
  if (useMock) {
    const projects: LogisticsProject[] = [];
    for (const mock of MOCK_PROJECTS) {
      const coords = await geocodeAddress(mock.address || "");
      projects.push({
        id: mock.id!,
        title: mock.title!,
        clientName: mock.clientName!,
        address: mock.address!,
        phaseName: mock.phaseName,
        phone: mock.phone,
        status: coords ? 'open' : 'geocoding_error',
        pipedriveLink: `https://${COMPANY_DOMAIN}.pipedrive.com/projects/${mock.id}/plan`,
        coordinates: coords,
        personId: mock.personId,
        value: "0",
        type: mock.type || 'transport'
      });
    }
    return projects;
  }

  try {
    // Pobieranie tablic (boards)
    const boardsData = await pipedriveGet('/projects/boards', apiKey);
    const allBoards = boardsData.data || [];
    
    const transportBoard = allBoards.find((b: any) => /dostarczenie|delivery|transport/i.test(b.name));
    const serviceBoard = allBoards.find((b: any) => /serwis|service|naprawy|warsztat/i.test(b.name));

    const fetchPhases = async (boardId: number | undefined) => {
      if (!boardId) return [];
      const phasesData = await pipedriveGet(`/projects/phases?board_id=${boardId}`, apiKey);
      return phasesData.data || [];
    };

    // Fix: Corrected block-scoped variable error by using serviceBoard?.id instead of servicePhasesAll?.id
    const [transportPhasesAll, servicePhasesAll] = await Promise.all([
      fetchPhases(transportBoard?.id),
      fetchPhases(serviceBoard?.id)
    ]);

    const transportPhaseIds = transportPhasesAll
      .filter((p: any) => {
        const n = p.name.toLowerCase();
        return n.includes('przygotowanie') || n.includes('transport') || n.includes('gotowe');
      })
      .map((p: any) => p.id);

    const serviceKeywords = ['usterki', 'diagnoza', 'rozwiązanie', 'termin', 'napraw', 'zgłoszenie'];
    const servicePhaseIds = (servicePhasesAll || [])
      .filter((p: any) => {
        const n = p.name.toLowerCase();
        return serviceKeywords.some(k => n.includes(k));
      })
      .map((p: any) => p.id);

    const phaseNameMap: Record<number, string> = {};
    [...transportPhasesAll, ...(servicePhasesAll || [])].forEach((p: any) => phaseNameMap[p.id] = p.name);

    // Pobieranie projektów
    const projectsData = await pipedriveGet('/projects?status=open&limit=500', apiKey);
    const allProjects = projectsData.data || [];

    const validProjectsRaw = allProjects.filter((p: any) => {
      if (transportPhaseIds.includes(p.phase_id)) {
        p._detectedType = 'transport';
        return true;
      }
      if (servicePhaseIds.includes(p.phase_id)) {
        p._detectedType = 'service';
        return true;
      }
      return false;
    });

    const logisticsProjects: LogisticsProject[] = [];
    for (const project of validProjectsRaw) {
      let address = '';
      let phone = '';
      let clientName = 'Nieznany';
      const personId = project.person_id?.value || project.person_id;

      if (personId) {
        try {
          const personDataRaw = await pipedriveGet(`/persons/${personId}`, apiKey);
          const personData = personDataRaw.data;
          clientName = personData.name;
          address = personData[ADDRESS_HASH_KEY];
          if (!address && personData.org_id?.address) address = personData.org_id.address;
          if (!address && personData.postal_address) address = personData.postal_address;
          if (personData.phone?.length > 0) phone = personData.phone[0].value;
        } catch (e) {
          console.error(`Błąd pobierania osoby ID ${personId}`, e);
        }
      }

      const coords = await geocodeAddress(address);
      logisticsProjects.push({
        id: project.id,
        title: project.title,
        clientName: clientName,
        address: address || '',
        phone: phone,
        value: "0",
        coordinates: coords,
        personId: personId || null,
        phaseName: phaseNameMap[project.phase_id] || 'Nieznana Faza',
        status: coords ? 'open' : 'geocoding_error',
        pipedriveLink: `https://${COMPANY_DOMAIN}.pipedrive.com/projects/${project.id}/plan`,
        type: project._detectedType
      });
    }

    if (logisticsProjects.length > 0) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(logisticsProjects));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    }

    return logisticsProjects;
  } catch (error) {
    console.error('CRITICAL ERROR fetchPipedriveProjects:', error);
    return null; // Zwracamy null, aby zachować dane z cache w App.tsx
  }
};

export const updatePersonAddress = async (personId: number, newAddress: string, apiKey: string, useMock: boolean): Promise<boolean> => {
  if (useMock) return true;
  try {
    const url = `${BASE_URL}/persons/${personId}?api_token=${apiKey}`;
    await axios.put(url, {
      [ADDRESS_HASH_KEY]: newAddress
    });
    return true;
  } catch (error) {
    console.error("Update Person Error", error);
    return false;
  }
};

export const advanceProjectStage = async (
  projectId: number, 
  type: 'transport' | 'service',
  apiKey: string, 
  useMock: boolean
): Promise<boolean> => {
  if (useMock) return true;
  
  try {
    const boardsData = await pipedriveGet('/projects/boards', apiKey);
    const allBoards = boardsData.data || [];

    let boardPattern: RegExp;
    let phasePattern: RegExp;

    if (type === 'transport') {
      boardPattern = /dostarczenie|delivery/i;
      phasePattern = /u klienta|maszyna u klienta/i;
    } else {
      boardPattern = /serwis|service|naprawy/i;
      phasePattern = /wykonanie|zrealizowane|gotowe/i;
    }

    const targetBoard = allBoards.find((b: any) => boardPattern.test(b.name));
    if (!targetBoard) return false;

    const phasesData = await pipedriveGet(`/projects/phases?board_id=${targetBoard.id}`, apiKey);
    const targetPhase = phasesData.data.find((p: any) => phasePattern.test(p.name));

    if (!targetPhase) return false;

    const url = `${BASE_URL}/projects/${projectId}?api_token=${apiKey}`;
    await axios.put(url, { phase_id: targetPhase.id });
    return true;
  } catch (error: any) {
    console.error("Błąd API Pipedrive (advance):", error);
    return false;
  }
};