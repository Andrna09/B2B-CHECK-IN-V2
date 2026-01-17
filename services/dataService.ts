import { supabase } from './supabaseClient';
import { DriverData, QueueStatus, UserProfile, GateConfig, SlotInfo, DivisionConfig, ActivityLog } from '../types';

// ID GROUP WA OPERASIONAL (Ganti dengan ID Grup Asli)
const ID_GROUP_OPS = '120363423657558569@g.us'; 
const DEV_CONFIG_KEY = 'yms_dev_config';

// --- HELPER UTILS ---
const formatTime = (ts: number | string) => {
    return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
};

const formatDateLocal = (ts: number | string) => {
    return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const sendWANotification = async (target: string, message: string) => {
    if (!target) return;
    try {
        const cleanTarget = target.replace(/[^0-9@g.us]/g, '');
        await fetch('/api/whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: cleanTarget, message }),
        });
    } catch (e) { console.error("WA Error", e); }
};

// ============================================================================
// 🔥 MAIN FUNCTIONS (DRIVER & FLOW)
// ============================================================================

const mapSupabaseToDriver = (data: any): DriverData => ({
    id: data.id,
    name: data.name,
    licensePlate: data.license_plate,
    company: data.company,
    status: data.status as QueueStatus,
    checkInTime: data.check_in_time,
    bookingCode: data.booking_code,
    phone: data.phone,
    documentFile: data.document_file,
    slotDate: data.slot_date,
    slotTime: data.slot_time,
    queueNumber: data.queue_number,
    remarks: data.notes || data.security_notes, 
    gate: data.gate,
    photoBeforeURLs: data.photo_before_urls,
    photoAfterURLs: data.photo_after_urls
});

export const getDrivers = async (): Promise<DriverData[]> => {
    const { data } = await supabase.from('drivers').select('*').order('created_at', { ascending: false });
    return (data || []).map(mapSupabaseToDriver);
};

export const getDriverById = async (id: string): Promise<DriverData | null> => {
    const { data } = await supabase.from('drivers').select('*').eq('id', id).single();
    if (!data) return null;
    return mapSupabaseToDriver(data);
};

