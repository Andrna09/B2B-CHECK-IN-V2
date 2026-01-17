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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{url: string, type: 'DOC' | 'PHOTO', title: string} | null>(null);
  const [availableGates, setAvailableGates] = useState<GateConfig[]>([]);
  const [selectedGateForCall, setSelectedGateForCall] = useState<string>('');
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
      
      // Menggunakan template MANUAL_CALL untuk membuka WA Web
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

  // --- TEMPLATE GENERATOR ---

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

  // --- HELPERS (Layout Logic) ---
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
            
            {/* TABLE MODE */}
            {viewMode === 'TABLE' && (
                <div className="animate-fade-in-up space-y-6">
                    {/* TABS */}
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
                                <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="p-6 font-bold">Unit & Antrian</th>
                                        <th className="p-6 font-bold">Driver & Kontak</th>
                                        <th className="p-6 font-bold">Status</th>
                                        <th className="p-6 font-bold text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {currentData.map((d) => (
                                        <tr key={d.id} className="hover:bg-pink-50/20 transition-colors">
                                            <td className="p-6 align-top">
                                                <div className="font-black text-lg text-slate-800">{d.licensePlate}</div>
                                                <div className="text-xs font-mono text-slate-500">#{d.queueNumber}</div>
                                            </td>
                                            <td className="p-6 align-top">
                                                <div className="font-bold text-slate-700">{d.name}</div>
                                                <div className="text-[10px] text-slate-500">{d.phone}</div>
                                            </td>
                                            <td className="p-6 align-top">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold border ${getStatusColor(d.status)}`}>{getStatusLabel(d.status)}</span>
                                            </td>
                                            <td className="p-6 text-right align-top flex justify-end gap-2">
                                                
                                                {/* TOMBOL BARU: SEND WARNING */}
                                                <button onClick={() => sendWarningWA(d)} className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg border border-transparent hover:border-amber-100 transition-colors" title="Kirim Peringatan Pelanggaran">
                                                    <AlertTriangle className="w-5 h-5"/>
                                                </button>

                                                {/* Existing Actions */}
                                                {activeFilter === 'VERIFIKASI' && (
                                                    <>
                                                        <button onClick={() => handleReject(d)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><XCircle className="w-5 h-5"/></button>
                                                        <button onClick={() => handleOpenAssign(d)} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold text-xs">ASSIGN GATE</button>
                                                    </>
                                                )}
                                                {activeFilter === 'BONGKAR' && d.status === 'CALLED' && (
                                                    <button onClick={() => window.open(`https://wa.me/${d.phone.replace(/^0/, '62').replace(/\D/g,'')}?text=${encodeURIComponent(generateWATemplate(d))}`, '_blank')} className="px-3 py-2 bg-green-500 text-white rounded-lg text-xs font-bold flex items-center gap-2">
                                                        <Send className="w-3 h-3"/> CALL (MANUAL)
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            
            {/* (Sisa kode visual mode & modal tetap sama) */}
             {/* ... */}
        </div>
        
        {/* MODAL & POPUP LAINNYA BIARKAN SAMA */}
        {/* ... */}
    </div>
  );
};

export default AdminDashboard;
