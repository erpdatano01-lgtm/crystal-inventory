import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';
import { Product, ProductStatus } from '@/types';

export const runtime = 'nodejs';

// GET all products
export async function GET() {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST: create product + initial stock movement
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
    }

    const body = await request.json();
    const productPayload = {
      sku: body.sku,
      lot_id: body.lot_id || null,
      name: body.name,
      stone_type: body.stone_type,
      item_type: body.item_type || 'UNIQUE',
      weight_grams: body.weight_grams ?? null,
      dimensions: body.dimensions || null,
      grade_origin: body.grade_origin || null,
      cost_price: body.cost_price ?? 0,
      selling_price: body.selling_price ?? 0,
      min_price: body.min_price ?? null,
      qty_on_hand: body.qty_on_hand ?? 1,
      status: body.status || 'AVAILABLE',
      r2_thumbnail_url: body.r2_thumbnail_url || null,
      r2_gallery_urls: body.r2_gallery_urls || [],
      drive_media_folder_url: body.drive_media_folder_url || null,
      drive_video_url: body.drive_video_url || null,
      storage_location: body.storage_location || null,
    };

    // 1. Insert product
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .insert([productPayload])
      .select()
      .single();

    if (prodErr) {
      return NextResponse.json({ error: prodErr.message }, { status: 400 });
    }

    // 2. Insert initial stock movement
    const movementPayload = {
      product_id: product.id,
      change_qty: product.qty_on_hand,
      reason: 'INITIAL_STOCK',
      note: 'บันทึกรับเข้าสต็อกครั้งแรก',
    };

    const { error: movErr } = await supabaseAdmin
      .from('stock_movements')
      .insert([movementPayload]);

    if (movErr) {
      console.warn('Initial movement warning:', movErr);
    }

    return NextResponse.json(product);
  } catch (err: any) {
    console.error('Create product error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// PATCH: update product status (e.g. to SOLD, cutting qty and recording stock movement)
export async function PATCH(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
    }

    const { id, status, note } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    // Get current product
    const { data: current, error: getErr } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (getErr || !current) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const isSold = status === 'SOLD';
    const newQty = isSold ? Math.max(0, current.qty_on_hand - 1) : current.qty_on_hand;

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('products')
      .update({
        status,
        qty_on_hand: newQty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    // Record stock movement if marked as SOLD
    if (isSold) {
      await supabaseAdmin.from('stock_movements').insert([
        {
          product_id: id,
          change_qty: -1,
          reason: 'SOLD',
          note: note || 'ขายหน้าร้าน (เปลี่ยนสถานะเป็น SOLD)',
        },
      ]);
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('Update status error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// DELETE: delete product by id
export async function DELETE(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });
    }

    // 1. Delete associated stock_movements first
    await supabaseAdmin
      .from('stock_movements')
      .delete()
      .eq('product_id', id);

    // 2. Delete product
    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error('Delete product error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
