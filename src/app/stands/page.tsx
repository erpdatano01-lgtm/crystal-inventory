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
  ExternalLink,
  LayoutGrid,
  List,
} from 'lucide-react';

const STAND_RECEIPT_URLS: Record<string, string> = {
  'STN-ACR-S': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_38.jpg',
  'STN-ACR-M': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_37.jpg',
  'STN-ACR-L': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_37.jpg',
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
  'STN-LVC-SV-S': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_41.jpg',
  'STN-LVC-GD-S': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_41.jpg',
  'STN-LVC-GD-M': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_41.jpg',
  'STN-LVC-SV-M': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_42.jpg',
  'STN-LVC-BK-M': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_42.jpg',
  'STN-LVC-RG-S': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_42.jpg',
  'STN-LVC-BK-S': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_42.jpg',
  'STN-LVC-SV-L': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_42.jpg',
  'STN-LVC-RG-M': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_42.jpg',
  'STN-MRB-BR10': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_45.jpg',
  'STN-MRB-GR10': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_45.jpg',
  'STN-BLK-5X5': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_52.jpg',
  'STN-BLK-5X3': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_52.jpg',
  'STN-BLK-3X3': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_55.jpg',
  'STN-BLK-2X2': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_55.jpg',
  'STN-CIR-22': 'https://pub-711c228c01bd46028816ac394ae8af33.r2.dev/receipts/2026-11/order_55.jpg',
};

export default function StandsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
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

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 flex-1">
        {/* Header Card (Matches Stone Warehouse) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                คลังขาตั้ง &amp; ฐานวางหิน (Stand Inventory)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              พบ {filteredList.length} รายการ • คงเหลือ {totalUnits.toLocaleString()} ชิ้น • มูลค่าต้นทุนสุทธิรวม ฿
              {Math.round(totalCostValue).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-2 bg-indigo-50/60 border border-indigo-200/60 rounded-2xl w-full">
            <div className="flex items-center gap-2 px-3 py-1 text-xs font-bold text-indigo-900">
              <span className="p-1 rounded-lg bg-indigo-200 text-indigo-800">🪵</span>
              <span>
                ขาตั้ง &amp; ฐานวางหินทั้งหมด ({standList.length} รายการ • {totalUnits} ชิ้น)
              </span>
            </div>
            <span className="text-[11px] font-semibold text-indigo-700 px-3">
              รหัสหมวด STN-* • ต้นทุนสุทธิจากใบเสร็จ Shopee
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหา SKU (เช่น STN-GLS-04), ชื่อขาตั้ง, หรือร้านค้า..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
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
                      ? 'bg-white text-indigo-700 shadow-sm font-semibold'
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
                      ? 'bg-white text-indigo-700 shadow-sm font-semibold'
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

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
            กำลังโหลดข้อมูล...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm bg-white rounded-3xl border border-slate-200">
            ไม่พบรายการขาตั้งที่ตรงกับเงื่อนไข
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredList.map((item) => {
              const qty = Number(item.qty_on_hand) || 0;
              const isOut = qty === 0 || item.status === 'SOLD';
              const receiptUrl = STAND_RECEIPT_URLS[item.sku] || item.r2_thumbnail_url;
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
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100">
                        <Layers className="w-12 h-12 text-indigo-300" />
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
                            : 'bg-indigo-100/95 text-indigo-800 border-indigo-300'
                        }`}
                      >
                        {isOut ? 'หมดแล้ว' : 'พร้อมใช้งาน'}
                      </span>
                    </div>

                    <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 bg-white/90 backdrop-blur rounded-md text-[10px] font-bold text-slate-800 shadow-sm">
                      {qty} ชิ้น
                    </div>

                    {receiptUrl && (
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-2.5 right-2.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1 shadow-md transition"
                        title="ดูรูปใบเสร็จ Shopee"
                      >
                        <span>ใบเสร็จ</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-[11px] text-indigo-700 font-bold mb-0.5">
                        {item.stone_type}
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 line-clamp-1 group-hover:text-indigo-700 transition">
                        {item.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {item.grade_origin || '-'}
                      </p>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">ทุนสุทธิ/ชิ้น</span>
                        <span className="font-black text-emerald-700">
                          ฿{formatUnitCost(Number(item.cost_price) || 0)}
                        </span>
                      </div>
                      {Number(item.selling_price) > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">ราคาขาย</span>
                          <span className="font-bold text-purple-700">
                            ฿{Number(item.selling_price).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={updatingId === item.id || qty <= 0}
                          onClick={() => handleQuickQtyChange(item, -1)}
                          className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 disabled:opacity-30"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="min-w-[2rem] text-center font-mono font-black text-xs text-slate-900">
                          {qty}
                        </span>
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          onClick={() => handleQuickQtyChange(item, 1)}
                          className="w-8 h-8 rounded-xl bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center text-indigo-800 disabled:opacity-30"
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
                    <th className="py-3 px-4">ชื่อขาตั้ง &amp; ฐานวาง</th>
                    <th className="py-3 px-4">หมวดหมู่</th>
                    <th className="py-3 px-4 text-right">ทุนสุทธิ/ชิ้น</th>
                    <th className="py-3 px-4 text-center">คงเหลือ</th>
                    <th className="py-3 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredList.map((item) => {
                    const qty = Number(item.qty_on_hand) || 0;
                    const receiptUrl = STAND_RECEIPT_URLS[item.sku] || item.r2_thumbnail_url;
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
                                <Layers className="w-4 h-4 text-indigo-400" />
                              )}
                            </div>
                            <span className="font-mono font-bold text-indigo-700">
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
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                          ฿{formatUnitCost(Number(item.cost_price) || 0)}
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
                              className="w-6 h-6 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {receiptUrl && (
                            <a
                              href={receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[11px] hover:bg-indigo-100"
                            >
                              ใบเสร็จ
                            </a>
                          )}
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
