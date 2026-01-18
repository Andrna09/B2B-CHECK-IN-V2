import React, { useState, useEffect } from 'react';
import { getDrivers, reviseAndCheckIn, rejectGate, checkoutDriver } from '../services/dataService';
import { DriverData, QueueStatus } from '../types';
import { Search, Edit2, CheckCircle, XCircle, LogOut } from 'lucide-react';

const SecurityDashboard: React.FC = () => {
  const [view, setView] = useState<'DASHBOARD' | 'VERIFY'>('DASHBOARD');
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [scannedDriver, setScannedDriver] = useState<DriverData | null>(null);
  
  // STATE REVISI
  const [isRevising, setIsRevising] = useState(false);
  const [reviseForm, setReviseForm] = useState({ name: '', plate: '', company: '' });

  const fetchData = async () => {
      const data = await getDrivers();
      setDrivers(data);
  };

  useEffect(() => {
      fetchData();
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
  }, []);

  // Simulasi Scan QR (Di lapangan pakai library QR Scanner)
  const handleSimulateScan = (bookingCode: string) => {
      const found = drivers.find(d => d.bookingCode === bookingCode && d.status === QueueStatus.BOOKED);
      if (found) {
          setScannedDriver(found);
          setView('VERIFY');
      } else {
          alert('Data Booking Tidak Ditemukan atau Status Salah!');
      }
  };

  // Logic Simpan Revisi
  const handleSaveRevision = async () => {
      if(!scannedDriver) return;
      await reviseAndCheckIn(scannedDriver.id, reviseForm);
      alert('Data Direvisi & Check-in Berhasil ✅');
      setScannedDriver(null);
      setIsRevising(false);
      setView('DASHBOARD');
      fetchData();
  };

  // Logic Approve Normal
  const handleNormalApprove = async () => {
      if(!scannedDriver) return;
      // Gunakan data existing tanpa ubah
      await reviseAndCheckIn(scannedDriver.id, {
          name: scannedDriver.name,
          plate: scannedDriver.licensePlate,
          company: scannedDriver.company
      });
      alert('Check-in Berhasil ✅');
      setScannedDriver(null);
      setView('DASHBOARD');
      fetchData();
  };

  // --- RENDER MODAL VERIFY (Fitur Utama Revisi Ada Disini) ---
  if (view === 'VERIFY' && scannedDriver) {
      return (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white w-full max-w-md p-8 rounded-[2rem] shadow-2xl animate-fade-in-up">
                  
                  {isRevising ? (
                      /* TAMPILAN MODE REVISI */
                      <div className="space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                              <Edit2 className="w-6 h-6 text-blue-600"/>
                              <h2 className="text-2xl font-black text-slate-800">Revisi Data</h2>
                          </div>
                          
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

                          <div className="flex gap-2 mt-6">
                              <button onClick={() => setIsRevising(false)} className="flex-1 py-3 bg-slate-100 font-bold rounded-xl text-slate-500">Batal</button>
                              <button onClick={handleSaveRevision} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg">Simpan & Masuk</button>
                          </div>
                      </div>
                  ) : (
                      /* TAMPILAN MODE NORMAL */
                      <div className="text-center">
                          <h2 className="text-4xl font-black text-slate-800 mb-2 uppercase">{scannedDriver.licensePlate}</h2>
                          <p className="text-lg font-bold text-slate-600">{scannedDriver.name}</p>
                          <p className="text-sm text-slate-400 mb-8">{scannedDriver.company}</p>

                          <div className="space-y-3">
                              <button 
                                  onClick={handleNormalApprove}
                                  className="w-full py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-lg hover:bg-emerald-600 transition-all flex justify-center items-center gap-2"
                              >
                                  <CheckCircle className="w-5 h-5"/> IZINKAN MASUK (Sesuai)
                              </button>
                              
                              <button 
                                  onClick={async () => {
                                      const reason = prompt("Alasan Tolak (Booking Ulang):");
                                      if(reason) {
                                          await rejectGate(scannedDriver.id, reason);
                                          setView('DASHBOARD');
                                          fetchData();
                                      }
                                  }}
                                  className="w-full py-4 bg-white border-2 border-red-100 text-red-500 font-bold rounded-2xl hover:bg-red-50 transition-all flex justify-center items-center gap-2"
                              >
                                  <XCircle className="w-5 h-5"/> TOLAK (Booking Ulang)
                              </button>
                          </div>

                          <div className="mt-8 pt-6 border-t border-slate-100">
                              <button 
                                  onClick={() => {
                                      setReviseForm({
                                          name: scannedDriver.name,
                                          plate: scannedDriver.licensePlate,
                                          company: scannedDriver.company
                                      });
                                      setIsRevising(true);
                                  }}
                                  className="text-slate-400 font-bold text-sm flex items-center justify-center gap-2 hover:text-blue-600 transition-colors"
                              >
                                  <Edit2 className="w-4 h-4"/>
                                  Data Salah? Klik Revisi Disini
                              </button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  // --- RENDER DASHBOARD UTAMA (List Antrian & Checkout) ---
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
       <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <div>
               <h1 className="text-2xl font-black text-slate-800">Security Gate</h1>
               <p className="text-slate-500">Pos Penjagaan Masuk & Keluar</p>
           </div>
           
           {/* Simulasi Input Scan */}
           <div className="flex gap-2">
               <input 
                  type="text" 
                  placeholder="Simulasi Scan QR (Booking Code)" 
                  className="p-3 border rounded-xl"
                  id="scanInput"
               />
               <button 
                  onClick={() => {
                      const val = (document.getElementById('scanInput') as HTMLInputElement).value;
                      handleSimulateScan(val);
                  }}
                  className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl"
               >
                   SCAN
               </button>
           </div>
       </div>

       {/* List Kendaraan Keluar (Checkout) */}
       <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
               <LogOut className="w-5 h-5"/> Siap Keluar (Checkout)
           </h3>
           <div className="space-y-2">
               {drivers.filter(d => d.status === QueueStatus.COMPLETED).map(d => (
                   <div key={d.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <div>
                           <div className="font-black text-slate-800">{d.licensePlate}</div>
                           <div className="text-xs text-slate-500">{d.name}</div>
                       </div>
                       <button 
                          onClick={async () => {
                              if(confirm('Konfirmasi kendaraan keluar?')) {
                                  await checkoutDriver(d.id);
                                  fetchData();
                              }
                          }}
                          className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900"
                       >
                           KELUAR
                       </button>
                   </div>
               ))}
               {drivers.filter(d => d.status === QueueStatus.COMPLETED).length === 0 && (
                   <p className="text-sm text-slate-400 italic">Tidak ada kendaraan yang siap keluar.</p>
               )}
           </div>
       </div>
    </div>
  );
};

export default SecurityDashboard;
