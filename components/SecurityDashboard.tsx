import React, { useState, useEffect } from 'react';
import { Truck, Search, LogOut, Shield, AlertTriangle, Clock, Edit2, CheckSquare, XCircle, ChevronRight, Filter, QrCode } from 'lucide-react';
import { DriverData, QueueStatus, UserProfile } from '../types';
import { getDrivers, reviseAndCheckIn, checkoutDriver, rejectGate } from '../services/dataService';
// Library Scanner Versi 2.x
import { Scanner } from '@yudiel/react-qr-scanner';

interface Props {
  onBack: () => void;
  currentUser: UserProfile | null;
}

const SecurityDashboard: React.FC<Props> = ({ onBack, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'QUEUE' | 'INSIDE' | 'HISTORY'>('QUEUE');
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); 
  
  const [showScanner, setShowScanner] = useState(false);
  const [inspectDriver, setInspectDriver] = useState<DriverData | null>(null);
  
  const [isRevising, setIsRevising] = useState(false);
  const [reviseForm, setReviseForm] = useState({ name: '', plate: '', company: '' });

  const [checklist, setChecklist] = useState({
    suratJalan: false,
    safetyShoes: false,
    vest: false,
    helmet: false,
    vehicleCondition: false
  });

  const fetchData = async () => {
    setLoading(true);
    const data = await getDrivers();
    if(data) setDrivers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); 
    return () => clearInterval(interval);
  }, []);

  // --- LOGIC FILTER ---
  const filteredDrivers = drivers.filter(d => {
    let matchTab = false;
    if (activeTab === 'QUEUE') matchTab = [QueueStatus.BOOKED, QueueStatus.CHECKED_IN].includes(d.status);
    if (activeTab === 'INSIDE') matchTab = [QueueStatus.AT_GATE, QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status);
    if (activeTab === 'HISTORY') matchTab = [QueueStatus.COMPLETED, QueueStatus.EXITED, QueueStatus.REJECTED, QueueStatus.REJECTED_NEED_REBOOK].includes(d.status);
    
    const searchLower = searchTerm.toLowerCase();
    const matchSearch = 
        (d.bookingCode && d.bookingCode.toLowerCase().includes(searchLower)) ||
        d.licensePlate.toLowerCase().includes(searchLower) || 
        d.name.toLowerCase().includes(searchLower) ||
        d.company.toLowerCase().includes(searchLower);

    return matchTab && matchSearch;
  });

  const trucksInside = drivers.filter(d => [QueueStatus.AT_GATE, QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status)).length;
  const maxCapacity = 20;

  const getDuration = (startTime?: number) => {
      if (!startTime) return { hours: 0, text: '-' };
      const diff = Date.now() - startTime;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return { hours, text: `${hours}j ${minutes}m` };
  };

  // --- LOGIC ACTION ---
  const handleScanResult = (text: string) => {
      if (text) {
          setSearchTerm(text);
          setShowScanner(false);
          const found = drivers.find(d => d.bookingCode === text || d.licensePlate === text);
          if (found) {
              openInspection(found);
          } else {
              alert(`QR Code tidak ditemukan: ${text}`);
          }
      }
  };

  const openInspection = (driver: DriverData) => {
      setInspectDriver(driver);
      setReviseForm({ name: driver.name, plate: driver.licensePlate, company: driver.company });
      setIsRevising(false); 
      setChecklist({ suratJalan: false, safetyShoes: false, vest: false, helmet: false, vehicleCondition: false });
  };

  const handleApproveEntry = async () => {
      if (!inspectDriver) return;
      const isComplete = Object.values(checklist).every(v => v === true);
      
      if (!isComplete) {
          alert("Harap ceklis semua item pemeriksaan sebelum mengizinkan masuk.");
          return;
      }

      if (confirm(`Izinkan ${isRevising ? reviseForm.plate : inspectDriver.licensePlate} masuk?`)) {
          await reviseAndCheckIn(inspectDriver.id, isRevising ? reviseForm : {
              name: inspectDriver.name,
              plate: inspectDriver.licensePlate,
              company: inspectDriver.company
          });
          
          setInspectDriver(null);
          fetchData();
      }
  };

  const handleCheckout = async () => {
      if (!inspectDriver) return;
      if (confirm(`Konfirmasi ${inspectDriver.licensePlate} keluar area?`)) {
          await checkoutDriver(inspectDriver.id);
          setInspectDriver(null);
          fetchData();
      }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* HEADER */}
      <div className="bg-slate-900 text-white px-6 py-4 shadow-md sticky top-0 z-20">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                    <Shield className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Security Post</h1>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{currentUser?.name || 'Officer'}</span>
                        <span className="text-emerald-400 font-mono text-[10px] border border-emerald-500/30 px-1 rounded">ONLINE</span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <div className={`px-4 py-2 rounded-xl border flex items-center gap-3 ${trucksInside >= maxCapacity ? 'bg-red-500/20 border-red-500 text-red-100' : 'bg-slate-800 border-slate-700'}`}>
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">Inside</p>
                        <p className="text-lg font-bold font-mono">{trucksInside} <span className="text-slate-500 text-sm">/ {maxCapacity}</span></p>
                    </div>
                    <Truck className={`w-5 h-5 ${trucksInside >= maxCapacity ? 'text-red-400 animate-pulse' : 'text-blue-400'}`} />
                </div>
                <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
                    <LogOut className="w-5 h-5 text-slate-400" />
                </button>
            </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 space-y-6">
        
        {/* CONTROLS */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex p-1 bg-white rounded-xl shadow-sm border border-slate-200 w-full md:w-auto">
                {['QUEUE', 'INSIDE', 'HISTORY'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                            activeTab === tab ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        {tab === 'QUEUE' ? 'Masuk' : tab === 'INSIDE' ? 'Keluar' : 'Riwayat'}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Cari Plat / Kode / Nama..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                    />
                </div>
                <button 
                    onClick={() => setShowScanner(true)}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 flex items-center gap-2 whitespace-nowrap"
                >
                    <QrCode className="w-5 h-5" /> <span className="hidden sm:inline">Scan QR</span>
                </button>
            </div>
        </div>

        {/* LIST */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDrivers.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400">
                    <Filter className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Tidak ada data ditemukan.</p>
                </div>
            ) : (
                filteredDrivers.map(driver => {
                    const duration = activeTab === 'INSIDE' ? getDuration(driver.checkInTime) : null;
                    const isOverstay = duration && duration.hours >= 4;

                    return (
                        <div key={driver.id} className={`bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all ${
                            isOverstay ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-100'
                        }`}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">{driver.licensePlate}</h3>
                                    <p className="text-sm font-bold text-slate-500">{driver.company}</p>
                                    {driver.bookingCode && <p className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block font-mono text-slate-500">{driver.bookingCode}</p>}
                                </div>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                    driver.purpose === 'LOADING' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                }`}>
                                    {driver.purpose}
                                </span>
                            </div>

                            {activeTab === 'INSIDE' && duration && (
                                <div className={`flex items-center gap-2 mb-4 text-xs font-bold px-3 py-1.5 rounded-lg w-fit ${
                                    isOverstay ? 'bg-red-50 text-red-600' : 
                                    duration.hours >= 2 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'
                                }`}>
                                    <Clock className="w-3 h-3" />
                                    <span>Durasi: {duration.text}</span>
                                </div>
                            )}

                            <div className="flex items-center gap-2 text-xs text-slate-400 mb-4 bg-slate-50 p-2 rounded-lg">
                                <span className="font-bold text-slate-600">DRIVER:</span> {driver.name}
                            </div>

                            <button 
                                onClick={() => openInspection(driver)}
                                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 flex items-center justify-center gap-2"
                            >
                                {activeTab === 'INSIDE' ? 'Checkout / Keluar' : 'Proses Masuk'} <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    );
                })
            )}
        </div>
      </div>

      {/* --- MODAL INSPEKSI --- */}
      {inspectDriver && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in-up">
              <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                  
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                      <div>
                          <h2 className="text-lg font-bold">{isRevising ? 'Revisi Data' : `Pemeriksaan ${activeTab === 'INSIDE' ? 'Keluar' : 'Masuk'}`}</h2>
                          {!isRevising && <p className="text-slate-400 text-sm">{inspectDriver.licensePlate} • {inspectDriver.company}</p>}
                      </div>
                      <button onClick={() => setInspectDriver(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                          <XCircle className="w-6 h-6" />
                      </button>
                  </div>

                  <div className="p-6 overflow-y-auto">
                      
                      {isRevising ? (
                          <div className="space-y-4 animate-fade-in-up">
                              <div>
                                  <label className="text-xs font-bold text-slate-400 uppercase">Plat Nomor</label>
                                  <input 
                                      value={reviseForm.plate}
                                      onChange={e => setReviseForm({...reviseForm, plate: e.target.value.toUpperCase()})}
                                      className="w-full p-3 border-2 border-slate-200 rounded-xl font-black text-xl uppercase"
                                  />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-400 uppercase">Nama Driver</label>
                                  <input 
                                      value={reviseForm.name}
                                      onChange={e => setReviseForm({...reviseForm, name: e.target.value})}
                                      className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold"
                                  />
                              </div>
                              <div className="p-3 bg-blue-50 text-blue-700 text-xs rounded-lg font-medium">
                                  *Data akan diperbarui setelah Anda klik tombol "Simpan & Masuk" di bawah.
                              </div>
                              <button onClick={() => setIsRevising(false)} className="text-sm text-slate-400 underline w-full text-center">Batal Revisi</button>
                          </div>
                      ) : (
                          <>
                              {activeTab === 'QUEUE' && (
                                <div className="mb-6 flex justify-end">
                                    <button 
                                        onClick={() => setIsRevising(true)}
                                        className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline bg-blue-50 px-3 py-1.5 rounded-lg"
                                    >
                                        <Edit2 className="w-3 h-3" /> Data Salah? Klik Revisi
                                    </button>
                                </div>
                              )}

                              {activeTab === 'INSIDE' && getDuration(inspectDriver.checkInTime).hours >= 4 && (
                                  <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                      <div>
                                          <h4 className="font-bold text-red-700 text-sm">Peringatan Overstay!</h4>
                                          <p className="text-xs text-red-600 mt-1">Kendaraan ini berada di dalam lebih dari 4 jam.</p>
                                      </div>
                                  </div>
                              )}

                              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">Checklist Keamanan</h3>
                              <div className="space-y-3">
                                  {[
                                      { id: 'suratJalan', label: 'Surat Jalan / DO Sesuai' },
                                      { id: 'safetyShoes', label: 'Menggunakan Sepatu Safety' },
                                      { id: 'vest', label: 'Menggunakan Rompi (Vest)' },
                                      { id: 'helmet', label: 'Menggunakan Helm Proyek' },
                                      { id: 'vehicleCondition', label: 'Kondisi Kendaraan Baik' },
                                  ].map(item => (
                                      <label key={item.id} className="flex items-center gap-4 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                              checklist[item.id as keyof typeof checklist] ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
                                          }`}>
                                              {checklist[item.id as keyof typeof checklist] && <CheckSquare className="w-4 h-4 text-white" />}
                                          </div>
                                          <input 
                                              type="checkbox" 
                                              className="hidden"
                                              checked={checklist[item.id as keyof typeof checklist]} 
                                              onChange={() => setChecklist(prev => ({ ...prev, [item.id]: !prev[item.id as keyof typeof checklist] }))}
                                          />
                                          <span className="font-bold text-slate-700 text-sm">{item.label}</span>
                                      </label>
                                  ))}
                              </div>
                          </>
                      )}
                  </div>

                  <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 space-y-3">
                      <button 
                          onClick={activeTab === 'INSIDE' ? handleCheckout : handleApproveEntry}
                          className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                              (Object.values(checklist).every(Boolean) || activeTab === 'INSIDE') 
                              ? activeTab === 'INSIDE' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                              : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          }`}
                          disabled={activeTab === 'QUEUE' && !Object.values(checklist).every(Boolean)}
                      >
                          {activeTab === 'INSIDE' ? 'IZINKAN KELUAR (CHECKOUT)' : isRevising ? 'SIMPAN REVISI & MASUK' : 'IZINKAN MASUK (APPROVE)'}
                      </button>
                      
                      {activeTab === 'QUEUE' && !isRevising && (
                          <button 
                              onClick={async () => {
                                  const reason = prompt("Alasan penolakan di Gate:");
                                  if(reason) {
                                      await rejectGate(inspectDriver.id, reason);
                                      setInspectDriver(null);
                                      fetchData();
                                  }
                              }}
                              className="w-full py-3 bg-white border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50"
                          >
                              TOLAK DI GATE
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL KAMERA SCANNER (UPDATED V2 PROPS) --- */}
      {showScanner && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center">
            <div className="absolute top-6 right-6 z-10">
                <button onClick={() => setShowScanner(false)} className="p-3 bg-white/20 rounded-full text-white backdrop-blur-md">
                    <XCircle className="w-8 h-8" />
                </button>
            </div>
            
            <div className="w-full max-w-md aspect-square bg-black relative rounded-3xl overflow-hidden border-2 border-slate-700">
                <Scanner 
                    onScan={(result) => {
                        if (result && result.length > 0) {
                            handleScanResult(result[0].rawValue);
                        }
                    }}
                    onError={(error) => console.log(error?.message)}
                    constraints={{ facingMode: 'environment' }}
                    scanDelay={500}
                />
                
                <div className="absolute inset-0 border-[40px] border-black/50 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-4 border-emerald-500/50 rounded-3xl relative animate-pulse">
                         <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(255,0,0,0.8)]"></div>
                    </div>
                </div>
            </div>
            
            <p className="text-white mt-8 font-bold text-center px-6">
                Arahkan kamera ke QR Code Tiket Driver.
            </p>
        </div>
      )}

    </div>
  );
};

export default SecurityDashboard;
