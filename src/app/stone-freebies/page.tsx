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
  LayoutGrid,
  List,
} from 'lucide-react';

export default function StoneFreebiesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
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
    <div className="min-h-screen flex flex-col pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-12 bg-slate-50 md:pl-64 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0">
      <Navbar />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 flex-1">
        {/* Header Card (Matches Stone Warehouse) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <Gem className="w-6 h-6 text-emerald-600" />
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                คลังหินของแถม (Stone Gift Inventory)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              พบ {filteredList.length} รายการ • คงเหลือ {totalUnits.toLocaleString()} ชิ้น • มูลค่าต้นทุนรวม ฿
              {Math.round(totalCostValue).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            <Link
              href="/freebies"
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-semibold text-xs sm:text-sm transition"
            >
              <Gift className="w-4 h-4 text-emerald-600" />
              <span>คลังของแถมทั่วไป</span>
            </Link>
            <Link
              href="/products"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-xs sm:text-sm shadow-md shadow-purple-600/20 hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition"
            >
              <span>💎 สลับไปคลังหินขาย</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Search, Filter & Layout bar */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-2 bg-emerald-50/60 border border-emerald-200/60 rounded-2xl w-full">
            <div className="flex items-center gap-2 px-3 py-1 text-xs font-bold text-emerald-900">
              <span className="p-1 rounded-lg bg-emerald-200 text-emerald-800">🎁</span>
              <span>
                หินสำหรับแถมลูกค้าทั้งหมด ({stoneFreebieList.length} รายการ • {totalUnits} ชิ้น)
              </span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 px-3">
              แยกจากคลังหินขาย (ราคาขาย ฿0)
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาตาม SKU, ชื่อหินของแถม, ชนิดแร่ หรือหมายเหตุ..."
                className="w-full pl-10 pr-9 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'grid'
                      ? 'bg-white text-emerald-700 shadow-sm font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="การ์ดรูปภาพ (Grid)"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'table'
                      ? 'bg-white text-emerald-700 shadow-sm font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="ตาราง (Table)"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
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
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
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

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-sm font-semibold text-slate-500">
            กำลังโหลดคลังหินของแถม...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-2">
            <Gem className="w-12 h-12 text-emerald-200 mx-auto" />
            <p className="text-sm font-bold text-slate-600">
              ไม่พบรายการหินของแถมที่ตรงกับการค้นหา
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredList.map((item) => {
              const qty = Number(item.qty_on_hand) || 0;
              const isOut = qty === 0 || item.status === 'SOLD';
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-md transition flex flex-col justify-between group ${
                    isOut ? 'opacity-75' : ''
                  }`}
                >
                  <div className="relative aspect-square bg-slate-100 overflow-hidden">
                    {item.r2_thumbnail_url ? (
                      <img
                        src={item.r2_thumbnail_url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100">
                        <Gem className="w-12 h-12 text-emerald-300" />
                      </div>
                    )}

                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg bg-black/75 text-white backdrop-blur">
                        {item.sku}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border backdrop-blur ${
                          isOut
                            ? 'bg-slate-100/95 text-slate-600 border-slate-300'
                            : 'bg-emerald-100/95 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {isOut ? 'หมดแล้ว' : 'พร้อมแถม'}
                      </span>
                    </div>

                    <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 bg-white/90 backdrop-blur rounded-md text-[10px] font-bold text-slate-800 shadow-sm">
                      {qty} ชิ้น
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-[11px] text-emerald-700 font-bold mb-0.5">
                        {item.stone_type || 'หินธรรมชาติ'}
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 line-clamp-1 group-hover:text-emerald-700 transition">
                        {item.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {item.grade_origin || '-'}
                      </p>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">สถานะ</span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg">
                          🎁 หินของแถม (฿0)
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">ต้นทุน/ชิ้น</span>
                        <span className="font-bold text-slate-700">
                          ฿{formatUnitCost(item.cost_price)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={updatingId === item.id || qty <= 0}
                          onClick={() => handleQuickQtyChange(item, -1)}
                          className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center disabled:opacity-40 transition"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="min-w-[2rem] text-center text-xs font-black text-slate-900">
                          {qty}
                        </span>
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          onClick={() => handleQuickQtyChange(item, 1)}
                          className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center disabled:opacity-40 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>แก้ไข</span>
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
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                    <th className="py-3 px-4">รูป / SKU</th>
                    <th className="py-3 px-4">ชื่อหินของแถม</th>
                    <th className="py-3 px-4">ชนิดหิน</th>
                    <th className="py-3 px-4 text-right">ต้นทุน/ชิ้น</th>
                    <th className="py-3 px-4 text-center">คงเหลือ</th>
                    <th className="py-3 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredList.map((item) => {
                    const qty = Number(item.qty_on_hand) || 0;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200">
                              {item.r2_thumbnail_url ? (
                                <img
                                  src={item.r2_thumbnail_url}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Gem className="w-4 h-4 text-emerald-400" />
                              )}
                            </div>
                            <span className="font-mono font-bold text-emerald-800">
                              {item.sku}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          {item.name}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {item.stone_type || '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-800">
                          ฿{formatUnitCost(item.cost_price)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={updatingId === item.id || qty <= 0}
                              onClick={() => handleQuickQtyChange(item, -1)}
                              className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold disabled:opacity-40"
                            >
                              -
                            </button>
                            <span className="min-w-[1.75rem] font-black">{qty}</span>
                            <button
                              type="button"
                              disabled={updatingId === item.id}
                              onClick={() => handleQuickQtyChange(item, 1)}
                              className="w-6 h-6 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                          >
                            แก้ไข
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
