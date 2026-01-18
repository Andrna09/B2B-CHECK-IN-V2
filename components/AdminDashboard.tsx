import React, { useState, useEffect } from 'react';
import { getDrivers, updateDriverStatus, approveBooking, rejectBooking } from '../services/dataService';
import { DriverData, QueueStatus } from '../types';
import { CheckCircle, X, Search, Clock, Truck } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  // Tambahkan 'PENDAFTARAN' di state filter
  const [activeFilter, setActiveFilter] = useState<'PENDAFTARAN' | 'VERIFIKASI' | 'BONGKAR' | 'SELESAI'>('PENDAFTARAN');
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
      setLoading(true);
      const data = await getDrivers();
      setDrivers(data);
      setLoading(false);
  };

  useEffect(() => {
      fetchData();
      const interval = setInterval(fetchData, 10000); // Auto refresh
      return () => clearInterval(interval);
  }, []);

  // Filter Logic sesuai Tab
  const filteredDrivers = drivers.filter(d => {
      if (activeFilter === 'PENDAFTARAN') return d.status === QueueStatus.PENDING_REVIEW;
      if (activeFilter === 'VERIFIKASI') return [QueueStatus.BOOKED, QueueStatus.CHECKED_IN, QueueStatus.AT_GATE].includes(d.status);
      if (activeFilter === 'BONGKAR') return [QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status);
      if (activeFilter === 'SELESAI') return [QueueStatus.COMPLETED, QueueStatus.EXITED].includes(d.status);
      return false;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center">
          <h1 className="text-2xl font-black text-slate-800">Admin Dashboard</h1>
          <button onClick={fetchData} className="px-4 py-2 bg-white border rounded-lg text-sm font-bold shadow-sm">Refresh Data</button>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex gap-2 overflow-x-auto">
          {['PENDAFTARAN', 'VERIFIKASI', 'BONGKAR', 'SELESAI'].map((tab) => (
              <button
                  key={tab}
                  onClick={() => setActiveFilter(tab as any)}
                  className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                      activeFilter === tab ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                  }`}
              >
                  {tab}
                  {/* Badge Counter (Opsional) */}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeFilter === tab ? 'bg-white/20' : 'bg-slate-100'}`}>
                      {drivers.filter(d => {
                          // Logic counter sederhana
                          if (tab === 'PENDAFTARAN') return d.status === QueueStatus.PENDING_REVIEW;
                          if (tab === 'VERIFIKASI') return d.status === QueueStatus.CHECKED_IN;
                          return false;
                      }).length}
                  </span>
              </button>
          ))}
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
          <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                      <th className="p-6 text-xs font-bold text-slate-400 uppercase">Driver Info</th>
                      <th className="p-6 text-xs font-bold text-slate-400 uppercase">Tujuan</th>
                      <th className="p-6 text-xs font-bold text-slate-400 uppercase">Status</th>
                      <th className="p-6 text-right text-xs font-bold text-slate-400 uppercase">Aksi</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {filteredDrivers.length === 0 ? (
                      <tr><td colSpan={4} className="p-10 text-center text-slate-400 font-bold">Tidak ada data di tab ini.</td></tr>
                  ) : (
                      filteredDrivers.map(d => (
                          <tr key={d.id} className="hover:bg-slate-50/50">
                              <td className="p-6">
                                  <div className="font-black text-slate-800 text-lg">{d.licensePlate}</div>
                                  <div className="text-sm text-slate-500">{d.name} • {d.company}</div>
                                  <div className="text-xs text-slate-400 mt-1">{d.phone}</div>
                              </td>
                              <td className="p-6">
                                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${d.purpose === 'LOADING' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                      {d.purpose}
                                  </span>
                              </td>
                              <td className="p-6">
                                  <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                                      {d.status}
                                  </span>
                              </td>
                              <td className="p-6 text-right">
                                  <div className="flex justify-end gap-2">
                                      
                                      {/* AKSI UNTUK TAB PENDAFTARAN */}
                                      {activeFilter === 'PENDAFTARAN' && (
                                          <>
                                              <button 
                                                  onClick={async () => {
                                                      if(confirm(`Terima pendaftaran ${d.licensePlate}?`)) {
                                                          await approveBooking(d.id);
                                                          fetchData();
                                                      }
                                                  }}
                                                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs shadow hover:bg-emerald-600"
                                              >
                                                  <CheckCircle className="w-4 h-4"/> TERIMA
                                              </button>
                                              
                                              <button 
                                                  onClick={async () => {
                                                      const reason = prompt("Alasan Penolakan:");
                                                      if(reason) {
                                                          await rejectBooking(d.id, reason);
                                                          fetchData();
                                                      }
                                                  }}
                                                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 border border-red-100 rounded-xl font-bold text-xs hover:bg-red-100"
                                              >
                                                  <X className="w-4 h-4"/> TOLAK
                                              </button>
                                          </>
                                      )}

                                      {/* AKSI UNTUK TAB VERIFIKASI (Panggil Driver) */}
                                      {activeFilter === 'VERIFIKASI' && d.status === QueueStatus.CHECKED_IN && (
                                          <button 
                                              onClick={() => updateDriverStatus(d.id, QueueStatus.CALLED, "DOCK-01")}
                                              className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs"
                                          >
                                              PANGGIL KE DOCK
                                          </button>
                                      )}

                                      {/* AKSI UNTUK TAB BONGKAR (Selesai) */}
                                      {activeFilter === 'BONGKAR' && d.status === QueueStatus.LOADING && (
                                          <button 
                                              onClick={() => updateDriverStatus(d.id, QueueStatus.COMPLETED)}
                                              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs"
                                          >
                                              SELESAI BONGKAR
                                          </button>
                                      )}

                                      {/* Jika Called, Mulai Bongkar */}
                                      {activeFilter === 'BONGKAR' && d.status === QueueStatus.CALLED && (
                                          <button 
                                              onClick={() => updateDriverStatus(d.id, QueueStatus.LOADING)}
                                              className="px-4 py-2 bg-orange-500 text-white rounded-xl font-bold text-xs"
                                          >
                                              MULAI BONGKAR
                                          </button>
                                      )}

                                  </div>
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

export default AdminDashboard;
