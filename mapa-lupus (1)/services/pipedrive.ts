import axios from 'axios';
import { 
  LogisticsProject, 
  ProjectGroup, 
  PipedriveProjectBoard, 
  PipedriveProjectPhase, 
  SyncDiagnosticReport, 
  ProjectDiagnosticItem 
} from '../types';
import { geocodeAddress } from './geocoding';

// STAŁE KONFIGURACYJNE
export const ADDRESS_HASH_KEY = '29d06d3e2226db5e54236028b71cc4189a9b0828';
const COMPANY_DOMAIN = 'lupus';
const CACHE_KEY = 'lupus_cached_projects_v2';
const CACHE_TIMESTAMP_KEY = 'lupus_last_update_v2';
const DIAGNOSTIC_STORAGE_KEY = 'lupus_diagnostic_report_v2';
const BASE_URL = 'https://api.pipedrive.com/v1';

/**
 * Bezpieczne wyciąganie ID encji z odpowiedzi Pipedrive API.
 */
export function extractEntityId(field: any): number | null {
  if (field === null || field === undefined) return null;
  if (typeof field === 'number') return field;
  if (typeof field === 'string' && field.trim() !== '' && !isNaN(Number(field))) return Number(field);
  if (typeof field === 'object') {
    if (typeof field.id === 'number') return field.id;
    if (typeof field.value === 'number') return field.value;
    if (typeof field.id === 'string' && !isNaN(Number(field.id))) return Number(field.id);
    if (typeof field.value === 'string' && !isNaN(Number(field.value))) return Number(field.value);
  }
  return null;
}

export function extractEntityName(field: any): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') {
    return field.name || field.title || '';
  }
  return '';
}

/**
 * Definicje lejków (Boards) z instrukcji z przypisaną grupą i kolorem
 */
export interface BoardDefinition {
  targetName: string;
  group: ProjectGroup;
  pattern: RegExp;
  colorName: string;
  colorHex: string;
}

export const BOARD_DEFINITIONS: BoardDefinition[] = [
  {
    targetName: 'Dostarczenie',
    group: 'transport',
    pattern: /dostarczen|dostaw|delivery|transport|wydani/i,
    colorName: 'Niebieski',
    colorHex: '#2563EB'
  },
  {
    targetName: 'Serwis',
    group: 'service',
    pattern: /serwis|service|napraw|warsztat/i,
    colorName: 'Żółty',
    colorHex: '#EAB308'
  },
  {
    targetName: 'Brony zębowe/agregat uprawowy',
    group: 'production',
    pattern: /brony?\s*z[eę]bow|agregat.*uprawow/i,
    colorName: 'Brązowy',
    colorHex: '#92400E'
  },
  {
    targetName: 'Wały posiewne/stoły rzepak',
    group: 'production',
    pattern: /wa[lł]y?\s*posiewn|sto[lł]y?\s*rzepak/i,
    colorName: 'Brązowy',
    colorHex: '#92400E'
  },
  {
    targetName: 'Brona talerzowa',
    group: 'production',
    pattern: /brona?\s*talerzow|talerz[oó]w/i,
    colorName: 'Brązowy',
    colorHex: '#92400E'
  },
  {
    targetName: 'Agregat bezorkowy',
    group: 'production',
    pattern: /agregat.*bezorkow/i,
    colorName: 'Brązowy',
    colorHex: '#92400E'
  },
  {
    targetName: 'Agregat KAU / Chwastowniki',
    group: 'production',
    pattern: /agregat.*kau|chwastownik/i,
    colorName: 'Brązowy',
    colorHex: '#92400E'
  }
];

/**
 * Weryfikacja etapów dla lejków DOSTARCZENIE
 */
export const isDeliveryAllowedPhase = (phaseName: string, phaseId?: number): boolean => {
  if (phaseId === 62) return true; // Gotowa – płatność i wydanie
  if (phaseId === 2) return true;  // Transport LUPUS lub inny
  if (phaseId === 1) return true;  // Oczekuję na maszynę

  const norm = phaseName.toLowerCase().trim();

  // Wykluczenia
  if (/maszyna\s*u\s*klienta|u\s*klienta|uruchomienie/i.test(norm)) {
    return false;
  }
  if (/bez\s*malowania/i.test(norm)) {
    return false;
  }

  // 1. Gotowa – płatność i wydanie
  if (/gotow|p[lł]atno|wydani/i.test(norm)) {
    return true;
  }

  // 2. Transport LUPUS lub inny
  if (/transport|przew[oó]z|lupus.*inny|inny.*transport/i.test(norm)) {
    return true;
  }

  // 3. Oczekuję na maszynę
  if (/oczekuj|oczekiwan/i.test(norm)) {
    return true;
  }

  return false;
};

