'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '@/types';
import {
  BarcodeLabelConfig,
  BARCODE_SIZE_PRESETS,
  PrinterModelProfile,
  SplitSheetMode,
  buildPrintSheets,
  encodeCode128B,
  generateBarcodeSvgString,
  getLabelSlotHeightCm,
  getSavedBarcodeConfig,
  saveBarcodeConfig,
} from '@/lib/barcodeGenerator';
import {
  connectNiimbotBluetooth,
  connectNiimbotSerial,
  disconnectNiimbot,
  getNiimbotConnectionInfo,
  printDirectToNiimbotB2Pro,
  NiimbotConnectionInfo,
  NiimbotPrintQueueItem,
  setNiimbotDpi,
} from '@/lib/niimbotDirectPrint';
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
  Download,
  Smartphone,
  Wifi,
  Move,
  AlertTriangle,
  Bluetooth,
  Usb,
  Zap,
  CheckCircle2,
  Loader2,
  Rows2,
  PanelTop,
  PanelBottom,
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
  const [isExportingImage, setIsExportingImage] = useState(false);

  // Direct NIIMBOT B21 / B2 Pro Web Bluetooth / Web Serial states
  const [niimbotConn, setNiimbotConn] = useState<NiimbotConnectionInfo>(() =>
    getNiimbotConnectionInfo()
  );
  const [niimbotDensity, setNiimbotDensity] = useState<number>(3);
  const [niimbotDpiState, setNiimbotDpiState] = useState<203 | 300>(203);
  const [isDirectPrinting, setIsDirectPrinting] = useState(false);
  const [directPrintStatus, setDirectPrintStatus] = useState<string>('');
  const [directPrintError, setDirectPrintError] = useState<string>('');

  // Load saved config and initialize selected product copies
  useEffect(() => {
    if (!isOpen) return;
    const saved = getSavedBarcodeConfig();
    setConfig(saved);
    setNiimbotConn(getNiimbotConnectionInfo());
    setDirectPrintStatus('');
    setDirectPrintError('');

    const nextCopies: Record<string, number> = {};
    if (initialSelectedProducts && initialSelectedProducts.length > 0) {
      initialSelectedProducts.forEach((p) => {
        nextCopies[p.id] = 1;
      });
      setShowAllSelector(initialSelectedProducts.length > 1);
    } else {
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

  // Switch printer profile with smart defaults
  const handleSelectPrinterProfile = (profile: PrinterModelProfile) => {
    if (profile === 'niimbot_b21_pro') {
      updateConfig({
        printerProfile: 'niimbot_b21_pro',
        paperMode: 'roll',
        columnsPerRow: 1,
        // Cap width at 5.0 cm if previously set larger for EasyPrint
        widthCm: config.widthCm > 5.0 ? 5.0 : config.widthCm,
        heightCm: config.heightCm > 6.0 ? 3.0 : config.heightCm,
      });
    } else if (profile === 'easyprint_es9920ew') {
      updateConfig({
        printerProfile: 'easyprint_es9920ew',
        paperMode: 'roll',
      });
    } else {
      updateConfig({
        printerProfile: 'a4_sheet',
        paperMode: 'a4',
        columnsPerRow: 1,
      });
    }
  };

  const selectedItems = useMemo(() => {
    return products
      .filter((p) => (copiesMap[p.id] || 0) > 0)
      .slice()
      .sort((a, b) => (a.sku || '').localeCompare(b.sku || '', undefined, { numeric: true }))
      .map((p) => ({
        product: p,
        copies: copiesMap[p.id] || 1,
      }));
  }, [products, copiesMap]);

  const totalLabels = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.copies, 0);
  }, [selectedItems]);

  // Physical sheets to be printed (split mode packs top / bottom labels on one sheet)
  const printSheets = useMemo(
    () => buildPrintSheets(selectedItems, config),
    [selectedItems, config]
  );
  const totalSheets = printSheets.length;
  const blankSlots = config.splitSheet
    ? printSheets.reduce((sum, s) => sum + s.filter((p) => !p).length, 0)
    : 0;
  const slotHeightCm = getLabelSlotHeightCm(config);

  const filteredPresets = useMemo(() => {
    if (config.printerProfile === 'niimbot_b21_pro') {
      return BARCODE_SIZE_PRESETS.filter(
        (p) => p.printer === 'niimbot_b21_pro' || p.printer === 'both'
      );
    }
    if (config.printerProfile === 'easyprint_es9920ew') {
      return BARCODE_SIZE_PRESETS.filter(
        (p) => p.printer === 'easyprint_es9920ew' || p.printer === 'both'
      );
    }
    return BARCODE_SIZE_PRESETS.filter((p) => (p.columnsPerRow || 1) === 1);
  }, [config.printerProfile]);

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

    const storeFontPt = Math.max(4.5, Math.round(minDim * (isTiny ? 2.0 : 2.5) * scaleFactor * 10) / 10);
    const skuFontPt = Math.max(5.0, Math.round(minDim * (isTiny ? 2.6 : 3.3) * scaleFactor * 10) / 10);
    const nameFontPt = Math.max(4.5, Math.round(minDim * (isTiny ? 2.1 : 2.7) * scaleFactor * 10) / 10);
    const metaFontPt = Math.max(4.0, Math.round(minDim * (isTiny ? 1.9 : 2.4) * scaleFactor * 10) / 10);
    const priceFontPt = Math.max(5.0, Math.round(minDim * (isTiny ? 2.6 : 3.4) * scaleFactor * 10) / 10);

    const activeInfoLines =
      (config.showStoreName ? 1 : 0) +
      (config.showSkuText ? 1 : 0) +
      (config.showStoneName ? 1 : 0) +
      (config.showWeightAndDim || config.showPrice ? 1 : 0);

    const ratio = activeInfoLines <= 1 ? 0.58 : activeInfoLines === 2 ? 0.46 : isTiny ? 0.22 : 0.4;
    const paddingCm = isTiny ? 0.08 : 0.15;

    // Fit barcode into the space left after text lines (prevents overflow on short labels e.g. 1.5 cm)
    const ptToCm = (pt: number) => pt * 0.0352778;
    const textStackCm =
      (config.showStoreName ? ptToCm(storeFontPt) * 1.05 : 0) +
      (config.showSkuText ? ptToCm(skuFontPt) * 1.05 : 0) +
      (config.showStoneName ? ptToCm(nameFontPt) * 1.1 : 0) +
      (config.showWeightAndDim || config.showPrice
        ? ptToCm(Math.max(metaFontPt, priceFontPt)) * 1.05 + 0.05
        : 0);
    const availableBarcodeCm = hCm - paddingCm * 2 - textStackCm - 0.06;
    const targetBarcodeCm = isTiny ? 0.30 : Math.max(0.45, Math.round(hCm * ratio * 100) / 100);
    const barcodeHeightCm = Math.max(
      0.3,
      Math.round(Math.min(targetBarcodeCm, availableBarcodeCm) * 100) / 100
    );

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

  const metrics = getScaledMetrics(config.widthCm, slotHeightCm, config.fontScale);

  // Direct Web Bluetooth / Web Serial connection handlers for NIIMBOT B2 Pro
  const handleConnectBluetooth = async () => {
    setDirectPrintError('');
    setDirectPrintStatus('กำลังค้นหาเครื่องปริ้น NIIMBOT B2 Pro ผ่าน Bluetooth...');
    try {
      const info = await connectNiimbotBluetooth();
      setNiimbotConn(info);
      setNiimbotDpiState(info.dpi);
      setDirectPrintStatus(`เชื่อมต่อสำเร็จ: ${info.deviceName} (${info.dpi} DPI) พร้อมสั่งปริ้นทันที!`);
    } catch (err: any) {
      setDirectPrintStatus('');
      setDirectPrintError(err?.message || 'ไม่สามารถเชื่อมต่อ Bluetooth ได้');
    }
  };

  const handleConnectUsb = async () => {
    setDirectPrintError('');
    setDirectPrintStatus('กำลังเชื่อมต่อเครื่องปริ้น NIIMBOT B2 Pro ผ่านสาย USB...');
    try {
      const info = await connectNiimbotSerial();
      setNiimbotConn(info);
      setNiimbotDpiState(info.dpi);
      setDirectPrintStatus(`เชื่อมต่อสาย USB สำเร็จ: ${info.deviceName} พร้อมสั่งปริ้นทันที!`);
    } catch (err: any) {
      setDirectPrintStatus('');
      setDirectPrintError(err?.message || 'ไม่สามารถเชื่อมต่อสาย USB ได้');
    }
  };

  const handleDisconnectNiimbot = async () => {
    await disconnectNiimbot();
    setNiimbotConn(getNiimbotConnectionInfo());
    setDirectPrintStatus('');
    setDirectPrintError('');
  };

  const handleDirectNiimbotPrint = async () => {
    if (totalLabels === 0) {
      alert('กรุณาเลือกสินค้าอย่างน้อย 1 รายการเพื่อพิมพ์บาร์โค้ด');
      return;
    }
    setDirectPrintError('');
    setIsDirectPrinting(true);
    try {
      await printDirectToNiimbotB2Pro(selectedItems, config, {
        density: niimbotDensity,
        dpi: niimbotDpiState,
        onProgress: (_curr, _tot, msg) => {
          setDirectPrintStatus(msg);
        },
      });
      setNiimbotConn(getNiimbotConnectionInfo());
      setDirectPrintStatus(
        config.splitSheet
          ? `✅ ปริ้นออกเครื่อง NIIMBOT สำเร็จ ${totalLabels} ดวง (ใช้กระดาษ ${totalSheets} แผ่น)!`
          : `✅ ปริ้นออกเครื่อง NIIMBOT สำเร็จครบ ${totalLabels} ดวง!`
      );
    } catch (err: any) {
      setDirectPrintStatus('');
      setDirectPrintError(
        err?.message ||
          'เกิดข้อผิดพลาดในการส่งพิมพ์ (หากเปิดแอป NIIMBOT บนคอมอยู่ กรุณากดตัดการเชื่อมต่อในแอป NIIMBOT ก่อนเพื่อให้หน้าเว็บสั่งพิมพ์ตรงได้)'
      );
    } finally {
      setIsDirectPrinting(false);
    }
  };

  // One-click Test Print for NIIMBOT (prints 1 sheet with 2 codes to verify bottom line doesn't disappear)
  const handleTestPrintNiimbot = async (testDpi: 203 | 300 = niimbotDpiState) => {
    setDirectPrintError('');
    setIsDirectPrinting(true);
    setDirectPrintStatus(`กำลังเตรียมพิมพ์แผ่นทดสอบ (${testDpi} DPI)...`);

    // Calibrated test products with full specs so the user can verify every single line
    const testItems: NiimbotPrintQueueItem[] = [
      {
        product: {
          id: 'test-azu-001',
          sku: 'CAB-AZU-001',
          lot_id: null,
          status: 'AVAILABLE',
          item_type: 'UNIQUE',
          qty_on_hand: 1,
          name: 'Azurite Cabochon',
          stone_type: 'Azurite',
          weight_grams: 10.0,
          dimensions: '3.5 x 2.7 x 0.5 cm',
          selling_price: 450,
          cost_price: 200,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        copies: 1,
      },
      {
        product: {
          id: 'test-azu-002',
          sku: 'CAB-AZU-002',
          lot_id: null,
          status: 'AVAILABLE',
          item_type: 'UNIQUE',
          qty_on_hand: 1,
          name: 'Azurite Cabochon',
          stone_type: 'Azurite',
          weight_grams: 11.0,
          dimensions: '3.3 x 2.2 x 0.6 cm',
          selling_price: 520,
          cost_price: 220,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        copies: 1,
      },
    ];

    const testConfig: BarcodeLabelConfig = {
      ...config,
      widthCm: 4.0,
      heightCm: 3.0,
      splitSheet: true,
      splitMode: 'both',
      showStoreName: config.showStoreName,
      showSkuText: true,
      showStoneName: true,
      showWeightAndDim: true,
      showPrice: false,
    };

    try {
      await printDirectToNiimbotB2Pro(testItems, testConfig, {
        density: niimbotDensity,
        dpi: testDpi,
        onProgress: (_curr, _tot, msg) => {
          setDirectPrintStatus(msg);
        },
      });
      setNiimbotConn(getNiimbotConnectionInfo());
      setDirectPrintStatus(
        `✅ พิมพ์แผ่นทดสอบสำเร็จ (${testDpi} DPI)! ดูที่กระดาษ: แผ่นบน (CAB-AZU-001) และแผ่นล่าง (CAB-AZU-002) จะมีเส้นคั่นและสเปกครบทั้ง 2 แผ่น ไม่หายครับ`
      );
    } catch (err: any) {
      setDirectPrintStatus('');
      setDirectPrintError(err?.message || 'เกิดข้อผิดพลาดในการพิมพ์แผ่นทดสอบ');
    } finally {
      setIsDirectPrinting(false);
    }
  };

  // Build HTML and trigger print via hidden iframe for exact cm sizing
  const handlePrintLabels = () => {
    if (totalLabels === 0) {
      alert('กรุณาเลือกสินค้าอย่างน้อย 1 รายการเพื่อพิมพ์บาร์โค้ด');
      return;
    }

    const wCm = Math.max(1.2, Number(config.widthCm) || 5.0);
    const hCm = Math.max(1.0, Number(config.heightCm) || 3.0);
    const isSplit = Boolean(config.splitSheet);
    const labelHCm = isSplit ? Math.round((hCm / 2) * 100) / 100 : hCm;
    const isRoll = config.paperMode === 'roll';
    const cols = isRoll ? config.columnsPerRow || 1 : 1;
    const gapCm = isRoll && cols > 1 ? Number(config.columnGapCm) || 0.2 : 0;
    const totalRollWidthCm =
      Math.round((wCm * cols + gapCm * (cols - 1)) * 100) / 100;

    const offsetX = Number(config.offsetXMm) || 0;
    const offsetY = Number(config.offsetYMm) || 0;

    const buildCardHtml = (product: Product, extraClass = '') => {
      const svgMarkup = generateBarcodeSvgString(product.sku);
      const weightText = product.weight_grams ? `${product.weight_grams}g` : '';
      const dimText = product.dimensions ? product.dimensions : '';
      const specsLine = [weightText, dimText].filter(Boolean).join(' • ');
      const priceText =
        product.selling_price && product.selling_price > 0
          ? `฿${product.selling_price.toLocaleString()}`
          : '';

      return `
          <div class="label-card ${extraClass}">
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
        `;
    };

    // One HTML unit per physical sheet
    const expandedCardsHtml: string[] = printSheets.map((slots) => {
      if (!isSplit) {
        return buildCardHtml(slots[0] as Product, 'print-unit');
      }
      const halves = slots
        .map((p) => (p ? buildCardHtml(p) : `<div class="label-card blank-slot"></div>`))
        .join('\n');
      return `<div class="sheet-card print-unit">${halves}</div>`;
    });

    // Group into rows if multi-column thermal roll (e.g. EasyPrint ES-9920EW 2 or 3 columns)
    let bodyContentHtml = '';
    if (isRoll && cols > 1) {
      const rowsHtml: string[] = [];
      for (let i = 0; i < expandedCardsHtml.length; i += cols) {
        const rowChunk = expandedCardsHtml.slice(i, i + cols);
        rowsHtml.push(`<div class="roll-row">${rowChunk.join('\n')}</div>`);
      }
      bodyContentHtml = rowsHtml.join('\n');
    } else {
      bodyContentHtml = `<div class="labels-wrapper">${expandedCardsHtml.join('\n')}</div>`;
    }

    const printCss = `
      @page {
        size: ${isRoll ? `${totalRollWidthCm}cm ${hCm}cm` : 'A4 portrait'};
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
      .roll-row {
        width: ${totalRollWidthCm}cm;
        height: ${hCm}cm;
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        justify-content: flex-start;
        gap: ${gapCm}cm;
        page-break-after: always;
        break-after: page;
        overflow: hidden;
      }
      .roll-row:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .label-card {
        width: ${wCm}cm;
        height: ${labelHCm}cm;
        padding: ${metrics.paddingCm}cm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        text-align: center;
        overflow: hidden;
        background: #ffffff;
      }
      .sheet-card {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: #ffffff;
      }
      .sheet-card .label-card {
        flex-shrink: 0;
      }
      .blank-slot {
        padding: 0;
      }
      ${
        !isRoll && isSplit
          ? '.sheet-card .label-card:first-child { border-bottom: 0.5pt dashed #cbd5e1; }'
          : ''
      }
      .print-unit {
        width: ${wCm}cm;
        height: ${hCm}cm;
        transform: translate(${offsetX}mm, ${offsetY}mm);
        ${
          isRoll && cols === 1
            ? 'page-break-after: always; break-after: page;'
            : !isRoll
            ? 'border: 0.5pt dashed #cbd5e1; page-break-inside: avoid; break-inside: avoid;'
            : ''
        }
      }
      .print-unit:last-child {
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
          <title>Vivida Crystal Barcode (${totalRollWidthCm}x${hCm}cm${isSplit ? ' • 2 ดวง/แผ่น' : ''})</title>
          <style>${printCss}</style>
        </head>
        <body>
          ${bodyContentHtml}
        </body>
      </html>`;

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

  /**
   * Export high-resolution 300 DPI PNG label image (specifically for NIIMBOT B21 Pro / EasyPrint mobile app via Bluetooth)
   */
  const handleExport300DpiImage = async (targetProduct: Product) => {
    setIsExportingImage(true);
    try {
      // 300 DPI = 118.11 pixels per cm. Use 2x supersampling (236.22 px/cm) for razor-sharp barcode lines
      const pxPerCm = 236.22;
      const canvasW = Math.round(config.widthCm * pxPerCm);
      const sheetH = Math.round(config.heightCm * pxPerCm);

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = sheetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Pure white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, sheetH);

      // Decide which slot(s) of the sheet to fill
      let slots: (Product | null)[] = [targetProduct];
      if (config.splitSheet) {
        const found = printSheets.find((s) => s.some((p) => p?.id === targetProduct.id));
        slots =
          found ||
          (config.splitMode === 'bottom' ? [null, targetProduct] : [targetProduct, null]);
      }
      const slotPx = Math.floor(sheetH / slots.length);
      const slotHCm = config.heightCm / slots.length;

      const drawLabelRegion = (labelProduct: Product, canvasH: number, labelHCm: number) => {
      const targetProduct = labelProduct;
      const isTiny = labelHCm <= 1.8 || config.widthCm <= 2.8;
      const padPx = Math.round((isTiny ? 0.1 : 0.14) * pxPerCm);

      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Convert pt to canvas px (1 pt = 0.0352778 cm)
      const ptToPx = (pt: number) => Math.round(pt * 0.0352778 * pxPerCm);

      const storeFontPx = config.showStoreName ? ptToPx(metrics.storeFontPt) : 0;
      const skuFontPx = config.showSkuText ? ptToPx(metrics.skuFontPt) : 0;
      const nameFontPx = config.showStoneName ? ptToPx(metrics.nameFontPt) : 0;

      const weightText = targetProduct.weight_grams ? `${targetProduct.weight_grams}g` : '';
      const dimText = targetProduct.dimensions || '';
      const specsLine = [weightText, dimText].filter(Boolean).join(' • ');
      const priceText =
        targetProduct.selling_price && targetProduct.selling_price > 0
          ? `฿${targetProduct.selling_price.toLocaleString()}`
          : '';

      const priceFontPx = config.showPrice && priceText ? ptToPx(metrics.priceFontPt) : 0;
      const metaFontPx = config.showWeightAndDim && specsLine ? ptToPx(metrics.metaFontPt) : 0;
      const bottomRowFontPx = Math.max(priceFontPx, metaFontPx);
      const hasBottomLine = Boolean(bottomRowFontPx > 0);

      // Safe bottom margin (8.5% = ~2.5mm on a 30mm label) ensures the bottom line prints flush
      // against the physical bottom edge without sensor cutoff
      const bottomMarginPx = Math.max(16, Math.round(Math.min(0.255, labelHCm * 0.085) * pxPerCm));
      const printableBottomPx = canvasH - bottomMarginPx;
      const bottomY = printableBottomPx - bottomRowFontPx;
      const dividerGap = Math.max(4, Math.round(0.035 * pxPerCm));
      const dividerY = bottomY - dividerGap;

      const storeLineH = config.showStoreName ? Math.round(storeFontPx * 1.15) : 0;
      const skuLineH = config.showSkuText ? Math.round(skuFontPx * 1.15) : 0;
      const nameLineH = config.showStoneName ? Math.round(nameFontPx * 1.15) : 0;
      const barcodeGap = Math.max(4, Math.round(0.04 * pxPerCm));

      const totalTextH = storeLineH + skuLineH + nameLineH;
      const maxAvailableBarcodeH = hasBottomLine
        ? dividerY - dividerGap - padPx - totalTextH - barcodeGap
        : printableBottomPx - padPx - totalTextH - barcodeGap;

      const targetBarcodeH = Math.round(metrics.barcodeHeightCm * pxPerCm);
      const barcodeH = Math.max(30, Math.min(targetBarcodeH, maxAvailableBarcodeH));

      let currentY = padPx;
      const innerW = canvasW - padPx * 2;

      // 1. Store Name
      if (config.showStoreName) {
        ctx.font = `800 ${storeFontPx}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillText('VIVIDA CRYSTAL', canvasW / 2, currentY, innerW);
        currentY += storeLineH;
      }

      // 2. Barcode Bars (Crisp integer pixel coordinates)
      const encoded = encodeCode128B(targetProduct.sku);
      const barcodeW = Math.round(innerW * 0.96);
      const moduleW = barcodeW / encoded.totalModules;
      const barcodeStartX = Math.round((canvasW - barcodeW) / 2);

      ctx.fillStyle = '#000000';
      encoded.bars.forEach((bar) => {
        const x1 = Math.round(barcodeStartX + bar.x * moduleW);
        const x2 = Math.round(barcodeStartX + (bar.x + bar.width) * moduleW);
        ctx.fillRect(x1, currentY, Math.max(1, x2 - x1), barcodeH);
      });
      currentY += barcodeH + barcodeGap;

      // 3. SKU Line
      if (config.showSkuText) {
        ctx.font = `900 ${skuFontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.fillText(targetProduct.sku, canvasW / 2, currentY, innerW);
        currentY += skuLineH;
      }

      // 4. Stone Name (Guaranteed clean gap before divider line)
      if (config.showStoneName) {
        ctx.font = `700 ${nameFontPx}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillText(targetProduct.stone_type || targetProduct.name, canvasW / 2, currentY, innerW);
        currentY += nameLineH;
      }

      // 5. Bottom Meta & Price Line
      // In tiny or split labels, stack divider & specs directly below stone name so it finishes
      // well before the physical 25.5 mm gap sensor cutoff
      const sequentialDividerY = currentY + dividerGap;
      const sequentialBottomY = sequentialDividerY + dividerGap + 2;
      const actualDividerY = isTiny ? sequentialDividerY : Math.min(sequentialDividerY, dividerY);
      const actualBottomY = isTiny ? sequentialBottomY : Math.min(sequentialBottomY, bottomY);

      if (hasBottomLine) {
        // Divider line (pure black for sharp thermal printing)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padPx, actualDividerY);
        ctx.lineTo(canvasW - padPx, actualDividerY);
        ctx.stroke();

        if (config.showWeightAndDim && config.showPrice && specsLine && priceText) {
          ctx.textAlign = 'left';
          ctx.font = `600 ${metaFontPx}px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillText(specsLine, padPx, actualBottomY, innerW * 0.62);

          ctx.textAlign = 'right';
          ctx.font = `900 ${priceFontPx}px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillText(priceText, canvasW - padPx, actualBottomY - Math.round((priceFontPx - metaFontPx) * 0.3));
        } else {
          ctx.textAlign = 'center';
          const textToDraw = config.showPrice && priceText ? priceText : specsLine;
          const fPx = config.showPrice && priceText ? priceFontPx : metaFontPx;
          ctx.font = `800 ${fPx}px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillText(textToDraw, canvasW / 2, actualBottomY, innerW);
        }
      }
      };

      slots.forEach((p, i) => {
        if (!p) return;
        ctx.save();
        if (config.splitSheet && slots.length === 2) {
          const slotTopPx = i === 0
            ? Math.round(0.02 * pxPerCm)
            : Math.round((slotHCm - 0.05) * pxPerCm);
          const slotHPx = Math.round((slotHCm - (i === 0 ? 0.08 : 0.14)) * pxPerCm);
          const slotHCmEffective = slotHPx / pxPerCm;
          ctx.translate(0, slotTopPx);
          ctx.beginPath();
          ctx.rect(0, 0, canvasW, slotHPx);
          ctx.clip();
          drawLabelRegion(p, slotHPx, slotHCmEffective);
        } else {
          ctx.translate(0, i * slotPx);
          ctx.beginPath();
          ctx.rect(0, 0, canvasW, slotPx);
          ctx.clip();
          drawLabelRegion(p, slotPx, slotHCm);
        }
        ctx.restore();
      });

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png', 1.0)
      );
      if (!blob) return;

      const skuPart = slots.map((p) => (p ? p.sku : 'blank')).join('+');
      const fileName = `Barcode_${skuPart}_${config.widthCm}x${config.heightCm}cm.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // Try native iOS / mobile share sheet first so user can send directly to NIIMBOT app
      if (
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: `บาร์โค้ด ${targetProduct.sku} (${config.widthCm}×${config.heightCm} cm)`,
          });
          return;
        } catch {
          // User cancelled share or fallback to download
        }
      }

      // Fallback: direct file download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingImage(false);
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

  const previewSlots: (Product | null)[] = useMemo(() => {
    if (!config.splitSheet) {
      return [previewProduct];
    }
    if (printSheets.length > 0) {
      return printSheets[0];
    }
    if (config.splitMode === 'top') return [previewProduct, null];
    if (config.splitMode === 'bottom') return [null, previewProduct];
    const secondProduct = selectedItems[1]?.product || previewProduct;
    return [previewProduct, secondProduct];
  }, [config.splitSheet, config.splitMode, printSheets, previewProduct, selectedItems]);

  const renderPreviewSlot = (
    slotProduct: Product | null,
    slotH: number,
    slotIndex: number
  ) => {
    if (!slotProduct) {
      return (
        <div
          key={`slot-${slotIndex}`}
          style={{
            width: `${config.widthCm}cm`,
            height: `${slotH}cm`,
          }}
          className="flex flex-col items-center justify-center text-center p-2 bg-slate-50 text-slate-400 select-none"
        >
          <span className="text-[10px] font-bold text-slate-400">
            {slotIndex === 0 ? 'ช่องบน: ว่าง (ไม่พิมพ์)' : 'ช่องล่าง: ว่าง (ไม่พิมพ์)'}
          </span>
          <span className="text-[9px] text-slate-300">ประหยัดสติกเกอร์ส่วนนี้</span>
        </div>
      );
    }

    const slotBarcode = encodeCode128B(slotProduct.sku);
    const slotWeight = slotProduct.weight_grams ? `${slotProduct.weight_grams}g` : '';
    const slotDim = slotProduct.dimensions || '';
    const slotSpecs = [slotWeight, slotDim].filter(Boolean).join(' • ');
    const slotPrice =
      slotProduct.selling_price && slotProduct.selling_price > 0
        ? `฿${slotProduct.selling_price.toLocaleString()}`
        : '';

    return (
      <div
        key={`slot-${slotIndex}`}
        style={{
          width: `${config.widthCm}cm`,
          height: `${slotH}cm`,
          padding: `${metrics.paddingCm}cm`,
        }}
        className="relative bg-white text-black flex flex-col justify-between items-center text-center overflow-hidden select-none"
      >
        {config.splitSheet && (
          <span className="absolute top-0.5 right-1 text-[7.5px] font-extrabold text-slate-300 uppercase select-none pointer-events-none">
            {slotIndex === 0 ? 'บน' : 'ล่าง'}
          </span>
        )}

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
            viewBox={`0 0 ${slotBarcode.totalModules} 100`}
            preserveAspectRatio="none"
            className="w-full h-full block"
            style={{ shapeRendering: 'crispEdges' }}
          >
            {slotBarcode.bars.map((bar, idx) => (
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
            {slotProduct.sku}
          </div>
        )}

        {config.showStoneName && (
          <div
            style={{ fontSize: `${metrics.nameFontPt}pt` }}
            className="font-bold leading-tight truncate w-full text-slate-900"
          >
            {slotProduct.stone_type || slotProduct.name}
          </div>
        )}

        {((config.showWeightAndDim && slotSpecs) ||
          (config.showPrice && slotPrice)) && (
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
                {slotSpecs}
              </span>
            )}
            {config.showPrice && (
              <span
                style={{ fontSize: `${metrics.priceFontPt}pt` }}
                className="font-black text-black shrink-0"
              >
                {slotPrice}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const isNiimbotOverWidth =
    config.printerProfile === 'niimbot_b21_pro' && config.widthCm > 5.0;

  if (!isOpen) return null;

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
                ปริ้นบาร์โค้ด (NIIMBOT B2 Pro & EasyPrint ES-9920EW)
              </h3>
              <p className="text-xs text-slate-300 truncate">
                ขนาดป้าย: <strong className="text-amber-300">{config.widthCm} × {config.heightCm} cm</strong> ({Math.round(config.widthCm * 10)} × {Math.round(config.heightCm * 10)} mm)
                {config.columnsPerRow > 1 ? ` • เรียง ${config.columnsPerRow} ดวง/แถว` : ''}
                {config.splitSheet
                  ? ` • แบ่ง 2 ดวง/แผ่น (${config.widthCm}×${slotHeightCm} cm) • ${totalLabels} ดวง = ${totalSheets} แผ่น`
                  : ` • รวม ${totalLabels} ดวง`}
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
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">
          {/* Printer Model Selector Banner */}
          <div className="space-y-2.5">
            <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-purple-600" />
              <span>เลือกเครื่องพิมพ์บาร์โค้ดที่ใช้งาน:</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectPrinterProfile('niimbot_b21_pro')}
                className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                  config.printerProfile === 'niimbot_b21_pro'
                    ? 'bg-purple-950 text-white border-purple-800 shadow-md ring-2 ring-purple-500/40'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'
                }`}
              >
                <Smartphone
                  className={`w-5 h-5 mt-0.5 shrink-0 ${
                    config.printerProfile === 'niimbot_b21_pro'
                      ? 'text-purple-300'
                      : 'text-purple-600'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5">
                    <span>NIIMBOT B2 Pro</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-200 font-bold">
                      300 DPI
                    </span>
                  </div>
                  <p
                    className={`text-[11px] mt-0.5 ${
                      config.printerProfile === 'niimbot_b21_pro'
                        ? 'text-purple-200'
                        : 'text-slate-400'
                    }`}
                  >
                    สั่งปริ้นตรงจากหน้าเว็บผ่าน Bluetooth / สาย USB ไม่ต้องโหลดไฟล์
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPrinterProfile('easyprint_es9920ew')}
                className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                  config.printerProfile === 'easyprint_es9920ew'
                    ? 'bg-blue-950 text-white border-blue-800 shadow-md ring-2 ring-blue-500/40'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                }`}
              >
                <Wifi
                  className={`w-5 h-5 mt-0.5 shrink-0 ${
                    config.printerProfile === 'easyprint_es9920ew'
                      ? 'text-blue-300'
                      : 'text-blue-600'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5">
                    <span>EasyPrint ES-9920EW</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-200 font-bold">
                      Wi-Fi/USB
                    </span>
                  </div>
                  <p
                    className={`text-[11px] mt-0.5 ${
                      config.printerProfile === 'easyprint_es9920ew'
                        ? 'text-blue-200'
                        : 'text-slate-400'
                    }`}
                  >
                    หน้ากว้างสูงสุด 10.8 cm • รองรับสติกเกอร์ 1–3 ตอนเรียง
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPrinterProfile('a4_sheet')}
                className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                  config.printerProfile === 'a4_sheet'
                    ? 'bg-slate-900 text-white border-slate-800 shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <FileText
                  className={`w-5 h-5 mt-0.5 shrink-0 ${
                    config.printerProfile === 'a4_sheet' ? 'text-amber-300' : 'text-slate-500'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-extrabold">กระดาษสติกเกอร์แผ่น A4</div>
                  <p
                    className={`text-[11px] mt-0.5 ${
                      config.printerProfile === 'a4_sheet' ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    เรียงหลายดวงในแผ่น A4 พร้อมเส้นประตัด
                  </p>
                </div>
              </button>
            </div>

            {/* Direct Connection & 1-Click Print Bar for NIIMBOT B21 / B2 Pro */}
            {config.printerProfile === 'niimbot_b21_pro' && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white border border-purple-700/60 shadow-lg space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        niimbotConn.connected
                          ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                          : 'bg-amber-400 animate-pulse'
                      }`}
                    />
                    <span className="text-xs sm:text-sm font-extrabold">
                      {niimbotConn.connected
                        ? `เชื่อมต่อแล้ว: ${niimbotConn.deviceName} (${niimbotDpiState} DPI)`
                        : 'โหมดสั่งปริ้นตรงเข้า NIIMBOT B21 / B2 Pro จากหน้าเว็บทันที (ไม่ต้องโหลดไฟล์)'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {!niimbotConn.connected ? (
                      <>
                        <button
                          type="button"
                          onClick={handleConnectBluetooth}
                          disabled={isDirectPrinting}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition active:scale-95"
                        >
                          <Bluetooth className="w-3.5 h-3.5" />
                          <span>เชื่อมต่อ Bluetooth (B21 / B2 Pro)</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleConnectUsb}
                          disabled={isDirectPrinting}
                          className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-1.5 border border-white/20 transition active:scale-95"
                        >
                          <Usb className="w-3.5 h-3.5" />
                          <span>ต่อสาย USB</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleDisconnectNiimbot}
                        disabled={isDirectPrinting}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 text-[11px] font-bold transition"
                      >
                        สลับ / ตัดการเชื่อมต่อ
                      </button>
                    )}
                  </div>
                </div>

                {/* Density & Resolution Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/10 text-[11px] text-purple-200">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-300">ความเข้มหมึกความร้อน:</span>
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setNiimbotDensity(lvl)}
                          className={`w-6 h-6 rounded-lg font-bold transition ${
                            niimbotDensity === lvl
                              ? 'bg-amber-400 text-slate-950 shadow'
                              : 'bg-white/10 text-slate-300 hover:bg-white/20'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-slate-300">ความละเอียด:</span>
                      {([203, 300] as const).map((dpiVal) => (
                        <button
                          key={dpiVal}
                          type="button"
                          onClick={() => {
                            setNiimbotDpiState(dpiVal);
                            setNiimbotDpi(dpiVal);
                          }}
                          className={`px-2 py-0.5 rounded-lg font-bold transition ${
                            niimbotDpiState === dpiVal
                              ? 'bg-purple-500 text-white shadow'
                              : 'bg-white/10 text-slate-300 hover:bg-white/20'
                          }`}
                        >
                          {dpiVal} DPI {dpiVal === 203 ? '(B21 มาตรฐาน)' : '(B2 Pro)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <span className="text-[11px] text-amber-300/90">
                    💡 NIIMBOT B21 มาตรฐานคือ 203 DPI (8 จุด/มม.) • หากเปิดแอป NIIMBOT บนคอมอยู่ ให้กดตัดการเชื่อมต่อในแอปก่อน
                  </span>
                </div>

                {/* 1-Click Quick Test Print Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-purple-900/60 border border-purple-500/40 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>ทดสอบพิมพ์ป้ายแบ่ง 2 ชั้น (4×1.5 cm × 2)</span>
                        <span className="text-[10px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 px-1.5 py-0.2 rounded font-extrabold">
                          1 แผ่น
                        </span>
                      </div>
                      <div className="text-[11px] text-purple-200">
                        พิมพ์ AZU-001 บน และ AZU-002 ล่าง (มีสเปกครบทั้งคู่ เพื่อดูว่าด้านล่างไม่หาย)
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleTestPrintNiimbot(203)}
                      disabled={isDirectPrinting}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                      title="สั่งพิมพ์แผ่นทดสอบที่ 203 DPI (แนะนำสำหรับ B21) ปริ้นครบยันบรรทัดล่างสุด"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>พิมพ์เทส 203 DPI (แนะนำ)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestPrintNiimbot(300)}
                      disabled={isDirectPrinting}
                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-xs border border-white/20 transition active:scale-95 disabled:opacity-50"
                      title="ลองพิมพ์ที่ 300 DPI เพื่อดูความแตกต่าง (จะเห็นว่าสเปกแผ่นล่างหลุดขอบ)"
                    >
                      <span>พิมพ์เทส 300 DPI</span>
                    </button>
                  </div>
                </div>

                {/* Live status or error feedback */}
                {directPrintStatus && (
                  <div className="px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold flex items-center gap-2">
                    {isDirectPrinting ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0 text-emerald-300" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
                    )}
                    <span>{directPrintStatus}</span>
                  </div>
                )}

                {directPrintError && (
                  <div className="px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-300" />
                    <span>{directPrintError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN: Size & Display Settings */}
            <div className="lg:col-span-7 space-y-5">
              {/* 1. Custom Size in CM */}
              <div className="p-4 sm:p-5 bg-purple-50/60 border border-purple-200/80 rounded-2xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs sm:text-sm font-bold text-purple-950 flex items-center gap-1.5">
                    <Ruler className="w-4 h-4 text-purple-600" />
                    <span>1. กำหนดไซส์สติกเกอร์ที่จะปริ้น (หน่วย: cm)</span>
                  </label>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 bg-purple-200/70 text-purple-900 rounded-full">
                    {config.widthCm} × {config.heightCm} cm ({Math.round(config.widthCm * 10)} × {Math.round(config.heightCm * 10)} มม.)
                  </span>
                </div>

                {/* Warning if NIIMBOT B2 Pro width > 5.0 cm */}
                {isNiimbotOverWidth && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-900">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        เครื่อง <strong>NIIMBOT B2 Pro</strong> รองรับความกว้างสติกเกอร์สูงสุด{' '}
                        <strong>5.0 cm (50 mm)</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateConfig({ widthCm: 5.0 })}
                      className="px-2.5 py-1 bg-amber-600 text-white font-bold rounded-lg shrink-0 hover:bg-amber-700"
                    >
                      ปรับเป็น 5.0 cm
                    </button>
                  </div>
                )}

                {/* Quick Size Presets for Active Printer */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block mb-2">
                    ขนาดสติกเกอร์มาตรฐานสำหรับ{' '}
                    {config.printerProfile === 'niimbot_b21_pro'
                      ? 'NIIMBOT B2 Pro'
                      : config.printerProfile === 'easyprint_es9920ew'
                      ? 'EasyPrint ES-9920EW'
                      : 'แผ่น A4'}{' '}
                    (หรือกรอกขนาด cm เองด้านล่าง):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {filteredPresets.map((preset) => {
                      const presetCols = preset.columnsPerRow || 1;
                      const presetSplit = Boolean(preset.splitSheet);
                      const active =
                        Math.abs(config.widthCm - preset.widthCm) < 0.01 &&
                        Math.abs(config.heightCm - preset.heightCm) < 0.01 &&
                        config.columnsPerRow === presetCols &&
                        Boolean(config.splitSheet) === presetSplit;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            updateConfig({
                              widthCm: preset.widthCm,
                              heightCm: preset.heightCm,
                              columnsPerRow: presetCols,
                              splitSheet: presetSplit,
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
                      ความกว้างต่อดวง (Width: cm)
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
                          max="12"
                          value={config.widthCm}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              updateConfig({ widthCm: Math.min(12, Math.max(1.0, val)) });
                            }
                          }}
                          className="w-full text-center font-mono font-black text-base py-1.5 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({
                            widthCm: Math.min(12, Math.round((config.widthCm + 0.1) * 10) / 10),
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
                      {config.splitSheet ? 'ความสูงทั้งแผ่น (Height: cm)' : 'ความสูงต่อดวง (Height: cm)'}
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
                      {config.splitSheet ? ` → ดวงละ ${slotHeightCm} ซม.` : ''}
                    </span>
                  </div>
                </div>

                {/* Split-sheet mode: 1 sticker die-cut into top / bottom labels */}
                <div
                  className={`p-3 rounded-xl border space-y-2.5 transition ${
                    config.splitSheet
                      ? 'bg-emerald-50/80 border-emerald-300'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => updateConfig({ splitSheet: !config.splitSheet })}
                    className="w-full flex items-center justify-between gap-2 text-left"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Rows2
                        className={`w-4 h-4 shrink-0 ${
                          config.splitSheet ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-slate-800">
                          กระดาษ 1 แผ่นแบ่งเป็น 2 ดวง (บน / ล่าง)
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          แผ่น {config.widthCm}×{config.heightCm} cm → ดวงละ {config.widthCm}×
                          {Math.round((config.heightCm / 2) * 100) / 100} cm
                        </span>
                      </span>
                    </span>
                    <span
                      className={`relative w-10 h-6 rounded-full transition shrink-0 ${
                        config.splitSheet ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                          config.splitSheet ? 'left-[18px]' : 'left-0.5'
                        }`}
                      />
                    </span>
                  </button>

                  {config.splitSheet && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            {
                              id: 'both',
                              icon: Rows2,
                              label: '2 รหัส / แผ่น',
                              desc: 'บน + ล่าง (คุ้มสุด)',
                            },
                            {
                              id: 'top',
                              icon: PanelTop,
                              label: '1 รหัส – บน',
                              desc: 'ช่องล่างว่าง',
                            },
                            {
                              id: 'bottom',
                              icon: PanelBottom,
                              label: '1 รหัส – ล่าง',
                              desc: 'ช่องบนว่าง',
                            },
                          ] as { id: SplitSheetMode; icon: typeof Rows2; label: string; desc: string }[]
                        ).map((opt) => {
                          const Icon = opt.icon;
                          const active = config.splitMode === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => updateConfig({ splitMode: opt.id })}
                              className={`p-2 rounded-lg border text-left transition active:scale-95 ${
                                active
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                                <Icon className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{opt.label}</span>
                              </div>
                              <div
                                className={`text-[10px] mt-0.5 truncate ${
                                  active ? 'text-emerald-100' : 'text-slate-400'
                                }`}
                              >
                                {opt.desc}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="text-[11px] text-emerald-900 bg-white/70 border border-emerald-200 rounded-lg px-2.5 py-1.5 space-y-0.5">
                        <div>
                          📄 พิมพ์ <strong>{totalLabels}</strong> ดวง → ใช้กระดาษ{' '}
                          <strong>{totalSheets}</strong> แผ่น
                          {blankSlots > 0 && (
                            <span className="text-amber-700"> • เว้นว่าง {blankSlots} ช่อง</span>
                          )}
                        </div>
                        {config.splitMode === 'both' && totalLabels % 2 === 1 && (
                          <div className="text-amber-700">
                            จำนวนเป็นเลขคี่ แผ่นสุดท้ายจะเหลือช่องล่างว่าง 1 ช่อง (เพิ่มอีก 1 ดวงให้เต็มแผ่นได้)
                          </div>
                        )}
                        {config.splitMode === 'both' && (
                          <div className="text-slate-500">
                            เรียงตามรายการ: ดวงที่ 1 → บน, ดวงที่ 2 → ล่าง, ดวงที่ 3 → บนแผ่นถัดไป…
                          </div>
                        )}
                        {config.showStoreName && slotHeightCm < 2 && (
                          <div className="text-slate-500">
                            💡 ดวงเตี้ย {slotHeightCm} cm แนะนำปิด &quot;ชื่อร้าน&quot; เพื่อให้แท่งบาร์โค้ดสูงขึ้น สแกนง่ายขึ้น
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Multi-Column Roll Option for EasyPrint ES-9920EW */}
                {config.printerProfile === 'easyprint_es9920ew' && (
                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-blue-600" />
                        จำนวนดวงสติกเกอร์ต่อแถว (สำหรับม้วน EasyPrint ES-9920EW):
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { cols: 1, label: '1 ดวงเดี่ยว / แถว' },
                          { cols: 2, label: '2 ดวงคู่ / แถว' },
                          { cols: 3, label: '3 ดวงเรียง / แถว' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.cols}
                          type="button"
                          onClick={() => updateConfig({ columnsPerRow: opt.cols })}
                          className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition ${
                            config.columnsPerRow === opt.cols
                              ? 'bg-blue-700 text-white border-blue-700'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Font Scale, Visible Fields & Fine Offset Calibration */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-purple-600" />
                    <span>2. ข้อมูลบนป้าย & ขนาดตัวอักษร</span>
                  </label>
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

                {/* Fine Offset Calibration (mm) for thermal rolls */}
                <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-600 flex items-center gap-1">
                    <Move className="w-3.5 h-3.5 text-slate-400" />
                    ชดเชยตำแหน่งพิมพ์ (กรณีกระดาษเยื้องขอบ):
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500">ซ้าย-ขวา:</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({
                            offsetXMm: Math.round(((config.offsetXMm || 0) - 0.5) * 10) / 10,
                          })
                        }
                        className="px-1.5 font-bold hover:bg-slate-100 rounded"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold w-10 text-center">
                        {config.offsetXMm || 0}mm
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({
                            offsetXMm: Math.round(((config.offsetXMm || 0) + 0.5) * 10) / 10,
                          })
                        }
                        className="px-1.5 font-bold hover:bg-slate-100 rounded"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500">บน-ล่าง:</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({
                            offsetYMm: Math.round(((config.offsetYMm || 0) - 0.5) * 10) / 10,
                          })
                        }
                        className="px-1.5 font-bold hover:bg-slate-100 rounded"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold w-10 text-center">
                        {config.offsetYMm || 0}mm
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({
                            offsetYMm: Math.round(((config.offsetYMm || 0) + 0.5) * 10) / 10,
                          })
                        }
                        className="px-1.5 font-bold hover:bg-slate-100 rounded"
                      >
                        +
                      </button>
                    </div>
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
                    ตัวอย่างป้ายตามขนาดจริง
                  </span>
                  <span className="font-mono text-[11px] text-amber-300 font-bold">
                    {config.widthCm} cm × {config.heightCm} cm
                  </span>
                </div>

                {/* Top horizontal ruler indicator */}
                <div className="flex flex-col items-center py-2">
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
                      }}
                      className="bg-white text-black rounded-md shadow-xl border border-slate-300 flex flex-col overflow-hidden select-none divide-y divide-dashed divide-amber-400"
                    >
                      {previewSlots.map((slotProd, sIdx) =>
                        renderPreviewSlot(slotProd, slotHeightCm, sIdx)
                      )}
                    </div>

                    {/* Side vertical ruler indicator */}
                    <div
                      style={{ height: `${config.heightCm}cm` }}
                      className="flex flex-col justify-between text-[9px] font-mono text-amber-300 border-l border-amber-400/50 pl-1"
                    >
                      <span>0</span>
                      {config.splitSheet && (
                        <span className="text-amber-400 font-bold">-{slotHeightCm}</span>
                      )}
                      <span>{config.heightCm}cm</span>
                    </div>
                  </div>
                </div>

                {/* Direct 300 DPI PNG Save / Share for NIIMBOT iOS App */}
                <button
                  type="button"
                  disabled={isExportingImage}
                  onClick={() =>
                    handleExport300DpiImage(
                      previewSlots[0] || previewSlots[1] || previewProduct
                    )
                  }
                  className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-amber-300 border border-amber-400/30 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isExportingImage
                      ? 'กำลังสร้างภาพ 300 DPI...'
                      : config.splitSheet
                      ? `บันทึกรูปป้าย 300 DPI (แผ่น ${config.widthCm}×${config.heightCm} cm แบ่ง 2 ดวง)`
                      : `บันทึกรูปป้าย 300 DPI (${previewProduct.sku}) ส่งเข้าแอป NIIMBOT`}
                  </span>
                </button>
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
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
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
                            onClick={() => handleExport300DpiImage(product)}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800"
                            title="บันทึกรูป 300 DPI สำหรับแอป NIIMBOT"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductCopies(product.id, copies - 1)}
                            className="p-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700"
                            title="ลดจำนวนดวง"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center font-mono font-black text-slate-900">
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
        <div className="shrink-0 px-5 sm:px-6 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-100 transition"
          >
            ปิดหน้าต่าง
          </button>

          <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial justify-end">
            {config.printerProfile === 'niimbot_b21_pro' && (
              <button
                type="button"
                onClick={handleDirectNiimbotPrint}
                disabled={totalLabels === 0 || isDirectPrinting}
                className="flex-1 sm:flex-initial px-5 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-700 hover:via-teal-700 hover:to-cyan-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 active:scale-95 transition"
                title="สั่งปริ้นตรงเข้าเครื่อง NIIMBOT B21 / B2 Pro ผ่าน Bluetooth / USB ทันที ไม่ต้องโหลดไฟล์"
              >
                {isDirectPrinting ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 shrink-0 text-amber-300" />
                )}
                <span>
                  {isDirectPrinting
                    ? 'กำลังปริ้นออก NIIMBOT...'
                    : config.splitSheet
                    ? `ปริ้นออก NIIMBOT ทันที (${totalLabels} ดวง • ${totalSheets} แผ่น)`
                    : `ปริ้นออก NIIMBOT ทันที (${totalLabels} ดวง)`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintLabels}
              disabled={totalLabels === 0}
              className={`px-4 py-2.5 min-h-[44px] rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95 transition ${
                config.printerProfile === 'niimbot_b21_pro'
                  ? 'bg-slate-900 hover:bg-slate-800 text-white'
                  : 'flex-1 sm:flex-initial px-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-600/25'
              } disabled:opacity-50`}
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>
                {config.printerProfile === 'niimbot_b21_pro'
                  ? 'ปริ้นผ่านไดรเวอร์ระบบ'
                  : config.splitSheet
                  ? `สั่งปริ้น (${config.widthCm}×${config.heightCm} cm • ${totalLabels} ดวง • ${totalSheets} แผ่น)`
                  : `สั่งปริ้น (${config.widthCm}×${config.heightCm} cm • ${totalLabels} ดวง)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
