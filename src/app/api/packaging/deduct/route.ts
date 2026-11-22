import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DeductPackagingItem {
  productId: string;
  sku: string;
  name?: string;
  qty: number;
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
    }

    const body = await request.json();
    const orderNo: string = body?.orderNo ? String(body.orderNo).trim() : '';
    const items: DeductPackagingItem[] = Array.isArray(body?.items) ? body.items : [];

    const validItems = items.filter((it) => it && it.productId && Number(it.qty) > 0);
    if (validItems.length === 0) {
      return NextResponse.json({ success: true, deducted: [], totalPackagingCost: 0 });
    }

    const deducted: Array<{
      productId: string;
      sku: string;
      name: string;
      qtyUsed: number;
      newQty: number;
      unitCost: number;
    }> = [];
    let totalPackagingCost = 0;

    for (const item of validItems) {
      const qtyUsed = Math.max(1, Math.round(Number(item.qty) || 1));

      const { data: cur, error: fetchErr } = await supabaseAdmin
        .from('products')
        .select('id, sku, name, qty_on_hand, cost_price')
        .eq('id', item.productId)
        .single();

      if (fetchErr || !cur) {
        console.warn('Packaging item not found:', item.productId);
        continue;
      }

      const currentQty = Number(cur.qty_on_hand) || 0;
      const newQty = Math.max(0, currentQty - qtyUsed);
      const nextStatus = newQty === 0 ? 'SOLD' : 'AVAILABLE';
      const unitCost = Number(cur.cost_price) || 0;
      totalPackagingCost += unitCost * qtyUsed;

      await supabaseAdmin
        .from('products')
        .update({
          qty_on_hand: newQty,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cur.id);

      await supabaseAdmin.from('stock_movements').insert([
        {
          product_id: cur.id,
          change_qty: -qtyUsed,
          reason: 'CRAFT_USE',
          note: orderNo
            ? `ใช้แพ็กพัสดุบิล ${orderNo} (${cur.sku} x${qtyUsed})`
            : `ใช้แพ็กพัสดุ (${cur.sku} x${qtyUsed})`,
        },
      ]);

      deducted.push({
        productId: cur.id,
        sku: cur.sku,
        name: cur.name,
        qtyUsed,
        newQty,
        unitCost,
      });
    }

    return NextResponse.json({
      success: true,
      deducted,
      totalPackagingCost: Number(totalPackagingCost.toFixed(2)),
    });
  } catch (err: any) {
    console.error('POST /api/packaging/deduct error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to deduct packaging stock' },
      { status: 500 }
    );
  }
}
