
import axios from 'axios';
import { LogisticsProject } from '../types';
import { geocodeAddress } from './geocoding';

// ZMIENNE KONFIGURACYJNE
const ADDRESS_HASH_KEY = '29d06d3e2226db5e54236028b71cc4189a9b0828'; // Twój klucz adresu
const PROXY_URL = 'https://corsproxy.io/?'; // Proxy do omijania CORS
const COMPANY_DOMAIN = 'lupus';

// MOCK DATA
const MOCK_PROJECTS: Partial<LogisticsProject>[] = [
  { id: 101, title: "Kombajn Zbożowy CX8", clientName: "Jan Kowalski", address: "ul. Polna 5, Płońsk", phaseName: "Przygotowanie maszyny", phone: "500-100-100", personId: 1, type: 'transport' },
  { id: 102, title: "Siewnik Precyzyjny 4m", clientName: "Adam Nowak", address: "Szamotuły, Dworcowa 10", phaseName: "Transport LUPUS lub inny", phone: "600-200-200", personId: 2, type: 'transport' },
  { id: 103, title: "Naprawa gwarancyjna talerzówki", clientName: "Piotr Zieliński", address: "Mława, Warszawska 1", phaseName: "Zgłoszenie usterki", phone: "700-300-300", personId: 3, type: 'service' },
];

export const fetchPipedriveProjects = async (apiKey: string, useMock: boolean): Promise<LogisticsProject[]> => {
  if (useMock) {
    console.log("Używanie danych testowych (Mock)...");
    await new Promise(resolve => setTimeout(resolve, 1000));
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
    // --- KROK 1: POBIERANIE TABLIC (Boards) ---
    console.log('🔍 1. Pobieram listę Tablic (Boards)...');
    const boardsRes = await axios.get(`${PROXY_URL}https://api.pipedrive.com/v1/projects/boards?api_token=${apiKey}`);
    const allBoards = boardsRes.data.data || [];
    
    console.log('📋 Dostępne tablice:', allBoards.map((b: any) => `[${b.id}] ${b.name}`));

    // Znajdź ID tablic
    const transportBoard = allBoards.find((b: any) => /dostarczenie|delivery|transport/i.test(b.name));
    const serviceBoard = allBoards.find((b: any) => /serwis|service|naprawy|warsztat/i.test(b.name));

    if (!transportBoard) console.warn('⚠️ Nie znaleziono tablicy "Dostarczenie"!');
    else console.log(`✅ Tablica Transport: ${transportBoard.name} (ID: ${transportBoard.id})`);

    if (!serviceBoard) console.error('❌ Nie znaleziono tablicy "Serwis"! Sprawdź nazwę w Pipedrive.');
    else console.log(`✅ Tablica Serwis: ${serviceBoard.name} (ID: ${serviceBoard.id})`);

    if (!transportBoard && !serviceBoard) {
      throw new Error('Nie znaleziono ani tablicy transportowej, ani serwisowej.');
    }

    // --- KROK 2: POBIERANIE FAZ (Równolegle) ---
    console.log('🔍 2. Pobieram Fazy...');
    
    const fetchPhases = async (boardId: number | undefined) => {
      if (!boardId) return [];
      const res = await axios.get(`${PROXY_URL}https://api.pipedrive.com/v1/projects/phases?board_id=${boardId}&api_token=${apiKey}`);
      return res.data.data || [];
    };

    const [transportPhasesAll, servicePhasesAll] = await Promise.all([
      fetchPhases(transportBoard?.id),
      fetchPhases(serviceBoard?.id)
    ]);

    // Filtrowanie Faz Transportowych
    const transportPhaseIds = transportPhasesAll
      .filter((p: any) => {
        const n = p.name.toLowerCase();
        return n.includes('przygotowanie') || n.includes('transport') || n.includes('gotowe');
      })
      .map((p: any) => p.id);

    // Filtrowanie Faz Serwisowych (Szerokie filtrowanie)
    const serviceKeywords = ['usterki', 'diagnoza', 'rozwiązanie', 'termin', 'napraw', 'zgłoszenie'];
    const servicePhaseIds = servicePhasesAll
      .filter((p: any) => {
        const n = p.name.toLowerCase();
        return serviceKeywords.some(k => n.includes(k));
      })
      .map((p: any) => p.id);

    console.log(`⚙️ Fazy Transportowe ID: [${transportPhaseIds.join(', ')}]`);
    if (serviceBoard) {
      console.log(`⚙️ Wszystkie Fazy Serwisu:`, servicePhasesAll.map((p: any) => p.name));
      console.log(`⚙️ Wybrane Fazy Serwisu ID: [${servicePhaseIds.join(', ')}]`);
    }

    // Mapa nazw faz dla UI
    const phaseNameMap: Record<number, string> = {};
    [...transportPhasesAll, ...servicePhasesAll].forEach((p: any) => phaseNameMap[p.id] = p.name);

    // --- KROK 3: POBIERANIE WSZYSTKICH PROJEKTÓW ---
    console.log('🔍 3. Pobieram Projekty (Limit 500)...');
    const projectsRes = await axios.get(`${PROXY_URL}https://api.pipedrive.com/v1/projects?status=open&limit=500&api_token=${apiKey}`);
    const allProjects = projectsRes.data.data || [];

    console.log(`📥 Pobrano ${allProjects.length} surowych projektów.`);

    // --- KROK 4: KLASYFIKACJA I FILTROWANIE ---
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

    console.log(`🎯 Po filtracji: ${validProjectsRaw.length} projektów (T: ${validProjectsRaw.filter((p: any) => p._detectedType === 'transport').length}, S: ${validProjectsRaw.filter((p: any) => p._detectedType === 'service').length})`);

    // --- KROK 5: POBIERANIE ADRESÓW I GEOCODING (SEKWENCYJNIE) ---
    console.log(`🐢 Rozpoczynam sekwencyjne geokodowanie ${validProjectsRaw.length} adresów...`);
    
    const logisticsProjects: LogisticsProject[] = [];
    let processedCount = 0;

    // Używamy pętli for..of zamiast Promise.all, aby uniknąć "Failed to fetch"
    // wynikającego z limitów API Nominatim (1 req/sec)
    for (const project of validProjectsRaw) {
      processedCount++;
      if (processedCount % 5 === 0) console.log(`📍 Przetworzono ${processedCount} / ${validProjectsRaw.length} projektów...`);

      let address = '';
      let phone = '';
      let clientName = 'Nieznany';
      
      // Pobierz ID osoby
      const personId = project.person_id?.value || project.person_id;

      if (personId) {
        try {
          // Pipedrive API ma wyższy limit, ale sekwencyjne pobieranie jest bezpieczniejsze przy błędach sieci
          const personRes = await axios.get(`${PROXY_URL}https://api.pipedrive.com/v1/persons/${personId}?api_token=${apiKey}`);
          const personData = personRes.data.data;
          
          clientName = personData.name;
          
          // Logika Adresu
          address = personData[ADDRESS_HASH_KEY];
          if (!address && personData.org_id?.address) address = personData.org_id.address;
          if (!address && personData.postal_address) address = personData.postal_address;

          if (personData.phone?.length > 0) phone = personData.phone[0].value;

        } catch (e) {
          console.error(`Błąd pobierania osoby ID ${personId}`, e);
        }
      }

      // GEOCODING (Funkcja geocodeAddress ma wbudowany delay)
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
        type: project._detectedType // Przypisz wykryty typ
      });
    }

    return logisticsProjects;

  } catch (error) {
    console.error('CRITICAL ERROR fetchPipedriveProjects:', error);
    return [];
  }
};