// [TEMPLATE 1: CONFIRM_BOOKING]
export const createCheckIn = async (data: Partial<DriverData>, docFile?: string): Promise<DriverData | null> => {
    const nowObj = new Date();
    const period = `${nowObj.getFullYear()}${String(nowObj.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `SOC-IN-${period}-`;

    const { data: lastBooking } = await supabase
        .from('drivers').select('booking_code')
        .ilike('booking_code', `${prefix}%`)
        .order('booking_code', { ascending: false }).limit(1).single();

    let nextSeq = 1;
    if (lastBooking && lastBooking.booking_code) {
        const parts = lastBooking.booking_code.split('-');
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }

    const unique = nextSeq.toString().padStart(6, '0');
    const code = `${prefix}${unique}`; 
    const now = Date.now();

    const { data: insertedData, error } = await supabase.from('drivers').insert([{
        name: data.name, 
        license_plate: data.license_plate, 
        company: data.company, 
        phone: data.phone,
        status: QueueStatus.BOOKED, 
        check_in_time: now, 
        booking_code: code, 
        document_file: docFile || '',
        slot_date: data.slotDate, 
        slot_time: data.slotTime, 
        entry_type: 'BOOKING'
    }])
    .select()
    .single();

    if (error) { console.error("DB Error", error); return null; }

    if (data.phone) {
        const msg = `KONFIRMASI BOOKING BERHASIL\n\n` +
                    `Halo ${data.name},\n\n` +
                    `Booking Anda telah terdaftar:\n` +
                    `--------------------------------------------\n` +
                    `Kode Booking  : ${code}\n` +
                    `Plat Nomor    : ${data.license_plate}\n` +
                    `Jadwal        : ${data.slotDate || '-'} [${data.slotTime || '-'}]\n` +
                    `Jenis Muatan  : ${data.purpose || 'Logistik'}\n` +
                    `--------------------------------------------\n\n` +
                    `PENTING:\n` +
                    `- Tiba 15 menit sebelum jadwal\n` +
                    `- Siapkan dokumen: SJ, Invoice, KTP\n\n` +
                    `Sociolla Warehouse Management`;
        sendWANotification(data.phone, msg);
    }

    return mapSupabaseToDriver(insertedData);
};

// [TEMPLATE 2 & 3: TICKET_QUEUE & NOTIF_OPS]
export const verifyDriver = async (id: string, verifier: string, notes: string, photos: string[]): Promise<boolean> => {
    const { data: driver } = await supabase.from('drivers').select('*').eq('id', id).single();
    if (!driver) return false;

    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const { count } = await supabase.from('drivers').select('*', { count: 'exact', head: true })
        .eq('status', 'CHECKED_IN').gte('verified_time', startOfDay.getTime());

    const queueNo = `SOC-${((count || 0) + 1).toString().padStart(3, '0')}`;
    const now = Date.now();

    const { error } = await supabase.from('drivers').update({
        status: QueueStatus.CHECKED_IN, 
        queue_number: queueNo, 
        security_notes: notes,
        verified_by: verifier, 
        verified_time: now, 
        photo_before_urls: photos 
    }).eq('id', id);

    if (error) return false;

    // A. Pesan ke DRIVER
    if (driver.phone) {
        const msgDriver = `TIKET ANTRIAN ANDA\n\n` +
                          `Nomor Antrian : ${queueNo}\n` +
                          `Status        : ENTRY APPROVED\n` +
                          `Waktu Masuk   : ${formatTime(now)}\n` +
                          `--------------------------------------------\n` +
                          `INSTRUKSI:\n` +
                          `1. Parkir di area tunggu yang tersedia\n` +
                          `2. Tunggu panggilan via WhatsApp/Monitor\n` +
                          `3. Dilarang meninggalkan area gudang\n\n` +
                          `Sociolla Warehouse Management`;
        sendWANotification(driver.phone, msgDriver);
    }

    // B. Pesan ke GRUP OPS
    const msgOps = `NOTIFIKASI KEDATANGAN (INBOUND)\n` +
                   `--------------------------------------------\n` +
                   `Antrian      : ${queueNo}\n` +
                   `Vendor       : ${driver.company}\n` +
                   `Plat Nomor   : ${driver.license_plate}\n` +
                   `Driver       : ${driver.name}\n` +
                   `Jam Masuk    : ${formatTime(now)}\n` +
                   `Security     : ${verifier}\n` +
                   `--------------------------------------------\n` +
                   `Status: WAITING FOR DOCK ASSIGNMENT`;
    sendWANotification(ID_GROUP_OPS, msgOps);

    return true;
};

// [TEMPLATE 4: CALL_DRIVER]
export const callDriver = async (id: string, caller: string, gate: string): Promise<boolean> => {
    const { data: driver } = await supabase.from('drivers').select('*').eq('id', id).single();
    if (!driver) return false;

    const { error } = await supabase.from('drivers').update({
        status: QueueStatus.CALLED,
        gate: gate,
        called_time: Date.now(),
        called_by: caller
    }).eq('id', id);

    if (error) return false;

    if (driver.phone) {
        const msg = `PANGGILAN BONGKAR MUAT\n\n` +
                    `Kepada Sdr. ${driver.name},\n\n` +
                    `Giliran Anda telah tiba.\n` +
                    `--------------------------------------------\n` +
                    `Nomor Antrian : ${driver.queue_number || '-'}\n` +
                    `Lokasi Tujuan : ${gate.replace(/_/g, ' ')}\n` +
                    `Waktu Panggil : ${formatTime(Date.now())}\n` +
                    `--------------------------------------------\n\n` +
                    `MOHON SEGERA MERAPAT KE LOKASI.\n` +
                    `Petugas checker sudah menunggu.\n\n` +
                    `Sociolla Warehouse Management`;
        sendWANotification(driver.phone, msg);
    }
    return true;
};

// [TEMPLATE 5: CHECKOUT_SUCCESS]
export const checkoutDriver = async (id: string, verifier: string, notes: string, photos: string[]): Promise<boolean> => {
    const { data: driver } = await supabase.from('drivers').select('*').eq('id', id).single();
    if (!driver) return false;

    const now = Date.now();
    const { error } = await supabase.from('drivers').update({
        status: QueueStatus.COMPLETED, 
        exit_time: now,
        notes: notes,
        exit_verified_by: verifier, 
        photo_after_urls: photos
    }).eq('id', id);

    if (error) return false;

    if (driver.phone) {
        const msg = `SURAT JALAN KELUAR (EXIT PASS)\n\n` +
                    `Proses operasional telah selesai.\n` +
                    `--------------------------------------------\n` +
                    `Nama Driver   : ${driver.name}\n` +
                    `Plat Nomor    : ${driver.license_plate}\n` +
                    `Waktu Keluar  : ${formatTime(now)}\n` +
                    `Petugas       : ${verifier}\n` +
                    `--------------------------------------------\n\n` +
                    `Terima kasih telah mematuhi aturan K3.\n` +
                    `Hati-hati di jalan.\n\n` +
                    `Sociolla Warehouse Management`;
        sendWANotification(driver.phone, msg);
    }
    return true;
};

// [TEMPLATE 7: BOOKING_REJECTED]
export const rejectDriver = async (id: string, reason: string, verifier: string): Promise<boolean> => {
    const { data: d } = await supabase.from('drivers').select('*').eq('id', id).single();
    if (!d) return false;
    await supabase.from('drivers').update({ status: 'REJECTED', rejection_reason: reason, verified_by: verifier }).eq('id', id);
    
    if (d.phone) {
        const msg = `STATUS BOOKING: DITOLAK\n\n` +
                    `Mohon maaf, kendaraan Anda tidak diizinkan masuk.\n` +
                    `--------------------------------------------\n` +
                    `Plat Nomor    : ${d.license_plate}\n` +
                    `Waktu         : ${formatTime(Date.now())}\n` +
                    `Alasan        : ${reason}\n` +
                    `--------------------------------------------\n\n` +
                    `Silakan hubungi PIC terkait untuk info lebih lanjut.\n` +
                    `Sociolla Warehouse Management`;
        sendWANotification(d.phone, msg);
    }
    return true;
};

export const getAvailableSlots = async (date: string): Promise<SlotInfo[]> => {
    const dayOfWeek = new Date(date + 'T00:00:00').getDay(); 
    if (dayOfWeek === 0) return []; 

    const baseSlots = ["08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00", "12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00", "16:00 - 17:00"];
    let activeSlots = baseSlots;

    if (dayOfWeek === 5) activeSlots = baseSlots.filter(t => !t.startsWith("11:00") && !t.startsWith("12:00"));
    else activeSlots = baseSlots.filter(t => !t.startsWith("12:00"));

    const { data } = await supabase.from('drivers').select('slot_time').eq('slot_date', date);
    
    return activeSlots.map(t => {
        const booked = data?.filter((d:any) => d.slot_time === t).length || 0;
        return { id: t, timeLabel: t, capacity: 3, booked: booked, isAvailable: booked < 3 };
    });
};

export const findBookingByCode = async (code: string): Promise<DriverData | null> => {
    const { data } = await supabase.from('drivers').select('*').ilike('booking_code', code).single();
    if (!data) return null;
    return mapSupabaseToDriver(data);
};

export const findBookingByPlateOrPhone = async (query: string): Promise<DriverData | null> => {
    const { data } = await supabase.from('drivers').select('*')
        .or(`license_plate.ilike.%${query}%,phone.ilike.%${query}%`)
        .eq('status', 'BOOKED')
        .limit(1)
        .single();
    if (!data) return null;
    return mapSupabaseToDriver(data);
};

export const confirmArrivalCheckIn = async (id: string, notes: string, editData?: Partial<DriverData>, newDoc?: string): Promise<DriverData> => {
    const updates: any = { 
        status: QueueStatus.AT_GATE, 
        notes: notes, 
        arrived_at_gate_time: Date.now() 
    };
    if (editData) {
        if(editData.name) updates.name = editData.name;
        if(editData.licensePlate) updates.license_plate = editData.licensePlate;
        if(editData.phone) updates.phone = editData.phone;
        if(editData.company) updates.company = editData.company;
    }
    if (newDoc) updates.document_file = newDoc;
    const { data, error } = await supabase.from('drivers').update(updates).eq('id', id).select().single();
    if (error) throw new Error("Gagal update arrival: " + error.message);
    return mapSupabaseToDriver(data);
};

export const updateDriverStatus = async (id: string, status: QueueStatus): Promise<boolean> => {
    const { error } = await supabase.from('drivers').update({ status }).eq('id', id);
    return !error;
};

export const scanDriverQR = async (code: string): Promise<DriverData | null> => {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
    let query = supabase.from('drivers').select('*');
    if (isUUID) { query = query.eq('id', code); } else { query = query.eq('booking_code', code); }
    const { data } = await query.single();
    if (!data) return null;
    return mapSupabaseToDriver(data);
};

// ============================================================================
// 🔥 AUTH & SECURITY
// ============================================================================

const HARDCODED_USERS: UserProfile[] = [
    { id: 'SECURITY', name: 'Pak Satpam', role: 'SECURITY', pin_code: '1234', status: 'ACTIVE' },
    { id: 'ADMIN', name: 'Admin Ops', role: 'ADMIN', pin_code: '1234', status: 'ACTIVE' },
    { id: 'MANAGER', name: 'Manager Logistik', role: 'MANAGER', pin_code: '1234', status: 'ACTIVE' }
];

export const loginSystem = async (id: string, pass: string): Promise<UserProfile> => {
    await new Promise(r => setTimeout(r, 500)); 
    const cleanId = id.trim().toUpperCase();
    const cleanPass = pass.trim();
    const user = HARDCODED_USERS.find(u => u.id === cleanId);
    if (!user) throw new Error("Username/ID tidak ditemukan.");
    if (user.pin_code !== cleanPass) throw new Error("PIN/Password salah.");
    return user;
};

export const verifyDivisionCredential = async (id: string, pass: string): Promise<DivisionConfig | null> => {
    const cleanId = id.trim().toUpperCase();
    const cleanPass = pass.trim();
    const user = HARDCODED_USERS.find(u => u.id === cleanId);
    if (!user) throw new Error("ID Divisi tidak terdaftar.");
    if (user.pin_code !== cleanPass) throw new Error("Password Divisi salah.");
    return { id: user.id, name: user.role, role: user.role as any, password: user.pin_code, theme: 'blue' };
};

// ============================================================================
// 🔥 ADMIN / COMMAND CENTER FEATURES
// ============================================================================

export const getGateConfigs = async (): Promise<GateConfig[]> => {
    const { data } = await supabase.from('gate_configs').select('*').order('gate_id', { ascending: true });
    return (data || []).map((g: any) => ({ 
        id: g.id, name: g.name, capacity: g.capacity, status: g.status, type: g.type 
    }));
};

export const saveGateConfig = async (gate: GateConfig): Promise<boolean> => {
    const { error } = await supabase.from('gate_configs').upsert({
        gate_id: gate.id, name: gate.name, capacity: gate.capacity, status: gate.status, type: gate.type
    }, { onConflict: 'gate_id' });
    return !error;
};

export const deleteSystemSetting = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('gate_configs').delete().eq('id', id);
    return !error;
};

// Developer Config
export interface DevConfig { enableGpsBypass: boolean; enableMockOCR: boolean; }
export const getDevConfig = (): DevConfig => {
    if (typeof window === 'undefined') return { enableGpsBypass: false, enableMockOCR: false };
    try {
        const stored = localStorage.getItem(DEV_CONFIG_KEY);
        return stored ? JSON.parse(stored) : { enableGpsBypass: false, enableMockOCR: false };
    } catch (e) { return { enableGpsBypass: false, enableMockOCR: false }; }
};
export const saveDevConfig = (config: DevConfig): void => {
    if (typeof window !== 'undefined') localStorage.setItem(DEV_CONFIG_KEY, JSON.stringify(config));
};

// Stubs & Utils
export const getActivityLogs = async (): Promise<ActivityLog[]> => { 
    const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(20);
    return data || []; 
};

export const wipeDatabase = async (): Promise<void> => { console.log("Wipe DB stub"); };
export const seedDummyData = async (): Promise<void> => { console.log("Seed Data stub"); };
export const exportDatabase = (): string => { return "{}"; };
export const importDatabase = (json: string): boolean => { console.log("Import stub"); return true; };
export const getProfiles = async (): Promise<UserProfile[]> => { return HARDCODED_USERS; };
export const addProfile = async (profile: UserProfile): Promise<boolean> => { console.log("Add profile stub", profile); return true; };
export const updateProfile = async (profile: UserProfile): Promise<boolean> => { console.log("Update profile stub", profile); return true; };
export const deleteProfile = async (id: string): Promise<boolean> => { console.log("Delete profile stub", id); return true; };
export const getDivisions = async (): Promise<DivisionConfig[]> => { return []; };
export const saveDivision = async (div: DivisionConfig): Promise<boolean> => { console.log("Save div stub", div); return true; };
export const deleteDivision = async (id: string): Promise<boolean> => { console.log("Delete div stub", id); return true; };
