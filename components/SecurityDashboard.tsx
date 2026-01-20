import React, { useState, useEffect } from 'react';
import { Truck, Search, LogOut, Shield, AlertTriangle, Clock, Edit2, CheckSquare, XCircle, ChevronRight, Filter, QrCode, Eye } from 'lucide-react';
import { DriverData, QueueStatus, UserProfile } from '../types';
import { getDrivers, reviseAndCheckIn, checkoutDriver, rejectGate } from '../services/dataService';
import { supabase } from '../services/supabaseClient'; // Import Supabase
import { Scanner } from '@yudiel/react-qr-scanner';

interface Props {
  onBack: () => void;
  currentUser: UserProfile | null;
}

// 📦 KOMPONEN KECIL: LIST DRIVER (Refactoring supaya kode rapi)
const DriverCard = ({ driver, activeTab, onClick, isOverstay, duration }: any) => (
    <div className={`bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all ${isOverstay ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-100'}`}>
        <div className="flex justify-between items-start mb-4">
            <div>
                <h3 className="text-xl font-black text-slate-800">{driver.licensePlate}</h3>
                <p className="text-sm font-bold text-slate-500">{driver.company}</p>
                {driver.bookingCode && <p className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block font-mono text-slate-500">{driver.bookingCode}</p>}
            </div>
            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${driver.purpose === 'LOADING' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{driver.purpose}</span>
        </div>

        {activeTab === 'INSIDE' && duration && (
            <div className={`flex items-center gap-2 mb-4 text-xs font-bold px-3 py-1.5 rounded-lg w-fit ${isOverstay ? 'bg-red-50 text-red-600' : duration.hours >= 2 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'}`}>
                <Clock className="w-3 h-3" /><span>Durasi: {duration.text}</span>
            </div>
        )}
        {activeTab === 'INSIDE' && driver.status === QueueStatus.COMPLETED && (
            <div className="flex items-center gap-2 mb-4 text-xs font-bold px-3 py-1.5 rounded-lg w-fit bg-green-100 text-green-700 border border-green-200"><CheckSquare className="w-3 h-3" /><span>SELESAI BONGKAR</span></div>
        )}
        {activeTab === 'HISTORY' && (
            <div className={`flex items-center gap-2 mb-4 text-xs font-bold px-3 py-1.5 rounded-lg w-fit ${driver.status === QueueStatus.REJECTED ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}><CheckSquare className="w-3 h-3" /><span>{driver.status === QueueStatus.REJECTED ? 'DITOLAK' : 'SELESAI'}</span></div>
        )}
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-4 bg-slate-50 p-2 rounded-lg"><span className="font-bold text-slate-600">DRIVER:</span> {driver.name}</div>
        <button onClick={() => onClick(driver)} className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${activeTab === 'HISTORY' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
            {activeTab === 'HISTORY' ? (<> <Eye className="w-4 h-4" /> Lihat Detail </>) : activeTab === 'INSIDE' ? (<> Checkout / Keluar <ChevronRight className="w-4 h-4" /> </>) : (<> Proses Masuk <ChevronRight className="w-4 h-4" /> </>)}
        </button>
    </div>
);

// 📦 UTAMA: SECURITY DASHBOARD
const SecurityDashboard: React.FC<Props> = ({ onBack, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'QUEUE' | 'INSIDE' | 'HISTORY'>('QUEUE');
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); 
  const [showScanner, setShowScanner] = useState(false);
  const [inspectDriver, setInspectDriver] = useState<DriverData | null>(null);
  const [isRevising, setIsRevising] = useState(false);
  const [reviseForm, setReviseForm] = useState({ name: '', plate: '', company: '', phone: '', purpose: '' });
  const [checklist, setChecklist] = useState({ suratJalan: false, safetyShoes: false, vest: false, helmet: false, vehicleCondition: false });

  const fetchData = async () => {
    setLoading(true);
    const data = await getDrivers();
    if(data) setDrivers(data);
    setLoading(false);
  };

  // 🔥 REALTIME UPDATE (Hapus Interval Lama, Ganti dengan Supabase Realtime) 🔥
  useEffect(() => {
    fetchData();
    const channel = supabase.channel('security-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, (payload) => {
            fetchData(); // Refresh data jika ada perubahan apapun di tabel driver
        })
        .subscribe();
    return () => { supabase.removeChannel(channel); }
  }, []);

  const filteredDrivers = drivers.filter(d => {
    let matchTab = false;
    if (activeTab === 'QUEUE') matchTab = [QueueStatus.BOOKED, QueueStatus.CHECKED_IN].includes(d.status);
    if (activeTab === 'INSIDE') matchTab = [QueueStatus.AT_GATE, QueueStatus.CALLED, QueueStatus.LOADING, QueueStatus.COMPLETED].includes(d.status);
    if (activeTab === 'HISTORY') matchTab = [QueueStatus.EXITED, QueueStatus.REJECTED, QueueStatus.REJECTED_NEED_REBOOK].includes(d.status);
    
    const searchLower = searchTerm.toLowerCase();
    const matchSearch = (d.bookingCode?.toLowerCase().includes(searchLower)) || d.licensePlate.toLowerCase().includes(searchLower) || d.name.toLowerCase().includes(searchLower);
    return matchTab && matchSearch;
  });

  const trucksInside = drivers.filter(d => [QueueStatus.AT_GATE, QueueStatus.CALLED, QueueStatus.LOADING, QueueStatus.COMPLETED].includes(d.status)).length;
  
  const handleScanResult = (text: string) => {
      if (text) {
          setSearchTerm(text);
          setShowScanner(false);
          const found = drivers.find(d => d.bookingCode === text || d.licensePlate === text);
          if (found) openInspection(found);
          else alert(`Data tidak ditemukan: ${text}`);
      }
  };

  const openInspection = (driver: DriverData) => {
      setInspectDriver(driver);
      setReviseForm({ name: driver.name, plate: driver.licensePlate, company: driver.company, phone: driver.phone || '', purpose: driver.purpose || 'UNLOADING' });
      setIsRevising(false); 
      setChecklist({ suratJalan: false, safetyShoes: false, vest: false, helmet: false, vehicleCondition: false });
  };

  const handleApproveEntry = async () => {
      if (!inspectDriver) return;
      if (!Object.values(checklist).every(Boolean)) { alert("Ceklis semua item keamanan!"); return; }
      if (confirm(`Izinkan ${inspectDriver.licensePlate} masuk?`)) {
          await reviseAndCheckIn(inspectDriver.id, isRevising ? reviseForm : { name: inspectDriver.name, plate: inspectDriver.licensePlate, company: inspectDriver.company, phone: inspectDriver.phone || '', purpose: inspectDriver.purpose });
          setInspectDriver(null);
      }
  };

  const handleCheckout = async () => {
      if (!inspectDriver) return;
      if (confirm(`Konfirmasi keluar ${inspectDriver.licensePlate}?`)) {
          await checkoutDriver(inspectDriver.id);
          setInspectDriver(null);
      }
  };

  const getDuration = (startTime?: number) => {
      if (!startTime) return { hours: 0, text: '-' };
      const diff = Date.now() - startTime;
      const hours = Math.floor(diff / 3600000);
      return { hours, text: `${hours}j ${Math.floor((diff % 3600000) / 60000)}m` };
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="bg-slate-900 text-white px-6 py-4 shadow-md sticky top-0 z-20">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
            <div className="flex items-center gap-3"><Shield className="w-6 h-6 text-emerald-400" /><div><h1 className="text-xl font-bold">Security Post</h1><div className="flex items-center gap-2 text-xs text-slate-400"><span>{currentUser?.name || 'Officer'}</span><span className="text-emerald-400 border border-emerald-500/30 px-1 rounded">ONLINE (REALTIME)</span></div></div></div>
            <div className="flex items-center gap-4"><div className={`px-4 py-2 rounded-xl border flex items-center gap-3 ${trucksInside >= 20 ? 'bg-red-900 border-red-500' : 'bg-slate-800 border-slate-700'}`}><div><p className="text-[10px] text-slate-400 uppercase">Inside</p><p className="text-lg font-bold">{trucksInside} / 20</p></div><Truck className="w-5 h-5 text-blue-400" /></div><button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700"><LogOut className="w-5 h-5 text-slate-400" /></button></div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex p-1 bg-white rounded-xl shadow-sm border border-slate-200 w-full md:w-auto">{['QUEUE', 'INSIDE', 'HISTORY'].map((tab) => (<button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{tab === 'QUEUE' ? 'Masuk' : tab === 'INSIDE' ? 'Di Dalam' : 'Riwayat'}</button>))}</div>
            <div className="flex items-center gap-2 w-full md:w-auto"><div className="relative w-full md:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Cari Plat..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" /></div><button onClick={() => setShowScanner(true)} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg flex items-center gap-2"><QrCode className="w-5 h-5" /> Scan</button></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDrivers.map(driver => {
                const duration = activeTab === 'INSIDE' ? getDuration(driver.checkInTime) : null;
                return <DriverCard key={driver.id} driver={driver} activeTab={activeTab} onClick={openInspection} isOverstay={duration && duration.hours >= 4} duration={duration} />;
            })}
        </div>
      </div>

      {inspectDriver && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in-up">
              <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0"><div><h2 className="text-lg font-bold">Pemeriksaan {activeTab === 'INSIDE' ? 'Keluar' : 'Masuk'}</h2><p className="text-slate-400 text-sm">{inspectDriver.licensePlate}</p></div><button onClick={() => setInspectDriver(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><XCircle className="w-6 h-6" /></button></div>
                  <div className="p-6 overflow-y-auto">
                      {isRevising ? (
                          <div className="space-y-4">
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3"><AlertTriangle className="w-5 h-5 text-amber-600"/><p className="text-xs text-amber-800 font-bold">MODE REVISI</p></div>
                              <input value={reviseForm.plate} onChange={e => setReviseForm({...reviseForm, plate: e.target.value.toUpperCase()})} className="w-full p-2 border rounded-xl font-bold uppercase" placeholder="Plat Nomor"/>
                              <input value={reviseForm.name} onChange={e => setReviseForm({...reviseForm, name: e.target.value})} className="w-full p-2 border rounded-xl" placeholder="Nama Driver"/>
                              <button onClick={() => setIsRevising(false)} className="text-red-500 text-xs font-bold underline w-full">Batal</button>
                          </div>
                      ) : (
                          <>
                              {activeTab === 'QUEUE' && <div className="mb-4 flex justify-end"><button onClick={() => setIsRevising(true)} className="text-blue-600 text-xs font-bold flex gap-1 bg-blue-50 px-2 py-1 rounded"><Edit2 className="w-3 h-3"/> Revisi</button></div>}
                              <h3 className="text-sm font-bold text-slate-800 uppercase mb-3">Checklist</h3>
                              <div className="space-y-2">
                                  {[{ id: 'suratJalan', label: 'Surat Jalan Sesuai' }, { id: 'safetyShoes', label: 'Sepatu Safety' }, { id: 'vest', label: 'Rompi / Vest' }, { id: 'helmet', label: 'Helm Proyek' }, { id: 'vehicleCondition', label: 'Kondisi Kendaraan' }].map(item => (
                                      <label key={item.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                                          <input type="checkbox" disabled={activeTab === 'HISTORY'} checked={activeTab === 'HISTORY' ? true : checklist[item.id as keyof typeof checklist]} onChange={() => setChecklist(prev => ({ ...prev, [item.id]: !prev[item.id as keyof typeof checklist] }))} className="w-5 h-5 accent-emerald-500"/>
                                          <span className="font-bold text-slate-700 text-sm">{item.label}</span>
                                      </label>
                                  ))}
                              </div>
                          </>
                      )}
                  </div>
                  <div className="p-6 border-t bg-slate-50">
                      {activeTab !== 'HISTORY' && (
                          <button onClick={activeTab === 'INSIDE' ? handleCheckout : handleApproveEntry} className={`w-full py-4 rounded-xl font-bold text-white shadow-lg ${activeTab === 'INSIDE' ? 'bg-red-600' : 'bg-emerald-600'}`}>{activeTab === 'INSIDE' ? 'CHECKOUT' : 'APPROVE'}</button>
                      )}
                  </div>
              </div>
          </div>
      )}
      {showScanner && (<div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center"><button onClick={() => setShowScanner(false)} className="absolute top-6 right-6 p-3 bg-white/20 rounded-full text-white"><XCircle className="w-8 h-8" /></button><div className="w-full max-w-md aspect-square bg-black relative rounded-3xl overflow-hidden border-2 border-slate-700"><Scanner onScan={(result) => result[0] && handleScanResult(result[0].rawValue)} /></div></div>)}
    </div>
  );
};

export default SecurityDashboard;