/**
 * Weryfikacja etapów dla lejka SERWIS:
 * "etap Uzupełnienia/ZAMÓWIENIA wykasuj" -> wykluczony!
 */
export const isServiceAllowedPhase = (phaseName: string): boolean => {
  const norm = phaseName.toLowerCase().trim();
  if (/uzupe[lł]nieni|zam[oó]wieni/i.test(norm)) {
    return false;
  }
  return true;
};

// MOCK DATA
const MOCK_PROJECTS_DATA: Partial<LogisticsProject>[] = [
  // 1-8. Gotowa – płatność i wydanie (8 projektów)
  { id: 301, title: "Agregat bezorkowy KRET 3.0 m", clientName: "Piotr Wiśniewski", address: "ul. Długa 10, 06-500 Mława", phone: "690 112 233", boardName: "Dostarczenie", phaseName: "Gotowa – płatność i wydanie", type: 'transport', personId: 1003, boardId: 1, phaseId: 102 },
  { id: 302, title: "Wał Cambridge 6,2 m Ø530", clientName: "Gospodarstwo Rolne Janusz Nowak", address: "ul. Pułtuska 14, 06-400 Ciechanów", phone: "601 334 556", boardName: "Dostarczenie", phaseName: "Gotowa – płatność i wydanie", type: 'transport', personId: 1011, boardId: 1, phaseId: 102 },
  { id: 303, title: "Brona talerzowa 3.0m z hydropakiem", clientName: "Agro-Pol Dariusz Kamiński", address: "ul. Lipowa 5, 06-300 Przasnysz", phone: "503 221 445", boardName: "Dostarczenie", phaseName: "Gotowa – płatność i wydanie", type: 'transport', personId: 1012, boardId: 1, phaseId: 102 },
  { id: 304, title: "Głębosz 5-zębowy z wałem kolczastym", clientName: "Tomasz Woźniak", address: "ul. Kolejowa 8, 09-100 Płońsk", phone: "605 778 990", boardName: "Dostarczenie", phaseName: "Gotowa – płatność i wydanie", type: 'transport', personId: 1013, boardId: 1, phaseId: 102 },
  { id: 305, title: "Agregat uprawowo-siewny 4m z wałem packera", clientName: "Stanisław Majewski", address: "ul. Spółdzielcza 3, 09-300 Żuromin", phone: "512 443 667", boardName: "Dostarczenie", phaseName: "Gotowa – płatność i wydanie", type: 'transport', personId: 1014, boardId: 1, phaseId: 102 },
  { id: 306, title: "Rozsiewacz nawozów dwutarczowy 1200L", clientName: "Paweł Lewandowski", address: "Rynek 15, 06-100 Pułtusk", phone: "608 119 223", boardName: "Dostarczenie", phaseName: "Gotowa – płatność i wydanie", type: 'transport', personId: 1015, boardId: 1, phaseId: 102 },
  { id: 307, title: "Kultywator ścierniskowy 3m", clientName: "Michał Zieliński", address: "ul. Ogrodowa 7, 06-500 Mława", phone: "509 887 112", boardName: "Dostarczenie", phaseName: "Gotowa – płatność i wydanie", type: 'transport', personId: 1016, boardId: 1, phaseId: 102 },
  { id: 308, title: "Siewnik zbożowy 3.0m mechaniczny", clientName: "Gospodarstwo Rolne Krystian Mazur", address: "ul. Wiejska 2, 06-440 Gąsocin", phone: "604 556 778", boardName: "Dostarczenie", phaseName: "Gotowa – płatność i wydanie", type: 'transport', personId: 1017, boardId: 1, phaseId: 102 },
  // 9-10. Transport LUPUS lub inny (2 projekty)
  { id: 309, title: "Brona zębowa ciężka 6m", clientName: "Marek Ziółkowski", address: "Rynek 4, 09-300 Żuromin", phone: "515 443 322", boardName: "Dostarczenie", phaseName: "Transport LUPUS lub inny", type: 'transport', personId: 1004, boardId: 1, phaseId: 103 },
  { id: 310, title: "Pług dłutowy 3.0 m", clientName: "Andrzej Błaszczyk", address: "ul. Płocka 40, 09-100 Płońsk", phone: "601 990 011", boardName: "Dostarczenie", phaseName: "Transport LUPUS lub inny", type: 'transport', personId: 1018, boardId: 1, phaseId: 103 },
  // 11-12. Oczekuję na maszynę (2 projekty)
  { id: 311, title: "Siewnik punktowy 6-rzędowy z podsiewaczem", clientName: "Stanisław Bąk", address: "ul. Kwiatowa 12, 06-400 Ciechanów", phone: "602 889 110", boardName: "Dostarczenie", phaseName: "Oczekuję na maszynę", type: 'transport', personId: 1007, boardId: 1, phaseId: 101 },
  { id: 312, title: "Wał łąkowy 3m ciągniony", clientName: "Rol-Grod Grzegorz Duda", address: "ul. Mazowiecka 11, 06-300 Przasnysz", phone: "504 332 110", boardName: "Dostarczenie", phaseName: "Oczekuję na maszynę", type: 'transport', personId: 1019, boardId: 1, phaseId: 101 },
  // 13. Klient zagraniczny (Słowacja)
  { id: 315, title: "Brona talerzowa ATLAS 4m (Eksport)", clientName: "LUKA KOMAR", address: "Nitra, Słowacja", phone: "+421 905 123 456", boardName: "Dostarczenie", phaseName: "Gotowa – płatność i wydanie", type: 'transport', personId: 1025, boardId: 1, phaseId: 62 },
  // Produkcja
  { id: 201, title: "Wał Cambridge 6,2 m Ø530", clientName: "Jan Kowalski", address: "ul. Warszawska 15, 06-400 Ciechanów", phone: "601 234 567", boardName: "Wały posiewne/stoły rzepak", phaseName: "Montaż/tabliczka", type: 'production', personId: 1001, boardId: 3, phaseId: 305 },
  { id: 202, title: "Brona talerzowa ATLAS 3.0 m", clientName: "Gospodarstwo Rolne Adam Kowalczyk", address: "ul. Płocka 22, 09-100 Płońsk", phone: "502 998 877", boardName: "Brona talerzowa", phaseName: "W produkcji", type: 'production', personId: 1002, boardId: 4, phaseId: 404 },
  { id: 206, title: "Agregat bezorkowy 4.0 m z wałem tandem", clientName: "Agro-Partner Sp. z o.o.", address: "ul. Kościuszki 45, 06-100 Pułtusk", phone: "23 692 00 11", boardName: "Agregat bezorkowy", phaseName: "Maszyny WOLNE na placu", type: 'production', orgId: 2001, boardId: 5, phaseId: 501 },
  // Produkcja - Klient zagraniczny (Słowacja)
  { id: 215, title: "Agregat uprawowy 5.0m", clientName: "LUKA KOMAR", address: "Bratislava, Słowacja", phone: "+421 905 123 456", boardName: "Brony zębowe/agregat uprawowy", phaseName: "W produkcji", type: 'production', personId: 1025, boardId: 3, phaseId: 304 },
  // Serwis
  { id: 203, title: "Przegląd gwarancyjny i regulacja sekcji", clientName: "Gospodarstwo Rolne Adam Kowalczyk", address: "ul. Płocka 22, 09-100 Płońsk", phone: "502 998 877", boardName: "Serwis", phaseName: "Termin", type: 'service', personId: 1002, boardId: 2, phaseId: 204 },
  { id: 207, title: "Wyciek z siłownika hydraulicznego rozkładania", clientName: "Krzysztof Lewandowski", address: "ul. Lipowa 8, 06-300 Przasnysz", phone: "508 776 655", boardName: "Serwis", phaseName: "Zgłoszenie usterki", type: 'service', personId: 1005, boardId: 2, phaseId: 201 }
];

