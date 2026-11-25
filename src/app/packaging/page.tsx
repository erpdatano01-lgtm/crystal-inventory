'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  fetchProducts,
  isPackagingItem,
  formatUnitCost,
} from '@/lib/inventoryService';
import { Product, ProductStatus } from '@/types';
import {
  Box,
  Search,
  LayoutGrid,
  List,
  DollarSign,
  Plus,
  Minus,
  Pencil,
  X,
  Layers,
  ArrowRight,
  Save,
  Receipt,
  FileText,
  Gift,
  Info,
} from 'lucide-react';

interface PackagingOrder {
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

const PACKAGING_ORDERS: PackagingOrder[] = [
  {
    id: 'PKG-ORDER-1',
    orderNumber: 1,
    title: 'กล่องไทยโทน หูช้าง Size 0 สีบัวโรย (2 แพ็ค / 40 ใบ)',
    shortTitle: 'บิล 1: กล่องไทยโทน หูช้าง Size 0 (฿358 • 40 ใบ)',
    amount: 358,
    itemCount: 1,
    files: 'File 64',
    vendor: 'Shopee (NPP BOX)',
    receiptUrls: [
      'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_64.jpg',
    ],
    skus: ['PKG-BOX-001'],
  },
  {
    id: 'PKG-ORDER-2',
    orderNumber: 2,
    title: 'กล่องพัสดุ Make a Wish (Size 0+4, 00) & Cutie Size 0',
    shortTitle: 'บิล 2: กล่อง Make a Wish & Cutie (฿404 • 3 แบบ / 100 ใบ)',
    amount: 404,
    itemCount: 3,
    files: 'File 70',
    vendor: 'Shopee (Idea Kraft | ไอเดียคราฟ BOX)',
    receiptUrls: [
      'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_70.jpg',
    ],
    skus: ['PKG-BOX-002', 'PKG-BOX-003', 'PKG-BOX-004'],
  },
  {
    id: 'PKG-ORDER-3',
    orderNumber: 3,
    title: 'ถุงซิปล็อคใส LAILA แพ็ค 1 กก. (5 ขนาด: 5x7, 6x8, 9x13, 12x17, 16x22 cm)',
    shortTitle: 'บิล 3: ถุงซิปล็อค LAILA 5 ขนาด (฿616 • 4,215 ใบ)',
    amount: 616,
    itemCount: 5,
    files: 'File 59, 62',
    vendor: 'Shopee (LAILA Official Store)',
    receiptUrls: [
      'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_59.jpg',
      'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_62.jpg',
    ],
    skus: ['PKG-ZIP-001', 'PKG-ZIP-002', 'PKG-ZIP-003', 'PKG-ZIP-004', 'PKG-ZIP-005'],
  },
  {
    id: 'PKG-ORDER-4',
    orderNumber: 4,
    title: 'การ์ดขอบคุณลูกค้า กระดาษคองเกอร์สีครีม (3 แบบๆ ละ 50 ใบ)',
    shortTitle: 'บิล 4: การ์ดขอบคุณ ร้าน LP (฿460 • 150 ใบ)',
    amount: 460,
    itemCount: 1,
    files: 'File 30, 61',
    vendor: 'ร้าน LP',
    receiptUrls: [
      'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_30.jpg',
      'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_61.jpg',
    ],
    skus: ['PKG-CARD-001'],
  },
];

function getOrderForPackaging(sku: string): PackagingOrder | undefined {
  return PACKAGING_ORDERS.find((o) => o.skus.includes(sku));
}

export default function PackagingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const activeOrder = useMemo(
    () => PACKAGING_ORDERS.find((o) => o.id === selectedOrderId) || null,
    [selectedOrderId]
  );

  // Modals
  const [activeModalItem, setActiveModalItem] = useState<Product | null>(null);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [isSaving, setIsSaving] = useState(false);
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

  const packagingList = useMemo(() => {
    return products.filter((p) => isPackagingItem(p));
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    packagingList.forEach((p) => {
      if (p.stone_type) set.add(p.stone_type);
    });
    return Array.from(set).sort();
  }, [packagingList]);

