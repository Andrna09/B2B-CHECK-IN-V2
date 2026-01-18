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
  checkInTime?: number;
  verifiedTime?: number;
  calledTime?: number;
  loadingStartTime?: number;
  completedTime?: number;
  exitTime?: number;
  
  // Data Pendukung
  gate?: string;
  queueNumber?: string;
  bookingCode?: string;
  
  // Dokumen & Bukti
  documentUrl?: string;
  notes?: string;
  photoBeforeUrl?: string[];
  photoAfterUrl?: string[];
  
  // Kolom Alur Baru
  rejectionReason?: string;
  adminNotes?: string;
  securityNotes?: string;
}

export enum QueueStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  BOOKED = 'BOOKED',
  CHECKED_IN = 'CHECKED_IN',
  AT_GATE = 'AT_GATE',
  CALLED = 'CALLED',
  LOADING = 'LOADING',
  COMPLETED = 'COMPLETED',
  EXITED = 'EXITED',
  REJECTED = 'REJECTED',
  REJECTED_NEED_REBOOK = 'REJECTED_NEED_REBOOK',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW'
}

// [FIX FINAL] Definisi Gate yang lengkap dan bersih
export interface Gate {
  id: string;
  name: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  type?: 'DOCK' | 'GENERAL';
  currentDriverId?: string;
}

// Alias agar kompatibel dengan kode lama yang pakai GateConfig
export type GateConfig = Gate;