export const getCachedProjects = (): LogisticsProject[] | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.error("Błąd odczytu projektów z cache:", e);
  }
  return null;
};

export const saveProjectsToCache = (projects: LogisticsProject[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(projects));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (e) {
    console.error("Błąd zapisu projektów do cache:", e);
  }
};

export const getSavedDiagnosticReport = (): SyncDiagnosticReport | null => {
  try {
    const raw = localStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Błąd odczytu raportu diagnostycznego:", e);
  }
  return null;
};

export const saveDiagnosticReport = (report: SyncDiagnosticReport) => {
  try {
    localStorage.setItem(DIAGNOSTIC_STORAGE_KEY, JSON.stringify(report));
  } catch (e) {
    console.error("Błąd zapisu raportu diagnostycznego:", e);
  }
};

export const removeProjectFromCache = (projectId: number) => {
  try {
    const cached = getCachedProjects();
    if (cached) {
      const updated = cached.filter(p => p.id !== projectId);
      localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error("Błąd usuwania projektu z cache:", e);
  }
};

/**
 * Zapytanie do API Pipedrive
 */
async function pipedriveGet(endpoint: string, apiKey: string) {
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${BASE_URL}${endpoint}${separator}api_token=${apiKey}`;

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'Accept': 'application/json'
      }
    });
    return response.data;
  } catch (error: any) {
    console.error(`Pipedrive API Error [${endpoint}]:`, error.response?.status || error.message);
    throw error;
  }
}

/**
 * Pobiera wszystkie strony projektów z Pipedrive (Paginacja z limit=500)
 */
async function fetchAllOpenProjects(apiKey: string): Promise<any[]> {
  const allProjects: any[] = [];
  let start = 0;
  const limit = 500;
  let hasMore = true;
  let pageCount = 0;
  const maxPages = 10;

  while (hasMore && pageCount < maxPages) {
    pageCount++;
    const endpoint = `/projects?status=open&start=${start}&limit=${limit}`;
    const data = await pipedriveGet(endpoint, apiKey);

    const items = data.data;
    if (Array.isArray(items) && items.length > 0) {
      allProjects.push(...items);
    } else {
      break;
    }

    const pagination = data.additional_data?.pagination;
    if (pagination && pagination.more_items_in_collection) {
      start = pagination.next_start || (start + limit);
    } else {
      hasMore = false;
    }
  }

  return allProjects;
}

export interface FetchProjectsResult {
  projects: LogisticsProject[];
  warnings: string[];
  diagnosticReport: SyncDiagnosticReport;
}

/**
 * Główna funkcja synchronizacji z Pipedrive wraz z raportem diagnostycznym
 */
export const fetchPipedriveProjects = async (
  apiKey: string, 
  useMock: boolean,
  existingProjects: LogisticsProject[] = []
): Promise<FetchProjectsResult | null> => {
  // 1. TRYB MOCK
  if (useMock) {
    const projects: LogisticsProject[] = [];
    const deliveryDiagItems: ProjectDiagnosticItem[] = [];

    for (const mock of MOCK_PROJECTS_DATA) {
      const existing = existingProjects.find(e => e.id === mock.id);
      let coords = existing?.address === mock.address ? existing.coordinates : null;
      if (!coords && mock.address) {
        coords = await geocodeAddress(mock.address);
      }

      const proj: LogisticsProject = {
        id: mock.id!,
        title: mock.title!,
        clientName: mock.clientName!,
        address: mock.address!,
        boardName: mock.boardName || 'Brak lejka',
        phaseName: mock.phaseName || 'Brak etapu',
        boardId: mock.boardId || 0,
        phaseId: mock.phaseId || 0,
        phone: mock.phone,
        status: coords ? 'open' : 'geocoding_error',
        pipedriveLink: `https://${COMPANY_DOMAIN}.pipedrive.com/projects/${mock.id}/plan`,
        coordinates: coords,
        personId: mock.personId || null,
        orgId: mock.orgId || null,
        value: "0",
        type: mock.type || 'production'
      };
      projects.push(proj);

      if (mock.type === 'transport') {
        deliveryDiagItems.push({
          id: mock.id!,
          title: mock.title!,
          phaseId: mock.phaseId || 0,
          phaseName: mock.phaseName || 'Brak etapu',
          boardId: mock.boardId || 1,
          boardName: mock.boardName || 'Dostarczenie',
          status: 'open',
          personRaw: mock.personId,
          orgRaw: mock.orgId,
          dealRaw: null,
          clientExtracted: mock.clientName!,
          addressExtracted: mock.address || '',
          hasGPS: Boolean(coords),
          coords: coords,
          isInPanel: true,
          exclusionReason: null
        });
      }
    }

    const uniqueLocs = new Set(
      projects.filter(p => p.type === 'transport' && p.coordinates)
        .map(p => `${p.coordinates!.lat.toFixed(4)}_${p.coordinates!.lng.toFixed(4)}`)
    ).size;

    const report: SyncDiagnosticReport = {
      timestamp: new Date().toLocaleString('pl-PL'),
      totalRawProjectsInAPI: MOCK_PROJECTS_DATA.length,
      allBoards: [{ id: 1, name: "Dostarczenie", isMatched: true, matchedGroup: "transport" }],
      deliveryBoard: { id: 1, name: "Dostarczenie" },
      deliveryPhases: [
        { id: 102, name: "Gotowa – płatność i wydanie", projectCountInPipedrive: 8 },
        { id: 103, name: "Transport LUPUS lub inny", projectCountInPipedrive: 2 },
        { id: 101, name: "Oczekuję na maszynę", projectCountInPipedrive: 2 }
      ],
      phasesBreakdown: {
        "Gotowa – płatność i wydanie": 8,
        "Transport LUPUS lub inny": 2,
        "Oczekuję na maszynę": 2
      },
      totalDeliveryProjectsInAPI: 12,
      totalDeliveryInPanel: deliveryDiagItems.length,
      totalDeliveryWithGPS: deliveryDiagItems.filter(d => d.hasGPS).length,
      totalUniqueGPSLocations: uniqueLocs,
      deliveryProjects: deliveryDiagItems,
      allProjectsSummary: {
        total: projects.length,
        production: projects.filter(p => p.type === 'production').length,
        transport: projects.filter(p => p.type === 'transport').length,
        service: projects.filter(p => p.type === 'service').length,
        errors: projects.filter(p => p.status === 'geocoding_error').length
      }
    };

    saveProjectsToCache(projects);
    saveDiagnosticReport(report);

    return {
      projects,
      warnings: [],
      diagnosticReport: report
    };
  }

  // 2. REALNE API PIPEDRIVE
  try {
    const warnings: string[] = [];

    // KROK A: Pobieranie tablic (Boards)
    const boardsResponse = await pipedriveGet('/projects/boards', apiKey);
    const apiBoards: PipedriveProjectBoard[] = boardsResponse?.data || [];

    if (!Array.isArray(apiBoards) || apiBoards.length === 0) {
      warnings.push("Nie znaleziono żadnych tablic projektów w Pipedrive.");
      return null;
    }

    const matchedBoardsMap = new Map<number, { group: ProjectGroup; targetName: string; realBoard: PipedriveProjectBoard }>();
    const allBoardsDiag: { id: number; name: string; isMatched: boolean; matchedGroup?: string }[] = [];

    for (const b of apiBoards) {
      const bName = b.name.trim();

      // WYKLUCZENIE: "lejek dodatkowe zlecenia - wykasuj"
      if (/dodatkow/i.test(bName)) {
        allBoardsDiag.push({
          id: b.id,
          name: b.name,
          isMatched: false,
          matchedGroup: undefined
        });
        continue;
      }

      let matchedGroup: ProjectGroup | undefined = undefined;
      let matchedTargetName = '';

      for (const def of BOARD_DEFINITIONS) {
        if (def.pattern.test(bName)) {
          matchedGroup = def.group;
          matchedTargetName = def.targetName;
          matchedBoardsMap.set(b.id, {
            group: def.group,
            targetName: def.targetName,
            realBoard: b
          });
          break;
        }
      }

      allBoardsDiag.push({
        id: b.id,
        name: b.name,
        isMatched: Boolean(matchedGroup),
        matchedGroup: matchedGroup
      });
    }

    // Wykrywanie tablicy Dostarczenie
    const deliveryBoardMatch = Array.from(matchedBoardsMap.values()).find(v => v.group === 'transport');
    const deliveryBoardDiag = deliveryBoardMatch ? { id: deliveryBoardMatch.realBoard.id, name: deliveryBoardMatch.realBoard.name } : null;

    // KROK B: Pobieranie faz
    const phaseIdToPhaseMap = new Map<number, PipedriveProjectPhase>();
    let allPhases: PipedriveProjectPhase[] = [];

    try {
      const phasesRes = await pipedriveGet('/projects/phases', apiKey);
      if (Array.isArray(phasesRes?.data) && phasesRes.data.length > 0) {
        allPhases = phasesRes.data;
      }
    } catch (e) {
      console.warn("Hurtowe pobranie faz nie powiodło się, sprawdzam per board:", e);
    }

    // Pobranie per board jeśli phases puste lub niekompletne
    if (allPhases.length === 0 || matchedBoardsMap.size > 0) {
      await Promise.all(
        Array.from(matchedBoardsMap.keys()).map(async (boardId) => {
          try {
            const phasesRes = await pipedriveGet(`/projects/phases?board_id=${boardId}`, apiKey);
            const phases: PipedriveProjectPhase[] = phasesRes?.data || [];
            phases.forEach(p => {
              if (!allPhases.find(ap => ap.id === p.id)) {
                allPhases.push(p);
              }
            });
          } catch (err) {
            console.warn(`Błąd faz dla tablicy ${boardId}:`, err);
          }
        })
      );
    }

    allPhases.forEach(p => phaseIdToPhaseMap.set(p.id, p));

    // KROK C: Pobieranie otwartych projektów
    const allOpenProjectsRaw = await fetchAllOpenProjects(apiKey);

    // Fazy tablicy Dostarczenie i licznik projektów w Pipedrive
    const deliveryBoardId = deliveryBoardDiag?.id;
    const deliveryPhasesMap: Record<number, { id: number; name: string; count: number }> = {};
    const phasesBreakdown: Record<string, number> = {};

    allPhases.filter(ph => ph.board_id === deliveryBoardId).forEach(ph => {
      deliveryPhasesMap[ph.id] = { id: ph.id, name: ph.name, count: 0 };
    });

    // Zliczanie surowych projektów per etap w Pipedrive
    allOpenProjectsRaw.forEach(p => {
      const phase = phaseIdToPhaseMap.get(p.phase_id);
      if (phase && phase.board_id === deliveryBoardId) {
        if (!deliveryPhasesMap[phase.id]) {
          deliveryPhasesMap[phase.id] = { id: phase.id, name: phase.name, count: 0 };
        }
        deliveryPhasesMap[phase.id].count++;
        phasesBreakdown[phase.name] = (phasesBreakdown[phase.name] || 0) + 1;
      }
    });

    // KROK D: Kwalifikacja projektów i diagnostyka
    const qualifiedProjectsRaw: {
      raw: any;
      group: ProjectGroup;
      boardId: number;
      boardName: string;
      phaseId: number;
      phaseName: string;
    }[] = [];

    const deliveryDiagItems: ProjectDiagnosticItem[] = [];

    for (const p of allOpenProjectsRaw) {
      const phase = phaseIdToPhaseMap.get(p.phase_id);
      const boardId = p.board_id || phase?.board_id;
      const boardInfo = boardId ? matchedBoardsMap.get(boardId) : undefined;
      const phaseName = phase?.name || `Nieznana faza (${p.phase_id})`;
      const isDeliveryBoard = boardInfo?.group === 'transport' || (deliveryBoardId && boardId === deliveryBoardId);

      let isQualified = true;
      let exclusionReason: string | null = null;

      if (!boardId) {
        isQualified = false;
        exclusionReason = `Brak przypisania board_id dla projektu lub fazy ${p.phase_id}`;
      } else if (!boardInfo) {
        isQualified = false;
        exclusionReason = `Tablica ID ${boardId} nie należy do zdefiniowanych lejków`;
      } else if (boardInfo.group === 'transport') {
        if (!isDeliveryAllowedPhase(phaseName, p.phase_id)) {
          isQualified = false;
          exclusionReason = `Etap wykluczony lub poza zakresem (${phaseName})`;
        }
      } else if (boardInfo.group === 'service') {
        if (!isServiceAllowedPhase(phaseName)) {
          isQualified = false;
          exclusionReason = `Wykasowany etap serwisowy (${phaseName})`;
        }
      }

      // Sprawdzenie klienta
      const personId = extractEntityId(p.person_id);
      const orgId = extractEntityId(p.org_id);
      const dealId = extractEntityId(p.deal_id);
      const personName = extractEntityName(p.person_id);
      const orgName = extractEntityName(p.org_id);

      const hasClient = Boolean(personId || orgId || dealId || personName || orgName || p.customer);

      if (isQualified && !hasClient && boardInfo?.group === 'production') {
        isQualified = false;
        exclusionReason = "Produkcja: brak przypisanego klienta";
      }

      if (isDeliveryBoard) {
        deliveryDiagItems.push({
          id: p.id,
          title: p.title || 'Zlecenie bez tytułu',
          phaseId: p.phase_id,
          phaseName: phaseName,
          boardId: boardId || 0,
          boardName: boardInfo?.realBoard.name || `Tablica ${boardId}`,
          status: p.status || 'open',
          personRaw: p.person_id,
          orgRaw: p.org_id,
          dealRaw: p.deal_id,
          clientExtracted: personName || orgName || (personId ? `Osoba ID ${personId}` : (orgId ? `Org ID ${orgId}` : 'Brak klienta')),
          addressExtracted: '',
          hasGPS: false,
          coords: null,
          isInPanel: isQualified,
          exclusionReason: exclusionReason
        });
      }

      if (isQualified) {
        qualifiedProjectsRaw.push({
          raw: p,
          group: boardInfo!.group,
          boardId: boardId!,
          boardName: boardInfo!.realBoard.name,
          phaseId: p.phase_id,
          phaseName: phaseName
        });
      }
    }

    // KROK E: Pobieranie szczegółów kontaktowych z deduplikacją
    const personCache = new Map<number, any>();
    const orgCache = new Map<number, any>();
    const dealCache = new Map<number, any>();

    const getPersonData = async (pId: number) => {
      if (personCache.has(pId)) return personCache.get(pId);
      try {
        const res = await pipedriveGet(`/persons/${pId}`, apiKey);
        const data = res?.data || null;
        personCache.set(pId, data);
        return data;
      } catch (e) {
        personCache.set(pId, null);
        return null;
      }
    };

    const getOrgData = async (oId: number) => {
      if (orgCache.has(oId)) return orgCache.get(oId);
      try {
        const res = await pipedriveGet(`/organizations/${oId}`, apiKey);
        const data = res?.data || null;
        orgCache.set(oId, data);
        return data;
      } catch (e) {
        orgCache.set(oId, null);
        return null;
      }
    };

    const getDealData = async (dId: number) => {
      if (dealCache.has(dId)) return dealCache.get(dId);
      try {
        const res = await pipedriveGet(`/deals/${dId}`, apiKey);
        const data = res?.data || null;
        dealCache.set(dId, data);
        return data;
      } catch (e) {
        dealCache.set(dId, null);
        return null;
      }
    };

    const existingById = new Map<number, LogisticsProject>();
    for (const ep of existingProjects) {
      existingById.set(ep.id, ep);
    }
    const cachedBefore = getCachedProjects() || [];
    for (const cp of cachedBefore) {
      if (!existingById.has(cp.id)) {
        existingById.set(cp.id, cp);
      }
    }

    const finalProjects: LogisticsProject[] = [];

    for (const item of qualifiedProjectsRaw) {
      const p = item.raw;
      let personIdRaw = extractEntityId(p.person_id);
      let orgIdRaw = extractEntityId(p.org_id);
      const dealIdRaw = extractEntityId(p.deal_id);

      let clientName = extractEntityName(p.person_id) || extractEntityName(p.org_id) || '';
      let address = '';
      let phone = '';

      if (p[ADDRESS_HASH_KEY]) {
        address = String(p[ADDRESS_HASH_KEY]).trim();
      }

      if ((!personIdRaw || !address) && dealIdRaw) {
        const dealData = await getDealData(dealIdRaw);
        if (dealData) {
          if (!personIdRaw && dealData.person_id) {
            personIdRaw = extractEntityId(dealData.person_id);
            const dpName = extractEntityName(dealData.person_id);
            if (!clientName && dpName) clientName = dpName;
          }
          if (!orgIdRaw && dealData.org_id) {
            orgIdRaw = extractEntityId(dealData.org_id);
            const doName = extractEntityName(dealData.org_id);
            if (!clientName && doName) clientName = doName;
          }
          if (!address && dealData[ADDRESS_HASH_KEY]) {
            address = String(dealData[ADDRESS_HASH_KEY]).trim();
          }
          if (!address && dealData.org_id?.address) {
            address = String(dealData.org_id.address).trim();
          }
        }
      }

      if (personIdRaw) {
        const personData = await getPersonData(personIdRaw);
        if (personData) {
          if (personData.name) clientName = personData.name;
          if (!address && personData[ADDRESS_HASH_KEY]) {
            address = String(personData[ADDRESS_HASH_KEY]).trim();
          }
          const pOrgId = extractEntityId(personData.org_id);
          if (!orgIdRaw && pOrgId) orgIdRaw = pOrgId;
          if (!address && personData.org_id?.address) {
            address = String(personData.org_id.address).trim();
          }
          if (!address && personData.postal_address) {
            address = String(personData.postal_address).trim();
          }
          if (!address && personData.formatted_address) {
            address = String(personData.formatted_address).trim();
          }
          if (personData.phone && Array.isArray(personData.phone) && personData.phone.length > 0) {
            phone = personData.phone[0].value || '';
          }
        }
      }

      if (orgIdRaw) {
        const orgData = await getOrgData(orgIdRaw);
        if (orgData) {
          if (!clientName || clientName === 'Klient nieznany') {
            clientName = orgData.name;
          }
          if (!address && orgData[ADDRESS_HASH_KEY]) {
            address = String(orgData[ADDRESS_HASH_KEY]).trim();
          }
          if (!address && orgData.address) {
            address = String(orgData.address).trim();
          }
        }
      }

      if (!clientName) {
        clientName = 'Klient do uzupełnienia w CRM';
      }

      const prevRecord = existingById.get(p.id);
      let coordinates = null;

      if (prevRecord && prevRecord.address === address && prevRecord.coordinates) {
        coordinates = prevRecord.coordinates;
      } else if (address) {
        coordinates = await geocodeAddress(address);
      }

      const projItem: LogisticsProject = {
        id: p.id,
        title: p.title || 'Zlecenie bez tytułu',
        clientName: clientName,
        address: address,
        phone: phone,
        boardName: item.boardName,
        phaseName: item.phaseName,
        boardId: item.boardId,
        phaseId: item.phaseId,
        coordinates: coordinates,
        status: coordinates ? 'open' : 'geocoding_error',
        pipedriveLink: `https://${COMPANY_DOMAIN}.pipedrive.com/projects/${p.id}/plan`,
        personId: personIdRaw,
        orgId: orgIdRaw,
        dealId: dealIdRaw,
        type: item.group,
        value: p.value || "0"
      };

      finalProjects.push(projItem);

      // Aktualizacja danych diagnostycznych dla tego projektu
      const diagIndex = deliveryDiagItems.findIndex(d => d.id === p.id);
      if (diagIndex !== -1) {
        deliveryDiagItems[diagIndex].clientExtracted = clientName;
        deliveryDiagItems[diagIndex].addressExtracted = address;
        deliveryDiagItems[diagIndex].hasGPS = Boolean(coordinates);
        deliveryDiagItems[diagIndex].coords = coordinates;
        deliveryDiagItems[diagIndex].isInPanel = true;
      }
    }

    const deliveryProjectsInFinal = finalProjects.filter(p => p.type === 'transport');
    const uniqueLocsCount = new Set(
      deliveryProjectsInFinal.filter(p => p.coordinates)
        .map(p => `${p.coordinates!.lat.toFixed(4)}_${p.coordinates!.lng.toFixed(4)}`)
    ).size;

    const report: SyncDiagnosticReport = {
      timestamp: new Date().toLocaleString('pl-PL'),
      totalRawProjectsInAPI: allOpenProjectsRaw.length,
      allBoards: allBoardsDiag,
      deliveryBoard: deliveryBoardDiag,
      deliveryPhases: Object.values(deliveryPhasesMap).map(dp => ({
        id: dp.id,
        name: dp.name,
        projectCountInPipedrive: dp.count
      })),
      phasesBreakdown: phasesBreakdown,
      totalDeliveryProjectsInAPI: deliveryDiagItems.length,
      totalDeliveryInPanel: deliveryProjectsInFinal.length,
      totalDeliveryWithGPS: deliveryProjectsInFinal.filter(p => p.coordinates).length,
      totalUniqueGPSLocations: uniqueLocsCount,
      deliveryProjects: deliveryDiagItems,
      allProjectsSummary: {
        total: finalProjects.length,
        production: finalProjects.filter(p => p.type === 'production').length,
        transport: deliveryProjectsInFinal.length,
        service: finalProjects.filter(p => p.type === 'service').length,
        errors: finalProjects.filter(p => p.status === 'geocoding_error').length
      }
    };

    saveDiagnosticReport(report);

    return {
      projects: finalProjects,
      warnings: warnings,
      diagnosticReport: report
    };

  } catch (error: any) {
    console.error("Krytyczny błąd pobierania danych Pipedrive:", error);
    return null;
  }
};

