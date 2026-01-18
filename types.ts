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
  
  // Data Booking (BARU - Sesuai SQL Anda)
  bookingCode?: string;
  poNumber?: string;
  visitDate?: string; // Format YYYY-MM-DD
  slotTime?: string;  // Format HH:MM
  
  // Posisi
  gate?: string;
  queueNumber?: string;
  
  // Dokumen & Bukti
  documentUrl?: string;
  notes?: string;
  photoBeforeUrl?: string[];
  photoAfterUrl?: string[];
  
  // Catatan Admin/Security
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

export interface GateConfig {
  id: string;
  name: string;
  capacity: number;
  status: 'OPEN' | 'MAINTENANCE' | 'CLOSED';
  type: 'GENERAL' | 'DOCK';
  currentDriverId?: string;
}

export type Gate = GateConfig;

export interface UserProfile {
  id: string;
  name: string;
  role: 'ADMIN' | 'SECURITY' | 'MANAGER';
  email?: string;
  pin_code?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ActivityLog {
  id: string;
  created_at: string;
  user_email: string;
  action: string;
  details: string;
}

export interface DivisionConfig {
  id: string;
  name: string;
  role: 'ADMIN' | 'SECURITY' | 'MANAGER';
  theme: 'emerald' | 'blue' | 'purple' | 'orange';
  password?: string;
}
