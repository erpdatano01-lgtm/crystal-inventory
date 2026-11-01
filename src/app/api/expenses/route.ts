import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// GET all expenses
export async function GET() {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { data, error } = await supabaseAdmin
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST: create expense with optional stock_lot
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
    }

    const { expense, createLot } = await request.json();
    if (!expense || !expense.title || !expense.total_amount) {
      return NextResponse.json({ error: 'Invalid expense data' }, { status: 400 });
    }

    // 1. Insert expense
    const { data: savedExpense, error: expErr } = await supabaseAdmin
      .from('expenses')
      .insert([expense])
      .select()
      .single();

    if (expErr) {
      return NextResponse.json({ error: expErr.message }, { status: 400 });
    }

    // 2. Insert stock_lot if requested
    let savedLot = null;
    if (createLot && createLot.lot_code) {
      const lotPayload = {
        lot_code: createLot.lot_code,
        expense_id: savedExpense.id,
        total_cost: savedExpense.total_amount,
        total_weight_grams: createLot.total_weight_grams || null,
        item_count: createLot.item_count || 0,
        drive_lot_folder_url: createLot.drive_lot_folder_url || null,
        notes: createLot.notes || null,
      };

      const { data: lotData, error: lotErr } = await supabaseAdmin
        .from('stock_lots')
        .insert([lotPayload])
        .select()
        .single();

      if (!lotErr) {
        savedLot = lotData;
      } else {
        console.warn('Create lot warning:', lotErr);
      }
    }

    return NextResponse.json({ expense: savedExpense, lot: savedLot });
  } catch (err: any) {
    console.error('Create expense error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
