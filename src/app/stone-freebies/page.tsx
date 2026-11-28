'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  fetchProducts,
  isStoneFreebie,
  formatUnitCost,
} from '@/lib/inventoryService';
import { Product, ProductStatus } from '@/types';
import {
  Gem,
  Gift,
  Search,
  Plus,
  Minus,
  Pencil,
  X,
  Save,
  ArrowRight,
  DollarSign,
  Package,
} from 'lucide-react';

export default function StoneFreebiesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('0');
  const [editCost, setEditCost] = useState('0');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchProducts();
      setProducts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stoneFreebieList = useMemo(() => {
    return products.filter((p) => isStoneFreebie(p));
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    stoneFreebieList.forEach((p) => {
      if (p.stone_type) set.add(p.stone_type);
    });
    return Array.from(set).sort();
  }, [stoneFreebieList]);

  const filteredList = useMemo(() => {
    return stoneFreebieList.filter((item) => {
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
  }, [stoneFreebieList, selectedCategory, searchQuery]);

  const availableCount = useMemo(
    () =>
      stoneFreebieList.filter(
        (p) => p.status === 'AVAILABLE' && (Number(p.qty_on_hand) || 0) > 0
      ).length,
    [stoneFreebieList]
  );

  const totalUnits = useMemo(
    () => stoneFreebieList.reduce((s, p) => s + (Number(p.qty_on_hand) || 0), 0),
    [stoneFreebieList]
  );

  const totalCostValue = useMemo(
    () =>
      stoneFreebieList.reduce(
        (s, p) => s + (Number(p.cost_price) || 0) * (Number(p.qty_on_hand) || 0),
        0
      ),
    [stoneFreebieList]
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
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSavingEdit(true);
    try {
      const qtyNum = Math.max(0, parseInt(editQty, 10) || 0);
      const costNum = Math.max(0, parseFloat(editCost) || 0);
      const nextStatus: ProductStatus = qtyNum === 0 ? 'SOLD' : 'AVAILABLE';

      const res = await fetch(`/api/products?id=${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim() || editingItem.name,
          qty_on_hand: qtyNum,
          cost_price: costNum,
          status: nextStatus,
        }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === editingItem.id
              ? {
                  ...p,
                  name: editName.trim() || editingItem.name,
                  qty_on_hand: qtyNum,
                  cost_price: costNum,
                  status: nextStatus,
                }
              : p
          )
        );
        setEditingItem(null);
      } else {
        alert('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      <Navbar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 pb-24 lg:pb-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">
              <Gem className="w-4 h-4" />
              <span>Stone Gift Warehouse</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              คลังหินของแถม
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 mt-1">
              แยกหินที่ใช้แถมลูกค้า (หินกลิ้ง หินดิบ และหินที่เปลี่ยนเป็นของแถม) ออกจากสต็อกหินขายและคลังของแถมทั่วไป
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
            >
              <span>คลังหินขาย</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/freebies"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-bold shadow-sm transition"
            >
              <Gift className="w-3.5 h-3.5" />
              <span>คลังของแถมทั่วไป</span>
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500">รายการหินของแถม</p>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {stoneFreebieList.length}{' '}
                <span className="text-xs font-semibold text-slate-500">รายการ</span>
              </p>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                พร้อมแถม {availableCount} รายการ
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Gem className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500">จำนวนชิ้นคงเหลือ</p>
              <p className="text-2xl font-black text-teal-700 mt-1">
                {totalUnits.toLocaleString()}{' '}
                <span className="text-xs font-semibold text-slate-500">ชิ้น</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                นับเฉพาะหินของแถม (ไม่ซ้ำคลังอื่น)
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500">มูลค่าต้นทุนคงเหลือ</p>
              <p className="text-2xl font-black text-slate-900 mt-1">
                ฿{Math.round(totalCostValue).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ราคาขายตั้งไว้ ฿0 (สำหรับแถม)
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา SKU, ชื่อหินของแถม, ชนิดหิน, หมายเหตุ..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                selectedCategory === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({stoneFreebieList.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
            <p className="text-sm font-semibold text-slate-500">
              กำลังโหลดคลังหินของแถม...
            </p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-2">
            <Gem className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600">
              ไม่พบรายการหินของแถมที่ตรงกับการค้นหา
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredList.map((item) => {
              const qty = Number(item.qty_on_hand) || 0;
              const isOut = qty === 0 || item.status === 'SOLD';
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border p-4 shadow-xs transition flex flex-col justify-between gap-3 ${
                    isOut ? 'border-slate-200 opacity-75' : 'border-emerald-100 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200">
                      {item.r2_thumbnail_url ? (
                        <img
                          src={item.r2_thumbnail_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Gem className="w-7 h-7 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 truncate">
                          {item.sku}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            isOut
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isOut ? 'หมดแล้ว' : 'พร้อมแถม'}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1.5 line-clamp-2">
                        {item.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {item.stone_type || 'หินธรรมชาติ'}
                        {item.grade_origin ? ` • ${item.grade_origin}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] text-slate-400">ต้นทุน/ชิ้น</p>
                      <p className="text-sm font-bold text-slate-800">
                        ฿{formatUnitCost(item.cost_price)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={updatingId === item.id || qty <= 0}
                        onClick={() => handleQuickQtyChange(item, -1)}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center disabled:opacity-40 transition"
                        title="ลดจำนวน 1 ชิ้น"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="min-w-[2.5rem] text-center text-sm font-black text-slate-900">
                        {qty}
                      </span>
                      <button
                        type="button"
                        disabled={updatingId === item.id}
                        onClick={() => handleQuickQtyChange(item, 1)}
                        className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center disabled:opacity-40 transition"
                        title="เพิ่มจำนวน 1 ชิ้น"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center ml-1 transition"
                        title="แก้ไขข้อมูล"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Edit Modal */}
        {editingItem && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={handleSaveEdit}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {editingItem.sku}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-1">
                    แก้ไขข้อมูลหินของแถม
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อรายการ
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      จำนวนคงเหลือ (ชิ้น)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ต้นทุนต่อชิ้น (฿)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editCost}
                      onChange={(e) => setEditCost(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                      required
                    />
                  </div>
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingEdit ? 'กำลังบันทึก...' : 'บันทึก'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
