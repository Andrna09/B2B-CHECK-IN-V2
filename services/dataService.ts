import { supabase } from './supabaseClient';
import { DriverData, QueueStatus, GateConfig, UserProfile, DivisionConfig } from '../types';

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
  bookingCode: dbData.booking_code,
  poNumber: dbData.po_number,
  visitDate: dbData.visit_date,
  slotTime: dbData.slot_time,
  gate: dbData.gate,
  queueNumber: dbData.queue_number,
  documentUrl: dbData.document_file,
  notes: dbData.notes,
  photoBeforeUrl: dbData.photo_before_urls,
  photoAfterUrl: dbData.photo_after_urls,
  rejectionReason: dbData.rejection_reason,
  adminNotes: dbData.admin_notes,
  securityNotes: dbData.security_notes
});

export const createCheckIn = async (data: Partial<DriverData>, docFile?: string): Promise<DriverData | null> => {
  const payload: any = {
      name: data.name,
      license_plate: data.licensePlate,
      company: data.company,
      phone: data.phone,
      purpose: data.purpose,
      status: QueueStatus.PENDING_REVIEW,
      entry_type: 'BOOKING',
      check_in_time: Date.now(),
      document_file: docFile || '',
      po_number: data.poNumber,
      visit_date: data.visitDate,
      slot_time: data.slotTime,
      notes: data.notes,
      admin_notes: data.adminNotes
  };
  const { data: insertedData, error } = await supabase.from('drivers').insert([payload]).select().single();
  if (error) { console.error('Error creating check-in:', error); throw error; }
  return insertedData ? mapDatabaseToDriver(insertedData) : null;
};

export const approveBooking = async (id: string): Promise<boolean> => {
    const { data: driver, error: fetchError } = await supabase.from('drivers').select('purpose, name, phone').eq('id', id).single();
    if (fetchError || !driver) return false;

    const year = new Date().getFullYear();
    const type = driver.purpose === 'UNLOADING' ? 'IN' : 'OUT';
    const prefix = `SOC-${type}-${year}-`;
    const { data: latestEntry } = await supabase.from('drivers').select('booking_code').ilike('booking_code', `${prefix}%`).order('booking_code', { ascending: false }).limit(1).single();

    let sequence = 1;
    if (latestEntry && latestEntry.booking_code) {
        const parts = latestEntry.booking_code.split('-');
        const lastNumStr = parts[parts.length - 1];
        if (!isNaN(parseInt(lastNumStr))) sequence = parseInt(lastNumStr) + 1;
    }
    const finalCode = `${prefix}${sequence.toString().padStart(8, '0')}`;

    const { error } = await supabase.from('drivers').update({
        status: QueueStatus.BOOKED,
        booking_code: finalCode,
        admin_notes: `Approved manually. Code: ${finalCode}`
    }).eq('id', id);

    if (!error && driver.phone) {
         const appUrl = `${window.location.origin}?ticket_id=${id}`;
         const msg = `*TIKET ANDA SUDAH TERBIT!* ✅\n\nHalo ${driver.name},\nKode Booking: *${finalCode}*\n\n👇 *KLIK LINK UNTUK DOWNLOAD TIKET:* 👇\n${appUrl}\n\n⚠️ *PENTING:* Simpan gambar tiket di HP Anda untuk ditunjukkan ke Security.`;
         await sendWhatsAppNotification(driver.phone, msg);
    }
    return !error;
};

export const rejectBooking = async (id: string, reason: string): Promise<boolean> => {
    const { error } = await supabase.from('drivers').update({ status: QueueStatus.REJECTED, rejection_reason: reason }).eq('id', id);
    if (!error) {
        const { data } = await supabase.from('drivers').select('phone, name').eq('id', id).single();
        if (data?.phone) await sendWhatsAppNotification(data.phone, `Mohon Maaf ${data.name},\nPendaftaran Anda DITOLAK.\nAlasan: ${reason}`);
    }
    return !error;
};

// 🔥 FUNGSI UTAMA: REVISI + LOG + WA LINK BARU 🔥
export const reviseAndCheckIn = async (
    id: string, 
    revisedData: { name: string, plate: string, company: string, phone?: string, purpose?: string }
): Promise<boolean> => {
    const { data: oldData } = await supabase.from('drivers').select('*').eq('id', id).single();
    
    let revisionLog = '';
    if(oldData) {
        revisionLog = `[GATE REVISION ${new Date().toLocaleTimeString('id-ID')}]
        Plat: ${oldData.license_plate} -> ${revisedData.plate}
        Nama: ${oldData.name} -> ${revisedData.name}
        PT: ${oldData.company} -> ${revisedData.company}
        WA: ${oldData.phone} -> ${revisedData.phone || oldData.phone}
        Tujuan: ${oldData.purpose} -> ${revisedData.purpose || oldData.purpose}`;
    }

    const queueNo = `SOC-${Math.floor(100 + Math.random() * 900)}`; 
    
    const { error } = await supabase.from('drivers').update({
        name: revisedData.name,
        license_plate: revisedData.plate,
        company: revisedData.company,
        phone: revisedData.phone || oldData.phone,
        purpose: revisedData.purpose || oldData.purpose,
        status: QueueStatus.CHECKED_IN, 
        queue_number: queueNo,
        verified_time: Date.now(),      
        security_notes: oldData.security_notes ? `${oldData.security_notes}\n\n${revisionLog}` : revisionLog
    }).eq('id', id);

    if (!error) {
        const targetPhone = revisedData.phone || oldData.phone;
        if (targetPhone) {
            const appUrl = `${window.location.origin}?ticket_id=${id}`;
            const msg = `*CHECK-IN BERHASIL!* 🏁\n\nNomor Antrian: *${queueNo}*\nPlat: ${revisedData.plate}\n\nTiket Anda sudah berubah status menjadi *TIKET ANTRIAN* (Warna Hijau).\n\n👇 *KLIK UNTUK LIHAT TIKET BARU:* 👇\n${appUrl}\n\nSilakan parkir dan tunggu panggilan di TV Monitor.`;
            await sendWhatsAppNotification(targetPhone, msg);
        }
    }
    return !error;
};

