import React, { useEffect, useState } from 'react';
import { getDrivers, callDriver, updateDriverStatus, rejectDriver, getGateConfigs } from '../services/dataService';
import { DriverData, QueueStatus, GateConfig } from '../types';
import { 
  Truck, MapPin, Megaphone, X, List, Phone, ExternalLink, Loader2, Ban, Send,
  FileText, Clock, CheckSquare, XCircle, Eye, AlertTriangle, Search, RefreshCw, LayoutGrid
} from 'lucide-react';
import { getStatusLabel, getStatusColor } from '../utils/formatters';

const AdminDashboard: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  // --- STATE ---
  const [viewMode, setViewMode] = useState<'VISUAL' | 'TABLE'>('TABLE');
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [availableGates, setAvailableGates] = useState<GateConfig[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection & Modal
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null);
  const [selectedGateForCall, setSelectedGateForCall] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{url: string, title: string} | null>(null);

  // Filters
  const [activeFilter, setActiveFilter] = useState<'VERIFIKASI' | 'BONGKAR' | 'SELESAI'>('VERIFIKASI');
  const [searchQuery, setSearchQuery] = useState('');

  // --- DATA FETCHING ---
  const refresh = async () => {
    setLoading(true);
    try {
        const [d, g] = await Promise.all([getDrivers(), getGateConfigs()]);
        setDrivers(d);
        setAvailableGates(g);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(() => { getDrivers().then(setDrivers); }, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- ACTIONS ---
  const handleOpenAssign = (driver: DriverData) => {
    setSelectedDriver(driver);
    setSelectedGateForCall('');
    setIsModalOpen(true);
  };

  const handleConfirmCall = async () => {
    if (selectedDriver && selectedGateForCall) {
      setProcessingId(selectedDriver.id);
      await callDriver(selectedDriver.id, "Admin Ops", selectedGateForCall);
      
      // FIX WA: Ambil data dengan aman agar tidak NULL
      const plate = selectedDriver.licensePlate || '-';
      const name = selectedDriver.name || 'Driver';
      const gate = selectedGateForCall.replace(/_/g, ' '); 
      const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

      const message = `PANGGILAN MANUAL (URGENT)\n\n` +
             `Kepada: ${name}\n` +
             `Plat Nomor: ${plate}\n\n` +
             `--------------------------------------------\n` +
             `INSTRUKSI: Harap SEGERA menuju ke *${gate}*\n` +
             `Waktu Panggil: ${time}\n` +
             `--------------------------------------------\n` +
             `Sociolla Warehouse Management`;

      // Buka WA
      const phone = selectedDriver.phone.replace(/\D/g,'').replace(/^0/,'62');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');

      setIsModalOpen(false);
      setProcessingId(null);
      await refresh();
    }
  };

  const handleStatusUpdate = async (id: string, status: QueueStatus) => {
      if(!window.confirm("Lanjutkan update status?")) return;
      setProcessingId(id);
      await updateDriverStatus(id, status);
      await refresh();
      setProcessingId(null);
  };

  const handleReject = async (driver: DriverData) => {
      const reason = prompt("Alasan Penolakan:", "Dokumen tidak lengkap");
      if (reason) {
          setProcessingId(driver.id);
          await rejectDriver(driver.id, reason, "Admin");
          await refresh();
          setProcessingId(null);
      }
  };

  // --- HELPERS ---
  const getGateOccupant = (gateName: string) => {
      return drivers.find(d => d.gate === gateName && [QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status));
  };

  const getDuration = (startTime: number) => {
      const diff = Date.now() - startTime;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      return { hours, minutes };
  };

  // --- FILTER LOGIC ---
  const filteredData = drivers.filter(d => {
      const matchSearch = d.licensePlate.toLowerCase().includes(searchQuery.toLowerCase()) || d.company.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      if (activeFilter === 'VERIFIKASI') return d.status === QueueStatus.CHECKED_IN;
      if (activeFilter === 'BONGKAR') return [QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status);
      if (activeFilter === 'SELESAI') return d.status === QueueStatus.COMPLETED;
      return false;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
        
        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0">
                    <Truck className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="font-bold text-xl text-slate-900 tracking-tight">OPERATIONAL DASHBOARD</h1>
                    <p className="text-xs font-medium text-slate-500">WAREHOUSE MANAGEMENT SYSTEM</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
                 <div className="relative group flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Cari Plat / Vendor..." 
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    />
                 </div>
                 <button onClick={() => refresh()} className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
                 {onBack && <button onClick={onBack} className="px-5 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 border border-red-100">LOGOUT</button>}
            </div>
        </header>

        <main className="flex-1 p-6 md:p-8 max-w-[1920px] mx-auto w-full">
            
            {/* KPI CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                    { title: "Menunggu Gate", count: drivers.filter(d => d.status === QueueStatus.CHECKED_IN).length, color: "text-amber-600", icon: Clock },
                    { title: "Sedang Proses", count: drivers.filter(d => [QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status)).length, color: "text-blue-600", icon: Loader2 },
                    { title: "Selesai", count: drivers.filter(d => d.status === QueueStatus.COMPLETED).length, color: "text-emerald-600", icon: CheckSquare },
                    { title: "Mode Tampilan", label: viewMode === 'TABLE' ? "Tabel Data" : "Visual Grid", color: "text-slate-600", icon: LayoutGrid, action: () => setViewMode(viewMode === 'TABLE' ? 'VISUAL' : 'TABLE') }
                ].map((kpi, i) => (
                    <div key={i} onClick={kpi.action} className={`bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all ${kpi.action ? 'cursor-pointer hover:border-blue-300' : ''}`}>
                        <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{kpi.title}</div>
                        <div className={`text-3xl font-black ${kpi.color}`}>{kpi.count ?? kpi.label}</div>
                        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1"><kpi.icon className="w-3 h-3"/> Update Realtime</div>
                    </div>
                ))}
            </div>

            {/* CONTENT AREA */}
            {viewMode === 'TABLE' ? (
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
                    {/* TABS */}
                    <div className="flex border-b border-slate-100 p-2 gap-2 bg-slate-50/50">
                        {['VERIFIKASI', 'BONGKAR', 'SELESAI'].map((tab) => (
                            <button key={tab} onClick={() => setActiveFilter(tab as any)}
                                className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeFilter === tab ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* TABLE */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-400 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="px-8 py-5">Kendaraan</th>
                                    <th className="px-8 py-5">Vendor & Dokumen</th>
                                    <th className="px-8 py-5">Status & Lokasi</th>
                                    <th className="px-8 py-5 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.length === 0 ? (
                                    <tr><td colSpan={4} className="p-12 text-center text-slate-400 font-bold">Data tidak ditemukan</td></tr>
                                ) : filteredData.map(d => (
                                    <tr key={d.id} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="px-8 py-6 align-top">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center font-black text-lg text-slate-500 border border-slate-200">{d.licensePlate.slice(-1)}</div>
                                                <div>
                                                    <div className="font-black text-xl text-slate-800 font-mono">{d.licensePlate}</div>
                                                    <div className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-fit mt-1">Antrian #{d.queueNumber}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 align-top">
                                            <div className="font-bold text-slate-700">{d.company}</div>
                                            <div className="text-xs text-slate-500 mb-2">{d.name}</div>
                                            <div className="flex gap-2">
                                                <button onClick={() => window.open(`https://wa.me/${d.phone.replace(/\D/g,'').replace(/^0/,'62')}`, '_blank')} className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-[10px] font-bold border border-green-200 flex items-center gap-1 hover:bg-green-100"><Phone className="w-3 h-3"/> WA</button>
                                                {d.documentFile && <button onClick={() => setPreviewDoc({url: d.documentFile!, title: d.licensePlate})} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 flex items-center gap-1 hover:bg-blue-100"><Eye className="w-3 h-3"/> Dokumen</button>}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 align-top">
                                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusColor(d.status)}`}>
                                                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                                                {getStatusLabel(d.status)}
                                            </span>
                                            <div className="mt-2 text-xs font-bold text-slate-600 flex items-center gap-1">
                                                <MapPin className="w-3 h-3 text-slate-400"/> {d.gate === 'NONE' ? 'Menunggu Gate' : d.gate.replace(/_/g, ' ')}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 align-top text-right">
                                            <div className="flex justify-end gap-2">
                                                {activeFilter === 'VERIFIKASI' && (
                                                    <>
                                                        <button onClick={() => handleReject(d)} className="p-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 border border-red-200"><XCircle className="w-4 h-4"/></button>
                                                        <button onClick={() => handleOpenAssign(d)} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-blue-600 shadow-md flex items-center gap-2 transition-all"><Megaphone className="w-3 h-3"/> PANGGIL</button>
                                                    </>
                                                )}
                                                {activeFilter === 'BONGKAR' && (
                                                    <>
                                                        {d.status === QueueStatus.CALLED && <button onClick={() => handleStatusUpdate(d.id, QueueStatus.LOADING)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow">MULAI</button>}
                                                        {d.status === QueueStatus.LOADING && <button onClick={() => handleStatusUpdate(d.id, QueueStatus.COMPLETED)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow">SELESAI</button>}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                // VISUAL GRID MODE
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {availableGates.filter(g => g.type === 'DOCK').map(gate => {
                        const occupant = getGateOccupant(gate.name);
                        const isBusy = !!occupant;
                        return (
                            <div key={gate.id} className={`rounded-3xl p-6 border-2 min-h-[200px] flex flex-col justify-between relative overflow-hidden transition-all ${isBusy ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
                                <div className="flex justify-between items-start z-10">
                                    <span className="text-2xl font-black text-slate-800">{gate.name}</span>
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${isBusy ? 'bg-blue-200 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{isBusy ? 'BUSY' : 'READY'}</span>
                                </div>
                                {isBusy ? (
                                    <div className="z-10 mt-4">
                                        <div className="text-3xl font-black text-slate-900 font-mono tracking-tight">{occupant.licensePlate}</div>
                                        <div className="text-xs text-slate-500 font-bold mt-1 truncate">{occupant.company}</div>
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-10"><Truck className="w-24 h-24"/></div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </main>

        {/* MODAL ASSIGN GATE (GRID BESAR) */}
        {isModalOpen && selectedDriver && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div>
                            <h3 className="font-bold text-lg text-slate-800">Pilih Gate / Dock</h3>
                            <p className="text-xs text-slate-500">Klik gate yang kosong untuk memanggil driver</p>
                        </div>
                        <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5"/></button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto">
                        <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-xl font-black text-blue-600">{selectedDriver.licensePlate.slice(-1)}</div>
                            <div>
                                <h4 className="font-black text-2xl text-slate-800 font-mono">{selectedDriver.licensePlate}</h4>
                                <p className="text-xs text-slate-500 font-bold uppercase">{selectedDriver.name} • {selectedDriver.company}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {availableGates.filter(g => g.status === 'OPEN').map(gate => {
                                const occupant = getGateOccupant(gate.name);
                                const isBusy = !!occupant;
                                const isSelected = selectedGateForCall === gate.name;
                                
                                return (
                                    <button key={gate.id} onClick={() => !isBusy && setSelectedGateForCall(gate.name)} disabled={isBusy}
                                        className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 min-h-[100px] transition-all relative ${isSelected ? 'bg-slate-800 text-white border-slate-800 scale-105 shadow-xl' : isBusy ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-blue-400'}`}>
                                        <span className="text-lg font-black">{gate.name}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isBusy ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{isBusy ? 'OCCUPIED' : 'AVAILABLE'}</span>
                                        {isSelected && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="p-6 border-t border-slate-100 bg-slate-50">
                        <button onClick={handleConfirmCall} disabled={!selectedGateForCall || processingId === selectedDriver.id} 
                            className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2">
                            {processingId ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Megaphone className="w-5 h-5"/> KONFIRMASI PANGGILAN</>}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL PREVIEW DOC */}
        {previewDoc && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setPreviewDoc(null)}>
                <div className="bg-white rounded-2xl overflow-hidden max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold">{previewDoc.title}</h3><button onClick={() => setPreviewDoc(null)}><X/></button></div>
                    <div className="flex-1 bg-slate-100 p-4 flex justify-center overflow-auto"><img src={previewDoc.url} className="max-w-full rounded shadow"/></div>
                </div>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
