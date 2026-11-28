'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  fetchProducts,
  fetchExpenses,
  fetchStockLots,
  classifyProductWarehouse,
  isNonStoneFreebie,
  isStoneFreebie,
  isPackagingItem,
  isStoneProduct,
  isStandItem,
  WarehouseCategory,
} from '@/lib/inventoryService';
import { Product, Expense, StockLot, STATUS_CONFIG, EXPENSE_CATEGORIES_CONFIG } from '@/types';
import {
  PackageCheck,
  Receipt,
  PlusCircle,
  FolderPlus,
  DollarSign,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Video,
  ExternalLink,
  Layers,
  ShoppingBag,
  Settings,
  Bell,
  Search,
  X,
  Save,
  Check,
} from 'lucide-react';

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [lots, setLots] = useState<StockLot[]>([]);
  const [damagedLoss, setDamagedLoss] = useState<number>(0);
  const [damagedCount, setDamagedCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Custom low-stock alert rules (productId -> min qty threshold)
  const [lowStockRules, setLowStockRules] = useState<Record<string, number>>({});
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [draftLowStockRules, setDraftLowStockRules] = useState<Record<string, number>>({});
  const [lowStockSearch, setLowStockSearch] = useState('');
  const [lowStockFilterCat, setLowStockFilterCat] = useState<'ALL' | 'SELECTED' | WarehouseCategory>('ALL');
  const [savingLowStockRules, setSavingLowStockRules] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [p, e, l, d, s] = await Promise.all([
          fetchProducts(),
          fetchExpenses(),
          fetchStockLots(),
          fetch('/api/products/handle-damaged').then((r) => r.json()).catch(() => ({ totalDamagedLoss: 0, count: 0 })),
          fetch('/api/settings', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ lowStockRules: {} })),
        ]);
        setProducts(p);
        setExpenses(e);
        setLots(l);
        setDamagedLoss(Number(d?.totalDamagedLoss) || 0);
        setDamagedCount(Number(d?.count) || 0);
        if (s?.lowStockRules && typeof s.lowStockRules === 'object') {
          setLowStockRules(s.lowStockRules);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // 1. ยอดค่าใช้จ่ายรวมเดือนนี้ พร้อมแยกต้นทุนหิน vs ค่าอื่นๆ
  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // e.g. "2026-11"
  const thisMonthExpenses = expenses.filter((e) =>
    e.expense_date.startsWith(currentMonthPrefix)
  );
  const totalExpenseThisMonth = thisMonthExpenses.reduce(
    (sum, e) => sum + Number(e.total_amount || 0),
    0
  );
  const stoneExpenseThisMonth = thisMonthExpenses
    .filter((e) => e.category === 'STOCK_LOT')
    .reduce((sum, e) => sum + Number(e.total_amount || 0), 0);
  const otherExpenseThisMonth = totalExpenseThisMonth - stoneExpenseThisMonth;

  // แยกคลังหินขาย คลังหินของแถม คลังของแถม และคลังแพ็คเกจจิ้งออกจากกันแบบไม่ซ้ำซ้อน
  const stoneProducts = products.filter((p) => isStoneProduct(p));
  const stoneFreebies = products.filter((p) => isStoneFreebie(p));
  const nonStoneFreebies = products.filter((p) => isNonStoneFreebie(p));
  const packagingItems = products.filter((p) => isPackagingItem(p));
  const sellingStones = stoneProducts.filter((p) => !p.sku?.startsWith('GIFT-'));

  // 2. จำนวนหินที่พร้อมขาย (AVAILABLE เฉพาะหินขาย ไม่รวมซอง/ของแถม)
  const availableProducts = sellingStones.filter(
    (p) => p.status === 'AVAILABLE' && Number(p.qty_on_hand ?? 0) > 0
  );
  const availableCount = availableProducts.reduce(
    (sum, p) => sum + Number(p.qty_on_hand ?? 0),
    0
  );

  // 3. มูลค่าต้นทุนสต็อกหินคงเหลือรวม (สำหรับหินที่ยังไม่ขาย: AVAILABLE, PREP, IN_TRANSIT, RESERVED)
  const inStockStones = stoneProducts.filter((p) => p.status !== 'SOLD');
  const totalCostInStock = inStockStones.reduce(
    (sum, p) => sum + Number(p.cost_price || 0) * Number(p.qty_on_hand ?? 0),
    0
  );

  // 4. มูลค่าราคาขายรวม (Potential Retail Value ของหิน)
  const totalSellingInStock = inStockStones.reduce(
    (sum, p) => sum + Number(p.selling_price || 0) * Number(p.qty_on_hand ?? 0),
    0
  );

  // 5. สินค้าขายแล้วทั้งหมด (ไม่นับรายการที่แจ้งแตกเสียหาย DAMAGED)
  const soldProducts = stoneProducts.filter(
    (p) => p.status === 'SOLD' && !p.grade_origin?.includes('[DAMAGED]')
  );
  const totalSoldRevenue = soldProducts.reduce(
    (sum, p) => sum + Number(p.selling_price || 0),
    0
  );

  // 6. แจ้งเตือนสต็อกใกล้หมด (เฉพาะรายการและเกณฑ์จำนวนที่ผู้ใช้เลือกตั้งค่าไว้เอง)
  const lowStockWatchedCount = Object.keys(lowStockRules).length;
  const lowStockItems = useMemo(() => {
    return products
      .filter((p) => {
        const threshold = lowStockRules[p.id];
        if (typeof threshold !== 'number') return false;
        return Number(p.qty_on_hand ?? 0) <= threshold;
      })
      .map((p) => ({ product: p, threshold: lowStockRules[p.id] }));
  }, [products, lowStockRules]);

  const openLowStockModal = () => {
    setDraftLowStockRules({ ...lowStockRules });
    setLowStockSearch('');
    setLowStockFilterCat('ALL');
    setShowLowStockModal(true);
  };

  const toggleLowStockRule = (product: Product) => {
    setDraftLowStockRules((prev) => {
      const next = { ...prev };
      if (typeof next[product.id] === 'number') {
        delete next[product.id];
      } else {
        next[product.id] = 10;
      }
      return next;
    });
  };

  const updateDraftThreshold = (productId: string, val: string) => {
    const parsed = Math.max(0, parseInt(val, 10) || 0);
    setDraftLowStockRules((prev) => ({
      ...prev,
      [productId]: parsed,
    }));
  };

  const handleSaveLowStockRules = async () => {
    setSavingLowStockRules(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lowStockRules: draftLowStockRules }),
      });
      if (res.ok) {
        const data = await res.json();
        setLowStockRules(data.lowStockRules || draftLowStockRules);
        setShowLowStockModal(false);
      } else {
        alert('บันทึกการตั้งค่าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setSavingLowStockRules(false);
    }
  };

  const filteredConfigProducts = useMemo(() => {
    const q = lowStockSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (lowStockFilterCat === 'SELECTED') {
        if (typeof draftLowStockRules[p.id] !== 'number') return false;
      } else if (lowStockFilterCat !== 'ALL') {
        if (classifyProductWarehouse(p) !== lowStockFilterCat) return false;
      }
      if (q) {
        return (
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.stone_type || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, lowStockSearch, lowStockFilterCat, draftLowStockRules]);

  return (
    <div className="min-h-screen flex flex-col pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-16 bg-[#fafafa] md:pl-64 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0">
      <Navbar />

      <main className="max-w-6xl w-full mx-auto px-5 sm:px-8 lg:px-10 py-8 sm:py-10 space-y-8 flex-1">
        {/* Minimal Header & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-zinc-200">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900">
              ภาพรวมร้าน
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              สต็อกสินค้า ค่าใช้จ่าย และยอดคงเหลือล่าสุด
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/orders"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs sm:text-sm font-medium transition"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>+ เปิดบิลขาย</span>
            </Link>
            <Link
              href="/products/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-xs sm:text-sm font-medium transition"
            >
              <PlusCircle className="w-4 h-4 text-zinc-500" />
              <span>+ รับหินเข้า</span>
            </Link>
            <Link
              href="/expenses"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-xs sm:text-sm font-medium transition"
            >
              <Receipt className="w-4 h-4 text-zinc-500" />
              <span>+ ค่าใช้จ่าย</span>
            </Link>
          </div>
        </div>

        {/* 4 Core Summary Metrics (Flat, border-only, tabular numerals) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 flex flex-col justify-between gap-3">
            <span className="text-xs font-medium text-zinc-500">
              ค่าใช้จ่ายเดือนนี้
            </span>
            <div>
              <div className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">
                ฿{totalExpenseThisMonth.toLocaleString()}
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-zinc-100 space-y-1 text-[11px] text-zinc-500">
                <div className="flex justify-between">
                  <span>ต้นทุนหิน</span>
                  <span className="font-medium text-zinc-800 tabular-nums">฿{stoneExpenseThisMonth.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>แพ็ค ของแถม &amp; อื่นๆ</span>
                  <span className="tabular-nums">฿{otherExpenseThisMonth.toLocaleString()}</span>
                </div>
                {damagedLoss > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>เสียหาย ({damagedCount})</span>
                    <span className="tabular-nums">-฿{damagedLoss.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200 flex flex-col justify-between gap-3">
            <span className="text-xs font-medium text-zinc-500">
              หินพร้อมขาย
            </span>
            <div>
              <div className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">
                {availableCount} <span className="text-sm font-normal text-zinc-400">ชิ้น</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-2.5 pt-2.5 border-t border-zinc-100">
                หินของแถม {stoneFreebies.length} • ของแถม {nonStoneFreebies.length} • แพ็คเกจ {packagingItems.length}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200 flex flex-col justify-between gap-3">
            <span className="text-xs font-medium text-zinc-500">
              ต้นทุนสต็อกหินคงเหลือ
            </span>
            <div>
              <div className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">
                ฿{Math.round(totalCostInStock).toLocaleString()}
              </div>
              <p className="text-[11px] text-zinc-400 mt-2.5 pt-2.5 border-t border-zinc-100">
                {inStockStones.length} ชิ้นในคลัง
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200 flex flex-col justify-between gap-3">
            <span className="text-xs font-medium text-zinc-500">
              มูลค่าราคาขายรวม
            </span>
            <div>
              <div className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">
                ฿{totalSellingInStock.toLocaleString()}
              </div>
              <p className="text-[11px] text-emerald-700 font-medium mt-2.5 pt-2.5 border-t border-zinc-100 tabular-nums">
                กำไรคาดการณ์ ฿{Math.round(totalSellingInStock - totalCostInStock).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Custom Low Stock Alert (Only items & thresholds chosen by the user) */}
        {!loading && lowStockItems.length > 0 && (
          <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <h3 className="text-xs sm:text-sm font-semibold text-amber-950">
                แจ้งเตือนสต็อกใกล้หมด ({lowStockItems.length} รายการ)
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {lowStockItems.map(({ product: item, threshold }) => (
                  <span
                    key={item.id}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                      Number(item.qty_on_hand) === 0
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-white text-amber-900 border-amber-200'
                    }`}
                  >
                    <span className="font-mono">{item.sku}</span>
                    <span className="truncate max-w-[160px]">{item.name}</span>
                    <span className="font-semibold">
                      ({Number(item.qty_on_hand) === 0 ? 'หมด' : `เหลือ ${item.qty_on_hand}`} / ≤{threshold})
                    </span>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={openLowStockModal}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 text-xs font-medium transition"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>ตั้งค่า</span>
              </button>
              <Link
                href="/packaging"
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition text-center"
              >
                ดูคลังแพ็คเกจ
              </Link>
            </div>
          </div>
        )}

        {!loading && lowStockItems.length === 0 && (
          <div className="bg-white border border-zinc-200 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <Bell className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>
                {lowStockWatchedCount > 0 ? (
                  <>
                    แจ้งเตือนสต็อก: ติดตามอยู่{' '}
                    <strong className="font-semibold text-zinc-900">{lowStockWatchedCount} รายการ</strong>{' '}
                    (ปกติ)
                  </>
                ) : (
                  'แจ้งเตือนสต็อก: ยังไม่ได้เลือกรายการ'
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={openLowStockModal}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200 text-xs font-medium transition shrink-0"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>ตั้งค่าแจ้งเตือน</span>
            </button>
          </div>
        )}

        {/* Recent Products & Lots Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Latest Added Products (2 cols) */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="font-semibold text-zinc-900 text-sm">
                หินที่รับเข้าล่าสุด
              </h3>
              <Link
                href="/products"
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
              >
                ทั้งหมด <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {stoneProducts.length === 0 ? (
              <div className="py-10 text-center text-zinc-400">
                <p className="text-xs">ยังไม่มีรายการหินในสต็อก</p>
                <Link href="/products/new" className="text-xs text-zinc-900 font-medium underline mt-1.5 inline-block">
                  + เพิ่มหินชิ้นแรก
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {stoneProducts.slice(0, 4).map((p) => {
                  const statusInfo = STATUS_CONFIG[p.status] || STATUS_CONFIG.AVAILABLE;
                  const thumb = p.r2_thumbnail_url || 'https://images.unsplash.com/photo-1598887142487-3c854d51d2c7?auto=format&fit=crop&w=300&q=80';

                  return (
                    <div
                      key={p.id}
                      className="py-3 first:pt-0 last:pb-0 flex items-center gap-3.5"
                    >
                      <img
                        src={thumb}
                        alt={p.name}
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-zinc-200"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-medium text-zinc-500">
                            {p.sku}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${statusInfo.badgeClass}`}>
                            {statusInfo.label.split(' (')[0]}
                          </span>
                        </div>
                        <h4 className="font-medium text-sm text-zinc-900 truncate mt-0.5">
                          {p.name}
                        </h4>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold text-sm text-zinc-900 tabular-nums">
                          ฿{p.selling_price.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-zinc-400">{p.stone_type}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Stock Lots (1 col) */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="font-semibold text-zinc-900 text-sm">
                ล็อตนำเข้า
              </h3>
              <Link
                href="/expenses"
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
              >
                + เปิดล็อต
              </Link>
            </div>

            <div className="divide-y divide-zinc-100">
              {lots.length === 0 ? (
                <p className="text-xs text-zinc-400 py-6 text-center">
                  ยังไม่มีรหัสล็อตหิน
                </p>
              ) : (
                lots.slice(0, 4).map((lot) => {
                  const lotProds = products.filter((p) => p.lot_id === lot.id);
                  const lotWeight = lotProds.reduce((sum, p) => sum + (Number(p.weight_grams) || 0), 0);
                  return (
                    <Link
                      key={lot.id}
                      href={`/products?lot=${lot.id}`}
                      className="block py-3 first:pt-0 last:pb-0 hover:bg-zinc-50/70 -mx-2 px-2 rounded-xl transition"
                    >
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="font-mono text-zinc-900">
                          {lot.lot_code}
                        </span>
                        <span className="text-zinc-900 tabular-nums">
                          ฿{lot.total_cost.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
                        <span>
                          {lotProds.length} ชิ้น
                          {lot.total_weight_grams ? ` · ${lotWeight.toLocaleString()}/${lot.total_weight_grams.toLocaleString()}g` : ''}
                        </span>
                        <span className="text-zinc-500">ดูสินค้า</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal: Configure Custom Low-Stock Alerts */}
      {showLowStockModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="px-5 py-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-black flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  <span>ตั้งค่าแจ้งเตือนของใกล้หมด</span>
                </h3>
                <p className="text-[11px] text-amber-100 mt-0.5">
                  เลือกรายการที่ต้องการให้แจ้งเตือนและกำหนดจำนวนขั้นต่ำได้เอง (รายการที่ไม่ได้เลือกจะไม่แจ้งเตือน)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLowStockModal(false)}
                className="p-2 rounded-full hover:bg-white/10 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 border-b border-slate-100 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={lowStockSearch}
                  onChange={(e) => setLowStockSearch(e.target.value)}
                  placeholder="ค้นหา SKU, ชื่อสินค้า, แพ็คเกจ, ของแถม หรือขาตั้ง..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {(
                  [
                    { key: 'ALL', label: 'ทั้งหมด' },
                    {
                      key: 'SELECTED',
                      label: `ที่เลือกไว้ (${Object.keys(draftLowStockRules).length})`,
                    },
                    { key: 'PACKAGING', label: 'แพ็คเกจจิ้ง' },
                    { key: 'GIFT_NON_STONE', label: 'ของแถม' },
                    { key: 'STONE_FREEBIE', label: 'หินของแถม' },
                    { key: 'STAND', label: 'ขาตั้ง' },
                    { key: 'STONE_SALE', label: 'หินขาย' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setLowStockFilterCat(tab.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                      lowStockFilterCat === tab.key
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-slate-50/70 space-y-2">
              {filteredConfigProducts.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  ไม่พบรายการที่ตรงกับการค้นหา
                </div>
              ) : (
                filteredConfigProducts.map((item) => {
                  const enabled = typeof draftLowStockRules[item.id] === 'number';
                  const threshold = enabled ? draftLowStockRules[item.id] : 10;
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-2xl border bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                        enabled ? 'border-amber-400 ring-1 ring-amber-400/30' : 'border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleLowStockRule(item)}
                        className="flex items-center gap-3 min-w-0 text-left flex-1"
                      >
                        <div
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition ${
                            enabled
                              ? 'bg-amber-600 border-amber-600 text-white'
                              : 'bg-slate-50 border-slate-300 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {item.sku}
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {item.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {item.stone_type || '-'} • คงเหลือปัจจุบัน{' '}
                            <strong className="text-slate-700">{item.qty_on_hand ?? 0} ชิ้น</strong>
                          </p>
                        </div>
                      </button>

                      {enabled && (
                        <div className="flex items-center gap-2 shrink-0 pl-9 sm:pl-0">
                          <span className="text-[11px] font-bold text-amber-900 whitespace-nowrap">
                            แจ้งเตือนเมื่อเหลือ ≤
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={threshold}
                            onChange={(e) => updateDraftThreshold(item.id, e.target.value)}
                            className="w-20 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50/50 text-center text-xs font-black text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          <span className="text-[11px] text-slate-500">ชิ้น</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-5 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <span className="text-xs font-bold text-slate-600">
                เลือกแจ้งเตือนทั้งหมด{' '}
                <strong className="text-amber-700">
                  {Object.keys(draftLowStockRules).length} รายการ
                </strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLowStockModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={savingLowStockRules}
                  onClick={handleSaveLowStockRules}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-sm disabled:opacity-50 transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingLowStockRules ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าแจ้งเตือน'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
