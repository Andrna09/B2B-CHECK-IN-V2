import React, { useState, useEffect } from 'react';
import { getDrivers, updateDriverStatus, callDriver, getDashboardStats } from '../services/dataService';
import { DriverData, QueueStatus } from '../types';
import { 
  Users, Truck, PlayCircle, CheckCircle, Clock, Search, 
  Filter, RefreshCcw, LogOut, Send, AlertTriangle, 
  MoreVertical, Calendar, Megaphone, ArrowRight, XCircle
} from 'lucide-react';

interface DashboardStats {
  total: number;
  waiting: number;
  process: number;
  completed: number;
}

interface Props {
  onLogout: () => void;
}

const AdminDashboard: React.FC<Props> = ({ onLogout }) => {
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ total: 0, waiting: 0, process: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ANTRIAN' | 'BONGKAR' | 'SELESAI'>('ANTRIAN');
  
  // State untuk Modal Panggil
  const [showCallModal, setShowCallModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null);
  const [selectedGate, setSelectedGate] = useState<'GATE_1' | 'GATE_2' | 'GATE_3' | 'GATE_4'>('GATE_2');

  const refresh = async () => {
    setLoading(true);
    try {
      const [driversData, statsData] = await Promise.all([
        getDrivers(),
        getDashboardStats()
      ]);
      setDrivers(driversData);
      setStats(statsData);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000); // Auto refresh 10 detik
    return () => clearInterval(interval);
  }, []);

  // --- ACTIONS ---

  const handleOpenAssign = (driver: DriverData) => {
    setSelectedDriver(driver);
    setShowCallModal(true);
  };

  const confirmCall = async () => {
    if (selectedDriver) {
      await callDriver(selectedDriver.id, "Admin Ops", selectedGate);
      setShowCallModal(false);
      setSelectedDriver(null);
      refresh();
      
      // Opsional: Buka WA otomatis setelah panggil
      const message = generateWATemplate({ ...selectedDriver, gate: selectedGate });
      const url = `https://wa.me/${selectedDriver.phone.replace(/^0/, '62').replace(/\D/g,'')}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: QueueStatus) => {
    if (window.confirm('Apakah anda yakin ingin mengubah status driver ini?')) {
      await updateDriverStatus(id, newStatus, "Admin Ops");
      refresh();
    }
  };

  const generateWATemplate = (driver: DriverData) => {
    const gateName = driver.gate ? driver.gate.replace('_', ' ') : 'DOCKING';
    return `*PANGGILAN BONGKAR MUAT*\n\nKepada Saudara *${driver.name}* (${driver.licensePlate})\n\nSilakan segera merapat ke *${gateName}* untuk proses bongkar muat.\n\nNomor Antrian: *${driver.queueNumber}*\n\nTerima kasih.`;
  };

  // --- FILTERING ---
  
  const filteredDrivers = drivers.filter(d => {
    const matchSearch = d.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        d.company.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchTab = false;
    if (activeFilter === 'ANTRIAN') {
      matchTab = d.status === QueueStatus.VERIFIED; // Menunggu dipanggil
    } else if (activeFilter === 'BONGKAR') {
      // Yang sedang dipanggil atau sedang loading
      matchTab = d.status === QueueStatus.CALLED || d.status === QueueStatus.LOADING;
    } else if (activeFilter === 'SELESAI') {
      matchTab = d.status === QueueStatus.COMPLETED;
    }

    return matchSearch && matchTab;
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      
      {/* HEADER */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-blue-200 shadow-lg">
                <Truck className="text-white w-6 h-6" />
             </div>
             <div>
               <h1 className="text-xl font-black text-slate-800 tracking-tight">ADMIN DASHBOARD</h1>
               <p className="text-xs text-slate-500 font-medium">Warehouse Management System</p>
             </div>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 hover:bg-red-50 text-red-600 rounded-full transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* STATS BAR */}
        <div className="grid grid-cols-4 gap-0 divide-x border-t">
            <div className="p-3 text-center bg-blue-50/50">
               <div className="text-2xl font-black text-blue-600">{stats.waiting}</div>
               <div className="text-[10px] font-bold text-slate-500 uppercase">Menunggu</div>
            </div>
            <div className="p-3 text-center bg-amber-50/50">
               <div className="text-2xl font-black text-amber-600">{stats.process}</div>
               <div className="text-[10px] font-bold text-slate-500 uppercase">Proses</div>
            </div>
            <div className="p-3 text-center bg-emerald-50/50">
               <div className="text-2xl font-black text-emerald-600">{stats.completed}</div>
               <div className="text-[10px] font-bold text-slate-500 uppercase">Selesai</div>
            </div>
            <div className="p-3 text-center">
               <div className="text-2xl font-black text-slate-600">{stats.total}</div>
               <div className="text-[10px] font-bold text-slate-500 uppercase">Total</div>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* CONTROLS */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            {/* TABS */}
            <div className="bg-white p-1 rounded-xl shadow-sm border flex w-full md:w-auto">
                <button 
                  onClick={() => setActiveFilter('ANTRIAN')}
                  className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeFilter === 'ANTRIAN' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  ANTRIAN MASUK
                </button>
                <button 
                  onClick={() => setActiveFilter('BONGKAR')}
                  className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeFilter === 'BONGKAR' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  LOADING PROCESS
                </button>
                <button 
                  onClick={() => setActiveFilter('SELESAI')}
                  className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeFilter === 'SELESAI' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  RIWAYAT
                </button>
            </div>

            {/* SEARCH */}
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Cari Plat Nomor / PT..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                />
            </div>
        </div>

        {/* DRIVER LIST */}
        <div className="space-y-4">
            {loading ? (
                <div className="text-center py-20 text-slate-400 animate-pulse">Memuat data...</div>
            ) : filteredDrivers.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                    <Truck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">Tidak ada kendaraan di kategori ini</p>
                </div>
            ) : (
                filteredDrivers.map(d => (
                    <div key={d.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                        
                        {/* Status Strip */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 
                            ${d.status === QueueStatus.CALLED ? 'bg-amber-500' : 
                              d.status === QueueStatus.LOADING ? 'bg-blue-600' : 
                              d.status === QueueStatus.COMPLETED ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center pl-3">
                            
                            {/* INFO DRIVER */}
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase border border-slate-200">
                                        {d.doNumber}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> 
                                        {new Date(d.checkInTime).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight font-mono">{d.licensePlate}</h3>
                                <p className="text-sm font-bold text-slate-500">{d.company}</p>
                                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                    <Users className="w-3 h-3" /> {d.name} • {d.phone}
                                </p>
                            </div>

                            {/* STATUS & ACTIONS */}
                            <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                                
                                {/* Jika masih antrian -> Tombol Assign Gate */}
                                {activeFilter === 'ANTRIAN' && d.status === QueueStatus.VERIFIED && (
                                    <button 
                                        onClick={() => handleOpenAssign(d)}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg shadow-slate-200 transition-transform active:scale-95"
                                    >
                                        <Megaphone className="w-4 h-4" />
                                        PANGGIL DRIVER
                                    </button>
                                )}

                                {/* --- REVISI UTAMA: BAGIAN BONGKAR --- */}
                                {activeFilter === 'BONGKAR' && (
                                    <div className="flex flex-col gap-2 items-end w-full md:w-auto">
                                        
                                        {/* KONDISI 1: STATUS DIPANGGIL (CALLED) */}
                                        {d.status === QueueStatus.CALLED && (
                                            <div className="flex flex-col gap-2 w-full">
                                                
                                                {/* BARIS TOMBOL OPSI: SUARA & WHATSAPP */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    
                                                    {/* TOMBOL A: SPEAKER TV */}
                                                    <button 
                                                        onClick={async () => {
                                                            // Panggil ulang = Update called_time = Trigger Monitor TV
                                                            await callDriver(d.id, "Admin Ops", d.gate);
                                                            refresh(); 
                                                        }} 
                                                        className="flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm transition-colors"
                                                        title="Bunyikan kembali suara di TV Monitor"
                                                    >
                                                        <Megaphone className="w-3 h-3"/> PANGGIL SUARA
                                                    </button>

                                                    {/* TOMBOL B: WHATSAPP */}
                                                    <button 
                                                        onClick={() => window.open(`https://wa.me/${d.phone.replace(/^0/, '62').replace(/\D/g,'')}?text=${encodeURIComponent(generateWATemplate(d))}`, '_blank')} 
                                                        className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm transition-colors"
                                                        title="Kirim chat WA"
                                                    >
                                                        <Send className="w-3 h-3"/> WHATSAPP
                                                    </button>
                                                </div>

                                                {/* TOMBOL C: TOMBOL UTAMA (LANJUT PROSES) */}
                                                <button 
                                                    onClick={() => handleStatusUpdate(d.id, QueueStatus.LOADING)} 
                                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg text-xs font-black hover:bg-blue-700 shadow-md w-full mt-1 transition-transform active:scale-95"
                                                >
                                                    <ArrowRight className="w-4 h-4"/> DRIVER SUDAH DATANG (MULAI)
                                                </button>
                                            </div>
                                        )}

                                        {/* KONDISI 2: SEDANG BONGKAR (LOADING) */}
                                        {d.status === QueueStatus.LOADING && (
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 animate-pulse">Sedang Bongkar di {d.gate.replace('_',' ')}</div>
                                                <button 
                                                    onClick={() => handleStatusUpdate(d.id, QueueStatus.COMPLETED)} 
                                                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200"
                                                >
                                                    <CheckCircle className="w-4 h-4"/> SELESAI BONGKAR
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Jika sudah selesai */}
                                {activeFilter === 'SELESAI' && (
                                    <div className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
                                        SELESAI
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* MODAL ASSIGN GATE */}
      {showCallModal && selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl scale-100">
              <h2 className="text-xl font-black text-slate-800 mb-1">PANGGIL DRIVER</h2>
              <p className="text-slate-500 text-sm mb-6">Pilih Dock/Gate untuk kendaraan <b>{selectedDriver.licensePlate}</b></p>
              
              <div className="grid grid-cols-2 gap-3 mb-8">
                 {['GATE_1', 'GATE_2', 'GATE_3', 'GATE_4'].map((g) => (
                    <button 
                      key={g}
                      onClick={() => setSelectedGate(g as any)}
                      className={`p-4 rounded-xl border-2 text-center transition-all ${selectedGate === g ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                    >
                       <div className="text-xs font-bold uppercase mb-1">DOCKING</div>
                       <div className="text-2xl font-black">{g.replace('GATE_','')}</div>
                    </button>
                 ))}
              </div>

              <div className="flex gap-3">
                 <button onClick={() => setShowCallModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Batal</button>
                 <button onClick={confirmCall} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200">
                    KONFIRMASI PANGGIL
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
