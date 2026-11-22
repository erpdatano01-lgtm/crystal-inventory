'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { fetchProducts, isNonStoneFreebie, formatUnitCost } from '@/lib/inventoryService';
import { Product, ProductStatus } from '@/types';
import {
  Gift,
  PackageCheck,
  Search,
  LayoutGrid,
  List,
  Sparkles,
  DollarSign,
  Plus,
  Minus,
  Eye,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  ArrowRight,
  Save,
  Receipt,
  FileText,
} from 'lucide-react';

interface FreebieOrder {
  id: string;
  orderNumber: number;
  title: string;
  shortTitle: string;
  amount: number;
  itemCount: number;
  files: string;
  vendor: string;
  receiptUrls: string[];
  skus: string[];
}

const FREEBIE_ORDERS: FreebieOrder[] = [
  {
    id: 'ORDER-1',
    orderNumber: 1,
    title: 'ของแถมคริสต์มาส & โมเดลแมว DIY (Shopee รวม 3 หน้า 1/3, 2/3, 3/3)',
    shortTitle: 'บิล 1: โมเดลแมว & คริสต์มาส DIY (฿981 • 20 ชิ้น)',
    amount: 981,
    itemCount: 20,
    files: 'File 25, 26, 27',
    vendor: 'Shopee (YunoShop, KKON, แมวญี่ปุ่น)',
    receiptUrls: [
      'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_25.jpg',
      'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_26.jpg',
      'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_27.jpg',
    ],
    skus: [
      'GIFT-SANTA-001', 'GIFT-SANTA-002', 'GIFT-SANTA-003', 'GIFT-SANTA-004', 'GIFT-SANTA-005',
      'GIFT-CAT-001', 'GIFT-CAT-002', 'GIFT-CAT-003', 'GIFT-CAT-004', 'GIFT-CAT-005',
      'GIFT-CAT-006', 'GIFT-CAT-007', 'GIFT-CAT-008', 'GIFT-CAT-009', 'GIFT-CAT-010',
      'GIFT-CAT-011', 'GIFT-CAT-012', 'GIFT-CAT-013', 'GIFT-CAT-014', 'GIFT-CAT-015',
    ],
  },
  {
    id: 'ORDER-2',
    orderNumber: 2,
    title: 'แม่เหล็กสโนว์แมน & ต้นคริสต์มาสหมี (Shopee รวม 2 หน้า 1/2, 2/2)',
    shortTitle: 'บิล 2: แม่เหล็กติดตู้เย็นคริสต์มาส (฿315 • 8 แบบ / 26 ชิ้น)',
    amount: 315,
    itemCount: 8,
    files: 'File 23, 24',
    vendor: 'Shopee (Guofu Studio)',
    receiptUrls: [
      'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_23.jpg',
      'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_24.jpg',
    ],
    skus: [
      'GIFT-MAG-001', 'GIFT-MAG-002', 'GIFT-MAG-003', 'GIFT-MAG-004',
      'GIFT-MAG-005', 'GIFT-MAG-006', 'GIFT-MAG-007', 'GIFT-MAG-008',
    ],
  },
  {
    id: 'ORDER-3',
    orderNumber: 3,
    title: 'ฟิกเกอร์โมเดลแมวจิ๋วเรซิ่น (NEKO HEAL JAI)',
    shortTitle: 'บิล 3: โมเดลแมวจิ๋วเรซิ่น NEKO (฿319 • 4 ชิ้น)',
    amount: 319,
    itemCount: 4,
    files: 'File 20',
    vendor: 'Shopee (NEKO HEAL JAI)',
    receiptUrls: [
      'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_20.jpg',
    ],
    skus: [
      'GIFT-NEKO-001', 'GIFT-NEKO-002', 'GIFT-NEKO-003', 'GIFT-NEKO-004',
    ],
  },
  {
    id: 'ORDER-4',
    orderNumber: 4,
    title: 'ถุงซีล 7x10 cm ลายคริสต์มาส (FDC Group 2 แพ็ค)',
    shortTitle: 'บิล 4: ถุงซีลคริสต์มาส 2 แพ็ค (฿57 • 200 ใบ)',
    amount: 57,
    itemCount: 2,
    files: 'File 28',
    vendor: 'Shopee (FDC Group)',
    receiptUrls: [
      'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_28.jpg',
    ],
    skus: [
      'GIFT-BAG-002', 'GIFT-BAG-003',
    ],
  },
  {
    id: 'ORDER-5',
    orderNumber: 5,
    title: 'ถุงฝากาวลายดอกไม้ 7x7 cm (EveryPack 1 แพ็ค 100 ใบ)',
    shortTitle: 'บิล 5: ถุงฝากาวลายดอกไม้ (฿18 • 100 ใบ)',
    amount: 18,
    itemCount: 1,
    files: 'File 22',
    vendor: 'Shopee (EveryPack)',
    receiptUrls: [
      'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_22.jpg',
    ],
    skus: [
      'GIFT-BAG-001',
    ],
  },
];

