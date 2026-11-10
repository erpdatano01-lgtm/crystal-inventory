'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '@/types';
import {
  BarcodeLabelConfig,
  BARCODE_SIZE_PRESETS,
  encodeCode128B,
  generateBarcodeSvgString,
  getSavedBarcodeConfig,
  saveBarcodeConfig,
} from '@/lib/barcodeGenerator';
import {
  Printer,
  X,
  Ruler,
  CheckSquare,
  Square,
  Plus,
  Minus,
  Search,
  Sparkles,
  Layers,
  FileText,
  Sliders,
} from 'lucide-react';

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  initialSelectedProducts?: Product[];
}

export default function BarcodePrintModal({
  isOpen,
  onClose,
  products,
  initialSelectedProducts,
}: BarcodePrintModalProps) {
  const [config, setConfig] = useState<BarcodeLabelConfig>(() => getSavedBarcodeConfig());
  const [copiesMap, setCopiesMap] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllSelector, setShowAllSelector] = useState(false);

  // Load saved config and initialize selected product copies
  useEffect(() => {
    if (!isOpen) return;
    const saved = getSavedBarcodeConfig();
    setConfig(saved);

    const nextCopies: Record<string, number> = {};
    if (initialSelectedProducts && initialSelectedProducts.length > 0) {
      initialSelectedProducts.forEach((p) => {
        nextCopies[p.id] = 1;
      });
      setShowAllSelector(initialSelectedProducts.length > 1);
    } else {
      // Default: select available products (up to 1 each) or show selector
      products
        .filter((p) => p.status === 'AVAILABLE')
        .slice(0, 5)
        .forEach((p) => {
          nextCopies[p.id] = 1;
        });
      setShowAllSelector(true);
    }
    setCopiesMap(nextCopies);
    setSearchTerm('');
  }, [isOpen, initialSelectedProducts, products]);

  // Persist config changes
  const updateConfig = (patch: Partial<BarcodeLabelConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...patch };
      saveBarcodeConfig(updated);
      return updated;
    });
  };

  const selectedItems = useMemo(() => {
    return products
      .filter((p) => (copiesMap[p.id] || 0) > 0)
      .map((p) => ({
        product: p,
        copies: copiesMap[p.id] || 1,
      }));
  }, [products, copiesMap]);

  const totalLabels = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.copies, 0);
  }, [selectedItems]);

  const filteredPickerProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const q = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.stone_type.toLowerCase().includes(q)
    );
  }, [products, searchTerm]);

  if (!isOpen) return null;

  const setProductCopies = (id: string, count: number) => {
    setCopiesMap((prev) => {
      const next = { ...prev };
      if (count <= 0) {
        delete next[id];
      } else {
        next[id] = Math.min(99, count);
      }
      return next;
    });
  };

  // Compute responsive font & barcode sizing based on label cm dimensions
  const getScaledMetrics = (wCm: number, hCm: number, scale: 'sm' | 'md' | 'lg') => {
    const scaleFactor = scale === 'sm' ? 0.85 : scale === 'lg' ? 1.15 : 1.0;
    const minDim = Math.min(wCm, hCm);
    const isTiny = hCm <= 1.8 || wCm <= 2.8;

    const storeFontPt = Math.max(5, Math.round(minDim * 2.5 * scaleFactor * 10) / 10);
    const skuFontPt = Math.max(6.5, Math.round(minDim * 3.3 * scaleFactor * 10) / 10);
    const nameFontPt = Math.max(5.5, Math.round(minDim * 2.7 * scaleFactor * 10) / 10);
    const metaFontPt = Math.max(5, Math.round(minDim * 2.4 * scaleFactor * 10) / 10);
    const priceFontPt = Math.max(6.5, Math.round(minDim * 3.4 * scaleFactor * 10) / 10);

    // Barcode height in cm
    const activeInfoLines =
      (config.showStoreName ? 1 : 0) +
      (config.showSkuText ? 1 : 0) +
      (config.showStoneName ? 1 : 0) +
      (config.showWeightAndDim || config.showPrice ? 1 : 0);

    const ratio = activeInfoLines <= 1 ? 0.58 : activeInfoLines === 2 ? 0.46 : isTiny ? 0.36 : 0.4;
    const barcodeHeightCm = Math.max(0.45, Math.round(hCm * ratio * 100) / 100);
    const paddingCm = isTiny ? 0.1 : 0.15;

    return {
      storeFontPt,
      skuFontPt,
      nameFontPt,
      metaFontPt,
      priceFontPt,
      barcodeHeightCm,
      paddingCm,
    };
  };

  const metrics = getScaledMetrics(config.widthCm, config.heightCm, config.fontScale);

  // Build HTML and trigger print via hidden iframe for exact cm sizing
  const handlePrintLabels = () => {
    if (totalLabels === 0) {
      alert('กรุณาเลือกสินค้าอย่างน้อย 1 รายการเพื่อพิมพ์บาร์โค้ด');
      return;
    }

    const wCm = Math.max(1.2, Number(config.widthCm) || 4.0);
    const hCm = Math.max(1.0, Number(config.heightCm) || 2.5);
    const isRoll = config.paperMode === 'roll';

    const labelHtmlList: string[] = [];

    selectedItems.forEach(({ product, copies }) => {
      const svgMarkup = generateBarcodeSvgString(product.sku);
      const weightText = product.weight_grams ? `${product.weight_grams}g` : '';
      const dimText = product.dimensions ? product.dimensions : '';
      const specsLine = [weightText, dimText].filter(Boolean).join(' • ');
      const priceText =
        product.selling_price && product.selling_price > 0
          ? `฿${product.selling_price.toLocaleString()}`
          : '';

      for (let c = 0; c < copies; c++) {
        labelHtmlList.push(`
          <div class="label-card">
            ${
              config.showStoreName
                ? `<div class="store-line">VIVIDA CRYSTAL</div>`
                : ''
            }
            <div class="barcode-box">
              ${svgMarkup}
            </div>
            ${
              config.showSkuText
                ? `<div class="sku-line">${product.sku}</div>`
                : ''
            }
            ${
              config.showStoneName
                ? `<div class="name-line">${product.stone_type || product.name}</div>`
                : ''
            }
            ${
              (config.showWeightAndDim && specsLine) || (config.showPrice && priceText)
                ? `<div class="bottom-line">
                    <span class="meta-text">${config.showWeightAndDim ? specsLine : ''}</span>
                    <span class="price-text">${config.showPrice ? priceText : ''}</span>
                  </div>`
                : ''
            }
          </div>
        `);
      }
    });

    const printCss = `
      @page {
        size: ${isRoll ? `${wCm}cm ${hCm}cm` : 'A4 portrait'};
        margin: ${isRoll ? '0cm' : '0.6cm'};
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #000000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .labels-wrapper {
        display: ${isRoll ? 'block' : 'flex'};
        flex-wrap: ${isRoll ? 'nowrap' : 'wrap'};
        gap: ${isRoll ? '0cm' : '0.2cm'};
        align-items: flex-start;
        justify-content: flex-start;
      }
      .label-card {
        width: ${wCm}cm;
        height: ${hCm}cm;
        padding: ${metrics.paddingCm}cm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        text-align: center;
        overflow: hidden;
        background: #ffffff;
        ${
          isRoll
            ? 'page-break-after: always; break-after: page;'
            : 'border: 0.5pt dashed #cbd5e1; page-break-inside: avoid; break-inside: avoid;'
        }
      }
      .label-card:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .store-line {
        font-size: ${metrics.storeFontPt}pt;
        font-weight: 800;
        letter-spacing: 0.06em;
        line-height: 1.05;
        color: #000000;
        text-transform: uppercase;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
      }
      .barcode-box {
        width: 96%;
        height: ${metrics.barcodeHeightCm}cm;
        min-height: 0.35cm;
        flex-shrink: 0;
        margin: 0.02cm auto;
      }
      .sku-line {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: ${metrics.skuFontPt}pt;
        font-weight: 900;
        letter-spacing: 0.04em;
        line-height: 1.05;
        color: #000000;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
      }
      .name-line {
        font-size: ${metrics.nameFontPt}pt;
        font-weight: 700;
        line-height: 1.1;
        color: #111827;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
      }
      .bottom-line {
        width: 100%;
        display: flex;
        align-items: baseline;
        justify-content: ${
          config.showWeightAndDim && config.showPrice ? 'space-between' : 'center'
        };
        gap: 0.1cm;
        line-height: 1.05;
        border-top: 0.4pt solid #e2e8f0;
        padding-top: 0.03cm;
      }
      .meta-text {
        font-size: ${metrics.metaFontPt}pt;
        font-weight: 600;
        color: #1f2937;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .price-text {
        font-size: ${metrics.priceFontPt}pt;
        font-weight: 900;
        color: #000000;
        white-space: nowrap;
      }
    `;

    const fullHtml = `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Vivida Crystal Barcode (${wCm}x${hCm}cm)</title>
          <style>${printCss}</style>
        </head>
        <body>
          <div class="labels-wrapper">
            ${labelHtmlList.join('\n')}
          </div>
        </body>
      </html>`;

    // Create hidden iframe to print cleanly without page scrollbars/margins
    const existingFrame = document.getElementById('vivida-barcode-print-frame');
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'vivida-barcode-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(fullHtml);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 250);
    }
  };

  // Sample product for live preview
  const previewProduct: Product = selectedItems[0]?.product ||
    products[0] || {
      id: 'preview',
      sku: 'SPH-AME-001',
      lot_id: null,
      status: 'AVAILABLE',
      item_type: 'UNIQUE',
      name: 'Amethyst Sphere',
      stone_type: 'Amethyst',
      weight_grams: 128.5,
      dimensions: 'Ø 4.5 cm',
      grade_origin: 'Brazil',
      cost_price: 500,
      selling_price: 1290,
      min_price: 1000,
      storage_location: 'A-01',
      qty_on_hand: 1,
      r2_thumbnail_url: null,
      drive_video_url: null,
      drive_media_folder_url: null,
    };

  const previewBarcode = encodeCode128B(previewProduct.sku);
  const previewWeight = previewProduct.weight_grams ? `${previewProduct.weight_grams}g` : '';
  const previewDim = previewProduct.dimensions || '';
  const previewSpecs = [previewWeight, previewDim].filter(Boolean).join(' • ');
  const previewPrice =
    previewProduct.selling_price && previewProduct.selling_price > 0
      ? `฿${previewProduct.selling_price.toLocaleString()}`
      : '';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-3xl max-w-4xl w-full max-h-[92dvh] sm:max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 cursor-default"
      >
        {/* Sticky Header */}
        <div className="shrink-0 px-5 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-purple-600/30 border border-purple-400/30 rounded-2xl text-purple-300 shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg truncate">
                ปริ้นสติกเกอร์บาร์โค้ด (กำหนดขนาดเป็น cm)
              </h3>
              <p className="text-xs text-slate-300 truncate">
                ขนาดป้ายปัจจุบัน: <strong className="text-amber-300">{config.widthCm} × {config.heightCm} cm</strong> ({Math.round(config.widthCm * 10)} × {Math.round(config.heightCm * 10)} mm) • รวม {totalLabels} ดวง
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition shrink-0"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN: Size & Display Settings */}
            <div className="lg:col-span-7 space-y-5">
              {/* 1. Custom Size in CM */}
              <div className="p-4 sm:p-5 bg-purple-50/60 border border-purple-200/80 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-bold text-purple-950 flex items-center gap-1.5">
                    <Ruler className="w-4 h-4 text-purple-600" />
                    <span>1. กำหนดขนาดสติกเกอร์ (หน่วย: เซนติเมตร cm)</span>
                  </label>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 bg-purple-200/70 text-purple-900 rounded-full">
                    {Math.round(config.widthCm * 10)} × {Math.round(config.heightCm * 10)} มม.
                  </span>
                </div>

                {/* Quick Size Presets */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block mb-2">
                    เลือกขนาดมาตรฐานยอดนิยม (หรือพิมพ์ขนาดเองด้านล่าง):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {BARCODE_SIZE_PRESETS.map((preset) => {
                      const active =
                        Math.abs(config.widthCm - preset.widthCm) < 0.01 &&
                        Math.abs(config.heightCm - preset.heightCm) < 0.01;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            updateConfig({
                              widthCm: preset.widthCm,
                              heightCm: preset.heightCm,
                            })
                          }
                          className={`p-2.5 rounded-xl border text-left transition active:scale-95 ${
                            active
                              ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'
                          }`}
                        >
                          <div className="text-xs font-extrabold">{preset.label}</div>
                          <div
                            className={`text-[10px] truncate mt-0.5 ${
                              active ? 'text-purple-100' : 'text-slate-400'
                            }`}
                          >
                            {preset.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Manual Width & Height Inputs in CM */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-white p-3 rounded-xl border border-purple-200">
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      ความกว้าง (Width: cm)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({
                            widthCm: Math.max(1.5, Math.round((config.widthCm - 0.1) * 10) / 10),
                          })
                        }
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          step="0.1"
                          min="1.5"
                          max="15"
                          value={config.widthCm}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              updateConfig({ widthCm: Math.min(15, Math.max(1.0, val)) });
                            }
                          }}
                          className="w-full text-center font-mono font-black text-base py-1.5 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({
                            widthCm: Math.min(15, Math.round((config.widthCm + 0.1) * 10) / 10),
                          })
                        }
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 block text-center mt-1">
                      กว้าง {config.widthCm} ซม. ({Math.round(config.widthCm * 10)} มม.)
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-purple-200">
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      ความสูง (Height: cm)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({
                            heightCm: Math.max(1.0, Math.round((config.heightCm - 0.1) * 10) / 10),
                          })
                        }
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          step="0.1"
                          min="1.0"
                          max="15"
                          value={config.heightCm}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              updateConfig({ heightCm: Math.min(15, Math.max(0.8, val)) });
                            }
                          }}
                          className="w-full text-center font-mono font-black text-base py-1.5 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({
                            heightCm: Math.min(15, Math.round((config.heightCm + 0.1) * 10) / 10),
                          })
                        }
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 block text-center mt-1">
                      สูง {config.heightCm} ซม. ({Math.round(config.heightCm * 10)} มม.)
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Printer Type & Font Size */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-purple-600" />
                  <span>2. ประเภทกระดาษ & ขนาดตัวอักษร</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateConfig({ paperMode: 'roll' })}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition ${
                      config.paperMode === 'roll'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Layers className="w-4 h-4 mt-0.5 shrink-0 text-purple-400" />
                    <div>
                      <div className="text-xs font-bold">สติกเกอร์ม้วน (Thermal Roll)</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          config.paperMode === 'roll' ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        พิมพ์ทีละดวงตามขนาด {config.widthCm}×{config.heightCm} cm
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateConfig({ paperMode: 'a4' })}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition ${
                      config.paperMode === 'a4'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <FileText className="w-4 h-4 mt-0.5 shrink-0 text-purple-400" />
                    <div>
                      <div className="text-xs font-bold">กระดาษแผ่น A4 (เรียงหลายดวง)</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          config.paperMode === 'a4' ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        เรียงป้ายขนาด {config.widthCm}×{config.heightCm} cm บนแผ่น A4
                      </div>
                    </div>
                  </button>
                </div>

                {/* Font Size Scale + Field Checkboxes */}
                <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-600">ขนาดตัวอักษรบนป้าย:</span>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                    {(
                      [
                        { id: 'sm', label: 'เล็ก (S)' },
                        { id: 'md', label: 'ปกติ (M)' },
                        { id: 'lg', label: 'ใหญ่ (L)' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateConfig({ fontScale: opt.id })}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                          config.fontScale === opt.id
                            ? 'bg-purple-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggle Checkboxes for visible info */}
                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-2">
                    เลือกข้อมูลที่ต้องการให้แสดงบนสติกเกอร์:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {[
                      { key: 'showStoreName', label: 'ชื่อร้าน (Vivida Crystal)' },
                      { key: 'showSkuText', label: 'รหัสสินค้า (SKU)' },
                      { key: 'showStoneName', label: 'ชนิดหิน / ชื่อหิน' },
                      { key: 'showWeightAndDim', label: 'น้ำหนัก (g) & ขนาด' },
                      { key: 'showPrice', label: 'ราคาขาย (฿)' },
                    ].map((item) => {
                      const checked = Boolean(config[item.key as keyof BarcodeLabelConfig]);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() =>
                            updateConfig({
                              [item.key]: !checked,
                            } as Partial<BarcodeLabelConfig>)
                          }
                          className={`p-2 rounded-xl border flex items-center gap-2 text-left font-semibold transition ${
                            checked
                              ? 'bg-purple-50 border-purple-300 text-purple-900'
                              : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          {checked ? (
                            <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 shrink-0" />
                          )}
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Real-Size Preview & Product Queue */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
              {/* Live Real-Scale Sticker Preview */}
              <div className="p-4 sm:p-5 bg-slate-900 rounded-2xl text-white flex flex-col items-center justify-center space-y-3 overflow-x-auto">
                <div className="w-full flex items-center justify-between text-xs text-slate-300">
                  <span className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    ตัวอย่างสติกเกอร์ตามขนาดจริง
                  </span>
                  <span className="font-mono text-[11px] text-amber-300 font-bold">
                    {config.widthCm} cm × {config.heightCm} cm
                  </span>
                </div>

                {/* Top horizontal ruler indicator */}
                <div className="flex flex-col items-center py-3">
                  <div
                    style={{ width: `${config.widthCm}cm` }}
                    className="flex items-center justify-between text-[9px] font-mono text-amber-300 border-b border-amber-400/50 pb-0.5 mb-1.5 px-0.5"
                  >
                    <span>0</span>
                    <span>← {config.widthCm} cm →</span>
                    <span>{config.widthCm}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Actual CM Preview Box */}
                    <div
                      style={{
                        width: `${config.widthCm}cm`,
                        height: `${config.heightCm}cm`,
                        padding: `${metrics.paddingCm}cm`,
                      }}
                      className="bg-white text-black rounded-md shadow-xl border border-slate-300 flex flex-col justify-between items-center text-center overflow-hidden select-none"
                    >
                      {config.showStoreName && (
                        <div
                          style={{ fontSize: `${metrics.storeFontPt}pt` }}
                          className="font-extrabold tracking-wider uppercase leading-none truncate w-full text-black"
                        >
                          VIVIDA CRYSTAL
                        </div>
                      )}

                      {/* Crisp SVG Code 128 Barcode */}
                      <div
                        style={{ height: `${metrics.barcodeHeightCm}cm` }}
                        className="w-[96%] shrink-0 my-[0.02cm]"
                      >
                        <svg
                          viewBox={`0 0 ${previewBarcode.totalModules} 100`}
                          preserveAspectRatio="none"
                          className="w-full h-full block"
                          style={{ shapeRendering: 'crispEdges' }}
                        >
                          {previewBarcode.bars.map((bar, idx) => (
                            <rect
                              key={idx}
                              x={bar.x}
                              y={0}
                              width={bar.width}
                              height={100}
                              fill="#000000"
                            />
                          ))}
                        </svg>
                      </div>

                      {config.showSkuText && (
                        <div
                          style={{ fontSize: `${metrics.skuFontPt}pt` }}
                          className="font-mono font-black tracking-wide leading-none truncate w-full text-black"
                        >
                          {previewProduct.sku}
                        </div>
                      )}

                      {config.showStoneName && (
                        <div
                          style={{ fontSize: `${metrics.nameFontPt}pt` }}
                          className="font-bold leading-tight truncate w-full text-slate-900"
                        >
                          {previewProduct.stone_type || previewProduct.name}
                        </div>
                      )}

                      {((config.showWeightAndDim && previewSpecs) ||
                        (config.showPrice && previewPrice)) && (
                        <div
                          className={`w-full flex items-baseline ${
                            config.showWeightAndDim && config.showPrice
                              ? 'justify-between'
                              : 'justify-center'
                          } gap-1 border-t border-slate-200 pt-[1px] leading-none`}
                        >
                          {config.showWeightAndDim && (
                            <span
                              style={{ fontSize: `${metrics.metaFontPt}pt` }}
                              className="font-semibold text-slate-800 truncate"
                            >
                              {previewSpecs}
                            </span>
                          )}
                          {config.showPrice && (
                            <span
                              style={{ fontSize: `${metrics.priceFontPt}pt` }}
                              className="font-black text-black shrink-0"
                            >
                              {previewPrice}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Side vertical ruler indicator */}
                    <div
                      style={{ height: `${config.heightCm}cm` }}
                      className="flex flex-col justify-between text-[9px] font-mono text-amber-300 border-l border-amber-400/50 pl-1"
                    >
                      <span>0</span>
                      <span>{config.heightCm}cm</span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 text-center">
                  บาร์โค้ดมาตรฐาน Code-128 สแกนยิงเข้าเครื่องอ่านบาร์โค้ดและมือถือได้ทันที
                </p>
              </div>

              {/* Selected Products & Quantity per Item */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex-1 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-bold text-slate-800">
                    3. รายการที่จะพิมพ์ ({selectedItems.length} รายการ • {totalLabels} ดวง)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllSelector((prev) => !prev)}
                    className="text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-100 px-2.5 py-1 rounded-lg transition"
                  >
                    {showAllSelector ? 'ซ่อนรายการเลือกเพิ่ม' : '+ เลือกหินชิ้นอื่นเพิ่ม'}
                  </button>
                </div>

                {/* Currently Selected Items List */}
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {selectedItems.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-4">
                      ยังไม่ได้เลือกรายการหิน กดเลือกจากรายการด้านล่างได้เลย
                    </div>
                  ) : (
                    selectedItems.map(({ product, copies }) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded">
                              {product.sku}
                            </span>
                            <span className="font-bold text-slate-800 truncate">
                              {product.stone_type}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setProductCopies(product.id, copies - 1)}
                            className="p-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700"
                            title="ลดจำนวนดวง"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center font-mono font-black text-slate-900">
                            {copies}
                          </span>
                          <button
                            type="button"
                            onClick={() => setProductCopies(product.id, copies + 1)}
                            className="p-1 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700"
                            title="เพิ่มจำนวนดวง"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Expandable Product Picker for Batch Printing */}
                {showAllSelector && (
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="ค้นหา SKU หรือชื่อหินเพื่อเลือกพิมพ์..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const allMap: Record<string, number> = {};
                          filteredPickerProducts.forEach((p) => {
                            allMap[p.id] = 1;
                          });
                          setCopiesMap(allMap);
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl shrink-0"
                      >
                        เลือกทั้งหมด
                      </button>
                      <button
                        type="button"
                        onClick={() => setCopiesMap({})}
                        className="px-2.5 py-1.5 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl shrink-0"
                      >
                        ล้าง
                      </button>
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {filteredPickerProducts.map((p) => {
                        const isSelected = (copiesMap[p.id] || 0) > 0;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setProductCopies(p.id, isSelected ? 0 : 1)}
                            className={`w-full p-2 rounded-xl border text-left text-xs flex items-center justify-between transition ${
                              isSelected
                                ? 'bg-purple-50 border-purple-300 text-purple-950 font-semibold'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300 shrink-0" />
                              )}
                              <span className="font-mono font-bold text-[11px]">{p.sku}</span>
                              <span className="truncate">{p.name}</span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-500 shrink-0 ml-2">
                              {p.selling_price > 0 ? `฿${p.selling_price.toLocaleString()}` : '-'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Footer (Safe-area aware for iPhone 15) */}
        <div className="shrink-0 px-5 sm:px-6 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-100 transition"
          >
            ปิดหน้าต่าง
          </button>

          <button
            type="button"
            onClick={handlePrintLabels}
            disabled={totalLabels === 0}
            className="flex-1 sm:flex-initial px-6 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <Printer className="w-4 h-4" />
            <span>
              สั่งปริ้นบาร์โค้ด ({config.widthCm}×{config.heightCm} cm • {totalLabels} ดวง)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
