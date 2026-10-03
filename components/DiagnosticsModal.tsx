import React, { useState } from 'react';
import { SyncDiagnosticReport } from '../types';
import { X, Copy, Check, AlertTriangle, CheckCircle, MapPin, Database, Layers, Info } from 'lucide-react';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: SyncDiagnosticReport | null;
  onRefresh: () => void;
  isLoading: boolean;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  report,
  onRefresh,
  isLoading
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!report) return;
    const text = JSON.stringify(report, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-gray-200 overflow-hidden">
        
        {/* HEADER */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Diagnostyka Synchronizacji Pipedrive
                <span className="text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full">
                  LIVE REPORT
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Ostatnie sprawdzenie: {report?.timestamp || 'Brak danych'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!report}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
              title="Kopiuj pełny raport JSON do schowka"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Skopiowano JSON' : 'Kopiuj raport'}
            </button>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
            >
              {isLoading ? 'Odświeżanie...' : 'Uruchom ponownie'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50 text-gray-900 text-xs">
          
          {!report ? (
            <div className="text-center py-12 text-gray-500">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <p className="font-bold text-sm">Brak wygenerowanego raportu diagnostycznego.</p>
              <p className="text-xs text-gray-400 mt-1">Kliknij „Uruchom ponownie”, aby pobrać aktualne dane z Pipedrive.</p>
            </div>
          ) : (
            <>
              {/* PODSUMOWANIE TABLICY DOSTARCZENIE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Karta 1: Tablica i Etapy */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <h3 className="font-bold text-gray-800">1. Tablica Dostarczenie w Pipedrive</h3>
                  </div>
                  
                  <div className="space-y-1.5 mb-3 text-[11px]">
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">Rzeczywista nazwa tablicy:</span>
                      <strong className="text-gray-900 font-mono">{report.deliveryBoard?.name || 'Nie znaleziono'}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">ID tablicy w API:</span>
                      <strong className="text-gray-900 font-mono">{report.deliveryBoard?.id ?? 'Brak ID'}</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Wszystkie tablice w Pipedrive:</span>
                      <span className="text-gray-700 font-semibold">{report.allBoards.length} znalezionych</span>
                    </div>
                  </div>

                  <h4 className="font-bold text-[10px] uppercase text-gray-400 tracking-wider mb-2">
                    Etapy tablicy Dostarczenie i liczba projektów w CRM:
                  </h4>
                  <div className="space-y-1">
                    {report.deliveryPhases.length === 0 ? (
                      <p className="text-gray-400 italic">Brak wykrytych etapów dla tej tablicy.</p>
                    ) : (
                      report.deliveryPhases.map(phase => (
                        <div key={phase.id} className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-200 text-[11px]">
                          <span className="font-medium text-gray-800">
                            {phase.name} <span className="text-gray-400 text-[10px] font-mono">(ID: {phase.id})</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full font-bold text-xs bg-blue-100 text-blue-800">
                            {phase.projectCountInPipedrive} w CRM
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Karta 2: Bilans i Miejsca Utraty Rekordów */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-bold text-gray-800">2. Bilans Liczb i Przepływ Rekordów</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center mb-3">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold block">Wszystkie projekty w API</span>
                      <strong className="text-lg font-black text-slate-800">{report.totalRawProjectsInAPI}</strong>
                    </div>
                    <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200">
                      <span className="text-[10px] text-blue-700 uppercase font-semibold block">Dostarczenie w API</span>
                      <strong className="text-lg font-black text-blue-800">{report.totalDeliveryProjectsInAPI}</strong>
                    </div>
                    <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                      <span className="text-[10px] text-emerald-700 uppercase font-semibold block">Zachowane w Panelu</span>
                      <strong className="text-lg font-black text-emerald-800">{report.totalDeliveryInPanel}</strong>
                    </div>
                    <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-200">
                      <span className="text-[10px] text-purple-700 uppercase font-semibold block">Z koordynatami GPS</span>
                      <strong className="text-lg font-black text-purple-800">{report.totalDeliveryWithGPS}</strong>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                    <div className="font-bold flex items-center gap-1.5 mb-1">
                      <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      Wyjaśnienie rozbieżności:
                    </div>
                    <div>
                      • <strong>Liczba w panelu ({report.totalDeliveryInPanel}):</strong> zawiera wszystkie projekty z dozwolonych etapów (w tym bez adresu lub przed geokodowaniem).<br />
                      • <strong>Liczba na mapie ({report.totalDeliveryWithGPS}):</strong> tylko projekty z potwierdzonym adresem GPS. Projekty bez GPS oczekują na uzupełnienie w panelu.<br />
                      • <strong>Unikalne lokalizacje na mapie ({report.totalUniqueGPSLocations}):</strong> projekty pod tym samym adresem są rozsuwane w piny orbitalne (spiderfy).
                    </div>
                  </div>
                </div>

              </div>

              {/* TABELA: SZCZEGÓŁOWA LISTA PROJEKTÓW DOSTARCZENIA */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="p-3 bg-slate-100 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800 text-xs">
                    3. Szczegółowy wykaz projektów z lejka Dostarczenie ({report.deliveryProjects.length})
                  </h3>
                  <span className="text-[10px] text-gray-500 font-medium">
                    Pokazuje każdy rekord zwrócony przez API i status kwalifikacji
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-gray-600 font-semibold border-b border-gray-200">
                        <th className="p-2.5">ID</th>
                        <th className="p-2.5">Maszyna / Tytuł</th>
                        <th className="p-2.5">Etap (Phase)</th>
                        <th className="p-2.5">Klient w API</th>
                        <th className="p-2.5">Adres tekstowy</th>
                        <th className="p-2.5">GPS</th>
                        <th className="p-2.5">W panelu?</th>
                        <th className="p-2.5">Powód wyłączenia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {report.deliveryProjects.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-gray-400">
                            Brak projektów w tablicy Dostarczenie w odpowiedzi API Pipedrive.
                          </td>
                        </tr>
                      ) : (
                        report.deliveryProjects.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50 transition">
                            <td className="p-2.5 font-mono font-bold text-blue-700">{p.id}</td>
                            <td className="p-2.5 font-semibold text-gray-900 max-w-[200px] truncate" title={p.title}>
                              {p.title}
                            </td>
                            <td className="p-2.5">
                              <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-800 text-[10px]">
                                {p.phaseName}
                              </span>
                            </td>
                            <td className="p-2.5 text-gray-700 max-w-[150px] truncate" title={p.clientExtracted}>
                              {p.clientExtracted}
                            </td>
                            <td className="p-2.5 max-w-[180px] truncate text-gray-500" title={p.addressExtracted || 'Brak'}>
                              {p.addressExtracted || <span className="text-red-500 italic">Brak adresu</span>}
                            </td>
                            <td className="p-2.5">
                              {p.hasGPS ? (
                                <span className="inline-flex items-center gap-1 font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded text-[10px]">
                                  <CheckCircle className="w-3 h-3 text-green-600" />
                                  OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-[10px]">
                                  <AlertTriangle className="w-3 h-3 text-red-500" />
                                  Brak
                                </span>
                              )}
                            </td>
                            <td className="p-2.5">
                              {p.isInPanel ? (
                                <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                                  TAK
                                </span>
                              ) : (
                                <span className="text-red-700 font-bold bg-red-50 px-1.5 py-0.5 rounded text-[10px]">
                                  NIE
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-[10px]">
                              {p.exclusionReason ? (
                                <span className="text-red-600 font-medium bg-red-50 p-1 rounded block">
                                  {p.exclusionReason}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </>
          )}

        </div>

        {/* FOOTER */}
        <div className="p-3 bg-white border-t border-gray-200 flex justify-between items-center flex-shrink-0 text-xs text-gray-500">
          <span>Raport nie zawiera tokenów ani prywatnych kluczy autoryzacyjnych.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition"
          >
            Zamknij
          </button>
        </div>

      </div>
    </div>
  );
};
