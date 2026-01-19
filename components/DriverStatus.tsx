import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Clock, MapPin, RefreshCw, Truck, FileText, ArrowLeft, Loader2, Megaphone, AlertCircle } from 'lucide-react';
import { DriverData, QueueStatus } from '../types';
import { getDriverById } from '../services/dataService';
import TicketPass from './TicketPass'; // [PENTING] Import komponen tiket

interface Props {
  driverId: string;
  onBack: () => void;
}

const DriverStatus: React.FC<Props> = ({ driverId, onBack }) => {
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  // [BARU] State untuk Modal Tiket
  const [showTicketModal, setShowTicketModal] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await getDriverById(driverId);
      if (data) setDriver(data);
    } catch (error) {
      console.error("Gagal mengambil data driver", error);
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto refresh setiap 30 detik
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [driverId]);

  if (loading && !driver) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Memuat Status...</p>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Data Tidak Ditemukan</h2>
        <p className="text-slate-500 mb-6">Mohon cek kembali kode booking atau hubungi petugas.</p>
        <button onClick={onBack} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold">Kembali</button>
      </div>
    );
  }

  // Helper untuk warna status
  const getStatusColor = (status: QueueStatus) => {
    switch (status) {
      case QueueStatus.PENDING_REVIEW: return 'bg-amber-100 text-amber-700 border-amber-200';
      case QueueStatus.BOOKED: return 'bg-blue-100 text-blue-700 border-blue-200';
      case QueueStatus.CHECKED_IN: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case QueueStatus.CALLED: return 'bg-orange-100 text-orange-700 border-orange-200'; 
      case QueueStatus.LOADING: return 'bg-purple-100 text-purple-700 border-purple-200';
      case QueueStatus.COMPLETED: return 'bg-green-100 text-green-700 border-green-200';
      case QueueStatus.REJECTED: 
      case QueueStatus.REJECTED_NEED_REBOOK: return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header Mobile */}
      <div className="bg-white px-4 py-4 shadow-sm border-b border-slate-100 sticky top-0 z-10 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-50">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-slate-800 text-lg">Status Pengiriman</h1>
        <button onClick={fetchStatus} className="p-2 -mr-2 text-blue-600 hover:bg-blue-50 rounded-full">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        
        {/* KARTU STATUS UTAMA */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-center relative overflow-hidden">
           <div className={`inline-block px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-4 border ${getStatusColor(driver.status)}`}>
              {driver.status.replace(/_/g, ' ')}
           </div>

           {/* Logic Tampilan Berdasarkan Status */}
           {driver.status === QueueStatus.PENDING_REVIEW ? (
              <div className="py-4">
                 <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4 animate-pulse" />
                 <h2 className="text-2xl font-black text-slate-800">Menunggu Verifikasi</h2>
                 <p className="text-slate-500 text-sm mt-2">Data Anda sedang ditinjau Admin.</p>
              </div>
           ) : driver.status === QueueStatus.BOOKED ? (
              <div className="py-4">
                 <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-100 inline-block mb-4">
                    <QRCodeSVG value={driver.bookingCode || 'N/A'} size={140} />
                 </div>
                 <p className="font-mono font-bold text-lg text-slate-800 tracking-widest">{driver.bookingCode}</p>
                 <p className="text-xs text-slate-400 mt-1">Tunjukkan QR ini ke Security</p>
              </div>
           ) : driver.status === QueueStatus.CALLED ? (
              <div className="py-4 animate-pulse">
                 <Megaphone className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                 <h2 className="text-3xl font-black text-orange-600 uppercase">PANGGILAN!</h2>
                 <p className="text-lg font-bold text-slate-800 mt-2">Segera Menuju {driver.gate || 'Loading Dock'}</p>
              </div>
           ) : (
              <div className="py-2">
                 <h2 className="text-3xl font-black text-slate-800">{driver.licensePlate}</h2>
                 <p className="text-slate-500">{driver.company}</p>
              </div>
           )}
        </div>

        {/* DETAIL INFO */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
                    <Truck className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Tujuan</p>
                    <p className="font-bold text-slate-800">{driver.purpose} - {driver.entryType}</p>
                </div>
            </div>
            
            {driver.gate && (
              <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                      <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Lokasi Gate</p>
                      <p className="font-bold text-blue-700 text-lg">{driver.gate}</p>
                  </div>
              </div>
            )}

            {driver.queueNumber && (
              <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-purple-500">
                      <FileText className="w-5 h-5" />
                  </div>
                  <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Nomor Antrian</p>
                      <p className="font-bold text-purple-700 text-lg">{driver.queueNumber}</p>
                  </div>
              </div>
            )}
        </div>

        {/* ======================================================= */}
        {/* 🔥 [FITUR BARU] TOMBOL DOWNLOAD TIKET 🔥 */}
        {/* ======================================================= */}
        {driver.status === QueueStatus.BOOKED && (
             <div className="mt-8 animate-fade-in-up">
                <p className="text-center text-sm text-slate-500 mb-2">Tiket Anda sudah siap!</p>
                <button 
                    onClick={() => setShowTicketModal(true)} 
                    className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-2xl shadow-xl shadow-pink-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
                >
                    <FileText className="w-6 h-6"/> 
                    <span className="text-lg">DOWNLOAD TIKET</span>
                </button>
             </div>
        )}

        {/* MODAL TIKET PASS */}
        {showTicketModal && (
            <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="w-full max-w-sm">
                     <TicketPass data={driver} onClose={() => setShowTicketModal(false)} />
                </div>
            </div>
        )}

        <p className="text-center text-xs text-slate-300 font-medium pt-4">
          Terakhir diperbarui: {lastUpdate.toLocaleTimeString()}
        </p>

      </div>
    </div>
  );
};

export default DriverStatus;
