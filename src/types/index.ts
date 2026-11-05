// ====================================================================
// EXACT DATABASE SCHEMA TYPES (Supabase tables: expenses, stock_lots, products, stock_movements)
// ====================================================================

export type ExpenseCategory =
  | 'STOCK_LOT'
  | 'PACKAGING'
  | 'SHIPPING'
  | 'BOOTH_MARKETING'
  | 'OTHER';

export interface Expense {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  title: string;
  vendor_name?: string | null;
  total_amount: number;
  payment_method?: string | null;
  r2_receipt_url?: string | null;
  drive_doc_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface StockLot {
  id: string;
  lot_code: string; // e.g. LOT-202611-01
  expense_id?: string | null;
  total_cost: number;
  total_weight_grams?: number | null;
  item_count?: number | null;
  drive_lot_folder_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export type ItemType = 'UNIQUE' | 'BULK';

export type ProductStatus =
  | 'IN_TRANSIT'
  | 'PREP'
  | 'AVAILABLE'
  | 'RESERVED'
  | 'SOLD';

export interface Product {
  id: string;
  sku: string; // e.g. CRYS-AME-001
  lot_id?: string | null;
  name: string;
  stone_type: string;
  item_type: ItemType;
  weight_grams?: number | null;
  dimensions?: string | null;
  grade_origin?: string | null;
  cost_price: number;
  selling_price: number;
  min_price?: number | null;
  qty_on_hand: number;
  status: ProductStatus;
  r2_thumbnail_url?: string | null;
  r2_gallery_urls?: string[] | null; // jsonb
  drive_media_folder_url?: string | null;
  drive_video_url?: string | null;
  storage_location?: string | null;
  created_at: string;
  updated_at?: string;
}

export type MovementReason =
  | 'INITIAL_STOCK'
  | 'SOLD'
  | 'DAMAGED'
  | 'CRAFT_USE';

export interface StockMovement {
  id: string;
  product_id: string;
  change_qty: number;
  reason: MovementReason;
  note?: string | null;
  created_at: string;
}

// ====================================================================
// SALES ORDERS & INVOICES (FlowAccount-style Billing & Accounting)
// ====================================================================

export type OrderStatus = 'PAID' | 'WAITING_PAYMENT' | 'SHIPPED' | 'CANCELLED';

export type SalesChannel =
  | 'WALK_IN'
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'TIKTOK'
  | 'LINE'
  | 'SHOPEE'
  | 'OTHER';

export interface OrderItem {
  product_id: string;
  sku: string;
  name: string;
  stone_type: string;
  unit_price: number;
  cost_price: number;
  qty: number;
  weight_grams?: number | null;
  r2_thumbnail_url?: string | null;
}

export interface Order {
  id: string;
  order_no: string; // e.g. INV-202611-001
  order_date: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_address?: string | null;
  channel: SalesChannel;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping_fee: number;
  total_amount: number;
  total_cost: number;
  profit: number;
  payment_method: string;
  slip_url?: string | null;
  tracking_no?: string | null;
  notes?: string | null;
  status: OrderStatus;
  created_at: string;
}

export const SALES_CHANNELS_CONFIG: Record<
  SalesChannel,
  { label: string; badgeClass: string }
> = {
  WALK_IN: { label: 'หน้าร้าน (Walk-in)', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  FACEBOOK: { label: 'Facebook Live/Chat', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  INSTAGRAM: { label: 'Instagram (IG Direct)', badgeClass: 'bg-pink-50 text-pink-700 border-pink-200' },
  TIKTOK: { label: 'TikTok Shop/Live', badgeClass: 'bg-slate-900 text-white border-slate-700' },
  LINE: { label: 'LINE Official/MyShop', badgeClass: 'bg-green-50 text-green-700 border-green-200' },
  SHOPEE: { label: 'Shopee/Lazada', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  OTHER: { label: 'ช่องทางอื่นๆ', badgeClass: 'bg-gray-50 text-gray-700 border-gray-200' },
};

export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; badgeClass: string }
> = {
  PAID: { label: 'ชำระเงินแล้ว (Paid)', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  WAITING_PAYMENT: { label: 'รอชำระเงิน (Unpaid)', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' },
  SHIPPED: { label: 'จัดส่งแล้ว (Shipped)', badgeClass: 'bg-blue-100 text-blue-800 border-blue-300' },
  CANCELLED: { label: 'ยกเลิก (Cancelled)', badgeClass: 'bg-slate-100 text-slate-600 border-slate-300' },
};

// Master metadata helpers
export const STONE_TYPES = [
  { id: 'Amethyst', code: 'AME', label: 'Amethyst (อเมทิสต์)' },
  { id: 'Citrine', code: 'CIT', label: 'Citrine (ซิทริน)' },
  { id: 'Clear Quartz', code: 'QUA', label: 'Clear Quartz (เขี้ยวหนุมาน/ควอตซ์ใส)' },
  { id: 'Rose Quartz', code: 'ROQ', label: 'Rose Quartz (โรสควอตซ์)' },
  { id: 'Smoky Quartz', code: 'SMQ', label: 'Smoky Quartz (สโมกกี้ควอตซ์)' },
  { id: 'Rutilated Quartz', code: 'RUT', label: 'Rutilated Quartz (ไหมทอง/ไหม 5 สี)' },
  { id: 'Moldavite', code: 'MOL', label: 'Moldavite (โมลดาไวต์/สะเก็ดดาวเขียว)' },
  { id: 'Labradorite', code: 'LAB', label: 'Labradorite (ลาบราดอไรต์)' },
  { id: 'Fluorite', code: 'FLU', label: 'Fluorite (ฟลูออไรต์)' },
  { id: 'Pyrite', code: 'PYR', label: 'Pyrite (ไพไรต์/แร่ดูดทรัพย์)' },
  { id: 'Malachite', code: 'MAL', label: 'Malachite (มาลาไคต์)' },
  { id: 'Black Tourmaline', code: 'TOU', label: 'Black Tourmaline (ทัวร์มาลีนดำ)' },
  { id: 'Moonstone', code: 'MOO', label: 'Moonstone (มูนสโตน)' },
  { id: 'Aquamarine', code: 'AQU', label: 'Aquamarine (อความารีน)' },
  { id: 'Lapis Lazuli', code: 'LAP', label: 'Lapis Lazuli (ลาพิส ลาซูลี)' },
  { id: 'Selenite', code: 'SEL', label: 'Selenite (เซเลไนต์)' },
  { id: 'Other', code: 'CRY', label: 'แร่/หินชนิดอื่นๆ (Other Mineral)' },
] as const;

export const EXPENSE_CATEGORIES_CONFIG: Record<
  ExpenseCategory,
  { label: string; color: string; badgeClass: string }
> = {
  STOCK_LOT: {
    label: 'ซื้อหินเข้าร้าน (Stock Lot)',
    color: '#8b5cf6',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  PACKAGING: {
    label: 'กล่องพัสดุ / บับเบิ้ล (Packaging)',
    color: '#f59e0b',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  SHIPPING: {
    label: 'ค่าขนส่ง / ค่าส่งของ (Shipping)',
    color: '#3b82f6',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  BOOTH_MARKETING: {
    label: 'ออกบูธ / ยิงแอดการตลาด (Marketing)',
    color: '#ec4899',
    badgeClass: 'bg-pink-100 text-pink-800 border-pink-200',
  },
  OTHER: {
    label: 'ค่าใช้จ่ายอื่นๆ (Other)',
    color: '#6b7280',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
  },
};

export const STATUS_CONFIG: Record<
  ProductStatus,
  { label: string; badgeClass: string }
> = {
  IN_TRANSIT: {
    label: 'กำลังขนส่ง (In Transit)',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  PREP: {
    label: 'กำลังเตรียมของ/ถ่ายรูป (Prep)',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  AVAILABLE: {
    label: 'พร้อมขาย (Available)',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold',
  },
  RESERVED: {
    label: 'ติดจอง (Reserved)',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  SOLD: {
    label: 'ขายแล้ว (Sold Out)',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-300',
  },
};
