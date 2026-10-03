import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Sidebar, FilterGroupType } from './components/Sidebar';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { 
  fetchPipedriveProjects, 
  advanceProjectStage, 
  updatePersonAddress, 
  updateOrganizationAddress,
  getCachedProjects, 
  removeProjectFromCache,
  saveProjectsToCache,
  getSavedDiagnosticReport
} from './services/pipedrive';
import { geocodeAddress, updateGeoCache } from './services/geocoding';
import { LogisticsProject, DEFAULTS, ProjectGroup, SyncDiagnosticReport } from './types';

// Fix Leaflet default icon issue in React
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const iconShadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: iconUrl,
    shadowUrl: iconShadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

// 1. IKONA BAZY LUPUS (Ciemna wiśnia / Dark Cherry Pin)
const BaseIcon = L.divIcon({
  className: 'bg-transparent border-none',
  html: `<div class="relative flex items-center justify-center w-9 h-9" style="filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.45));">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#900C3F" class="w-full h-full"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/><circle cx="12" cy="9" r="2.5" fill="white"/></svg>
    <span class="absolute top-[6px] text-[9px] font-black text-[#900C3F]">L</span>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36]
});

// 2. IKONA PRODUKCJI (Brązowa / Brown Pin)
const ProductionIcon = L.divIcon({
  className: 'bg-transparent border-none',
  html: `<div class="relative flex items-center justify-center w-8 h-8" style="filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.35));">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#8B4513" class="w-full h-full"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="4" fill="white"/><path d="M12 7.2a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6z" fill="#78350F"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// 3. IKONA DOSTARCZENIA (Niebieska / Blue Pin)
const TransportIcon = L.divIcon({
  className: 'bg-transparent border-none',
  html: `<div class="relative flex items-center justify-center w-8 h-8" style="filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.35));">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2563EB" class="w-full h-full"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="4" fill="white"/><circle cx="12" cy="9" r="2" fill="#2563EB"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// 4. IKONA SERWISU (Żółta ze znakiem serwisu / Yellow Pin)
const ServiceIcon = L.divIcon({
  className: 'bg-transparent border-none',
  html: `<div class="relative flex items-center justify-center w-8 h-8" style="filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.35));">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#EAB308" class="w-full h-full"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#CA8A04" stroke-width="0.5"/><circle cx="12" cy="9" r="4" fill="white"/><path d="M10.8 7.5l2.4 2.4-1.2 1.2-2.4-2.4 1.2-1.2z" fill="#A16207"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// DEFINICJA BAZY LUPUS (Centrala w Ciechanowie)
const LUPUS_BASE = {
  id: 9999,
  title: 'Baza Centralna LUPUS',
  clientName: 'Siedziba Firmy Lupus',
  address: 'ul. Mleczarska 6, 06-400 Ciechanów',
  coordinates: { lat: DEFAULTS.BASE_LAT, lng: DEFAULTS.BASE_LNG },
  status: 'open' as const,
  pipedriveLink: 'https://lupus.pipedrive.com',
  boardName: 'CENTRALA',
  phaseName: 'Baza Maszyn i Serwisu',
  boardId: 0,
  phaseId: 0,
  type: 'transport' as const
};

// Helper do płynnej zmiany widoku mapy
function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

const App: React.FC = () => {
  const [projects, setProjects] = useState<LogisticsProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const [configOpen, setConfigOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<SyncDiagnosticReport | null>(() => getSavedDiagnosticReport());
  const [showMobileList, setShowMobileList] = useState(false); 
  
  // Konfiguracja API Pipedrive — aktywny klucz użytkownika do żywych danych CRM
  const [pipedriveKey, setPipedriveKey] = useState('6c6adad664dfb383b78eccf3ab7726bebb349c72');
  const [useMock, setUseMock] = useState(false);

  // Stan Trasowania
  const [isRoutingMode, setIsRoutingMode] = useState(false);
  const [route, setRoute] = useState<any[]>([]);

  // Filtry: 'all' | 'production' | 'transport' | 'service'
  const [activeFilter, setActiveFilter] = useState<FilterGroupType>('all');
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  // Filtracja projektów
  const visibleProjects = useMemo(() => {
    return projects.filter(p => {
      if (showErrorsOnly) {
        return p.status === 'geocoding_error';
      }
      if (activeFilter === 'all') return true;
      return p.type === activeFilter;
    });
  }, [projects, activeFilter, showErrorsOnly]);

  const selectedProject = useMemo(() => 
    visibleProjects.find(p => p.id === selectedProjectId) || null
  , [visibleProjects, selectedProjectId]);

  /**
   * Kilka projektów w jednym miejscu (Nakładanie się znaczników).
   * Rozsuwamy punkty o identycznych współrzędnych (Spiderfy),
   * zachowując rzeczywiste współrzędne w `project.coordinates` dla nawigacji GPS!
   */
  const mappedProjectsWithOffsets = useMemo(() => {
    const validWithCoords = visibleProjects.filter(p => p.coordinates !== null);
    
    // Grupujemy punkty po kluczu zaokrąglonych koordynatów
    const groups: Record<string, LogisticsProject[]> = {};
    for (const p of validWithCoords) {
      if (!p.coordinates) continue;
      const key = `${p.coordinates.lat.toFixed(4)}_${p.coordinates.lng.toFixed(4)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }

    const result: {
      project: LogisticsProject;
      displayLat: number;
      displayLng: number;
      originalLat: number;
      originalLng: number;
      groupProjects: LogisticsProject[];
      isSpiderfied: boolean;
    }[] = [];

    Object.values(groups).forEach(group => {
      if (group.length === 1) {
        const p = group[0];
        result.push({
          project: p,
          displayLat: p.coordinates!.lat,
          displayLng: p.coordinates!.lng,
          originalLat: p.coordinates!.lat,
          originalLng: p.coordinates!.lng,
          groupProjects: group,
          isSpiderfied: false
        });
      } else {
        const count = group.length;
        const radius = 0.0035;
        group.forEach((p, idx) => {
          const angle = (idx / count) * 2 * Math.PI;
          const offsetLat = Math.sin(angle) * radius;
          const offsetLng = Math.cos(angle) * (radius * 1.5);
          result.push({
            project: p,
            displayLat: p.coordinates!.lat + offsetLat,
            displayLng: p.coordinates!.lng + offsetLng,
            originalLat: p.coordinates!.lat,
            originalLng: p.coordinates!.lng,
            groupProjects: group,
            isSpiderfied: true
          });
        });
      }
    });

    return result;
  }, [visibleProjects]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setSyncWarning(null);

    // 1. Natychmiastowe załadowanie z cache
    const cached = getCachedProjects();
    if (cached && cached.length > 0) {
      setProjects(cached);
    }

    try {
      const result = await fetchPipedriveProjects(pipedriveKey, useMock, cached || []);
      if (result) {
        setProjects(result.projects);
        setDiagnosticReport(result.diagnosticReport);
        if (result.warnings.length > 0) {
          setSyncWarning(result.warnings.join(' | '));
        }
      } else {
        setSyncWarning("Błąd pobierania danych. Wyświetlane są dane z pamięci podręcznej.");
      }
    } catch (err: any) {
      console.error("Błąd podczas pobierania danych:", err);
      setSyncWarning("Błąd połączenia z Pipedrive API. Pracujesz w trybie offline/cache.");
    } finally {
      setIsLoading(false);
    }
  }, [pipedriveKey, useMock]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleForceRefresh = async () => {
    await loadData();
  };

  /**
   * Zakończenie etapu (Dostarczono dla transportu, Wykonano dla serwisu).
   */
  const handleMarkDelivered = async (id: number) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;

    if (project.type === 'production') {
      console.warn("Projekty produkcyjne nie podlegają zakończeniu z poziomu mapy.");
      return;
    }

    setProcessingId(id);

    try {
      const success = await advanceProjectStage(id, project.type, pipedriveKey, useMock);
      if (success) {
        setProjects(prev => {
          const updated = prev.filter(p => p.id !== id);
          saveProjectsToCache(updated);
          return updated;
        });
        setRoute(prev => prev.filter(r => r.id !== id));
        removeProjectFromCache(id);
        if (selectedProjectId === id) {
          setSelectedProjectId(null);
        }
      }
    } catch (err) {
      console.error("Błąd podczas oznaczania zakończenia projektu:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSelectProject = (id: number) => {
    setSelectedProjectId(id);
    setShowMobileList(false);
  };

  const handleMarkerClick = (e: any, item: any) => {
    if (isRoutingMode) {
      setRoute(prev => {
        if (prev.length > 0 && prev[prev.length - 1].id === item.id) return prev;
        return [...prev, item];
      });
    } else {
      if (item.id === LUPUS_BASE.id) return;
      e.originalEvent.stopPropagation();
      handleSelectProject(item.id);
    }
  };

  /**
   * Korekta adresu klienta
   */
  const handleManualAddressUpdate = async (projectId: number, newAddress: string) => {
    if (!newAddress.trim()) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    if (project.personId) {
      await updatePersonAddress(project.personId, newAddress, pipedriveKey, useMock);
    } else if (project.orgId) {
      await updateOrganizationAddress(project.orgId, newAddress, pipedriveKey, useMock);
    }
    
    const coords = await geocodeAddress(newAddress);
    if (coords) {
      updateGeoCache(newAddress, coords);
      setProjects(prev => {
        const updated = prev.map(p => {
          const isSameClient = 
            p.id === projectId || 
            (project.personId && p.personId === project.personId) ||
            (project.orgId && p.orgId === project.orgId && !p.personId);

          if (isSameClient) {
            return {
              ...p,
              address: newAddress,
              coordinates: coords,
              status: 'open' as const
            };
          }
          return p;
        });
        saveProjectsToCache(updated);
        return updated;
      });
    }
  };

  const mapCenter: [number, number] = useMemo(() => {
    return selectedProject && selectedProject.coordinates 
      ? [selectedProject.coordinates.lat, selectedProject.coordinates.lng]
      : [DEFAULTS.CENTER_LAT, DEFAULTS.CENTER_LNG];
  }, [selectedProject]);

  const mapZoom = selectedProject?.coordinates ? 11 : DEFAULTS.ZOOM;

  const getMarkerIcon = (type: ProjectGroup) => {
    switch (type) {
      case 'production':
        return ProductionIcon;
      case 'transport':
        return TransportIcon;
      case 'service':
        return ServiceIcon;
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden flex flex-col md:flex-row bg-gray-100 font-sans text-gray-900">
      
      {/* MODAL USTAWIEŃ */}
      {configOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 max-w-full border border-gray-100 animate-in fade-in duration-200">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Ustawienia Źródła Danych</h2>
            <p className="text-xs text-gray-500 mb-4">Wybierz tryb pracy lub podaj klucz Pipedrive API.</p>
            
            <div className="mb-4">
              <label className="flex items-center gap-2.5 cursor-pointer mb-3 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                <input 
                  type="checkbox" 
                  checked={useMock} 
                  onChange={(e) => setUseMock(e.target.checked)} 
                  className="w-4 h-4 text-blue-600 rounded" 
                />
                <div>
                  <span className="text-xs font-bold text-gray-800 block">Tryb demonstracyjny (Mock Data)</span>
                  <span className="text-[11px] text-gray-400">Przykładowe dane z produkcji, dostaw i serwisu</span>
                </div>
              </label>

              {!useMock && (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Pipedrive API Token:</label>
                  <input 
                    type="password" 
                    value={pipedriveKey} 
                    onChange={(e) => setPipedriveKey(e.target.value)}
                    className="w-full border border-gray-300 p-2 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Wklej api_token..."
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Token jest używany bezpośrednio do zapytań o tablice, fazy i klientów.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button 
                onClick={() => setConfigOpen(false)} 
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Anuluj
              </button>
              <button 
                onClick={() => { setConfigOpen(false); loadData(); }} 
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-xs"
              >
                Zastosuj i Odśwież
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PANEL BOCZNY (SIDEBAR) */}
      <div className={`
        absolute inset-0 z-30 bg-white transition-transform duration-300 ease-in-out transform
        ${showMobileList ? 'translate-y-0' : 'translate-y-full'}
        md:relative md:translate-y-0 md:z-0 md:w-auto shadow-2xl md:shadow-none
      `}>
        <Sidebar 
            projects={visibleProjects} 
            allProjectsCount={projects.length}
            isLoading={isLoading} 
            syncWarning={syncWarning}
            onSelectProject={handleSelectProject}
            onDeliver={handleMarkDelivered} 
            onUpdateAddress={handleManualAddressUpdate}
            configOpen={configOpen}
            setConfigOpen={setConfigOpen}
            selectedProjectId={selectedProjectId}
            processingId={processingId}
            isRoutingMode={isRoutingMode}
            setIsRoutingMode={setIsRoutingMode}
            route={route}
            setRoute={setRoute}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            showErrorsOnly={showErrorsOnly}
            setShowErrorsOnly={setShowErrorsOnly}
            onOpenDiagnostics={() => setDiagnosticsOpen(true)}
            onRefresh={loadData}
        />
      </div>

      {/* PRZYCISK MOBILNY PRZEŁĄCZANIA LISTY */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[1000] md:hidden">
        <button
          onClick={() => setShowMobileList(!showMobileList)}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-2xl font-bold text-xs flex items-center gap-2 border border-white/20 active:scale-95 transition-transform"
        >
          {showMobileList ? '🗺️ Pokaż Mapę' : `📋 Lista zleceń (${visibleProjects.length})`}
        </button>
      </div>

      {/* GŁÓWNA MAPA LEAFLET */}
      <div className="flex-1 relative h-full z-0">

        {/* PŁYWAJĄCA LEGENDA MAPY I STATUSU EUROPY */}
        <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/90 p-2.5 text-xs select-none hidden sm:block max-w-[270px]">
          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
            <span className="font-extrabold text-[11px] text-slate-800 uppercase tracking-wider">LEGENDA PROCESÓW</span>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
              🇪🇺 Polska i Europa
            </span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#900C3F] border border-white shadow-xs flex-shrink-0 flex items-center justify-center text-[7px] font-black text-white">L</span>
              <span className="font-bold text-slate-800">Baza LUPUS (Ciechanów)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#8B4513] border border-white shadow-xs flex-shrink-0"></span>
              <span className="font-semibold text-slate-700">Produkcja (<span className="text-[#8B4513] font-bold">Brązowy</span>)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#2563EB] border border-white shadow-xs flex-shrink-0"></span>
              <span className="font-semibold text-slate-700">Dostarczenie (<span className="text-[#2563EB] font-bold">Niebieski</span>)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#EAB308] border border-white shadow-xs flex-shrink-0"></span>
              <span className="font-semibold text-slate-700">Serwis (<span className="text-yellow-700 font-bold">Żółty</span>)</span>
            </div>
          </div>
        </div>

        <MapContainer 
          center={[DEFAULTS.CENTER_LAT, DEFAULTS.CENTER_LNG]} 
          zoom={DEFAULTS.ZOOM}
          minZoom={4}
          maxZoom={18}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', minHeight: '100vh' }}
          className="flex-1 h-full w-full z-0"
        >
          <TileLayer
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            attribution="&copy; Google Maps"
          />
          <MapUpdater center={mapCenter} zoom={mapZoom} />

          {/* BAZA CENTRALNA LUPUS (Ciechanów) */}
          <Marker 
            position={[LUPUS_BASE.coordinates.lat, LUPUS_BASE.coordinates.lng]}
            icon={BaseIcon}
            eventHandlers={{
              click: (e) => handleMarkerClick(e, LUPUS_BASE)
            }}
            zIndexOffset={2000}
          >
            <Popup>
              <div className="p-1 text-center min-w-[200px]">
                <div className="text-[10px] font-black uppercase text-red-700 tracking-wider mb-0.5">CENTRALNA BAZA</div>
                <h3 className="font-extrabold text-sm text-gray-900">🏢 LUPUS CIECHANÓW</h3>
                <p className="text-xs text-gray-600 mt-1">ul. Mleczarska 6, 06-400 Ciechanów</p>
                <div className="mt-2 pt-2 border-t border-gray-100 flex gap-1 justify-center">
                  <button
                    onClick={() => {
                      const coords = `${LUPUS_BASE.coordinates.lat},${LUPUS_BASE.coordinates.lng}`;
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords}`, '_blank');
                    }}
                    className="bg-slate-900 text-white px-3 py-1 rounded text-[11px] font-bold hover:bg-slate-800 transition"
                  >
                    Nawiguj do Bazy
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>

          {/* LINIE SPIDERFY ŁĄCZĄCE Z ORYGINALNYM PUNKTEM W PRZYPADKU KILKU PROJEKTÓW W JEDNYM MIEJSCU */}
          {mappedProjectsWithOffsets.map(({ project, displayLat, displayLng, originalLat, originalLng, isSpiderfied }) => (
            isSpiderfied && (
              <Polyline 
                key={`spider-line-${project.id}`}
                positions={[[originalLat, originalLng], [displayLat, displayLng]]}
                pathOptions={{ color: '#94A3B8', weight: 1.5, dashArray: '2, 3', opacity: 0.8 }}
              />
            )
          ))}

          {/* PUNKTY PROJEKTÓW NA MAPIE */}
          {mappedProjectsWithOffsets.map(({ project, displayLat, displayLng, originalLat, originalLng, groupProjects, isSpiderfied }) => {
            const isService = project.type === 'service';
            const isTransport = project.type === 'transport';
            const isProduction = project.type === 'production';

            const groupName = isProduction ? 'PRODUKCJA' : isTransport ? 'DOSTARCZENIE' : 'SERWIS';
            const groupColor = isProduction 
              ? 'text-[#78350F] bg-amber-50 border-amber-300' 
              : isTransport 
                ? 'text-blue-700 bg-blue-50 border-blue-200' 
                : 'text-yellow-800 bg-yellow-50 border-yellow-300';

            return (
              <Marker 
                key={project.id} 
                position={[displayLat, displayLng]}
                icon={getMarkerIcon(project.type)}
                zIndexOffset={selectedProjectId === project.id ? 1500 : 500}
                eventHandlers={{ 
                  click: (e) => handleMarkerClick(e, project)
                }}
              >
                <Popup>
                  <div className="p-2 min-w-[250px] max-w-[320px] text-gray-900">
                    {/* OZNACZENIE GRUPY I KOLORU */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${groupColor}`}>
                        {groupName}
                      </span>
                      {isSpiderfied && (
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {groupProjects.length} zlecenia pod tym adresem
                        </span>
                      )}
                    </div>

                    {/* CZTERY PODSTAWOWE INFORMACJE ZGODNIE Z PUNKTEM 5 INSTRUKCJI */}
                    <div className="space-y-1.5 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 mb-2.5">
                      {/* 1. Klient */}
                      <div>
                        <span className="text-gray-500 font-medium block text-[10px] uppercase">Klient:</span>
                        <strong className="text-gray-900 font-bold text-xs">{project.clientName}</strong>
                      </div>

                      {/* 2. Maszyna / zlecenie */}
                      <div>
                        <span className="text-gray-500 font-medium block text-[10px] uppercase">Maszyna / zlecenie:</span>
                        <strong className="text-gray-800 font-semibold text-xs">{project.title}</strong>
                      </div>

                      {/* 3. Etap */}
                      <div>
                        <span className="text-gray-500 font-medium block text-[10px] uppercase">Etap:</span>
                        <span className="inline-block bg-white text-slate-800 px-1.5 py-0.5 rounded border border-slate-200 font-medium text-[11px]">
                          {project.phaseName}
                        </span>
                      </div>

                      {/* 4. Lejek */}
                      <div>
                        <span className="text-gray-500 font-medium block text-[10px] uppercase">Lejek:</span>
                        <span className="text-slate-700 font-medium text-[11px]">{project.boardName}</span>
                      </div>
                    </div>

                    {/* POMOCNICZO: ADRES I TELEFON */}
                    <div className="text-xs text-gray-600 mb-3 space-y-1">
                      <div className="text-[11px] text-gray-500 flex items-start gap-1">
                        <span>📍</span>
                        <span className="leading-tight">{project.address}</span>
                      </div>

                      {project.phone && (
                        <div>
                          <a 
                            href={`tel:${project.phone}`} 
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-green-700 font-bold text-xs hover:underline"
                          >
                            📞 {project.phone}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* INNE ZLECENIA POD TYM SAMYM ADRESEM (JEŚLI ISTNIEJĄ) */}
                    {isSpiderfied && groupProjects.length > 1 && (
                      <div className="mb-2.5 p-2 bg-amber-50/70 border border-amber-200 rounded text-[11px]">
                        <span className="font-bold text-amber-900 block mb-1">Inne zlecenia pod tym adresem:</span>
                        <div className="space-y-1">
                          {groupProjects.filter(gp => gp.id !== project.id).map(gp => (
                            <button
                              key={`other-${gp.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectProject(gp.id);
                              }}
                              className="w-full text-left p-1 bg-white hover:bg-amber-100 rounded border border-amber-200 flex items-center justify-between text-[10px] font-semibold text-gray-800"
                            >
                              <span className="truncate max-w-[150px]">{gp.title}</span>
                              <span className={`px-1 rounded text-[9px] font-bold ${
                                gp.type === 'production' ? 'text-[#78350F]' : gp.type === 'transport' ? 'text-blue-700' : 'text-yellow-800'
                              }`}>
                                {gp.type === 'production' ? 'PROD' : gp.type === 'transport' ? 'DOST' : 'SERW'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* PRZYCISK NAWIGACJI GOOGLE MAPS (ZAWSZE RZECZYWISTE WSPÓŁRZĘDNE GPS!) */}
                    {!isRoutingMode && (
                      <button
                        onClick={(e) => {
                           e.stopPropagation();
                           const coords = `${originalLat},${originalLng}`;
                           window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords}`, '_blank');
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold transition-colors flex items-center justify-center gap-1.5 text-xs shadow-xs"
                      >
                        🗺️ NAWIGUJ (GOOGLE)
                      </button>
                    )}

                    {isRoutingMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkerClick(e, project);
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1"
                      >
                        ➕ Dodaj do trasy
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* RYSOWANIE TRASY */}
          {route.length > 1 && (
            <Polyline 
              positions={route.map(r => [r.coordinates.lat, r.coordinates.lng])} 
              pathOptions={{ color: '#0F172A', weight: 4, dashArray: '8, 8', opacity: 0.8 }} 
            />
          )}

        </MapContainer>
      </div>

      {/* MODAL DIAGNOSTYKI SYNCHRONIZACJI PIPEDRIVE */}
      <DiagnosticsModal 
        isOpen={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        report={diagnosticReport}
        onRefresh={handleForceRefresh}
        isLoading={isLoading}
      />
    </div>
  );
};

export default App;