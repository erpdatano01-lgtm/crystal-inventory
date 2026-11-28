'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import SoldOutSash from '@/components/SoldOutSash';
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
    <div className="min-h-screen bg-[#fafafa] flex flex-col pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-16 md:pl-64 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0">
      <Navbar />

      <main className="max-w-6xl w-full mx-auto px-5 sm:px-8 lg:px-10 py-8 space-y-6 flex-1">
        {/* Minimal Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-zinc-200">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
              คลังขาตั้ง &amp; ฐานวางหิน
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1 tabular-nums">
              {filteredList.length} รายการ · คงเหลือ {totalUnits.toLocaleString()} ชิ้น · มูลค่าทุน ฿
              {Math.round(totalCostValue).toLocaleString()}
            </p>
          </div>

          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-xs sm:text-sm font-medium transition shrink-0"
          >
            <span>คลังหินขาย</span>
            <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
          </Link>
        </div>

        {/* Search, Filter & Layout bar */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหา SKU, ชื่อขาตั้ง หรือร้านค้า..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
              className={`px-3 py-1.5 text-xs font-medium rounded-lg shrink-0 transition border ${
                selectedCategory === 'ALL'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              ทั้งหมด ({standList.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg shrink-0 transition border ${
                  selectedCategory === cat
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                {cat} ({standList.filter((p) => p.stone_type === cat).length})
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-zinc-400 text-sm">
            กำลังโหลดข้อมูล...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 text-sm bg-white rounded-2xl border border-zinc-200">
            ไม่พบรายการขาตั้งที่ตรงกับเงื่อนไข
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredList.map((item) => {
              const qty = Number(item.qty_on_hand) || 0;
              const isOut = qty === 0 || item.status === 'SOLD';
              const receiptUrl = STAND_RECEIPT_URLS[item.sku] || item.r2_thumbnail_url;
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
                        <Layers className="w-10 h-10 text-zinc-300" />
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

                    {receiptUrl && (
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-2.5 right-2.5 px-2 py-1 bg-white/90 hover:bg-white text-zinc-800 rounded-lg text-[10px] font-medium flex items-center gap-1 border border-zinc-200/80 transition"
                        title="ดูรูปใบเสร็จ Shopee"
                      >
                        <span>ใบเสร็จ</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-[11px] text-zinc-400 mb-0.5">
                        {item.stone_type}
                      </div>
                      <h3 className="font-medium text-sm text-zinc-900 line-clamp-1">
                        {item.name}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-100">
                      <span className="text-zinc-500">
                        ทุน <strong className="font-semibold text-zinc-900 tabular-nums">฿{formatUnitCost(Number(item.cost_price) || 0)}</strong>
                      </span>
                      {Number(item.selling_price) > 0 && (
                        <span className="text-zinc-600 tabular-nums">
                          ขาย ฿{Number(item.selling_price).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={updatingId === item.id || qty <= 0}
                          onClick={() => handleQuickQtyChange(item, -1)}
                          className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-700 disabled:opacity-30"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="min-w-[1.75rem] text-center font-mono font-medium text-xs text-zinc-900 tabular-nums">
                          {qty}
                        </span>
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          onClick={() => handleQuickQtyChange(item, 1)}
                          className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-700 disabled:opacity-30"
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
                    <th className="py-3 px-4">ชื่อขาตั้ง &amp; ฐานวาง</th>
                    <th className="py-3 px-4">หมวดหมู่</th>
                    <th className="py-3 px-4 text-right">ทุน/ชิ้น</th>
                    <th className="py-3 px-4 text-center">คงเหลือ</th>
                    <th className="py-3 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {filteredList.map((item) => {
                    const qty = Number(item.qty_on_hand) || 0;
                    const receiptUrl = STAND_RECEIPT_URLS[item.sku] || item.r2_thumbnail_url;
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
                                <Layers className="w-4 h-4 text-zinc-400" />
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
                          ฿{formatUnitCost(Number(item.cost_price) || 0)}
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
                        <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {receiptUrl && (
                            <a
                              href={receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-zinc-200 text-zinc-700 font-medium text-[11px] hover:bg-zinc-50"
                            >
                              ใบเสร็จ
                            </a>
                          )}
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
