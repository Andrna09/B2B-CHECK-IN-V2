import { supabase } from './supabaseClient';
import { DriverData, QueueStatus } from '../types';

// HAPUS IMPORT INI: import { sendWhatsAppNotification } from '../api/whatsapp';

// --- FUNGSI HELPER: WA CLIENT (PENGGANTI IMPORT) ---
const sendWhatsAppNotification = async (target: string, message: string): Promise<boolean> => {
  try {
    console.log('📤 Sending WA to:', target);
    // Panggil Endpoint Vercel /api/whatsapp
    const response = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target, message }),
    });

    const result = await response.json();
    console.log('📥 WA Result:', result);
    return result.status;
  } catch (error) {
    console.error('❌ Failed to send WA:', error);
    return false;
  }
};

// --- Helper: Mapping DB ke App ---
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

// 1. CREATE (Driver Daftar) -> Status PENDING_REVIEW
export const createCheckIn = async (data: Partial<DriverData>, docFile?: string): Promise<DriverData | null> => {
  let documentUrl = '';
  // Logic upload file disini (jika ada)

  const { data: insertedData, error } = await supabase
    .from('drivers')
    .insert([
      {
        name: data.name,
        license_plate: data.licensePlate,
        company: data.company,
        phone: data.phone,
        purpose: data.purpose,
        status: QueueStatus.PENDING_REVIEW, // Status Awal
        entry_type: 'BOOKING',
        check_in_time: Date.now(),
        document_file: docFile || ''
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating check-in:', error);
    throw error;
  }

  // Notifikasi ke Admin (Opsional)
  // await sendWhatsAppNotification('0812XXXXXX', `Pendaftaran Baru: ${data.licensePlate}`);

  return insertedData ? mapDatabaseToDriver(insertedData) : null;
};

// 2. ADMIN APPROVE (Tahap 1) -> Status BOOKED + Generate Code
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
        // Kirim WA ke Driver
        const { data } = await supabase.from('drivers').select('phone, name').eq('id', id).single();
        if (data?.phone) {
             const msg = `*KONFIRMASI BOOKING BERHASIL*\n\nHalo ${data.name},\nKode Booking: *${code}*\n\nSilakan tunjukkan pesan ini ke Security saat tiba di lokasi.`;
             await sendWhatsAppNotification(data.phone, msg);
        }
    }
    return !error;
};

// 3. ADMIN REJECT (Tahap 1) -> Status REJECTED
export const rejectBooking = async (id: string, reason: string): Promise<boolean> => {
    const { error } = await supabase.from('drivers').update({
        status: QueueStatus.REJECTED,
        rejection_reason: reason
    }).eq('id', id);

    if (!error) {
        const { data } = await supabase.from('drivers').select('phone, name').eq('id', id).single();
        if (data?.phone) {
             await sendWhatsAppNotification(data.phone, `Mohon Maaf ${data.name},\nPendaftaran Anda DITOLAK.\nAlasan: ${reason}`);
        }
    }
    return !error;
};

// 4. SECURITY CHECK-IN / REVISI (Tahap 2) -> Status CHECKED_IN
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
        // WA Notif Masuk Antrian
        const { data } = await supabase.from('drivers').select('phone').eq('id', id).single();
        if (data?.phone) await sendWhatsAppNotification(data.phone, `CHECK-IN BERHASIL.\nNomor Antrian: *${queueNo}*.\nSilakan parkir dan tunggu panggilan.`);
    }
    return !error;
};

// 5. SECURITY TOLAK / REBOOK (Tahap 2)
export const rejectGate = async (id: string, reason: string): Promise<boolean> => {
    const { error } = await supabase.from('drivers').update({
        status: QueueStatus.REJECTED_NEED_REBOOK,
        rejection_reason: reason
    }).eq('id', id);
    return !error;
};

// --- FUNGSI LAINNYA ---

export const getDrivers = async (): Promise<DriverData[]> => {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data ? data.map(mapDatabaseToDriver) : [];
};

export const updateDriverStatus = async (id: string, status: QueueStatus, gate?: string): Promise<void> => {
    const updates: any = { status };
    if (status === QueueStatus.CALLED && gate) {
        updates.gate = gate;
        updates.called_time = Date.now();
        // Opsi: Kirim WA Panggilan disini jika mau
        const { data } = await supabase.from('drivers').select('phone').eq('id', id).single();
        if(data?.phone) await sendWhatsAppNotification(data.phone, `PANGGILAN DOCK: Silakan menuju *${gate}* sekarang.`);
    }
    if (status === QueueStatus.LOADING) updates.loading_start_time = Date.now();
    if (status === QueueStatus.COMPLETED) updates.end_time = Date.now();
    
    await supabase.from('drivers').update(updates).eq('id', id);
};

export const checkoutDriver = async (id: string): Promise<void> => {
    await supabase.from('drivers').update({
        status: QueueStatus.EXITED,
        exit_time: Date.now()
    }).eq('id', id);
    
    // Kirim WA Surat Jalan Keluar
    const { data } = await supabase.from('drivers').select('phone').eq('id', id).single();
    if(data?.phone) await sendWhatsAppNotification(data.phone, `EXIT PASS.\nTerima kasih, hati-hati di jalan.`);
};
