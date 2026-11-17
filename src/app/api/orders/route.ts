import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';
import { Order } from '@/types';

export const runtime = 'nodejs';

// GET all orders
export async function GET() {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
  }

  // 1. Try fetching from orders table
  const { data: orders, error: ordErr } = await supabaseAdmin
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (!ordErr && orders) {
    return NextResponse.json(orders);
  }

  // 2. Fallback: Parse from stock_movements where reason = 'SOLD'
  const { data: movements } = await supabaseAdmin
    .from('stock_movements')
    .select('*, products(*)')
    .eq('reason', 'SOLD')
    .order('created_at', { ascending: false });

  const reconstructedOrders: Order[] = [];
  const seenOrderKeys = new Set<string>();

  for (const m of movements || []) {
    try {
      if (m.note && m.note.startsWith('{')) {
        const parsed = JSON.parse(m.note);
        if (parsed.order_no) {
          const key = parsed.id || parsed.order_no;
          if (!seenOrderKeys.has(key)) {
            seenOrderKeys.add(key);
            reconstructedOrders.push(parsed);
          }
          continue;
        }
      }
    } catch {
      // not json, continue
    }

    // Default synthetic order if legacy sold movement
    const p = m.products;
    if (p) {
      reconstructedOrders.push({
        id: m.id,
        order_no: `REC-${new Date(m.created_at).toISOString().slice(2, 7).replace('-', '')}-${m.id.slice(0, 4).toUpperCase()}`,
        order_date: new Date(m.created_at).toISOString().slice(0, 10),
        customer_name: 'ลูกค้าทั่วไป (Walk-in)',
        channel: 'WALK_IN',
        items: [
          {
            product_id: p.id,
            sku: p.sku,
            name: p.name,
            stone_type: p.stone_type,
            unit_price: Number(p.selling_price) || 0,
            cost_price: Number(p.cost_price) || 0,
            qty: 1,
            weight_grams: p.weight_grams,
            r2_thumbnail_url: p.r2_thumbnail_url,
          },
        ],
        subtotal: Number(p.selling_price) || 0,
        discount: 0,
        shipping_fee: 0,
        total_amount: Number(p.selling_price) || 0,
        total_cost: Number(p.cost_price) || 0,
        profit: (Number(p.selling_price) || 0) - (Number(p.cost_price) || 0),
        payment_method: 'โอนเงิน',
        notes: m.note || null,
        status: 'PAID',
        created_at: m.created_at,
      });
    }
  }

  return NextResponse.json(reconstructedOrders);
}

