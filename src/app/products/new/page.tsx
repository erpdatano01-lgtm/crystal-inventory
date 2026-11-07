'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ImageUploader from '@/components/ImageUploader';
import VideoUploader from '@/components/VideoUploader';
import DimensionInputs from '@/components/DimensionInputs';
import {
  fetchStockLots,
  fetchProducts,
  createProduct,
  generateSmartSku,
} from '@/lib/inventoryService';
import {
  StockLot,
  Product,
  ItemType,
  ProductStatus,
} from '@/types';
import {
  StoneShapeItem,
  StoneTypeItem,
  getStoneShapes,
  getStoneTypes,
} from '@/lib/settingsService';
import {
  PlusCircle,
  Gem,
  Scale,
  Maximize2,
  DollarSign,
  FolderOpen,
  Video,
  CheckCircle2,
  MapPin,
  Sparkles,
  ArrowLeft,
  Layers,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function NewProductPage() {
  const router = useRouter();

  const [lots, setLots] = useState<StockLot[]>([]);
  const [existingSkus, setExistingSkus] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [shapes, setShapes] = useState<StoneShapeItem[]>([]);
  const [stones, setStones] = useState<StoneTypeItem[]>([]);
  const [lotId, setLotId] = useState<string>('');
  const [stoneShape, setStoneShape] = useState<string>('Sphere');
  const [stoneType, setStoneType] = useState<string>('Amethyst');
  const [sku, setSku] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [itemType, setItemType] = useState<ItemType>('UNIQUE');
  const [weightGrams, setWeightGrams] = useState<string>('');
  const [dimensions, setDimensions] = useState<string>('');
  const [gradeOrigin, setGradeOrigin] = useState<string>('5A High Grade / บราซิล');
  const [costPrice, setCostPrice] = useState<string>('');
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [qtyOnHand, setQtyOnHand] = useState<number>(1);
  const [status, setStatus] = useState<ProductStatus>('AVAILABLE');
  const [storageLocation, setStorageLocation] = useState<string>('ตู้โชว์ A-01');

  // Media (ไฟล์จากเครื่อง / กล้อง ไม่ต้องใช้ URL)
  const [thumbnailImages, setThumbnailImages] = useState<string[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load lots, custom shapes, custom stones & existing skus
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const loadedShapes = getStoneShapes();
        const loadedStones = getStoneTypes();
        setShapes(loadedShapes);
        setStones(loadedStones);

        const initialShape = loadedShapes[0]?.id || 'Sphere';
        const initialStone = loadedStones[0]?.id || 'Amethyst';
        setStoneShape(initialShape);
        setStoneType(initialStone);

        const [l, p] = await Promise.all([fetchStockLots(), fetchProducts()]);
        setLots(l);
        const skus = p.map((prod) => prod.sku);
        setExistingSkus(skus);

        // Generate initial SKU with custom shapes/stones
        const initialSku = generateSmartSku(initialStone, skus, initialShape, loadedShapes, loadedStones);
        setSku(initialSku);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // When stoneShape changes, auto-generate new SKU
  const handleStoneShapeChange = (newShape: string) => {
    setStoneShape(newShape);
    const newSku = generateSmartSku(stoneType, existingSkus, newShape, shapes, stones);
    setSku(newSku);
  };

  // When stoneType changes, auto-generate new SKU if not customized
  const handleStoneTypeChange = (newType: string) => {
    setStoneType(newType);
    const newSku = generateSmartSku(newType, existingSkus, stoneShape, shapes, stones);
    setSku(newSku);

    // Also suggest name if empty
    if (!name || name.includes('Cluster') || name.includes('Point') || name.includes('Sphere')) {
      setName(`${newType} ${stoneShape}`);
    }
  };

  // Selected lot details for reference
  const selectedLot = lots.find((l) => l.id === lotId);

  // Profit calculation
  const numCost = parseFloat(costPrice) || 0;
  const numSelling = parseFloat(sellingPrice) || 0;
  const profit = numSelling - numCost;
  const marginPct = numSelling > 0 ? Math.round((profit / numSelling) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim()) {
      alert('กรุณากรอกรหัส SKU และชื่อสินค้า');
      return;
    }

    setIsSubmitting(true);
    try {
      await createProduct({
        sku: sku.trim(),
        lot_id: lotId || null,
        name: name.trim(),
        stone_type: stoneType,
        item_type: itemType,
        weight_grams: weightGrams ? parseFloat(weightGrams) : null,
        dimensions: dimensions.trim() || null,
        grade_origin: gradeOrigin.trim() || null,
        cost_price: numCost,
        selling_price: numSelling,
        min_price: minPrice ? parseFloat(minPrice) : null,
        qty_on_hand: itemType === 'UNIQUE' ? 1 : Math.max(1, qtyOnHand),
        status,
        r2_thumbnail_url: thumbnailImages.length > 0 ? thumbnailImages[0] : null,
        r2_gallery_urls: galleryImages,
        drive_media_folder_url: null,
        drive_video_url: videoUrl || null,
        storage_location: storageLocation.trim() || null,
      });

      alert(`บันทึกสินค้า ${sku} เข้าสต็อกและเพิ่มประวัติ stock_movements (INITIAL_STOCK) สำเร็จ!`);
      router.push('/products');
    } catch (err: any) {
      console.error(err);
      alert('บันทึกล้มเหลว: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-12 bg-slate-50 md:pl-64 pt-16 md:pt-0">
      <Navbar />

      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/products"
              className="p-2 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <PlusCircle className="w-6 h-6 text-purple-600" />
                รับหินเข้าสต็อก (New Product Intake)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                เลือก Lot นำเข้า เจน SKU อัตโนมัติ ถ่ายรูป WebP และแนบลิงก์ Google Drive
              </p>
            </div>
          </div>
        </div>

        {/* Main Intake Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md space-y-6"
        >
          {/* SECTION 1: LOT REFERENCE & SKU GENERATION */}
          <div className="p-5 bg-gradient-to-r from-purple-50/80 via-white to-indigo-50/80 border border-purple-200 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-600" />
                1. อ้างอิงล็อตสินค้า & รหัส SKU
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                Auto Generated
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Select lot_id with reference cost */}
              <div>
                <div className="h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    ล็อตนำเข้า (Lot ID)
                  </label>
                  {selectedLot && (
                    <span className="text-[10px] text-purple-700 font-bold bg-purple-100 px-1.5 py-0.5 rounded">
                      ฿{selectedLot.total_cost.toLocaleString()}
                    </span>
                  )}
                </div>
                <select
                  value={lotId}
                  onChange={(e) => setLotId(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm bg-white border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium transition"
                >
                  <option value="">-- ไม่ระบุล็อต (หินรับเข้าเดี่ยว) --</option>
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lot_code} (ทุนรวม: ฿{lot.total_cost.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Stone Shape dropdown (triggers smart SKU) */}
              <div>
                <div className="h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    รูปทรง (Shape) *
                  </label>
                  <Link
                    href="/settings"
                    target="_blank"
                    className="text-[10px] text-purple-600 hover:text-purple-800 font-bold hover:underline inline-flex items-center gap-1"
                    title="ไปที่หน้าตั้งค่าเพื่อเพิ่มหรือแก้ไขรูปทรง"
                  >
                    ⚙️ จัดการทรง
                  </Link>
                </div>
                <select
                  value={stoneShape}
                  onChange={(e) => handleStoneShapeChange(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm bg-white border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-purple-900 transition"
                >
                  {shapes.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.label} [{sh.code}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Stone Type dropdown (triggers smart SKU) */}
              <div>
                <div className="h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    ชนิดหิน (Stone Type) *
                  </label>
                  <Link
                    href="/settings"
                    target="_blank"
                    className="text-[10px] text-purple-600 hover:text-purple-800 font-bold hover:underline inline-flex items-center gap-1"
                    title="ไปที่หน้าตั้งค่าเพื่อเพิ่มหรือแก้ไขชนิดหิน"
                  >
                    ⚙️ จัดการหิน
                  </Link>
                </div>
                <select
                  value={stoneType}
                  onChange={(e) => handleStoneTypeChange(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm bg-white border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-purple-900 transition"
                >
                  {stones.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} [{s.code}]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* SKU and Stone Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              <div>
                <div className="h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    รหัสสินค้า (SKU) *
                  </label>
                </div>
                <input
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm bg-white border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-mono font-black text-purple-900 transition"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    ชื่อสินค้า / ผลึกหิน (Product Name) *
                  </label>
                </div>
                <input
                  type="text"
                  required
                  placeholder="เช่น Uruguay Amethyst Deep Purple Cluster"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold transition"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: PHYSICAL SPECS & TYPE */}
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
              2. คุณลักษณะและขนาดทางกายภาพ
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <div className="h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    ประเภทการขาย *
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-1.5 h-11 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setItemType('UNIQUE')}
                    className={`h-full rounded-lg text-xs font-bold transition flex items-center justify-center ${
                      itemType === 'UNIQUE'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ชิ้นเดี่ยว (Unique)
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemType('BULK')}
                    className={`h-full rounded-lg text-xs font-bold transition flex items-center justify-center ${
                      itemType === 'BULK'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    หลายชิ้น (Bulk)
                  </button>
                </div>
              </div>

              <div>
                <div className="h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-slate-500" />
                    น้ำหนัก (Weight)
                  </label>
                  {!weightGrams && (
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                      ยังไม่ระบุ
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  placeholder="เช่น 485.5 g"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                  className={`w-full h-11 px-3.5 text-sm rounded-xl focus:bg-white focus:ring-2 outline-none transition ${
                    !weightGrams
                      ? 'bg-amber-50/50 border-2 border-amber-300 focus:ring-amber-400'
                      : 'bg-slate-50 border border-slate-300 focus:ring-purple-500'
                  }`}
                />
              </div>

              <div>
                <DimensionInputs
                  value={dimensions}
                  onChange={setDimensions}
                  stoneShape={stoneShape}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    เกรดและแหล่งที่มา (Grade & Origin)
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="เช่น Top Gem (เกรดอัญมณี) / บราซิล"
                  value={gradeOrigin}
                  onChange={(e) => setGradeOrigin(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <div className="h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    ตำแหน่งที่เก็บ (Storage Location)
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="เช่น ตู้โชว์ A-01, กล่อง B-2"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: PRICING & QUANTITY */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-3xl space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-purple-600" />
              3. ราคาต้นทุน ราคาขาย และจำนวนสินค้า
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div>
                <div className="h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    ราคาทุน (฿)
                  </label>
                  {(!costPrice || parseFloat(costPrice) <= 0) && (
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 whitespace-nowrap shrink-0">
                      ยังไม่ระบุ
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className={`w-full h-11 px-3.5 text-sm rounded-xl focus:ring-2 outline-none font-bold transition ${
                    !costPrice || parseFloat(costPrice) <= 0
                      ? 'bg-amber-50/50 border-2 border-amber-300 text-slate-800 focus:ring-amber-400'
                      : 'bg-white border border-slate-300 text-slate-800 focus:ring-purple-500'
                  }`}
                />
              </div>

              <div>
                <div className="h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    ราคาขาย (฿)
                  </label>
                  {!sellingPrice || parseFloat(sellingPrice) <= 0 ? (
                    <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300 whitespace-nowrap shrink-0">
                      🟡 รอตั้งราคา
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 whitespace-nowrap shrink-0">
                      ✓ ระบุแล้ว
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00 (ใส่ทีหลังได้)"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className={`w-full h-11 px-3.5 text-sm rounded-xl focus:ring-2 outline-none font-bold transition ${
                    !sellingPrice || parseFloat(sellingPrice) <= 0
                      ? 'bg-amber-50 border-2 border-amber-400 text-amber-900 focus:ring-amber-400 placeholder:text-amber-500'
                      : 'bg-white border border-purple-400 text-purple-800 focus:ring-purple-500'
                  }`}
                />
              </div>

              <div>
                <div className="h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    ราคาต่ำสุด (฿)
                  </label>
                </div>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-amber-800"
                />
              </div>

              <div>
                <div className="h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    จำนวนชิ้น (Qty)
                  </label>
                </div>
                <input
                  type="number"
                  min="1"
                  disabled={itemType === 'UNIQUE'}
                  value={itemType === 'UNIQUE' ? 1 : qtyOnHand}
                  onChange={(e) => setQtyOnHand(parseInt(e.target.value, 10) || 1)}
                  className="w-full h-11 px-3.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-bold disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>

            {/* Profit summary badge */}
            <div className="flex items-center justify-between text-xs font-medium bg-white p-3 rounded-2xl border border-slate-200">
              <span className="text-slate-500">กำไรต่อชิ้นคาดการณ์:</span>
              <div className="flex items-center gap-2">
                {numSelling > 0 ? (
                  <>
                    <span className={`font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      ฿{profit.toLocaleString()}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      {marginPct}% Margin
                    </span>
                  </>
                ) : (
                  <span className="text-amber-700 font-bold bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-300 text-xs">
                    🟡 รอตั้งราคาขาย (ยังไม่คำนวณกำไร)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: MEDIA UPLOAD (DIRECT FROM DEVICE / CAMERA) */}
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
              4. รูปภาพและวิดีโอ (เลือกไฟล์จากเครื่องหรือถ่ายจากกล้องโดยตรง)
            </span>

            {/* 4.1 Thumbnail Upload */}
            <div
              className={`p-4 rounded-2xl transition ${
                thumbnailImages.length === 0
                  ? 'border-2 border-dashed border-amber-300 bg-amber-50/40'
                  : 'border border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">รูปหน้าปกหลัก</span>
                {thumbnailImages.length === 0 ? (
                  <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                    🟡 ยังไม่มีรูปภาพ (ถ่ายรูปหรือเลือกจากเครื่องทีหลังได้)
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                    ✓ ถ่าย/เลือกแล้ว
                  </span>
                )}
              </div>
              <ImageUploader
                images={thumbnailImages}
                onChange={setThumbnailImages}
                maxFiles={1}
                folder="products"
                sku={sku}
                label="รูปหน้าปกสินค้า (ถ่ายด้วยกล้อง หรือเลือกจากเครื่อง)"
              />
            </div>

            {/* 4.2 Additional Gallery Images */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <ImageUploader
                images={galleryImages}
                onChange={setGalleryImages}
                maxFiles={6}
                folder="products"
                sku={sku}
                label="รูปเพิ่มเติม / หลายมุมมอง (ถ่ายเพิ่มหรือเลือกจากเครื่องได้สูงสุด 6 รูป)"
              />
            </div>

            {/* 4.3 Direct Video Upload from Device */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <VideoUploader
                videoUrl={videoUrl}
                onChange={setVideoUrl}
                sku={sku}
                label="คลิปวิดีโอส่องประกายผลึก (ถ่ายวิดีโอสดหรือเลือกไฟล์คลิปจากเครื่อง)"
              />
            </div>
          </div>

          {/* Notice when saving without selling price */}
          {(!sellingPrice || parseFloat(sellingPrice) <= 0) && (
            <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900 shadow-sm animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">โหมดบันทึกเตรียมของ (บันทึกโดยไม่ใส่ราคาขาย):</span>{' '}
                สินค้าจะถูกบันทึกเข้าสต็อกเป็น <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-300">🟡 รอตั้งราคา</span> คุณสามารถเข้ามาแก้ไขและระบุราคาขายจริงในภายหลังได้ตลอดเวลา
              </div>
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link
              href="/products"
              className="px-5 py-2.5 rounded-2xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition"
            >
              ยกเลิก
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-7 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs sm:text-sm font-semibold shadow-md shadow-purple-600/25 hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>กำลังบันทึกและสร้าง Movement...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>บันทึกรับหินเข้าสต็อก</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
