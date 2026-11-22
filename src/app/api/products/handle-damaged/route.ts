import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';
import { setProductCampaignAssignment } from '@/lib/campaignStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
    }

    const body = await request.json();
    const productId = String(body?.productId || '').trim();
    const action = body?.action === 'CONVERT_TO_FREEBIE' ? 'CONVERT_TO_FREEBIE' : 'DAMAGED';
    const note = body?.note ? String(body.note).trim() : '';

    if (!productId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
    }

    const { data: cur, error: getErr } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (getErr || !cur) {
      return NextResponse.json({ error: 'ไม่พบสินค้านี้ในระบบ' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    if (action === 'DAMAGED') {
      const currentQty = Number(cur.qty_on_hand) || 0;
      const deductQty = Math.min(Math.max(1, currentQty), Math.max(1, Number(body?.qty) || 1));
      const newQty = Math.max(0, currentQty - deductQty);
      const nextStatus = newQty === 0 ? 'SOLD' : cur.status;

      const prevOrigin = cur.grade_origin ? String(cur.grade_origin) : '';
      const damagedOrigin = prevOrigin.includes('[DAMAGED]')
        ? prevOrigin
        : prevOrigin
        ? `${prevOrigin} [DAMAGED]`
        : '[DAMAGED]';

      const { data: updated, error: updErr } = await supabaseAdmin
        .from('products')
        .update({
          qty_on_hand: newQty,
          status: nextStatus,
          grade_origin: damagedOrigin,
          updated_at: nowIso,
        })
        .eq('id', productId)
        .select()
        .single();

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 });
      }

      // Remove from any Ad Campaign if fully damaged
      if (newQty === 0) {
        await setProductCampaignAssignment([productId], null).catch(() => {});
      }

      await supabaseAdmin.from('stock_movements').insert([
        {
          product_id: productId,
          change_qty: -deductQty,
          reason: 'DAMAGED',
          note: note ? `หินแตก/เสียหาย: ${note}` : 'หินแตกหัก/เสียหาย (ตัดสูญเสีย)',
        },
      ]);

      return NextResponse.json({
        success: true,
        action: 'DAMAGED',
        product: { ...updated, is_freebie: Boolean(updated?.sku?.startsWith('GIFT')), campaign_tag: null },
      });
    }

    // CONVERT_TO_FREEBIE
    const baseSku = String(cur.sku || '');
    let newSku = baseSku.startsWith('GIFT-') ? baseSku : `GIFT-${baseSku}`;

    // Ensure newSku does not collide
    if (newSku !== baseSku) {
      const { data: dup } = await supabaseAdmin
        .from('products')
        .select('id')
        .ilike('sku', newSku)
        .limit(1);
      if (dup && dup.length > 0) {
        newSku = `${newSku}-${Date.now().toString().slice(-3)}`;
      }
    }

    const baseName = String(cur.name || '');
    const newName = baseName.includes('(ของแถม)') ? baseName : `${baseName} (ของแถม)`;
    const prevOrigin = cur.grade_origin ? String(cur.grade_origin) : '';
    const newOrigin = note
      ? prevOrigin
        ? `${prevOrigin} [ของแถม: ${note}]`
        : `[ของแถม: ${note}]`
      : prevOrigin || 'ของแถม';

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('products')
      .update({
        sku: newSku,
        name: newName,
        selling_price: 0,
        status: Number(cur.qty_on_hand) > 0 ? 'AVAILABLE' : 'AVAILABLE',
        qty_on_hand: Math.max(1, Number(cur.qty_on_hand) || 1),
        storage_location: 'GIFT',
        grade_origin: newOrigin,
        updated_at: nowIso,
      })
      .eq('id', productId)
      .select()
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    // Remove from any Ad Campaign since it's now a freebie
    await setProductCampaignAssignment([productId], null).catch(() => {});

    await supabaseAdmin.from('stock_movements').insert([
      {
        product_id: productId,
        change_qty: 0,
        reason: 'CRAFT_USE',
        note: note
          ? `แปรสภาพเป็นของแถม (${newSku}): ${note}`
          : `แปรสภาพหินเป็นของแถม (${newSku})`,
      },
    ]);

    return NextResponse.json({
      success: true,
      action: 'CONVERT_TO_FREEBIE',
      product: { ...updated, is_freebie: true, campaign_tag: null },
    });
  } catch (err: any) {
    console.error('POST /api/products/handle-damaged error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
