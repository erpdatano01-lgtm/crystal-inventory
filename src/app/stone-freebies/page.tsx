'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import SoldOutSash from '@/components/SoldOutSash';
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
    <div className="min-h-screen flex flex-col pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-16 bg-[#fafafa] md:pl-64 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0">
      <Navbar />

      <main className="max-w-6xl w-full mx-auto px-5 sm:px-8 lg:px-10 py-8 space-y-6 flex-1">
        {/* Minimal Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-zinc-200">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
              คลังหินของแถม
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1 tabular-nums">
              {filteredList.length} รายการ · คงเหลือ {totalUnits.toLocaleString()} ชิ้น · มูลค่าทุน ฿
              {Math.round(totalCostValue).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/freebies"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-xs sm:text-sm font-medium transition"
            >
              <span>คลังของแถมทั่วไป</span>
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-xs sm:text-sm font-medium transition"
            >
              <span>คลังหินขาย</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
            </Link>
          </div>
        </div>

        {/* Search, Filter & Layout bar */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหา SKU, ชื่อหินของแถม หรือชนิดแร่..."
                className="w-full pl-10 pr-9 py-2.5 text-sm bg-white border border-zinc-200 rounded-xl outline-none focus:border-zinc-900 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center bg-white p-1 rounded-xl border border-zinc-200 self-end sm:self-center">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'grid'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
                title="การ์ดรูปภาพ"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'table'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
                title="ตาราง"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition border ${
                selectedCategory === 'ALL'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              ทั้งหมด ({stoneFreebieList.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition border ${
                  selectedCategory === cat
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-sm text-zinc-400">
            กำลังโหลดคลังหินของแถม...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center space-y-2">
            <Gem className="w-10 h-10 text-zinc-300 mx-auto" />
            <p className="text-sm text-zinc-500">
              ไม่พบรายการหินของแถมที่ตรงกับการค้นหา
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredList.map((item) => {
              const qty = Number(item.qty_on_hand) || 0;
              const isOut = qty === 0 || item.status === 'SOLD';
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl overflow-hidden border border-zinc-200 transition flex flex-col justify-between ${
                    isOut ? 'opacity-65' : 'hover:border-zinc-300'
                  }`}
                >
                  <div className="relative aspect-square bg-zinc-100 overflow-hidden">
                    {item.r2_thumbnail_url ? (
                      <img
                        src={item.r2_thumbnail_url}
                        alt={item.name}
                        className={`w-full h-full object-cover ${isOut ? 'grayscale-[35%] opacity-75' : ''}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-50">
                        <Gem className="w-10 h-10 text-zinc-300" />
                      </div>
                    )}
                    {isOut && <SoldOutSash label="หมดแล้ว" />}

                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded-md bg-zinc-900/80 text-white">
                        {item.sku}
                      </span>
                      {isOut && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/90 text-zinc-700">
                          หมด
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-[11px] text-zinc-400 mb-0.5">
                        {item.stone_type || 'หินธรรมชาติ'}
                      </div>
                      <h3 className="font-medium text-sm text-zinc-900 line-clamp-1">
                        {item.name}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-100">
                      <span className="text-zinc-500">
                        ทุน <strong className="font-semibold text-zinc-900 tabular-nums">฿{formatUnitCost(item.cost_price)}</strong>
                      </span>
                      <span className="text-[11px] text-zinc-400">ของแถม (฿0)</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={updatingId === item.id || qty <= 0}
                          onClick={() => handleQuickQtyChange(item, -1)}
                          className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center disabled:opacity-30 transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="min-w-[1.75rem] text-center text-xs font-medium text-zinc-900 tabular-nums">
                          {qty}
                        </span>
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          onClick={() => handleQuickQtyChange(item, 1)}
                          className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center disabled:opacity-30 transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 text-xs font-medium flex items-center gap-1 transition"
                      >
                        <Pencil className="w-3 h-3 text-zinc-400" />
                        <span>แก้ไข</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-medium text-zinc-500">
                    <th className="py-3 px-4">รูป / SKU</th>
                    <th className="py-3 px-4">ชื่อหินของแถม</th>
                    <th className="py-3 px-4">ชนิดหิน</th>
                    <th className="py-3 px-4 text-right">ทุน/ชิ้น</th>
                    <th className="py-3 px-4 text-center">คงเหลือ</th>
                    <th className="py-3 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {filteredList.map((item) => {
                    const qty = Number(item.qty_on_hand) || 0;
                    return (
                      <tr key={item.id} className="hover:bg-zinc-50/70">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-zinc-100 overflow-hidden shrink-0 flex items-center justify-center border border-zinc-200">
                              {item.r2_thumbnail_url ? (
                                <img
                                  src={item.r2_thumbnail_url}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Gem className="w-4 h-4 text-zinc-400" />
                              )}
                            </div>
                            <span className="font-mono font-medium text-zinc-800">
                              {item.sku}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-zinc-900">
                          {item.name}
                        </td>
                        <td className="py-2.5 px-4 text-zinc-500">
                          {item.stone_type || '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium text-zinc-900 tabular-nums">
                          ฿{formatUnitCost(item.cost_price)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={updatingId === item.id || qty <= 0}
                              onClick={() => handleQuickQtyChange(item, -1)}
                              className="w-6 h-6 rounded bg-zinc-100 hover:bg-zinc-200 font-medium disabled:opacity-40"
                            >
                              -
                            </button>
                            <span className="min-w-[1.75rem] font-medium tabular-nums">{qty}</span>
                            <button
                              type="button"
                              disabled={updatingId === item.id}
                              onClick={() => handleQuickQtyChange(item, 1)}
                              className="w-6 h-6 rounded bg-zinc-100 hover:bg-zinc-200 font-medium disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium text-[11px]"
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
