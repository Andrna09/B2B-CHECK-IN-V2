import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, MapPin, Calendar, Clock, Loader2, Megaphone } from 'lucide-react';
import { DriverData, QueueStatus } from '../types';
import html2canvas from 'html2canvas';

interface Props {
  data: DriverData;
  onClose: () => void;
}

const TicketPass: React.FC<Props> = ({ data, onClose }) => {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // LOGIKA HYBRID: Jika status CHECKED_IN, CALLED, LOADING, COMPLETED -> TIKET HIJAU
  const isCheckedIn = [QueueStatus.CHECKED_IN, QueueStatus.CALLED, QueueStatus.LOADING, QueueStatus.COMPLETED].includes(data.status);
  
  const ticketTitle = isCheckedIn ? 'QUEUE TICKET' : 'OFFICIAL ENTRY PASS';
  const ticketType = isCheckedIn ? 'CHECKED-IN / INSIDE' : (data.entryType === 'BOOKING' ? 'PRE-BOOKED' : 'DIRECT ENTRY');
  const accentColor = isCheckedIn ? '#10B981' : '#D46A83'; 
  const accentBg = isCheckedIn ? '#ECFDF5' : '#FDF2F4';

  const handleDownload = async () => {
    if (!ticketRef.current) return;
    setIsGenerating(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      const canvas = await html2canvas(ticketRef.current, {
        scale: 3,
        backgroundColor: '#F8FAFC',
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: ticketRef.current.scrollWidth + 100,
        windowHeight: ticketRef.current.scrollHeight + 100,
        x: -50,
        y: -50,
        onclone: (clonedDoc) => {
            const clonedElement = clonedDoc.getElementById('ticket-container');
            if (clonedElement) {
                clonedElement.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
            }
        }
      });

      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      const prefix = isCheckedIn ? 'Sociolla_Queue_' : 'Sociolla_Booking_';
      link.download = `${prefix}${data.bookingCode || 'TICKET'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Gagal generate tiket", err);
      alert("Gagal mengunduh tiket. Silakan screenshot manual.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!data || !data.bookingCode) return null;

  return (
    <div className="flex flex-col items-center justify-center w-full animate-fade-in-up">
      <div 
        ref={ticketRef} 
        className="relative w-full max-w-[480px] py-12 px-8"
        style={{ backgroundColor: '#F8FAFC' }}
      >
        <div 
          id="ticket-container"
          className="bg-white rounded-[2rem] overflow-hidden shadow-2xl relative border-[6px] border-white mx-auto"
          style={{ 
              fontFamily: 'Inter, sans-serif',
              letterSpacing: 'normal',
              maxWidth: '380px'
          }}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Roboto+Mono:wght@700&display=swap');
                #ticket-container * { font-family: 'Inter', sans-serif !important; }
                .font-mono { font-family: 'Roboto Mono', monospace !important; }
            `}</style>

            <div className="bg-[#2D2D2D] p-6 text-white relative overflow-hidden">
                <div 
                    className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[50px] opacity-40 -mr-10 -mt-10"
                    style={{ backgroundColor: accentColor }}
                ></div>
                <div className="flex justify-between items-center relative z-10 mb-6">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1">
                             <img src="/Logo.png" className="w-full h-full object-contain" alt="Sociolla" onError={(e) => e.currentTarget.style.display = 'none'}/>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-none" style={{ fontFamily: 'serif' }}>sociolla</h3>
                            <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>
                                {ticketTitle}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white/10 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
                        <span className="text-[10px] font-bold uppercase tracking-wide">
                            {ticketType}
                        </span>
                    </div>
                </div>
                <div className="text-center relative z-10 mb-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-1">
                        {isCheckedIn ? 'QUEUE NUMBER' : 'LICENSE PLATE'}
                    </p>
                    <h1 className="text-5xl font-black tracking-tighter text-white" style={{ letterSpacing: '-0.05em' }}>
                        {isCheckedIn ? (data.queueNumber || data.bookingCode.slice(-4)) : data.licensePlate}
                    </h1>
                </div>
            </div>

            <div className="bg-white p-6 relative">
                <div className="absolute left-0 top-[-16px] w-8 h-8 rounded-full z-20" style={{ transform: 'translateX(-50%)', backgroundColor: '#F8FAFC' }}></div>
                <div className="absolute right-0 top-[-16px] w-8 h-8 rounded-full z-20" style={{ transform: 'translateX(50%)', backgroundColor: '#F8FAFC' }}></div>
                <div className="absolute left-6 right-6 top-[-1px] border-t-2 border-dashed border-slate-300 z-10"></div>

                {isCheckedIn && (
                    <div className="mb-6 p-3 rounded-xl flex items-center gap-3 relative z-20" style={{ backgroundColor: accentBg }}>
                        <Megaphone className="w-5 h-5 shrink-0" style={{ color: accentColor }} />
                        <div>
                            <p className="text-[10px] font-bold uppercase opacity-70" style={{ color: accentColor }}>STATUS SAAT INI</p>
                            <p className="text-xs font-bold text-slate-700">
                                {data.status === QueueStatus.COMPLETED ? 'Selesai Bongkar (Siap Keluar)' : 'Menunggu Panggilan Dock'}
                            </p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-y-6 mt-2 relative z-20">
                    <div className="pr-2">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">PLAT NOMOR</p>
                        <p className="font-bold text-slate-800 text-sm truncate">{data.licensePlate}</p>
                    </div>
                    <div className="text-right pl-2">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">VENDOR / PT</p>
                        <p className="font-bold text-slate-800 text-sm truncate">{data.company}</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                            {isCheckedIn ? 'GATE IN TIME' : 'SLOT TIME'}
                        </p>
                        <div className="flex items-center gap-1 font-bold text-sm" style={{ color: accentColor }}>
                            <Clock className="w-3 h-3 shrink-0"/> 
                            <span className="truncate">
                                {isCheckedIn 
                                  ? (data.verifiedTime ? new Date(data.verifiedTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Now') 
                                  : (data.slotTime || 'Now')}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">DATE</p>
                        <div className="flex items-center justify-end gap-1 text-slate-800 font-bold text-sm">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0"/> 
                            <span className="truncate">{data.slotDate || new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex flex-col items-center justify-center relative z-20">
                    <div className="p-3 bg-white border-4 rounded-2xl shadow-sm" style={{ borderColor: accentBg }}>
                        <QRCodeSVG value={data.bookingCode} size={160} />
                    </div>
                    <p className="mt-4 font-mono font-bold text-lg sm:text-xl tracking-widest text-slate-700 text-center break-all px-4" style={{ fontFamily: '"Roboto Mono", monospace' }}>
                        {data.bookingCode}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">Scan QR ini untuk info status</p>
                </div>
            </div>

            <div className="p-4 border-t border-dashed border-slate-200 relative z-20" style={{ backgroundColor: accentBg }}>
                <div className="flex items-start gap-3 opacity-70">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accentColor }} />
                    <div>
                        <p className="text-[10px] font-bold text-slate-700 uppercase">Gudang Pink - Cikupa</p>
                        <p className="text-[9px] text-slate-500 leading-tight">Pergudangan Griya Idola, Jl. Raya Serang Km 12.</p>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="w-full max-w-sm px-4 space-y-3 mt-4 mb-10">
          <button 
            onClick={handleDownload}
            disabled={isGenerating}
            className="w-full py-4 text-white font-bold rounded-2xl shadow-xl transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
            style={{ backgroundColor: accentColor }}
          >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin"/> : <Download className="w-5 h-5"/>}
              {isGenerating ? 'Memproses Tiket...' : `SIMPAN ${isCheckedIn ? 'TIKET ANTRIAN' : 'BUKTI BOOKING'}`}
          </button>
          <button onClick={onClose} className="w-full py-4 bg-white border-2 border-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-all">Tutup & Kembali</button>
      </div>
    </div>
  );
};

export default TicketPass;