// POST: create new order / invoice & auto-deduct stock
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
    }

    const body: Order = await request.json();

    if (!body || !body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Order must contain at least 1 item' }, { status: 400 });
    }

    const orderNo = body.order_no || `INV-${new Date().toISOString().slice(2, 7).replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const orderData: Order = {
      ...body,
      id: body.id || crypto.randomUUID(),
      order_no: orderNo,
      order_date: body.order_date || new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
    };

    // 1. Update stock and status for selected products
    for (const item of orderData.items) {
      const { data: curProd } = await supabaseAdmin
        .from('products')
        .select('qty_on_hand')
        .eq('id', item.product_id)
        .single();

      const currentQty = typeof curProd?.qty_on_hand === 'number' ? curProd.qty_on_hand : 1;
      const deductQty = item.qty || 1;
      const newQty = Math.max(0, currentQty - deductQty);
      const newStatus = newQty === 0 ? 'SOLD' : 'AVAILABLE';

      await supabaseAdmin
        .from('products')
        .update({
          status: newStatus,
          qty_on_hand: newQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.product_id);

      // 2. Insert stock movement with full order json in note
      await supabaseAdmin.from('stock_movements').insert([
        {
          product_id: item.product_id,
          change_qty: -item.qty,
          reason: 'SOLD',
          note: JSON.stringify(orderData),
        },
      ]);
    }

    // 3. Attempt insert into orders table if schema has it
    try {
      await supabaseAdmin.from('orders').insert([
        {
          id: orderData.id,
          order_no: orderData.order_no,
          order_date: orderData.order_date,
          customer_name: orderData.customer_name,
          customer_phone: orderData.customer_phone || null,
          customer_address: orderData.customer_address || null,
          channel: orderData.channel,
          items: orderData.items,
          subtotal: orderData.subtotal,
          discount: orderData.discount,
          shipping_fee: orderData.shipping_fee,
          total_amount: orderData.total_amount,
          total_cost: orderData.total_cost,
          profit: orderData.profit,
          payment_method: orderData.payment_method,
          slip_url: orderData.slip_url || null,
          tracking_no: orderData.tracking_no || null,
          notes: orderData.notes || null,
          status: orderData.status,
          created_at: orderData.created_at,
        },
      ]);
    } catch {
      // Ignore if orders table does not exist
    }

    return NextResponse.json(orderData);
  } catch (err: any) {
    console.error('Create order error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// PATCH: update existing order fields (tracking_no, status, packing_video_url, packed_at, packed_items_log, notes)
export async function PATCH(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
    }

    const body = await request.json();
    const {
      id,
      order_no,
      status,
      tracking_no,
      packing_video_url,
      packed_at,
      packed_items_log,
      notes,
      customer_name,
      customer_phone,
      customer_address,
    } = body || {};

    if (!id && !order_no) {
      return NextResponse.json({ error: 'Missing order id or order_no' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {};
    if (status !== undefined) updatePayload.status = status;
    if (tracking_no !== undefined) updatePayload.tracking_no = tracking_no;
    if (packing_video_url !== undefined) updatePayload.packing_video_url = packing_video_url;
    if (packed_at !== undefined) updatePayload.packed_at = packed_at;
    if (packed_items_log !== undefined) updatePayload.packed_items_log = packed_items_log;
    if (notes !== undefined) updatePayload.notes = notes;
    if (customer_name !== undefined) updatePayload.customer_name = customer_name;
    if (customer_phone !== undefined) updatePayload.customer_phone = customer_phone;
    if (customer_address !== undefined) updatePayload.customer_address = customer_address;

    let updatedOrder: Order | null = null;

    // 1. Try updating in orders table if it exists
    try {
      let query = supabaseAdmin.from('orders').update(updatePayload);
      if (id) {
        query = query.eq('id', id);
      } else if (order_no) {
        query = query.eq('order_no', order_no);
      }
      const { data: ordData } = await query.select().single();
      if (ordData) {
        updatedOrder = ordData as Order;
      }
    } catch {
      // orders table might not have all columns or might not exist
    }

    // 2. Also update JSON inside stock_movements where reason = 'SOLD'
    const { data: movements } = await supabaseAdmin
      .from('stock_movements')
      .select('*, products(*)')
      .eq('reason', 'SOLD');

    for (const m of movements || []) {
      try {
        let parsed: any = null;
        if (m.note && m.note.startsWith('{')) {
          try {
            parsed = JSON.parse(m.note);
          } catch {
            // ignore
          }
        }

        // If legacy movement without JSON, reconstruct parsed object
        if (!parsed && id && m.id === id) {
          const p = m.products;
          parsed = {
            id: m.id,
            order_no: `REC-${new Date(m.created_at).toISOString().slice(2, 7).replace('-', '')}-${m.id.slice(0, 4).toUpperCase()}`,
            order_date: new Date(m.created_at).toISOString().slice(0, 10),
            customer_name: 'ลูกค้าทั่วไป (Walk-in)',
            channel: 'WALK_IN',
            items: p
              ? [
                  {
                    product_id: p.id,
                    sku: p.sku,
                    name: p.name,
                    stone_type: p.stone_type,
                    unit_price: Number(p.selling_price) || 0,
                    cost_price: Number(p.cost_price) || 0,
                    qty: 1,
                    weight_grams: p.weight_grams,
                    r2_thumbnail_url: p.r2_thumbnail_url,
                  },
                ]
              : [],
            subtotal: Number(p?.selling_price) || 0,
            discount: 0,
            shipping_fee: 0,
            total_amount: Number(p?.selling_price) || 0,
            total_cost: Number(p?.cost_price) || 0,
            profit: (Number(p?.selling_price) || 0) - (Number(p?.cost_price) || 0),
            payment_method: 'โอนเงิน',
            notes: m.note || null,
            status: 'PAID',
            created_at: m.created_at,
          };
        }

        const matchId = Boolean(id && ((parsed && parsed.id === id) || m.id === id));
        const matchOrderNo = Boolean(order_no && parsed && parsed.order_no === order_no);

        if (matchId || matchOrderNo) {
          const merged: Order = {
            ...(parsed || {}),
            ...updatePayload,
          };
          updatedOrder = merged;
          await supabaseAdmin
            .from('stock_movements')
            .update({ note: JSON.stringify(merged) })
            .eq('id', m.id);
        }
      } catch {
        // continue
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      updatedFields: updatePayload,
    });
  } catch (err: any) {
    console.error('Update order error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// DELETE: delete order and optionally restore stock
export async function DELETE(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const orderNo = searchParams.get('order_no');
    const restoreStock = searchParams.get('restoreStock') === 'true';

    if (!id && !orderNo) {
      return NextResponse.json({ error: 'Missing order ID or Order No' }, { status: 400 });
    }

    // 1. Attempt delete from orders table if exists
    try {
      if (id) {
        await supabaseAdmin.from('orders').delete().eq('id', id);
      }
      if (orderNo) {
        await supabaseAdmin.from('orders').delete().eq('order_no', orderNo);
      }
    } catch {
      // Ignore if orders table does not exist
    }

    // 2. Delete corresponding stock_movements
    const { data: movements } = await supabaseAdmin
      .from('stock_movements')
      .select('*')
      .eq('reason', 'SOLD');

    let deletedCount = 0;

    for (const m of movements || []) {
      try {
        let isMatch = false;

        // Direct movement id match (e.g. synthetic order from status change)
        if (id && m.id === id) {
          isMatch = true;
        }

        // Substring check in note
        if (!isMatch && id && m.note && m.note.includes(id)) {
          isMatch = true;
        }
        if (!isMatch && orderNo && m.note && m.note.includes(orderNo)) {
          isMatch = true;
        }

        // JSON parse check
        if (!isMatch && m.note && m.note.startsWith('{')) {
          try {
            const parsed = JSON.parse(m.note);
            if (
              (id && (parsed.id === id || parsed.order_no === id)) ||
              (orderNo && (parsed.order_no === orderNo || parsed.id === orderNo))
            ) {
              isMatch = true;
            }
          } catch {
            // ignore
          }
        }

        // Check if synthetic REC order_no generated for this m matches orderNo
        if (!isMatch && orderNo) {
          const syntheticOrderNo = `REC-${new Date(m.created_at).toISOString().slice(2, 7).replace('-', '')}-${m.id.slice(0, 4).toUpperCase()}`;
          if (syntheticOrderNo === orderNo) {
            isMatch = true;
          }
        }

        if (isMatch) {
          if (restoreStock && m.product_id) {
            // Restore product stock to AVAILABLE
            const { data: curP } = await supabaseAdmin
              .from('products')
              .select('id, qty_on_hand')
              .eq('id', m.product_id)
              .single();

            const currentQty = curP?.qty_on_hand ?? 0;
            const addQty = Math.abs(m.change_qty || 1);
            const restoredQty = currentQty + addQty;

            await supabaseAdmin
              .from('products')
              .update({
                status: 'AVAILABLE',
                qty_on_hand: restoredQty,
                updated_at: new Date().toISOString(),
              })
              .eq('id', m.product_id);
          }

          const { error: delErr } = await supabaseAdmin
            .from('stock_movements')
            .delete()
            .eq('id', m.id);

          if (!delErr) {
            deletedCount++;
          } else {
            console.error('Failed to delete stock_movement:', m.id, delErr);
          }
        }
      } catch (innerErr) {
        console.error('Error processing movement delete:', m.id, innerErr);
      }
    }

    return NextResponse.json({
      success: true,
      deletedId: id,
      deletedOrderNo: orderNo,
      deletedMovementsCount: deletedCount,
    });
  } catch (err: any) {
    console.error('Delete order error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
