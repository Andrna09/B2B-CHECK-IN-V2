import { supabase } from './supabaseClient';
import { DriverData, QueueStatus, GateConfig } from '../types';

// --- HELPER: WA CLIENT (Internal Fetch) ---
const sendWhatsAppNotification = async (target: string, message: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, message }),
    });
    const result = await response.json();
    return result.status;
  } catch (error) {
    console.error('❌ Failed to send WA:', error);
    return false;
  }
};

// --- HELPER: MAPPING ---
const mapDatabaseToDriver = (dbData: any): DriverData => ({
  id: dbData.id,
  name: dbData.name,
  licensePlate: dbData.license_plate,
  company: dbData.company,
  phone: dbData.phone,
  purpose: dbData.purpose,
  entryType: dbData.entry_type,
  status: dbData.status as QueueStatus,
  checkInTime: dbData.check_in_time,
  verifiedTime: dbData.verified_time,
  calledTime: dbData.called_time,
  loadingStartTime: dbData.loading_start_time,
  completedTime: dbData.end_time,
  exitTime: dbData.exit_time,
  gate: dbData.gate,
  queueNumber: dbData.queue_number,
  bookingCode: dbData.booking_code,
  documentUrl: dbData.document_file,
  notes: dbData.notes,
  rejectionReason: dbData.rejection_reason,
  adminNotes: dbData.admin_notes,
  securityNotes: dbData.security_notes
});

// ============================================================================
// 1. DRIVER FLOW FUNCTIONS (ALUR BARU)
// ============================================================================

// CREATE (Driver Daftar) -> Status PENDING_REVIEW
export const createCheckIn = async (data: Partial<DriverData>, docFile?: string): Promise<DriverData | null> => {
  const { data: insertedData, error } = await supabase
    .from('drivers')
    .insert([{
        name: data.name,
        license_plate: data.licensePlate,
        company: data.company,
        phone: data.phone,
        purpose: data.purpose,
        status: QueueStatus.PENDING_REVIEW, // Status Awal
        entry_type: 'BOOKING',
        check_in_time: Date.now(),
        document_file: docFile || ''
    }])
    .select()
    .single();

  if (error) { console.error('Error creating check-in:', error); throw error; }
  return insertedData ? mapDatabaseToDriver(insertedData) : null;
};

// ADMIN APPROVE
export const approveBooking = async (id: string): Promise<boolean> => {
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    const code = `SOC-IN-${dateStr}-${random}`;

    const { error } = await supabase.from('drivers').update({
        status: QueueStatus.BOOKED,
        booking_code: code,
        admin_notes: 'Approved manually by Admin'
    }).eq('id', id);

    if (!error) {
        const { data } = await supabase.from('drivers').select('phone, name').eq('id', id).single();
        if (data?.phone) {
             const msg = `*KONFIRMASI BOOKING BERHASIL*\n\nHalo ${data.name},\nKode Booking: *${code}*\n\nSilakan tunjukkan pesan ini ke Security saat tiba di lokasi.`;
             await sendWhatsAppNotification(data.phone, msg);
        }
    }
    return !error;
};

// ADMIN REJECT
export const rejectBooking = async (id: string, reason: string): Promise<boolean> => {
    const { error } = await supabase.from('drivers').update({
        status: QueueStatus.REJECTED,
        rejection_reason: reason
    }).eq('id', id);

    if (!error) {
        const { data } = await supabase.from('drivers').select('phone, name').eq('id', id).single();
        if (data?.phone) await sendWhatsAppNotification(data.phone, `Mohon Maaf ${data.name},\nPendaftaran Anda DITOLAK.\nAlasan: ${reason}`);
    }
    return !error;
};

// SECURITY CHECK-IN / REVISI
export const reviseAndCheckIn = async (id: string, revisedData: {name: string, plate: string, company: string}): Promise<boolean> => {
    const queueNo = `SOC-${Math.floor(100 + Math.random() * 900)}`; 
    const { error } = await supabase.from('drivers').update({
        name: revisedData.name,
        license_plate: revisedData.plate,
        company: revisedData.company,
        status: QueueStatus.CHECKED_IN,
        queue_number: queueNo,
        verified_time: Date.now(),
        security_notes: 'Verified/Revised at Gate'
    }).eq('id', id);

    if (!error) {
        const { data } = await supabase.from('drivers').select('phone').eq('id', id).single();
        if (data?.phone) await sendWhatsAppNotification(data.phone, `CHECK-IN BERHASIL.\nNomor Antrian: *${queueNo}*.\nSilakan parkir dan tunggu panggilan.`);
    }
    return !error;
};

// SECURITY TOLAK GATE
export const rejectGate = async (id: string, reason: string): Promise<boolean> => {
    const { error } = await supabase.from('drivers').update({
        status: QueueStatus.REJECTED_NEED_REBOOK,
        rejection_reason: reason
    }).eq('id', id);
    return !error;
};

