import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, ArrowLeft, MapPin, Camera } from 'lucide-react'; 
import { createCheckIn, getAvailableSlots, findBookingByCode, confirmArrivalCheckIn, findBookingByPlateOrPhone } from '../services/dataService'; 
import { EntryType, Priority, SlotInfo, DriverData, QueueStatus } from '../types';
import TicketPass from './TicketPass'; 

interface Props {
  onSuccess: (driverId: string) => void;
  onBack?: () => void;
}

const TARGET_LOCATION = {
  lat: -6.227944,
  lng: 106.544306,
  name: "Sociolla Warehouse Cikupa",
  address: "Pergudangan Griya Idola"
};

const MAX_DISTANCE_METERS = 1000000; // Testing Mode

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const DriverCheckIn: React.FC<Props> = ({ onSuccess, onBack }) => {
  const [viewMode, setViewMode] = useState<'SELECT_MODE' | 'BOOKING_FLOW' | 'ARRIVAL_FLOW'>('SELECT_MODE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<DriverData | null>(null); 
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({}); 

  // Form State
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [availableSlots, setAvailableSlots] = useState<SlotInfo[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotInfo | null>(null);

  // Arrival State
  const [bookingCodeInput, setBookingCodeInput] = useState('');
  const [searchMode, setSearchMode] = useState<'CODE' | 'MANUAL'>('CODE'); 
  const [foundBooking, setFoundBooking] = useState<DriverData | null>(null);
  const [locationCheck, setLocationCheck] = useState<{lat: number, lng: number, distance: number, valid: boolean} | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  
  const [gpsEvidencePhoto, setGpsEvidencePhoto] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<DriverData>>({});
  
  // Data State
  const [poEntity, setPoEntity] = useState('SBI');
  const [poInputs, setPoInputs] = useState({ year: new Date().getFullYear().toString(), sequence: '' });
  const [plateInputs, setPlateInputs] = useState({ prefix: '', number: '', suffix: '' });
  const [formData, setFormData] = useState({
    name: '', phone: '', licensePlate: '', company: '', pic: 'Bu Santi',
    purpose: 'UNLOADING' as 'LOADING' | 'UNLOADING', doNumber: '',
    itemType: '', priority: Priority.NORMAL, notes: '', documentFile: null as File | null
  });

  const clearError = (field: string) => {
      setValidationErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  useEffect(() => {
    if (viewMode === 'BOOKING_FLOW') loadSlots();
  }, [selectedDate, viewMode]);

  const loadSlots = async () => {
      const slots = await getAvailableSlots(selectedDate);
      setAvailableSlots(slots);
      setSelectedSlot(null); 
  };

  // Logic Generate PO & Plate
  useEffect(() => {
    if (poEntity === 'OTHER') return;
    const cleanSeq = poInputs.sequence.replace(/\D/g, '');
    const cleanYear = poInputs.year.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, doNumber: `PO/${poEntity}/${cleanYear}/${cleanSeq}` }));
  }, [poEntity, poInputs.year, poInputs.sequence]);

  useEffect(() => {
     if (formData.licensePlate) {
         const parts = formData.licensePlate.split(' ');
         if(parts.length >= 2) setPlateInputs({ prefix: parts[0]||'', number: parts[1]||'', suffix: parts.slice(2).join('')||'' });
     }
  }, []);

  const handlePlateInputChange = (part: 'prefix' | 'number' | 'suffix', value: string) => {
      let clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (part === 'number') clean = clean.replace(/\D/g, '');
      else clean = clean.replace(/[^A-Z]/g, '');
      const newInputs = { ...plateInputs, [part]: clean };
      setPlateInputs(newInputs);
      setFormData(prev => ({ ...prev, licensePlate: `${newInputs.prefix} ${newInputs.number} ${newInputs.suffix}`.trim() }));
      clearError('licensePlate');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value.replace(/\D/g, '');
      if (val.startsWith('62')) val = val.slice(2);
      if (val.startsWith('0')) val = val.slice(1);
      setFormData(prev => ({ ...prev, phone: val ? `+62${val}` : '' }));
      clearError('phone');
  };
  const getDisplayPhone = () => formData.phone.replace(/^\+62|^62/, '');

  const validateStep2 = () => {
      const errors: Record<string, string> = {};
      if (!formData.name.trim()) errors['name'] = "Nama Driver wajib diisi";
      if (!formData.phone.trim()) errors['phone'] = "No WhatsApp wajib diisi";
      if (!plateInputs.prefix || !plateInputs.number) errors['licensePlate'] = "Plat Nomor tidak lengkap";
      setValidationErrors(errors);
      return Object.keys(errors).length === 0;
  };
  const validateStep3 = () => {
      const errors: Record<string, string> = {};
      if (!formData.company.trim()) errors['company'] = "Nama Vendor / PT wajib diisi";
      if (!formData.doNumber.trim() || formData.doNumber.includes('PO//')) errors['doNumber'] = "No Surat Jalan / DO wajib diisi";
      setValidationErrors(errors);
      return Object.keys(errors).length === 0;
  };

  // GPS Logic
  const verifyLocation = async () => {
      setLocLoading(true);
      if (!navigator.geolocation) { alert("GPS tidak didukung."); setLocLoading(false); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
            const R = 6371e3; 
            const lat1 = pos.coords.latitude, lon1 = pos.coords.longitude;
            const lat2 = TARGET_LOCATION.lat, lon2 = TARGET_LOCATION.lng;
            const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
            const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const dist = R * c;
            setLocationCheck({ lat: pos.coords.latitude, lng: pos.coords.longitude, distance: Math.round(dist), valid: dist <= MAX_DISTANCE_METERS });
            setLocLoading(false);
        },
        () => { alert("Gagal ambil lokasi."); setLocLoading(false); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
  };

  const handleCaptureEvidence = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          fileToBase64(file).then(base64 => setGpsEvidencePhoto(base64));
      }
  };

  // --- SAFE SUBMIT (ANTI BLANK) ---
  const handleSubmitBooking = async () => {
    if (!validateStep3()) return; 
    setIsSubmitting(true);
    try {
        let docBase64: string | undefined = undefined;
        if (formData.documentFile) docBase64 = await fileToBase64(formData.documentFile);
        
        const { documentFile, ...formDataWithoutFile } = formData;
        
        const driver = await createCheckIn({
            ...formDataWithoutFile,
            entryType: EntryType.BOOKING,
            slotDate: selectedDate,
            slotTime: selectedSlot!.timeLabel
        }, docBase64); 

        if (driver && driver.id) {
            setSuccessData(driver);
        } else {
            throw new Error("Gagal menyimpan data ke database (Response null).");
        }
    } catch (e: any) {
        alert("Booking Gagal: " + e.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  // Find Booking Logic
  const handleFindBooking = async () => {
      if(!bookingCodeInput) return;
      setIsSubmitting(true);
      try {
        let booking;
        if (searchMode === 'CODE') booking = await findBookingByCode(bookingCodeInput);
        else booking = await findBookingByPlateOrPhone(bookingCodeInput);
        
        if (!booking) alert("Data tidak ditemukan.");
        else if (booking.status !== QueueStatus.BOOKED) alert(`Status tidak valid: ${booking.status}.`);
        else {
            setFoundBooking(booking);
            setEditData({ name: booking.name, licensePlate: booking.licensePlate, company: booking.company, phone: booking.phone });
            setLocationCheck(null);
            setGpsEvidencePhoto(null);
        }
      } catch (e) { alert("Error mencari data"); }
      setIsSubmitting(false);
  };

  const handleConfirmArrival = async () => {
      if(!foundBooking) return;
      setIsSubmitting(true);
      try {
          const locationNote = `GPS Dist: ${locationCheck?.distance || 'Unknown'}m`;
          const updated = await confirmArrivalCheckIn(foundBooking.id, locationNote, editData, gpsEvidencePhoto || undefined);
          onSuccess(updated.id);
      } catch (e: any) {
          alert("Gagal Check-in: " + e.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  // --- RENDER ---
  if (viewMode === 'SELECT_MODE') {
      return (
        <div className="max-w-xl mx-auto animate-fade-in-up pb-20 pt-28 px-4">
             {onBack && <button onClick={onBack} className="fixed top-6 left-6 z-[100] bg-white/80 p-3 rounded-full shadow-sm"><ArrowLeft className="w-5 h-5 text-slate-700"/></button>}
             <div className="text-center mb-10"><h2 className="text-3xl font-black text-slate-900">Sociolla Warehouse</h2><p className="text-slate-500 font-medium">Sistem Booking & Antrian</p></div>
             <div className="grid gap-6">
                <button onClick={() => setViewMode('BOOKING_FLOW')} className="group bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
                    <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg"><Calendar className="w-7 h-7"/></div><h3 className="text-2xl font-black text-slate-800">Booking Slot Baru</h3>
                </button>
                <button onClick={() => setViewMode('ARRIVAL_FLOW')} className="group bg-slate-900 p-8 rounded-[2rem] shadow-xl">
                    <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg"><CheckCircle className="w-7 h-7"/></div><h3 className="text-2xl font-black text-white">Check-in Kedatangan</h3>
                </button>
            </div>
        </div>
      );
  }

  // --- VIEW MODE: BOOKING FLOW ---
  if (viewMode === 'BOOKING_FLOW') {
      if (successData && successData.bookingCode) {
          return <TicketPass data={successData} onClose={() => { setViewMode('SELECT_MODE'); setSuccessData(null); setStep(1); }} />;
      }

      return (
          <div className="max-w-xl mx-auto pb-20 pt-28 px-4 animate-fade-in-up">
              <button onClick={() => setViewMode('SELECT_MODE')} className="fixed top-6 left-6 z-[100] bg-white/80 p-3 rounded-full shadow-sm flex items-center gap-2 text-sm font-bold text-slate-600 pr-5"><ArrowLeft className="w-5 h-5"/> BATAL</button>
              
              {step === 1 && (
                  <div className="space-y-6">
                      <h2 className="text-3xl font-black text-slate-900 text-center">Pilih Jadwal</h2>
                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Tanggal Kedatangan</label>
                          <input type="date" className="w-full text-lg font-bold p-3 bg-slate-50 rounded-xl outline-none" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={new Date().toISOString().slice(0, 10)}/>
                      </div>
                      <div className="grid gap-3">
                          {availableSlots.map((slot) => (
                              <button key={slot.id} disabled={!slot.isAvailable} onClick={() => setSelectedSlot(slot)} className={`p-5 rounded-2xl border-2 transition-all flex justify-between items-center ${selectedSlot?.id === slot.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-100'}`}>
                                  <div className="text-left"><div className="text-lg font-black">{slot.timeLabel}</div><div className="text-xs font-bold uppercase">{slot.isAvailable ? 'Tersedia' : 'Penuh'}</div></div>
                                  <div className="px-3 py-1 rounded-lg text-xs font-bold bg-white/20">Sisa {slot.capacity - slot.booked}</div>
                              </button>
                          ))}
                      </div>
                      <button disabled={!selectedSlot} onClick={() => setStep(2)} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl mt-4 disabled:opacity-50">Lanjut: Isi Data Driver</button>
                      
                      {/* --- UPDATE: Tombol Kembali Kecil (Hanya di Step 1) --- */}
                      <button 
                          onClick={() => setViewMode('SELECT_MODE')} 
                          className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
                      >
                          Kembali
                      </button>
                  </div>
              )}

              {step === 2 && (
                  <div className="space-y-6">
                      <h2 className="text-2xl font-black text-slate-900">Identitas Driver</h2>
                      <input type="text" placeholder="Nama Lengkap" className="w-full p-4 bg-white rounded-2xl border-2 font-bold outline-none" value={formData.name} onChange={e=>{ setFormData({...formData, name:e.target.value}); clearError('name'); }}/>
                      
                      <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ml-1">Nomor WhatsApp</label>
                            <div className={`flex items-center gap-3 bg-white p-2 rounded-2xl border-2 transition-all ${validationErrors['phone'] ? 'border-red-500 bg-red-50' : 'border-slate-200 focus-within:border-blue-500 focus-within:shadow-md'}`}>
                                <div className="flex items-center justify-center bg-slate-100 rounded-xl px-4 py-3 border border-slate-200 min-w-[80px]"><span className="text-xl font-black text-slate-700">🇮🇩 +62</span></div>
                                <input type="tel" placeholder="812 3456 7890" className="flex-1 bg-transparent text-xl font-bold text-slate-900 outline-none placeholder:text-slate-300" value={getDisplayPhone()} onChange={handlePhoneChange} maxLength={13} inputMode="numeric"/>
                            </div>
                            {validationErrors['phone'] && (<p className="text-red-500 text-sm font-bold ml-1 mt-1">{validationErrors['phone']}</p>)}
                      </div>

                      <div className="flex gap-2">
                          <input type="text" placeholder="B" className="w-1/4 p-4 bg-white rounded-2xl border-2 font-black text-center outline-none uppercase" value={plateInputs.prefix} onChange={e=>handlePlateInputChange('prefix', e.target.value)}/>
                          <input type="tel" placeholder="1234" className="flex-1 p-4 bg-white rounded-2xl border-2 font-black text-center outline-none" value={plateInputs.number} onChange={e=>handlePlateInputChange('number', e.target.value)}/>
                          <input type="text" placeholder="XYZ" className="w-1/3 p-4 bg-white rounded-2xl border-2 font-black text-center outline-none uppercase" value={plateInputs.suffix} onChange={e=>handlePlateInputChange('suffix', e.target.value)}/>
                      </div>
                      <div className="flex gap-4">
                          <button onClick={() => setStep(1)} className="px-6 py-4 font-bold text-slate-500">Kembali</button>
                          <button onClick={() => { if(validateStep2()) setStep(3); }} className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl">Lanjut</button>
                      </div>
                  </div>
              )}

              {step === 3 && (
                  <div className="space-y-6">
                      <h2 className="text-2xl font-black text-slate-900">Detail Muatan</h2>
                      <div className="grid grid-cols-2 gap-4">
                          <button onClick={() => setFormData({...formData, purpose: 'UNLOADING'})} className={`p-4 rounded-xl border-2 font-bold ${formData.purpose === 'UNLOADING' ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white text-slate-400'}`}>BONGKAR</button>
                          <button onClick={() => setFormData({...formData, purpose: 'LOADING'})} className={`p-4 rounded-xl border-2 font-bold ${formData.purpose === 'LOADING' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white text-slate-400'}`}>MUAT</button>
                      </div>
                      <input type="text" placeholder="Nama Vendor / PT" className="w-full p-4 bg-white rounded-2xl border-2 font-bold outline-none" value={formData.company} onChange={e=>{ setFormData({...formData, company:e.target.value}); clearError('company'); }}/>
                      {poEntity === 'OTHER' ? (
                          <input type="text" placeholder="No. Surat Jalan Manual" className="w-full p-4 bg-white rounded-2xl border-2 font-bold outline-none" value={formData.doNumber} onChange={e=>{ setFormData({...formData, doNumber:e.target.value}); clearError('doNumber'); }}/>
                      ) : (
                        <div className="flex gap-2">
                             <input type="text" value={poInputs.year} onChange={e=>setPoInputs({...poInputs, year:e.target.value})} className="w-1/3 p-4 bg-white rounded-2xl border-2 border-slate-100 font-bold text-center" placeholder="YYYY"/>
                             <input type="text" value={poInputs.sequence} onChange={e=>setPoInputs({...poInputs, sequence:e.target.value})} className="flex-1 p-4 bg-white rounded-2xl border-2 border-slate-100 font-bold" placeholder="Nomor Urut"/>
                        </div>
                      )}
                      <div className="flex gap-2 overflow-x-auto pb-2">
                          {['SBI', 'SDI', 'SRI', 'OTHER'].map(ent => (<button key={ent} onClick={() => setPoEntity(ent)} className={`px-4 py-2 rounded-lg font-bold border-2 whitespace-nowrap ${poEntity === ent ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500'}`}>{ent}</button>))}
                      </div>
                      <div className="mt-6">
                          <button onClick={handleSubmitBooking} disabled={isSubmitting} className="w-full py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-lg">{isSubmitting ? 'Memproses...' : 'KONFIRMASI BOOKING'}</button>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  // --- VIEW MODE: ARRIVAL FLOW (Check-in Gerbang) ---
  if (viewMode === 'ARRIVAL_FLOW') {
      return (
          <div className="max-w-xl mx-auto pb-20 pt-28 px-4 animate-fade-in-up">
              <button onClick={() => setViewMode('SELECT_MODE')} className="fixed top-6 left-6 z-[100] bg-white/80 p-3 rounded-full shadow-sm hover:scale-110 transition-transform flex items-center gap-2 text-sm font-bold text-slate-600 pr-5"><ArrowLeft className="w-5 h-5"/> KEMBALI</button>
              <div className="text-center mb-10"><h2 className="text-3xl font-black text-slate-900">Check-in Gerbang</h2><p className="text-slate-500">Verifikasi kedatangan di pos.</p></div>
              {!foundBooking ? (
                  <div className="space-y-6">
                      <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                          <button onClick={() => setSearchMode('CODE')} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${searchMode === 'CODE' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>Kode Booking</button>
                          <button onClick={() => setSearchMode('MANUAL')} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${searchMode === 'MANUAL' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>Plat / No. HP</button>
                      </div>
                      <input type="text" placeholder={searchMode === 'CODE' ? "Contoh: SOC-IN-..." : "Contoh: B 1234 XYZ"} className="w-full p-5 bg-white rounded-2xl border-2 border-slate-100 font-bold text-center text-lg outline-none uppercase" value={bookingCodeInput} onChange={(e) => setBookingCodeInput(e.target.value)}/>
                      <button onClick={handleFindBooking} disabled={isSubmitting || !bookingCodeInput} className="w-full py-5 bg-emerald-600 text-white font-bold rounded-2xl shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50">{isSubmitting ? 'Mencari...' : 'CARI DATA BOOKING'}</button>
                  </div>
              ) : (
                  <div className="space-y-6 animate-fade-in-up">
                      <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 text-center">
                          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8"/></div>
                          <h3 className="text-2xl font-black text-slate-800">{foundBooking.bookingCode}</h3>
                          <p className="text-slate-500 font-bold">{foundBooking.licensePlate}</p>
                          <div className="mt-4 p-4 bg-slate-50 rounded-2xl text-left text-sm space-y-2">
                              <div className="flex justify-between"><span className="text-slate-400">Driver</span> <span className="font-bold text-slate-800">{foundBooking.name}</span></div>
                              <div className="flex justify-between"><span className="text-slate-400">Jadwal</span> <span className="font-bold text-slate-800">{foundBooking.slotTime}, {foundBooking.slotDate}</span></div>
                          </div>
                      </div>
                      <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4"/> Lokasi Terkini</h4>
                          {!locationCheck ? (
                              <button onClick={verifyLocation} disabled={locLoading} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl font-bold text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-colors">{locLoading ? 'Mendeteksi...' : 'Klik untuk Cek GPS'}</button>
                          ) : (
                              <div>
                                  <div className={`p-4 rounded-xl mb-4 font-bold text-center ${locationCheck.valid ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{locationCheck.valid ? `✅ LOKASI VALID` : `❌ KEJAUHAN (${locationCheck.distance}m)`}</div>
                                  
                                  {!locationCheck.valid && (
                                    <div className="mt-4">
                                        <p className="text-xs text-red-500 font-bold mb-2">Wajib upload bukti foto selfie di lokasi:</p>
                                        <label className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl font-bold text-slate-400 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                                            <Camera className="w-5 h-5"/> {gpsEvidencePhoto ? 'Ganti Foto' : 'Ambil Foto'}
                                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCaptureEvidence} />
                                        </label>
                                        {gpsEvidencePhoto && <div className="mt-2 text-xs text-emerald-600 font-bold text-center">Foto tersimpan ✅</div>}
                                    </div>
                                  )}
                              </div>
                          )}
                      </div>
                      <button onClick={handleConfirmArrival} disabled={isSubmitting || (!locationCheck?.valid && !gpsEvidencePhoto)} className="w-full py-5 bg-slate-900 text-white font-bold rounded-2xl shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50">{isSubmitting ? 'Memproses...' : 'KONFIRMASI CHECK-IN'}</button>
                  </div>
              )}
          </div>
      );
  }
  return null;
};

export default DriverCheckIn;
