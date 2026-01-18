export interface DriverData {
  id: string;
  name: string;
  licensePlate: string;
  company: string;
  phone: string;
  purpose: 'LOADING' | 'UNLOADING';
  entryType: 'WALK_IN' | 'BOOKING';
  status: QueueStatus;
  
  // Waktu
  checkInTime?: number;      // Waktu Daftar
  verifiedTime?: number;     // Waktu Security Check-in
  calledTime?: number;       // Waktu Dipanggil Admin
  loadingStartTime?: number; // Waktu Mulai Bongkar
  completedTime?: number;    // Waktu Selesai Admin
  exitTime?: number;         // Waktu Keluar Gerbang
  
  // Data Pendukung
  gate?: string;
  queueNumber?: string;
  bookingCode?: string;
  
  // Dokumen & Bukti
  documentUrl?: string;
  notes?: string;
  photoBeforeUrl?: string[];
  photoAfterUrl?: string[];
  
  // [BARU] Kolom untuk Alur Review & Revisi
  rejectionReason?: string;
  adminNotes?: string;
  securityNotes?: string;
}

// [BARU] Enum Status Sesuai WI Final
export enum QueueStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',       // 1. Driver Daftar (Menunggu Admin)
  BOOKED = 'BOOKED',                       // 2. Admin Approve (Dapat Tiket)
  CHECKED_IN = 'CHECKED_IN',               // 3. Security Check (Masuk Antrian)
  AT_GATE = 'AT_GATE',                     // (Opsional) Tiba di Lokasi
  CALLED = 'CALLED',                       // 4. Dipanggil ke Dock
  LOADING = 'LOADING',                     // 5. Sedang Bongkar
  COMPLETED = 'COMPLETED',                 // 6. Selesai Bongkar
  EXITED = 'EXITED',                       // 7. Keluar Gerbang (Security)
  
  REJECTED = 'REJECTED',                   // X. Ditolak Admin (Permanen)
  REJECTED_NEED_REBOOK = 'REJECTED_NEED_REBOOK', // X. Ditolak Security (Suruh Booking Ulang)
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW'
}

export interface GateConfig {
  id: string;
  name: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  currentDriverId?: string;
}
