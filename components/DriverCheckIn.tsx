import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, User, Truck, 
  ChevronRight, ChevronLeft, CheckCircle 
} from 'lucide-react';
import { createCheckIn } from '../services/dataService';
import { DriverData, QueueStatus } from '../types';
import TicketPass from './TicketPass';

// --- CONFIGURATION ---
const ALLOWED_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", 
  "13:00", "14:00", "15:00", "16:00"
];

const DriverCheckIn: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [step, setStep] = useState(1);
  const [viewMode, setViewMode] = useState<'WIZARD' | 'RESULT'>('WIZARD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<DriverData | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    visitDate: '',
    slotTime: '',
    name: '',
    phone: '',
    licensePlate: '',
    company: '',
    purpose: 'LOADING' as 'LOADING' | 'UNLOADING',
    poNumber: '',
    gpsLat: 0, // Tetap simpan data lokasi (opsional)
    gpsLong: 0
  });

  // Split Input States (Plat Nomor)
  const [plateInputs, setPlateInputs] = useState({ prefix: '', number: '', suffix: '' });
  
  // PO Builder State
  const [poInputs, setPoInputs] = useState({
    mode: 'AUTO' as 'AUTO' | 'MANUAL',
    entity: 'SBI',
    year: new Date().getFullYear().toString(),
    sequence: '',
    manualValue: ''
  });

  // --- LOGIC: PLATE NUMBER ---
  const handlePlateInputChange = (part: 'prefix' | 'number' | 'suffix', value: string) => {
    let clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (part === 'number') {
      clean = clean.replace(/\D/g, ''); // Hanya angka
    } else {
      clean = clean.replace(/[^A-Z]/g, ''); // Hanya huruf
    }

    const newInputs = { ...plateInputs, [part]: clean };
    setPlateInputs(newInputs);
    
    // Update main formData
    setFormData(prev => ({ 
        ...prev, 
        licensePlate: `${newInputs.prefix} ${newInputs.number} ${newInputs.suffix}`.trim() 
    }));
  };

  // --- LOGIC: PO GENERATOR ---
  useEffect(() => {
    if (poInputs.mode === 'AUTO') {
      const seq = poInputs.sequence.padStart(3, '0');
      const generated = `PO/${poInputs.entity}/${poInputs.year}/${seq}`;
      setFormData(prev => ({ ...prev, poNumber: poInputs.sequence ? generated : '' }));
    } else {
      setFormData(prev => ({ ...prev, poNumber: poInputs.manualValue }));
    }
  }, [poInputs]);

  // --- LOGIC: WHATSAPP FORMATTER ---
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.startsWith('0')) val = val.substring(1); 
    if (val.startsWith('62')) val = val.substring(2); 
    setFormData(prev => ({ ...prev, phone: val }));
  };

  // --- LOGIC: SILENT GPS (Optional Metadata) ---
  // Kita tetap ambil lokasi jika browser mengizinkan, tapi TIDAK validasi jarak.
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({ 
            ...prev, 
            gpsLat: position.coords.latitude, 
            gpsLong: position.coords.longitude 
          }));
        },
        () => {
            // User tolak GPS? Tidak masalah, lanjut saja.
            console.log('User did not allow GPS, skipping location data.');
        }
      );
    }
  }, []);

  // --- VALIDATION ---
  const validateStep = (currentStep: number) => {
    switch (currentStep) {
      case 1: // Schedule
        return formData.visitDate && formData.slotTime;
      case 2: // Identity
        return formData.name && formData.phone.length > 8 && 
               plateInputs.prefix && plateInputs.number && plateInputs.suffix && 
               formData.company;
      case 3: // Cargo Only (GPS Removed)
        return formData.poNumber && formData.poNumber.length > 3;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        phone: `62${formData.phone}`,
        licensePlate: formData.licensePlate,
        company: formData.company,
        purpose: formData.purpose,
        // Simpan info Slot & PO di notes
        notes: `PO: ${formData.poNumber} | Slot: ${formData.visitDate} @ ${formData.slotTime}`,
        // Kirim koordinat jika ada, tapi tidak wajib
        adminNotes: formData.gpsLat ? `Booked from: ${formData.gpsLat}, ${formData.gpsLong}` : 'Location unknown'
      };

      const result = await createCheckIn(payload as any); 
      if (result) {
        setSuccessData(result);
        setViewMode('RESULT');
      }
    } catch (e) {
      alert('Gagal mengirim data. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================================================
  // VIEW: RESULT
  // ==========================================================================
  if (viewMode === 'RESULT' && successData) {
    if (successData.status === QueueStatus.BOOKED) {
      return <TicketPass data={successData} onClose={() => window.location.reload()} />;
    }
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-[2rem] shadow-xl text-center">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
             <Clock className="w-10 h-10 text-amber-500 animate-pulse"/>
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Booking Berhasil</h2>
          <p className="text-slate-600 mb-6">
            Data Anda telah diterima. Tunggu konfirmasi admin via WhatsApp untuk mendapatkan Tiket QR Code.
          </p>
          <button onClick={() => window.location.reload()} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl">
            Buat Booking Baru
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW: WIZARD FORM
  // ==========================================================================
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-lg mx-auto shadow-2xl min-h-screen">
      
      {/* HEADER */}
      <div className="bg-white p-6 pt-8 pb-4 border-b border-slate-100 sticky top-0 z-10">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Truck className="w-6 h-6 text-blue-600" />
          GateFlow <span className="text-slate-300 font-normal">| Booking</span>
        </h1>
        {/* Stepper */}
        <div className="flex justify-between items-center mt-6 px-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-col items-center relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                step >= s ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-400'
              }`}>
                {s}
              </div>
              <span className="text-[10px] font-bold mt-2 text-slate-500 uppercase tracking-wide">
                {s === 1 ? 'Jadwal' : s === 2 ? 'Identitas' : 'Muatan'}
              </span>
              {s !== 3 && (
                <div className={`absolute left-10 top-5 w-[calc(100vw/3-40px)] h-0.5 -z-10 ${
                  step > s ? 'bg-blue-600' : 'bg-slate-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 p-6 overflow-y-auto pb-32">
        
        {/* STEP 1: JADWAL */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in-up">
            <div>
              <label className="text-sm font-bold text-slate-500 mb-2 block">Pilih Tanggal Kedatangan</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-4 text-slate-400 w-5 h-5" />
                <input 
                  type="date"
                  className="w-full pl-12 p-4 bg-white rounded-xl border border-slate-200 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.visitDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setFormData({...formData, visitDate: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-500 mb-2 block">Pilih Jam (Estimasi)</label>
              <div className="grid grid-cols-3 gap-3">
                {ALLOWED_SLOTS.map(slot => (
                  <button
                    key={slot}
                    onClick={() => setFormData({...formData, slotTime: slot})}
                    className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                      formData.slotTime === slot 
                      ? 'border-blue-600 bg-blue-50 text-blue-700' 
                      : 'border-transparent bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: IDENTITAS */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in-up">
            
            {/* Nama */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Nama Lengkap</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
                <input 
                  type="text"
                  placeholder="Sesuai KTP / SIM"
                  className="w-full pl-12 p-3 bg-white rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
            </div>

            {/* WhatsApp */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Nomor WhatsApp</label>
              <div className="flex">
                <div className="bg-slate-100 border border-slate-200 border-r-0 rounded-l-xl px-4 flex items-center font-bold text-slate-500">
                  🇮🇩 +62
                </div>
                <input 
                  type="tel"
                  placeholder="812xxxx (Tanpa 0)"
                  className="flex-1 p-3 bg-white rounded-r-xl border border-slate-200 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                />
              </div>
            </div>

            {/* License Plate Split Input */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Plat Nomor</label>
              <div className="flex gap-2">
                <input 
                  type="text" placeholder="B" maxLength={2}
                  className="w-16 p-3 text-center bg-white rounded-xl border border-slate-200 font-black text-lg uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                  value={plateInputs.prefix}
                  onChange={e => handlePlateInputChange('prefix', e.target.value)}
                />
                <input 
                  type="text" placeholder="1234" maxLength={4}
                  className="flex-1 p-3 text-center bg-white rounded-xl border border-slate-200 font-black text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={plateInputs.number}
                  onChange={e => handlePlateInputChange('number', e.target.value)}
                />
                <input 
                  type="text" placeholder="XYZ" maxLength={3}
                  className="w-20 p-3 text-center bg-white rounded-xl border border-slate-200 font-black text-lg uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                  value={plateInputs.suffix}
                  onChange={e => handlePlateInputChange('suffix', e.target.value)}
                />
              </div>
            </div>

            {/* Company */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Nama Vendor / PT</label>
              <input 
                type="text"
                placeholder="Ex: PT. Logistik Indonesia"
                className="w-full p-3 bg-white rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.company}
                onChange={e => setFormData({...formData, company: e.target.value})}
              />
            </div>
          </div>
        )}

        {/* STEP 3: MUATAN (GPS REMOVED) */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in-up">
            
            {/* Purpose Toggle */}
            <div className="flex p-1 bg-slate-200 rounded-xl">
              <button 
                onClick={() => setFormData({...formData, purpose: 'LOADING'})}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                  formData.purpose === 'LOADING' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                MUAT BARANG
              </button>
              <button 
                onClick={() => setFormData({...formData, purpose: 'UNLOADING'})}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                  formData.purpose === 'UNLOADING' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                BONGKAR BARANG
              </button>
            </div>

            {/* PO Generator */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <label className="text-xs font-bold text-slate-400 uppercase">Nomor PO / DO</label>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setPoInputs({...poInputs, mode: 'AUTO'})}
                        className={`text-[10px] px-2 py-1 rounded font-bold ${poInputs.mode === 'AUTO' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}
                    >
                        AUTO
                    </button>
                    <button 
                        onClick={() => setPoInputs({...poInputs, mode: 'MANUAL'})}
                        className={`text-[10px] px-2 py-1 rounded font-bold ${poInputs.mode === 'MANUAL' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}
                    >
                        MANUAL
                    </button>
                </div>
              </div>

              {poInputs.mode === 'AUTO' ? (
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <select 
                            className="p-2 bg-slate-50 rounded-lg font-bold text-sm border border-slate-200"
                            value={poInputs.entity}
                            onChange={(e) => setPoInputs({...poInputs, entity: e.target.value})}
                        >
                            <option value="SBI">SBI</option>
                            <option value="SDI">SDI</option>
                        </select>
                        <input 
                            type="number" 
                            className="w-20 p-2 bg-slate-50 rounded-lg font-bold text-sm border border-slate-200 text-center"
                            value={poInputs.year}
                            onChange={(e) => setPoInputs({...poInputs, year: e.target.value})}
                        />
                        <input 
                            type="number" 
                            placeholder="Urutan (ex: 1)"
                            className="flex-1 p-2 bg-slate-50 rounded-lg font-bold text-sm border border-slate-200"
                            value={poInputs.sequence}
                            onChange={(e) => setPoInputs({...poInputs, sequence: e.target.value})}
                        />
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-center border border-blue-100">
                        <span className="text-xs text-blue-400 font-semibold block mb-1">Preview PO Number</span>
                        <span className="text-lg font-mono font-black text-blue-800 tracking-wider">
                            {formData.poNumber || 'PO/---/---/---'}
                        </span>
                    </div>
                </div>
              ) : (
                <input 
                    type="text"
                    placeholder="Input Manual..."
                    className="w-full p-3 bg-slate-50 rounded-lg font-bold border border-slate-200"
                    value={poInputs.manualValue}
                    onChange={(e) => setPoInputs({...poInputs, manualValue: e.target.value})}
                />
              )}
            </div>

            {/* Note: Bagian Geofencing/GPS telah dihapus sepenuhnya dari tampilan */}
            <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-500 text-center">
                Pastikan data yang Anda isi sudah benar sebelum mengirim pendaftaran.
            </div>

          </div>
        )}

      </div>

      {/* FOOTER ACTION BAR */}
      <div className="p-6 bg-white border-t border-slate-100 sticky bottom-0 z-10">
        <div className="flex gap-3">
          {step > 1 && (
            <button 
              onClick={() => setStep(s => s - 1)}
              className="px-6 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          
          <button 
            onClick={() => {
                if(step < 3) setStep(s => s + 1);
                else handleSubmit();
            }}
            disabled={!validateStep(step) || isSubmitting}
            className={`flex-1 py-4 font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all ${
                !validateStep(step) || isSubmitting 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                : 'bg-slate-900 text-white hover:bg-slate-800 hover:scale-[1.02]'
            }`}
          >
            {isSubmitting ? (
                <span>Memproses...</span>
            ) : step === 3 ? (
                <>Kirim Booking <CheckCircle className="w-5 h-5" /></>
            ) : (
                <>Lanjut <ChevronRight className="w-5 h-5" /></>
            )}
          </button>
        </div>
      </div>

    </div>
  );
};

export default DriverCheckIn;
