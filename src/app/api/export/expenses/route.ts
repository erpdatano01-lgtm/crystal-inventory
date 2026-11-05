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

const CATEGORY_THAI: Record<string, string> = {
  STOCK_LOT: 'ล็อตหินนำเข้า (Stock Lot)',
  PACKAGING: 'กล่องพัสดุ/บรรจุภัณฑ์ (Packaging)',
  SHIPPING: 'ค่าขนส่ง/ไปรษณีย์ (Shipping)',
  BOOTH_MARKETING: 'ค่าบูธ/การตลาด (Marketing)',
  OTHER: 'ค่าใช้จ่ายอื่นๆ (Other)',
};

export async function GET(request: Request) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return new NextResponse('Supabase is not configured', { status: 503 });
    }

    // 1. Fetch expenses
    const { data: expenses, error: expErr } = await supabaseAdmin
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });

    if (expErr) {
      return new NextResponse(`Database error: ${expErr.message}`, { status: 500 });
    }

    // 2. Fetch stock lots to match with expense
    const { data: lots } = await supabaseAdmin
      .from('stock_lots')
      .select('*');

    const lotByExpenseId = new Map((lots || []).map((l) => [l.expense_id, l]));

    // 3. Define CSV Headers
    const headers = [
      'วันที่ทำรายการ (Expense Date)',
      'หมวดหมู่ค่าใช้จ่าย (Category)',
      'ชื่อรายการ / รายละเอียด (Title)',
      'ยอดเงินรวม (บาท)',
      'ร้านค้า / ผู้จำหน่าย (Vendor/Source)',
      'ช่องทางชำระเงิน (Payment Method)',
      'รหัสล็อตที่สร้างคู่กัน (Linked Lot Code)',
      'น้ำหนักล็อต (กรัม)',
      'ลิงก์สลิป/ใบเสร็จ R2 (Receipt URL)',
      'ลิงก์เอกสาร Google Drive (Drive Document URL)',
      'หมายเหตุ (Notes)',
      'วันที่บันทึกระบบ (Created Date)',
    ];

    const rows: string[] = [];

    // UTF-8 BOM
    rows.push(headers.map(escapeCsv).join(','));

    for (const exp of expenses || []) {
      const lot = lotByExpenseId.get(exp.id);
      const amount = Number(exp.total_amount) || 0;
      const createdDate = exp.created_at ? new Date(exp.created_at).toLocaleString('th-TH') : '';

      const row = [
        exp.expense_date || '',
        CATEGORY_THAI[exp.category] || exp.category || '',
        exp.title || '',
        amount,
        exp.vendor_name || '',
        exp.payment_method || '',
        lot?.lot_code || '',
        lot?.total_weight_grams ?? '',
        exp.r2_receipt_url || '',
        exp.drive_doc_url || '',
        exp.notes || '',
        createdDate,
      ];

      rows.push(row.map(escapeCsv).join(','));
    }

    const csvContent = '\uFEFF' + rows.join('\r\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'inline; filename="crystal_expenses_export.csv"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  } catch (error: any) {
    return new NextResponse(`Export error: ${error.message}`, { status: 500 });
  }
}