export const updatePersonAddress = async (personId: number, newAddress: string, apiKey: string, useMock: boolean): Promise<boolean> => {
  if (useMock) return true;
  try {
    console.log(`Updating address for Person ID ${personId} to: ${newAddress}`);
    await axios.put(`${PROXY_URL}https://api.pipedrive.com/v1/persons/${personId}?api_token=${apiKey}`, {
      [ADDRESS_HASH_KEY]: newAddress
    });
    return true;
  } catch (error) {
    console.error("Update Person Error", error);
    return false;
  }
};

/**
 * Moves the project to the next stage based on its type.
 * Transport -> "Maszyna u klienta" (Delivery Board)
 * Service -> "Wykonanie" (Service Board)
 */
export const advanceProjectStage = async (
  projectId: number, 
  type: 'transport' | 'service',
  apiKey: string, 
  useMock: boolean
): Promise<boolean> => {
  if (useMock) {
    alert(`Tryb Mock: Projekt typu ${type} przesunięty do kolejnej fazy.`);
    return true;
  }
  
  try {
    console.log(`🚀 Zamykam projekt ID ${projectId} typu: ${type.toUpperCase()}`);

    // 1. Pobierz wszystkie tablice
    const boardsRes = await axios.get(`${PROXY_URL}https://api.pipedrive.com/v1/projects/boards?api_token=${apiKey}`);
    const allBoards = boardsRes.data.data || [];

    // 2. Określ cel (Board & Phase Regex)
    let boardPattern: RegExp;
    let phasePattern: RegExp;

    if (type === 'transport') {
      boardPattern = /dostarczenie|delivery/i;
      phasePattern = /u klienta|maszyna u klienta/i;
    } else {
      boardPattern = /serwis|service|naprawy/i;
      phasePattern = /wykonanie|zrealizowane|gotowe/i;
    }

    // 3. Znajdź Tablicę
    const targetBoard = allBoards.find((b: any) => boardPattern.test(b.name));
    if (!targetBoard) {
        alert(`Nie znaleziono odpowiedniej tablicy dla typu ${type}.`);
        return false;
    }

    // 4. Znajdź Fazę
    const phasesRes = await axios.get(`${PROXY_URL}https://api.pipedrive.com/v1/projects/phases?board_id=${targetBoard.id}&api_token=${apiKey}`);
    const targetPhase = phasesRes.data.data.find((p: any) => phasePattern.test(p.name));

    if (!targetPhase) {
        console.error('Dostępne fazy:', phasesRes.data.data.map((p:any) => p.name));
        alert(`Nie znaleziono fazy docelowej dla typu ${type} (szukano wzorca: ${phasePattern}).`);
        return false;
    }

    console.log(`✅ Przesuwam do: Tablica [${targetBoard.name}] -> Faza [${targetPhase.name}]`);

    // 5. Wykonaj Update
    await axios.put(
      `${PROXY_URL}https://api.pipedrive.com/v1/projects/${projectId}?api_token=${apiKey}`, 
      { phase_id: targetPhase.id }
    );
    return true;

  } catch (error: any) {
    console.error("Błąd API Pipedrive:", error);
    alert('Błąd Pipedrive API: ' + (error.response?.data?.error || error.message));
    return false;
  }
};
