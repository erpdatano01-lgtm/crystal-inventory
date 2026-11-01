import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST() {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 503 });
  }

  try {
    // 1. Create an initial expense
    const { data: exp, error: expErr } = await supabaseAdmin
      .from('expenses')
      .insert([
        {
          expense_date: '2026-10-25',
          category: 'STOCK_LOT',
          title: 'นำเข้าก้อนแร่และผลึกหินล็อตเปิดร้าน (บราซิล & อุรุกวัย)',
          vendor_name: 'Minas Gerais Gems Co.',
          total_amount: 32000.0,
          payment_method: 'โอนเงินต่างประเทศ (Wire Transfer)',
          r2_receipt_url:
            'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/products/CRYS-AME-001/thumb.webp',
          drive_doc_url: 'https://drive.google.com/drive/folders/sample-lot-invoice',
          notes: 'ล็อตแร่เกรด 5A นำเข้าล็อตแรกประจำร้าน',
        },
      ])
      .select()
      .single();

    if (expErr) throw expErr;

    // 2. Create Stock Lot
    const { data: lot, error: lotErr } = await supabaseAdmin
      .from('stock_lots')
      .insert([
        {
          lot_code: 'LOT-202611-01',
          expense_id: exp.id,
          total_cost: 32000.0,
          total_weight_grams: 4850.0,
          item_count: 5,
          drive_lot_folder_url: 'https://drive.google.com/drive/folders/sample-lot-folder',
          notes: 'ล็อตหินเปิดร้าน คัดดอกผลึกสวยพิเศษ',
        },
      ])
      .select()
      .single();

    if (lotErr) throw lotErr;

    // 3. Create Sample Products
    const sampleProducts = [
      {
        sku: 'CRYS-AME-001',
        lot_id: lot.id,
        name: 'Uruguay Amethyst Deep Purple Cluster (ผลึกอเมทิสต์แท้)',
        stone_type: 'Amethyst',
        item_type: 'UNIQUE',
        weight_grams: 485.5,
        dimensions: '9.5 x 7.2 x 6.8 cm',
        grade_origin: 'Top Gem (เกรดอัญมณี) / อุรุกวัย',
        cost_price: 1800.0,
        selling_price: 3600.0,
        min_price: 3200.0,
        qty_on_hand: 1,
        status: 'AVAILABLE',
        r2_thumbnail_url:
          'https://images.unsplash.com/photo-1598887142487-3c854d51d2c7?auto=format&fit=crop&w=800&q=80',
        drive_video_url: 'https://drive.google.com/file/d/1sampleVideoAmethyst/view',
        drive_media_folder_url: 'https://drive.google.com/drive/folders/sample-ame-001',
        storage_location: 'ตู้โชว์ A-01',
      },
      {
        sku: 'CRYS-CIT-001',
        lot_id: lot.id,
        name: 'Natural Citrine Crystal Point Tower (ซิทรินดิบธรรมชาติ)',
        stone_type: 'Citrine',
        item_type: 'UNIQUE',
        weight_grams: 210.0,
        dimensions: '4.5 x 3.8 x 11.2 cm',
        grade_origin: '5A High Grade / มาดากัสการ์',
        cost_price: 1600.0,
        selling_price: 3500.0,
        min_price: 3000.0,
        qty_on_hand: 1,
        status: 'AVAILABLE',
        r2_thumbnail_url:
          'https://images.unsplash.com/photo-1610444315220-4228965f7253?auto=format&fit=crop&w=800&q=80',
        drive_video_url: 'https://drive.google.com/file/d/1sampleVideoCitrine/view',
        drive_media_folder_url: 'https://drive.google.com/drive/folders/sample-cit-001',
        storage_location: 'ตู้โชว์ VIP-2',
      },
      {
        sku: 'CRYS-MOL-001',
        lot_id: null,
        name: 'Authentic Moldavite Specimen (อุลกมณีสะเก็ดดาวเขียวแท้)',
        stone_type: 'Moldavite',
        item_type: 'UNIQUE',
        weight_grams: 8.6,
        dimensions: '2.8 x 1.9 x 0.9 cm',
        grade_origin: 'Top Gem / สาธารณรัฐเช็ก',
        cost_price: 4500.0,
        selling_price: 8900.0,
        min_price: 8200.0,
        qty_on_hand: 1,
        status: 'RESERVED',
        r2_thumbnail_url:
          'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
        drive_video_url: 'https://drive.google.com/file/d/1sampleVideoMoldavite/view',
        drive_media_folder_url: 'https://drive.google.com/drive/folders/sample-moldavite',
        storage_location: 'เซฟกล่อง S-01',
      },
      {
        sku: 'CRYS-RUT-001',
        lot_id: lot.id,
        name: 'Golden Rutilated Quartz Sphere 58mm (ลูกแก้วไหมทองน้ำใส)',
        stone_type: 'Rutilated Quartz',
        item_type: 'UNIQUE',
        weight_grams: 320.0,
        dimensions: 'เส้นผ่านศูนย์กลาง 58 mm',
        grade_origin: '5A ไหมทองแคทอาย / บราซิล',
        cost_price: 2600.0,
        selling_price: 5900.0,
        min_price: 5200.0,
        qty_on_hand: 0,
        status: 'SOLD',
        r2_thumbnail_url:
          'https://images.unsplash.com/photo-1567225557594-88d73e55f2cb?auto=format&fit=crop&w=800&q=80',
        drive_video_url: 'https://drive.google.com/file/d/1sampleVideoRutile/view',
        drive_media_folder_url: null,
        storage_location: 'ตู้โชว์ A-02',
      },
      {
        sku: 'CRYS-PYR-001',
        lot_id: null,
        name: 'Peru Pyrite Cubic Cluster (แร่ไพไรต์ดูดทรัพย์)',
        stone_type: 'Pyrite',
        item_type: 'UNIQUE',
        weight_grams: 620.0,
        dimensions: '8.5 x 6.5 x 5.0 cm',
        grade_origin: '4A คิวบิกเงาวาว / เปรู',
        cost_price: 950.0,
        selling_price: 2200.0,
        min_price: 1900.0,
        qty_on_hand: 1,
        status: 'AVAILABLE',
        r2_thumbnail_url:
          'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
        drive_video_url: null,
        drive_media_folder_url: null,
        storage_location: 'ชั้น C-3',
      },
    ];

    const { data: insertedProds, error: pErr } = await supabaseAdmin
      .from('products')
      .upsert(sampleProducts, { onConflict: 'sku' })
      .select();

    if (pErr) throw pErr;

    // 4. Create movements
    if (insertedProds && insertedProds.length > 0) {
      const movements = insertedProds.map((p) => ({
        product_id: p.id,
        change_qty: p.qty_on_hand,
        reason: 'INITIAL_STOCK',
        note: 'บันทึกรับเข้าสต็อกข้อมูลเริ่มต้น',
      }));
      await supabaseAdmin.from('stock_movements').insert(movements);
    }

    return NextResponse.json({
      success: true,
      message: 'Seed data inserted into Supabase successfully',
      productsCount: insertedProds?.length || 0,
    });
  } catch (err: any) {
    console.error('Seed error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
