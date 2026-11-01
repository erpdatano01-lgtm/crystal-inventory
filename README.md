# 💎 Crystal & Mineral Inventory + Expense Management System

ระบบบริหารจัดการสต็อกร้านหินสวยงาม คริสตัล แร่ธรรมชาติ และระบบบันทึกค่าใช้จ่าย พัฒนาด้วย Next.js (App Router), TypeScript, Tailwind CSS, Supabase และ Cloudflare R2 พร้อมระบบบีบอัดภาพ Client-Side เป็น `.webp` อัตโนมัติ

---

## 🗄️ Database Schema (ตรงตามโครงสร้าง Supabase 100%)

### 1. `expenses`
- `id` (UUID Primary Key)
- `expense_date` (DATE)
- `category` ('STOCK_LOT', 'PACKAGING', 'SHIPPING', 'BOOTH_MARKETING', 'OTHER')
- `title` (TEXT)
- `vendor_name` (TEXT)
- `total_amount` (NUMERIC)
- `payment_method` (TEXT)
- `r2_receipt_url` (TEXT)
- `drive_doc_url` (TEXT)
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ)

### 2. `stock_lots`
- `id` (UUID Primary Key)
- `lot_code` (TEXT UNIQUE, เช่น `LOT-202611-01`)
- `expense_id` (UUID foreign key -> `expenses.id`)
- `total_cost` (NUMERIC)
- `total_weight_grams` (NUMERIC)
- `item_count` (INT)
- `drive_lot_folder_url` (TEXT)
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ)

### 3. `products`
- `id` (UUID Primary Key)
- `sku` (TEXT UNIQUE, เช่น `CRYS-AME-001`)
- `lot_id` (UUID foreign key -> `stock_lots.id`)
- `name` (TEXT)
- `stone_type` (TEXT)
- `item_type` ('UNIQUE' หรือ 'BULK')
- `weight_grams` (NUMERIC)
- `dimensions` (TEXT)
- `grade_origin` (TEXT)
- `cost_price` (NUMERIC)
- `selling_price` (NUMERIC)
- `min_price` (NUMERIC)
- `qty_on_hand` (INT)
- `status` ('IN_TRANSIT', 'PREP', 'AVAILABLE', 'RESERVED', 'SOLD')
- `r2_thumbnail_url` (TEXT)
- `r2_gallery_urls` (JSONB)
- `drive_media_folder_url` (TEXT)
- `drive_video_url` (TEXT)
- `storage_location` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 4. `stock_movements`
- `id` (UUID Primary Key)
- `product_id` (UUID foreign key -> `products.id`)
- `change_qty` (INT)
- `reason` ('INITIAL_STOCK', 'SOLD', 'DAMAGED', 'CRAFT_USE')
- `note` (TEXT)
- `created_at` (TIMESTAMPTZ)

---

## 🚀 ฟีเจอร์และหน้าเพจหลัก (Core Features & Routes)

### A. API Route สำหรับอัปโหลดไฟล์ขึ้น Cloudflare R2 (`/api/upload`)
- รับไฟล์ภาพและพารามิเตอร์ `folder` (`'receipts'` หรือ `'products'`) และ `sku` (optional)
- อัปโหลดเข้า Cloudflare R2 Bucket ตาม Path โฟลเดอร์:
  - `receipts/2026-11/filename.webp`
  - `products/SKU/filename.webp`
- คืนค่าเป็น Public URL (`${NEXT_PUBLIC_R2_PUBLIC_URL}/...`)

### B. หน้า Dashboard ภาพรวม (`/`)
- การ์ดสรุปยอด 4 ค่าสำคัญ:
  1. ยอดค่าใช้จ่ายรวมเดือนนี้
  2. จำนวนหินที่พร้อมขาย (`AVAILABLE`)
  3. มูลค่าต้นทุนสต็อกคงเหลือรวม
  4. มูลค่าราคาขายรวม
- ปุ่มลัดขนาดใหญ่:
  - `+ บันทึกบิลค่าใช้จ่าย` (ไปหน้า `/expenses`)
  - `+ เพิ่มหินเข้าสต็อก` (ไปหน้า `/products/new`)