/**
 * Aktualizacja adresu osoby w Pipedrive
 */
export const updatePersonAddress = async (
  personId: number, 
  newAddress: string, 
  apiKey: string, 
  useMock: boolean
): Promise<boolean> => {
  if (useMock) return true;
  try {
    const url = `${BASE_URL}/persons/${personId}?api_token=${apiKey}`;
    await axios.put(url, {
      [ADDRESS_HASH_KEY]: newAddress
    });
    return true;
  } catch (error) {
    console.error(`Błąd aktualizacji adresu osoby ID ${personId}:`, error);
    return false;
  }
};

/**
 * Aktualizacja adresu organizacji w Pipedrive
 */
export const updateOrganizationAddress = async (
  orgId: number,
  newAddress: string,
  apiKey: string,
  useMock: boolean
): Promise<boolean> => {
  if (useMock) return true;
  try {
    const url = `${BASE_URL}/organizations/${orgId}?api_token=${apiKey}`;
    await axios.put(url, {
      address: newAddress
    });
    return true;
  } catch (error) {
    console.error(`Błąd aktualizacji adresu organizacji ID ${orgId}:`, error);
    return false;
  }
};

/**
 * Przeniesienie etapu (mutacja dopuszczalna TYLKO dla dostarczenia i serwisu)
 */
