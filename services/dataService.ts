import { supabase } from './supabaseClient';
import { DriverData, QueueStatus, UserProfile, GateConfig, SlotInfo, DivisionConfig, ActivityLog } from '../types';

// KONFIGURASI GRUP WA & SISTEM
const ID_GROUP_OPS = '120363423657558569@g.us'; // Ganti dengan ID Grup Asli
const DEV_CONFIG_KEY = 'yms_dev_config';

// --- HELPER UTILS ---
const formatTime = (ts: number | string) => {
    return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
};

const formatDateLocal = (ts: number | string) => {
    return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Fungsi Kirim WA Universal
const sendWANotification = async (target: string, message: string) => {
    if (!target) return;
    try {
        // Bersihkan nomor HP (hapus karakter aneh, ganti 0 jadi 62)
        let cleanTarget = target.replace(/\D/g, '');
        if (cleanTarget.startsWith('0')) cleanTarget = '62' + cleanTarget.slice(1);
        
        await fetch('/api/whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: cleanTarget, message }),
        });
    } catch (e) { console.error("WA Error", e); }
};

// ============================================================================
// 🔥 DATA MAPPING
// ============================================================================

const mapSupabaseToDriver = (data: any): DriverData => ({
    id: data.id,
    name: data.name,
    licensePlate: data.license_plate, // Pastikan mapping ini sesuai column DB
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

// ============================================================================
// 🔥 MAIN FLOW FUNCTIONS
// ============================================================================

// 1. CREATE BOOKING (FIX BUG NULL LICENSE PLATE DISINI)
export const createCheckIn = async (data: Partial<DriverData>, docFile?: string): Promise<DriverData | null> => {
    // FIX: Ambil plat nomor dari field manapun yang tersedia (camelCase atau snake_case)
    const plateNumber = data.licensePlate || (data as any).license_plate || '-';

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
        license_plate: plateNumber, // Gunakan variabel yang sudah diamankan
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
                    `Plat Nomor    : ${plateNumber}\n` + // Gunakan plateNumber yang aman
                    `Jadwal        : ${data.slotDate || '-'} [${data.slotTime || '-'}]\n` +
                    `--------------------------------------------\n\n` +
                    `Harap tiba 15 menit sebelum jadwal.\n` +
                    `Sociolla Warehouse Management`;
        sendWANotification(data.phone, msg);
    }

    return mapSupabaseToDriver(insertedData);
};

// 2. VERIFY DRIVER (TIKET MASUK)
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

    if (driver.phone) {
        const msgDriver = `TIKET ANTRIAN ANDA\n\n` +
                          `Nomor Antrian : ${queueNo}\n` +
                          `Plat Nomor    : ${driver.license_plate}\n` +
                          `Status        : ENTRY APPROVED\n` +
                          `Waktu Masuk   : ${formatTime(now)}\n` +
                          `--------------------------------------------\n` +
                          `Silakan parkir dan tunggu panggilan.\n` +
                          `Sociolla Warehouse Management`;
        sendWANotification(driver.phone, msgDriver);
    }
    
    // Notif ke Group Admin
    const msgOps = `NOTIFIKASI KEDATANGAN (INBOUND)\n` +
                   `--------------------------------------------\n` +
                   `Antrian      : ${queueNo}\n` +
                   `Plat Nomor   : ${driver.license_plate}\n` +
                   `Vendor       : ${driver.company}\n` +
                   `Status       : WAITING DOCK\n` +
                   `--------------------------------------------`;
    sendWANotification(ID_GROUP_OPS, msgOps);

    return true;
};

// 3. CALL DRIVER (PANGGILAN)
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
                    `Kepada: ${driver.name} (${driver.license_plate})\n\n` +
                    `Giliran Anda telah tiba.\n` +
                    `--------------------------------------------\n` +
                    `LOKASI TUJUAN : ${gate.replace(/_/g, ' ')}\n` +
                    `--------------------------------------------\n\n` +
                    `MOHON SEGERA MERAPAT KE DOCK.\n` +
                    `Sociolla Warehouse Management`;
        sendWANotification(driver.phone, msg);
    }
    return true;
};

// 4. CHECKOUT
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
                    `Plat Nomor    : ${driver.license_plate}\n` +
                    `Waktu Keluar  : ${formatTime(now)}\n` +
                    `--------------------------------------------\n` +
                    `Terima kasih, hati-hati di jalan.\n` +
                    `Sociolla Warehouse Management`;
        sendWANotification(driver.phone, msg);
    }
    return true;
};

