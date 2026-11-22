'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  generateGiftSku,
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
  saveStoneTypes,
  fetchCloudSettings,
} from '@/lib/settingsService';
import StoneTypeCombobox from '@/components/StoneTypeCombobox';
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
  Copy,
  X,
  Gift,
  Package,
  Tag,
} from 'lucide-react';
import Link from 'next/link';

export default function NewProductPage() {
  const router = useRouter();

  const [lots, setLots] = useState<StockLot[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [existingSkus, setExistingSkus] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Freebie Gift states
  const [isFreebie, setIsFreebie] = useState<boolean>(false);
  const [freebieKind, setFreebieKind] = useState<'CRYSTAL' | 'ACCESSORY'>('CRYSTAL');
  const [costZeroFromLot, setCostZeroFromLot] = useState<boolean>(true);
  const [accessoryPreset, setAccessoryPreset] = useState<string>('POUCH');

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
  const [gradeOrigin, setGradeOrigin] = useState<string>('');
  const [costPrice, setCostPrice] = useState<string>('');
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [qtyOnHand, setQtyOnHand] = useState<number>(1);
  const [status, setStatus] = useState<ProductStatus>('AVAILABLE');
  const [storageLocation, setStorageLocation] = useState<string>('Sphere');

  // Media (ไฟล์จากเครื่อง / กล้อง ไม่ต้องใช้ URL)
  const [thumbnailImages, setThumbnailImages] = useState<string[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateBanner, setDuplicateBanner] = useState<{
    fromSku: string;
    fromName: string;
    newSku: string;
  } | null>(null);

  // Load lots, custom shapes, custom stones & existing skus (and handle Duplicate action)
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let loadedShapes = getStoneShapes();
        let loadedStones = getStoneTypes();
        setShapes(loadedShapes);
        setStones(loadedStones);

        const [l, p, cloud] = await Promise.all([
          fetchStockLots(),
          fetchProducts(),
          fetchCloudSettings(),
        ]);
        if (cloud) {
          if (cloud.shapes && cloud.shapes.length > 0) {
            loadedShapes = cloud.shapes;
            setShapes(cloud.shapes);
          }
          if (cloud.stones && cloud.stones.length > 0) {
            loadedStones = cloud.stones;
            setStones(cloud.stones);
          }
        }
        setLots(l);
        setAllProducts(p);
        const skus = p.map((prod) => prod.sku);
        setExistingSkus(skus);

        // Check if user clicked "ทำซ้ำ (Duplicate)" from a product
        const dupRaw =
          typeof window !== 'undefined'
            ? sessionStorage.getItem('crystal_duplicate_item')
            : null;

        if (dupRaw) {
          try {
            const dup = JSON.parse(dupRaw) as Product;
            sessionStorage.removeItem('crystal_duplicate_item');

            // Find matching shape
            const skuPrefix = dup.sku.split('-')[0] || '';
            const matchedShape =
              loadedShapes.find((s) => s.code.toUpperCase() === skuPrefix.toUpperCase()) ||
              loadedShapes.find((s) => dup.name.toLowerCase().includes(s.id.toLowerCase())) ||
              loadedShapes[0];

            const shapeToUse = matchedShape?.id || 'Sphere';
            const stoneToUse = dup.stone_type || loadedStones[0]?.id || 'Amethyst';

            setStoneShape(shapeToUse);
            setStoneType(stoneToUse);

            // Pre-fill form fields
            if (dup.lot_id) setLotId(dup.lot_id);
            setName(dup.name || '');
            setItemType(dup.item_type || 'UNIQUE');
            if (dup.grade_origin) setGradeOrigin(dup.grade_origin);
            if (dup.storage_location) setStorageLocation(dup.storage_location);
            if (dup.cost_price && dup.cost_price > 0) setCostPrice(String(dup.cost_price));
            if (dup.selling_price && dup.selling_price > 0) setSellingPrice(String(dup.selling_price));
            if (dup.min_price) setMinPrice(String(dup.min_price));
            if (dup.dimensions) setDimensions(dup.dimensions);
            if (dup.weight_grams) setWeightGrams(String(dup.weight_grams));

            // Generate the NEXT sequential SKU for this shape + stone
            const nextSku = generateSmartSku(
              stoneToUse,
              skus,
              shapeToUse,
              loadedShapes,
              loadedStones
            );
            setSku(nextSku);

            setDuplicateBanner({
              fromSku: dup.sku,
              fromName: dup.name,
              newSku: nextSku,
            });
            return;
          } catch (e) {
            console.warn('Failed to parse duplicate product data:', e);
          }
        }

        // Default initial SKU if not duplicating
        const initialShape = loadedShapes[0]?.id || 'Sphere';
        const initialStone = loadedStones[0]?.id || 'Amethyst';
        setStoneShape(initialShape);
        setStoneType(initialStone);
        setStorageLocation(initialShape);

        const initialSku = generateSmartSku(
          initialStone,
          skus,
          initialShape,
          loadedShapes,
          loadedStones
        );
        setSku(initialSku);

        // Check URL params for ?mode=freebie or ?type=freebie
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (
            params.get('mode') === 'freebie' ||
            params.get('type') === 'freebie' ||
            params.get('freebie') === 'true'
          ) {
            setIsFreebie(true);
            setSellingPrice('0');
            setMinPrice('0');
            const giftSku = generateGiftSku(skus, {
              isStone: true,
              stoneType: initialStone,
              shapeId: initialShape,
              customShapes: loadedShapes,
              customStones: loadedStones,
            });
            setSku(giftSku);
            setName(`${initialStone} ${initialShape} (ของแถม)`);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Non-stone accessory preset definitions
  const ACCESSORY_PRESETS: Record<
    string,
    { label: string; name: string; skuCode: string; icon: string; defaultCost: number }
  > = {
    POUCH: {
      label: 'ถุงผ้ากำมะหยี่',
      name: 'ถุงผ้ากำมะหยี่ใส่อัญมณี (Velvet Pouch)',
      skuCode: 'POUCH',
      icon: '🟣',
      defaultCost: 3,
    },
    STAND: {
      label: 'ฐานไม้ตั้งหิน',
      name: 'ฐานไม้ธรรมชาติสำหรับวางหิน (Wood Stand)',
      skuCode: 'STAND',
      icon: '🪵',
      defaultCost: 15,
    },
    SAGE: {
      label: 'ไม้หอม / ไวท์เสจ',
      name: 'ไม้หอมพาโลซานโต / ไวท์เสจชำระล้างพลังงาน (Sage/Palo Santo)',
      skuCode: 'SAGE',
      icon: '🌿',
      defaultCost: 20,
    },
    STICKER: {
      label: 'สติกเกอร์ & การ์ด',
      name: 'ชุดสติกเกอร์และโปสการ์ดขอบคุณ (Thank You Card & Stickers)',
      skuCode: 'STICKER',
      icon: '🏷️',
      defaultCost: 2,
    },
    CUSTOM: {
      label: 'ของแถมอื่นๆ',
      name: 'ของสมนาคุณพิเศษจากทางร้าน (Special Gift)',
      skuCode: 'GIFT',
      icon: '🎁',
      defaultCost: 0,
    },
  };

  const applyAccessoryPreset = (presetKey: string) => {
    setAccessoryPreset(presetKey);
    const p = ACCESSORY_PRESETS[presetKey] || ACCESSORY_PRESETS.CUSTOM;
    setName(p.name);
    setCostPrice(String(p.defaultCost));
    setSellingPrice('0');
    setMinPrice('0');
    setItemType('BULK');
    setQtyOnHand((prev) => (prev <= 1 ? 50 : prev));
    setStorageLocation('Gift Box / เคาน์เตอร์');
    const newSku = generateGiftSku(existingSkus, {
      isStone: false,
      categoryCode: p.skuCode,
    });
    setSku(newSku);
  };

  const handleModeChange = (freebieMode: boolean) => {
    setIsFreebie(freebieMode);
    if (freebieMode) {
      setSellingPrice('0');
      setMinPrice('0');
      if (freebieKind === 'ACCESSORY') {
        applyAccessoryPreset(accessoryPreset);
      } else {
        const giftSku = generateGiftSku(existingSkus, {
          isStone: true,
          stoneType,
          shapeId: stoneShape,
          customShapes: shapes,
          customStones: stones,
        });
        setSku(giftSku);
        if (costZeroFromLot && lotId) {
          setCostPrice('0');
        }
      }
    } else {
      const regSku = generateSmartSku(stoneType, existingSkus, stoneShape, shapes, stones);
      setSku(regSku);
      setSellingPrice('');
      setMinPrice('');
      if (itemType === 'BULK' && qtyOnHand === 50) {
        setItemType('UNIQUE');
        setQtyOnHand(1);
      }
    }
  };

  const handleFreebieKindChange = (kind: 'CRYSTAL' | 'ACCESSORY') => {
    setFreebieKind(kind);
    if (kind === 'ACCESSORY') {
      applyAccessoryPreset(accessoryPreset);
    } else {
      const giftSku = generateGiftSku(existingSkus, {
        isStone: true,
        stoneType,
        shapeId: stoneShape,
        customShapes: shapes,
        customStones: stones,
      });
      setSku(giftSku);
      setName(`${stoneType} ${stoneShape} (ของแถม)`);
      if (costZeroFromLot && lotId) {
        setCostPrice('0');
      }
    }
  };

  // When stoneShape changes, auto-generate new SKU and auto-sync storage location
  const handleStoneShapeChange = (newShape: string) => {
    const prevShape = stoneShape;
    setStoneShape(newShape);
    const newSku = isFreebie
      ? generateGiftSku(existingSkus, {
          isStone: true,
          stoneType,
          shapeId: newShape,
          customShapes: shapes,
          customStones: stones,
        })
      : generateSmartSku(stoneType, existingSkus, newShape, shapes, stones);
    setSku(newSku);

    // Keep storageLocation separated by shape if empty or previously matching a shape
    if (
      !storageLocation ||
      storageLocation === prevShape ||
      shapes.some((s) => s.id === storageLocation)
    ) {
      setStorageLocation(newShape);
    }
  };

  // When stoneType changes, auto-generate new SKU if not customized
  const handleStoneTypeChange = (newType: string) => {
    setStoneType(newType);
    const newSku = isFreebie
      ? generateGiftSku(existingSkus, {
          isStone: true,
          stoneType: newType,
          shapeId: stoneShape,
          customShapes: shapes,
          customStones: stones,
        })
      : generateSmartSku(newType, existingSkus, stoneShape, shapes, stones);
    setSku(newSku);

    // Also suggest name if empty
    if (!name || name.includes('Cluster') || name.includes('Point') || name.includes('Sphere')) {
      setName(isFreebie ? `${newType} ${stoneShape} (ของแถม)` : `${newType} ${stoneShape}`);
    }
  };

  // Add brand new stone type on the fly
  const handleAddNewStone = (newStone: StoneTypeItem) => {
    setStones((prev) => {
      const next = [...prev.filter((s) => s.id !== newStone.id), newStone];
      saveStoneTypes(next);
      return next;
    });
  };

  // Selected lot details for reference
  const selectedLot = lots.find((l) => l.id === lotId);
  const lotProducts = useMemo(() => {
    if (!lotId) return [];
    return allProducts.filter((p) => p.lot_id === lotId);
  }, [lotId, allProducts]);
  const lotProductCount = lotProducts.length;
  const lotTotalWeight = lotProducts.reduce(
    (sum: number, p: Product) => sum + (Number(p.weight_grams) || 0),
    0
  );
  const lotAllocatedCost = lotProducts.reduce(
    (sum: number, p: Product) => sum + (Number(p.cost_price) || 0),
    0
  );

  // Profit calculation
  const numCost = parseFloat(costPrice) || 0;
  const numSelling = parseFloat(sellingPrice) || 0;
  const profit = numSelling - numCost;
  const marginPct = numSelling > 0 ? Math.round((profit / numSelling) * 100) : 0;

  // Duplicate SKU check
  const isDuplicateSku = Boolean(
    sku.trim() &&
      existingSkus.some(
        (existing) => existing.trim().toUpperCase() === sku.trim().toUpperCase()
      )
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim()) {
      alert('กรุณากรอกรหัส SKU และชื่อสินค้า');
      return;
    }
    if (isDuplicateSku) {
      const suggested = isFreebie
        ? generateGiftSku(existingSkus, {
            isStone: freebieKind === 'CRYSTAL',
            stoneType,
            shapeId: stoneShape,
            categoryCode: accessoryPreset,
            customShapes: shapes,
            customStones: stones,
          })
        : generateSmartSku(stoneType, existingSkus, stoneShape, shapes, stones);
      alert(`รหัส SKU "${sku.trim()}" มีอยู่ในคลังแล้ว กรุณาใช้รหัสอื่น (เช่น ${suggested})`);
      return;
    }

    setIsSubmitting(true);
    try {
      const finalCost = isFreebie && costZeroFromLot && lotId ? 0 : numCost;
      const finalSelling = isFreebie ? 0 : numSelling;
      const finalMinPrice = isFreebie ? 0 : (minPrice ? parseFloat(minPrice) : null);
      const finalStoneType = isFreebie && freebieKind === 'ACCESSORY' ? 'Accessory' : stoneType;
      const finalGrade = isFreebie
        ? [gradeOrigin.trim(), '[FREEBIE]'].filter(Boolean).join(' ')
        : (gradeOrigin.trim() || null);

      await createProduct({
        sku: sku.trim(),
        lot_id: lotId || null,
        name: name.trim(),
        stone_type: finalStoneType,
        item_type: itemType,
        is_freebie: isFreebie,
        weight_grams: weightGrams ? parseFloat(weightGrams) : null,
        dimensions: dimensions.trim() || null,
        grade_origin: finalGrade,
        cost_price: finalCost,
        selling_price: finalSelling,
        min_price: finalMinPrice,
        qty_on_hand: itemType === 'UNIQUE' ? 1 : Math.max(1, qtyOnHand),
        status,
        r2_thumbnail_url: thumbnailImages.length > 0 ? thumbnailImages[0] : null,
        r2_gallery_urls: galleryImages,
        drive_media_folder_url: null,
        drive_video_url: videoUrl || null,
        storage_location: storageLocation.trim() || null,
      });

      alert(`บันทึก${isFreebie ? 'ของแถม' : 'สินค้า'} ${sku} เข้าสต็อกสำเร็จ! พร้อมพิมพ์บาร์โค้ดได้ทันที`);
      router.push(isFreebie && freebieKind === 'ACCESSORY' ? '/freebies' : '/products');
    } catch (err: any) {
      console.error(err);
      alert('บันทึกล้มเหลว: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-12 bg-slate-50 md:pl-64 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0">
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

        {/* Duplicate Banner */}
        {duplicateBanner && (
          <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-amber-50 border-2 border-purple-300 rounded-2xl flex items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <Copy className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-purple-950 flex flex-wrap items-center gap-2">
                  <span>คัดลอกข้อมูลมาจาก {duplicateBanner.fromSku} ({duplicateBanner.fromName})</span>
                  <span className="text-[10px] bg-purple-600 text-white font-mono font-black px-2 py-0.5 rounded-full shadow-2xs">
                    เจนรหัสใหม่: {duplicateBanner.newSku}
                  </span>
                </div>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  ระบบกรอก ล็อต, ทรงหิน, ชนิดหิน, ชื่อ, และที่เก็บ ให้เรียบร้อยแล้ว — เพียงแค่ถ่ายรูปใหม่ และตรวจสอบน้ำหนัก/ราคา
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDuplicateBanner(null)}
              className="p-1 rounded-lg text-purple-400 hover:text-purple-700 hover:bg-purple-100 transition shrink-0"
              title="ปิดการแจ้งเตือน"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Intake Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white p-4 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md space-y-6"
        >
          {/* PRODUCT MODE SELECTOR: Standard Sale vs Freebie Gift */}
          <div className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 block">
              เลือกรูปแบบสินค้าที่ต้องการลงสต็อก:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => handleModeChange(false)}
                className={`p-4 rounded-3xl border-2 text-left transition-all flex items-start gap-3.5 shadow-sm cursor-pointer ${
                  !isFreebie
                    ? 'bg-gradient-to-br from-purple-50 via-white to-indigo-50/50 border-purple-500 ring-4 ring-purple-500/15 shadow-md'
                    : 'bg-slate-50 border-slate-200 hover:border-purple-200 opacity-70 hover:opacity-100'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                    !isFreebie ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <Gem className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-black ${!isFreebie ? 'text-purple-950' : 'text-slate-700'}`}>
                      💎 สินค้าปกติสำหรับจำหน่าย
                    </span>
                    {!isFreebie && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-600 text-white shadow-2xs">
                        เลือกอยู่ ✓
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    หินตั้งราคาขายปกติ คำนวณต้นทุน กำไร และส่วนลด
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange(true)}
                className={`p-4 rounded-3xl border-2 text-left transition-all flex items-start gap-3.5 shadow-sm cursor-pointer ${
                  isFreebie
                    ? 'bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 border-emerald-500 ring-4 ring-emerald-500/15 shadow-md'
                    : 'bg-slate-50 border-slate-200 hover:border-emerald-200 opacity-70 hover:opacity-100'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                    isFreebie ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  <Gift className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-black ${isFreebie ? 'text-emerald-950' : 'text-slate-700'}`}>
                      🎁 ลงเป็นของแถม
                    </span>
                    {isFreebie ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                        เลือกอยู่ ✓
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ราคา ฿0
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    หินแถมในล็อต, ถุงผ้า, ฐานไม้, เสจ • พิมพ์บาร์โค้ด FREE GIFT
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* FREEBIE CONFIGURATION BANNER (When isFreebie is true) */}
          {isFreebie && (
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-3xl space-y-3.5 shadow-xs animate-in fade-in slide-in-from-top-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5 uppercase tracking-wider">
                  <Gift className="w-4 h-4 text-emerald-600" />
                  ประเภทของแถม
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                  ราคาขาย ฿0 • พิมพ์บาร์โค้ด FREE GIFT
                </span>
              </div>

              {/* Freebie Kind Selector: Crystal vs Accessory */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleFreebieKindChange('CRYSTAL')}
                  className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 ${
                    freebieKind === 'CRYSTAL'
                      ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs text-emerald-950 font-bold'
                      : 'bg-white/60 border-emerald-200 text-emerald-800 hover:bg-white'
                  }`}
                >
                  <Gem className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-xs sm:text-sm font-bold">1. หินของแถม</div>
                    <div className="text-[11px] text-slate-500 font-normal">หินกลิ้ง/เกรดรอง คัดจากล็อต หรือซื้อแยก</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleFreebieKindChange('ACCESSORY')}
                  className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 ${
                    freebieKind === 'ACCESSORY'
                      ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs text-emerald-950 font-bold'
                      : 'bg-white/60 border-emerald-200 text-emerald-800 hover:bg-white'
                  }`}
                >
                  <Package className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-xs sm:text-sm font-bold">2. ของแถมทั่วไป / บรรจุภัณฑ์</div>
                    <div className="text-[11px] text-slate-500 font-normal">ถุงผ้ากำมะหยี่, ฐานไม้, เสจ, สติกเกอร์</div>
                  </div>
                </button>
              </div>

              {/* Quick Presets for Accessory */}
              {freebieKind === 'ACCESSORY' && (
                <div className="space-y-2 pt-1 border-t border-emerald-200/60">
                  <span className="text-[11px] font-semibold text-emerald-900 block">
                    เลือกเทมเพลตของแถมสำเร็จรูป (กดแล้วกรอกชื่อและ SKU บาร์โค้ดให้อัตโนมัติ):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(ACCESSORY_PRESETS).map(([k, p]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => applyAccessoryPreset(k)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
                          accessoryPreset === k
                            ? 'bg-emerald-700 text-white ring-2 ring-emerald-400'
                            : 'bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <span>{p.icon}</span>
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 1: LOT REFERENCE & SKU GENERATION */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-50/80 via-white to-indigo-50/80 border border-purple-200 rounded-3xl space-y-4">
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
                  className="w-full h-11 px-3.5 text-base sm:text-sm bg-white border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium transition"
                >
                  <option value="">-- ไม่ระบุล็อต (หินรับเข้าเดี่ยว) --</option>
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lot_code} (ทุนรวม: ฿{lot.total_cost.toLocaleString()})
                    </option>
                  ))}
                </select>

                {/* Freebie Option from Lot: Cost 0 THB vs Apportioned */}
                {isFreebie && selectedLot && (
                  <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs shadow-2xs">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-950">
                      <input
                        type="checkbox"
                        checked={costZeroFromLot}
                        onChange={(e) => {
                          setCostZeroFromLot(e.target.checked);
                          if (e.target.checked) setCostPrice('0');
                        }}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <span>คิดต้นทุน ฿0 (หินหลักแบกทุนแล้ว)</span>
                    </label>
                    <span className="text-[10px] text-emerald-700">✓ ตัดยอด นน. ในล็อต</span>
                  </div>
                )}

                {/* Real-time Lot Progress Card */}
                {selectedLot && (
                  <div className="mt-2.5 p-3 bg-gradient-to-br from-purple-50 to-indigo-50/60 border border-purple-200 rounded-xl space-y-2 text-xs shadow-sm">
                    <div className="flex items-center justify-between font-bold text-purple-900">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        ความคืบหน้าการลงหินล็อต {selectedLot.lot_code}
                      </span>
                      <Link
                        href={`/products?lot=${selectedLot.id}`}
                        target="_blank"
                        className="text-[11px] text-purple-700 hover:text-purple-900 underline font-semibold flex items-center gap-0.5"
                      >
                        ดูรายการในล็อต ({lotProductCount} ชิ้น) ↗
                      </Link>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                      <div className="bg-white p-2 rounded-lg border border-purple-100 shadow-xs">
                        <span className="text-slate-500 block text-[10px]">ลงแล้วในระบบ</span>
                        <span className="font-bold text-purple-800 text-sm">{lotProductCount}</span>
                        <span className="text-slate-400 text-[10px]"> ชิ้น</span>
                      </div>

                      <div className="bg-white p-2 rounded-lg border border-purple-100 shadow-xs">
                        <span className="text-slate-500 block text-[10px]">น้ำหนักที่ลงแล้ว</span>
                        <span className="font-bold text-indigo-800 text-sm">
                          {lotTotalWeight.toLocaleString()}
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          {selectedLot.total_weight_grams ? ` / ${selectedLot.total_weight_grams.toLocaleString()}g` : ' g'}
                        </span>
                        {selectedLot.total_weight_grams && (
                          <span className={`block text-[9px] font-medium mt-0.5 ${
                            selectedLot.total_weight_grams > lotTotalWeight ? 'text-amber-600' : 'text-emerald-600'
                          }`}>
                            {selectedLot.total_weight_grams > lotTotalWeight
                              ? `ขาดอีก ${(selectedLot.total_weight_grams - lotTotalWeight).toLocaleString()}g`
                              : '✓ ครบน้ำหนักล็อตแล้ว'}
                          </span>
                        )}
                      </div>

                      <div className="bg-white p-2 rounded-lg border border-purple-100 shadow-xs">
                        <span className="text-slate-500 block text-[10px]">ทุนที่กระจายแล้ว</span>
                        <span className="font-bold text-emerald-700 text-sm">
                          ฿{lotAllocatedCost.toLocaleString()}
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          {selectedLot.total_cost ? ` / ฿${selectedLot.total_cost.toLocaleString()}` : ''}
                        </span>
                        {selectedLot.total_cost > 0 && (
                          <span className={`block text-[9px] font-medium mt-0.5 ${
                            selectedLot.total_cost > lotAllocatedCost ? 'text-slate-500' : 'text-emerald-600'
                          }`}>
                            {selectedLot.total_cost > lotAllocatedCost
                              ? `เหลือทุน ฿${(selectedLot.total_cost - lotAllocatedCost).toLocaleString()}`
                              : '✓ ทุนครบแล้ว'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
                  className="w-full h-11 px-3.5 text-base sm:text-sm bg-white border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-purple-900 transition"
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
                <StoneTypeCombobox
                  value={stoneType}
                  onChange={(val) => handleStoneTypeChange(val)}
                  stones={stones}
                  onAddNewStone={handleAddNewStone}
                />
              </div>
            </div>

            {/* SKU and Stone Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              <div>
                <div className="h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    รหัสสินค้า (SKU) *
                  </label>
                  {isDuplicateSku && (
                    <button
                      type="button"
                      onClick={() =>
                        setSku(
                          generateSmartSku(
                            stoneType,
                            existingSkus,
                            stoneShape,
                            shapes,
                            stones
                          )
                        )
                      }
                      className="text-[10px] font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 px-1.5 py-0.5 rounded border border-rose-300 transition"
                    >
                      ✨ เจนรหัสใหม่ไม่ซ้ำ
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  className={`w-full h-11 px-3.5 text-base sm:text-sm bg-white rounded-xl outline-none font-mono font-black transition ${
                    isDuplicateSku
                      ? 'border-2 border-rose-500 text-rose-900 focus:ring-2 focus:ring-rose-500 bg-rose-50/40'
                      : 'border border-purple-300 text-purple-900 focus:ring-2 focus:ring-purple-500'
                  }`}
                />
                {isDuplicateSku && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1">
                    ⚠️ รหัส SKU นี้ซ้ำกับสินค้าที่มีในคลังแล้ว
                  </p>
                )}
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
                  className="w-full h-11 px-3.5 text-base sm:text-sm placeholder:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold transition"
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
                  className={`w-full h-11 px-3.5 text-base sm:text-sm placeholder:text-sm rounded-xl focus:bg-white focus:ring-2 outline-none transition ${
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
                  <span className="text-[10px] text-slate-400 font-normal">
                    (เว้นว่างไว้ได้)
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="เช่น 5A, Top Gem, บราซิล (ไม่บังคับ)"
                  value={gradeOrigin}
                  onChange={(e) => setGradeOrigin(e.target.value)}
                  className="w-full h-11 px-3.5 text-base sm:text-sm placeholder:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <div className="h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-purple-600" />
                    ตำแหน่งที่เก็บ (แยกตามรูปทรง Shape)
                  </label>
                  <span className="text-[10px] text-purple-700 font-bold bg-purple-100 px-1.5 py-0.5 rounded-md">
                    {storageLocation || stoneShape}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    list="storage-locations-list"
                    placeholder="เช่น Sphere, Cabochon, Tower"
                    value={storageLocation}
                    onChange={(e) => setStorageLocation(e.target.value)}
                    className="w-full h-11 px-3.5 text-base sm:text-sm placeholder:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-slate-900"
                  />
                  <datalist id="storage-locations-list">
                    {shapes.map((sh) => (
                      <option key={sh.id} value={sh.id}>
                        {sh.label}
                      </option>
                    ))}
                  </datalist>
                </div>
                {/* Quick shape buttons to change storage location instantly */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {shapes.map((sh) => (
                    <button
                      key={sh.id}
                      type="button"
                      onClick={() => setStorageLocation(sh.id)}
                      className={`text-[11px] px-2 py-0.5 rounded-lg border transition ${
                        storageLocation === sh.id
                          ? 'bg-purple-600 text-white border-purple-600 font-bold shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200'
                      }`}
                    >
                      {sh.id}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: PRICING & QUANTITY */}
          <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-3xl space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-purple-600" />
              3. ราคาต้นทุน ราคาขาย และจำนวนสินค้า
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-3.5">
              <div>
                <div className="min-h-6 flex flex-wrap items-center justify-between gap-1 mb-1">
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
                  className={`w-full h-11 px-3 sm:px-3.5 text-base sm:text-sm placeholder:text-sm rounded-xl focus:ring-2 outline-none font-bold transition ${
                    !costPrice || parseFloat(costPrice) <= 0
                      ? 'bg-amber-50/50 border-2 border-amber-300 text-slate-800 focus:ring-amber-400'
                      : 'bg-white border border-slate-300 text-slate-800 focus:ring-purple-500'
                  }`}
                />
              </div>

              <div>
                <div className="min-h-6 flex flex-wrap items-center justify-between gap-1 mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    {isFreebie ? 'ราคาขาย (ของแถม)' : 'ราคาขาย (฿)'}
                  </label>
                  {isFreebie ? (
                    <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 whitespace-nowrap shrink-0">
                      🎁 FREE GIFT
                    </span>
                  ) : !sellingPrice || parseFloat(sellingPrice) <= 0 ? (
                    <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 whitespace-nowrap shrink-0">
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
                  disabled={isFreebie}
                  placeholder={isFreebie ? '0' : '0.00 (ใส่ทีหลังได้)'}
                  value={isFreebie ? '0' : sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className={`w-full h-11 px-3 sm:px-3.5 text-base sm:text-sm placeholder:text-xs rounded-xl focus:ring-2 outline-none font-bold transition ${
                    isFreebie
                      ? 'bg-emerald-50/70 border border-emerald-300 text-emerald-800 cursor-not-allowed'
                      : !sellingPrice || parseFloat(sellingPrice) <= 0
                      ? 'bg-amber-50 border-2 border-amber-400 text-amber-900 focus:ring-amber-400 placeholder:text-amber-500'
                      : 'bg-white border border-purple-400 text-purple-800 focus:ring-purple-500'
                  }`}
                />
              </div>

              <div>
                <div className="min-h-6 flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    ราคาต่ำสุด (฿)
                  </label>
                </div>
                <input
                  type="number"
                  step="any"
                  disabled={isFreebie}
                  placeholder="0.00"
                  value={isFreebie ? '0' : minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className={`w-full h-11 px-3 sm:px-3.5 text-base sm:text-sm placeholder:text-sm rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold ${
                    isFreebie
                      ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-white border border-slate-300 text-amber-800'
                  }`}
                />
              </div>

              <div>
                <div className="min-h-6 flex items-center justify-between mb-1">
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
                  className="w-full h-11 px-3 sm:px-3.5 text-base sm:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-bold disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>

            {/* Profit summary badge */}
            <div className="flex items-center justify-between text-xs font-medium bg-white p-3 rounded-2xl border border-slate-200">
              <span className="text-slate-500">
                {isFreebie ? 'สถานะราคาและการลงบัญชี:' : 'กำไรต่อชิ้นคาดการณ์:'}
              </span>
              <div className="flex items-center gap-2">
                {isFreebie ? (
                  <span className="font-bold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                    <Gift className="w-4 h-4 text-emerald-600" />
                    ของแถมสำหรับแจกลูกค้า (฿0) • พิมพ์บาร์โค้ดแสดง "FREE GIFT" แปะได้ทันที
                  </span>
                ) : numSelling > 0 ? (
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
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link
              href="/products"
              className="px-5 py-3 sm:py-2.5 min-h-[46px] rounded-2xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition flex items-center justify-center"
            >
              ยกเลิก
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || isDuplicateSku}
              className="px-7 py-3.5 sm:py-2.5 min-h-[48px] rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold shadow-md shadow-purple-600/25 hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
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
