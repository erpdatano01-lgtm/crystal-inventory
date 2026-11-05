import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escapeCsv(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const STATUS_THAI: Record<string, string> = {
  AVAILABLE: 'พร้อมจำหน่าย (Available)',
  RESERVED: 'ติดจอง (Reserved)',
  SOLD: 'ขายแล้ว (Sold Out)',
  IN_TRANSIT: 'กำลังจัดส่ง (In Transit)',
  PREP: 'กำลังคัดแยก/ถ่ายรูป (Prep)',
};

const ITEM_TYPE_THAI: Record<string, string> = {
  UNIQUE: 'ชิ้นเดี่ยว/ผลึกสวย (Unique Specimen)',
  COLLECTION: 'หินสะสม/หายาก (Collector Grade)',
  RETAIL: 'หินแบ่งขาย/เหมาล็อต (Bulk Retail)',
  PROCESSED: 'หินแกะสลัก/แปรรูป (Processed)',
};

export async function GET(request: Request) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return new NextResponse('Supabase is not configured', { status: 503 });
    }

    // 1. Fetch products
    const { data: products, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (prodErr) {
      return new NextResponse(`Database error: ${prodErr.message}`, { status: 500 });
    }

    // 2. Fetch lots to map lot_code
    const { data: lots } = await supabaseAdmin
      .from('stock_lots')
      .select('id, lot_code, lot_name, total_cost, total_weight_grams');

    const lotMap = new Map((lots || []).map((l) => [l.id, l]));

    // 3. Define CSV Headers (Thai + Eng for clarity in Google Sheets)
    const headers = [
      'รหัสสินค้า (SKU)',
      'ชื่อตัวอย่างหิน (Product Name)',
      'ชนิดหิน (Stone Type)',
      'ประเภทชิ้นงาน (Item Type)',
      'รหัสล็อตนำเข้า (Lot Code)',
      'สถานะสต็อก (Status)',
      'จำนวนคงเหลือ (Qty)',
      'น้ำหนักรวม (กรัม)',
      'ขนาด (ซม.)',
      'เกรด & แหล่งกำเนิด (Grade/Origin)',
      'ตำแหน่งจัดเก็บ (Storage Location)',
      'ราคาทุนต่อชิ้น (บาท)',
      'ราคาทุนรวม (บาท)',
      'ราคาขายหน้าร้าน (บาท)',
      'มูลค่าขายรวม (บาท)',
      'ราคาขั้นต่ำ/สด (บาท)',
      'กำไรคาดการณ์ต่อชิ้น (บาท)',
      'อัตรากำไร (%)',
      'รูปภาพหน้าปก R2 (Image URL)',
      'วิดีโอคลิป Google Drive (Video URL)',
      'โฟลเดอร์ไฟล์เต็ม Google Drive (Folder URL)',
      'วันที่ลงสต็อก (Created Date)',
    ];

    const rows: string[] = [];

    // UTF-8 BOM for proper Thai characters in Excel and Google Sheets
    rows.push(headers.map(escapeCsv).join(','));

    for (const p of products || []) {
      const lot = p.lot_id ? lotMap.get(p.lot_id) : null;
      const cost = Number(p.cost_price) || 0;
      const price = Number(p.selling_price) || 0;
      const minPrice = p.min_price !== null && p.min_price !== undefined ? Number(p.min_price) : '';
      const qty = Number(p.qty_on_hand) || 0;
      const totalCost = cost * qty;
      const totalSelling = price * qty;
      const profit = price > 0 && cost > 0 ? price - cost : '';
      const margin = price > 0 && cost > 0 ? `${(((price - cost) / price) * 100).toFixed(1)}%` : '';

      const createdDate = p.created_at ? new Date(p.created_at).toLocaleString('th-TH') : '';

      const row = [
        p.sku || '',
        p.name || '',
        p.stone_type || '',
        ITEM_TYPE_THAI[p.item_type] || p.item_type || '',
        lot?.lot_code || '',
        STATUS_THAI[p.status] || p.status || '',
        qty,
        p.weight_grams ?? '',
        p.dimensions || '',
        p.grade_origin || '',
        p.storage_location || '',
        cost,
        totalCost,
        price,
        totalSelling,
        minPrice,
        profit,
        margin,
        p.r2_thumbnail_url || '',
        p.drive_video_url || '',
        p.drive_media_folder_url || '',
        createdDate,
      ];

      rows.push(row.map(escapeCsv).join(','));
    }

    const csvContent = '\uFEFF' + rows.join('\r\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'inline; filename="crystal_products_export.csv"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  } catch (error: any) {
    return new NextResponse(`Export error: ${error.message}`, { status: 500 });
  }
}
