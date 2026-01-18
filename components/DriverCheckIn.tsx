import React, { useState } from 'react';
import { Camera, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { createCheckIn } from '../services/dataService';
import { QueueStatus, DriverData } from '../types';
import TicketPass from './TicketPass'; 

const DriverCheckIn: React.FC = () => {
  const [viewMode, setViewMode] = useState<'START' | 'FORM' | 'RESULT'>('START');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    licensePlate: '',
    company: '',
    purpose: 'LOADING' as 'LOADING' | 'UNLOADING',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<DriverData | null>(null);

  const handleSubmit = async () => {
    if (!formData.name || !formData.licensePlate) return alert('Lengkapi Data!');
    setIsSubmitting(true);
    try {
      // Create CheckIn -> Returns PENDING status
      const result = await createCheckIn(formData);
      if (result) {
        setSuccessData(result);
        setViewMode('RESULT');
      }
    } catch (e) {
      alert('Gagal mengirim data');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. HALAMAN DEPAN
  if (viewMode === 'START') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-6">
            <h1 className="text-3xl font-black text-slate-800">Warehouse Check-In</h1>
            <button 
              onClick={() => setViewMode('FORM')}
              className="px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl hover:scale-105 transition-transform"
            >
              DAFTAR / BOOKING SLOT
            </button>
        </div>
      </div>
    );
  }

  // 2. HALAMAN HASIL (RESULT)
  if (viewMode === 'RESULT' && successData) {
      
      // A. Jika Status BOOKED (Sudah Approved) -> Tampilkan Tiket
      if (successData.status === QueueStatus.BOOKED) {
          return <TicketPass data={successData} onClose={() => window.location.reload()} />;
      }

      // B. Jika Status PENDING (Baru Daftar) -> Tampilkan KARTU KUNING
      if (successData.status === QueueStatus.PENDING_REVIEW) {
          return (
              <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                  <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-xl border border-amber-100 text-center relative overflow-hidden animate-fade-in-up">
                      {/* Background Blob */}
                      <div className="absolute top-[-20%] left-[-20%] w-64 h-64 bg-amber-200/30 rounded-full blur-[60px]"></div>
                      
                      <div className="relative z-10">
                          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-sm">
                             <Clock className="w-10 h-10 text-amber-500 animate-pulse"/>
                          </div>
                          
                          <h2 className="text-2xl font-black text-slate-800 mb-2">Menunggu Konfirmasi</h2>
                          <div className="flex justify-center mb-6">
                            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold uppercase tracking-wider">
                                Status: Pending Review
                            </span>
                          </div>
                          
                          <div className="bg-slate-50 p-5 rounded-2xl text-left space-y-3 mb-8 border border-slate-100">
                              <p className="text-sm text-slate-600">Halo <span className="font-bold text-slate-900">{successData.name}</span>,</p>
                              <p className="text-sm text-slate-500">
                                  Data Anda telah diterima. Admin kami sedang memverifikasi pendaftaran Anda.
                              </p>
                              <div className="flex gap-2 bg-blue-50 p-3 rounded-xl">
                                  <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                  <p className="text-xs text-blue-700 font-medium">
                                      Cek WhatsApp Anda secara berkala. Tiket Masuk (QR) akan dikirim setelah disetujui.
                                  </p>
                              </div>
                          </div>
                          
                          <button 
                              onClick={() => window.location.reload()} 
                              className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-lg hover:scale-[1.02] transition-transform"
                          >
                              Kembali ke Halaman Utama
                          </button>
                      </div>
                  </div>
              </div>
          );
      }
  }

  // 3. FORM INPUT
  return (
    <div className="min-h-screen bg-white p-6 pt-10 pb-20 max-w-lg mx-auto">
        <h2 className="text-2xl font-black text-slate-800 mb-6">Form Pendaftaran</h2>
        
        <div className="space-y-4">
            <div>
                <label className="text-sm font-bold text-slate-500">Nama Driver</label>
                <input 
                    type="text"
                    className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 font-bold"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Contoh: Budi Santoso"
                />
            </div>
            <div>
                <label className="text-sm font-bold text-slate-500">Nomor WhatsApp</label>
                <input 
                    type="tel"
                    className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 font-bold"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="0812..."
                />
            </div>
            <div>
                <label className="text-sm font-bold text-slate-500">Plat Nomor (Tanpa Spasi)</label>
                <input 
                    type="text"
                    className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 font-black text-lg uppercase"
                    value={formData.licensePlate}
                    onChange={e => setFormData({...formData, licensePlate: e.target.value.toUpperCase()})}
                    placeholder="B1234XYZ"
                />
            </div>
            <div>
                <label className="text-sm font-bold text-slate-500">Nama Vendor / PT</label>
                <input 
                    type="text"
                    className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 font-bold"
                    value={formData.company}
                    onChange={e => setFormData({...formData, company: e.target.value})}
                    placeholder="PT. Logistik..."
                />
            </div>
             <div>
                <label className="text-sm font-bold text-slate-500">Tujuan</label>
                <div className="flex gap-2 mt-2">
                    <button 
                        onClick={() => setFormData({...formData, purpose: 'LOADING'})}
                        className={`flex-1 py-3 rounded-xl font-bold ${formData.purpose === 'LOADING' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                    >
                        Muat Barang
                    </button>
                    <button 
                        onClick={() => setFormData({...formData, purpose: 'UNLOADING'})}
                        className={`flex-1 py-3 rounded-xl font-bold ${formData.purpose === 'UNLOADING' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                    >
                        Bongkar Barang
                    </button>
                </div>
            </div>
        </div>

        <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full mt-8 py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl hover:bg-slate-800 disabled:opacity-50"
        >
            {isSubmitting ? 'Mengirim Data...' : 'Kirim Pendaftaran'}
        </button>

        <button 
            onClick={() => setViewMode('START')}
            className="w-full mt-4 py-3 text-slate-400 font-bold"
        >
            Batal
        </button>
    </div>
  );
};

export default DriverCheckIn;
