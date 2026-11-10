'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import {
  fetchProducts,
  fetchStockLots,
  updateProductStatus,
  deleteProduct,
} from '@/lib/inventoryService';
import {
  Product,
  StockLot,
  ProductStatus,
  STATUS_CONFIG,
} from '@/types';
import {
  PackageCheck,
  Search,
  Filter,
  LayoutGrid,
  List,
  Eye,
  EyeOff,
  Copy,
  Check,
  Video,
  FolderOpen,
  PlusCircle,
  Sparkles,
  Scale,
  MapPin,
  ExternalLink,
  DollarSign,
  Layers,
  ChevronDown,
  X,
  FileSpreadsheet,
  Trash2,
  Pencil,
  Save,
  Printer,
} from 'lucide-react';
import GoogleSheetsModal from '@/components/GoogleSheetsModal';
import BarcodePrintModal from '@/components/BarcodePrintModal';
import DimensionInputs from '@/components/DimensionInputs';
import ImageUploader from '@/components/ImageUploader';
import VideoUploader from '@/components/VideoUploader';
import StoneTypeCombobox from '@/components/StoneTypeCombobox';
import {
  StoneTypeItem,
  getStoneTypes,
  saveStoneTypes,
  getHideCostPreference,
  setHideCostPreference,
  fetchCloudSettings,
} from '@/lib/settingsService';

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [lots, setLots] = useState<StockLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeTargetProducts, setBarcodeTargetProducts] = useState<Product[]>([]);

  const openBarcodeModal = (items?: Product[]) => {
    setBarcodeTargetProducts(items && items.length > 0 ? items : []);
    setShowBarcodeModal(true);
  };

  // Customer View Mode: hides cost_price & min_price (Defaults to TRUE)
  const [isCustomerView, setIsCustomerView] = useState(true);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Toast Notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Detail Modal
  const [activeModalProduct, setActiveModalProduct] = useState<Product | null>(null);
  // Edit Modal
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [stones, setStones] = useState<StoneTypeItem[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  useEffect(() => {
    setIsCustomerView(getHideCostPreference());
    setStones(getStoneTypes());
    fetchCloudSettings().then((cloud) => {
      if (cloud) {
        if (typeof cloud.hideCost === 'boolean') {
          setIsCustomerView(cloud.hideCost);
        }
        if (cloud.stones && cloud.stones.length > 0) {
          setStones(cloud.stones);
        }
      }
    });
    async function load() {
      setLoading(true);
      try {
        const [p, l] = await Promise.all([fetchProducts(), fetchStockLots()]);
        setProducts(p);
        setLots(l);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleDeleteProduct = async (id: string, sku: string) => {
    if (!confirm(`ยืนยันการลบสินค้า "${sku}" ออกจากสต็อก? (การลบนี้ไม่สามารถย้อนกลับได้)`)) {
      return;
    }
    const ok = await deleteProduct(id);
    if (ok) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      if (activeModalProduct?.id === id) setActiveModalProduct(null);
      showToast(`ลบสินค้า ${sku} สำเร็จแล้ว`);
    } else {
      alert('เกิดข้อผิดพลาดในการลบสินค้า');
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      sku: product.sku,
      lot_id: product.lot_id,
      status: product.status,
      item_type: product.item_type || 'UNIQUE',
      name: product.name,
      stone_type: product.stone_type,
      weight_grams: product.weight_grams,
      dimensions: product.dimensions,
      grade_origin: product.grade_origin,
      cost_price: product.cost_price,
      selling_price: product.selling_price,
      min_price: product.min_price,
      storage_location: product.storage_location,
      qty_on_hand: product.qty_on_hand,
      r2_thumbnail_url: product.r2_thumbnail_url,
      drive_video_url: product.drive_video_url,
      drive_media_folder_url: product.drive_media_folder_url,
    });
    setActiveModalProduct(null);
  };

  const conflictingEditSkuProduct = editingProduct
    ? products.find(
        (p) =>
          p.id !== editingProduct.id &&
          p.sku.trim().toUpperCase() === (editForm.sku || '').trim().toUpperCase()
      )
    : undefined;

  const handleEditSave = async () => {
    if (!editingProduct) return;
    const cleanSku = (editForm.sku || '').trim().toUpperCase();
    if (!cleanSku) {
      alert('กรุณากรอกรหัส SKU');
      return;
    }
    if (conflictingEditSkuProduct) {
      alert(
        `รหัส SKU "${cleanSku}" ซ้ำกับสินค้า "${conflictingEditSkuProduct.name}" ที่มีอยู่ในคลังแล้ว กรุณาใช้รหัสอื่น`
      );
      return;
    }
    setIsSaving(true);
    try {
      const payload = { ...editForm, sku: cleanSku };
      const res = await fetch(`/api/products?id=${editingProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Update failed');
      }
      await res.json();
      setProducts((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? { ...p, ...payload } : p))
      );
      setEditingProduct(null);
      showToast(`แก้ไขสินค้า ${cleanSku} สำเร็จแล้ว ✓`);
    } catch (err: any) {
      alert(err?.message || 'เกิดข้อผิดพลาดในการแก้ไขสินค้า');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetTestData = async () => {
    if (!confirm('⚠️ คำเตือน: คุณต้องการ "ล้างข้อมูลสินค้าทดสอบทั้งหมด" ใช่หรือไม่? เพื่อให้สต็อกกลับมาว่างสะอาดพร้อมใส่สินค้าจริง')) {
      return;
    }
    const ok = await fetch('/api/reset-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'products' }),
    }).then((r) => r.ok);
    if (ok) {
      setProducts([]);
      showToast('ล้างข้อมูลสินค้าทดสอบเรียบร้อยแล้ว');
    } else {
      alert('เกิดข้อผิดพลาดในการล้างข้อมูล');
    }
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSku = p.sku.toLowerCase().includes(q);
        const matchName = p.name.toLowerCase().includes(q);
        const matchStone = p.stone_type.toLowerCase().includes(q);
        const matchLoc = p.storage_location?.toLowerCase().includes(q) || false;
        if (!matchSku && !matchName && !matchStone && !matchLoc) {
          return false;
        }
      }

      if (selectedStatus && p.status !== selectedStatus) {
        return false;
      }

      if (selectedLotId && p.lot_id !== selectedLotId) {
        return false;
      }

      return true;
    });
  }, [products, searchQuery, selectedStatus, selectedLotId]);

  // Copy Video Link to Clipboard with Toast
  const handleCopyVideoUrl = (p: Product) => {
    if (!p.drive_video_url) {
      showToast('⚠️ ชิ้นนี้ยังไม่ได้ระบุลิงก์วิดีโอ');
      return;
    }
    navigator.clipboard.writeText(p.drive_video_url);
    showToast(`✅ คัดลอกลิงก์วิดีโอ ${p.sku} เรียบร้อย!`);
  };

  // Quick Status Changer
  const handleQuickStatusChange = async (
    p: Product,
    newStatus: ProductStatus
  ) => {
    try {
      const updated = await updateProductStatus(p.id, newStatus);
      if (updated) {
        setProducts((prev) =>
          prev.map((item) => (item.id === p.id ? updated : item))
        );
        if (activeModalProduct?.id === p.id) {
          setActiveModalProduct(updated);
        }
        showToast(
          `เปลี่ยนสถานะเป็น ${STATUS_CONFIG[newStatus].label.split(' (')[0]} สำเร็จ!`
        );
      }
    } catch (err: any) {
      console.error(err);
      alert('เปลี่ยนสถานะล้มเหลว: ' + err.message);
    }
  };

  // Duplicate Product: copy data and navigate to New Stock Entry
  const handleDuplicateProduct = (p: Product) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('crystal_duplicate_item', JSON.stringify(p));
      router.push(`/products/new?duplicate=${encodeURIComponent(p.sku)}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-12 bg-slate-50 md:pl-64 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0">
      <Navbar />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold animate-in fade-in slide-in-from-bottom duration-200 border border-slate-700">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 flex-1">
        {/* Header with Title and Customer View Mode Toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <PackageCheck className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                คลังสินค้า & ค้นหาหน้าร้าน (Product Inventory)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              พบ {filteredProducts.length} ชิ้น • รองรับการแชร์คลิปวิดีโอ และโหมดเปิดหน้าจอให้ลูกค้าดู
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
            {/* Discreet Hide/Show Cost Toggle */}
            <button
              onClick={() => {
                const next = !isCustomerView;
                setIsCustomerView(next);
                setHideCostPreference(next);
                showToast(next ? '🔒 ซ่อนราคาทุนแล้ว' : '👁️ แสดงราคาทุนแล้ว');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition border ${
                isCustomerView
                  ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
              }`}
              title={isCustomerView ? 'คลิกเพื่อแสดงราคาทุน' : 'คลิกเพื่อซ่อนราคาทุน'}
            >
              {isCustomerView ? (
                <>
                  <EyeOff className="w-4 h-4 text-slate-500" />
                  <span>ซ่อนทุน</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-purple-600" />
                  <span>แสดงทุน</span>
                </>
              )}
            </button>

            {/* Barcode Label Print Button */}
            <button
              onClick={() => openBarcodeModal()}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 font-semibold text-xs sm:text-sm transition active:scale-95 shadow-xs"
              title="พิมพ์สติกเกอร์บาร์โค้ดติดหิน (กำหนดขนาดเป็น cm ได้)"
            >
              <Printer className="w-4 h-4 text-amber-700" />
              <span>ปริ้นบาร์โค้ด</span>
            </button>

            {/* Google Sheets Live Feed Button */}
            <button
              onClick={() => setShowSheetsModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-semibold text-xs sm:text-sm transition active:scale-95 shadow-xs"
              title="ดึงข้อมูลสต็อกไปแสดงผลบน Google Sheets อัตโนมัติ"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Google Sheets</span>
            </button>

            {/* Link to Add Product */}
            <Link
              href="/products/new"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-xs sm:text-sm shadow-md shadow-purple-600/20 hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ รับหินเข้าสต็อก</span>
            </Link>
          </div>
        </div>

        {/* Search, Filter & Layout bar */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาตาม SKU (เช่น CRYS-AME-001), ชื่อหิน, ชนิดแร่, หรือที่เก็บ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Layout switch */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'grid'
                      ? 'bg-white text-purple-700 shadow-sm font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="การ์ดรูปภาพ (Grid)"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'table'
                      ? 'bg-white text-purple-700 shadow-sm font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="ตาราง (Table)"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filters: Status & Lot ID */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-slate-700"
            >
              <option value="">สถานะทั้งหมด (All Status)</option>
              <option value="AVAILABLE">พร้อมขาย (AVAILABLE)</option>
              <option value="RESERVED">ติดจอง (RESERVED)</option>
              <option value="SOLD">ขายแล้ว (SOLD)</option>
              <option value="PREP">กำลังเตรียมของ (PREP)</option>
              <option value="IN_TRANSIT">กำลังขนส่ง (IN_TRANSIT)</option>
            </select>

            <select
              value={selectedLotId}
              onChange={(e) => setSelectedLotId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-slate-700"
            >
              <option value="">ทุกล็อตสินค้า (All Lots)</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lot_code}
                </option>
              ))}
            </select>

            {(searchQuery || selectedStatus || selectedLotId) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedStatus('');
                  setSelectedLotId('');
                }}
                className="col-span-2 sm:col-span-1 px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition flex items-center justify-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>

        {/* PRODUCTS LIST */}
        {loading ? (
          <div className="bg-white rounded-3xl p-16 text-center text-slate-400 border border-slate-200 shadow-sm">
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">กำลังโหลดรายการสต็อกหิน...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
            <PackageCheck className="w-12 h-12 text-purple-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">
              {products.length === 0 ? 'ยังไม่มีสินค้าในสต็อก' : 'ไม่พบรายการหินที่ตรงกับเงื่อนไขการค้นหา'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {products.length === 0
                ? 'กดปุ่ม "+ รับหินเข้าสต็อก" เพื่อเริ่มลงรายการสินค้าชิ้นแรกของคุณ'
                : 'ลองเปลี่ยนคำค้นหา หรือกดล้างตัวกรองเพื่อดูสินค้าทั้งหมด'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href="/products/new"
                className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-600/20 hover:from-purple-700 hover:to-indigo-700 transition"
              >
                + รับหินเข้าสต็อกชิ้นแรก
              </Link>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p) => {
              const statusInfo = STATUS_CONFIG[p.status] || STATUS_CONFIG.AVAILABLE;
              const thumb =
                p.r2_thumbnail_url ||
                'https://images.unsplash.com/photo-1598887142487-3c854d51d2c7?auto=format&fit=crop&w=600&q=80';

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-md transition flex flex-col justify-between group"
                >
                  {/* Top Image Container */}
                  <div className="relative aspect-square bg-slate-100 overflow-hidden cursor-pointer">
                    <img
                      src={thumb}
                      alt={p.name}
                      onClick={() => setActiveModalProduct(p)}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />

                    {/* Top Badges */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg bg-black/75 text-white backdrop-blur">
                        {p.sku}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border backdrop-blur ${statusInfo.badgeClass}`}
                      >
                        {statusInfo.label.split(' (')[0]}
                      </span>
                    </div>

                    {/* Weight / Qty Pill */}
                    <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 bg-white/90 backdrop-blur rounded-md text-[10px] font-bold text-slate-800 shadow-sm">
                      {p.weight_grams ? `${p.weight_grams} g` : `${p.qty_on_hand} ชิ้น`}
                    </div>

                    {/* Video Link Button */}
                    {p.drive_video_url && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyVideoUrl(p);
                        }}
                        className="absolute bottom-2.5 right-2.5 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1 shadow-md transition active:scale-95"
                        title="กดเพื่อ Copy ลิงก์วิดีโอส่งให้ลูกค้า"
                      >
                        <Video className="w-3 h-3" />
                        <span>Copy คลิป</span>
                      </button>
                    )}
                  </div>

                  {/* Body Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div
                      onClick={() => setActiveModalProduct(p)}
                      className="cursor-pointer"
                    >
                      <div className="text-[11px] text-purple-700 font-bold mb-0.5">
                        {p.stone_type}
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 line-clamp-1 group-hover:text-purple-600 transition">
                        {p.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {p.grade_origin || p.dimensions || p.storage_location || '-'}
                      </p>
                    </div>

                    {/* Prices Breakdown (Respects Customer View Mode) */}
                    <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">ราคาขาย</span>
                        {!p.selling_price || p.selling_price <= 0 ? (
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg">
                            🟡 รอตั้งราคา
                          </span>
                        ) : (
                          <span className="text-base font-black text-slate-900">
                            ฿{p.selling_price.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Hidden in Customer View */}
                      {!isCustomerView && (
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
                          <span>
                            ทุน: {!p.cost_price || p.cost_price <= 0 ? (
                              <span className="text-amber-700 font-semibold">ยังไม่ระบุ</span>
                            ) : (
                              `฿${p.cost_price.toLocaleString()}`
                            )}
                          </span>
                          {p.min_price ? (
                            <span className="text-amber-700 font-semibold">
                              ต่ำสุด: ฿{p.min_price.toLocaleString()}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Quick Status Buttons: AVAILABLE -> RESERVED -> SOLD */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-1.5">
                        {p.status !== 'AVAILABLE' && (
                          <button
                            onClick={() => handleQuickStatusChange(p, 'AVAILABLE')}
                            className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition text-center active:scale-95"
                          >
                            พร้อมขาย
                          </button>
                        )}

                        {p.status !== 'RESERVED' && p.status !== 'SOLD' && (
                          <button
                            onClick={() => handleQuickStatusChange(p, 'RESERVED')}
                            className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-xl transition text-center active:scale-95"
                          >
                            ติดจอง
                          </button>
                        )}

                        {p.status !== 'SOLD' && (
                          <button
                            onClick={() => {
                              if (confirm(`ยืนยันการขาย ${p.sku} (ตัดสต็อกและลง movement)?`)) {
                                handleQuickStatusChange(p, 'SOLD');
                              }
                            }}
                            className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition text-center active:scale-95"
                          >
                            ขายแล้ว
                          </button>
                        )}
                      </div>

                      {/* Barcode, Duplicate, Edit & Delete Product Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openBarcodeModal([p]);
                          }}
                          className="flex-1 py-2 px-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1 active:scale-95"
                          title="ปริ้นบาร์โค้ดติดหินชิ้นนี้"
                        >
                          <Printer className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">บาร์โค้ด</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateProduct(p);
                          }}
                          className="flex-1 py-2 px-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1 active:scale-95"
                          title="ทำซ้ำรายการนี้ (คัดลอกข้อมูลไปลงสต็อกชิ้นใหม่)"
                        >
                          <Copy className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">ทำซ้ำ</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(p);
                          }}
                          className="flex-1 py-2 px-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1 active:scale-95"
                          title="แก้ไขสินค้านี้"
                        >
                          <Pencil className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">แก้ไข</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProduct(p.id, p.sku);
                          }}
                          className="p-2 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition shrink-0 active:scale-95"
                          title="ลบสินค้านี้ออกจากระบบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW (FOR DESKTOP) */
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">รูป & SKU</th>
                  <th className="py-3 px-4">ชื่อสินค้า / ชนิดหิน</th>
                  <th className="py-3 px-4">น้ำหนัก / ขนาด</th>
                  {!isCustomerView && <th className="py-3 px-4">ราคาทุน</th>}
                  <th className="py-3 px-4">ราคาขาย</th>
                  {!isCustomerView && <th className="py-3 px-4">ราคาต่ำสุด</th>}
                  <th className="py-3 px-4">คงเหลือ</th>
                  <th className="py-3 px-4">สถานะ</th>
                  <th className="py-3 px-4 text-right">การกระทำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProducts.map((p) => {
                  const statusInfo = STATUS_CONFIG[p.status] || STATUS_CONFIG.AVAILABLE;
                  const thumb =
                    p.r2_thumbnail_url ||
                    'https://images.unsplash.com/photo-1598887142487-3c854d51d2c7?auto=format&fit=crop&w=100&q=80';

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setActiveModalProduct(p)}
                      className="hover:bg-slate-50 cursor-pointer transition"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={thumb}
                            alt=""
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                          <span className="font-mono font-bold text-purple-800">
                            {p.sku}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="font-bold text-slate-900 truncate">
                          {p.name}
                        </div>
                        <div className="text-slate-500 text-xs">{p.stone_type}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div>{p.weight_grams ? `${p.weight_grams} g` : '-'}</div>
                        <div className="text-slate-400 text-[11px]">{p.dimensions || '-'}</div>
                      </td>

                      {!isCustomerView && (
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          ฿{p.cost_price.toLocaleString()}
                        </td>
                      )}

                      <td className="py-3 px-4 font-bold text-slate-900">
                        {!p.selling_price || p.selling_price <= 0 ? (
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg inline-block">
                            🟡 รอตั้งราคา
                          </span>
                        ) : (
                          `฿${p.selling_price.toLocaleString()}`
                        )}
                      </td>

                      {!isCustomerView && (
                        <td className="py-3 px-4 text-amber-800 font-medium">
                          {p.min_price ? `฿${p.min_price.toLocaleString()}` : '-'}
                        </td>
                      )}

                      <td className="py-3 px-4 font-semibold">
                        {p.qty_on_hand}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.badgeClass}`}>
                          {statusInfo.label.split(' (')[0]}
                        </span>
                      </td>

                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {p.drive_video_url && (
                            <button
                              onClick={() => handleCopyVideoUrl(p)}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                              title="Copy ลิงก์คลิป"
                            >
                              <Video className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openBarcodeModal([p])}
                            className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg transition"
                            title="ปริ้นสติกเกอร์บาร์โค้ด"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setActiveModalProduct(p)}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition"
                            title="ดูรายละเอียด"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicateProduct(p)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                            title="ทำซ้ำรายการนี้ (คัดลอกข้อมูลไปลงสต็อกชิ้นใหม่)"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                            title="แก้ไขสินค้า"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.sku)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="ลบสินค้านี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Product Detail Modal */}
        {activeModalProduct && (
          <div
            onClick={() => setActiveModalProduct(null)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[90dvh] sm:max-h-[88dvh] flex flex-col overflow-hidden shadow-2xl cursor-default"
            >
              {/* Sticky Header */}
              <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="font-mono text-xs font-bold px-2.5 py-1 bg-purple-100 text-purple-800 rounded-lg">
                    {activeModalProduct.sku}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      STATUS_CONFIG[activeModalProduct.status].badgeClass
                    }`}
                  >
                    {STATUS_CONFIG[activeModalProduct.status].label}
                  </span>
                </div>
                <button
                  onClick={() => setActiveModalProduct(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition shrink-0"
                  aria-label="ปิดหน้าต่าง"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-5">
                {/* Image & Video Bar */}
                <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center">
                  <img
                    src={
                      activeModalProduct.r2_thumbnail_url ||
                      'https://images.unsplash.com/photo-1598887142487-3c854d51d2c7?auto=format&fit=crop&w=800&q=80'
                    }
                    alt={activeModalProduct.name}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {activeModalProduct.name}
                  </h3>
                  <p className="text-xs text-purple-700 font-semibold mt-0.5">
                    {activeModalProduct.stone_type} • ประเภท: {activeModalProduct.item_type}
                  </p>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block">น้ำหนัก</span>
                    <span className="font-bold text-slate-800">
                      {activeModalProduct.weight_grams ? `${activeModalProduct.weight_grams} g` : '-'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block">ขนาด</span>
                    <span className="font-bold text-slate-800">
                      {activeModalProduct.dimensions || '-'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl col-span-2 sm:col-span-1">
                    <span className="text-slate-400 block">ที่เก็บ</span>
                    <span className="font-bold text-slate-800">
                      {activeModalProduct.storage_location || '-'}
                    </span>
                  </div>
                </div>

                {/* Pricing Cards */}
                <div className={`p-4 bg-purple-50/70 border border-purple-100 rounded-2xl ${
                  !isCustomerView ? 'grid grid-cols-2 sm:grid-cols-3 gap-3' : 'flex items-center justify-between'
                }`}>
                  <div>
                    <span className="text-[11px] text-slate-500 block">ราคาขายหน้าร้าน</span>
                    <span className="text-xl font-black text-purple-900">
                      ฿{activeModalProduct.selling_price.toLocaleString()}
                    </span>
                  </div>

                  {!isCustomerView && (
                    <>
                      <div>
                        <span className="text-[11px] text-slate-500 block">ราคาทุน</span>
                        <span className="text-lg font-bold text-slate-800">
                          ฿{activeModalProduct.cost_price.toLocaleString()}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-500 block">ราคาต่ำสุดที่ลดได้</span>
                        <span className="text-lg font-bold text-amber-800">
                          {activeModalProduct.min_price ? `฿${activeModalProduct.min_price.toLocaleString()}` : '-'}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Video Player / Preview */}
                {activeModalProduct.drive_video_url && (
                  <div className="space-y-2 p-3 bg-slate-900 rounded-2xl">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="flex items-center gap-1.5 font-bold">
                        <Video className="w-4 h-4 text-purple-400" />
                        คลิปวิดีโอส่องประกายหิน
                      </span>
                      <button
                        onClick={() => handleCopyVideoUrl(activeModalProduct)}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition"
                      >
                        <Copy className="w-3 h-3" />
                        <span>คัดลอกลิงก์</span>
                      </button>
                    </div>
                    {activeModalProduct.drive_video_url.includes('drive.google.com') ? (
                      <a
                        href={activeModalProduct.drive_video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block p-3 text-center bg-purple-600/30 hover:bg-purple-600/50 rounded-xl text-purple-200 text-xs font-semibold transition"
                      >
                        ▶️ กดเพื่อเปิดดูคลิปวิดีโอในแท็บใหม่
                      </a>
                    ) : (
                      <video
                        src={activeModalProduct.drive_video_url}
                        controls
                        playsInline
                        className="w-full max-h-56 rounded-xl bg-black object-contain"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Pinned Status Actions Footer */}
              <div className="shrink-0 px-5 sm:px-6 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-slate-200 bg-slate-50 space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => openBarcodeModal([activeModalProduct])}
                    className="px-2 py-2.5 min-h-[42px] text-xs font-bold rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80 transition flex items-center justify-center gap-1 active:scale-95"
                    title="ปริ้นบาร์โค้ดติดหินชิ้นนี้"
                  >
                    <Printer className="w-4 h-4 shrink-0" />
                    <span className="truncate">บาร์โค้ด</span>
                  </button>
                  <button
                    onClick={() => handleDuplicateProduct(activeModalProduct)}
                    className="px-2 py-2.5 min-h-[42px] text-xs font-bold rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/60 transition flex items-center justify-center gap-1 active:scale-95"
                    title="คัดลอกทำซ้ำเพื่อรับหินชิ้นใหม่เข้าสต็อก"
                  >
                    <Copy className="w-4 h-4 shrink-0" />
                    <span className="truncate">ทำซ้ำ</span>
                  </button>
                  <button
                    onClick={() => openEditModal(activeModalProduct)}
                    className="px-2 py-2.5 min-h-[42px] text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition flex items-center justify-center gap-1 shadow-sm active:scale-95"
                    title="แก้ไขข้อมูลสินค้านี้"
                  >
                    <Pencil className="w-4 h-4 shrink-0" />
                    <span className="truncate">แก้ไข</span>
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(activeModalProduct.id, activeModalProduct.sku)}
                    className="px-2 py-2.5 min-h-[42px] text-xs font-bold rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200/60 transition flex items-center justify-center gap-1 active:scale-95"
                    title="ลบสินค้านี้"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">ลบ</span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleQuickStatusChange(activeModalProduct, 'AVAILABLE')}
                    className="px-2 py-2 min-h-[38px] text-[11px] font-bold rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 transition truncate active:scale-95"
                  >
                    AVAILABLE
                  </button>
                  <button
                    onClick={() => handleQuickStatusChange(activeModalProduct, 'RESERVED')}
                    className="px-2 py-2 min-h-[38px] text-[11px] font-bold rounded-xl bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200/60 transition truncate active:scale-95"
                  >
                    RESERVED
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`ยืนยันการขาย ${activeModalProduct.sku}?`)) {
                        handleQuickStatusChange(activeModalProduct, 'SOLD');
                      }
                    }}
                    className="px-2 py-2 min-h-[38px] text-[11px] font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition truncate active:scale-95"
                  >
                    ขายแล้ว (SOLD)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Product Modal */}
        {editingProduct && (
          <div
            onClick={() => setEditingProduct(null)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl sm:rounded-3xl max-w-xl w-full max-h-[90dvh] sm:max-h-[88dvh] flex flex-col overflow-hidden shadow-2xl cursor-default"
            >
              {/* Sticky Modal Header */}
              <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-100 bg-white gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-xl shrink-0">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm truncate">แก้ไขข้อมูลสินค้า</h3>
                    <p className="text-xs text-slate-500 font-mono truncate">{editingProduct.sku}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleEditSave}
                    disabled={isSaving || Boolean(conflictingEditSkuProduct)}
                    className="px-3.5 py-2 min-h-[38px] text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
                    aria-label="ปิดหน้าต่าง"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Edit Form Fields */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      รหัส SKU <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.sku || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-base sm:text-sm font-mono font-bold focus:outline-none focus:ring-2 ${
                        conflictingEditSkuProduct
                          ? 'border-2 border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500'
                          : 'border border-slate-200 text-purple-800 focus:ring-blue-400'
                      }`}
                    />
                    {conflictingEditSkuProduct && (
                      <p className="text-[11px] font-bold text-rose-600 mt-1">
                        ⚠️ รหัส SKU นี้ซ้ำกับ &quot;{conflictingEditSkuProduct.name}&quot;
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      สถานะสต็อก
                    </label>
                    <select
                      value={editForm.status || 'AVAILABLE'}
                      onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as ProductStatus }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white font-semibold"
                    >
                      <option value="AVAILABLE">🟢 พร้อมขาย (AVAILABLE)</option>
                      <option value="RESERVED">🟠 จองแล้ว (RESERVED)</option>
                      <option value="PREP">🟡 กำลังเตรียมของ / ถ่ายรูป (PREP)</option>
                      <option value="IN_TRANSIT">🔵 อยู่ระหว่างขนส่ง (IN_TRANSIT)</option>
                      <option value="SOLD">⚫ ขายแล้ว (SOLD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      ผูกกับล็อตสินค้า (Lot)
                    </label>
                    <select
                      value={editForm.lot_id || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, lot_id: e.target.value || null }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                    >
                      <option value="">-- ไม่ผูกล็อต --</option>
                      {lots.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.lot_code} (ทุนรวม ฿{Number(l.total_cost || 0).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      ประเภทการขาย
                    </label>
                    <select
                      value={editForm.item_type || 'UNIQUE'}
                      onChange={(e) => setEditForm((f) => ({ ...f, item_type: e.target.value as 'UNIQUE' | 'BULK' }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                    >
                      <option value="UNIQUE">ชิ้นเดี่ยว (Unique Item - 1 SKU ต่อ 1 ชิ้น)</option>
                      <option value="BULK">เหมาล็อต / มีหลายชิ้น (Bulk Item)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">ชื่อสินค้า</label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">ชนิดหิน</label>
                    <StoneTypeCombobox
                      value={editForm.stone_type || ''}
                      onChange={(val) => setEditForm((f) => ({ ...f, stone_type: val }))}
                      stones={stones}
                      onAddNewStone={(newStone) => {
                        setStones((prev) => {
                          const next = [...prev.filter((s) => s.id !== newStone.id), newStone];
                          saveStoneTypes(next);
                          return next;
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">น้ำหนัก (กรัม)</label>
                    <input
                      type="number"
                      step="any"
                      value={editForm.weight_grams ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, weight_grams: e.target.value ? parseFloat(e.target.value) : null }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <DimensionInputs
                      value={editForm.dimensions || ''}
                      onChange={(val) => setEditForm((f) => ({ ...f, dimensions: val }))}
                      stoneShape={
                        editForm.sku?.startsWith('SPH')
                          ? 'Sphere'
                          : editForm.sku?.startsWith('TOW')
                          ? 'Tower'
                          : editForm.sku?.startsWith('PLM') || editForm.sku?.startsWith('CAB') || editForm.sku?.startsWith('FAC')
                          ? 'Palm'
                          : 'Raw'
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">เกรด / แหล่งที่มา</label>
                    <input
                      type="text"
                      value={editForm.grade_origin || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, grade_origin: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">ที่เก็บสินค้า</label>
                    <input
                      type="text"
                      value={editForm.storage_location || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, storage_location: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-600">ราคาทุน (฿)</label>
                      {(!editForm.cost_price || editForm.cost_price <= 0) && (
                        <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                          ยังไม่ระบุ
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={editForm.cost_price ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, cost_price: parseFloat(e.target.value) || 0 }))}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 ${
                        !editForm.cost_price || editForm.cost_price <= 0
                          ? 'bg-amber-50/50 border-2 border-amber-300 focus:ring-amber-400'
                          : 'border border-slate-200 focus:ring-blue-400'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-600">ราคาขาย (฿)</label>
                      {(!editForm.selling_price || editForm.selling_price <= 0) ? (
                        <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                          🟡 รอตั้งราคา
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          ✓ ระบุแล้ว
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={editForm.selling_price ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, selling_price: parseFloat(e.target.value) || 0 }))}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 font-bold ${
                        !editForm.selling_price || editForm.selling_price <= 0
                          ? 'bg-amber-50 border-2 border-amber-400 text-amber-900 focus:ring-amber-400'
                          : 'border border-slate-200 text-emerald-700 focus:ring-blue-400'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">ราคาต่ำสุดที่ลดได้ (฿)</label>
                    <input
                      type="number"
                      step="any"
                      value={editForm.min_price ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, min_price: e.target.value ? parseFloat(e.target.value) : null }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-amber-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">จำนวนคงเหลือ</label>
                    <input
                      type="number"
                      value={editForm.qty_on_hand ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, qty_on_hand: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-bold"
                    />
                  </div>
                  {/* Media: Image & Video from device */}
                  <div className="sm:col-span-2 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                    <ImageUploader
                      images={editForm.r2_thumbnail_url ? [editForm.r2_thumbnail_url] : []}
                      onChange={(imgs) => setEditForm((f) => ({ ...f, r2_thumbnail_url: imgs[0] || null }))}
                      maxFiles={1}
                      folder="products"
                      sku={editForm.sku}
                      label="รูปหน้าปกสินค้า (ถ่ายด้วยกล้อง หรือเลือกจากเครื่อง)"
                    />
                  </div>

                  <div className="sm:col-span-2 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                    <VideoUploader
                      videoUrl={editForm.drive_video_url || null}
                      onChange={(vUrl) => setEditForm((f) => ({ ...f, drive_video_url: vUrl }))}
                      sku={editForm.sku}
                      label="คลิปวิดีโอของหิน (ถ่ายคลิปสด หรือเลือกจากเครื่อง)"
                    />
                  </div>
                </div>
              </div>

              {/* Pinned Sticky Footer Actions */}
              <div className="shrink-0 px-5 sm:px-6 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-slate-200 bg-white flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 sm:flex-initial px-4 py-3 sm:py-2.5 min-h-[46px] text-sm font-semibold rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleEditSave}
                  disabled={isSaving || Boolean(conflictingEditSkuProduct)}
                  className="flex-[2] sm:flex-initial px-6 py-3 sm:py-2.5 min-h-[46px] text-sm font-bold rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-600/25 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Google Sheets Live Feed Modal */}
        <GoogleSheetsModal
          isOpen={showSheetsModal}
          onClose={() => setShowSheetsModal(false)}
          defaultTab="products"
        />

        {/* Barcode Label Print Modal */}
        <BarcodePrintModal
          isOpen={showBarcodeModal}
          onClose={() => setShowBarcodeModal(false)}
          products={products}
          initialSelectedProducts={barcodeTargetProducts}
        />
      </main>
    </div>
  );
}
