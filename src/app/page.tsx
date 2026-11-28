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
import {
  Product,
  Expense,
  StockLot,
  Order,
  STATUS_CONFIG,
  ORDER_STATUS_CONFIG,
  SALES_CHANNELS_CONFIG,
  SalesChannel,
} from '@/types';
import {
  Receipt,
  PlusCircle,
  ArrowRight,
  ShoppingBag,
  Settings,
  Bell,
  Search,
  X,
  Save,
  Check,
  Gem,
  Gift,
  Layers,
  Box,
} from 'lucide-react';

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [lots, setLots] = useState<StockLot[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [damagedLoss, setDamagedLoss] = useState<number>(0);
  const [damagedCount, setDamagedCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [chartRange, setChartRange] = useState<'14D' | '6M'>('14D');

  // Custom low-stock alert rules (productId -> min qty threshold)
  const [lowStockRules, setLowStockRules] = useState<Record<string, number>>({});
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [draftLowStockRules, setDraftLowStockRules] = useState<Record<string, number>>({});
  const [lowStockSearch, setLowStockSearch] = useState('');
  const [lowStockFilterCat, setLowStockFilterCat] = useState<
    'ALL' | 'SELECTED' | WarehouseCategory
  >('ALL');
  const [savingLowStockRules, setSavingLowStockRules] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [p, e, l, o, d, s] = await Promise.all([
          fetchProducts(),
          fetchExpenses(),
          fetchStockLots(),
          fetch('/api/orders', { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
          fetch('/api/products/handle-damaged')
            .then((r) => r.json())
            .catch(() => ({ totalDamagedLoss: 0, count: 0 })),
          fetch('/api/settings', { cache: 'no-store' })
            .then((r) => r.json())
            .catch(() => ({ lowStockRules: {} })),
        ]);
        setProducts(p);
        setExpenses(e);
        setLots(l);
        setOrders(Array.isArray(o) ? o : []);
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

  const currentMonthPrefix = new Date().toISOString().slice(0, 7);

  // Expenses metrics
  const thisMonthExpenses = useMemo(
    () => expenses.filter((e) => (e.expense_date || '').startsWith(currentMonthPrefix)),
    [expenses, currentMonthPrefix]
  );
  const totalExpenseThisMonth = useMemo(
    () => thisMonthExpenses.reduce((sum, e) => sum + Number(e.total_amount || 0), 0),
    [thisMonthExpenses]
  );
  const stoneExpenseThisMonth = useMemo(
    () =>
      thisMonthExpenses
        .filter((e) => e.category === 'STOCK_LOT')
        .reduce((sum, e) => sum + Number(e.total_amount || 0), 0),
    [thisMonthExpenses]
  );
  const otherExpenseThisMonth = totalExpenseThisMonth - stoneExpenseThisMonth;

  // Orders & Revenue metrics
  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== 'CANCELLED'),
    [orders]
  );
  const thisMonthOrders = useMemo(
    () =>
      activeOrders.filter((o) =>
        (o.order_date || o.created_at || '').startsWith(currentMonthPrefix)
      ),
    [activeOrders, currentMonthPrefix]
  );
  const totalRevenue = useMemo(
    () => activeOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
    [activeOrders]
  );
  const totalOrderProfit = useMemo(
    () => activeOrders.reduce((sum, o) => sum + Number(o.profit || 0), 0),
    [activeOrders]
  );
  const monthRevenue = useMemo(
    () => thisMonthOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
    [thisMonthOrders]
  );
  const monthProfit = useMemo(
    () => thisMonthOrders.reduce((sum, o) => sum + Number(o.profit || 0), 0),
    [thisMonthOrders]
  );
  const marginPct = totalRevenue > 0 ? Math.round((totalOrderProfit / totalRevenue) * 100) : 0;

  // Order Pipeline Counts
  const orderPipeline = useMemo(() => {
    const counts = {
      PENDING: 0,
      OPEN_BOX: 0,
      WAITING_PAYMENT: 0,
      PAID: 0,
      SHIPPED: 0,
    };
    for (const o of activeOrders) {
      if (o.status in counts) {
        counts[o.status as keyof typeof counts]++;
      }
    }
    return counts;
  }, [activeOrders]);

  // Top Sales Channels
  const channelBreakdown = useMemo(() => {
    const map = new Map<SalesChannel, { count: number; amount: number }>();
    for (const o of activeOrders) {
      const ch = (o.channel || 'OTHER') as SalesChannel;
      const prev = map.get(ch) || { count: 0, amount: 0 };
      map.set(ch, {
        count: prev.count + 1,
        amount: prev.amount + (Number(o.total_amount) || 0),
      });
    }
    return Array.from(map.entries())
      .map(([channel, stats]) => ({ channel, ...stats }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [activeOrders]);

  // 5 Mutually Exclusive Warehouses
  const stoneProducts = useMemo(() => products.filter(isStoneProduct), [products]);
  const stoneFreebies = useMemo(() => products.filter(isStoneFreebie), [products]);
  const nonStoneFreebies = useMemo(() => products.filter(isNonStoneFreebie), [products]);
  const standItems = useMemo(() => products.filter(isStandItem), [products]);
  const packagingItems = useMemo(() => products.filter(isPackagingItem), [products]);

  const inStockStones = useMemo(
    () => stoneProducts.filter((p) => p.status !== 'SOLD' && Number(p.qty_on_hand ?? 0) > 0),
    [stoneProducts]
  );
  const availableStoneUnits = useMemo(
    () =>
      inStockStones
        .filter((p) => p.status === 'AVAILABLE')
        .reduce((sum, p) => sum + Number(p.qty_on_hand ?? 0), 0),
    [inStockStones]
  );
  const totalCostInStock = useMemo(
    () =>
      inStockStones.reduce(
        (sum, p) => sum + Number(p.cost_price || 0) * Number(p.qty_on_hand ?? 0),
        0
      ),
    [inStockStones]
  );
  const totalSellingInStock = useMemo(
    () =>
      inStockStones.reduce(
        (sum, p) => sum + Number(p.selling_price || 0) * Number(p.qty_on_hand ?? 0),
        0
      ),
    [inStockStones]
  );

  // Chart Series: Sales vs Expenses (14 Days or 6 Months)
  const chartData = useMemo(() => {
    const buckets: Array<{ key: string; label: string; sales: number; expense: number }> = [];
    const now = new Date();

    if (chartRange === '14D') {
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        buckets.push({ key, label, sales: 0, expense: 0 });
      }
      for (const o of activeOrders) {
        const k = (o.order_date || o.created_at || '').slice(0, 10);
        const b = buckets.find((x) => x.key === k);
        if (b) b.sales += Number(o.total_amount || 0);
      }
      for (const e of expenses) {
        const k = (e.expense_date || '').slice(0, 10);
        const b = buckets.find((x) => x.key === k);
        if (b) b.expense += Number(e.total_amount || 0);
      }
    } else {
      const monthNames = [
        'ม.ค.',
        'ก.พ.',
        'มี.ค.',
        'เม.ย.',
        'พ.ค.',
        'มิ.ย.',
        'ก.ค.',
        'ส.ค.',
        'ก.ย.',
        'ต.ค.',
        'พ.ย.',
        'ธ.ค.',
      ];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = monthNames[d.getMonth()];
        buckets.push({ key, label, sales: 0, expense: 0 });
      }
      for (const o of activeOrders) {
        const k = (o.order_date || o.created_at || '').slice(0, 7);
        const b = buckets.find((x) => x.key === k);
        if (b) b.sales += Number(o.total_amount || 0);
      }
      for (const e of expenses) {
        const k = (e.expense_date || '').slice(0, 7);
        const b = buckets.find((x) => x.key === k);
        if (b) b.expense += Number(e.total_amount || 0);
      }
    }

    const maxVal = Math.max(
      1,
      ...buckets.map((b) => Math.max(b.sales, b.expense))
    );
    return { buckets, maxVal };
  }, [activeOrders, expenses, chartRange]);

  // Custom low-stock alert rules
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

  const warehouseSummary = useMemo(() => {
    const sumUnits = (list: Product[]) =>
      list.reduce((s, p) => s + (Number(p.qty_on_hand) || 0), 0);
    return [
      {
        href: '/products',
        label: 'คลังหินขาย',
        icon: Gem,
        skus: inStockStones.length,
        units: sumUnits(inStockStones),
      },
      {
        href: '/stone-freebies',
        label: 'คลังหินของแถม',
        icon: Gem,
        skus: stoneFreebies.length,
        units: sumUnits(stoneFreebies),
      },
      {
        href: '/freebies',
        label: 'คลังของแถม',
        icon: Gift,
        skus: nonStoneFreebies.length,
        units: sumUnits(nonStoneFreebies),
      },
      {
        href: '/stands',
        label: 'คลังขาตั้ง',
        icon: Layers,
        skus: standItems.length,
        units: sumUnits(standItems),
      },
      {
        href: '/packaging',
        label: 'คลังแพ็คเกจจิ้ง',
        icon: Box,
        skus: packagingItems.length,
        units: sumUnits(packagingItems),
      },
    ];
  }, [inStockStones, stoneFreebies, nonStoneFreebies, standItems, packagingItems]);

  return (
    <div className="min-h-screen flex flex-col pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-16 bg-[#fafafa] md:pl-64 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0">
      <Navbar />

      <main className="max-w-6xl w-full mx-auto px-5 sm:px-8 lg:px-10 py-8 sm:py-10 space-y-7 flex-1">
        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-zinc-200">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900">
              แดชบอร์ดภาพรวม
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1">
              สรุปยอดขาย ต้นทุน กำไร และสต็อกทั้ง 5 คลังแบบเรียลไทม์
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/orders"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs sm:text-sm font-medium transition"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>+ เปิดบิลขาย</span>
            </Link>
            <Link
              href="/products/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-xs sm:text-sm font-medium transition"
            >
              <PlusCircle className="w-4 h-4 text-zinc-500" />
              <span>+ รับหินเข้า</span>
            </Link>
            <Link
              href="/expenses"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-xs sm:text-sm font-medium transition"
            >
              <Receipt className="w-4 h-4 text-zinc-500" />
              <span>+ ค่าใช้จ่าย</span>
            </Link>
          </div>
        </div>

        {/* Row 1: 4 Primary Financial & Inventory KPIs */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white p-5 rounded-2xl border border-zinc-200 h-32 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500">ยอดขายรวม</span>
                <span className="text-[11px] text-zinc-400 tabular-nums">
                  {activeOrders.length} บิล
                </span>
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">
                  ฿{Math.round(totalRevenue).toLocaleString()}
                </div>
                <p className="text-[11px] text-zinc-500 mt-2 pt-2 border-t border-zinc-100 tabular-nums">
                  เดือนนี้ ฿{Math.round(monthRevenue).toLocaleString()} ({thisMonthOrders.length} บิล)
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500">กำไรจากบิลขาย</span>
                <span className="text-[11px] font-medium text-emerald-700 tabular-nums">
                  Margin {marginPct}%
                </span>
              </div>
              <div>
                <div
                  className={`text-2xl font-semibold tracking-tight tabular-nums ${
                    totalOrderProfit >= 0 ? 'text-zinc-900' : 'text-rose-600'
                  }`}
                >
                  ฿{Math.round(totalOrderProfit).toLocaleString()}
                </div>
                <p className="text-[11px] text-emerald-700 mt-2 pt-2 border-t border-zinc-100 tabular-nums">
                  เดือนนี้ ฿{Math.round(monthProfit).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 flex flex-col justify-between gap-3">
              <span className="text-xs font-medium text-zinc-500">รายจ่ายเดือนนี้</span>
              <div>
                <div className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">
                  ฿{Math.round(totalExpenseThisMonth).toLocaleString()}
                </div>
                <p className="text-[11px] text-zinc-500 mt-2 pt-2 border-t border-zinc-100 tabular-nums">
                  หิน ฿{Math.round(stoneExpenseThisMonth).toLocaleString()} · อื่นๆ ฿
                  {Math.round(otherExpenseThisMonth).toLocaleString()}
                  {damagedLoss > 0 ? ` · เสีย -฿${Math.round(damagedLoss).toLocaleString()}` : ''}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500">มูลค่าหินในสต็อก</span>
                <span className="text-[11px] text-zinc-400 tabular-nums">
                  พร้อมขาย {availableStoneUnits}
                </span>
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">
                  ฿{Math.round(totalCostInStock).toLocaleString()}
                </div>
                <p className="text-[11px] text-zinc-500 mt-2 pt-2 border-t border-zinc-100 tabular-nums">
                  มูลค่าขาย ฿{Math.round(totalSellingInStock).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Row 2: Custom Low Stock Alert Bar */}
        {!loading && lowStockItems.length > 0 && (
          <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
            <button
              type="button"
              onClick={openLowStockModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 text-xs font-medium transition shrink-0"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>ตั้งค่าแจ้งเตือน</span>
            </button>
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

        {/* Row 3: Sales vs Expenses Chart + Order Pipeline & 5-Warehouse Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 cols: Chart + Order Pipeline */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-200 flex flex-col justify-between space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  รายรับเทียบรายจ่าย
                </h3>
                <div className="flex items-center gap-4 text-[11px] text-zinc-500 mt-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-zinc-900 inline-block" />
                    ยอดขาย
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-zinc-300 inline-block" />
                    รายจ่าย
                  </span>
                </div>
              </div>

              <div className="inline-flex items-center bg-zinc-100 p-1 rounded-xl self-start">
                <button
                  type="button"
                  onClick={() => setChartRange('14D')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    chartRange === '14D'
                      ? 'bg-white text-zinc-900'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  14 วันล่าสุด
                </button>
                <button
                  type="button"
                  onClick={() => setChartRange('6M')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    chartRange === '6M'
                      ? 'bg-white text-zinc-900'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  6 เดือน
                </button>
              </div>
            </div>

            {/* Minimal Dual-Bar Chart */}
            <div className="h-44 flex items-end gap-1.5 sm:gap-2.5 pt-4 border-b border-zinc-200 pb-2">
              {chartData.buckets.map((b) => {
                const salesH = Math.max(b.sales > 0 ? 6 : 0, Math.round((b.sales / chartData.maxVal) * 100));
                const expH = Math.max(b.expense > 0 ? 6 : 0, Math.round((b.expense / chartData.maxVal) * 100));
                return (
                  <div
                    key={b.key}
                    className="flex-1 h-full flex flex-col items-center justify-end gap-1.5 group relative"
                    title={`${b.label}: ขาย ฿${b.sales.toLocaleString()} / จ่าย ฿${b.expense.toLocaleString()}`}
                  >
                    <div className="w-full flex-1 flex items-end justify-center gap-0.5 sm:gap-1">
                      <div
                        style={{ height: `${salesH}%` }}
                        className="w-2 sm:w-3 bg-zinc-900 rounded-t-sm transition-all"
                      />
                      <div
                        style={{ height: `${expH}%` }}
                        className="w-2 sm:w-3 bg-zinc-300 rounded-t-sm transition-all"
                      />
                    </div>
                    <span className="text-[10px] text-zinc-400 tabular-nums truncate max-w-full">
                      {b.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Order Pipeline Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
              {(
                [
                  { key: 'PENDING', label: 'รอดำเนินการ' },
                  { key: 'OPEN_BOX', label: 'เปิดกล่องสะสม' },
                  { key: 'WAITING_PAYMENT', label: 'รอชำระเงิน' },
                  { key: 'PAID', label: 'รอแพ็ค/ส่ง' },
                  { key: 'SHIPPED', label: 'ส่งแล้ว' },
                ] as const
              ).map((st) => (
                <Link
                  key={st.key}
                  href="/orders"
                  className="px-3 py-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 transition"
                >
                  <div className="text-[11px] text-zinc-500">{st.label}</div>
                  <div className="text-lg font-semibold text-zinc-900 tabular-nums mt-0.5">
                    {orderPipeline[st.key]}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Right 1 col: 5-Warehouse Breakdown & Top Channels */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-900">สรุปทั้ง 5 คลัง</h3>
                <span className="text-[11px] text-zinc-400 tabular-nums">
                  {products.length} รายการรวม
                </span>
              </div>
              <div className="divide-y divide-zinc-100">
                {warehouseSummary.map((w) => {
                  const Icon = w.icon;
                  return (
                    <Link
                      key={w.href}
                      href={w.href}
                      className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 hover:bg-zinc-50 -mx-2 px-2 rounded-lg transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 text-zinc-400 shrink-0" />
                        <span className="text-xs font-medium text-zinc-800 truncate">
                          {w.label}
                        </span>
                      </div>
                      <div className="text-right text-xs tabular-nums shrink-0">
                        <span className="font-semibold text-zinc-900">{w.units}</span>
                        <span className="text-zinc-400 ml-1">ชิ้น ({w.skus})</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-zinc-200 space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-900">ช่องทางขาย</h3>
                <Link href="/orders" className="text-[11px] text-zinc-500 hover:text-zinc-900">
                  ดูทั้งหมด
                </Link>
              </div>
              {channelBreakdown.length === 0 ? (
                <p className="text-xs text-zinc-400 py-3 text-center">ยังไม่มีข้อมูลการขาย</p>
              ) : (
                <div className="space-y-2.5">
                  {channelBreakdown.map((ch) => {
                    const label = SALES_CHANNELS_CONFIG[ch.channel]?.label || ch.channel;
                    const pct = totalRevenue > 0 ? Math.round((ch.amount / totalRevenue) * 100) : 0;
                    return (
                      <div key={ch.channel} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-700 truncate">{label}</span>
                          <span className="font-medium text-zinc-900 tabular-nums shrink-0">
                            ฿{Math.round(ch.amount).toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full bg-zinc-900 rounded-full"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 4: Recent Orders, Recent Stones & Active Stock Lots */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Orders */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="font-semibold text-zinc-900 text-sm">บิลขายล่าสุด</h3>
              <Link
                href="/orders"
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
              >
                ทั้งหมด <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {activeOrders.length === 0 ? (
              <p className="text-xs text-zinc-400 py-8 text-center">ยังไม่มีบิลขาย</p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {activeOrders.slice(0, 5).map((ord) => {
                  const stCfg = ORDER_STATUS_CONFIG[ord.status] || ORDER_STATUS_CONFIG.PENDING;
                  return (
                    <Link
                      key={ord.id || ord.order_no}
                      href="/orders"
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-zinc-50 -mx-2 px-2 rounded-lg transition"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-medium text-zinc-800">
                            {ord.order_no}
                          </span>
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${stCfg.badgeClass}`}>
                            {stCfg.label.split(' (')[0]}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">
                          {ord.customer_name}
                        </p>
                      </div>
                      <span className="font-semibold text-xs text-zinc-900 tabular-nums shrink-0">
                        ฿{Number(ord.total_amount || 0).toLocaleString()}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Latest Added Stones */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="font-semibold text-zinc-900 text-sm">หินรับเข้าล่าสุด</h3>
              <Link
                href="/products"
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
              >
                ทั้งหมด <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {stoneProducts.length === 0 ? (
              <div className="py-8 text-center text-zinc-400">
                <p className="text-xs">ยังไม่มีรายการหินในสต็อก</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {stoneProducts.slice(0, 5).map((p) => {
                  const statusInfo = STATUS_CONFIG[p.status] || STATUS_CONFIG.AVAILABLE;
                  const thumb =
                    p.r2_thumbnail_url ||
                    'https://images.unsplash.com/photo-1598887142487-3c854d51d2c7?auto=format&fit=crop&w=300&q=80';
                  return (
                    <div
                      key={p.id}
                      className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3"
                    >
                      <img
                        src={thumb}
                        alt={p.name}
                        className="w-10 h-10 rounded-lg object-cover shrink-0 border border-zinc-200"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-zinc-500">{p.sku}</span>
                          <span className={`text-[9px] font-medium px-1.5 py-0.2 rounded ${statusInfo.badgeClass}`}>
                            {statusInfo.label.split(' (')[0]}
                          </span>
                        </div>
                        <h4 className="font-medium text-xs text-zinc-900 truncate mt-0.5">
                          {p.name}
                        </h4>
                      </div>
                      <span className="font-semibold text-xs text-zinc-900 tabular-nums shrink-0">
                        ฿{p.selling_price.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Stock Lots */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="font-semibold text-zinc-900 text-sm">ล็อตนำเข้า</h3>
              <Link
                href="/expenses"
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
              >
                + เปิดล็อต
              </Link>
            </div>
            <div className="divide-y divide-zinc-100">
              {lots.length === 0 ? (
                <p className="text-xs text-zinc-400 py-8 text-center">ยังไม่มีรหัสล็อตหิน</p>
              ) : (
                lots.slice(0, 5).map((lot) => {
                  const lotProds = products.filter((p) => p.lot_id === lot.id);
                  const lotWeight = lotProds.reduce(
                    (sum, p) => sum + (Number(p.weight_grams) || 0),
                    0
                  );
                  return (
                    <Link
                      key={lot.id}
                      href={`/products?lot=${lot.id}`}
                      className="block py-2.5 first:pt-0 last:pb-0 hover:bg-zinc-50 -mx-2 px-2 rounded-lg transition"
                    >
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="font-mono text-zinc-900">{lot.lot_code}</span>
                        <span className="text-zinc-900 tabular-nums">
                          ฿{lot.total_cost.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                        <span>
                          {lotProds.length} ชิ้น
                          {lot.total_weight_grams
                            ? ` · ${lotWeight.toLocaleString()}/${lot.total_weight_grams.toLocaleString()}g`
                            : ''}
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
        <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-3xl w-full border border-zinc-200 overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-zinc-500" />
                  <span>ตั้งค่าแจ้งเตือนของใกล้หมด</span>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  เลือกเฉพาะรายการที่ต้องการให้แจ้งเตือนและกำหนดจำนวนขั้นต่ำ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLowStockModal(false)}
                className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 border-b border-zinc-100 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={lowStockSearch}
                  onChange={(e) => setLowStockSearch(e.target.value)}
                  placeholder="ค้นหา SKU, ชื่อสินค้า, แพ็คเกจ, ของแถม หรือขาตั้ง..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-zinc-900"
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition border ${
                      lowStockFilterCat === tab.key
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-zinc-50/70 space-y-2">
              {filteredConfigProducts.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-400">
                  ไม่พบรายการที่ตรงกับการค้นหา
                </div>
              ) : (
                filteredConfigProducts.map((item) => {
                  const enabled = typeof draftLowStockRules[item.id] === 'number';
                  const threshold = enabled ? draftLowStockRules[item.id] : 10;
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                        enabled ? 'border-zinc-900' : 'border-zinc-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleLowStockRule(item)}
                        className="flex items-center gap-3 min-w-0 text-left flex-1"
                      >
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                            enabled
                              ? 'bg-zinc-900 border-zinc-900 text-white'
                              : 'bg-white border-zinc-300 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700">
                              {item.sku}
                            </span>
                            <span className="text-xs font-medium text-zinc-900 truncate">
                              {item.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            {item.stone_type || '-'} · คงเหลือ{' '}
                            <strong className="font-medium text-zinc-800">{item.qty_on_hand ?? 0} ชิ้น</strong>
                          </p>
                        </div>
                      </button>

                      {enabled && (
                        <div className="flex items-center gap-2 shrink-0 pl-8 sm:pl-0">
                          <span className="text-[11px] text-zinc-600 whitespace-nowrap">
                            แจ้งเมื่อเหลือ ≤
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={threshold}
                            onChange={(e) => updateDraftThreshold(item.id, e.target.value)}
                            className="w-20 px-2.5 py-1 rounded-lg border border-zinc-300 bg-zinc-50 text-center text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
                          />
                          <span className="text-[11px] text-zinc-500">ชิ้น</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-5 py-4 bg-white border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-zinc-600">
                เลือกแจ้งเตือนทั้งหมด{' '}
                <strong className="font-semibold text-zinc-900">
                  {Object.keys(draftLowStockRules).length} รายการ
                </strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLowStockModal(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={savingLowStockRules}
                  onClick={handleSaveLowStockRules}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium disabled:opacity-50 transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingLowStockRules ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
