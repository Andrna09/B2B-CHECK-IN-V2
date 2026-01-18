import React, { useState, useEffect } from 'react';
import { getDrivers, updateDriverStatus, approveBooking, rejectBooking } from '../services/dataService';
import { DriverData, QueueStatus } from '../types';
import { 
  CheckCircle, X, Search, Clock, Truck, Calendar, FileText, 
  RefreshCw, Activity, LogOut, PlayCircle 
} from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'PENDAFTARAN' | 'VERIFIKASI' | 'BONGKAR' | 'SELESAI'>('PENDAFTARAN');
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchData = async () => {
      setLoading(true);
      const data = await getDrivers();
      setDrivers(data);
      setLastUpdated(new Date());
      setLoading(false);
  };

  useEffect(() => {
      fetchData();
      const interval = setInterval(fetchData, 10000); // Auto refresh 10 detik
      return () => clearInterval(interval);
  }, []);

  // --- LOGIC: FILTER & SEARCH ---
  const filteredDrivers = drivers.filter(d => {
      // 1. Filter Tab Status
      let matchStatus = false;
      if (activeFilter === 'PENDAFTARAN') matchStatus = d.status === QueueStatus.PENDING_REVIEW;
      else if (activeFilter === 'VERIFIKASI') matchStatus = [QueueStatus.BOOKED, QueueStatus.CHECKED_IN, QueueStatus.AT_GATE].includes(d.status);
      else if (activeFilter === 'BONGKAR') matchStatus = [QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status);
      else if (activeFilter === 'SELESAI') matchStatus = [QueueStatus.COMPLETED, QueueStatus.EXITED, QueueStatus.REJECTED].includes(d.status);

      // 2. Filter Search (Nama, Plat, PO, Booking Code)
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = 
        d.name.toLowerCase().includes(searchLower) ||
        d.licensePlate.toLowerCase().includes(searchLower) ||
        (d.poNumber || '').toLowerCase().includes(searchLower) ||
        (d.bookingCode || '').toLowerCase().includes(searchLower);

      return matchStatus && matchSearch;
  });

  // --- STATS COUNT ---
  const stats = {
    pending: drivers.filter(d => d.status === QueueStatus.PENDING_REVIEW).length,
    processing: drivers.filter(d => [QueueStatus.CHECKED_IN, QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status)).length,
    completed: drivers.filter(d => d.status === QueueStatus.COMPLETED).length
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-8 bg-slate-50 min-h-screen font-sans">
      
      {/* --- HEADER & STATS --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 font-medium">Overview Operasional Gudang</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400 bg-white px-3 py-1.5 rounded-full w-fit border border-slate-200 shadow-sm">
             <Clock className="w-3 h-3" />
             Update: {lastUpdated.toLocaleTimeString()}
             <button onClick={fetchData} className={`ml-2 hover:text-blue-600 ${loading ? 'animate-spin' : ''}`}><RefreshCw className="w-3 h-3"/></button>
          </div>
        </div>

        {/* Stats Cards */}
        <StatCard icon={<FileText className="text-amber-600"/>} label="Menunggu Approval" value={stats.pending} color="bg-amber-50 border-amber-100" />
        <StatCard icon={<Activity className="text-blue-600"/>} label="Sedang Proses" value={stats.processing} color="bg-blue-50 border-blue-100" />
        <StatCard icon={<CheckCircle className="text-emerald-600"/>} label="Selesai Hari Ini" value={stats.completed} color="bg-emerald-50 border-emerald-100" />
      </div>

      {/* --- TOOLBAR (TABS & SEARCH) --- */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-4 z-20">
          
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1.5 rounded-xl w-full md:w-auto overflow-x-auto">
             <TabButton active={activeFilter === 'PENDAFTARAN'} onClick={() => setActiveFilter('PENDAFTARAN')} label="Pendaftaran" count={stats.pending} />
             <TabButton active={activeFilter === 'VERIFIKASI'} onClick={() => setActiveFilter('VERIFIKASI')} label="Verifikasi Security" />
             <TabButton active={activeFilter === 'BONGKAR'} onClick={() => setActiveFilter('BONGKAR')} label="Bongkar/Muat" count={stats.processing} />
             <TabButton active={activeFilter === 'SELESAI'} onClick={() => setActiveFilter('SELESAI')} label="Riwayat" />
          </div>

          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Cari Plat, Nama, PO..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
      </div>

      {/* --- MAIN TABLE LIST --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                      <th className="p-5 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Driver Detail</th>
                      <th className="p-5 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Jadwal & Dokumen</th>
                      <th className="p-5 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Status Flow</th>
                      <th className="p-5 text-right text-xs font-extrabold text-slate-400 uppercase tracking-wider">Tindakan</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {filteredDrivers.length === 0 ? (
                      <tr><td colSpan={4} className="p-12 text-center text-slate-400 font-bold italic">Data tidak ditemukan untuk filter ini.</td></tr>
                  ) : (
                      filteredDrivers.map(d => (
                          <tr key={d.id} className="hover:bg-blue-50/30 transition-colors group">
                              <td className="p-5">
                                  <div className="flex items-center gap-4">
                                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm ${d.purpose === 'LOADING' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                          {d.purpose === 'LOADING' ? 'OUT' : 'IN'}
                                      </div>
                                      <div>
                                          <div className="font-black text-slate-800 text-lg">{d.licensePlate}</div>
                                          <div className="font-bold text-slate-600 text-sm">{d.name}</div>
                                          <div className="text-xs font-medium text-slate-400 mt-0.5">{d.company} • {d.phone}</div>
                                      </div>
                                  </div>
                              </td>
                              <td className="p-5">
                                  <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                          <Calendar className="w-4 h-4 text-slate-400" />
                                          {d.visitDate ? formatDate(d.visitDate) : '-'} 
                                          <span className="bg-slate-100 px-1.5 rounded text-slate-500 text-xs py-0.5">Jam {d.slotTime}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">PO:</span>
                                        <span className="text-xs font-mono font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                                            {d.poNumber || 'N/A'}
                                        </span>
                                      </div>
                                      {d.bookingCode && (
                                          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                              #{d.bookingCode}
                                          </div>
                                      )}
                                  </div>
                              </td>
                              <td className="p-5">
                                  <StatusBadge status={d.status} />
                                  {d.gate !== 'NONE' && (
                                      <div className="mt-2 text-xs font-bold text-slate-500 flex items-center gap-1">
                                          📍 {d.gate}
                                      </div>
                                  )}
                              </td>
                              <td className="p-5 text-right">
                                  <ActionButtons 
                                    driver={d} 
                                    filter={activeFilter} 
                                    onRefresh={fetchData} 
                                  />
                              </td>
                          </tr>
                      ))
                  )}
              </tbody>
          </table>
      </div>
    </div>
  );
};

// --- SUB COMPONENTS (Agar kode lebih rapi) ---

const StatCard = ({ icon, label, value, color }: any) => (
    <div className={`p-4 rounded-2xl border flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow ${color}`}>
        <div className="p-3 bg-white rounded-xl shadow-sm">{icon}</div>
        <div>
            <div className="text-2xl font-black text-slate-800">{value}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</div>
        </div>
    </div>
);

const TabButton = ({ active, onClick, label, count }: any) => (
    <button
        onClick={onClick}
        className={`px-5 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
            active ? 'bg-white text-slate-800 shadow-md ring-1 ring-slate-200' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700'
        }`}
    >
        {label}
        {count > 0 && (
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${active ? 'bg-slate-800 text-white' : 'bg-slate-300 text-slate-600'}`}>
                {count}
            </span>
        )}
    </button>
);

const StatusBadge = ({ status }: { status: string }) => {
    let color = 'bg-slate-100 text-slate-500 border-slate-200';
    if (status === QueueStatus.PENDING_REVIEW) color = 'bg-amber-100 text-amber-700 border-amber-200';
    else if (status === QueueStatus.BOOKED) color = 'bg-blue-100 text-blue-700 border-blue-200';
    else if (status === QueueStatus.CHECKED_IN) color = 'bg-indigo-100 text-indigo-700 border-indigo-200';
    else if (status === QueueStatus.LOADING) color = 'bg-orange-100 text-orange-700 border-orange-200';
    else if (status === QueueStatus.COMPLETED) color = 'bg-emerald-100 text-emerald-700 border-emerald-200';
    else if (status === QueueStatus.REJECTED) color = 'bg-red-100 text-red-700 border-red-200';

    return (
        <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${color}`}>
            {status.replace(/_/g, ' ')}
        </span>
    );
};

const ActionButtons = ({ driver, filter, onRefresh }: any) => {
    const d = driver;
    
    // 1. Pendaftaran Action
    if (filter === 'PENDAFTARAN') return (
        <div className="flex justify-end gap-2">
            <button onClick={async () => {
                if(confirm(`Setujui Booking untuk ${d.name}?`)) { await approveBooking(d.id); onRefresh(); }
            }} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-sm shadow-emerald-200 transition-all active:scale-95">
                <CheckCircle className="w-4 h-4"/> Approve
            </button>
            <button onClick={async () => {
                const reason = prompt("Alasan Penolakan:");
                if(reason) { await rejectBooking(d.id, reason); onRefresh(); }
            }} className="flex items-center gap-2 px-4 py-2 bg-white border border-red-100 text-red-500 hover:bg-red-50 rounded-xl font-bold text-xs transition-all active:scale-95">
                <X className="w-4 h-4"/> Reject
            </button>
        </div>
    );

    // 2. Verifikasi Action (Security Area) - Admin hanya monitoring, tapi bisa bypass call
    if (filter === 'VERIFIKASI' && d.status === QueueStatus.CHECKED_IN) return (
        <button onClick={() => updateDriverStatus(d.id, QueueStatus.CALLED, "DOCK-AUTO")} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-900 shadow-lg shadow-slate-200">
            Force Call
        </button>
    );

    // 3. Bongkar Muat Action
    if (filter === 'BONGKAR') return (
        <div className="flex justify-end gap-2">
            {d.status === QueueStatus.CALLED && (
                <button onClick={() => updateDriverStatus(d.id, QueueStatus.LOADING)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-xs shadow-sm shadow-orange-200 transition-all">
                    <PlayCircle className="w-4 h-4"/> Start Loading
                </button>
            )}
            {d.status === QueueStatus.LOADING && (
                <button onClick={() => updateDriverStatus(d.id, QueueStatus.COMPLETED)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm shadow-blue-200 transition-all">
                    <CheckCircle className="w-4 h-4"/> Finish Job
                </button>
            )}
        </div>
    );

    return <span className="text-slate-300 text-xs font-bold italic">No Action</span>;
};

// Helper Format Tanggal
const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
};

export default AdminDashboard;
