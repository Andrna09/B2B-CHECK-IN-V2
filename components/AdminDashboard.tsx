import React, { useState, useEffect } from 'react';
import { Truck, Users, Clock, AlertTriangle, Search, Filter, ArrowRight, CheckCircle, BarChart3, Settings, Shield, Activity, XCircle, LogOut } from 'lucide-react';
import { DriverData, QueueStatus, UserProfile } from '../types';
import { getDrivers, updateDriverStatus, checkoutDriver, getActivityLogs, wipeDatabase, seedDummyData, exportDatabase, importDatabase, loginSystem, getGateConfigs, saveGateConfig, getProfiles, addProfile, deleteProfile, updateProfile, getDivisions, saveDivision, deleteDivision, deleteSystemSetting, resendBookingNotification, getDevConfig, saveDevConfig, DevConfig } from '../services/dataService';
import { supabase } from '../services/supabaseClient'; // Import Supabase
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
  const [searchTerm, setSearchTerm] = useState('');
  
  // State untuk Settings & Users
  const [gateConfigs, setGateConfigs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [newProfile, setNewProfile] = useState({ name: '', role: 'SECURITY' });
  const [newDivision, setNewDivision] = useState({ id: '', name: '' });
  const [newGate, setNewGate] = useState({ id: '', name: '', type: 'LOADING' });
  const [logs, setLogs] = useState<any[]>([]);
  const [dbStatus, setDbStatus] = useState('');
  
  // Dev Config
  const [devConfig, setDevConfig] = useState<DevConfig>({ enableGpsBypass: false, enableMockOCR: false });

  // --- FUNGSI UTAMA ---
  const fetchData = async () => {
    setLoading(true);
    const data = await getDrivers();
    if(data) setDrivers(data);

    // Fetch data pendukung lain jika di tab settings
    if(activeTab === 'SETTINGS') {
       const gates = await getGateConfigs();
       setGateConfigs(gates);
       const users = await getProfiles();
       setProfiles(users);
       const divs = await getDivisions();
       setDivisions(divs);
       const activity = await getActivityLogs();
       setLogs(activity);
       setDevConfig(getDevConfig());
    }
    setLoading(false);
  };

  // 🔥 REALTIME SUBSCRIPTION (Jantungnya Sistem) 🔥
  useEffect(() => {
    fetchData();

    // 1. Dengar perubahan di tabel 'drivers'
    const driverChannel = supabase.channel('admin-drivers-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
            fetchData(); // Refresh data driver otomatis
        })
        .subscribe();

    // 2. Dengar perubahan di tabel 'gate_configs' (Kalau ada gate baru ditambah)
    const gateChannel = supabase.channel('admin-gates-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gate_configs' }, () => {
             if(activeTab === 'SETTINGS') fetchData();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(driverChannel);
        supabase.removeChannel(gateChannel);
    };
  }, [activeTab]); // Re-subscribe kalau ganti tab (biar hemat resource)


  // --- LOGIC GATES ---
  const handleAssignGate = async (driverId: string, gateName: string) => {
      await updateDriverStatus(driverId, QueueStatus.CALLED, gateName);
      setShowGateModal(null);
  };

  const handleStartLoading = async (driverId: string) => {
      await updateDriverStatus(driverId, QueueStatus.LOADING);
  };

  const handleFinishLoading = async (driverId: string) => {
      await updateDriverStatus(driverId, QueueStatus.COMPLETED);
  };

  // --- LOGIC SETTINGS ---
  const handleAddProfile = async () => {
      if(!newProfile.name) return;
      await addProfile({ id: Date.now().toString(), name: newProfile.name, role: newProfile.role as any, status: 'ACTIVE' });
      setNewProfile({ name: '', role: 'SECURITY' });
      fetchData();
  };
  const handleDeleteProfile = async (id: string) => {
      if(confirm('Hapus user ini?')) { await deleteProfile(id); fetchData(); }
  };
  const handleAddDivision = async () => {
      if(!newDivision.id || !newDivision.name) return;
      await saveDivision({ id: newDivision.id, name: newDivision.name, role: 'SECURITY', theme: 'blue', password: '***' });
      setNewDivision({ id: '', name: '' });
      fetchData();
  };
  const handleDeleteDivision = async (id: string) => {
      if(confirm('Hapus divisi ini?')) { await deleteDivision(id); fetchData(); }
  };
  const handleAddGate = async () => {
      if(!newGate.id || !newGate.name) return;
      await saveGateConfig({ id: newGate.id, name: newGate.name, type: newGate.type as any, status: 'AVAILABLE' });
      setNewGate({ id: '', name: '', type: 'LOADING' });
      fetchData();
  };
  const handleDeleteGate = async (id: string) => {
      if(confirm('Hapus gate ini?')) { await deleteSystemSetting(id); fetchData(); }
  };
  
  // --- DATABASE TOOLS ---
  const handleWipe = async () => {
      if(confirm('BAHAYA: INI AKAN MENGHAPUS SEMUA DATA DRIVER!\nLanjut?')) {
          await wipeDatabase();
          alert('Database Bersih!');
          fetchData();
      }
  };
  const handleSeed = async () => {
      await seedDummyData();
      alert('Data Dummy Ditambahkan');
      fetchData();
  };
  const handleExport = async () => {
      const json = await exportDatabase();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${Date.now()}.json`;
      a.click();
  };
  const handleImport = async (e: any) => {
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
          if(ev.target?.result) {
              const success = await importDatabase(ev.target.result as string);
              alert(success ? 'Import Sukses' : 'Import Gagal');
              fetchData();
          }
      };
      reader.readAsText(file);
  };

  // --- FILTERING ---
  const waitingDrivers = drivers.filter(d => d.status === QueueStatus.CHECKED_IN).sort((a,b) => (a.queueNumber > b.queueNumber ? 1 : -1));
  const activeDrivers = drivers.filter(d => [QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status));
  const completedDrivers = drivers.filter(d => d.status === QueueStatus.COMPLETED);
  const loadingGates = gateConfigs.length > 0 ? gateConfigs : [{name: 'DOCK 1'}, {name: 'DOCK 2'}, {name: 'DOCK 3'}];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* NAVBAR */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg"><Activity className="w-6 h-6 text-white"/></div>
              <div>
                  <h1 className="text-xl font-black text-slate-800 tracking-tight">COMMAND CENTER</h1>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Administrator</p>
              </div>
          </div>
          <div className="flex items-center gap-4">
               <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-2">
                   <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> REALTIME ACTIVE
               </div>
               <div className="text-right mr-4">
                   <p className="text-sm font-bold text-slate-700">{currentUser?.name}</p>
                   <p className="text-xs text-slate-400">{currentUser?.role}</p>
               </div>
               <button onClick={onBack} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                   <LogOut className="w-5 h-5 text-slate-600"/>
               </button>
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
                      <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                          <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-indigo-600' : 'text-slate-400'}`}/> {item.label}
                      </button>
                  ))}
              </nav>
              <div className="mt-auto px-6">
                  <div className="bg-slate-900 rounded-2xl p-4 text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500 rounded-full blur-[40px] opacity-50 -mr-10 -mt-10"></div>
                      <p className="text-xs text-slate-400 mb-1">Total Traffic</p>
                      <p className="text-3xl font-black">{drivers.length}</p>
                      <p className="text-xs text-indigo-300 mt-2 flex items-center gap-1">Today's Visits</p>
                  </div>
              </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-8">
              
              {activeTab === 'OVERVIEW' && (
                  <div className="space-y-8 animate-fade-in-up">
                      {/* STATS CARDS */}
                      <div className="grid grid-cols-4 gap-6">
                          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                              <div className="flex justify-between items-start mb-4"><div className="p-3 bg-blue-50 rounded-xl text-blue-600"><Truck className="w-6 h-6"/></div><span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-500">TOTAL</span></div>
                              <h3 className="text-3xl font-black text-slate-800">{drivers.length}</h3>
                              <p className="text-sm text-slate-400 font-medium mt-1">Total Kendaraan</p>
                          </div>
                          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                              <div className="flex justify-between items-start mb-4"><div className="p-3 bg-amber-50 rounded-xl text-amber-600"><Clock className="w-6 h-6"/></div><span className="text-xs font-bold bg-amber-100 px-2 py-1 rounded text-amber-600 animate-pulse">LIVE</span></div>
                              <h3 className="text-3xl font-black text-slate-800">{waitingDrivers.length}</h3>
                              <p className="text-sm text-slate-400 font-medium mt-1">Sedang Menunggu</p>
                          </div>
                          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                              <div className="flex justify-between items-start mb-4"><div className="p-3 bg-emerald-50 rounded-xl text-emerald-600"><Activity className="w-6 h-6"/></div></div>
                              <h3 className="text-3xl font-black text-slate-800">{activeDrivers.length}</h3>
                              <p className="text-sm text-slate-400 font-medium mt-1">Sedang Bongkar</p>
                          </div>
                          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                              <div className="flex justify-between items-start mb-4"><div className="p-3 bg-purple-50 rounded-xl text-purple-600"><CheckCircle className="w-6 h-6"/></div></div>
                              <h3 className="text-3xl font-black text-slate-800">{drivers.filter(d => d.status === QueueStatus.EXITED).length}</h3>
                              <p className="text-sm text-slate-400 font-medium mt-1">Selesai (Checkout)</p>
                          </div>
                      </div>

                      {/* REPORT COMPONENT */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
                              <h3 className="font-bold text-slate-800">Laporan Operasional</h3>
                              <button className="text-indigo-600 text-xs font-bold hover:underline">Download CSV</button>
                          </div>
                          <div className="p-6">
                             <AdminReports drivers={drivers} />
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'QUEUE' && (
                  <div className="flex gap-8 h-full animate-fade-in-up">
                      {/* WAITING LIST */}
                      <div className="flex-1 flex flex-col bg-white rounded-2xl border shadow-sm overflow-hidden">
                          <div className="p-4 border-b bg-amber-50 flex justify-between items-center">
                              <h3 className="font-bold text-amber-800 flex items-center gap-2"><Clock className="w-4 h-4"/> Menunggu Panggilan ({waitingDrivers.length})</h3>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-3">
                              {waitingDrivers.map(d => (
                                  <div key={d.id} className="p-4 border border-slate-100 rounded-xl hover:shadow-md transition-all group bg-white">
                                      <div className="flex justify-between items-start mb-2">
                                          <span className="font-black text-lg text-slate-700">{d.queueNumber}</span>
                                          <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded text-slate-500">{new Date(d.checkInTime).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</span>
                                      </div>
                                      <p className="font-bold text-slate-800">{d.licensePlate}</p>
                                      <p className="text-xs text-slate-500 mb-4">{d.company}</p>
                                      
                                      <div className="relative">
                                          <button onClick={() => setShowGateModal(d.id)} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors">PANGGIL KE DOCK</button>
                                          {showGateModal === d.id && (
                                              <div className="absolute top-full left-0 w-full mt-2 bg-white border shadow-xl rounded-xl z-20 p-2 grid grid-cols-2 gap-2 animate-in fade-in zoom-in duration-200">
                                                  {loadingGates.map((g: any) => (
                                                      <button key={g.name} onClick={() => handleAssignGate(d.id, g.name)} className="p-2 text-xs font-bold bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg border border-slate-100">{g.name}</button>
                                                  ))}
                                                  <button onClick={() => setShowGateModal(null)} className="col-span-2 p-2 text-xs font-bold text-red-500 bg-red-50 rounded-lg mt-1">Batal</button>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              ))}
                              {waitingDrivers.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">Tidak ada antrian menunggu.</div>}
                          </div>
                      </div>

                      {/* ACTIVE DOCK */}
                      <div className="flex-1 flex flex-col bg-white rounded-2xl border shadow-sm overflow-hidden">
                          <div className="p-4 border-b bg-emerald-50"><h3 className="font-bold text-emerald-800 flex items-center gap-2"><Activity className="w-4 h-4"/> Sedang Bongkar ({activeDrivers.length})</h3></div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-3">
                              {activeDrivers.map(d => (
                                  <div key={d.id} className={`p-4 border rounded-xl bg-white ${d.status === QueueStatus.CALLED ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-emerald-500'}`}>
                                      <div className="flex justify-between items-center mb-3">
                                          <span className="font-black text-xl text-slate-800">{d.licensePlate}</span>
                                          <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold">{d.gate}</span>
                                      </div>
                                      <div className="flex items-center gap-2 mb-4">
                                          {d.status === QueueStatus.CALLED ? (
                                              <span className="text-xs font-bold text-amber-600 animate-pulse">● MEMANGGIL DRIVER...</span>
                                          ) : (
                                              <span className="text-xs font-bold text-emerald-600">● SEDANG BONGKAR</span>
                                          )}
                                      </div>
                                      <div className="flex gap-2">
                                          {d.status === QueueStatus.CALLED && (
                                              <button onClick={() => handleStartLoading(d.id)} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">MULAI BONGKAR</button>
                                          )}
                                          {d.status === QueueStatus.LOADING && (
                                              <button onClick={() => handleFinishLoading(d.id)} className="flex-1 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900">SELESAI</button>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'SETTINGS' && (
                  <div className="space-y-8 animate-fade-in-up">
                      {/* USER MANAGEMENT */}
                      <div className="bg-white rounded-2xl border p-6">
                          <h3 className="text-lg font-bold mb-4">Manajemen Pengguna</h3>
                          <div className="flex gap-2 mb-4">
                              <input placeholder="Nama User" className="border p-2 rounded-lg text-sm" value={newProfile.name} onChange={e => setNewProfile({...newProfile, name: e.target.value})} />
                              <select className="border p-2 rounded-lg text-sm" value={newProfile.role} onChange={e => setNewProfile({...newProfile, role: e.target.value})}>
                                  <option value="SECURITY">Security</option>
                                  <option value="ADMIN">Admin</option>
                                  <option value="MANAGER">Manager</option>
                              </select>
                              <button onClick={handleAddProfile} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">Tambah</button>
                          </div>
                          <div className="space-y-2">
                              {profiles.map(p => (
                                  <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border">
                                      <div><p className="font-bold text-sm">{p.name}</p><p className="text-xs text-slate-500">{p.role}</p></div>
                                      <button onClick={() => handleDeleteProfile(p.id)} className="text-red-500 hover:text-red-700"><XCircle className="w-4 h-4"/></button>
                                  </div>
                              ))}
                          </div>
                      </div>

                      {/* DATABASE TOOLS */}
                      <div className="bg-white rounded-2xl border p-6 border-red-100">
                          <h3 className="text-lg font-bold mb-4 text-red-600">Database Control (Dangerous)</h3>
                          <div className="flex gap-4">
                              <button onClick={handleWipe} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100">🔥 WIPE ALL DATA</button>
                              <button onClick={handleSeed} className="px-4 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-100">🌱 Seed Dummy Data</button>
                              <button onClick={handleExport} className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100">⬇️ Backup JSON</button>
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
