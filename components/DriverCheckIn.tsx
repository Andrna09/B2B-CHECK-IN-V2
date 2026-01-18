import React, { useState, useRef } from 'react';
import { Camera, Upload, X, CheckCircle, Clock, AlertCircle, Calendar, ArrowRight, ArrowLeft, MapPin } from 'lucide-react';
import { createCheckIn } from '../services/dataService';
import { QueueStatus, DriverData } from '../types';
import TicketPass from './TicketPass'; 

const DriverCheckIn: React.FC = () => {
  // --- STATE ---
  const [viewMode, setViewMode] = useState<'SELECT_MODE' | 'BOOKING_FLOW'>('SELECT_MODE');
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<DriverData | null>(null);

  // Form Data
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    licensePlate: '',
    company: '',
    purpose: 'LOADING' as 'LOADING' | 'UNLOADING',
    notes: ''
  });
  
  // Camera State
  const [photo, setPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- HANDLERS ---

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleNextStep = () => {
      // Validasi Step 1
      if (step === 1) {
          if (!formData.name || !formData.phone || !formData.licensePlate || !formData.company) {
              alert("Mohon lengkapi semua data identitas.");
              return;
          }
      }
      setStep(prev => prev + 1);
  };

  const handlePrevStep = () => setStep(prev => prev - 1);

  // LOGIKA SUBMIT (HYBRID: UI Lama + Logic Baru)
  const handleSubmitBooking = async () => {
    setIsSubmitting(true);
    try {
      // Panggil service yang menyimpan dengan status PENDING_REVIEW
      const result = await createCheckIn(formData, photo || undefined);
      
      if (result) {
        setSuccessData(result);
        // Kita tidak mereset form agar user bisa melihat hasil (Kartu Kuning)
      }
    } catch (e: any) {
      alert("Gagal mengirim data: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RENDER UI ---

  // 1. HALAMAN DEPAN (Desain Tombol Besar)
  if (viewMode === 'SELECT_MODE') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Hiasan */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-200/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-200/30 rounded-full blur-3xl"></div>

        <div className="w-full max-w-md space-y-8 relative z-10">
            <div className="text-center">
                <h1 className="text-4xl font-black text-slate-800 mb-2 tracking-tight">Sociolla Logistics</h1>
                <p className="text-slate-500 font-medium">Visitor & Driver Management System</p>
            </div>

            <button 
                onClick={() => setViewMode('BOOKING_FLOW')}
                className="group w-full bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 text-left relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <Calendar className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Booking Slot</h3>
                        <p className="text-sm text-slate-400 font-medium mt-1">Daftar kunjungan baru</p>
                    </div>
                    <div className="ml-auto w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <ArrowRight className="w-5 h-5"/>
                    </div>
                </div>
            </button>

            {/* Tombol Check-in Lokasi (Opsional/Dummy) */}
            <button className="group w-full bg-slate-900 p-6 rounded-[2rem] shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/20">
                        <MapPin className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Check-in Lokasi</h3>
                        <p className="text-sm text-slate-400 font-medium mt-1">Saya sudah di gerbang</p>
                    </div>
                </div>
            </button>
        </div>
      </div>
    );
  }

  // 2. HASIL PENDAFTARAN (UI BARU)
  if (successData) {
      // Skenario A: Jika Status sudah BOOKED (Admin Approve manual cepat atau auto-approve)
      if (successData.status === QueueStatus.BOOKED) {
          return <TicketPass data={successData} onClose={() => window.location.reload()} />;
      }

      // Skenario B: PENDING REVIEW (Kartu Kuning) - Default Flow Baru
      if (successData.status === QueueStatus.PENDING_REVIEW) {
          return (
              <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                  <div className="max-w-xl w-full bg-white p-8 rounded-[2.5rem] shadow-xl border border-amber-100 text-center relative overflow-hidden animate-fade-in-up">
                      <div className="absolute top-[-20%] left-[-20%] w-64 h-64 bg-amber-200/30 rounded-full blur-[60px]"></div>
                      
                      <div className="relative z-10">
                          <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-sm">
                             <Clock className="w-10 h-10 text-amber-500 animate-pulse"/>
                          </div>
                          
                          <h2 className="text-3xl font-black text-slate-800 mb-2">Menunggu Konfirmasi</h2>
                          <div className="flex justify-center mb-6">
                            <span className="px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold uppercase tracking-wider">
                                Status: Pending Review
                            </span>
                          </div>
                          
                          <div className="bg-slate-50 p-6 rounded-2xl text-left space-y-3 mb-8 border border-slate-100">
                              <p className="text-sm text-slate-600">Halo <strong className="text-slate-900">{successData.name}</strong>,</p>
                              <p className="text-sm text-slate-500 leading-relaxed">
                                  Data pendaftaran Anda telah diterima. Admin operasional kami sedang meninjau data Anda.
                              </p>
                              <div className="flex gap-3 bg-blue-50 p-3 rounded-xl mt-2">
                                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                  <p className="text-xs text-blue-700 font-medium leading-tight">
                                      Tiket QR Code akan dikirim via WhatsApp setelah disetujui. Harap cek WA Anda secara berkala.
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

  // 3. FORM WIZARD (STEP 1, 2, 3) - Desain yang Anda Suka
  return (
    <div className="min-h-screen bg-white p-6 pb-24">
        {/* Header Progress */}
        <div className="max-w-2xl mx-auto pt-8 mb-8">
            <button onClick={() => setViewMode('SELECT_MODE')} className="mb-6 flex items-center gap-2 text-slate-400 hover:text-slate-800 transition-colors font-bold text-sm">
                <ArrowLeft className="w-4 h-4"/> KEMBALI
            </button>
            
            <div className="flex justify-between items-center mb-2 px-2">
                <h2 className="text-2xl font-black text-slate-800">
                    {step === 1 ? 'Data Diri' : step === 2 ? 'Foto Dokumen' : 'Review Data'}
                </h2>
                <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    Step {step}/3
                </span>
            </div>
            {/* Progress Bar */}
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-blue-600 transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${(step/3)*100}%` }}
                ></div>
            </div>
        </div>

        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
            
            {/* STEP 1: IDENTITAS */}
            {step === 1 && (
                <div className="space-y-5">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Nama Lengkap</label>
                        <input 
                            name="name" value={formData.name} onChange={handleInputChange}
                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-blue-500 focus:bg-white outline-none transition-all"
                            placeholder="Sesuai KTP"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Nomor WhatsApp</label>
                        <input 
                            name="phone" type="tel" value={formData.phone} onChange={handleInputChange}
                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-blue-500 focus:bg-white outline-none transition-all"
                            placeholder="0812..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Plat Nomor</label>
                            <input 
                                name="licensePlate" value={formData.licensePlate} onChange={handleInputChange}
                                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-lg text-slate-800 uppercase focus:border-blue-500 focus:bg-white outline-none transition-all text-center"
                                placeholder="B 1234 XYZ"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Vendor / PT</label>
                            <input 
                                name="company" value={formData.company} onChange={handleInputChange}
                                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-blue-500 focus:bg-white outline-none transition-all"
                                placeholder="Nama PT"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Tujuan</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setFormData({...formData, purpose: 'LOADING'})}
                                className={`p-4 rounded-2xl font-bold border-2 transition-all ${formData.purpose === 'LOADING' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                            >
                                LOADING (Muat)
                            </button>
                            <button 
                                onClick={() => setFormData({...formData, purpose: 'UNLOADING'})}
                                className={`p-4 rounded-2xl font-bold border-2 transition-all ${formData.purpose === 'UNLOADING' ? 'border-purple-500 bg-purple-50 text-purple-600' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                            >
                                UNLOADING (Bongkar)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2: CAMERA / UPLOAD */}
            {step === 2 && (
                <div className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 items-start">
                        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-700 font-medium">
                            Silakan upload foto Surat Jalan (DO) atau foto kendaraan Anda sebagai bukti.
                        </p>
                    </div>

                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-3 border-dashed border-slate-200 rounded-[2rem] aspect-video flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-slate-50 transition-all group overflow-hidden relative"
                    >
                        {photo ? (
                            <>
                                <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-white font-bold flex items-center gap-2">
                                        <Camera className="w-4 h-4"/> Ganti Foto
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center p-6">
                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                    <Camera className="w-8 h-8" />
                                </div>
                                <h3 className="font-bold text-slate-700">Ambil Foto Dokumen</h3>
                                <p className="text-slate-400 text-xs mt-2">Tap untuk membuka kamera</p>
                            </div>
                        )}
                        <input 
                            type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment"
                            onChange={handlePhotoUpload}
                        />
                    </div>
                </div>
            )}

            {/* STEP 3: REVIEW / KONFIRMASI */}
            {step === 3 && (
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                    <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest mb-4">Konfirmasi Data</h3>
                    
                    {[
                        { label: 'Nama', val: formData.name },
                        { label: 'Telepon', val: formData.phone },
                        { label: 'Plat Nomor', val: formData.licensePlate },
                        { label: 'Vendor', val: formData.company },
                        { label: 'Tujuan', val: formData.purpose }
                    ].map((item, idx) => (
                        <div key={idx} className="flex justify-between border-b border-slate-200 pb-3 last:border-0">
                            <span className="text-slate-500 text-sm font-medium">{item.label}</span>
                            <span className="text-slate-800 font-bold text-right">{item.val}</span>
                        </div>
                    ))}

                    {photo && (
                        <div className="mt-4">
                            <p className="text-xs text-slate-400 font-bold mb-2">Foto Dokumen</p>
                            <img src={photo} alt="Doc" className="w-full h-32 object-cover rounded-xl border border-slate-200"/>
                        </div>
                    )}
                </div>
            )}

        </div>

        {/* BOTTOM NAVIGATION */}
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 p-4 px-6 flex gap-4 z-20">
            {step > 1 && (
                <button 
                    onClick={handlePrevStep}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                >
                    Kembali
                </button>
            )}
            
            <button 
                onClick={step === 3 ? handleSubmitBooking : handleNextStep}
                disabled={isSubmitting}
                className="flex-[2] py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
            >
                {isSubmitting ? (
                    <span className="animate-pulse">Mengirim Data...</span>
                ) : step === 3 ? (
                    <>Kirim Pendaftaran <CheckCircle className="w-5 h-5"/></>
                ) : (
                    <>Lanjut <ArrowRight className="w-5 h-5"/></>
                )}
            </button>
        </div>
    </div>
  );
};

export default DriverCheckIn;