function getOrderForItem(sku: string): FreebieOrder | undefined {
  return FREEBIE_ORDERS.find((o) => o.skus.includes(sku));
}

export default function FreebiesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Active Order info
  const activeOrder = useMemo(
    () => FREEBIE_ORDERS.find((o) => o.id === selectedOrderId) || null,
    [selectedOrderId]
  );

  // Detail Modal
  const [activeModalItem, setActiveModalItem] = useState<Product | null>(null);

  // Edit Modal
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Updating quantity state
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchProducts();
        setProducts(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filter non-stone freebies and gift packaging items (Shopee models, magnets, bags, accessories)
  // Real stones belong in the Stone Warehouse (/products)
  const freebieList = useMemo(() => {
    return products.filter((p) => isNonStoneFreebie(p));
  }, [products]);

  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    freebieList.forEach((p) => {
      if (p.stone_type) set.add(p.stone_type);
    });
    return Array.from(set).sort();
  }, [freebieList]);

  // Filtered List
  const filteredList = useMemo(() => {
    return freebieList.filter((item) => {
      // Filter by Order (from Expenses)
      if (selectedOrderId !== 'ALL') {
        const order = FREEBIE_ORDERS.find((o) => o.id === selectedOrderId);
        if (order && !order.skus.includes(item.sku)) {
          return false;
        }
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSku = item.sku.toLowerCase().includes(q);
        const matchName = item.name.toLowerCase().includes(q);
        const matchCat = item.stone_type?.toLowerCase().includes(q) || false;
        if (!matchSku && !matchName && !matchCat) return false;
      }
      // Category
      if (selectedCategory !== 'ALL' && item.stone_type !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [freebieList, searchQuery, selectedCategory, selectedOrderId]);

  // Summary KPI metrics
  const totalUnits = useMemo(() => {
    return freebieList.reduce((sum, item) => sum + (Number(item.qty_on_hand) || 0), 0);
  }, [freebieList]);

  const totalCostValue = useMemo(() => {
    return freebieList.reduce(
      (sum, item) => sum + (Number(item.cost_price) || 0) * (Number(item.qty_on_hand) || 0),
      0
    );
  }, [freebieList]);

  const inStockCount = useMemo(() => {
    return freebieList.filter((item) => (Number(item.qty_on_hand) || 0) > 0).length;
  }, [freebieList]);

  // Quick Quantity Changer (+1 / -1) and sync AVAILABLE/SOLD status with /orders
  const handleQuickQtyChange = async (item: Product, delta: number) => {
    const newQty = Math.max(0, (Number(item.qty_on_hand) || 0) + delta);
    const nextStatus: ProductStatus = newQty === 0 ? 'SOLD' : 'AVAILABLE';
    setUpdatingId(item.id);
    try {
      const res = await fetch(`/api/products?id=${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty_on_hand: newQty, status: nextStatus }),
      });
      if (!res.ok) throw new Error('Update failed');
      setProducts((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, qty_on_hand: newQty, status: nextStatus } : p))
      );
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการปรับจำนวน: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const openEditModal = (item: Product) => {
    setEditingItem(item);
    setEditForm({
      sku: item.sku,
      name: item.name,
      stone_type: item.stone_type,
      cost_price: item.cost_price,
      qty_on_hand: item.qty_on_hand,
      storage_location: item.storage_location,
    });
    setActiveModalItem(null);
  };

  const handleEditSave = async () => {
    if (!editingItem) return;
    const safeCost = Math.max(0, Number(editForm.cost_price) || 0);
    const safeQty = Math.max(0, Number(editForm.qty_on_hand) || 0);
    const nextStatus: ProductStatus = safeQty === 0 ? 'SOLD' : 'AVAILABLE';
    const payload = {
      ...editForm,
      cost_price: safeCost,
      qty_on_hand: safeQty,
      status: nextStatus,
    };
    setIsSaving(true);
    try {
      const res = await fetch(`/api/products?id=${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Update failed');
      setProducts((prev) =>
        prev.map((p) => (p.id === editingItem.id ? { ...p, ...payload } : p))
      );
      setEditingItem(null);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-12 bg-slate-50 md:pl-64 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0">
      <Navbar />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        {/* Banner Header with Separation Notice */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-6 sm:p-7 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-xs">
              <Gift className="w-3.5 h-3.5" />
              <span>คลังเฉพาะของแถม & บรรจุภัณฑ์ (แยกต่างหากจากคลังหิน)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              คลังสต็อกของแถม & ซองแพ็คเกจจิ้ง (Freebies & Packaging)
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-xl">
              จัดการสต็อกโมเดลแมว, แม่เหล็กตู้เย็น, ของตกแต่ง และซองของแถม
              พร้อมรูปภาพจากบิล Shopee สำหรับใช้ตัดสต็อกแถมลูกค้า
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-2.5 flex-wrap">
            <Link
              href="/products/new?mode=freebie"
              className="px-4 py-2.5 rounded-2xl bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs sm:text-sm transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>ลงของแถมใหม่</span>
            </Link>
            <Link
              href="/products"
              className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-semibold text-xs sm:text-sm transition flex items-center gap-2 backdrop-blur-xs shadow-xs"
            >
              <span>💎 สลับไปคลังหิน</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Card 1: ของแถมลูกค้า */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                🎁 รายการของแถม
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <Gift className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {freebieList.length}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                พร้อมแจก {inStockCount} / หมด {freebieList.length - inStockCount}
              </span>
            </div>
          </div>

          {/* Card 2: สต็อกชิ้นคงเหลือ */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                📦 จำนวนชิ้นคงเหลือ
              </span>
              <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-teal-700">
                {totalUnits.toLocaleString()} ชิ้น
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                รวมของแถมและซองแพ็คเกจ
              </span>
            </div>
          </div>

          {/* Card 3: มูลค่าต้นทุนรวม */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                💰 มูลค่าต้นทุนสต็อก
              </span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-purple-700">
                ฿{Math.round(totalCostValue).toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                คำนวณจากทุนบิล Shopee
              </span>
            </div>
          </div>

          {/* Card 4: หมวดหมู่ของแถม */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                🛍️ หมวดหมู่ของแถม
              </span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-amber-700">
                {categories.length} หมวด
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                โมเดล, แม่เหล็ก, เทศกาล, ซอง
              </span>
            </div>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          {/* Order Filter Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  เลือกดูตามบิลคำสั่งซื้อ (5 รายการค่าใช้จ่าย)
                </span>
                <span className="text-[11px] text-slate-400 block">
                  กรองเฉพาะของแถมที่นำเข้าในแต่ละบิล Shopee
                </span>
              </div>
            </div>

            <div className="w-full sm:w-80">
              <select
                value={selectedOrderId}
                onChange={(e) => {
                  setSelectedOrderId(e.target.value);
                  setSelectedCategory('ALL');
                }}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-300 text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-2xs"
              >
                <option value="ALL">📑 ดูทั้งหมด (ครบ 5 บิล • 35 รายการ • รวม ฿1,690)</option>
                {FREEBIE_ORDERS.map((ord) => (
                  <option key={ord.id} value={ord.id}>
                    {ord.shortTitle}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Order Details Banner */}
          {activeOrder && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/60 to-cyan-50/40 border border-emerald-200/90 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white">
                    บิล #{activeOrder.orderNumber}
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {activeOrder.title}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>ร้าน: <strong className="text-slate-700">{activeOrder.vendor}</strong></span>
                  <span>ไฟล์: <strong className="text-slate-700">{activeOrder.files}</strong></span>
                  <span>ยอดบิล: <strong className="text-emerald-700">฿{activeOrder.amount.toLocaleString()}</strong></span>
                  <span>จำนวนของในบิล: <strong className="text-emerald-700">{activeOrder.itemCount} รายการ</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {activeOrder.receiptUrls.map((url, idx) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 transition shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    ดูสลิปบิล {activeOrder.receiptUrls.length > 1 ? `#${idx + 1}` : ''}
                  </a>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedOrderId('ALL')}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition"
                >
                  ✕ ล้างตัวกรอง
                </button>
              </div>
            </div>
          )}

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition whitespace-nowrap shadow-xs ${
                selectedCategory === 'ALL'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({freebieList.length})
            </button>
            {categories.map((cat) => {
              const count = freebieList.filter((p) => p.stone_type === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition whitespace-nowrap shadow-xs ${
                    selectedCategory === cat
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Search & Layout toggle */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหารหัส SKU หรือชื่อของแถม..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 justify-end">
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg text-xs transition ${
                    viewMode === 'grid'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="มุมมองการ์ด"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg text-xs transition ${
                    viewMode === 'table'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="มุมมองตาราง"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Product List */}
        {loading ? (
          <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/80 shadow-sm">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">กำลังโหลดคลังของแถม...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
            <Gift className="w-12 h-12 mx-auto text-emerald-300" />
            <p className="text-sm font-semibold text-slate-700">ไม่พบรายการของแถมในหมวดนี้</p>
            <p className="text-xs text-slate-400">ลองล้างคำค้นหาหรือเลือกหมวดหมู่อื่น</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {filteredList.map((item) => {
              const isOutOfStock = (Number(item.qty_on_hand) || 0) <= 0;
              const isProp = item.sku?.startsWith('PROP') || item.grade_origin === '[PROP]' || item.stone_type?.includes('พร็อพ');
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveModalItem(item)}
                  className={`bg-white rounded-2xl sm:rounded-3xl border transition overflow-hidden flex flex-col justify-between group cursor-pointer ${
                    isProp
                      ? 'border-indigo-200/90 hover:border-indigo-400 hover:shadow-md'
                      : 'border-slate-200/80 hover:border-emerald-300 hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Thumbnail */}
                    <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                      {item.r2_thumbnail_url ? (
                        <img
                          src={item.r2_thumbnail_url}
                          alt={item.name}
                          className="w-full h-full object-contain p-2 group-hover:scale-105 transition"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          {isProp ? <Sparkles className="w-10 h-10 text-indigo-300" /> : <Gift className="w-10 h-10" />}
                        </div>
                      )}
                      {/* SKU Badge */}
                      <div
                        className={`absolute top-2 left-2 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-lg shadow-xs ${
                          isProp
                            ? 'bg-indigo-900/90 border border-indigo-400/40 text-indigo-100'
                            : 'bg-black/75 backdrop-blur-xs'
                        }`}
                      >
                        {isProp ? `📸 ${item.sku}` : item.sku}
                      </div>

                      {/* Stock Status Badge */}
                      <div
                        className={`absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-xs ${
                          isOutOfStock
                            ? 'bg-rose-500 text-white'
                            : isProp
                            ? 'bg-indigo-600 text-white'
                            : 'bg-emerald-500 text-white'
                        }`}
                      >
                        {isOutOfStock ? 'หมด' : `คงเหลือ ${item.qty_on_hand}`}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-3 sm:p-3.5 space-y-1.5">
                      <h4
                        className={`font-bold text-xs sm:text-sm line-clamp-2 leading-tight transition ${
                          isProp
                            ? 'text-slate-800 group-hover:text-indigo-800'
                            : 'text-slate-800 group-hover:text-emerald-800'
                        }`}
                        title={item.name}
                      >
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isProp ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                            📸 พร็อพ
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            🎁 ของแถม
                          </span>
                        )}
                        {(() => {
                          const order = getOrderForItem(item.sku);
                          if (!order) return null;
                          return (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              🧾 บิล {order.orderNumber}
                            </span>
                          );
                        })()}
                        <p className="text-[10px] text-slate-400 truncate">
                          {item.stone_type}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer & Quick Stock Adjuster */}
                  <div
                    className="p-3 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between gap-1 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <span className="text-[10px] text-slate-400 block leading-none">
                        {item.sku?.startsWith('GIFT-BAG-') ? 'ทุน / ใบ' : 'ทุน'}
                      </span>
                      <strong className={`${isProp ? 'text-indigo-700' : 'text-emerald-700'} font-bold text-xs sm:text-sm`}>
                        ฿{formatUnitCost(item.cost_price)}
                      </strong>
                    </div>

                    {/* + / - buttons */}
                    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                      <button
                        type="button"
                        disabled={updatingId === item.id || isOutOfStock}
                        onClick={() => handleQuickQtyChange(item, -1)}
                        className="p-1 text-slate-600 hover:text-rose-600 rounded-lg hover:bg-white transition disabled:opacity-30"
                        title="ลดสต็อก 1 ชิ้น (แจกแล้ว)"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono text-xs font-bold px-1 min-w-[20px] text-center text-slate-800">
                        {item.qty_on_hand}
                      </span>
                      <button
                        type="button"
                        disabled={updatingId === item.id}
                        onClick={() => handleQuickQtyChange(item, 1)}
                        className="p-1 text-slate-600 hover:text-emerald-600 rounded-lg hover:bg-white transition"
                        title="เพิ่มสต็อก 1 ชิ้น"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">รูปภาพ</th>
                    <th className="py-3 px-4">รหัส SKU</th>
                    <th className="py-3 px-4">ชื่อสินค้า / อุปกรณ์</th>
                    <th className="py-3 px-4">บิลคำสั่งซื้อ</th>
                    <th className="py-3 px-4">ประเภท / หมวดหมู่</th>
                    <th className="py-3 px-4 text-right">ต้นทุนต่อชิ้น</th>
                    <th className="py-3 px-4 text-center">จำนวนคงเหลือ</th>
                    <th className="py-3 px-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map((item) => {
                    const isProp = item.sku?.startsWith('PROP') || item.grade_origin === '[PROP]' || item.stone_type?.includes('พร็อพ');
                    const order = getOrderForItem(item.sku);
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setActiveModalItem(item)}
                        className="hover:bg-slate-50/80 transition cursor-pointer"
                      >
                        <td className="py-2.5 px-4">
                          <img
                            src={item.r2_thumbnail_url || ''}
                            alt={item.name}
                            className="w-10 h-10 rounded-xl object-contain bg-slate-100 border border-slate-200"
                          />
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold">
                          {isProp ? (
                            <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg text-[11px]">
                              📸 {item.sku}
                            </span>
                          ) : (
                            <span className="text-slate-800">{item.sku}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800 max-w-xs truncate">
                          {item.name}
                        </td>
                        <td className="py-2.5 px-4">
                          {order ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200"
                              title={order.title}
                            >
                              🧾 บิล {order.orderNumber}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5">
                            {isProp ? (
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                📸 พร็อพ
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                🎁 ของแถม
                              </span>
                            )}
                            <span className="text-slate-500">{item.stone_type}</span>
                          </div>
                        </td>
                        <td className={`py-2.5 px-4 text-right font-bold ${isProp ? 'text-indigo-700' : 'text-emerald-700'}`}>
                          ฿{formatUnitCost(item.cost_price)}
                          {item.sku?.startsWith('GIFT-BAG-') && <span className="text-[10px] text-slate-400 block font-normal">/ ใบ</span>}
                        </td>
                        <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1 bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleQuickQtyChange(item, -1)}
                              className="p-1 text-slate-600 hover:text-rose-600 rounded-lg hover:bg-white transition"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono text-xs font-bold px-1 min-w-[20px] text-center">
                              {item.qty_on_hand}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuickQtyChange(item, 1)}
                              className="p-1 text-slate-600 hover:text-emerald-600 rounded-lg hover:bg-white transition"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="แก้ไข"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {activeModalItem && (
          <div
            onClick={() => setActiveModalItem(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4 cursor-default"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg ${
                    activeModalItem.sku?.startsWith('PROP') || activeModalItem.grade_origin === '[PROP]' || activeModalItem.stone_type?.includes('พร็อพ')
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {activeModalItem.sku}
                  </span>
                  {activeModalItem.sku?.startsWith('PROP') || activeModalItem.grade_origin === '[PROP]' || activeModalItem.stone_type?.includes('พร็อพ') ? (
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <span>📸 พร็อพถ่ายรูป & ตกแต่งฉาก</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">
                      {activeModalItem.stone_type}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setActiveModalItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Image Preview */}
              <div className="w-full aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center p-4">
                <img
                  src={activeModalItem.r2_thumbnail_url || ''}
                  alt={activeModalItem.name}
                  className="w-full h-full object-contain"
                />
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-base leading-snug">
                  {activeModalItem.name}
                </h3>
                <div className="flex items-center justify-between mt-3 text-sm">
                  <span className="text-slate-500">
                    {activeModalItem.sku?.startsWith('GIFT-BAG-') ? 'ต้นทุนต่อใบ:' : 'ต้นทุนต่อชิ้น:'}
                  </span>
                  <strong className={`${
                    activeModalItem.sku?.startsWith('PROP') || activeModalItem.grade_origin === '[PROP]' || activeModalItem.stone_type?.includes('พร็อพ')
                      ? 'text-indigo-700'
                      : 'text-emerald-700'
                  } font-extrabold text-base`}>
                    ฿{formatUnitCost(activeModalItem.cost_price)}
                  </strong>
                </div>
                <div className="flex items-center justify-between mt-1 text-sm">
                  <span className="text-slate-500">คงเหลือในสต็อก:</span>
                  <strong className="text-slate-900 font-bold font-mono">
                    {activeModalItem.qty_on_hand} {activeModalItem.sku?.startsWith('GIFT-BAG-') ? 'ใบ' : 'ชิ้น'}
                  </strong>
                </div>
                {activeModalItem.storage_location && (
                  <div className="flex items-center justify-between mt-1 text-sm">
                    <span className="text-slate-500">ตำแหน่งจัดเก็บ:</span>
                    <span className="text-slate-700 font-medium">
                      {activeModalItem.storage_location}
                    </span>
                  </div>
                )}

                {/* Associated Expense Order Info */}
                {(() => {
                  const order = getOrderForItem(activeModalItem.sku);
                  if (!order) return null;
                  return (
                    <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                          บิลคำสั่งซื้อ #{order.orderNumber} (ในค่าใช้จ่าย)
                        </span>
                        <span className="font-bold text-emerald-700">฿{order.amount.toLocaleString()}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] font-medium leading-relaxed">
                        {order.title}
                      </p>
                      <div className="text-[10px] text-slate-500">
                        ร้าน: <strong>{order.vendor}</strong> • หลักฐาน: <strong>{order.files}</strong>
                      </div>
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {order.receiptUrls.map((url, idx) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline"
                          >
                            <FileText className="w-3 h-3" />
                            ดูสลิปบิล {order.receiptUrls.length > 1 ? `#${idx + 1}` : ''}
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  onClick={() => openEditModal(activeModalItem)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>แก้ไขข้อมูล</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingItem && (
          <div
            onClick={() => setEditingItem(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4 cursor-default"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-sm">แก้ไขรายการของแถม</h4>
                <button
                  onClick={() => setEditingItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">ชื่อของแถม</label>
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">ต้นทุน (฿)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editForm.cost_price ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setEditForm((f) => ({
                          ...f,
                          cost_price: raw === '' ? 0 : parseFloat(raw),
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">จำนวนคงเหลือ</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.qty_on_hand ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setEditForm((f) => ({
                          ...f,
                          qty_on_hand: raw === '' ? 0 : parseInt(raw, 10),
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">หมวดหมู่</label>
                  <input
                    type="text"
                    value={editForm.stone_type || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, stone_type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleEditSave}
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
