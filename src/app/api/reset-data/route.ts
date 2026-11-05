import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
    }

    const { target } = await request.json().catch(() => ({ target: 'all' }));

    if (target === 'products' || target === 'all') {
      // Delete stock_movements then products
      await supabaseAdmin.from('stock_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabaseAdmin.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }

    if (target === 'expenses' || target === 'all') {
      await supabaseAdmin.from('stock_lots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabaseAdmin.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }

    return NextResponse.json({
      success: true,
      message: target === 'all'
        ? 'ล้างข้อมูลทดสอบทั้งหมดเรียบร้อยแล้ว'
        : `ล้างข้อมูล ${target} เรียบร้อยแล้ว`,
    });
  } catch (err: any) {
    console.error('Reset data error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
