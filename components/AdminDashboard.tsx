//
import React, { useState, useEffect } from 'react';
import { getDrivers, updateDriverStatus, approveBooking, rejectBooking } from '../services/dataService';
import { DriverData, QueueStatus } from '../types';
import { 
  CheckCircle, X, Search, Clock, Calendar, FileText, 
  RefreshCw, Activity, PlayCircle, Filter 
} from 'lucide-react';
import Layout from './Layout'; // Import Layout Sidebar

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
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
  }, []);

  // Filter Logic
  const filteredDrivers = drivers.filter(d => {
      let matchStatus = false;
      if (activeFilter === 'PENDAFTARAN') matchStatus = d.status === QueueStatus.PENDING_REVIEW;
      else if (activeFilter === 'VERIFIKASI') matchStatus = [QueueStatus.BOOKED, QueueStatus.CHECKED_IN, QueueStatus.AT_GATE].includes(d.status);
      else if (activeFilter === 'BONGKAR') matchStatus = [QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status);
      else if (activeFilter === 'SELESAI') matchStatus = [QueueStatus.COMPLETED, QueueStatus.EXITED, QueueStatus.REJECTED].includes(d.status);

      const searchLower = searchTerm.toLowerCase();
      const matchSearch = 
        d.name.toLowerCase().includes(searchLower) ||
        d.licensePlate.toLowerCase().includes(searchLower) ||
        (d.poNumber || '').toLowerCase().includes(searchLower) ||
        (d.bookingCode || '').toLowerCase().includes(searchLower);

      return matchStatus && matchSearch;
  });

  const stats = {
    pending: drivers.filter(d => d.status === QueueStatus.PENDING_REVIEW).length,
    processing: drivers.filter(d => [QueueStatus.CHECKED_IN, QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status)).length,
    completed: drivers.filter(d => d.status === QueueStatus.COMPLETED).length
  };

  // Kita wrap konten dashboard dengan <Layout> agar ada Sidebar
  return (
    <Layout>
      <div className="space-y-8">
        
        {/* Header Content (Judul Halaman & Refresh) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div>
              <h2 className="text-2xl font-black text-slate-800">Traffic Monitoring</h2>
              <p className="text-slate-500 font-medium text-sm mt-1">Kelola antrian masuk dan keluar gudang</p>
           </div>
           <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
               <Clock className="w-3.5 h-3.5 text-slate-400" />
               Last Sync: {lastUpdated.toLocaleTimeString()}
               <button onClick={fetchData} className={`ml-2 p-1 rounded-full hover:bg-slate-100 ${loading ? 'animate-spin text-blue-600' : 'text-slate-400'}`} title="Refresh">
                  <RefreshCw className="w-3.5 h-3.5"/>
               </button>
           </div>
        </div>

        {/* KPI Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard icon={<FileText className="text-amber-600"/>} label="Menunggu Approval" value={stats.pending} color="bg-amber-50 border-amber-100" />
          <StatCard icon={<Activity className="text-blue-600"/>} label="Sedang Berlangsung" value={stats.processing} color="bg-blue-50 border-blue-100" />
          <StatCard icon={<CheckCircle className="text-emerald-600"/>} label="Selesai Hari Ini" value={stats.completed} color="bg-emerald-50 border-emerald-100" />
        </div>

        {/* Toolbar (Tabs & Search) */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row justify-between items-center gap-4">
            <div className="flex p-1 bg-slate-100 rounded-xl w-full lg:w-auto overflow-x-auto">
               {['PENDAFTARAN', 'VERIFIKASI', 'BONGKAR', 'SELESAI'].map((tab) => (
                 <TabButton key={tab} active={activeFilter === tab} onClick={() => setActiveFilter(tab as any)} label={tab} />
               ))}
            </div>
            <div className="relative w-full lg:w-72 mr-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Cari Plat / PO / Nama..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-0 rounded-xl font-bold text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
              />
            </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                        <th className="p-5 text-xs font-extrabold text-slate-400 uppercase tracking-wider w-1/3">Driver & Kendaraan</th>
                        <th className="p-5 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Detail Muatan</th>
                        <th className="p-5 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="p-5 text-right text-xs font-extrabold text-slate-400 uppercase tracking-wider">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredDrivers.length === 0 ? (
                        <tr><td colSpan={4} className="p-20 text-center text-slate-400 font-bold italic flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center"><Filter className="w-8 h-8 text-slate-300"/></div>
                            Tidak ada data driver untuk filter ini.
                        </td></tr>
                    ) : (
                        filteredDrivers.map(d => (
                            <tr key={d.id} className="hover:bg-blue-50/20 transition-colors group">
                                <td className="p-5 align-top">
                                    <div className="flex gap-4">
                                        <div className={`w-12 h-12 shrink-0 rounded-xl flex flex-col items-center justify-center font-bold text-[10px] shadow-sm border ${d.purpose === 'LOADING' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                                            <span className="text-lg leading-none mb-0.5">{d.purpose === 'LOADING' ? 'OUT' : 'IN'}</span>
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-800 text-base">{d.licensePlate}</div>
                                            <div className="text-sm font-bold text-slate-600">{d.name}</div>
                                            <div className="text-xs text-slate-400 mt-1">{d.company}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-5 align-top">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            {d.visitDate || '-'} <span className="text-slate-300">|</span> {d.slotTime || '-'}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-1 rounded-md text-[11px] font-mono font-bold">
                                                PO: {d.poNumber || 'N/A'}
                                            </span>
                                        </div>
                                        {d.bookingCode && <div className="text-[10px] font-bold text-blue-500 mt-1">#{d.bookingCode}</div>}
                                    </div>
                                </td>
                                <td className="p-5 align-top">
                                    <StatusBadge status={d.status} />
                                    {d.gate !== 'NONE' && (
                                        <div className="mt-2 text-xs font-bold text-slate-500 pl-1 border-l-2 border-slate-200">
                                            📍 {d.gate}
                                        </div>
                                    )}
                                </td>
                                <td className="p-5 align-top text-right">
                                    <ActionButtons driver={d} filter={activeFilter} onRefresh={fetchData} />
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </Layout>
  );
};

// --- SUB COMPONENTS ---

const StatCard = ({ icon, label, value, color }: any) => (
    <div className={`p-5 rounded-2xl border flex items-center gap-5 shadow-sm hover:shadow-md transition-all cursor-default ${color} bg-opacity-40`}>
        <div className="p-3 bg-white rounded-xl shadow-sm ring-1 ring-slate-100">{icon}</div>
        <div>
            <div className="text-3xl font-black text-slate-800 tracking-tight">{value}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-0.5">{label}</div>
        </div>
    </div>
);

const TabButton = ({ active, onClick, label }: any) => (
    <button
        onClick={onClick}
        className={`px-6 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wide whitespace-nowrap transition-all ${
            active ? 'bg-white text-slate-800 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
        }`}
    >
        {label}
    </button>
);

const StatusBadge = ({ status }: { status: string }) => {
    let color = 'bg-slate-100 text-slate-500 border-slate-200';
    if (status === QueueStatus.PENDING_REVIEW) color = 'bg-amber-50 text-amber-600 border-amber-200';
    else if (status === QueueStatus.BOOKED) color = 'bg-blue-50 text-blue-600 border-blue-200';
    else if (status === QueueStatus.CHECKED_IN) color = 'bg-indigo-50 text-indigo-600 border-indigo-200';
    else if (status === QueueStatus.LOADING) color = 'bg-orange-50 text-orange-600 border-orange-200';
    else if (status === QueueStatus.COMPLETED) color = 'bg-emerald-50 text-emerald-600 border-emerald-200';
    else if (status === QueueStatus.REJECTED) color = 'bg-red-50 text-red-600 border-red-200';

    return (
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wide border ${color}`}>
            {status.replace(/_/g, ' ')}
        </span>
    );
};

const ActionButtons = ({ driver, filter, onRefresh }: any) => {
    const d = driver;
    if (filter === 'PENDAFTARAN') return (
        <div className="flex flex-col gap-2 items-end">
            <button onClick={async () => { if(confirm(`Approve ${d.name}?`)) { await approveBooking(d.id); onRefresh(); }}} className="w-24 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs shadow-sm shadow-emerald-200 transition-all flex justify-center items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5"/> Approve
            </button>
            <button onClick={async () => { const r = prompt("Alasan:"); if(r) { await rejectBooking(d.id, r); onRefresh(); }}} className="w-24 py-2 bg-white border border-red-200 text-red-500 hover:bg-red-50 rounded-lg font-bold text-xs transition-all flex justify-center items-center gap-1">
                <X className="w-3.5 h-3.5"/> Reject
            </button>
        </div>
    );
    if (filter === 'VERIFIKASI' && d.status === QueueStatus.CHECKED_IN) return (
        <button onClick={() => updateDriverStatus(d.id, QueueStatus.CALLED, "DOCK-AUTO")} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-900 shadow-lg shadow-slate-300">Force Call</button>
    );
    if (filter === 'BONGKAR') return (
        <div className="flex flex-col gap-2 items-end">
            {d.status === QueueStatus.CALLED && <button onClick={() => updateDriverStatus(d.id, QueueStatus.LOADING)} className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold text-xs shadow-sm hover:bg-orange-600 flex items-center gap-2"><PlayCircle className="w-3.5 h-3.5"/> Start</button>}
            {d.status === QueueStatus.LOADING && <button onClick={() => updateDriverStatus(d.id, QueueStatus.COMPLETED)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs shadow-sm hover:bg-blue-700 flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5"/> Finish</button>}
        </div>
    );
    return <span className="text-slate-300 text-[10px] font-bold italic">No Action</span>;
};

export default AdminDashboard;
