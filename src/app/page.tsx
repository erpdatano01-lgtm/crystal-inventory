'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  fetchProducts,
  fetchExpenses,
  fetchStockLots,
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
} from 'lucide-react';

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [lots, setLots] = useState<StockLot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [p, e, l] = await Promise.all([
          fetchProducts(),
          fetchExpenses(),
          fetchStockLots(),
        ]);
        setProducts(p);
        setExpenses(e);
        setLots(l);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // 1. ยอดค่าใช้จ่ายรวมเดือนนี้
  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // e.g. "2026-11"
  const thisMonthExpenses = expenses.filter((e) =>
    e.expense_date.startsWith(currentMonthPrefix)
  );
  const totalExpenseThisMonth = thisMonthExpenses.reduce(
    (sum, e) => sum + Number(e.total_amount || 0),
    0
  );

  // 2. จำนวนหินที่พร้อมขาย (AVAILABLE)
  const availableProducts = products.filter((p) => p.status === 'AVAILABLE');
  const availableCount = availableProducts.reduce(
    (sum, p) => sum + Number(p.qty_on_hand || 1),
    0
  );

  // 3. มูลค่าต้นทุนสต็อกคงเหลือรวม (สำหรับสินค้าที่ยังไม่ขาย: AVAILABLE, PREP, IN_TRANSIT, RESERVED)
  const inStockProducts = products.filter((p) => p.status !== 'SOLD');
  const totalCostInStock = inStockProducts.reduce(
    (sum, p) => sum + Number(p.cost_price || 0) * Number(p.qty_on_hand || 1),
    0
  );

  // 4. มูลค่าราคาขายรวม (Potential Retail Value)
  const totalSellingInStock = inStockProducts.reduce(
    (sum, p) => sum + Number(p.selling_price || 0) * Number(p.qty_on_hand || 1),
    0
  );

  // 5. สินค้าขายแล้วทั้งหมด
  const soldProducts = products.filter((p) => p.status === 'SOLD');
  const totalSoldRevenue = soldProducts.reduce(
    (sum, p) => sum + Number(p.selling_price || 0),
    0
  );

  return (
    <div className="min-h-screen flex flex-col pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-12 bg-slate-50 md:pl-64 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0">
      <Navbar />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        {/* Banner with Greeting */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <span className="px-3 py-1 bg-white/10 backdrop-blur rounded-full text-xs font-semibold text-purple-200 border border-white/10">
              💎 Vivida Crystal Management System
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold mt-2.5 tracking-tight">
              Vivida Crystal - ภาพรวมสต็อกหิน & บัญชี
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              ติดตามมูลค่าสินค้าในร้าน ค่าใช้จ่ายนำเข้าล็อต และภาพรวมการขายแบบเรียลไทม์
            </p>
          </div>
        </div>

        {/* 3 Big Action Shortcut Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/orders"
            className="group p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-3xl shadow-md hover:shadow-xl hover:from-emerald-700 hover:to-teal-700 transition flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center group-hover:scale-110 transition shrink-0">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
                  ระบบขาย & ออกบิล
                </span>
                <h3 className="text-lg font-bold text-white">
                  + เปิดบิลขาย & บัญชี
                </h3>
                <p className="text-xs text-emerald-100">
                  ตัดสต็อกอัตโนมัติ พิมพ์ใบเสร็จ A4 คำนวณกำไร-ขาดทุน FlowAccount
                </p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 text-emerald-200 group-hover:translate-x-1.5 transition" />
          </Link>

          <Link
            href="/products/new"
            className="group p-5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-3xl shadow-md hover:shadow-xl hover:from-purple-700 hover:to-indigo-700 transition flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center group-hover:scale-110 transition shrink-0">
                <PlusCircle className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-200">
                  รับสินค้าใหม่
                </span>
                <h3 className="text-lg font-bold text-white">
                  + เพิ่มหินเข้าสต็อก
                </h3>
                <p className="text-xs text-purple-100">
                  ผูก Lot นำเข้า เจน SKU อัตโนมัติ ถ่ายรูป WebP และแนบลิงก์คลิป
                </p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 text-purple-200 group-hover:translate-x-1.5 transition" />
          </Link>

          <Link
            href="/expenses"
            className="group p-5 bg-white rounded-3xl border-2 border-purple-100 hover:border-purple-400 hover:shadow-lg transition flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-110 transition shrink-0">
                <Receipt className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">
                  รายจ่าย & ล็อตใหม่
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  + บันทึกบิลค่าใช้จ่าย
                </h3>
                <p className="text-xs text-slate-500">
                  แนบสลิปผ่าน R2 และเปิดรหัส Lot นำเข้าหินอัตโนมัติ
                </p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 text-purple-400 group-hover:translate-x-1.5 transition" />
          </Link>
        </div>

        {/* 4 Core Summary Cards (Exact required metrics) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Card 1: ค่าใช้จ่ายรวมเดือนนี้ */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                ยอดค่าใช้จ่ายเดือนนี้
              </span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-rose-600">
                ฿{totalExpenseThisMonth.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                {thisMonthExpenses.length} รายการในเดือนนี้
              </span>
            </div>
          </div>

          {/* Card 2: จำนวนหินที่พร้อมขาย (AVAILABLE) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                หินพร้อมขาย (AVAILABLE)
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <PackageCheck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600">
                {availableCount} <span className="text-sm font-semibold text-slate-500">ชิ้น</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                จากทั้งหมด {products.length} รายการในระบบ
              </span>
            </div>
          </div>

          {/* Card 3: มูลค่าต้นทุนสต็อกคงเหลือรวม */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                ต้นทุนสต็อกคงเหลือรวม
              </span>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900">
                ฿{totalCostInStock.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                {inStockProducts.length} รายการที่ยังไม่ขาย
              </span>
            </div>
          </div>

          {/* Card 4: มูลค่าราคาขายรวม */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                มูลค่าราคาขายรวม
              </span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-indigo-700">
                ฿{totalSellingInStock.toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
                กำไรคาดการณ์ ฿{(totalSellingInStock - totalCostInStock).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Products & Lots Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Latest Added Products (2 cols) */}
          <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                หินที่รับเข้าสต็อกล่าสุด
              </h3>
              <Link
                href="/products"
                className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1"
              >
                ดูคลังสินค้าทั้งหมด <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {products.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Sparkles className="w-8 h-8 text-purple-300 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-600">ยังไม่มีรายการหินในสต็อก</p>
                <Link href="/products/new" className="text-xs text-purple-600 font-bold hover:underline mt-1 inline-block">
                  + เพิ่มหินชิ้นแรกเลย
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {products.slice(0, 4).map((p) => {
                  const statusInfo = STATUS_CONFIG[p.status] || STATUS_CONFIG.AVAILABLE;
                  const thumb = p.r2_thumbnail_url || 'https://images.unsplash.com/photo-1598887142487-3c854d51d2c7?auto=format&fit=crop&w=300&q=80';

                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-2xl border border-slate-100 hover:border-purple-200 bg-slate-50/50 hover:bg-white transition flex items-center gap-3"
                    >
                      <img
                        src={thumb}
                        alt={p.name}
                        className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-200"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-mono text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                            {p.sku}
                          </span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${statusInfo.badgeClass}`}>
                            {statusInfo.label.split(' (')[0]}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-800 truncate">
                          {p.name}
                        </h4>
                        <div className="flex items-center justify-between mt-1 text-xs">
                          <span className="text-slate-500">{p.stone_type}</span>
                          <span className="font-bold text-slate-900">
                            ฿{p.selling_price.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Stock Lots (1 col) */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                ล็อตหินนำเข้า (Stock Lots)
              </h3>
              <Link
                href="/expenses"
                className="text-xs font-semibold text-purple-700 hover:text-purple-900"
              >
                + เปิดล็อตใหม่
              </Link>
            </div>

            <div className="space-y-2.5">
              {lots.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  ยังไม่มีรหัสล็อตหิน
                </p>
              ) : (
                lots.slice(0, 4).map((lot) => (
                  <div
                    key={lot.id}
                    className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="font-mono text-purple-800">{lot.lot_code}</span>
                      <span className="text-slate-900">
                        ฿{lot.total_cost.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>น้ำหนัก: {lot.total_weight_grams ? `${lot.total_weight_grams} g` : '-'}</span>
                      {lot.drive_lot_folder_url && (
                        <a
                          href={lot.drive_lot_folder_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-600 hover:underline flex items-center gap-0.5"
                        >
                          Google Drive <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
