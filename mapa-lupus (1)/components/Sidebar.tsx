import React, { useState, useEffect, useRef } from 'react';
import { LogisticsProject, ProjectGroup } from '../types';
import { 
  Search, AlertTriangle, CheckCircle, MapPin, Truck, Settings, 
  User, Layers, Check, Loader2, Map, X, ExternalLink, Copy, Star, 
  Pencil, Save, RefreshCw, Wrench, Factory, Filter, AlertCircle, Info, Activity
} from 'lucide-react';

export type FilterGroupType = 'all' | 'production' | 'transport' | 'service';

interface SidebarProps {
  projects: LogisticsProject[];
  allProjectsCount: number;
  isLoading: boolean;
  syncWarning?: string | null;
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
  activeFilter: FilterGroupType;
  setActiveFilter: (filter: FilterGroupType) => void;
  showErrorsOnly: boolean;
  setShowErrorsOnly: (show: boolean) => void;
  // Diagnostics
  onOpenDiagnostics: () => void;
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
  allProjectsCount,
  isLoading, 
  syncWarning,
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
  activeFilter,
  setActiveFilter,
  showErrorsOnly,
  setShowErrorsOnly,
  onOpenDiagnostics,
  onRefresh
}) => {
  const [filterText, setFilterText] = useState('');
  
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
    const term = filterText.toLowerCase();
    const matchesText = 
      p.title.toLowerCase().includes(term) || 
      p.clientName.toLowerCase().includes(term) ||
      p.address.toLowerCase().includes(term) ||
      p.boardName.toLowerCase().includes(term) ||
      p.phaseName.toLowerCase().includes(term);
    
    return matchesText;
  });

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

  const totalDistance = route.reduce((acc, curr, idx) => {
    if (idx === 0) return 0;
    const prev = route[idx - 1];
    return acc + calculateDistance(prev.coordinates.lat, prev.coordinates.lng, curr.coordinates.lat, curr.coordinates.lng);
  }, 0).toFixed(1);

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

  const getGroupBadge = (type: ProjectGroup) => {
    switch(type) {
      case 'production':
        return {
          label: 'Produkcja',
          badgeClass: 'bg-amber-100 text-[#78350F] border-amber-300',
          barClass: 'bg-[#78350F]',
          icon: <Factory className="w-3 h-3 text-[#78350F]" />
        };
      case 'transport':
        return {
          label: 'Dostarczenie',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
          barClass: 'bg-blue-600',
          icon: <Truck className="w-3 h-3 text-blue-600" />
        };
      case 'service':
        return {
          label: 'Serwis',
          badgeClass: 'bg-yellow-100 text-yellow-900 border-yellow-300',
          barClass: 'bg-yellow-500',
          icon: <Wrench className="w-3 h-3 text-yellow-700" />
        };
    }
  };

  return (
    <div className="w-full md:w-[410px] bg-white shadow-2xl flex flex-col h-full border-r border-gray-100 z-20 relative">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex justify-between items-center flex-shrink-0 shadow-md">
        <div>
          <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-600 shadow-sm ring-2 ring-white/30"></span>
            MAPA LUPUS
          </h1>
          <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
            Centrum Zarządzania Dostawami i Serwisem
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {/* PRZYCISK DIAGNOSTYKI PIPEDRIVE */}
          <button 
            onClick={onOpenDiagnostics}
            className="p-2 bg-slate-800 hover:bg-blue-900 rounded-lg text-slate-300 hover:text-white transition flex items-center gap-1"
            title="Diagnostyka synchronizacji Pipedrive"
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-bold hidden sm:inline">Raport</span>
          </button>

          <button 
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition disabled:opacity-50"
            title="Wymuś odświeżenie danych z Pipedrive"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
          <button 
            onClick={() => setIsRoutingMode(!isRoutingMode)}
            className={`p-2 rounded-lg transition text-xs font-bold flex items-center gap-1.5 ${
                isRoutingMode 
                ? 'bg-blue-600 text-white shadow-inner ring-2 ring-blue-400' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Tryb wyznaczania trasy"
          >
            <Map className="w-4 h-4" />
            <span className="text-xs">Trasa</span>
            {route.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {route.length}
                </span>
            )}
          </button>
          <button 
            onClick={() => setConfigOpen(!configOpen)}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition"
            title="Konfiguracja API"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SYNCHRONIZATION WARNING / CACHE NOTIFICATION */}
      {syncWarning && (
        <div className="bg-amber-50 border-b border-amber-200 p-2.5 px-4 flex items-center gap-2.5 text-amber-900 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
          <div className="flex-1 leading-tight text-[11px] font-medium">
            {syncWarning}
          </div>
        </div>
      )}

      {/* PASEK WYSZUKIWANIA I TRASY */}
      <div className="p-3 bg-gray-50 border-b border-gray-100 flex flex-col gap-2">
        {!isRoutingMode ? (
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Szukaj klienta, maszyny, adresu, lejka..." 
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                {filterText && (
                  <button 
                    onClick={() => setFilterText('')}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ×
                  </button>
                )}
            </div>
        ) : (
            <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-sm flex flex-col gap-2.5">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                        <Map className="w-3.5 h-3.5 text-blue-600" />
                        Trasa: {route.length} pkt
                    </span>
                    <button 
                        onClick={() => setRoute([])}
                        className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline"
                    >
                        Wyczyść
                    </button>
                </div>

                {route.length > 0 ? (
                    <>
                        <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                            {route.map((pt, idx) => (
                                <div key={`route-item-${idx}`} className="flex items-center justify-between text-xs bg-gray-50 p-1.5 rounded border border-gray-100">
                                    <div className="flex items-center gap-1.5 truncate">
                                        <span className="font-bold text-gray-600 text-[11px]">{idx + 1}.</span>
                                        <span className="truncate max-w-[240px] text-gray-800 font-medium">
                                          {pt.id === 9999 ? '🏢 BAZA LUPUS' : pt.clientName} ({pt.title})
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => removeFromRoute(idx)}
                                        className="text-gray-400 hover:text-red-500 font-bold px-1"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-center text-xs font-bold border-t border-gray-100 pt-2 text-gray-800">
                            <span>Szacowany dystans:</span>
                            <span className="text-blue-700 font-black text-sm">{totalDistance} km</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={handleOpenGoogleMaps}
                                disabled={route.length < 2}
                                className="py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 transition shadow-sm text-xs"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Nawiguj w Google
                            </button>
                            <button 
                                onClick={handleCopyLink}
                                disabled={route.length < 2}
                                className="py-2.5 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition text-xs"
                            >
                                {linkCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                {linkCopied ? 'Skopiowano!' : 'Kopiuj link'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="text-gray-400 text-xs text-center py-4 border-2 border-dashed border-gray-200 rounded-lg bg-white">
                        <p className="mb-0.5 font-medium">Trasa jest pusta.</p>
                        <p className="text-[10px]">Kliknij na mapie <b className="text-red-600">BAZĘ</b> lub dowolne punkty klientów.</p>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* FILTRY: Wszystkie / Produkcja / Dostarczenie / Serwis + Błędy */}
      {!isRoutingMode && (
        <div className="p-3 bg-white border-b border-gray-100 flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => { setActiveFilter('all'); setShowErrorsOnly(false); }}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all text-center border ${
                activeFilter === 'all' && !showErrorsOnly
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              Wszystkie
            </button>
            <button
              onClick={() => { setActiveFilter('production'); setShowErrorsOnly(false); }}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all text-center border ${
                activeFilter === 'production' && !showErrorsOnly
                  ? 'bg-[#78350F] text-white border-[#78350F] shadow-sm'
                  : 'bg-amber-50 text-[#78350F] border-amber-200 hover:bg-amber-100'
              }`}
            >
              Produkcja
            </button>
            <button
              onClick={() => { setActiveFilter('transport'); setShowErrorsOnly(false); }}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all text-center border ${
                activeFilter === 'transport' && !showErrorsOnly
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
            >
              Dostarczenie
            </button>
            <button
              onClick={() => { setActiveFilter('service'); setShowErrorsOnly(false); }}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all text-center border ${
                activeFilter === 'service' && !showErrorsOnly
                  ? 'bg-yellow-500 text-slate-950 border-yellow-500 shadow-sm font-black'
                  : 'bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100'
              }`}
            >
              Serwis
            </button>
          </div>

          {/* Stage pills breakdown when viewing Dostarczenie or All */}
          {activeFilter === 'transport' && !showErrorsOnly && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
              <button
                onClick={() => setFilterText(filterText === 'Gotowa' ? '' : 'Gotowa')}
                className={`px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap transition ${
                  filterText.includes('Gotowa')
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                }`}
              >
                Gotowa – płatność i wydanie ({projects.filter(p => p.type === 'transport' && /gotow|p[lł]atno|wydani/i.test(p.phaseName)).length})
              </button>
              <button
                onClick={() => setFilterText(filterText === 'Transport' ? '' : 'Transport')}
                className={`px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap transition ${
                  filterText.includes('Transport')
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                }`}
              >
                Transport LUPUS ({projects.filter(p => p.type === 'transport' && /transport|przew[oó]z|lupus/i.test(p.phaseName)).length})
              </button>
              <button
                onClick={() => setFilterText(filterText === 'Oczekuj' ? '' : 'Oczekuj')}
                className={`px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap transition ${
                  filterText.includes('Oczekuj')
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                }`}
              >
                Oczekuję ({projects.filter(p => p.type === 'transport' && /oczekuj|oczekiwan/i.test(p.phaseName)).length})
              </button>
            </div>
          )}

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-gray-500 font-medium">
              Widoczne zlecenia: <strong className="text-gray-800">{filteredProjects.length}</strong>
            </span>
            <button
              onClick={() => setShowErrorsOnly(!showErrorsOnly)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                showErrorsOnly 
                  ? 'bg-red-500 text-white border-red-500' 
                  : 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              Błędy adresu ({projects.filter(p => p.status === 'geocoding_error').length})
            </button>
          </div>
        </div>
      )}

      {/* LISTA PROJEKTÓW */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50">
        {isLoading && projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-xs">Ładowanie zleceń z Pipedrive...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs">
            <p className="font-semibold text-gray-500">Brak zleceń spełniających kryteria</p>
            <p className="text-[11px] mt-1">Spróbuj zmienić filtr grupy lub wyczyścić pole wyszukiwania.</p>
          </div>
        ) : (
          filteredProjects.map((project) => {
            const isSelected = selectedProjectId === project.id;
            const isProcessing = processingId === project.id;
            const isEditing = editingProjectId === project.id;
            const groupInfo = getGroupBadge(project.type);

            return (
              <div 
                key={project.id}
                ref={el => itemsRef.current[project.id] = el}
                onClick={() => onSelectProject(project.id)}
                className={`
                  relative bg-white rounded-xl border p-3 cursor-pointer transition-all duration-150 shadow-xs
                  ${isSelected 
                    ? 'border-blue-500 ring-2 ring-blue-100 shadow-md bg-blue-50/20' 
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-xs'}
                  ${project.status === 'geocoding_error' ? 'border-l-4 border-l-red-500' : ''}
                `}
              >
                {/* Pasek grupy z lewej strony */}
                <div className={`absolute top-0 bottom-0 left-0 w-1 rounded-l-xl ${groupInfo.barClass}`} />

                <div className="pl-1.5">
                  {/* Nagłówek: Grupa i Status */}
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${groupInfo.badgeClass}`}>
                      {groupInfo.icon}
                      {groupInfo.label}
                    </span>

                    <div className="flex items-center gap-1">
                      {project.status === 'geocoding_error' ? (
                        <span className="inline-flex items-center gap-0.5 text-red-600 text-[10px] font-bold bg-red-50 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3" />
                          Brak GPS
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-mono">
                          #{project.id}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 4 PODSTAWOWE DANE Z PUNKTU 5 INSTRUKCJI */}
                  
                  {/* 1. Klient */}
                  <div className="mb-1">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Klient:</div>
                    <div className="font-extrabold text-sm text-gray-900 leading-tight">
                      {project.clientName}
                    </div>
                  </div>

                  {/* 2. Maszyna / zlecenie */}
                  <div className="mb-1.5">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Maszyna / zlecenie:</div>
                    <div className="font-bold text-xs text-gray-800 leading-snug">
                      {project.title}
                    </div>
                  </div>

                  {/* 3 & 4: Etap i Lejek */}
                  <div className="grid grid-cols-2 gap-2 py-1.5 px-2 bg-gray-50 rounded-lg border border-gray-100 text-[11px] mb-2">
                    <div>
                      <span className="text-gray-400 text-[10px] block font-medium">Etap:</span>
                      <strong className="text-gray-800 font-bold truncate block" title={project.phaseName}>
                        {project.phaseName}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block font-medium">Lejek:</span>
                      <span className="text-gray-700 truncate block font-medium" title={project.boardName}>
                        {project.boardName}
                      </span>
                    </div>
                  </div>

                  {/* Telefon kontaktowy (jeśli istnieje) */}
                  {project.phone && (
                    <div className="mb-1 text-[11px] flex items-center gap-1 text-gray-600">
                      <a 
                        href={`tel:${project.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-green-700 font-bold hover:underline flex items-center gap-1"
                      >
                        <span>📞</span>
                        <span>{project.phone}</span>
                      </a>
                    </div>
                  )}

                  {/* Pomocniczo: Adres z możliwością edycji */}
                  <div className="mt-2 pt-2 border-t border-gray-100 pl-1.5 text-xs text-gray-500">
                    {isEditing ? (
                      <div className="flex flex-col gap-1.5 mt-1">
                        <label className="text-[10px] font-bold text-gray-700 flex items-center justify-between">
                          <span>Adres klienta (Polska / Europa / GPS):</span>
                          <span className="text-[9px] text-blue-600 font-normal">np. Słowacja, Czechy, Niemcy</span>
                        </label>
                        <input 
                            type="text"
                            className="w-full border border-blue-400 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="np. Nitra, Słowacja lub ul. Długa 10, Mława lub 48.3061, 18.0764"
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
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1"
                            >
                                {localLoadingId === project.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Zapisz w CRM
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); cancelEditing(); }}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs font-medium"
                            >
                                Anuluj
                            </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between group/addr gap-2">
                        <div className="flex items-start gap-1">
                          <MapPin className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${project.status === 'geocoding_error' ? 'text-red-500' : 'text-gray-400'}`} />
                          <span className={`leading-relaxed text-[11px] ${project.status === 'geocoding_error' ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                            {project.address || '(Brak wprowadzonego adresu)'}
                          </span>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); startEditing(project); }}
                            className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition flex-shrink-0"
                            title="Edytuj adres klienta"
                        >
                            <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* AKCJA: ZAKOŃCZ / DOSTARCZONE */}
                  {project.type !== 'production' && project.status === 'open' && !isEditing && (
                    <div className="mt-2.5 pt-2 border-t border-gray-100 pl-1.5 flex justify-end">
                      <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeliver(project.id);
                        }}
                        disabled={isProcessing}
                        className={`
                            px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all
                            ${isProcessing 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : project.type === 'transport'
                              ? 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200'
                              : 'bg-yellow-50 text-yellow-900 hover:bg-yellow-500 hover:text-slate-950 border border-yellow-300'}
                        `}
                      >
                        {isProcessing ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Zapisywanie w CRM...</span>
                            </>
                        ) : (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>{project.type === 'transport' ? 'DOSTARCZONO' : 'WYKONANO'}</span>
                            </>
                        )}
                      </button>
                    </div>
                  )}

                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};