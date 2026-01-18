import { supabase } from './supabaseClient';
import { DriverData, QueueStatus, GateConfig, UserProfile, DivisionConfig } from '../types';

// --- TIPE UNTUK DEV CONFIG ---
export interface DevConfig {
  enableGpsBypass: boolean;
  enableMockOCR: boolean;
}

// --- HELPER: WA CLIENT ---
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
// BAGIAN 1: DRIVER & OPERATIONAL FLOW
// ============================================================================

export const createCheckIn = async (data: Partial<DriverData>, docFile?: string): Promise<DriverData | null> => {
  const { data: insertedData, error } = await supabase
    .from('drivers')
    .insert([{
        name: data.name,
        license_plate: data.licensePlate,
        company: data.company,
        phone: data.phone,
        purpose: data.purpose,
        status: QueueStatus.PENDING_REVIEW,
        entry_type: 'BOOKING',
        check_in_time: Date.now(),
        document_file: docFile || ''
    }])
    .select()
    .single();

  if (error) { console.error('Error creating check-in:', error); throw error; }
  return insertedData ? mapDatabaseToDriver(insertedData) : null;
};

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

export const rejectGate = async (id: string, reason: string): Promise<boolean> => {
    const { error } = await supabase.from('drivers').update({
        status: QueueStatus.REJECTED_NEED_REBOOK,
        rejection_reason: reason
    }).eq('id', id);
    return !error;
};

export const getDrivers = async (): Promise<DriverData[]> => {
  const { data, error } = await supabase.from('drivers').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return data ? data.map(mapDatabaseToDriver) : [];
};

export const getDriverById = async (id: string): Promise<DriverData | null> => {
  const { data, error } = await supabase.from('drivers').select('*').eq('id', id).single();
  if (error) return null;
  return data ? mapDatabaseToDriver(data) : null;
};

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

export const checkoutDriver = async (id: string): Promise<void> => {
    await supabase.from('drivers').update({ status: QueueStatus.EXITED, exit_time: Date.now() }).eq('id', id);
    const { data } = await supabase.from('drivers').select('phone').eq('id', id).single();
    if(data?.phone) await sendWhatsAppNotification(data.phone, `EXIT PASS.\nTerima kasih, hati-hati di jalan.`);
};

// ============================================================================
// BAGIAN 2: SYSTEM / ADMIN FUNCTIONS (YANG SEBELUMNYA HILANG)
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

// --- PROFILES (USERS) ---
export const getProfiles = async (): Promise<UserProfile[]> => {
  const { data, error } = await supabase.from('regular_drivers').select('*'); // Menggunakan tabel regular_drivers sbg user profile sementara
  return (data as any) || [];
};

export const addProfile = async (profile: UserProfile): Promise<boolean> => {
  const { error } = await supabase.from('regular_drivers').insert([profile]);
  return !error;
};

export const updateProfile = async (profile: UserProfile): Promise<boolean> => {
  const { error } = await supabase.from('regular_drivers').update(profile).eq('id', profile.id);
  return !error;
};

export const deleteProfile = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('regular_drivers').delete().eq('id', id);
  return !error;
};

// --- SYSTEM SETTINGS ---
export const deleteSystemSetting = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('gate_configs').delete().eq('id', id);
  return !error;
};

// --- DIVISIONS ---
export const getDivisions = async (): Promise<DivisionConfig[]> => {
    const { data } = await supabase.from('system_settings').select('*').eq('category', 'DIVISION');
    // Transform dari format system_settings ke DivisionConfig
    return (data || []).map((d: any) => ({
        id: d.value,
        name: d.label,
        role: 'SECURITY', // Default fallback
        theme: 'blue',
        password: d.value // Sementara pakai value sebagai password jika belum ada kolom khusus
    })) as DivisionConfig[];
};

export const saveDivision = async (div: DivisionConfig): Promise<boolean> => {
    // Simpan ke tabel system_settings
    const { error } = await supabase.from('system_settings').insert([{ 
        category: 'DIVISION', 
        value: div.id, 
        label: div.name 
    }]);
    return !error;
};

export const deleteDivision = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('system_settings').delete().eq('value', id);
    return !error;
};

// --- ACTIVITY LOGS ---
export const getActivityLogs = async (): Promise<any[]> => {
  const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50);
  return data || [];
};

// --- UTILS ---
export const wipeDatabase = async (): Promise<boolean> => {
  const { error } = await supabase.from('drivers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  return !error;
};

export const seedDummyData = async (): Promise<boolean> => {
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

// --- DEV CONFIG ---
export const getDevConfig = (): DevConfig => {
    const stored = localStorage.getItem('DEV_CONFIG');
    return stored ? JSON.parse(stored) : { enableGpsBypass: false, enableMockOCR: false };
};

export const saveDevConfig = (config: DevConfig): void => {
    localStorage.setItem('DEV_CONFIG', JSON.stringify(config));
};
