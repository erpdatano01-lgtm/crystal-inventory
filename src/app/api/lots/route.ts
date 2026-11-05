import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// GET all stock lots
export async function GET() {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
  }

  const { data, error } = await supabaseAdmin
    .from('stock_lots')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST: create a new stock lot
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
    }

    const body = await request.json();
    if (!body.lot_code) {
      return NextResponse.json({ error: 'lot_code is required' }, { status: 400 });
    }

    const payload = {
      lot_code: body.lot_code,
      expense_id: body.expense_id || null,
      total_cost: body.total_cost ?? 0,
      total_weight_grams: body.total_weight_grams || null,
      item_count: body.item_count || 0,
      drive_lot_folder_url: body.drive_lot_folder_url || null,
      notes: body.notes || null,
    };

    const { data, error } = await supabaseAdmin
      .from('stock_lots')
      .insert([payload])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// PATCH: edit a stock lot
export async function PATCH(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing lot ID' }, { status: 400 });
    }

    const body = await request.json();
    const allowed = [
      'lot_code',
      'expense_id',
      'total_cost',
      'total_weight_grams',
      'item_count',
      'drive_lot_folder_url',
      'notes',
    ];

    const updatePayload: Record<string, any> = {};
    for (const key of allowed) {
      if (key in body) updatePayload[key] = body[key];
    }

    const { data, error } = await supabaseAdmin
      .from('stock_lots')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// DELETE: delete a stock lot
export async function DELETE(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing lot ID' }, { status: 400 });
    }

    // Unlink products that have this lot_id first
    await supabaseAdmin
      .from('products')
      .update({ lot_id: null })
      .eq('lot_id', id);

    const { error } = await supabaseAdmin
      .from('stock_lots')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
