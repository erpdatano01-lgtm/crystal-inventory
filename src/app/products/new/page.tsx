'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ImageUploader from '@/components/ImageUploader';
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
  STONE_TYPES,
} from '@/types';
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
} from 'lucide-react';
import Link from 'next/link';

export default function NewProductPage() {
  const router = useRouter();

  const [lots, setLots] = useState<StockLot[]>([]);
  const [existingSkus, setExistingSkus] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [lotId, setLotId] = useState<string>('');
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

  // Media
  const [thumbnailImages, setThumbnailImages] = useState<string[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [driveMediaFolderUrl, setDriveMediaFolderUrl] = useState<string>('');
  const [driveVideoUrl, setDriveVideoUrl] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load lots & existing skus
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [l, p] = await Promise.all([fetchStockLots(), fetchProducts()]);
        setLots(l);
        const skus = p.map((prod) => prod.sku);
        setExistingSkus(skus);

        // Generate initial SKU
        const initialSku = generateSmartSku('Amethyst', skus);
        setSku(initialSku);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // When stoneType changes, auto-generate new SKU if not customized
  const handleStoneTypeChange = (newType: string) => {
    setStoneType(newType);
    const newSku = generateSmartSku(newType, existingSkus);
    setSku(newSku);

    // Also suggest name if empty
    if (!name || name.includes('Cluster') || name.includes('Point')) {
      setName(`${newType} Natural Specimen`);
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
        drive_media_folder_url: driveMediaFolderUrl.trim() || null,
        drive_video_url: driveVideoUrl.trim() || null,
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
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ล็อตสินค้า (lot_id) - ดึงจากตาราง stock_lots
                </label>
                <select
                  value={lotId}
                  onChange={(e) => setLotId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium"
                >
                  <option value="">-- ไม่ระบุล็อต (หินรับเข้าเดี่ยว) --</option>
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lot_code} (ต้นทุนรวม: ฿{lot.total_cost.toLocaleString()}
                      {lot.total_weight_grams ? ` • ${lot.total_weight_grams} g` : ''})
                    </option>
                  ))}
                </select>

                {selectedLot && (
                  <p className="text-[11px] text-purple-700 mt-1.5 flex items-center gap-2">
                    <span>
                      ต้นทุนรวมของล็อตนี้: <strong>฿{selectedLot.total_cost.toLocaleString()}</strong>
                    </span>
                    {selectedLot.drive_lot_folder_url && (
                      <a
                        href={selectedLot.drive_lot_folder_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline flex items-center gap-0.5 text-purple-600"
                      >
                        โฟลเดอร์ล็อต <FolderOpen className="w-3 h-3" />
                      </a>
                    )}
                  </p>
                )}
              </div>

              {/* Stone Type dropdown (triggers smart SKU) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชนิดหิน (stone_type) *
                </label>
                <select
                  value={stoneType}
                  onChange={(e) => handleStoneTypeChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-purple-900"
                >
                  {STONE_TYPES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* SKU and Stone Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รหัสสินค้า (sku) *
                </label>
                <input
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-mono font-bold text-purple-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อสินค้า / ผลึกหิน (name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น Uruguay Amethyst Deep Purple Cluster"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ประเภทสินค้า (item_type) *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setItemType('UNIQUE')}
                    className={`py-2 rounded-xl text-xs font-bold transition border ${
                      itemType === 'UNIQUE'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    UNIQUE (ชิ้นเดียว)
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemType('BULK')}
                    className={`py-2 rounded-xl text-xs font-bold transition border ${
                      itemType === 'BULK'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    BULK (จำนวนมาก)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-slate-500" />
                  น้ำหนัก (weight_grams)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="เช่น 485.5"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                  ขนาด (dimensions)
                </label>
                <input
                  type="text"
                  placeholder="เช่น 9.5 x 7.2 x 6.8 cm"
                  value={dimensions}
                  onChange={(e) => setDimensions(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เกรดและแหล่งที่มา (grade_origin)
                </label>
                <input
                  type="text"
                  placeholder="เช่น Top Gem (เกรดอัญมณี) / บราซิล"
                  value={gradeOrigin}
                  onChange={(e) => setGradeOrigin(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  ที่เก็บ (storage_location)
                </label>
                <input
                  type="text"
                  placeholder="เช่น ตู้โชว์ A-01, กล่อง B-2"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ราคาทุน (cost_price) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ราคาขาย (selling_price) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-purple-400 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-bold text-purple-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ราคาต่ำสุดที่ลดได้ (min_price)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-amber-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  จำนวน (qty_on_hand)
                </label>
                <input
                  type="number"
                  min="1"
                  disabled={itemType === 'UNIQUE'}
                  value={itemType === 'UNIQUE' ? 1 : qtyOnHand}
                  onChange={(e) => setQtyOnHand(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-slate-100 font-semibold text-center"
                />
              </div>
            </div>

            {/* Profit summary badge */}
            <div className="flex items-center justify-between text-xs font-medium bg-white p-3 rounded-2xl border border-slate-200">
              <span className="text-slate-500">กำไรต่อชิ้นคาดการณ์:</span>
              <div className="flex items-center gap-2">
                <span className={`font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ฿{profit.toLocaleString()}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  {marginPct}% Margin
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 4: MEDIA & CLOUDFLARE R2 + GOOGLE DRIVE */}
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
              4. รูปภาพหน้าปก (Cloudflare R2) & ลิงก์สื่อ (Google Drive)
            </span>

            {/* R2 Thumbnail Upload (Compressed to WebP) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <ImageUploader
                images={thumbnailImages}
                onChange={setThumbnailImages}
                maxFiles={1}
                folder="products"
                sku={sku}
                label="รูปหน้าปกสินค้า (r2_thumbnail_url) - อัปโหลดเข้า products/[SKU]/... เป็น WebP อัตโนมัติ"
              />
            </div>

            {/* Google Drive Video & Folder Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-purple-600" />
                  ลิงก์วิดีโอ Google Drive (drive_video_url)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/.../view"
                  value={driveVideoUrl}
                  onChange={(e) => setDriveVideoUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none font-mono text-xs"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  สามารถกด Copy ส่งให้ลูกค้าดูความเงาและประกายผลึกได้ทันที
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-indigo-600" />
                  ลิงก์โฟลเดอร์สื่อ Google Drive (drive_media_folder_url)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={driveMediaFolderUrl}
                  onChange={(e) => setDriveMediaFolderUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none font-mono text-xs"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  สำหรับเก็บรูปดิบและวิดีโอความละเอียดสูง
                </span>
              </div>
            </div>
          </div>

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
