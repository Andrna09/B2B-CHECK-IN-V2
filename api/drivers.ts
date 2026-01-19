import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Buffer } from 'buffer';

// --- CONFIGURATION ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("FATAL: Supabase URL atau Key belum dikonfigurasi di Environment Variables Vercel.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

// --- TYPE DEFINITIONS ---
// Interface ini SAMA PERSIS dengan struktur tabel 'drivers' di SQL Anda
interface DriverPayload {
  id: string;
  name: string;
  phone: string;
  licensePlate: string;
  company: string;
  purpose: string; // 'LOADING' | 'UNLOADING'
  entryType: string; // 'WALK_IN' | 'BOOKING'
  bookingCode?: string;
  poNumber?: string;   // Pengganti doNumber
  visitDate?: string;  // YYYY-MM-DD
  slotTime?: string;   // HH:MM
  status: string;
  gate?: string;
  queueNumber?: string;
  
  // Timestamps (BigInt di SQL, number di JS)
  checkInTime?: number;
  verifiedTime?: number;
  calledTime?: number;
  loadingStartTime?: number;
  endTime?: number;
  exitTime?: number;
  
  // Dokumen
  notes?: string;
  documentFile?: string;
  photoBeforeUrls?: string[];
  photoAfterUrls?: string[];

  // Admin Notes
  rejectionReason?: string;
  adminNotes?: string;
  securityNotes?: string;
  
  // Audit
  verifiedBy?: string;
  calledBy?: string;
  exitVerifiedBy?: string;
}

// Helper: Mapping CamelCase (Frontend) -> Snake_case (Database SQL)
// Pastikan nama properti di return object SAMA dengan nama kolom di CREATE TABLE
const mapToDb = (data: Partial<DriverPayload>) => {
  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    license_plate: data.licensePlate,
    company: data.company,
    purpose: data.purpose,
    entry_type: data.entryType || 'WALK_IN', // Default sesuai SQL
    booking_code: data.bookingCode,
    po_number: data.poNumber,   // KOLOM BARU
    visit_date: data.visitDate, // KOLOM BARU
    slot_time: data.slotTime,   // KOLOM BARU
    status: data.status,
    gate: data.gate,
    queue_number: data.queueNumber,
    
    // Waktu
    check_in_time: data.checkInTime,
    verified_time: data.verifiedTime,
    called_time: data.calledTime,
    loading_start_time: data.loadingStartTime,
    end_time: data.endTime,
    exit_time: data.exitTime,
    
    // Dokumen
    notes: data.notes,
    document_file: data.documentFile,
    photo_before_urls: data.photoBeforeUrls, // Array Text di SQL
    photo_after_urls: data.photoAfterUrls,   // Array Text di SQL
    
    // Admin
    rejection_reason: data.rejectionReason,
    admin_notes: data.adminNotes,
    security_notes: data.securityNotes,
    verified_by: data.verifiedBy,
    called_by: data.calledBy,
    exit_verified_by: data.exitVerifiedBy
  };
};

// Helper: Mapping Snake_case (Database SQL) -> CamelCase (Frontend)
const mapToFrontend = (row: Record<string, any>): DriverPayload => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  licensePlate: row.license_plate,
  company: row.company,
  purpose: row.purpose,
  entryType: row.entry_type,
  bookingCode: row.booking_code,
  poNumber: row.po_number,
  visitDate: row.visit_date,
  slotTime: row.slot_time,
  status: row.status,
  gate: row.gate,
  queueNumber: row.queue_number,
  
  // Konversi BigInt/String angka ke Number JS
  checkInTime: row.check_in_time ? Number(row.check_in_time) : undefined,
  verifiedTime: row.verified_time ? Number(row.verified_time) : undefined,
  calledTime: row.called_time ? Number(row.called_time) : undefined,
  loadingStartTime: row.loading_start_time ? Number(row.loading_start_time) : undefined,
  endTime: row.end_time ? Number(row.end_time) : undefined,
  exitTime: row.exit_time ? Number(row.exit_time) : undefined,
  
  notes: row.notes,
  documentFile: row.document_file,
  photoBeforeUrls: row.photo_before_urls,
  photoAfterUrls: row.photo_after_urls,
  
  rejectionReason: row.rejection_reason,
  adminNotes: row.admin_notes,
  securityNotes: row.security_notes,
  verifiedBy: row.verified_by,
  calledBy: row.called_by,
  exitVerifiedBy: row.exit_verified_by
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Handling
  res.setHeader('Access-Control-Allow-Credentials', "true");
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, data } = req.body;

  try {
    // --- READ (GET ALL) ---
    if (action === 'GET') {
      const { data: rows, error } = await supabase
        .from('drivers')
        .select('*')
        .order('check_in_time', { ascending: false }) // Sort dari yang terbaru
        .limit(500);

      if (error) throw error;

      const formatted = rows ? rows.map(mapToFrontend) : [];
      return res.status(200).json(formatted);
    }

    // --- CREATE ---
    if (action === 'CREATE') {
      const inputData = data as DriverPayload;
      let documentUrl = inputData.documentFile;

      // 1. Upload Base64 Image to Supabase Storage (Jika ada)
      if (documentUrl && documentUrl.startsWith('data:')) {
        try {
           const base64Data = documentUrl.split(',')[1];
           const buffer = Buffer.from(base64Data, 'base64');
           const fileName = `SJ_${inputData.id}_${Date.now()}.jpg`;

           const { error: uploadError } = await supabase
             .storage
             .from('documents')
             .upload(fileName, buffer, {
                contentType: 'image/jpeg',
                upsert: true
             });

           if (uploadError) throw uploadError;

           const { data: publicUrlData } = supabase
             .storage
             .from('documents')
             .getPublicUrl(fileName);

           documentUrl = publicUrlData.publicUrl;

        } catch (err) {
           console.error("Storage Upload Error:", err);
           documentUrl = "Upload Failed";
        }
      }

      // 2. Insert to DB
      const dbPayload = mapToDb({ ...inputData, documentFile: documentUrl });

      const { error } = await supabase
        .from('drivers')
        .insert([dbPayload]);

      if (error) throw error;

      return res.status(200).json({ success: true, fileUrl: documentUrl });
    }

    // --- UPDATE ---
    if (action === 'UPDATE') {
      const inputData = data as DriverPayload;
      const dbPayload = mapToDb(inputData);
      
      // Pisahkan ID agar tidak ikut di-update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...updateFields } = dbPayload;

      if (!inputData.id) {
          throw new Error("Update failed: Missing ID");
      }

      const { error } = await supabase
        .from('drivers')
        .update(updateFields)
        .eq('id', inputData.id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid Action' });

  } catch (error: any) {
    console.error('Supabase API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
