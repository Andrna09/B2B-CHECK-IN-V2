import React, { useState, useEffect } from 'react';
import { getDrivers, updateDriverStatus, approveBooking, rejectBooking } from '../services/dataService';
import { DriverData, QueueStatus } from '../types';
import { CheckCircle, X, Search, Clock, Truck, Calendar, FileText } from 'lucide-react';

const AdminDashboard: React.FC = () => {
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

  const filteredDrivers = drivers.filter(d => {
      if (activeFilter === 'PENDAFTARAN') return d.status === QueueStatus.PENDING_REVIEW;
      if (activeFilter === 'VERIFIKASI') return [QueueStatus.BOOKED, QueueStatus.CHECKED_IN, QueueStatus.AT_GATE].includes(d.status);
      if (activeFilter === 'BONGKAR') return [QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status);
      if (activeFilter === 'SELESAI') return [QueueStatus.COMPLETED, QueueStatus.EXITED, QueueStatus.REJECTED].includes(d.status);
      return false;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-800">Admin Dashboard</h1>
            <p className="text-slate-500 text-sm">Monitoring pergerakan driver & approval booking</p>
          </div>
          <button onClick={fetchData} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors">Refresh Data</button>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex gap-2 overflow-x-auto">
          {['PENDAFTARAN', 'VERIFIKASI', 'BONGKAR', 'SELESAI'].map((tab) => {
              const count = drivers.filter(d => {
                  if (tab === 'PENDAFTARAN') return d.status === QueueStatus.PENDING_REVIEW;
                  if (tab === 'VERIFIKASI') return [QueueStatus.BOOKED, QueueStatus.CHECKED_IN, QueueStatus.AT_GATE].includes(d.status);
                  if (tab === 'BONGKAR') return [QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status);
                  return false;
              }).length;

              return (
                  <button
                      key={tab}
                      onClick={() => setActiveFilter(tab as any)}
                      className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
                          activeFilter === tab ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                  >
                      {tab}
                      {count > 0 && tab !== 'SELESAI' && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeFilter === tab ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
                              {count}
                          </span>
                      )}
                  </button>
              );
          })}
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
          <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                      <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Driver Info</th>
                      {/* KOLOM BARU: JADWAL & PO */}
                      <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Jadwal & PO</th>
                      <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="p-6 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Aksi</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {filteredDrivers.length === 0 ? (
                      <tr><td colSpan={4} className="p-10 text-center text-slate-400 font-bold italic">Tidak ada data antrian saat ini.</td></tr>
                  ) : (
                      filteredDrivers.map(d => (
                          <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-6">
                                  <div className="flex items-start gap-3">
                                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                                          <Truck className="w-5 h-5" />
                                      </div>
                                      <div>
                                          <div className="font-black text-slate-800 text-lg tracking-tight">{d.licensePlate}</div>
                                          <div className="text-sm font-bold text-slate-600">{d.name}</div>
                                          <div className="text-xs text-slate-400">{d.company} • {d.phone}</div>
                                          {/* Tampilkan Booking Code jika sudah ada */}
                                          {d.bookingCode && (
                                              <div className="mt-2 inline-block px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded border border-amber-100">
                                                  CODE: {d.bookingCode}
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              </td>
                              <td className="p-6">
                                  <div className="space-y-2">
                                      {/* Tampilkan Tanggal Visit */}
                                      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                          <Calendar className="w-4 h-4 text-blue-500" />
                                          {d.visitDate || '-'} <span className="text-slate-400">@</span> {d.slotTime || '-'}
                                      </div>
                                      {/* Tampilkan Nomor PO */}
                                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100 w-fit">
                                          <FileText className="w-3 h-3" />
                                          PO: {d.poNumber || 'Tanpa PO'}
                                      </div>
                                      {/* Tampilkan Purpose */}
                                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${d.purpose === 'LOADING' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                          {d.purpose}
                                      </span>
                                  </div>
                              </td>
                              <td className="p-6">
                                  <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                                      d.status === QueueStatus.PENDING_REVIEW ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                      d.status === QueueStatus.BOOKED ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                      d.status === QueueStatus.REJECTED ? 'bg-red-50 text-red-600 border-red-100' :
                                      'bg-slate-50 text-slate-600 border-slate-100'
                                  }`}>
                                      {d.status.replace(/_/g, ' ')}
                                  </span>
                              </td>
                              <td className="p-6 text-right">
                                  <div className="flex justify-end gap-2">
                                      
                                      {/* AKSI UNTUK TAB PENDAFTARAN */}
                                      {activeFilter === 'PENDAFTARAN' && (
                                          <>
                                              <button 
                                                  onClick={async () => {
                                                      if(confirm(`Konfirmasi Data?\nPO: ${d.poNumber}\nTanggal: ${d.visitDate}`)) {
                                                          await approveBooking(d.id);
                                                          fetchData();
                                                      }
                                                  }}
                                                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs shadow hover:bg-emerald-600 transition-all hover:scale-105"
                                              >
                                                  <CheckCircle className="w-4 h-4"/> TERIMA
                                              </button>
                                              
                                              <button 
                                                  onClick={async () => {
                                                      const reason = prompt("Alasan Penolakan (Misal: PO Salah / Kapasitas Penuh):");
                                                      if(reason) {
                                                          await rejectBooking(d.id, reason);
                                                          fetchData();
                                                      }
                                                  }}
                                                  className="flex items-center gap-2 px-4 py-2 bg-white text-red-500 border border-red-100 rounded-xl font-bold text-xs hover:bg-red-50 transition-all"
                                              >
                                                  <X className="w-4 h-4"/> TOLAK
                                              </button>
                                          </>
                                      )}

                                      {/* AKSI UNTUK TAB VERIFIKASI (Panggil Driver) */}
                                      {activeFilter === 'VERIFIKASI' && d.status === QueueStatus.CHECKED_IN && (
                                          <button 
                                              onClick={() => updateDriverStatus(d.id, QueueStatus.CALLED, "DOCK-01")}
                                              className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-slate-800"
                                          >
                                              PANGGIL KE DOCK
                                          </button>
                                      )}

                                      {/* AKSI UNTUK TAB BONGKAR */}
                                      {activeFilter === 'BONGKAR' && (
                                          <>
                                            {d.status === QueueStatus.CALLED && (
                                              <button 
                                                  onClick={() => updateDriverStatus(d.id, QueueStatus.LOADING)}
                                                  className="px-4 py-2 bg-orange-500 text-white rounded-xl font-bold text-xs hover:bg-orange-600"
                                              >
                                                  MULAI KEGIATAN
                                              </button>
                                            )}
                                            {d.status === QueueStatus.LOADING && (
                                              <button 
                                                  onClick={() => updateDriverStatus(d.id, QueueStatus.COMPLETED)}
                                                  className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700"
                                              >
                                                  SELESAI KEGIATAN
                                              </button>
                                            )}
                                          </>
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