export const advanceProjectStage = async (
  projectId: number, 
  type: ProjectGroup,
  apiKey: string, 
  useMock: boolean
): Promise<boolean> => {
  if (type === 'production') return false;
  if (useMock) return true;
  
  try {
    const boardsData = await pipedriveGet('/projects/boards', apiKey);
    const allBoards: PipedriveProjectBoard[] = boardsData.data || [];

    let boardPattern: RegExp;
    let phasePattern: RegExp;

    if (type === 'transport') {
      boardPattern = /dostarczenie|delivery|dostaw|transport/i;
      phasePattern = /maszyna\s*u\s*klienta|u\s*klienta/i;
    } else {
      boardPattern = /serwis|service|naprawy/i;
      phasePattern = /wykonanie|zrealizowane|gotowe/i;
    }

    const targetBoard = allBoards.find(b => boardPattern.test(b.name));
    if (!targetBoard) return false;

    const phasesData = await pipedriveGet(`/projects/phases?board_id=${targetBoard.id}`, apiKey);
    const targetPhase = (phasesData.data || []).find((p: any) => phasePattern.test(p.name));

    if (!targetPhase) return false;

    const url = `${BASE_URL}/projects/${projectId}?api_token=${apiKey}`;
    await axios.put(url, { phase_id: targetPhase.id });
    return true;
  } catch (error: any) {
    console.error("Błąd API Pipedrive podczas zmiany etapu:", error);
    return false;
  }
};