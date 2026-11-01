-- ====================================================================
-- Crystal & Mineral Inventory + Expense Management System Schema
-- Exact match with 4 tables: expenses, stock_lots, products, stock_movements
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL CHECK (category IN ('STOCK_LOT', 'PACKAGING', 'SHIPPING', 'BOOTH_MARKETING', 'OTHER')),
    title TEXT NOT NULL,
    vendor_name TEXT,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method TEXT,
    r2_receipt_url TEXT,
    drive_doc_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. STOCK LOTS
CREATE TABLE IF NOT EXISTS stock_lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lot_code TEXT NOT NULL UNIQUE,
    expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_weight_grams NUMERIC(10, 2),
    item_count INT DEFAULT 0,
    drive_lot_folder_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT NOT NULL UNIQUE,
    lot_id UUID REFERENCES stock_lots(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    stone_type TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('UNIQUE', 'BULK')),
    weight_grams NUMERIC(10, 2),
    dimensions TEXT,
    grade_origin TEXT,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    min_price NUMERIC(12, 2),
    qty_on_hand INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('IN_TRANSIT', 'PREP', 'AVAILABLE', 'RESERVED', 'SOLD')),
    r2_thumbnail_url TEXT,
    r2_gallery_urls JSONB DEFAULT '[]'::jsonb,
    drive_media_folder_url TEXT,
    drive_video_url TEXT,
    storage_location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. STOCK MOVEMENTS
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    change_qty INT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('INITIAL_STOCK', 'SOLD', 'DAMAGED', 'CRAFT_USE')),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_stock_lots_code ON stock_lots(lot_code);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_lot ON products(lot_id);
CREATE INDEX IF NOT EXISTS idx_products_stone ON products(stone_type);
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Allow anon public access for internal operations
CREATE POLICY "Allow public all expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all stock_lots" ON stock_lots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all stock_movements" ON stock_movements FOR ALL USING (true) WITH CHECK (true);

-- Updated at Trigger for products
CREATE OR REPLACE FUNCTION update_products_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS trigger_update_products_timestamp ON products;
CREATE TRIGGER trigger_update_products_timestamp
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE PROCEDURE update_products_timestamp();
