import React, { useState, useEffect } from 'react';
import { getDrivers, verifyDriver, rejectDriver } from '../services/dataService';
import { DriverData, QueueStatus, UserProfile } from '../types';
import { Camera, X, LogIn, LogOut, Loader2, RefreshCw } from 'lucide-react';

interface Props { onBack?: () => void; currentUser?: UserProfile | null; }

const SecurityDashboard: React.FC<Props> = ({ onBack, currentUser }) => {
  const [view, setView] = useState<'DASHBOARD' | 'VERIFY'>('DASHBOARD');
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [scannedDriver, setScannedDriver] = useState<DriverData | null>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [manualIdInput, setManualIdInput] = useState('');
  const [activeTab, setActiveTab] = useState<'GATE_IN' | 'GATE_OUT'>('GATE_IN');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- SAFE DATA FETCHING (ANTI BLANK) ---
  const fetchData = async () => {
    try {
        setIsLoading(true);
        const data = await getDrivers();
        if (Array.isArray(data)) {
            setDrivers(data);
        } else {
            setDrivers([]); 
        }
    } catch (e) {
        console.error("Gagal load driver:", e);
        setDrivers([]);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [view]);

  // --- LOGIC ---
  const handleManualSelect = (driver: DriverData) => {
      setScannedDriver(driver);
      setIsScanModalOpen(false);
      setView('VERIFY');
  };

  const handleVerify = async (approve: boolean) => {
      if (!scannedDriver) return;
      try {
        if (approve) await verifyDriver(scannedDriver.id, currentUser?.name || 'Security', 'OK', []);
        else await rejectDriver(scannedDriver.id, 'Ditolak Security', currentUser?.name || 'Security');
        alert(approve ? "Driver berhasil diverifikasi ✅" : "Driver ditolak ❌");
      } catch (e) {
        alert("Gagal memproses data. Cek koneksi internet.");
      }
      setScannedDriver(null);
      setView('DASHBOARD');
      fetchData(); 
  };

  // --- SAFE FILTERING ---
  const filteredList = (drivers || []).filter(d => {
      if (!d) return false;
      const match = (d.licensePlate || '').toUpperCase().includes(search.toUpperCase()) || 
                    (d.name || '').toLowerCase().includes(search.toLowerCase());
      
      if (activeTab === 'GATE_IN') {
          // ✅ FIX: Hapus CHECKED_IN agar driver yg sudah diapprove HILANG dari list Security
          // Security hanya melihat yang statusnya BOOKED (Belum datang) atau AT_GATE (Sudah di gerbang)
          return match && [QueueStatus.BOOKED, QueueStatus.AT_GATE].includes(d.status);
      } else {
          return match && d.status === QueueStatus.COMPLETED;
      }
  });

  // --- RENDER VERIFY PAGE ---
  if (view === 'VERIFY' && scannedDriver) {
      return (
          <div className="p-6 bg-slate-50 min-h-screen flex flex-col items-center pt-10 animate-fade-in-up">
              <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl text-center border border-slate-100">
                  <h2 className="text-4xl font-black text-slate-800 mb-2">{scannedDriver.licensePlate}</h2>
                  <p className="text-lg font-bold text-slate-500 mb-1">{scannedDriver.name}</p>
                  <p className="text-sm text-slate-400 mb-8">{scannedDriver.company}</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => handleVerify(false)} className="py-4 bg-red-100 text-red-600 font-bold rounded-2xl hover:bg-red-200 transition-colors">
                          TOLAK ⛔
                      </button>
                      <button onClick={() => handleVerify(true)} className="py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-lg hover:bg-emerald-600 transition-colors hover:scale-105 transform">
                          IZINKAN MASUK ✅
                      </button>
                  </div>
                  <button onClick={() => setView('DASHBOARD')} className="mt-6 text-slate-400 font-bold text-sm">Kembali</button>
              </div>
          </div>
      );
  }

  // --- RENDER DASHBOARD ---
  return (
      <div className="p-4 md:p-6 bg-slate-100 min-h-screen">
          <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <div>
                <h1 className="text-xl font-black text-slate-800">Security Ops</h1>
                <p className="text-xs font-bold text-slate-400">Petugas: {currentUser?.name || 'Guest'}</p>
            </div>
            <div className="flex gap-2">
                <button onClick={fetchData} className="p-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200"><RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}/></button>
                {onBack && <button onClick={onBack} className="px-4 py-2 bg-red-50 text-red-500 rounded-lg font-bold text-sm hover:bg-red-100">Keluar</button>}
            </div>
          </div>
          
          <button onClick={() => setIsScanModalOpen(true)} className="w-full bg-blue-600 text-white p-8 rounded-3xl mb-6 flex flex-col items-center justify-center gap-3 shadow-xl shadow-blue-200 hover:scale-[1.01] transition-transform active:scale-95">
              <Camera className="w-12 h-12"/> 
              <span className="font-black text-xl tracking-wide">SCAN QR CODE</span>
          </button>

          <div className="flex p-1.5 bg-white rounded-2xl shadow-sm border border-slate-200 mb-4">
                <button onClick={() => setActiveTab('GATE_IN')} className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'GATE_IN' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}><LogIn className="w-4 h-4" /> Kendaraan Masuk</button>
                <button onClick={() => setActiveTab('GATE_OUT')} className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'GATE_OUT' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}><LogOut className="w-4 h-4" /> Kendaraan Keluar</button>
          </div>

          <div className="space-y-3 pb-20">
              {filteredList.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 font-bold">Tidak ada antrian saat ini.</div>
              ) : (
                  filteredList.map(d => (
                      <div key={d.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center hover:shadow-md transition-shadow">
                          <div>
                              <div className="font-black text-lg text-slate-800">{d.licensePlate}</div>
                              <div className="text-xs font-bold text-slate-400">{d.name} • {d.company}</div>
                              <div className="text-[10px] font-bold text-blue-500 mt-1 bg-blue-50 px-2 py-0.5 rounded w-fit">{d.status}</div>
                          </div>
                          {activeTab === 'GATE_IN' ? (
                            <button onClick={() => handleManualSelect(d)} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors">PROSES</button>
                          ) : ( 
                            <span className="bg-green-50 text-green-600 px-3 py-1 rounded-lg text-xs font-bold border border-green-100">SELESAI</span> 
                          )}
                      </div>
                  ))
              )}
          </div>

          {/* Scan Modal */}
          {isScanModalOpen && (
              <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4 backdrop-blur-sm">
                  <div className="bg-white p-4 rounded-3xl w-full max-w-sm relative">
                      <button onClick={() => setIsScanModalOpen(false)} className="absolute top-4 right-4 bg-slate-100 p-2 rounded-full hover:bg-slate-200"><X className="w-5 h-5"/></button>
                      <h3 className="text-center font-black text-lg mb-6">Input Manual</h3>
                      
                      <div className="space-y-4">
                          <input type="text" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 uppercase" placeholder="Ketik Plat Nomor..." value={manualIdInput} onChange={(e) => setManualIdInput(e.target.value)} autoFocus />
                          
                          <div className="max-h-60 overflow-y-auto space-y-2">
                              {(drivers || [])
                                .filter(d => d.licensePlate.includes(manualIdInput.toUpperCase()))
                                .slice(0, 5) 
                                .map(d => (
                                  <div key={d.id} onClick={() => handleManualSelect(d)} className="p-3 bg-slate-50 rounded-xl font-bold text-slate-700 cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors border border-transparent hover:border-blue-200">
                                      {d.licensePlate} <span className="text-xs font-normal text-slate-400 ml-2">({d.name})</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>
  );
};

export default SecurityDashboard;