- แสดงรายการสินค้าล่าสุด และล็อตหินนำเข้าที่กำลังเปิดอยู่

### C. หน้าบันทึกค่าใช้จ่าย & เปิดล็อตหิน (`/expenses`)
- แสดงรายการค่าใช้จ่ายล่าสุด พร้อมปุ่มดูรูปสลิป R2 WebP ใน Lightbox และลิงก์เอกสาร Google Drive
- ฟอร์มเพิ่มค่าใช้จ่าย:
  - ถ่ายรูป/อัปโหลดสลิป ย่อขนาดเป็น WebP ส่งเข้า R2 folder `'receipts'` อัตโนมัติ
  - **ฟีเจอร์พิเศษ:** หากเลือกหมวดหมู่เป็น `STOCK_LOT` จะมี Checkbox *"สร้างรหัส Lot สินค้าอัตโนมัติ"* ให้กรอกรหัส Lot (เช่น `LOT-202611-01`), น้ำหนักรวม (กรัม) และลิงก์โฟลเดอร์ Google Drive แล้วบันทึกลงตาราง `expenses` และ `stock_lots` พร้อมกันทันที

### D. หน้ารับหินเข้าสต็อก (`/products/new`)
- เลือก `lot_id` จาก Dropdown (ดึงจากตาราง `stock_lots` พร้อมโชว์ต้นทุนรวมของล็อตนั้นให้อ้างอิง)
- ระบบช่วย Generate รหัส `sku` อัตโนมัติตามชนิดหิน เช่น เลือก Amethyst -> `CRYS-AME-001`, Citrine -> `CRYS-CIT-001` (เช็กรหัสล่าสุดจากฐานข้อมูล)
- ฟอร์มครบถ้วน: ชื่อ, ชนิดหิน, ประเภท (`UNIQUE` / `BULK`), น้ำหนัก, ขนาด, เกรด/แหล่งที่มา, ราคาทุน, ราคาขาย, ราคาต่ำสุดที่ลดได้ (`min_price`), ที่เก็บ (`storage_location`)
- อัปโหลดรูปหน้าปกขึ้น R2 folder `products/[SKU]/`
- วางลิงก์คลิปวิดีโอจาก Google Drive (`drive_video_url`)
- **เมื่อกดบันทึก:** สร้างข้อมูลใน `products` และบันทึกประวัติลง `stock_movements` (reason: `'INITIAL_STOCK'`) อัตโนมัติ

### E. หน้าคลังสินค้า & ค้นหาหน้าร้าน (`/products`)
- สลับมุมมองได้ทั้งแบบ **Grid การ์ดรูปภาพใหญ่** และแบบ **Table**
- ค้นหา Search ตาม SKU, ชื่อหิน, ชนิดแร่, ที่เก็บ และ Filter ตาม `status` และ `lot_id`
- **ปุ่ม Toggle "โหมดเปิดให้ลูกค้าดู (Customer View)":** กดเปิดปุ๊บ จะทำการ **ซ่อน `cost_price` (ราคาทุน) และ `min_price` (ราคาต่ำสุด) ทั้งหมดทันที** เหมาะสำหรับถือแท็บเล็ต/มือถือหันจอให้ลูกค้าดูหน้าร้าน
- ปุ่ม **"Copy ลิงก์วิดีโอ (Google Drive)"** กดแล้วคัดลอก `drive_video_url` ลง Clipboard ทันทีพร้อม Toast แจ้งเตือน
- ปุ่มเปลี่ยนสถานะด่วน (`AVAILABLE` -> `RESERVED` -> `SOLD`) โดยเมื่อเปลี่ยนเป็น `SOLD` จะตัด `qty_on_hand` และบันทึกลง `stock_movements` (reason: `'SOLD'`) ทันที

---

## 🛠️ การตั้งค่า Environment Variables

สร้างไฟล์ `.env.local` โดยคัดลอกจาก `.env.local.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=crystal-assets
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-xxxx.r2.dev
```

---

## 💻 วิธีการรันโปรเจกต์

```bash
# รัน Development Server
npm run dev

# บิลด์สำหรับ Production
npm run build
npm run start
```
เปิดเบราว์เซอร์ไปที่ `http://localhost:3000`