// GET DRIVERS
export const getDrivers = async (): Promise<DriverData[]> => {
  const { data, error } = await supabase.from('drivers').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return data ? data.map(mapDatabaseToDriver) : [];
};

// GET DRIVER BY ID
export const getDriverById = async (id: string): Promise<DriverData | null> => {
  const { data, error } = await supabase.from('drivers').select('*').eq('id', id).single();
  if (error) return null;
  return data ? mapDatabaseToDriver(data) : null;
};

// UPDATE STATUS (General)
export const updateDriverStatus = async (id: string, status: QueueStatus, gate?: string): Promise<void> => {
    const updates: any = { status };
    if (status === QueueStatus.CALLED && gate) {
        updates.gate = gate;
        updates.called_time = Date.now();
        const { data } = await supabase.from('drivers').select('phone').eq('id', id).single();
        if(data?.phone) await sendWhatsAppNotification(data.phone, `PANGGILAN DOCK: Silakan menuju *${gate}* sekarang.`);
    }
    if (status === QueueStatus.LOADING) updates.loading_start_time = Date.now();
    if (status === QueueStatus.COMPLETED) updates.end_time = Date.now();
    
    await supabase.from('drivers').update(updates).eq('id', id);
};

// CHECKOUT
export const checkoutDriver = async (id: string): Promise<void> => {
    await supabase.from('drivers').update({ status: QueueStatus.EXITED, exit_time: Date.now() }).eq('id', id);
    const { data } = await supabase.from('drivers').select('phone').eq('id', id).single();
    if(data?.phone) await sendWhatsAppNotification(data.phone, `EXIT PASS.\nTerima kasih, hati-hati di jalan.`);
};

// ============================================================================
// 2. ADMIN / SYSTEM FUNCTIONS (YANG SEBELUMNYA HILANG)
// ============================================================================

// --- GATE CONFIGS ---
export const getGateConfigs = async (): Promise<GateConfig[]> => {
  const { data, error } = await supabase.from('gate_configs').select('*').order('name', { ascending: true });
  if (error) { console.error('Error fetching gates:', error); return []; }
  return data || [];
};

export const saveGateConfig = async (config: Partial<GateConfig>): Promise<boolean> => {
  const { error } = await supabase.from('gate_configs').upsert([config]);
  return !error;
};

// --- PROFILES (Regular Drivers) ---
export const getProfiles = async (): Promise<any[]> => {
  const { data, error } = await supabase.from('regular_drivers').select('*');
  return data || [];
};

export const addProfile = async (profile: any): Promise<boolean> => {
  const { error } = await supabase.from('regular_drivers').insert([profile]);
  return !error;
};

export const updateProfile = async (id: string, profile: any): Promise<boolean> => {
  const { error } = await supabase.from('regular_drivers').update(profile).eq('id', id);
  return !error;
};

export const deleteProfile = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('regular_drivers').delete().eq('id', id);
  return !error;
};

// --- SYSTEM SETTINGS ---
export const getSystemSettings = async (): Promise<any[]> => {
  const { data } = await supabase.from('system_settings').select('*');
  return data || [];
};

export const saveSystemSetting = async (setting: any): Promise<boolean> => {
  const { error } = await supabase.from('system_settings').upsert([setting]);
  return !error;
};

export const deleteSystemSetting = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('system_settings').delete().eq('id', id);
  return !error;
};

// --- DIVISIONS (Menggunakan System Settings kategori 'DIVISION') ---
export const getDivisions = async (): Promise<any[]> => {
    const { data } = await supabase.from('system_settings').select('*').eq('category', 'DIVISION');
    return data || [];
};

export const saveDivision = async (name: string): Promise<boolean> => {
    const { error } = await supabase.from('system_settings').insert([{ category: 'DIVISION', value: name, label: name }]);
    return !error;
};

export const deleteDivision = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('system_settings').delete().eq('id', id);
    return !error;
};

// --- ACTIVITY LOGS ---
export const getActivityLogs = async (): Promise<any[]> => {
  const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50);
  return data || [];
};

// --- DATABASE UTILS ---
export const wipeDatabase = async (): Promise<boolean> => {
  const { error } = await supabase.from('drivers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  return !error;
};

export const seedDummyData = async (): Promise<boolean> => {
  // Implementasi dummy data sederhana
  return true;
};

export const exportDatabase = async (): Promise<string> => {
  const { data } = await supabase.from('drivers').select('*');
  return JSON.stringify(data || []);
};

export const importDatabase = async (jsonString: string): Promise<boolean> => {
  try {
    const data = JSON.parse(jsonString);
    if(Array.isArray(data)) {
        const { error } = await supabase.from('drivers').insert(data);
        return !error;
    }
  } catch(e) { console.error(e); }
  return false;
};
