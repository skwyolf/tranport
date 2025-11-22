
import React, { useState, useEffect, useRef } from 'react';
import { LogisticsProject } from '../types';
import { Search, AlertTriangle, CheckCircle, MapPin, Truck, Settings, Phone, User, Layers, Check, Loader2, Map, X, ExternalLink, Copy, Star, Pencil, Save, Filter, RefreshCw } from 'lucide-react';

interface SidebarProps {
  projects: LogisticsProject[];
  isLoading: boolean;
  onSelectProject: (id: number) => void;
  onDeliver: (id: number) => void;
  onUpdateAddress: (projectId: number, newAddress: string) => Promise<void>;
  configOpen: boolean;
  setConfigOpen: (v: boolean) => void;
  selectedProjectId: number | null;
  processingId: number | null;
  // Routing Props
  isRoutingMode: boolean;
  setIsRoutingMode: (v: boolean) => void;
  route: any[];
  setRoute: React.Dispatch<React.SetStateAction<any[]>>;
  // Filtering Props
  filters: { transport: boolean; service: boolean };
  onToggleFilter: (type: 'transport' | 'service') => void;
  // Force Refresh
  onRefresh: () => void;
}

// Helper: Haversine Distance in KM
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  projects, 
  isLoading, 
  onSelectProject, 
  onDeliver, 
  onUpdateAddress,
  configOpen,
  setConfigOpen,
  selectedProjectId,
  processingId,
  isRoutingMode,
  setIsRoutingMode,
  route,
  setRoute,
  filters,
  onToggleFilter,
  onRefresh
}) => {
  const [filterText, setFilterText] = useState('');
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  
  // --- ADDRESS EDITING STATE ---
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editAddressValue, setEditAddressValue] = useState('');
  const [localLoadingId, setLocalLoadingId] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // REF do scrollowania
  const itemsRef = useRef<Record<number, HTMLDivElement | null>>({});

  // Auto-scroll do wybranego elementu
  useEffect(() => {
    if (selectedProjectId && itemsRef.current[selectedProjectId]) {
      itemsRef.current[selectedProjectId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedProjectId]);

  const filteredProjects = projects.filter(p => {
    const matchesText = 
      p.title.toLowerCase().includes(filterText.toLowerCase()) || 
      p.clientName.toLowerCase().includes(filterText.toLowerCase()) ||
      p.address.toLowerCase().includes(filterText.toLowerCase());
    
    if (showErrorsOnly) {
      return matchesText && p.status === 'geocoding_error';
    }
    return matchesText;
  });

  const validCount = projects.filter(p => p.status === 'open').length;
  const errorCount = projects.filter(p => p.status === 'geocoding_error').length;

  const startEditing = (project: LogisticsProject) => {
    setEditingProjectId(project.id);
    setEditAddressValue(project.address);
  };

  const cancelEditing = () => {
    setEditingProjectId(null);
    setEditAddressValue('');
  };

  const handleSaveAddress = async (id: number) => {
     if (!editAddressValue.trim()) return;
     setLocalLoadingId(id);
     await onUpdateAddress(id, editAddressValue);
     setLocalLoadingId(null);
     setEditingProjectId(null);
  };

  // Oblicz całkowity dystans trasy (lotem ptaka)
  const totalDistance = route.reduce((acc, curr, idx) => {
    if (idx === 0) return 0;
    const prev = route[idx - 1];
    return acc + calculateDistance(prev.coordinates.lat, prev.coordinates.lng, curr.coordinates.lat, curr.coordinates.lng);
  }, 0).toFixed(1);

  // --- GOOGLE MAPS LOGIC ---
  const generateMapsLink = () => {
    if (route.length < 2) return '';
    const coordsPath = route
        .map(pt => `${pt.coordinates.lat},${pt.coordinates.lng}`)
        .join('/');
    return `https://www.google.com/maps/dir/${coordsPath}`;
  };

  const handleOpenGoogleMaps = () => {
    const url = generateMapsLink();
    if (url) window.open(url, '_blank');
  };

  const handleCopyLink = async () => {
    const url = generateMapsLink();
    if (url) {
        try {
            await navigator.clipboard.writeText(url);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    }
  };

  const removeFromRoute = (idx: number) => {
      setRoute(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="w-full md:w-96 bg-white shadow-2xl flex flex-col h-full border-r border-gray-100 z-20 relative">
      {/* Header */}
      <div className="p-5 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 shadow-md">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-3">
            <Truck className="w-6 h-6 text-emerald-400" />
            LUPUS LOGISTICS
          </h1>
          <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Logistics Control Center</p>
        </div>
        <div className="flex items-center gap-1">
            <button 
                onClick={onRefresh} 
                disabled={isLoading}
                className={`p-2 rounded-full transition text-slate-300 hover:text-white hover:bg-slate-700 ${isLoading ? 'animate-spin' : ''}`}
                title="Odśwież dane z Pipedrive"
            >
                <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={() => setConfigOpen(!configOpen)} className="p-2 hover:bg-slate-700 rounded-full transition text-slate-300 hover:text-white">
                <Settings className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* ROUTING PANEL (TIMELINE STYLE) */}
      <div className={`transition-all duration-300 border-b ${isRoutingMode ? 'bg-slate-50 border-emerald-200 shadow-inner p-4' : 'bg-white border-gray-100 p-4'}`}>
        <div className="flex items-center justify-between mb-4">
            <span className={`text-sm font-bold flex items-center gap-2 ${isRoutingMode ? 'text-emerald-800' : 'text-gray-500'}`}>
                <Map className={`w-4 h-4 ${isRoutingMode ? 'text-emerald-600' : 'text-gray-400'}`} />
                {isRoutingMode ? 'Kreator Trasy' : 'Planowanie Trasy'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={isRoutingMode} onChange={(e) => setIsRoutingMode(e.target.checked)} className="sr-only peer" />
                <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-sm"></div>
            </label>
        </div>
        
        {isRoutingMode && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                {route.length > 0 ? (
                    <>
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-4">
                            <div className="flex flex-col">
                                {route.map((pt, idx) => {
                                    const isLast = idx === route.length - 1;
                                    const isBase = pt.id === 9999;
                                    return (
                                        <div key={`${pt.id}-${idx}`} className="flex relative pb-4 last:pb-0">
                                            {/* Timeline Line */}
                                            {!isLast && (
                                                <div className="absolute left-[15px] top-6 bottom-0 w-0.5 border-l-2 border-dashed border-gray-300 z-0"></div>
                                            )}
                                            
                                            {/* Badge */}
                                            <div className="z-10 flex-shrink-0 w-8 h-8 mr-3 flex items-center justify-center rounded-full shadow-sm border-2 border-white ring-1 ring-gray-200 bg-gray-100">
                                                {isBase ? (
                                                    <Star className="w-4 h-4 text-red-500 fill-current" />
                                                ) : (
                                                    <span className="text-xs font-bold text-blue-600">{idx + 1}</span>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 flex justify-between items-start pt-1 min-w-0">
                                                <div className="mr-2">
                                                    <p className="text-sm font-bold text-gray-800 truncate">{pt.title}</p>
                                                    {idx > 0 && (
                                                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                                                            + {calculateDistance(route[idx-1].coordinates.lat, route[idx-1].coordinates.lng, pt.coordinates.lat, pt.coordinates.lng).toFixed(1)} km
                                                        </p>
                                                    )}
                                                </div>
                                                <button onClick={() => removeFromRoute(idx)} className="text-gray-300 hover:text-red-500 transition p-1">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            <div className="mt-4 pt-3 border-t border-dashed border-gray-200 flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wide">
                               <span>Dystans: {totalDistance} km</span>
                               <button onClick={() => setRoute([])} className="text-red-500 hover:text-red-700 transition">Wyczyść</button>
                            </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="grid grid-cols-1 gap-2">
                            <button 
                                onClick={handleOpenGoogleMaps}
                                disabled={route.length < 2}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition shadow-sm text-sm"
                            >
                                <ExternalLink className="w-4 h-4" />
                                NAWIGUJ (Google Maps)
                            </button>
                            <button 
                                onClick={handleCopyLink}
                                disabled={route.length < 2}
                                className="w-full py-3 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition text-sm"
                            >
                                {linkCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                {linkCopied ? 'Skopiowano!' : 'Kopiuj Link'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="text-gray-400 text-sm text-center py-6 border-2 border-dashed border-gray-200 rounded-xl bg-white">
                        <p className="mb-1">Trasa jest pusta.</p>
                        <p className="text-xs">Kliknij na mapie <b className="text-red-500">BAZĘ</b> lub transporty.</p>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* CATEGORY FILTERS */}
      {!isRoutingMode && (
        <div className="p-3 bg-white border-b border-gray-100 grid grid-cols-2 gap-3">
            <button 
                onClick={() => onToggleFilter('transport')}
                className={`
                    flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border transition-all
                    ${filters.transport 
                        ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                        : 'bg-gray-50 border-gray-100 text-gray-400 grayscale hover:grayscale-0 hover:bg-gray-100'}
                `}
            >
                <MapPin className={`w-4 h-4 ${filters.transport ? 'text-blue-600 fill-blue-600/20' : 'text-gray-400'}`} />
                <span className="text-xs font-bold">Transporty</span>
            </button>
            <button 
                onClick={() => onToggleFilter('service')}
                className={`
                    flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border transition-all
                    ${filters.service 
                        ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm' 
                        : 'bg-gray-50 border-gray-100 text-gray-400 grayscale hover:grayscale-0 hover:bg-gray-100'}
                `}
            >
                <MapPin className={`w-4 h-4 ${filters.service ? 'text-amber-500 fill-amber-500/20' : 'text-gray-400'}`} />
                <span className="text-xs font-bold">Serwisy</span>
            </button>
        </div>
      )}

      {/* Stats Bar */}
      {!isRoutingMode && (
      <div className="grid grid-cols-2 border-b border-gray-100 flex-shrink-0 bg-white">
        <div className="p-3 text-center border-r border-gray-100">
          <span className="block text-2xl font-black text-emerald-600">{validCount}</span>
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Widoczne</span>
        </div>
        <div className={`p-3 text-center cursor-pointer transition hover:bg-red-50 ${showErrorsOnly ? 'bg-red-50 shadow-inner' : ''}`} onClick={() => setShowErrorsOnly(!showErrorsOnly)}>
          <span className="block text-2xl font-black text-red-500">{errorCount}</span>
          <span className="text-[10px] text-red-400 uppercase font-bold tracking-wider">Błędy</span>
        </div>
      </div>
      )}

      {/* Search */}
      {!isRoutingMode && (
      <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex-shrink-0">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 transition-colors group-focus-within:text-blue-500" />
          <input 
            type="text" 
            placeholder="Szukaj maszyny, klienta..." 
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition shadow-sm"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      </div>
      )}

      {/* List - MODERN CARDS */}
      <div className={`flex-1 overflow-y-auto bg-gray-50/50 px-4 py-4 ${isRoutingMode ? 'opacity-40 pointer-events-none grayscale filter blur-[1px]' : ''}`}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Loader2 className="animate-spin h-8 w-8 text-emerald-500 mb-3" />
            <span className="text-sm font-medium">Pobieranie danych...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center text-gray-400 py-10">
            <p className="text-sm">Brak wyników.</p>
            {!filters.transport && !filters.service && <p className="text-xs mt-1">Włącz filtry powyżej.</p>}
          </div>
        ) : (
          <div className="pb-20 space-y-3">
            {filteredProjects.map((project) => {
              const isSelected = selectedProjectId === project.id;
              const isProcessing = processingId === project.id;
              const isEditing = editingProjectId === project.id;

              return (
                <div 
                  key={project.id}
                  ref={(el) => { itemsRef.current[project.id] = el; }}
                  onClick={() => !isEditing && onSelectProject(project.id)}
                  className={`
                    relative overflow-hidden bg-white rounded-xl border p-4 transition-all duration-200 cursor-pointer group
                    ${project.status === 'geocoding_error' 
                        ? 'border-red-200 shadow-sm ring-1 ring-red-100' 
                        : isSelected 
                            ? 'border-blue-500 ring-2 ring-blue-100 shadow-lg z-10 transform scale-[1.02]' 
                            : 'border-gray-100 shadow-sm hover:shadow-md hover:border-gray-300'
                    }
                  `}
                >
                  {/* Selection Indicator */}
                  {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>}
                  {project.status === 'geocoding_error' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>}

                  {/* Header Projektu */}
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-sm text-gray-900 leading-tight">
                      {project.title}
                    </h3>
                    {project.status === 'geocoding_error' && (
                       <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 ml-2" />
                    )}
                  </div>
                  
                  {/* Dane Klienta */}
                  <div className="flex flex-col gap-1.5 mb-4">
                      {/* Wiersz Klient + Link CRM */}
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600 flex items-center gap-2">
                          <div className="bg-gray-100 p-1 rounded-md"><User className="w-3 h-3 text-gray-500" /></div>
                          <span className="font-semibold truncate max-w-[160px]">{project.clientName}</span>
                        </div>
                        <a
                            href={project.pipedriveLink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-2 py-0.5 rounded transition-colors"
                            title="Otwórz w Pipedrive"
                        >
                            CRM <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      {project.phone && (
                        <div className="text-xs text-blue-600 flex items-center gap-2">
                          <div className="bg-blue-50 p-1 rounded-md"><Phone className="w-3 h-3" /></div>
                          <span className="font-medium">{project.phone}</span>
                        </div>
                      )}

                      {/* ADDRESS SECTION - EDITABLE */}
                      <div className="text-xs text-gray-500 flex items-start gap-2 mt-0.5">
                          <div className="bg-gray-100 p-1 rounded-md mt-0.5 flex-shrink-0">
                              <MapPin className={`w-3 h-3 ${project.status === 'geocoding_error' ? 'text-red-500' : 'text-gray-500'}`} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                              {isEditing ? (
                                  <div className="flex flex-col gap-2 animate-in fade-in duration-200">
                                      <input 
                                          type="text"
                                          className="w-full border border-blue-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                                          value={editAddressValue}
                                          onChange={(e) => setEditAddressValue(e.target.value)}
                                          autoFocus
                                          onClick={(e) => e.stopPropagation()}
                                          onKeyDown={(e) => {
                                              if (e.key === 'Enter') handleSaveAddress(project.id);
                                              if (e.key === 'Escape') cancelEditing();
                                          }}
                                      />
                                      <div className="flex gap-2">
                                          <button 
                                              onClick={(e) => { e.stopPropagation(); handleSaveAddress(project.id); }}
                                              disabled={localLoadingId === project.id}
                                              className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1"
                                          >
                                              {localLoadingId === project.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                              ZAPISZ
                                          </button>
                                          <button 
                                              onClick={(e) => { e.stopPropagation(); cancelEditing(); }}
                                              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded text-[10px] font-bold"
                                          >
                                              ANULUJ
                                          </button>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="flex items-start justify-between group/addr">
                                      <span className={`leading-relaxed ${project.status === 'geocoding_error' ? 'text-red-600 font-medium' : ''}`}>
                                          {project.address}
                                          {project.status === 'geocoding_error' && <span className="block text-[10px] text-red-400 italic">Błąd lokalizacji. Kliknij ołówek, aby poprawić.</span>}
                                      </span>
                                      <button 
                                          onClick={(e) => { e.stopPropagation(); startEditing(project); }}
                                          className="text-gray-400 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50 transition opacity-0 group-hover/addr:opacity-100 focus:opacity-100"
                                          title="Edytuj adres"
                                      >
                                          <Pencil className="w-3 h-3" />
                                      </button>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {project.phaseName}
                    </span>

                    {project.status === 'open' && !isEditing && (
                        <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeliver(project.id);
                        }}
                        disabled={isProcessing}
                        className={`
                            px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all
                            ${isProcessing 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-white border border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:shadow-sm active:scale-95'}
                        `}
                        >
                        {isProcessing ? (
                            <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Zapis...</span>
                            </>
                        ) : (
                            <>
                            <CheckCircle className="w-3 h-3" />
                            <span>ZAKOŃCZ</span>
                            </>
                        )}
                        </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
