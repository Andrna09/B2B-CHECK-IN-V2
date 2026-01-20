import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Loader2, MapPin, Calendar, Clock, Megaphone, CheckCircle, RefreshCw } from 'lucide-react';
import { DriverData, QueueStatus } from '../types';
import { getDriverById } from '../services/dataService';
import TicketPass from './TicketPass';

interface Props {
  driverId: string;
  onBack: () => void;
}

const DriverStatus: React.FC<Props> = ({ driverId, onBack }) => {
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTicketModal, setShowTicketModal] = useState(false);

  // Fungsi Fetch Data
  const fetchStatus = async () => {
    try {
      const data = await getDriverById(driverId);
      if (data) setDriver(data);
    } catch (error) {
      console.error("Gagal ambil data", error);
    } finally {
      setLoading(false);
    }
  };

  // Auto Refresh Tiap 15 Detik (Cepat update kalau dipanggil)
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [driverId]);

  if (loading && !driver) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-500 font-bold">Memuat Tiket...</p>
      </div>
    );
  }

  if (!driver) return null;

  // 🔥 LOGIKA TEMA (SAMA DENGAN TICKETPASS) 🔥
  const isCheckedIn = [QueueStatus.CHECKED_IN, QueueStatus.CALLED, QueueStatus.LOADING, QueueStatus.COMPLETED].includes(driver.status);
  
  const theme = isCheckedIn ? {
      color: '#10B981', // Emerald (Hijau)
      bg: '#ECFDF5',
      title: 'QUEUE TICKET',
      type: 'CHECKED-IN / INSIDE',
      icon: <Megaphone className="w-5 h-5 text-emerald-500" />
  } : {
      color: '#D46A83', // Rose (Pink)
      bg: '#FDF2F4',
      title: 'OFFICIAL ENTRY PASS',
      type: driver.entryType === 'BOOKING' ? 'PRE-BOOKED' : 'DIRECT ENTRY',
      icon: <Calendar className="w-5 h-5 text-pink-500" />
  };

  // Status Text Helper
  const getStatusText = () => {
      switch(driver.status) {
          case QueueStatus.PENDING_REVIEW: return "Menunggu Verifikasi";
          case QueueStatus.BOOKED: return "Menunggu Kedatangan";
          case QueueStatus.AT_GATE: return "Pemeriksaan Security";
          case QueueStatus.CHECKED_IN: return "Menunggu Panggilan Dock";
          case QueueStatus.CALLED: return "SILAKAN MENUJU DOCK!";
          case QueueStatus.LOADING: return "Sedang Bongkar Muat";
          case QueueStatus.COMPLETED: return "Selesai (Siap Keluar)";
          default: return driver.status;
      }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center p-4 font-sans pb-20 relative">
      
      {/* TOMBOL REFRESH MANUAL (Pojok Kanan Atas) */}
      <button 
        onClick={fetchStatus}
        className="absolute top-4 right-4 z-50 p-3 bg-white rounded-full shadow-lg text-slate-600 hover:text-emerald-600 transition-colors"
      >
        <RefreshCw className="w-5 h-5" />
      </button>

      {/* 1. KARTU UTAMA (Mirip TiketPass) */}
      <div className="w-full max-w-sm bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white mb-6 animate-fade-in-up mt-4">
          
          {/* HEADER WARNA */}
          <div className="bg-[#2D2D2D] p-6 text-white relative overflow-hidden transition-colors duration-500">
                {/* Blob Background */}
                <div 
                    className="absolute top-0 right-0 w-40 h-40 rounded-full blur-[60px] opacity-40 -mr-10 -mt-10 transition-colors duration-500"
                    style={{ backgroundColor: theme.color }}
                ></div>

                <div className="flex justify-between items-center relative z-10 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-lg">
                             <img src="/Logo.png" className="w-full h-full object-contain" alt="Logo" onError={(e) => e.currentTarget.style.display = 'none'}/>
                        </div>
                        <div>
                            <h3 className="font-bold text-xl leading-none font-serif tracking-wide">sociolla</h3>
                            <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: theme.color }}>
                                {theme.title}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="text-center relative z-10 py-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-1">
                        {isCheckedIn ? 'NOMOR ANTRIAN' : 'PLAT NOMOR'}
                    </p>
                    <h1 className="text-6xl font-black tracking-tighter text-white drop-shadow-lg" style={{ letterSpacing: '-0.05em' }}>
                        {isCheckedIn ? (driver.queueNumber || '---') : driver.licensePlate}
                    </h1>
                </div>
          </div>

          {/* BODY KARTU */}
          <div className="bg-white p-6 relative">
              {/* Lubang Tiket */}
              <div className="absolute left-0 top-[-16px] w-8 h-8 rounded-full z-20 bg-slate-100" style={{ transform: 'translateX(-50%)' }}></div>
              <div className="absolute right-0 top-[-16px] w-8 h-8 rounded-full z-20 bg-slate-100" style={{ transform: 'translateX(50%)' }}></div>
              <div className="absolute left-6 right-6 top-[-1px] border-t-2 border-dashed border-slate-300 z-10"></div>

              {/* Status Bar */}
              <div className="mb-6 p-4 rounded-2xl flex items-center gap-3 relative z-20 shadow-sm transition-colors duration-500" style={{ backgroundColor: theme.bg }}>
                  {theme.icon}
                  <div>
                      <p className="text-[10px] font-bold uppercase opacity-70" style={{ color: theme.color }}>STATUS AKTUAL</p>
                      <p className={`text-sm font-black text-slate-800 ${driver.status === QueueStatus.CALLED ? 'animate-pulse text-red-600' : ''}`}>
                          {getStatusText()}
                      </p>
                  </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-y-6 relative z-20">
                  <div className="pr-2 border-r border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">PLAT NOMOR</p>
                      <p className="font-bold text-slate-800 text-lg">{driver.licensePlate}</p>
                  </div>
                  <div className="pl-4 text-right">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">JAM MASUK</p>
                      <div className="flex items-center justify-end gap-1 font-bold text-sm" style={{ color: theme.color }}>
                          <Clock className="w-3 h-3 shrink-0"/> 
                          <span>
                            {isCheckedIn && driver.verifiedTime 
                                ? new Date(driver.verifiedTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) 
                                : (driver.slotTime || '-')}
                          </span>
                      </div>
                  </div>
              </div>

              {/* QR Code */}
              <div className="mt-8 flex flex-col items-center justify-center relative z-20">
                  <div className="p-4 bg-white border-4 rounded-3xl shadow-sm transition-colors duration-500" style={{ borderColor: theme.bg }}>
                      <QRCodeSVG value={driver.bookingCode || 'NO_DATA'} size={180} />
                  </div>
                  <p className="mt-4 font-mono font-bold text-xl tracking-widest text-slate-700 text-center break-all">
                      {driver.bookingCode}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Tunjukkan QR ini kepada Security</p>
              </div>
          </div>
      </div>

      {/* 2. TOMBOL DOWNLOAD (Floating Style) */}
      <div className="w-full max-w-sm space-y-3 pb-8">
          <button 
            onClick={() => setShowTicketModal(true)}
            className="w-full py-4 text-white font-bold rounded-2xl shadow-xl transition-all hover:scale-[1.02] flex items-center justify-center gap-2 active:scale-95"
            style={{ backgroundColor: theme.color }}
          >
              <Download className="w-5 h-5"/>
              SIMPAN GAMBAR TIKET
          </button>
          
          <button 
             onClick={onBack}
             className="w-full py-4 bg-white text-slate-500 font-bold rounded-2xl shadow-sm border border-slate-200"
          >
             Kembali ke Menu
          </button>

          <p className="text-center text-xs text-slate-400 mt-4 leading-relaxed px-4">
              Halaman ini otomatis diperbarui.<br/>
              Pastikan Anda berada di area yang ditentukan.
          </p>
      </div>

      {/* MODAL DOWNLOAD (Untuk simpan gambar) */}
      {showTicketModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <TicketPass data={driver} onClose={() => setShowTicketModal(false)} />
          </div>
      )}

    </div>
  );
};

export default DriverStatus;