  const filteredList = useMemo(() => {
    return packagingList.filter((item) => {
      if (selectedOrderId !== 'ALL') {
        const order = PACKAGING_ORDERS.find((o) => o.id === selectedOrderId);
        if (order && !order.skus.includes(item.sku)) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSku = item.sku.toLowerCase().includes(q);
        const matchName = item.name.toLowerCase().includes(q);
        const matchCat = item.stone_type?.toLowerCase().includes(q) || false;
        const matchDim = item.dimensions?.toLowerCase().includes(q) || false;
        if (!matchSku && !matchName && !matchCat && !matchDim) return false;
      }
      if (selectedCategory !== 'ALL' && item.stone_type !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [packagingList, searchQuery, selectedCategory, selectedOrderId]);

  // Summary KPIs
  const totalUnits = useMemo(() => {
    return packagingList.reduce((sum, item) => sum + (Number(item.qty_on_hand) || 0), 0);
  }, [packagingList]);

  const totalCostValue = useMemo(() => {
    return packagingList.reduce(
      (sum, item) => sum + (Number(item.cost_price) || 0) * (Number(item.qty_on_hand) || 0),
      0
    );
  }, [packagingList]);

  const inStockCount = useMemo(() => {
    return packagingList.filter((item) => (Number(item.qty_on_hand) || 0) > 0).length;
  }, [packagingList]);

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
      dimensions: item.dimensions,
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
        {/* Banner Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-6 sm:p-7 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-xs">
              <Box className="w-3.5 h-3.5" />
              <span>คลังเฉพาะกล่องพัสดุ &amp; ถุงซิปล็อค (นับจำนวนรายใบได้)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              คลังแพ็คเกจจิ้ง (Packaging Stock)
            </h2>
            <p className="text-xs sm:text-sm text-amber-100 max-w-xl">
              ติดตามสต็อกกล่องไปรษณีย์, ถุงซิปล็อคหลายขนาด และการ์ดขอบคุณลูกค้า
              แยกจากคลังหินและคลังของแถม
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-2.5 flex-wrap">
            <Link
              href="/freebies"
              className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-semibold text-xs sm:text-sm transition flex items-center gap-1.5 backdrop-blur-xs shadow-xs"
            >
              <Gift className="w-4 h-4" />
              <span>คลังของแถม</span>
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
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                📦 รายการแพ็คเกจจิ้ง
              </span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <Box className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {packagingList.length}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                พร้อมใช้ {inStockCount} / หมด {packagingList.length - inStockCount}
              </span>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                🧾 จำนวนคงเหลือรวม
              </span>
              <div className="p-2 rounded-xl bg-orange-50 text-orange-700">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-orange-700">
                {totalUnits.toLocaleString()} ใบ
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                รวมกล่อง ถุงซิป และการ์ดขอบคุณ
              </span>
            </div>
          </div>

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
                ทุนสุทธิหลังหักส่วนลด (เฉพาะที่นับได้)
              </span>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                🏷️ หมวดหมู่
              </span>
              <div className="p-2 rounded-xl bg-sky-50 text-sky-700">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-sky-700">
                {categories.length} หมวด
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                กล่องพัสดุ, ถุงซิป, ถุงซีล &amp; ถุงฝากาว, การ์ด
              </span>
            </div>
          </div>
        </div>

        {/* Info Notice about Consumables kept only in Expenses */}
        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>หมายเหตุ:</strong> วัสดุสิ้นเปลืองที่นับรายชิ้นได้ยาก (กระดาษฝอย 3 บิล, เทปกาวเกล็ดหิมะ, สติกเกอร์ระวังแตก 500 ดวง และฉลาก NIIMBOT รวม ฿1,026) ไม่ได้นำมาลงตัดสต็อกในหน้านี้ โดยบันทึกเป็นรายจ่ายครบถ้วนใน{' '}
            <Link href="/expenses" className="underline font-bold text-amber-800 hover:text-amber-950">
              หน้าค่าใช้จ่าย (/expenses)
            </Link>{' '}
            เรียบร้อยแล้วครับ
          </span>
        </div>

        {/* Filter Bar & Order Dropdown */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  เลือกดูตามบิลคำสั่งซื้อ ({PACKAGING_ORDERS.length} บิลแพ็คเกจจิ้งที่ลงสต็อก)
                </span>
                <span className="text-[11px] text-slate-400 block">
                  ตรวจเช็กกล่องและถุงที่ซื้อเข้ามาในแต่ละบิล
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
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-300 text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none transition shadow-2xs"
              >
                <option value="ALL">📑 ดูทั้งหมด ({PACKAGING_ORDERS.length} บิล • {packagingList.length} รายการ • รวม ฿1,913)</option>
                {PACKAGING_ORDERS.map((ord) => (
                  <option key={ord.id} value={ord.id}>
                    {ord.shortTitle}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Order Banner */}
          {activeOrder && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50/60 to-yellow-50/40 border border-amber-200/90 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-600 text-white">
                    บิล #{activeOrder.orderNumber}
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {activeOrder.title}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>ร้าน: <strong className="text-slate-700">{activeOrder.vendor}</strong></span>
                  <span>ไฟล์: <strong className="text-slate-700">{activeOrder.files}</strong></span>
                  <span>ยอดบิล: <strong className="text-amber-700">฿{activeOrder.amount.toLocaleString()}</strong></span>
                  <span>จำนวนรายการ: <strong className="text-amber-700">{activeOrder.itemCount} รายการ</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {activeOrder.receiptUrls.map((url, idx) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl bg-white border border-amber-300 text-amber-800 hover:bg-amber-100/60 transition shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-600" />
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
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({packagingList.length})
            </button>
            {categories.map((cat) => {
              const count = packagingList.filter((p) => p.stone_type === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition whitespace-nowrap shadow-xs ${
                    selectedCategory === cat
                      ? 'bg-amber-600 text-white'
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
                placeholder="ค้นหารหัส SKU, ขนาด (เช่น 6x8, Size 0) หรือชื่อแพ็คเกจจิ้ง..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
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
                      ? 'bg-white text-amber-800 shadow-xs'
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
                      ? 'bg-white text-amber-800 shadow-xs'
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
            <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">กำลังโหลดคลังแพ็คเกจจิ้ง...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
            <Box className="w-12 h-12 mx-auto text-amber-300" />
            <p className="text-sm font-semibold text-slate-700">ไม่พบรายการแพ็คเกจจิ้งในหมวดนี้</p>
            <p className="text-xs text-slate-400">ลองล้างคำค้นหาหรือเลือกหมวดหมู่อื่น</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {filteredList.map((item) => {
              const isOutOfStock = (Number(item.qty_on_hand) || 0) <= 0;
              const order = getOrderForPackaging(item.sku);
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveModalItem(item)}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 hover:border-amber-300 hover:shadow-md transition overflow-hidden flex flex-col justify-between group cursor-pointer"
                >
                  <div>
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
                          <Box className="w-10 h-10" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-xs text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-lg shadow-xs">
                        {item.sku}
                      </div>
                      <div
                        className={`absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-xs ${
                          isOutOfStock
                            ? 'bg-rose-500 text-white'
                            : 'bg-amber-600 text-white'
                        }`}
                      >
                        {isOutOfStock ? 'หมด' : `คงเหลือ ${Number(item.qty_on_hand).toLocaleString()}`}
                      </div>
                    </div>

                    <div className="p-3 sm:p-3.5 space-y-1.5">
                      <h4
                        className="font-bold text-xs sm:text-sm line-clamp-2 leading-tight text-slate-800 group-hover:text-amber-800 transition"
                        title={item.name}
                      >
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                          📦 {item.stone_type}
                        </span>
                        {order && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            🧾 บิล {order.orderNumber}
                          </span>
                        )}
                      </div>
                      {item.dimensions && (
                        <p className="text-[10px] text-slate-400 truncate">
                          ขนาด: {item.dimensions}
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    className="p-3 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between gap-1 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <span className="text-[10px] text-slate-400 block leading-none">
                        ทุน / ใบ
                      </span>
                      <strong className="text-amber-700 font-bold text-xs sm:text-sm">
                        ฿{formatUnitCost(item.cost_price)}
                      </strong>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                      <button
                        type="button"
                        disabled={updatingId === item.id || isOutOfStock}
                        onClick={() => handleQuickQtyChange(item, -1)}
                        className="p-1 text-slate-600 hover:text-rose-600 rounded-lg hover:bg-white transition disabled:opacity-30"
                        title="ลดสต็อก 1 ใบ"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono text-xs font-bold px-1 min-w-[24px] text-center text-slate-800">
                        {item.qty_on_hand}
                      </span>
                      <button
                        type="button"
                        disabled={updatingId === item.id}
                        onClick={() => handleQuickQtyChange(item, 1)}
                        className="p-1 text-slate-600 hover:text-amber-600 rounded-lg hover:bg-white transition"
                        title="เพิ่มสต็อก 1 ใบ"
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
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">รูปภาพ</th>
                    <th className="py-3 px-4">รหัส SKU</th>
                    <th className="py-3 px-4">รายการแพ็คเกจจิ้ง</th>
                    <th className="py-3 px-4">บิลคำสั่งซื้อ</th>
                    <th className="py-3 px-4">หมวดหมู่ / ขนาด</th>
                    <th className="py-3 px-4 text-right">ต้นทุน / ใบ</th>
                    <th className="py-3 px-4 text-center">คงเหลือ (ใบ)</th>
                    <th className="py-3 px-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map((item) => {
                    const order = getOrderForPackaging(item.sku);
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
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                          {item.sku}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800 max-w-xs truncate">
                          {item.name}
                        </td>
                        <td className="py-2.5 px-4">
                          {order ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200"
                              title={order.title}
                            >
                              🧾 บิล {order.orderNumber}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          <span className="font-semibold text-amber-800">{item.stone_type}</span>
                          {item.dimensions && (
                            <span className="text-[10px] text-slate-400 block">{item.dimensions}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-amber-700">
                          ฿{formatUnitCost(item.cost_price)}
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
                            <span className="font-mono text-xs font-bold px-1 min-w-[28px] text-center">
                              {item.qty_on_hand}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuickQtyChange(item, 1)}
                              className="p-1 text-slate-600 hover:text-amber-600 rounded-lg hover:bg-white transition"
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
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-800">
                    {activeModalItem.sku}
                  </span>
                  <span className="text-xs text-slate-400">
                    {activeModalItem.stone_type}
                  </span>
                </div>
                <button
                  onClick={() => setActiveModalItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

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
                  <span className="text-slate-500">ต้นทุนต่อใบ:</span>
                  <strong className="text-amber-700 font-extrabold text-base">
                    ฿{formatUnitCost(activeModalItem.cost_price)}
                  </strong>
                </div>
                <div className="flex items-center justify-between mt-1 text-sm">
                  <span className="text-slate-500">คงเหลือในสต็อก:</span>
                  <strong className="text-slate-900 font-bold font-mono">
                    {Number(activeModalItem.qty_on_hand || 0).toLocaleString()} ใบ
                  </strong>
                </div>
                {activeModalItem.dimensions && (
                  <div className="flex items-center justify-between mt-1 text-sm">
                    <span className="text-slate-500">ขนาด / สเปก:</span>
                    <span className="text-slate-700 font-medium">
                      {activeModalItem.dimensions}
                    </span>
                  </div>
                )}
                {activeModalItem.storage_location && (
                  <div className="flex items-center justify-between mt-1 text-sm">
                    <span className="text-slate-500">ตำแหน่งจัดเก็บ:</span>
                    <span className="text-slate-700 font-medium">
                      {activeModalItem.storage_location}
                    </span>
                  </div>
                )}

                {(() => {
                  const order = getOrderForPackaging(activeModalItem.sku);
                  if (!order) return null;
                  return (
                    <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-amber-600" />
                          บิลคำสั่งซื้อ #{order.orderNumber} (ในค่าใช้จ่าย)
                        </span>
                        <span className="font-bold text-amber-700">฿{order.amount.toLocaleString()}</span>
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
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 underline"
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
                <h4 className="font-bold text-slate-900 text-sm">แก้ไขรายการแพ็คเกจจิ้ง</h4>
                <button
                  onClick={() => setEditingItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">ชื่อรายการ</label>
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">ต้นทุน / ใบ (฿)</label>
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500 font-bold text-amber-700"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">จำนวนคงเหลือ (ใบ)</label>
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">หมวดหมู่</label>
                    <input
                      type="text"
                      value={editForm.stone_type || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, stone_type: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">ขนาด / สเปก</label>
                    <input
                      type="text"
                      value={editForm.dimensions || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, dimensions: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
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
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 text-white hover:bg-amber-700 shadow-sm flex items-center gap-1.5"
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
