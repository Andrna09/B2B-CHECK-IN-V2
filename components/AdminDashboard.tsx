import React, { useState, useEffect } from 'react';
import { Truck, Users, Clock, Search, BarChart3, Settings, Shield, Activity, LogOut, Plus, Trash2, Database, Save } from 'lucide-react';
import { DriverData, QueueStatus, UserProfile } from '../types';
import { getDrivers, updateDriverStatus, getActivityLogs, wipeDatabase, seedDummyData, exportDatabase, importDatabase, getGateConfigs, saveGateConfig, getProfiles, addProfile, deleteProfile, getDivisions, saveDivision, deleteDivision, deleteSystemSetting, getDevConfig, DevConfig } from '../services/dataService';
import { supabase } from '../services/supabaseClient'; 
import AdminReports from './AdminReports';

interface Props {
  onBack: () => void;
  currentUser: UserProfile | null;
}

const AdminDashboard: React.FC<Props> = ({ onBack, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'QUEUE' | 'GATES' | 'USERS' | 'SETTINGS'>('OVERVIEW');
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showGateModal, setShowGateModal] = useState<string | null>(null);
  
  // Data State
  const [gateConfigs, setGateConfigs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  
  // Form State
  const [newProfile, setNewProfile] = useState({ name: '', role: 'SECURITY' });
  const [newGate, setNewGate] = useState({ id: '', name: '', type: 'LOADING' });

  // --- FUNGSI UTAMA ---
  const fetchData = async () => {
    setLoading(true);
    const data = await getDrivers();
    if(data) setDrivers(data);

    // Selalu ambil data config biar tab lain ready
    const gates = await getGateConfigs();
    setGateConfigs(gates);
    const users = await getProfiles();
    setProfiles(users);

    setLoading(false);
  };

  // 🔥 REALTIME SUBSCRIPTION 🔥
  useEffect(() => {
    fetchData();

    const driverChannel = supabase.channel('admin-drivers').on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => fetchData()).subscribe();
    const gateChannel = supabase.channel('admin-gates').on('postgres_changes', { event: '*', schema: 'public', table: 'gate_configs' }, () => fetchData()).subscribe();
    const userChannel = supabase.channel('admin-users').on('postgres_changes', { event: '*', schema: 'public', table: 'regular_drivers' }, () => fetchData()).subscribe();

    return () => {
        supabase.removeChannel(driverChannel);
        supabase.removeChannel(gateChannel);
        supabase.removeChannel(userChannel);
    };
  }, []); 

  // --- LOGIC GATE & QUEUE ---
  const handleAssignGate = async (driverId: string, gateName: string) => {
      await updateDriverStatus(driverId, QueueStatus.CALLED, gateName);
      setShowGateModal(null);
  };
  const handleStartLoading = async (driverId: string) => await updateDriverStatus(driverId, QueueStatus.LOADING);
  const handleFinishLoading = async (driverId: string) => await updateDriverStatus(driverId, QueueStatus.COMPLETED);

  // --- LOGIC CRUD (ADD/DELETE) ---
  const handleAddProfile = async () => {
      if(!newProfile.name) return;
      await addProfile({ id: Date.now().toString(), name: newProfile.name, role: newProfile.role as any, status: 'ACTIVE' });
      setNewProfile({ name: '', role: 'SECURITY' });
  };
  const handleDeleteProfile = async (id: string) => { if(confirm('Hapus user?')) await deleteProfile(id); };

  const handleAddGate = async () => {
      if(!newGate.name) return;
      await saveGateConfig({ id: Date.now().toString(), name: newGate.name.toUpperCase(), type: newGate.type as any, status: 'AVAILABLE' });
      setNewGate({ id: '', name: '', type: 'LOADING' });
  };
  const handleDeleteGate = async (id: string) => { if(confirm('Hapus gate?')) await deleteSystemSetting(id); };

  // --- DATABASE TOOLS ---
  const handleWipe = async () => { if(confirm('⚠️ HAPUS SEMUA DATA?')) { await wipeDatabase(); fetchData(); } };
  const handleSeed = async () => { await seedDummyData(); fetchData(); };

  // Filtering Data
  const waitingDrivers = drivers.filter(d => d.status === QueueStatus.CHECKED_IN).sort((a,b) => (a.queueNumber > b.queueNumber ? 1 : -1));
  const activeDrivers = drivers.filter(d => [QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status));
  const loadingGates = gateConfigs.length > 0 ? gateConfigs : [{name: 'DOCK 1'}, {name: 'DOCK 2'}, {name: 'DOCK 3'}];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* NAVBAR */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg"><Activity className="w-6 h-6 text-white"/></div>
              <div><h1 className="text-xl font-black text-slate-800">COMMAND CENTER</h1><p className="text-xs text-slate-500 font-bold uppercase">Administrator</p></div>
          </div>
          <div className="flex items-center gap-4">
               <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> REALTIME</div>
               <div className="text-right hidden sm:block">
                   <p className="text-sm font-bold text-slate-700">{currentUser?.name}</p>
                   <p className="text-xs text-slate-500">{currentUser?.role}</p>
               </div>
               <button onClick={onBack} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><LogOut className="w-5 h-5 text-slate-600"/></button>
          </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
          
          {/* SIDEBAR */}
          <div className="w-64 bg-white border-r flex flex-col py-6">
              <nav className="space-y-1 px-3">
                  {[
                      {id: 'OVERVIEW', icon: BarChart3, label: 'Dashboard'},
                      {id: 'QUEUE', icon: Truck, label: 'Queue Control'},
                      {id: 'GATES', icon: Settings, label: 'Gate Management'},
                      {id: 'USERS', icon: Users, label: 'User Access'},
                      {id: 'SETTINGS', icon: Shield, label: 'System Config'}
                  ].map(item => (
                      <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                          <item.icon className="w-5 h-5"/> {item.label}
                      </button>
                  ))}
              </nav>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-8">
              
              {/* 1. DASHBOARD OVERVIEW */}
              {activeTab === 'OVERVIEW' && (
                  <div className="space-y-6 animate-fade-in-up">
                      <div className="grid grid-cols-4 gap-6">
                          <div className="bg-white p-6 rounded-2xl border shadow-sm">
                              <div className="flex justify-between mb-4"><div className="p-3 bg-blue-50 rounded-xl text-blue-600"><Truck/></div><span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded">TOTAL</span></div>
                              <h3 className="text-3xl font-black">{drivers.length}</h3>
                              <p className="text-sm text-slate-400">Total Kendaraan</p>
                          </div>
                          <div className="bg-white p-6 rounded-2xl border shadow-sm">
                              <div className="flex justify-between mb-4"><div className="p-3 bg-amber-50 rounded-xl text-amber-600"><Clock/></div><span className="text-xs font-bold bg-amber-100 px-2 py-1 rounded text-amber-600 animate-pulse">WAITING</span></div>
                              <h3 className="text-3xl font-black">{waitingDrivers.length}</h3>
                              <p className="text-sm text-slate-400">Sedang Menunggu</p>
                          </div>
                          <div className="bg-white p-6 rounded-2xl border shadow-sm">
                              <div className="flex justify-between mb-4"><div className="p-3 bg-emerald-50 rounded-xl text-emerald-600"><Activity/></div><span className="text-xs font-bold bg-emerald-100 px-2 py-1 rounded text-emerald-600">ACTIVE</span></div>
                              <h3 className="text-3xl font-black">{activeDrivers.length}</h3>
                              <p className="text-sm text-slate-400">Sedang Bongkar</p>
                          </div>
                          <div className="bg-white p-6 rounded-2xl border shadow-sm">
                              <div className="flex justify-between mb-4"><div className="p-3 bg-purple-50 rounded-xl text-purple-600"><Settings/></div><span className="text-xs font-bold bg-purple-100 px-2 py-1 rounded text-purple-600">GATES</span></div>
                              <h3 className="text-3xl font-black">{loadingGates.length}</h3>
                              <p className="text-sm text-slate-400">Total Dock/Gate</p>
                          </div>
                      </div>
                      <div className="bg-white rounded-2xl border shadow-sm p-6">
                          <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Laporan Operasional</h3>
                          <AdminReports drivers={drivers} />
                      </div>
                  </div>
              )}

              {/* 2. QUEUE CONTROL */}
              {activeTab === 'QUEUE' && (
                  <div className="flex gap-6 h-full animate-fade-in-up">
                      <div className="flex-1 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                          <div className="p-4 bg-amber-50 border-b"><h3 className="font-bold text-amber-800">Menunggu ({waitingDrivers.length})</h3></div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-3">
                              {waitingDrivers.map(d => (
                                  <div key={d.id} className="p-4 border rounded-xl hover:shadow-md bg-white">
                                      <div className="flex justify-between"><span className="font-black text-lg">{d.queueNumber}</span><span className="text-xs bg-slate-100 px-2 py-1 rounded font-bold">{d.licensePlate}</span></div>
                                      <p className="text-xs text-slate-500 mb-3">{d.company}</p>
                                      <div className="relative">
                                          <button onClick={() => setShowGateModal(d.id)} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">PANGGIL KE DOCK</button>
                                          {showGateModal === d.id && (
                                              <div className="absolute top-full left-0 w-full mt-2 bg-white border shadow-xl rounded-xl z-20 p-2 grid grid-cols-2 gap-2">
                                                  {loadingGates.map((g: any) => (<button key={g.name} onClick={() => handleAssignGate(d.id, g.name)} className="p-2 text-xs font-bold bg-slate-50 hover:bg-emerald-50 border rounded-lg">{g.name}</button>))}
                                                  <button onClick={() => setShowGateModal(null)} className="col-span-2 p-2 text-xs font-bold text-red-500 bg-red-50 rounded-lg">Batal</button>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              ))}
                              {waitingDrivers.length === 0 && <p className="text-center py-10 text-slate-400 text-sm">Antrian Kosong</p>}
                          </div>
                      </div>
                      <div className="flex-1 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                          <div className="p-4 bg-emerald-50 border-b"><h3 className="font-bold text-emerald-800">Sedang Bongkar ({activeDrivers.length})</h3></div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-3">
                              {activeDrivers.map(d => (
                                  <div key={d.id} className={`p-4 border rounded-xl bg-white ${d.status === QueueStatus.CALLED ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-emerald-500'}`}>
                                      <div className="flex justify-between mb-2"><span className="font-black">{d.licensePlate}</span><span className="text-xs font-bold px-2 py-1 bg-slate-900 text-white rounded">{d.gate}</span></div>
                                      <div className="flex gap-2">
                                          {d.status === QueueStatus.CALLED ? (<button onClick={() => handleStartLoading(d.id)} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold">MULAI</button>) 
                                          : (<button onClick={() => handleFinishLoading(d.id)} className="flex-1 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold">SELESAI</button>)}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              )}

              {/* 3. GATE MANAGEMENT (SUDAH DIKEMBALIKAN) */}
              {activeTab === 'GATES' && (
                  <div className="space-y-6 animate-fade-in-up">
                      <div className="bg-white rounded-2xl border p-6">
                          <h3 className="font-bold text-lg mb-4">Tambah Gate / Dock Baru</h3>
                          <div className="flex gap-2">
                              <input placeholder="Nama Gate (Contoh: DOCK 5)" className="border p-2 rounded-lg text-sm w-full" value={newGate.name} onChange={e => setNewGate({...newGate, name: e.target.value})} />
                              <button onClick={handleAddGate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-2"><Plus className="w-4 h-4"/> TAMBAH</button>
                          </div>
                      </div>
                      <div className="bg-white rounded-2xl border p-6">
                          <h3 className="font-bold text-lg mb-4">Daftar Gate Aktif</h3>
                          <div className="grid grid-cols-3 gap-4">
                              {gateConfigs.length === 0 && <p className="text-slate-400 text-sm">Belum ada gate yang disetting.</p>}
                              {gateConfigs.map(g => (
                                  <div key={g.id} className="p-4 border rounded-xl flex justify-between items-center bg-slate-50">
                                      <span className="font-black text-slate-700">{g.name}</span>
                                      <button onClick={() => handleDeleteGate(g.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              )}

              {/* 4. USER ACCESS (SUDAH DIKEMBALIKAN) */}
              {activeTab === 'USERS' && (
                  <div className="space-y-6 animate-fade-in-up">
                       <div className="bg-white rounded-2xl border p-6">
                          <h3 className="font-bold text-lg mb-4">Tambah User Staff</h3>
                          <div className="flex gap-2">
                              <input placeholder="Nama Staff" className="border p-2 rounded-lg text-sm w-full" value={newProfile.name} onChange={e => setNewProfile({...newProfile, name: e.target.value})} />
                              <select className="border p-2 rounded-lg text-sm" value={newProfile.role} onChange={e => setNewProfile({...newProfile, role: e.target.value})}>
                                  <option value="SECURITY">Security</option>
                                  <option value="ADMIN">Admin</option>
                              </select>
                              <button onClick={handleAddProfile} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-2"><Plus className="w-4 h-4"/> TAMBAH USER</button>
                          </div>
                      </div>
                      <div className="bg-white rounded-2xl border p-6">
                          <h3 className="font-bold text-lg mb-4">Daftar User</h3>
                          <div className="space-y-2">
                              {profiles.map(p => (
                                  <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border">
                                      <div><p className="font-bold text-sm">{p.name}</p><p className="text-xs text-slate-500">{p.role}</p></div>
                                      <button onClick={() => handleDeleteProfile(p.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              )}

              {/* 5. SETTINGS */}
              {activeTab === 'SETTINGS' && (
                  <div className="space-y-6 animate-fade-in-up">
                      <div className="bg-white rounded-2xl border p-6 border-red-100">
                          <h3 className="text-lg font-bold mb-4 text-red-600 flex items-center gap-2"><Database className="w-5 h-5"/> Database Control (Dangerous)</h3>
                          <p className="text-xs text-slate-500 mb-4">Hati-hati, aksi di sini tidak bisa dibatalkan.</p>
                          <div className="flex gap-4">
                              <button onClick={handleWipe} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100">🔥 RESET DATABSE (WIPE)</button>
                              <button onClick={handleSeed} className="px-4 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-100">🌱 ISI DUMMY DATA</button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
