'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  fetchProducts,
  isStandItem,
  formatUnitCost,
} from '@/lib/inventoryService';
import { Product, ProductStatus } from '@/types';
import {
  Layers,
  Search,
  Plus,
  Minus,
  Pencil,
  X,
  Save,
  ArrowRight,
  DollarSign,
  Package,
  ExternalLink,
} from 'lucide-react';

const STAND_RECEIPT_URLS: Record<string, string> = {
  'STN-ACR-S': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_38.jpg',
  'STN-GLS-04': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_50.jpg',
  'STN-GLS-06': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_50.jpg',
  'STN-GLS-07': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_50.jpg',
  'STN-SPH-S': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_51.jpg',
  'STN-SPH-M': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_51.jpg',
  'STN-SPH-L': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_51.jpg',
  'STN-MIN-S': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_56.jpg',
  'STN-MIN-M': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_56.jpg',
  'STN-PRP-02': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_65.jpg',
  'STN-PRP-N': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_65.jpg',
};

export default function StandsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [editQty, setEditQty] = useState<string>('1');
  const [editCost, setEditCost] = useState<string>('0');
  const [editSell, setEditSell] = useState<string>('0');
  const [editName, setEditName] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchProducts();
      setProducts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const standList = useMemo(() => {
    return products.filter((p) => isStandItem(p));
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    standList.forEach((p) => {
      if (p.stone_type) set.add(p.stone_type);
    });
    return Array.from(set).sort();
  }, [standList]);

  const filteredList = useMemo(() => {
    return standList.filter((item) => {
      if (selectedCategory !== 'ALL' && item.stone_type !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.sku.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          (item.stone_type || '').toLowerCase().includes(q) ||
          (item.grade_origin || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [standList, selectedCategory, searchQuery]);

  const totalUnits = useMemo(
    () => standList.reduce((s, p) => s + (Number(p.qty_on_hand) || 0), 0),
    [standList]
  );

  const totalCostValue = useMemo(
    () =>
      standList.reduce(
        (s, p) => s + (Number(p.cost_price) || 0) * (Number(p.qty_on_hand) || 0),
        0
      ),
    [standList]
  );

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
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, qty_on_hand: newQty, status: nextStatus } : p
          )
        );
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const openEdit = (item: Product) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditQty(String(item.qty_on_hand ?? 0));
    setEditCost(String(item.cost_price ?? 0));
    setEditSell(String(item.selling_price ?? 0));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSavingEdit(true);
    try {
      const qtyNum = Math.max(0, parseInt(editQty, 10) || 0);
      const costNum = Math.max(0, parseFloat(editCost) || 0);
      const sellNum = Math.max(0, parseFloat(editSell) || 0);
      const nextStatus: ProductStatus = qtyNum === 0 ? 'SOLD' : 'AVAILABLE';

      const res = await fetch(`/api/products?id=${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim() || editingItem.name,
          qty_on_hand: qtyNum,
          cost_price: costNum,
          selling_price: sellNum,
          status: nextStatus,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProducts((prev) =>
          prev.map((p) => (p.id === editingItem.id ? { ...p, ...updated } : p))
        );
        setEditingItem(null);
      } else {
        alert('บันทึกไม่สำเร็จ');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-12 md:pl-64 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-800 via-purple-800 to-slate-900 text-white p-6 sm:p-7 rounded-3xl shadow-lg">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-bold">
              <Layers className="w-3.5 h-3.5" />
              <span>รหัสหมวด STN-* • ขาตั้ง, ฐานลูกแก้ว และพร็อพแท่นวาง</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              คลังขาตั้ง &amp; ฐานวางหิน
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100 max-w-xl">
              รวมสต็อกขาตั้งอะคริลิค ฐานแก้วลูกแก้ว แท่นวางมินิมอล และชุดพร็อพ พร้อมต้นทุนสุทธิจริงหลังหักส่วนลด Shopee
            </p>
          </div>

          <Link
            href="/products"
            className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-semibold text-xs sm:text-sm transition flex items-center gap-2 shrink-0"
          >
            <span>💎 สลับไปคลังหิน</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 3 Summary KPI Cards */}
        <div className="grid grid-cols-3 gap-3.5 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-500">รายการแบบขาตั้ง</span>
              <Layers className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {standList.length}
            </div>
            <span className="text-[11px] text-slate-400">SKU (STN-*)</span>
          </div>

          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-500">จำนวนคงเหลือรวม</span>
              <Package className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-purple-700">
              {totalUnits}
            </div>
            <span className="text-[11px] text-slate-400">ชิ้น / ชุด</span>
          </div>

          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-500">มูลค่าต้นทุนสุทธิรวม</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700">
              ฿{totalCostValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-slate-400">อ้างอิงตามบิล Shopee</span>
          </div>
        </div>

        {/* Search & Category Pills */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหา SKU (เช่น STN-GLS-04), ชื่อขาตั้ง, หรือร้านค้า..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl shrink-0 transition ${
                selectedCategory === 'ALL'
                  ? 'bg-indigo-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({standList.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl shrink-0 transition ${
                  selectedCategory === cat
                    ? 'bg-indigo-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat} ({standList.filter((p) => p.stone_type === cat).length})
              </button>
            ))}
          </div>
        </div>

        {/* Cards Grid */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">กำลังโหลดข้อมูล...</div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm bg-white rounded-3xl border border-slate-200">
            ไม่พบรายการขาตั้งที่ตรงกับเงื่อนไข
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredList.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition"
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.r2_thumbnail_url ? (
                        <a
                          href={item.r2_thumbnail_url}
                          target="_blank"
                          rel="noreferrer"
                          title="ดูรูปใบเสร็จ Shopee"
                          className="shrink-0"
                        >
                          <img
                            src={item.r2_thumbnail_url}
                            alt={item.name}
                            className="w-14 h-14 rounded-2xl object-cover border border-slate-200"
                          />
                        </a>
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                          <Layers className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-black text-indigo-700 block">
                          {item.sku}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 line-clamp-2">
                          {item.name}
                        </h3>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                          {item.stone_type}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition shrink-0"
                      title="แก้ไขข้อมูล / ตั้งราคาขาย"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  {item.grade_origin && (
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>{item.grade_origin}</span>
                      {(STAND_RECEIPT_URLS[item.sku] || item.r2_thumbnail_url) && (
                        <a
                          href={STAND_RECEIPT_URLS[item.sku] || item.r2_thumbnail_url!}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold"
                        >
                          <span>ดูใบเสร็จ</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-slate-400">ทุนสุทธิ/ชิ้น</p>
                    <p className="text-sm font-black text-emerald-700">
                      ฿{formatUnitCost(Number(item.cost_price) || 0)}
                    </p>
                    {Number(item.selling_price) > 0 && (
                      <p className="text-[10px] font-bold text-purple-700">
                        ขาย ฿{Number(item.selling_price).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      disabled={updatingId === item.id || (item.qty_on_hand || 0) <= 0}
                      onClick={() => handleQuickQtyChange(item, -1)}
                      className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 disabled:opacity-30"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-mono font-black text-sm text-slate-900">
                      {item.qty_on_hand ?? 0}
                    </span>
                    <button
                      type="button"
                      disabled={updatingId === item.id}
                      onClick={() => handleQuickQtyChange(item, 1)}
                      className="w-7 h-7 rounded-xl bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center text-indigo-800 disabled:opacity-30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Edit Stand Modal */}
      {editingItem && (
        <div
          onClick={() => setEditingItem(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">แก้ไขข้อมูลขาตั้ง</h3>
                <p className="text-xs text-slate-300 font-mono">{editingItem.sku}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-full hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">ชื่อรายการ</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">คงเหลือ</label>
                  <input
                    type="number"
                    min={0}
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">ทุน/ชิ้น (฿)</label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">ราคาขาย (฿)</label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={editSell}
                    onChange={(e) => setEditSell(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingEdit ? 'กำลังบันทึก...' : 'บันทึก'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
