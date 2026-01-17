import React, { useEffect, useState } from 'react';
import { getDrivers, callDriver, updateDriverStatus, rejectDriver, getGateConfigs } from '../services/dataService';
import { DriverData, QueueStatus, GateConfig } from '../types';
import { 
  Truck, MapPin, Megaphone, X, LayoutGrid, List, Phone, ExternalLink, Loader2, Ban, Send,
  FileText, Clock, CheckSquare, XCircle, AlertCircle, Eye, AlertTriangle
} from 'lucide-react';
import { getStatusLabel, getStatusColor } from '../utils/formatters';

const AdminDashboard: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  // --- STATE ---
  const [viewMode, setViewMode] = useState<'VISUAL' | 'TABLE'>('TABLE');
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Processing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Document Preview Modal
  const [previewDoc, setPreviewDoc] = useState<{url: string, type: 'DOC' | 'PHOTO', title: string} | null>(null);

  // Gate Selection
  const [availableGates, setAvailableGates] = useState<GateConfig[]>([]);
  const [selectedGateForCall, setSelectedGateForCall] = useState<string>('');

  // Filter
  const [activeFilter, setActiveFilter] = useState<'VERIFIKASI' | 'BONGKAR' | 'SELESAI'>('VERIFIKASI');

  const refresh = async () => {
    const [data, gates] = await Promise.all([getDrivers(), getGateConfigs()]);
    setDrivers(data);
    setAvailableGates(gates); 
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
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
      
      // MENGGUNAKAN TEMPLATE MANUAL_CALL
      const message = generateWATemplate(selectedDriver, selectedGateForCall);
      const url = `https://wa.me/${selectedDriver.phone.replace(/^0/, '62').replace(/\D/g,'')}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');

      setIsModalOpen(false);
      setProcessingId(null);
      await refresh();
    }
  };

  const handleStatusUpdate = async (id: string, status: QueueStatus) => {
      setProcessingId(id);
      await updateDriverStatus(id, status);
      await refresh();
      setProcessingId(null);
  };

  const handleReject = async (driver: DriverData) => {
      const reason = prompt(`Masukkan alasan penolakan untuk ${driver.licensePlate}:`, "Operasional Dibatalkan / Dokumen Invalid");
      if (reason) {
          setProcessingId(driver.id);
          await rejectDriver(driver.id, reason, "Admin Control");
          await refresh();
          setProcessingId(null);
      }
  };

  // [TEMPLATE 10: MANUAL_CALL]
  const generateWATemplate = (driver: DriverData, gateName?: string) => {
      const gate = gateName || driver.gate.replace(/_/g, ' '); 
      const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

      return `PANGGILAN MANUAL (URGENT)\n\n` +
             `Kepada Driver: ${driver.name}\n` +
             `Plat Nomor: ${driver.licensePlate}\n\n` +
             `--------------------------------------------\n` +
             `INSTRUKSI KHUSUS:\n` +
             `Harap SEGERA menuju ke: *${gate}*\n` +
             `Waktu Panggil: ${timeNow}\n` +
             `--------------------------------------------\n\n` +
             `Tim operasional sedang menunggu di lokasi.\n` +
             `Mohon respon pesan ini jika ada kendala.\n\n` +
             `Sociolla Warehouse Management`;
  };

  // [TEMPLATE 9: WARNING_VIOLATION]
  const sendWarningWA = (driver: DriverData) => {
      const msg = `PERINGATAN PELANGGARAN\n\n` +
                  `Halo ${driver.name},\n` +
                  `Kami mendeteksi ketidaksesuaian prosedur.\n` +
                  `--------------------------------------------\n` +
                  `Jenis : Pelanggaran Tata Tertib Area\n` +
                  `Lokasi: Area Gudang Sociolla\n` +
                  `--------------------------------------------\n` +
                  `Mohon segera temui petugas security terdekat atau patuhi arahan petugas.\n\n` +
                  `Sociolla Warehouse Security`;
      
      const url = `https://wa.me/${driver.phone.replace(/^0/, '62').replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
  };

  const openWhatsApp = (driver: DriverData) => {
      const url = `https://wa.me/${driver.phone.replace(/^0/, '62').replace(/\D/g,'')}`;
      window.open(url, '_blank');
  };

  // --- HELPERS ---
  const getDuration = (startTime: number) => {
      const diff = Date.now() - startTime;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      return { hours, minutes, totalMinutes: Math.floor(diff / 60000) };
  };

  const getAgingColor = (startTime: number) => {
      const mins = getDuration(startTime).totalMinutes;
      if (mins < 60) return 'bg-emerald-100 text-emerald-700 border-emerald-200'; 
      if (mins < 120) return 'bg-yellow-100 text-yellow-700 border-yellow-200'; 
      return 'bg-red-100 text-red-700 border-red-200 animate-pulse'; 
  };

  const getGateOccupant = (gateName: string) => {
      return drivers.find(d => 
          d.gate === gateName && 
          [QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status)
      );
  };

  // --- FILTER DATA LOGIC ---
  const verifikasiData = drivers.filter(d => d.status === QueueStatus.CHECKED_IN);
  const readyBongkarData = drivers.filter(d => [QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status));
  const selesaiData = drivers.filter(d => d.status === QueueStatus.COMPLETED);

  let currentData: DriverData[] = [];
  if (activeFilter === 'VERIFIKASI') currentData = verifikasiData;
  else if (activeFilter === 'BONGKAR') currentData = readyBongkarData;
  else if (activeFilter === 'SELESAI') currentData = selesaiData;

  return (
    <div className="min-h-screen bg-[#FDF2F4] flex flex-col font-sans text-[#2D2D2D]">
        
        {/* HEADER */}
        <div className="bg-white/80 backdrop-blur-md border-b border-pink-100 px-6 md:px-8 py-5 flex flex-col md:flex-row justify-between items-center sticky top-0 z-20 shadow-sm gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="w-10 h-10 bg-gradient-to-br from-sociolla-accent to-sociolla-pink rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-pink-200 shrink-0">
                    <Truck />
                </div>
                <div>
                    <h1 className="font-serif font-bold text-xl text-sociolla-dark tracking-wide">Traffic Control</h1>
                    <p className="text-[10px] text-sociolla-accent font-bold uppercase tracking-widest">Dock Management</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                 <button onClick={() => setViewMode('VISUAL')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'VISUAL' ? 'bg-white text-sociolla-accent shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                     <LayoutGrid className="w-4 h-4"/> Visual Mode
                 </button>
                 <button onClick={() => setViewMode('TABLE')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'TABLE' ? 'bg-white text-sociolla-accent shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                     <List className="w-4 h-4"/> Table Mode
                 </button>
                 {onBack && <button onClick={onBack} className="px-4 py-2 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100 ml-2">LOGOUT</button>}
            </div>
        </div>

        <div className="p-6 md:p-8 max-w-[1600px] mx-auto w-full space-y-8">
            
            {/* === VISUAL MODE === */}
            {viewMode === 'VISUAL' && (
                <div className="animate-fade-in-up space-y-8">
                    <div>
                        <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><MapPin className="w-5 h-5"/> Live Dock Status</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {availableGates.filter(g => g.type === 'DOCK').map(gate => {
                                const activeDriver = drivers.find(d => d.gate === gate.name && (d.status === QueueStatus.CALLED || d.status === QueueStatus.LOADING));
                                const isOccupied = !!activeDriver;
                                return (
                                    <div key={gate.id} className={`relative p-5 rounded-2xl border-2 transition-all overflow-hidden min-h-[140px] flex flex-col justify-between ${gate.status !== 'OPEN' ? 'bg-slate-100 border-slate-200 opacity-70' : isOccupied ? 'bg-purple-50 border-purple-200' : 'bg-white border-emerald-200 shadow-sm'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-black text-lg text-slate-700">{gate.name}</span>
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${gate.status !== 'OPEN' ? 'bg-slate-200 text-slate-500' : isOccupied ? 'bg-purple-100 text-purple-600 animate-pulse' : 'bg-emerald-100 text-emerald-600'}`}>{gate.status !== 'OPEN' ? 'MAINTENANCE' : isOccupied ? 'OCCUPIED' : 'AVAILABLE'}</span>
                                        </div>
                                        {isOccupied ? (
                                            <div>
                                                <div className="font-bold text-xl text-slate-800">{activeDriver.licensePlate}</div>
                                                <div className="text-xs text-slate-500 truncate">{activeDriver.company}</div>
                                            </div>
                                        ) : <div className="flex items-center justify-center flex-1 opacity-20"><Truck className="w-12 h-12 text-slate-400"/></div>}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* === TABLE MODE (ENHANCED) === */}
            {viewMode === 'TABLE' && (
                <div className="animate-fade-in-up space-y-6">
                    {/* FILTER TABS */}
                    <div className="flex gap-4 border-b border-slate-200 pb-1 overflow-x-auto">
                        <button onClick={() => setActiveFilter('VERIFIKASI')} className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition-all relative flex items-center gap-2 whitespace-nowrap ${activeFilter === 'VERIFIKASI' ? 'text-yellow-600 border-b-4 border-yellow-500' : 'text-slate-400 hover:text-yellow-500'}`}>
                            Antrian Masuk <span className="bg-slate-100 px-2 rounded-full text-xs">{verifikasiData.length}</span>
                        </button>
                        <button onClick={() => setActiveFilter('BONGKAR')} className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition-all relative flex items-center gap-2 whitespace-nowrap ${activeFilter === 'BONGKAR' ? 'text-blue-600 border-b-4 border-blue-500' : 'text-slate-400 hover:text-blue-500'}`}>
                            Loading Process <span className="bg-slate-100 px-2 rounded-full text-xs">{readyBongkarData.length}</span>
                        </button>
                        <button onClick={() => setActiveFilter('SELESAI')} className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition-all relative flex items-center gap-2 whitespace-nowrap ${activeFilter === 'SELESAI' ? 'text-emerald-600 border-b-4 border-emerald-500' : 'text-slate-400 hover:text-emerald-500'}`}>
                            History Selesai <span className="bg-slate-100 px-2 rounded-full text-xs">{selesaiData.length}</span>
                        </button>
                    </div>

                    <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden min-h-[400px]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-widest text-slate-500">
                                        <th className="p-6 font-bold">Unit & Antrian</th>
                                        <th className="p-6 font-bold">Driver & Kontak</th>
                                        <th className="p-6 font-bold">Vendor & Dokumen</th>
                                        <th className="p-6 font-bold">Lokasi & Tujuan</th>
                                        <th className="p-6 font-bold">Durasi / KPI</th>
                                        <th className="p-6 font-bold">Status</th>
                                        <th className="p-6 font-bold text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {currentData.length === 0 ? (
                                        <tr><td colSpan={7} className="p-12 text-center text-slate-400 font-bold">Data kosong untuk filter ini.</td></tr>
                                    ) : (
                                        currentData.map((d) => (
                                            <tr key={d.id} className="hover:bg-pink-50/20 transition-colors group">
                                                
                                                {/* 1. Unit & Antrian */}
                                                <td className="p-6 align-top">
                                                    <div className="font-black text-lg text-slate-800">{d.licensePlate}</div>
                                                    <div className="inline-flex items-center gap-1 mt-1 bg-slate-100 px-2 py-1 rounded text-xs font-mono font-bold text-slate-500">
                                                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                                        {d.queueNumber || '-'}
                                                    </div>
                                                </td>

                                                {/* 2. Driver & Kontak */}
                                                <td className="p-6 align-top">
                                                    <div className="font-bold text-slate-700">{d.name}</div>
                                                    <div className="text-[10px] font-mono font-medium text-slate-500 mt-1">{d.phone}</div>
                                                    <button onClick={() => openWhatsApp(d)} className="flex items-center gap-1 text-green-600 hover:text-green-700 text-xs font-bold mt-2 bg-green-50 px-2.5 py-1.5 rounded-lg w-fit transition-colors border border-green-100 hover:shadow-sm">
                                                        <Phone className="w-3 h-3"/> Hubungi WA
                                                    </button>
                                                </td>

                                                {/* 3. Vendor & Dokumen */}
                                                <td className="p-6 align-top">
                                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{d.company}</div>
                                                    <div className="font-mono text-sm font-bold text-slate-700 mb-2">{d.doNumber}</div>
                                                    {d.documentFile ? (
                                                        <button onClick={() => setPreviewDoc({url: d.documentFile!, type: 'DOC', title: `Surat Jalan - ${d.licensePlate}`})} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-xs font-bold border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg transition-all hover:shadow-sm">
                                                            <Eye className="w-3 h-3"/> LIHAT DOKUMEN
                                                        </button>
                                                    ) : <span className="text-xs text-slate-400 italic">Tidak ada lampiran</span>}
                                                </td>

                                                {/* 4. Lokasi & Tujuan */}
                                                <td className="p-6 align-top">
                                                    <div className={`inline-flex mb-2 text-[10px] font-bold px-2 py-0.5 rounded uppercase ${d.purpose === 'LOADING' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                                        {d.purpose}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="w-4 h-4 text-slate-400"/>
                                                        <span className="font-bold text-slate-800">{d.gate === 'NONE' ? 'Menunggu Gate' : d.gate.replace('_', ' ')}</span>
                                                    </div>
                                                </td>

                                                {/* 5. Durasi KPI */}
                                                <td className="p-6 align-top">
                                                    <div className="flex items-center gap-2 text-slate-600 mb-1">
                                                        <Clock className="w-4 h-4 text-slate-400"/>
                                                        <span className="font-bold text-sm">{new Date(d.checkInTime).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</span>
                                                    </div>
                                                    {activeFilter !== 'SELESAI' && (
                                                        <div className={`text-[10px] font-bold px-2 py-1 rounded border w-fit ${getAgingColor(d.checkInTime)}`}>
                                                            Wait: {getDuration(d.checkInTime).hours}j {getDuration(d.checkInTime).minutes}m
                                                        </div>
                                                    )}
                                                </td>

                                                {/* 6. Status */}
                                                <td className="p-6 align-top">
                                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${getStatusColor(d.status)}`}>
                                                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                                        {getStatusLabel(d.status)}
                                                    </div>
                                                    {d.securityNotes && (
                                                        <div className="mt-2 flex items-start gap-1 text-[10px] text-red-500 font-medium bg-red-50 p-1.5 rounded" title={d.securityNotes}>
                                                            <AlertCircle className="w-3 h-3 shrink-0"/>
                                                            <span className="line-clamp-2">{d.securityNotes}</span>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* 7. Action */}
                                                <td className="p-6 text-right align-top">
                                                    {/* TOMBOL WARNING VIOLATION (NEW) */}
                                                    <div className="flex justify-end gap-2 mb-2">
                                                        <button onClick={() => sendWarningWA(d)} className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg border border-transparent hover:border-amber-100 transition-colors" title="Kirim Peringatan Pelanggaran">
                                                            <AlertTriangle className="w-5 h-5"/>
                                                        </button>
                                                    </div>

                                                    {activeFilter === 'VERIFIKASI' && (
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => handleReject(d)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors"><XCircle className="w-5 h-5"/></button>
                                                            <button onClick={() => handleOpenAssign(d)} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-sociolla-accent shadow-md transition-all">ASSIGN GATE</button>
                                                        </div>
                                                    )}
                                                    {activeFilter === 'BONGKAR' && (
                                                        <div className="flex flex-col gap-2 items-end">
                                                            {d.status === QueueStatus.CALLED && (
                                                                <>
                                                                    <button onClick={() => window.open(`https://wa.me/${d.phone.replace(/^0/, '62').replace(/\D/g,'')}?text=${encodeURIComponent(generateWATemplate(d))}`, '_blank')} className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 shadow-sm w-full justify-center"><Send className="w-3 h-3"/> CALL (MANUAL)</button>
                                                                    <button onClick={() => handleStatusUpdate(d.id, QueueStatus.LOADING)} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm w-full">MULAI LOAD</button>
                                                                </>
                                                            )}
                                                            {d.status === QueueStatus.LOADING && (
                                                                <button onClick={() => handleStatusUpdate(d.id, QueueStatus.COMPLETED)} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm flex items-center gap-2"><CheckSquare className="w-3 h-3"/> SELESAI</button>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* --- DOCUMENT PREVIEW MODAL --- */}
        {previewDoc && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in-up" onClick={() => setPreviewDoc(null)}>
                <div className="bg-white rounded-3xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText className="w-5 h-5 text-blue-500"/> {previewDoc.title}</h3>
                        <button onClick={() => setPreviewDoc(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5"/></button>
                    </div>
                    <div className="flex-1 overflow-auto bg-slate-900 flex items-center justify-center p-4">
                        <img src={previewDoc.url} alt="Document" className="max-w-full max-h-[70vh] rounded-lg shadow-2xl"/>
                    </div>
                    <div className="p-4 bg-white border-t border-slate-100 text-center">
                        <a href={previewDoc.url} target="_blank" rel="noreferrer" className="text-blue-600 font-bold text-xs hover:underline">Buka di Tab Baru (Full Resolution)</a>
                    </div>
                </div>
            </div>
        )}

        {/* Modal Logic for Call Confirmation */}
        {isModalOpen && selectedDriver && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2D2D]/60 backdrop-blur-md p-4 animate-fade-in-up">
                <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden border border-white">
                    <div className="bg-gradient-to-r from-sociolla-accent to-sociolla-pink p-6 flex justify-between items-center text-white">
                        <h3 className="font-serif font-bold text-xl flex items-center gap-2"><Megaphone/> KONFIRMASI PANGGILAN</h3>
                        <button onClick={() => setIsModalOpen(false)}><X/></button>
                    </div>
                    <div className="p-8">
                        <div className="mb-6 bg-pink-50 p-6 rounded-2xl border border-pink-100 text-center">
                             <h4 className="font-black text-2xl text-slate-800 mb-1">{selectedDriver.licensePlate}</h4>
                             <p className="text-slate-500 font-medium">{selectedDriver.name} • {selectedDriver.company}</p>
                        </div>
                        <div className="mb-6">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block text-center">Pilih Loading Dock / Gate</label>
                            {availableGates.length === 0 ? (
                                <p className="text-center text-red-500 font-bold text-sm">⚠️ Tidak ada Gate yang statusnya OPEN!</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {availableGates.filter(g => g.status === 'OPEN').map(gate => {
                                        const occupant = getGateOccupant(gate.name);
                                        const isOccupied = !!occupant;
                                        const isSelected = selectedGateForCall === gate.name;
                                        return (
                                            <button key={gate.id} onClick={() => !isOccupied && setSelectedGateForCall(gate.name)} disabled={isOccupied} className={`relative p-4 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-1 overflow-hidden ${isSelected ? 'bg-slate-800 border-slate-800 text-white shadow-lg scale-105' : isOccupied ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed opacity-70' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'}`}>
                                                {isOccupied && (<div className="absolute inset-0 bg-slate-100/80 flex flex-col items-center justify-center z-10 backdrop-blur-[1px]"><Ban className="w-5 h-5 text-red-400 mb-1" /><span className="text-[9px] font-black uppercase text-red-500">Occupied</span></div>)}
                                                <MapPin className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-slate-300'}`}/>
                                                <span className="relative z-0">{gate.name}</span>
                                                {isOccupied && (<span className="text-[9px] text-slate-500 mt-1 font-mono">By: {occupant.licensePlate}</span>)}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <button onClick={handleConfirmCall} disabled={loading || processingId === selectedDriver.id || !selectedGateForCall} className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 shadow-xl shadow-green-200 disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]">
                            {processingId === selectedDriver.id ? <Loader2 className="w-5 h-5 animate-spin"/> : <><ExternalLink className="w-5 h-5"/> PANGGIL & KIRIM WA</>}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