export const rejectGate = async (id: string, reason: string): Promise<boolean> => {
    const { error } = await supabase.from('drivers').update({ status: QueueStatus.REJECTED_NEED_REBOOK, rejection_reason: reason }).eq('id', id);
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

// Bagian Login & System (Tetap sama, tidak perlu diubah)
export const verifyDivisionCredential = async (divId: string, password: string): Promise<DivisionConfig | null> => {
    const { data } = await supabase.from('system_settings').select('*').eq('category', 'DIVISION').eq('value', divId).single();
    if (!data) return null;
    let role: 'SECURITY' | 'ADMIN' | 'MANAGER' = 'SECURITY';
    if (divId.includes('ADMIN')) role = 'ADMIN';
    if (divId.includes('MANAGER')) role = 'MANAGER';
    return { id: data.value, name: data.label, role: role, theme: 'blue', password: '***' };
};
export const loginSystem = async (userId: string, pin: string): Promise<UserProfile | null> => {
    const { data } = await supabase.from('regular_drivers').select('*').eq('id', userId).single();
    if (data) {
        let userRole: any = 'SECURITY';
        if (data.phone === 'ADMIN' || data.phone === 'MANAGER') { userRole = data.phone; }
        return { id: data.id, name: data.name, role: userRole, status: 'ACTIVE' } as UserProfile;
    }
    return null;
};
export const getGateConfigs = async (): Promise<GateConfig[]> => {
  const { data, error } = await supabase.from('gate_configs').select('*').order('name', { ascending: true });
  if (error) return [];
  return data || [];
};
export const saveGateConfig = async (config: Partial<GateConfig>): Promise<boolean> => {
  const { error } = await supabase.from('gate_configs').upsert([config]);
  return !error;
};
export const getProfiles = async (): Promise<UserProfile[]> => {
  const { data } = await supabase.from('regular_drivers').select('*');
  return (data as any) || [];
};
export const addProfile = async (profile: UserProfile): Promise<boolean> => {
  const { error } = await supabase.from('regular_drivers').insert([{ id: profile.id, name: profile.name, license_plate: 'STAFF', phone: profile.role }]);
  return !error;
};
export const updateProfile = async (profile: UserProfile): Promise<boolean> => {
  const { error } = await supabase.from('regular_drivers').update({ name: profile.name, phone: profile.role }).eq('id', profile.id);
  return !error;
};
export const deleteProfile = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('regular_drivers').delete().eq('id', id);
  return !error;
};
export const getDivisions = async (): Promise<DivisionConfig[]> => {
    const { data } = await supabase.from('system_settings').select('*').eq('category', 'DIVISION');
    return (data || []).map((d: any) => ({ id: d.value, name: d.label, role: d.value === 'ADMIN' ? 'ADMIN' : d.value === 'MANAGER' ? 'MANAGER' : 'SECURITY', theme: 'blue', password: '***' })) as DivisionConfig[];
};
export const saveDivision = async (div: DivisionConfig): Promise<boolean> => {
    const { error } = await supabase.from('system_settings').insert([{ category: 'DIVISION', value: div.id, label: div.name }]);
    return !error;
};
export const deleteDivision = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('system_settings').delete().eq('value', id);
    return !error;
};
export const deleteSystemSetting = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('gate_configs').delete().eq('id', id);
    return !error;
};
export const getActivityLogs = async (): Promise<any[]> => {
  const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50);
  return data || [];
};
export const wipeDatabase = async (): Promise<boolean> => {
  const { error } = await supabase.from('drivers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  return !error;
};
export const seedDummyData = async (): Promise<boolean> => { return true; };
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
export const resendBookingNotification = async (id: string): Promise<boolean> => {
    const { data: driver, error } = await supabase.from('drivers').select('*').eq('id', id).single();
    if (error || !driver || !driver.booking_code) return false;
    if (driver.phone) {
         const appUrl = `${window.location.origin}?ticket_id=${id}`;
         const msg = `*PENGIRIMAN ULANG TIKET* 🔄\n\nHalo ${driver.name},\nKode Booking: *${driver.booking_code}*\n\n👇 *KLIK LINK UNTUK DOWNLOAD TIKET:* 👇\n${appUrl}\n\nSimpan pesan ini baik-baik ya.`;
         return await sendWhatsAppNotification(driver.phone, msg);
    }
    return false;
};