// 5. REJECT
export const rejectDriver = async (id: string, reason: string, verifier: string): Promise<boolean> => {
    const { data: d } = await supabase.from('drivers').select('*').eq('id', id).single();
    if (!d) return false;
    await supabase.from('drivers').update({ status: 'REJECTED', rejection_reason: reason, verified_by: verifier }).eq('id', id);
    
    if (d.phone) {
        const msg = `STATUS BOOKING: DITOLAK\n\n` +
                    `Plat Nomor    : ${d.license_plate}\n` +
                    `Alasan        : ${reason}\n` +
                    `--------------------------------------------\n` +
                    `Sociolla Warehouse Management`;
        sendWANotification(d.phone, msg);
    }
    return true;
};

// --- FUNGSI PENDUKUNG LAINNYA ---
export const getAvailableSlots = async (date: string): Promise<SlotInfo[]> => {
    const dayOfWeek = new Date(date + 'T00:00:00').getDay(); 
    if (dayOfWeek === 0) return []; 
    const baseSlots = ["08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00", "12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00", "16:00 - 17:00"];
    let activeSlots = dayOfWeek === 5 ? baseSlots.filter(t => !t.startsWith("11:00") && !t.startsWith("12:00")) : baseSlots.filter(t => !t.startsWith("12:00"));
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
    const { data } = await supabase.from('drivers').select('*').or(`license_plate.ilike.%${query}%,phone.ilike.%${query}%`).eq('status', 'BOOKED').limit(1).single();
    if (!data) return null;
    return mapSupabaseToDriver(data);
};

export const confirmArrivalCheckIn = async (id: string, notes: string, editData?: Partial<DriverData>, newDoc?: string): Promise<DriverData> => {
    const updates: any = { status: QueueStatus.AT_GATE, notes: notes, arrived_at_gate_time: Date.now() };
    if (editData) {
        if(editData.name) updates.name = editData.name;
        if(editData.licensePlate) updates.license_plate = editData.licensePlate;
        if(editData.phone) updates.phone = editData.phone;
        if(editData.company) updates.company = editData.company;
    }
    if (newDoc) updates.document_file = newDoc;
    const { data, error } = await supabase.from('drivers').update(updates).eq('id', id).select().single();
    if (error) throw new Error("Update Error: " + error.message);
    return mapSupabaseToDriver(data);
};

export const updateDriverStatus = async (id: string, status: QueueStatus): Promise<boolean> => {
    const { error } = await supabase.from('drivers').update({ status }).eq('id', id);
    return !error;
};

export const scanDriverQR = async (code: string): Promise<DriverData | null> => {
    let query = supabase.from('drivers').select('*');
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(code)) query = query.eq('id', code); else query = query.eq('booking_code', code);
    const { data } = await query.single();
    if (!data) return null;
    return mapSupabaseToDriver(data);
};

// GATE & USERS
export const getGateConfigs = async (): Promise<GateConfig[]> => {
    const { data } = await supabase.from('gate_configs').select('*').order('gate_id', { ascending: true });
    return (data || []).map((g: any) => ({ id: g.id, name: g.name, capacity: g.capacity, status: g.status, type: g.type }));
};
export const saveGateConfig = async (gate: GateConfig): Promise<boolean> => {
    const { error } = await supabase.from('gate_configs').upsert({ gate_id: gate.id, name: gate.name, capacity: gate.capacity, status: gate.status, type: gate.type }, { onConflict: 'gate_id' });
    return !error;
};
export const loginSystem = async (id: string, pass: string): Promise<UserProfile> => {
    if (id.toUpperCase() === 'ADMIN' && pass === '1234') return { id: 'ADMIN', name: 'Admin Ops', role: 'ADMIN', pin_code: '1234', status: 'ACTIVE' };
    throw new Error("Invalid Credentials");
};
export const verifyDivisionCredential = async (id: string, pass: string): Promise<DivisionConfig | null> => {
    if (id.toUpperCase() === 'SECURITY' && pass === '1234') return { id: 'SECURITY', name: 'Security Guard', role: 'SECURITY', password: '1234', theme: 'blue' };
    return null;
};
export const getActivityLogs = async (): Promise<ActivityLog[]> => { return []; };
