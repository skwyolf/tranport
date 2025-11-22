
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Sidebar } from './components/Sidebar';
import { fetchPipedriveProjects, advanceProjectStage, updatePersonAddress, getCachedProjects, removeProjectFromCache } from './services/pipedrive';
import { geocodeAddress } from './services/geocoding';
import { LogisticsProject, DEFAULTS } from './types';
import { Phone, User, Layers, Bot, Wrench, Truck } from 'lucide-react';
import { analyzeDelivery } from './services/gemini';

// Fix Leaflet default icon issue in React (browser ESM)
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

// IKONA BAZY LUPUS (Dark Cherry Pin)
const BaseIcon = L.divIcon({
  className: 'bg-transparent border-none',
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#900C3F" class="w-full h-full drop-shadow-md" style="filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.4));"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/><circle cx="12" cy="9" r="2.5" fill="white"/></svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// IKONA SERWISU (Żółta/Pomarańczowa)
const ServiceIcon = L.divIcon({
  className: 'bg-transparent border-none',
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F59E0B" class="w-full h-full drop-shadow-md" style="filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.4));"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/><path d="M12 7l-1.5 3h3L12 13l1.5-3h-3L12 7z" fill="white"/></svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// IKONA TRANSPORTU (Niebieska - domyślna)
const TransportIcon = L.divIcon({
  className: 'bg-transparent border-none',
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2563EB" class="w-full h-full drop-shadow-md" style="filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.4));"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/><circle cx="12" cy="9" r="2.5" fill="white"/></svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});


// DEFINICJA BAZY
const LUPUS_BASE = {
  id: 9999,
  title: 'Baza LUPUS',
  clientName: 'Siedziba Firmy',
  address: 'Mleczarska 6, Ciechanów',
  coordinates: { lat: 52.866405, lng: 20.618454 },
  status: 'open' as const,
  pipedriveLink: '#',
  phaseName: 'CENTRALA',
  type: 'transport' as const
};

// Helper to change map view
function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

const App: React.FC = () => {
  const [projects, setProjects] = useState<LogisticsProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const [configOpen, setConfigOpen] = useState(false);
  const [showMobileList, setShowMobileList] = useState(false); // NEW: Mobile State
  
  // Config State
  const [pipedriveKey, setPipedriveKey] = useState('6c6adad664dfb383b78eccf3ab7726bebb349c72');
  const [useMock, setUseMock] = useState(false);

  // AI State
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Routing State
  const [isRoutingMode, setIsRoutingMode] = useState(false);
  const [route, setRoute] = useState<any[]>([]);

  // Filter State
  const [visibleFilters, setVisibleFilters] = useState({ transport: true, service: true });

  // Filter Logic
  const visibleProjects = useMemo(() => {
    return projects.filter(p => visibleFilters[p.type]);
  }, [projects, visibleFilters]);

  // Helper do pobrania obiektu na podstawie ID
  const selectedProject = useMemo(() => 
    visibleProjects.find(p => p.id === selectedProjectId) || null
  , [visibleProjects, selectedProjectId]);

  const handleToggleFilter = (type: 'transport' | 'service') => {
    setVisibleFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // --- FORCE REFRESH LOGIC ---
  const handleForceRefresh = async () => {
    console.log("🔄 Force Refresh triggered by user.");
    setIsLoading(true);
    try {
      const data = await fetchPipedriveProjects(pipedriveKey, useMock);
      setProjects(data);
      console.log('✅ Dane odświeżone z Pipedrive');
    } catch (err) {
      console.error('Błąd podczas odświeżania:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkDelivered = async (id: number) => {
    console.log("🚀 App: Rozpoczynam procedurę dla ID:", id);
    
    const project = projects.find(p => p.id === id);
    if (!project) return;

    setProcessingId(id);

    try {
      // Wywołanie nowej funkcji ze "Zwrotnicą" (Typ Transport vs Serwis)
      const success = await advanceProjectStage(id, project.type, pipedriveKey, useMock);
      
      if (success) {
        console.log("✅ App: Sukces operacji. Usuwam projekt z widoku.");
        setProjects(prev => prev.filter(p => p.id !== id));
        setRoute(prev => prev.filter(r => r.id !== id));
        
        // NAPRAWA "GHOST EFFECT": Usuń z cache od razu po sukcesie
        removeProjectFromCache(id);

        if (selectedProjectId === id) {
          setSelectedProjectId(null);
          setAiAdvice(null);
        }
      } else {
        console.error("❌ App: Operacja zakończona niepowodzeniem.");
      }
    } catch (err) {
      console.error("💥 App: Krytyczny błąd w handleMarkDelivered:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const loadData = useCallback(async () => {
    // --- KROK 1: ŁADOWANIE Z CACHE (TURBO MODE) ---
    const cached = getCachedProjects();
    if (cached) {
        setProjects(cached);
        setIsLoading(false);
    } else {
        setIsLoading(true);
    }

    try {
      // --- KROK 2: POBIERANIE ŚWIEŻYCH DANYCH (BACKGROUND) ---
      const data = await fetchPipedriveProjects(pipedriveKey, useMock);
      setProjects(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [pipedriveKey, useMock]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectProject = (id: number) => {
    setSelectedProjectId(id);
    setAiAdvice(null);
    setShowMobileList(false); // Auto-close list on mobile when selecting
  };

  const handleMarkerClick = (e: any, item: any) => {
    if (isRoutingMode) {
      console.log("Dodano do trasy:", item.title);
      setRoute(prev => [...prev, item]);
    } else {
      if (item.id === LUPUS_BASE.id) return;
      e.originalEvent.stopPropagation();
      console.log("Map Marker Click: ", item.id);
      handleSelectProject(item.id);
    }
  };

  const handleAskAI = async (project: LogisticsProject) => {
    setLoadingAi(true);
    const advice = await analyzeDelivery(project);
    setAiAdvice(advice);
    setLoadingAi(false);
  };

  const handleManualAddressUpdate = async (projectId: number, newAddress: string) => {
    if (!newAddress.trim()) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    if (project.personId) {
      const success = await updatePersonAddress(project.personId, newAddress, pipedriveKey, useMock);
      if (!success) return;
    }
    
    const coords = await geocodeAddress(newAddress);
    if (coords) {
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, address: newAddress, coordinates: coords, status: 'open' } : p));
    }
  };

  const mapCenter: [number, number] = useMemo(() => {
    return selectedProject && selectedProject.coordinates 
      ? [selectedProject.coordinates.lat, selectedProject.coordinates.lng]
      : [DEFAULTS.CENTER_LAT, DEFAULTS.CENTER_LNG];
  }, [selectedProject]);

  // Zmieniono zoom z 13 na 10, aby był zgodny z maxZoom mapy
  const mapZoom = selectedProject?.coordinates ? 10 : DEFAULTS.ZOOM;

  return (
    <div className="relative h-screen w-screen overflow-hidden flex flex-col md:flex-row bg-gray-100 font-sans text-gray-900">
      
      {/* Config Modal */}
      {configOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96 max-w-full">
            <h2 className="text-xl font-bold mb-4">Ustawienia</h2>
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer mb-4">
                <input type="checkbox" checked={useMock} onChange={(e) => setUseMock(e.target.checked)} className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">Tryb Mock</span>
              </label>
              {!useMock && (
                <input 
                  type="password" 
                  value={pipedriveKey} 
                  onChange={(e) => setPipedriveKey(e.target.value)}
                  className="w-full border p-2 rounded text-sm"
                  placeholder="API Key"
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfigOpen(false)} className="px-4 py-2 text-sm text-gray-600">Anuluj</button>
              <button onClick={() => { setConfigOpen(false); loadData(); }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded">Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar - Responsive Wrapper */}
      <div className={`
        absolute inset-0 z-30 bg-white transition-transform duration-300 ease-in-out transform
        ${showMobileList ? 'translate-y-0' : 'translate-y-full'}
        md:relative md:translate-y-0 md:z-0 md:w-auto shadow-xl md:shadow-none
      `}>
        <Sidebar 
            projects={visibleProjects} 
            isLoading={isLoading} 
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
            filters={visibleFilters}
            onToggleFilter={handleToggleFilter}
            onRefresh={handleForceRefresh}
        />
      </div>

      {/* Mobile Floating Action Button */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[1000] md:hidden">
        <button
          onClick={() => setShowMobileList(!showMobileList)}
          className="bg-blue-600 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 border-2 border-white/20 backdrop-blur-sm active:scale-95 transition-transform"
        >
          {showMobileList ? '🗺️ POKAŻ MAPĘ' : `📋 LISTA (${visibleProjects.length})`}
        </button>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative h-full z-0">
        <MapContainer 
          center={[52.06, 19.25]} 
          zoom={6}
          minZoom={5}
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

          {/* 1. BAZA LUPUS MARKER */}
          <Marker 
            position={[LUPUS_BASE.coordinates.lat, LUPUS_BASE.coordinates.lng]}
            icon={BaseIcon}
            eventHandlers={{
              click: (e) => handleMarkerClick(e, LUPUS_BASE)
            }}
            zIndexOffset={1000}
          >
            <Popup>
              <div className="text-center font-bold text-red-600">🏢 BAZA LUPUS</div>
            </Popup>
          </Marker>

          {/* 2. PROJEKTY MARKERS (Używamy visibleProjects) */}
          {visibleProjects.map((project) => (
            project.coordinates && (
              <Marker 
                key={project.id} 
                position={[project.coordinates.lat, project.coordinates.lng]}
                icon={project.type === 'service' ? ServiceIcon : TransportIcon}
                eventHandlers={{ 
                  click: (e) => handleMarkerClick(e, project)
                }}
              >
                <Popup>
                  <div className="text-center p-1">
                    <div className={`text-[10px] font-bold uppercase mb-1 ${project.type === 'service' ? 'text-amber-600' : 'text-blue-600'}`}>
                        {project.type === 'service' ? '🔧 SERWIS' : '🚚 TRANSPORT'}
                    </div>
                    <strong className="block text-sm text-gray-800 leading-tight">{project.title}</strong>
                    <span className="text-xs text-gray-500">{project.clientName}</span>
                    
                    {isRoutingMode && (
                      <p className="text-[10px] text-green-600 mt-1 font-bold">Kliknij by dodać do trasy</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          ))}

          {/* 3. LINIA TRASY */}
          {route.length > 1 && (
            <Polyline 
              positions={route.map(r => [r.coordinates.lat, r.coordinates.lng])} 
              pathOptions={{ color: 'black', weight: 4, dashArray: '10, 10', opacity: 0.7 }} 
            />
          )}

        </MapContainer>

        {/* Floating Panel */}
        {selectedProject && !isRoutingMode && (
          <div className="absolute bottom-4 right-4 w-80 max-w-[95vw] bg-white shadow-2xl rounded-xl p-5 z-[1000] border border-gray-100 animate-in slide-in-from-bottom-4">
            <div className="flex justify-between mb-3">
              <div className="flex items-start gap-2">
                {selectedProject.type === 'service' 
                    ? <Wrench className="w-5 h-5 text-amber-500 mt-0.5" /> 
                    : <Truck className="w-5 h-5 text-blue-600 mt-0.5" />
                }
                <h3 className="font-bold text-gray-800 text-lg leading-tight">{selectedProject.title}</h3>
              </div>
              <button onClick={() => setSelectedProjectId(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="mt-2 text-sm text-gray-600 space-y-2">
              <p className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400"/> {selectedProject.clientName}</p>
              <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400"/> {selectedProject.phone}</p>
              <p className="flex items-center gap-2"><Layers className="w-4 h-4 text-gray-400"/> {selectedProject.phaseName}</p>
            </div>
            
            <div className="mt-4 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-800 uppercase tracking-wide">Asystent AI</span>
              </div>
              {!aiAdvice && !loadingAi && (
                <button onClick={() => handleAskAI(selectedProject)} className="w-full text-xs bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition font-medium">Generuj wskazówki dla kierowcy</button>
              )}
              {loadingAi && <div className="text-xs animate-pulse text-indigo-600 font-medium">Analizuję trasę...</div>}
              {aiAdvice && <div className="text-xs text-gray-700 italic leading-relaxed">{aiAdvice}</div>}
            </div>
            
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedProject.address)}`} target="_blank" rel="noreferrer" className="block mt-4 text-center text-xs bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 py-2 rounded-md font-bold transition">
              Otwórz w Google Maps
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
