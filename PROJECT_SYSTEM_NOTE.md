# 💎 Crystal & Mineral Management System - System Handover & Technical Note

> **บันทึกข้อมูลระบบฉบับสมบูรณ์ (Master Project & Handover Documentation)**  
> **อัปเดตล่าสุด:** 5 พฤศจิกายน 2026 (พ.ศ. 2569)  
> **จุดประสงค์:** ใช้เป็นคู่มือหลักในการส่งต่องาน บันทึกการตั้งค่า กุญแจ API ฐานข้อมูล โครงสร้างโค้ด และฟังก์ชันทั้งหมด เพื่อให้เจ้าของระบบ, ผู้พัฒนาใหม่ หรือ AI Assistant ตัวใดก็ตาม (รวมถึงเมื่อเปลี่ยนรหัส/สลับบัญชี Antigravity) สามารถอ่านและทำงานต่อได้ทันที 100% โดยไม่ต้องเริ่มใหม่

---

## 📌 สารบัญ (Table of Contents)
1. [ข้อมูลบริการคลาวด์และบัญชีที่เชื่อมต่อ (Connected Services & Credentials)](#1-ข้อมูลบริการคลาวด์และบัญชีที่เชื่อมต่อ)
2. [ตัวแปรสภาพแวดล้อม (Environment Variables - `.env.local`)](#2-ตัวแปรสภาพแวดล้อม-envlocal)
3. [โครงสร้างฐานข้อมูล (Supabase Database Schema)](#3-โครงสร้างฐานข้อมูล-supabase-database-schema)
4. [ระบบจัดเก็บรูปภาพ Cloudflare R2 (Object Storage)](#4-ระบบจัดเก็บรูปภาพ-cloudflare-r2)
5. [การเชื่อมต่อ Google Sheets Live Sync (`=IMPORTDATA`)](#5-การเชื่อมต่อ-google-sheets-live-sync)
6. [โครงสร้างระบบและหน้าเพจหลัก (System Routes & Workflows)](#6-โครงสร้างระบบและหน้าเพจหลัก)
7. [ระบบเปิดบิลขาย & บัญชีกำไร-ขาดทุน สไตล์ FlowAccount (`/orders`)](#7-ระบบเปิดบิลขาย--บัญชีกำไร-ขาดทุน)
8. [ระบบแก้ไข (Edit) และลบข้อมูลรายชิ้น (Delete)](#8-ระบบแก้ไข-edit-และลบข้อมูลรายชิ้น-delete)
9. [การติดตั้ง รัน Localhost และ Deploy ขึ้น Vercel](#9-การติดตั้ง-รัน-localhost-และ-deploy-ขึ้น-vercel)
10. [คำแนะนำเมื่อสลับบัญชี Antigravity หรือเปลี่ยนเครื่องทำงาน](#10-คำแนะนำเมื่อสลับบัญชี-antigravity-หรือเปลี่ยนเครื่องทำงาน)

---

## 1. ข้อมูลบริการคลาวด์และบัญชีที่เชื่อมต่อ

| บริการ | รายละเอียด | ค่าที่บันทึกไว้ / ลิงก์ |
| :--- | :--- | :--- |
| **GitHub Repository** | ที่เก็บซอร์สโค้ดหลัก | `https://github.com/erpdatano01-lgtm/crystal-inventory.git` (Branch: `main`) |
| **GitHub Access** | GitHub Classic Personal Access Token (PAT) ที่มีสิทธิ์ `repo` | `ghp_sMSQaAGGcOQiVK52JF3DZr8XX4amNg******` *(เก็บตัวเต็มไว้ใน `.env.local` / เครื่องผู้ใช้)* |
| **Vercel Project** | ระบบโฮสต์ Production | Project: `crystal-inventory` (`prj_l3tJv8syLJzLDVt0VUrfaH14K4JR`) |
| **Vercel Account** | ทีม / เจ้าของโปรเจกต์ | `erpdatano01-4530` / Team: `team_Z8vzDq2hAh9IqTQf0vslvH8E` |
| **Vercel Domain** | เว็บไซต์ออนไลน์ | `https://crystal-inventory.vercel.app` |
| **Vercel Node.js** | เวอร์ชัน Node.js ที่ต้องตั้งค่า | **Node.js 22.x** (ห้ามใช้ 20.x เนื่องจาก Vercel ปิดการรองรับ) |
| **Supabase** | ฐานข้อมูล PostgreSQL | Project Ref: `spqqfyurbfngazejpkit` <br> URL: `https://spqqfyurbfngazejpkit.supabase.co` |
| **Cloudflare R2** | ที่เก็บรูปภาพ WebP และสลิป | Bucket: `crystal-assets` <br> Public URL: `https://pub-711c228c01bd46028816ac394ae8af33.r2.dev` |

---

## 2. ตัวแปรสภาพแวดล้อม (`.env.local`)

ไฟล์นี้เก็บอยู่ที่ Root Directory ของโปรเจกต์ (`/Users/mookycrg/Downloads/Crystal /.env.local`):

```bash
# --- 1. Supabase (Database) ---
NEXT_PUBLIC_SUPABASE_URL=https://spqqfyurbfngazejpkit.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwcXFmeXVyYmZuZ2F6ZWpwa2l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MTg3NjMsImV4cCI6MjEwOTA5NDc2M30.yhTKlX8Xibf4zo3Xbth2BdmHBu5trOu0LvaQ2FJVS-U
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwcXFmeXVyYmZuZ2F6ZWpwa2l0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzUxODc2MywiZXhwIjoyMTA5MDk0NzYzfQ.aBK1TOXr5KAS7Mgq-cuuPDAwF_4rI-tGlw25wnkmErw

# --- 2. Cloudflare R2 (Storage S3-Compatible) ---
R2_ACCOUNT_ID=bffe749d6e3c585c1829db9943cf2c31
R2_ENDPOINT=https://bffe749d6e3c585c1829db9943cf2c31.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=2f478185888ebb08d69c10b6e976aac3
R2_SECRET_ACCESS_KEY=bdfdc1d00080e211b1a08919b3bca62aab93d9a75eb55aadd30ad17f97f46f0c
R2_BUCKET_NAME=crystal-assets
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-711c228c01bd46028816ac394ae8af33.r2.dev
```

> **หมายเหตุสำหรับ Vercel Deployment:** ต้องคัดลอกตัวแปรทั้งหมดข้างต้นไปใส่ใน **Vercel Dashboard ➡️ Project Settings ➡️ Environment Variables** ด้วยเสมอ

---

## 3. โครงสร้างฐานข้อมูล (Supabase Database Schema)

ฐานข้อมูลประกอบด้วย 5 ตารางหลักที่เชื่อมโยงกันอย่างสมบูรณ์:

### 3.1 `expenses` (ตารางค่าใช้จ่ายและบิลนำเข้า)
- `id` (UUID Primary Key)
- `expense_date` (DATE เช่น `2026-11-05`)
- `category` (`STOCK_LOT`, `PACKAGING`, `SHIPPING`, `BOOTH_MARKETING`, `OTHER`)
- `title` (TEXT เช่น "สั่งซื้อหินล็อตนำเข้าบราซิล")
- `vendor_name` (TEXT)
- `total_amount` (NUMERIC)
- `payment_method` (TEXT)
- `r2_receipt_url` (TEXT - ลิงก์รูปสลิปบน R2)
- `drive_doc_url` (TEXT - ลิงก์เอกสาร Google Drive)
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ)

### 3.2 `stock_lots` (ตารางล็อตสินค้า)
- `id` (UUID Primary Key)
- `lot_code` (TEXT UNIQUE เช่น `LOT-202611-01`)
- `expense_id` (UUID foreign key -> `expenses.id`)
- `total_cost` (NUMERIC)
- `total_weight_grams` (NUMERIC)
- `item_count` (INT)
- `drive_lot_folder_url` (TEXT)
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ)

### 3.3 `products` (ตารางสินค้าหินและแร่)
- `id` (UUID Primary Key)
- `sku` (TEXT UNIQUE เช่น `CRYS-AME-001`)
- `lot_id` (UUID foreign key -> `stock_lots.id` - nullable)
- `name` (TEXT)
- `stone_type` (TEXT เช่น Amethyst, Citrine, Quartz)
- `item_type` (`UNIQUE` หรือ `BULK`)
- `weight_grams` (NUMERIC)
- `dimensions` (TEXT เช่น `4.5 x 3.2 x 2.0 cm`)
- `grade_origin` (TEXT เช่น `Natural Grade A, Brazil`)
- `cost_price` (NUMERIC)
- `selling_price` (NUMERIC)
- `min_price` (NUMERIC - ราคาต่ำสุดที่ยอมขายได้)
- `qty_on_hand` (INT - จำนวนคงเหลือ)
- `status` (`IN_TRANSIT`, `PREP`, `AVAILABLE`, `RESERVED`, `SOLD`)
- `r2_thumbnail_url` (TEXT - รูปภาพหน้าปก WebP)
- `r2_gallery_urls` (JSONB - อาเรย์รูปภาพเพิ่มเติม)
- `drive_media_folder_url` (TEXT)
- `drive_video_url` (TEXT - ลิงก์คลิปวิดีโอจาก Drive)
- `storage_location` (TEXT เช่น ตู้โชว์ A2)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 3.4 `stock_movements` (ประวัติการเคลื่อนไหวสต็อก)
- `id` (UUID Primary Key)
- `product_id` (UUID foreign key -> `products.id`)
- `change_qty` (INT เช่น `+1` หรือ `-1`)
- `reason` (`INITIAL_STOCK`, `SOLD`, `DAMAGED`, `CRAFT_USE`, `ADJUSTMENT`)
- `note` (TEXT - บันทึกรายละเอียดเลขบิลออเดอร์ในรูปแบบ JSON เมื่อขาย)
- `created_at` (TIMESTAMPTZ)

### 3.5 `orders` (ตารางคำสั่งซื้อและบิลขาย)
- `id` (UUID Primary Key)
- `order_no` (TEXT UNIQUE เช่น `INV-20261105-0001`)
- `customer_name` (TEXT)
- `customer_phone` (TEXT)
- `customer_address` (TEXT)
- `channel` (`FACEBOOK`, `LINE`, `TIKTOK`, `SHOPEE`, `WALK_IN`, `WEBSITE`, `OTHER`)
- `status` (`PENDING`, `PAID`, `SHIPPED`, `CANCELLED`)
- `payment_method` (TEXT)
- `tracking_no` (TEXT)
- `subtotal` (NUMERIC)
- `discount` (NUMERIC)
- `shipping_fee` (NUMERIC)
- `total_amount` (NUMERIC)
- `total_cost` (NUMERIC - ต้นทุนรวมคำนวณจาก COGS)
- `order_slip_urls` (JSONB - สลิปหลักฐานการโอนเงินบน R2)
- `items` (JSONB - รายการสินค้าในบิล: `{ product_id, sku, name, qty, price, cost }`)
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ)

---

## 4. ระบบจัดเก็บรูปภาพ Cloudflare R2

- **Client-Side Compression:** ก่อนอัปโหลดทุกครั้ง เบราว์เซอร์จะแปลงไฟล์ภาพทุกสกุล (JPEG, PNG, HEIC) ให้เป็น `.webp` โดยอัตโนมัติ เพื่อประหยัดพื้นที่และโหลดไว
- **โครงสร้างโฟลเดอร์ใน Bucket (`crystal-assets`):**
  - `products/[SKU]/...webp` : รูปถ่ายสินค้าและแกลเลอรี
  - `receipts/YYYY-MM/...webp` : สลิปใบเสร็จค่าใช้จ่าย
  - `orders/YYYY-MM/...webp` : สลิปการโอนเงินของลูกค้า
- **API Endpoint สำหรับอัปโหลด:** `POST /api/upload` (รับ FormData: `file`, `folder`, `sku`)
- **การเข้าถึงภาพสาธารณะ:** ผ่าน URL `https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/[path]`

---

## 5. การเชื่อมต่อ Google Sheets Live Sync

ระบบมี Data Feed เป็น CSV UTF-8 พร้อม BOM รองรับภาษาไทยบน Google Sheets 100%:

1. **ดึงข้อมูลสินค้าและสต็อกทั้งหมด:**
   ```excel
   =IMPORTDATA("https://crystal-inventory.vercel.app/api/export/products")
   ```
   *(หรือใช้ `http://localhost:3000/api/export/products` เมื่อทดสอบในเครื่อง)*
   - ฟิลด์ที่ดึง: SKU, ชื่อสินค้า, ชนิดหิน, สถานะ, จำนวน, ราคาทุน, ราคาขาย, กำไรคาดการณ์, มาร์จิ้น %, รูปภาพ R2, ลิงก์ Drive

2. **ดึงข้อมูลค่าใช้จ่ายและล็อตทั้งหมด:**
   ```excel
   =IMPORTDATA("https://crystal-inventory.vercel.app/api/export/expenses")
   ```
   - ฟิลด์ที่ดึง: วันที่, หมวดหมู่, รายการ, ผู้ขาย/ร้านค้า, ยอดเงิน, วิธีชำระเงิน, รหัส Lot, น้ำหนัก (กรัม), สลิป R2, ลิงก์ Drive

---

## 6. โครงสร้างระบบและหน้าเพจหลัก

| เส้นทาง (Route) | ไฟล์ต้นฉบับ | คำอธิบายการทำงาน |
| :--- | :--- | :--- |
| `/` | `src/app/page.tsx` | แดชบอร์ดภาพรวม: สรุปค่าใช้จ่ายเดือนนี้, หินพร้อมขาย, ต้นทุนคงเหลือ, ราคาขายรวม, 3 ปุ่มทางลัด |
| `/products` | `src/app/products/page.tsx` | คลังสินค้า: ค้นหา, กรองตามชนิดหิน/สถานะ, สลับโหมด Card/Table, ป้ายกำกับสต็อก, ปุ่มลบเดี่ยว และปุ่มล้างข้อมูล |
| `/products/new` | `src/app/products/new/page.tsx` | ฟอร์มรับหินเข้าสต็อก: เจนเนอเรตรหัส SKU อัตโนมัติ, ผูกล็อต, อัปรูป WebP, แนบวิดีโอ Drive |
| `/expenses` | `src/app/expenses/page.tsx` | บันทึกรายจ่าย & ล็อต: แนบสลิปเข้า R2, เปิดรหัส Lot อัตโนมัติ, ตารางสรุปรายจ่าย, ปุ่มลบเดี่ยว และปุ่มล้างข้อมูล |
| `/orders` | `src/app/orders/page.tsx` | **ระบบเปิดบิล & บัญชี FlowAccount:** เปิดบิลขาย, ตัดสต็อก, พิมพ์ใบเสร็จ A4, แดชบอร์ด P&L |
| `/api/upload` | `src/app/api/upload/route.ts` | Backend R2 Upload Gateway รองรับบีบอัดและคืน Public URL |
| `/api/orders` | `src/app/api/orders/route.ts` | API จัดการบิลขาย, ตัดสต็อกหินเป็น `SOLD`, และคืนสต็อกเมื่อยกเลิก |
| `/api/reset-data` | `src/app/api/reset-data/route.ts` | API ล้างข้อมูลทดสอบ (สินค้า, ค่าใช้จ่าย หรือทั้งหมด) |
| `/api/export/*` | `src/app/api/export/` | API ส่งออกข้อมูลสดเข้า Google Sheets |

---

## 7. ระบบเปิดบิลขาย & บัญชีกำไร-ขาดทุน

พัฒนาตามรูปแบบมาตรฐาน FlowAccount:
1. **Flow การขาย:**
   - กดปุ่ม **"+ เปิดบิลขายใหม่"**
   - เลือกลิสต์สินค้าจากสต็อก (ระบบกรองเฉพาะชิ้นที่สถานะเป็น `AVAILABLE` และคงเหลือ > 0 เท่านั้น)
   - กรอกข้อมูลลูกค้า, เลือกช่องทางการขาย (Facebook, LINE, TikTok, Shopee, Walk-in, Website)
   - เลือกระบบชำระเงิน และอัปโหลดสลิปเงินโอนเข้า R2
   - ใส่ส่วนลดและค่าจัดส่ง ระบบคำนวณยอดรวมสุทธิและต้นทุนขายให้อัตโนมัติ
2. **การตัดสต็อกอัตโนมัติ:**
   - เมื่อสร้างออเดอร์สำเร็จ สินค้าจะเปลี่ยนสถานะเป็น `SOLD` ทันที ป้องกันการขายซ้ำ
   - บันทึกประวัติใน `stock_movements` ด้วยรหัสเหตุผล `SOLD` พร้อมแนบ JSON รายละเอียดบิล
3. **การพิมพ์ใบเสร็จ (A4 Printable Receipt Modal):**
   - ทุกออเดอร์มีปุ่ม **"🖨️ พิมพ์ใบเสร็จ"**
   - ฟอร์ม A4 พร้อมโลโก้ร้าน, รายละเอียดภาษี/ผู้ซื้อ, ตารางสินค้า, ส่วนลด, ค่าส่ง, ยอดรวม และช่องลงนาม
   - สั่งพิมพ์ หรือบันทึกเป็น PDF ส่งให้ลูกค้าในแชทได้ทันที
4. **สรุปบัญชี P&L (5 Cards):**
   - **ยอดขายรวม (Total Revenue)**
   - **ต้นทุนขายจริง (Cost of Goods Sold - COGS)**
   - **กำไรขั้นต้น (Gross Profit) & มาร์จิ้น %**
   - **ค่าใช้จ่ายดำเนินงาน (Operating Expenses จากหน้า Expenses)**
   - **กำไรสุทธิจริง (Net Profit)**

---

## 8. ระบบแก้ไข (Edit) และลบข้อมูลรายชิ้น (Delete)

- **ระบบแก้ไขข้อมูล (Edit Modal):**
  - **สินค้า (`/products`):** มีปุ่มดินสอสีน้ำเงิน ✏️ ที่การ์ดสินค้า, แถวตาราง, และใน Modal ดูรายละเอียด สามารถกดแก้ไข ชื่อสินค้า, ชนิดหิน, น้ำหนัก, ขนาด, เกรด, ที่เก็บ, ราคาทุน, ราคาขาย, ราคาต่ำสุดที่ลดได้, จำนวนคงเหลือ และลิงก์คลิปวิดีโอ Drive ได้ทันที
  - **ค่าใช้จ่าย (`/expenses`):** มีปุ่มดินสอสีน้ำเงิน ✏️ ในแถวตาราง สามารถกดแก้ไข วันที่, หมวดหมู่, ชื่อรายการ, จำนวนเงิน, ร้านค้า/ผู้ขาย, วิธีชำระเงิน, ลิงก์ Drive และหมายเหตุได้ทันที
- **ระบบลบข้อมูลเดี่ยว (Delete Single Item):**
  - มีปุ่มถังขยะสีแดง 🗑️ สำหรับลบทีละชิ้นพร้อมระบบแจ้งเตือนยืนยัน (Confirmation Dialog)
- **ความปลอดภัยของข้อมูล:**
  - นำปุ่ม "ล้างข้อมูลทดสอบทั้งหมด" ออกจากหน้าจอ UI แล้ว เพื่อป้องกันการเผลอกดลบสต็อกสินค้าจริงโดยไม่ตั้งใจ

---

## 9. การติดตั้ง รัน Localhost และ Deploy ขึ้น Vercel

### การรันบนเครื่อง Localhost:
```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. รัน Dev Server
npm run dev

# 3. เปิดเบราว์เซอร์
http://localhost:3000
```

### การ Deploy ขึ้น GitHub & Vercel:
```bash
# ตรวจสอบสถานะและ Commit งาน
git add .
git commit -m "คำอธิบายสิ่งที่แก้ไข"

# Push ขึ้น GitHub (ใช้ Classic PAT หรือ Git Credential)
git push https://<GITHUB_PAT>@github.com/erpdatano01-lgtm/crystal-inventory.git main:main
```

### การตั้งค่าที่สำคัญบน Vercel Dashboard:
1. เข้าไปที่โปรเจกต์ `crystal-inventory`
2. ไปที่ **Settings ➡️ General ➡️ Node.js Version**
3. เลือกเป็น **22.x** แล้วกด **Save**
4. ไปที่ **Settings ➡️ Environment Variables** ตรวจสอบว่าคัดลอกค่าจาก `.env.local` ครบทุกตัว
5. ไปที่แท็บ **Deployments** แล้วกด **Redeploy**

---

## 10. คำแนะนำเมื่อสลับบัญชี Antigravity หรือเปลี่ยนเครื่องทำงาน

เมื่อคุณต้องการเปลี่ยนรหัสผ่าน, ย้ายเครื่องคอมพิวเตอร์ หรือให้ AI ตัวใหม่เข้ามาดูแลโปรเจกต์นี้:
1. **คัดลอกโฟลเดอร์โปรเจกต์** หรือ Clone จาก GitHub:
   ```bash
   git clone https://github.com/erpdatano01-lgtm/crystal-inventory.git
   ```
2. **สร้างไฟล์ `.env.local`** ที่รูทโฟลเดอร์ และคัดลอกค่าคอนฟิกจาก **หัวข้อที่ 2** ในเอกสารนี้ไปวาง
3. **รันคำสั่ง `npm install`** และ `npm run dev`
4. **หากเป็น AI Assistant ตัวใหม่:** เพียงบอก AI ว่า *"ให้อ่านไฟล์ `PROJECT_SYSTEM_NOTE.md` ก่อนเริ่มทำงาน"* AI จะเข้าใจภาพรวม สถาปัตยกรรม ฐานข้อมูล และสามารถพัฒนาต่อได้ทันทีโดยไม่มีข้อผิดพลาดครับ
