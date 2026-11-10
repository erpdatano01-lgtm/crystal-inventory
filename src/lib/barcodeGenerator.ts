// Standard Code 128 patterns (widths of alternating bars and spaces: B S B S B S, sum = 11; stop = 13)
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

export interface BarcodeBar {
  x: number;
  width: number;
}

export interface EncodedBarcode {
  bars: BarcodeBar[];
  totalModules: number;
  cleanText: string;
}

/**
 * Encode an ASCII string into Code 128 Set B bar coordinates.
 * Automatically strips unsupported non-ASCII characters and falls back to 'CRY-001' if empty.
 */
export function encodeCode128B(rawText: string): EncodedBarcode {
  const cleanText =
    (rawText || '')
      .trim()
      .split('')
      .filter((ch) => {
        const code = ch.charCodeAt(0);
        return code >= 32 && code <= 126;
      })
      .join('') || 'CRY-001';

  const codes: number[] = [104]; // Start Code B
  let checksum = 104;

  for (let i = 0; i < cleanText.length; i++) {
    const val = cleanText.charCodeAt(i) - 32;
    codes.push(val);
    checksum += val * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(106); // Stop Code

  const quietZone = 8;
  let cursor = quietZone;
  const bars: BarcodeBar[] = [];

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code] || CODE128_PATTERNS[0];
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]);
      if (i % 2 === 0) {
        bars.push({ x: cursor, width: w });
      }
      cursor += w;
    }
  }

  const totalModules = cursor + quietZone;
  return { bars, totalModules, cleanText };
}

/**
 * Generate a self-contained SVG string for HTML print windows
 */
export function generateBarcodeSvgString(text: string): string {
  const { bars, totalModules } = encodeCode128B(text);
  const rects = bars
    .map((b) => `<rect x="${b.x}" y="0" width="${b.width}" height="100" fill="#000000" />`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} 100" preserveAspectRatio="none" style="width:100%;height:100%;display:block;shape-rendering:crispEdges;">${rects}</svg>`;
}

export type PrinterModelProfile = 'niimbot_b21_pro' | 'easyprint_es9920ew' | 'a4_sheet';

export interface BarcodeLabelConfig {
  printerProfile: PrinterModelProfile;
  widthCm: number;
  heightCm: number;
  paperMode: 'roll' | 'a4';
  columnsPerRow: 1 | 2 | 3; // For EasyPrint multi-column sticker rolls
  columnGapCm: number; // Horizontal gap between columns in cm (default 0.2 cm = 2mm)
  offsetXMm: number; // Fine horizontal shift in mm (-5 to +5)
  offsetYMm: number; // Fine vertical shift in mm (-5 to +5)
  showStoreName: boolean;
  showStoneName: boolean;
  showWeightAndDim: boolean;
  showPrice: boolean;
  showSkuText: boolean;
  fontScale: 'sm' | 'md' | 'lg';
}

export const DEFAULT_BARCODE_CONFIG: BarcodeLabelConfig = {
  printerProfile: 'niimbot_b21_pro',
  widthCm: 5.0,
  heightCm: 3.0,
  paperMode: 'roll',
  columnsPerRow: 1,
  columnGapCm: 0.2,
  offsetXMm: 0,
  offsetYMm: 0,
  showStoreName: true,
  showStoneName: true,
  showWeightAndDim: true,
  showPrice: true,
  showSkuText: true,
  fontScale: 'md',
};

export interface BarcodePresetItem {
  label: string;
  desc: string;
  widthCm: number;
  heightCm: number;
  printer: PrinterModelProfile | 'both';
  columnsPerRow?: 1 | 2 | 3;
}

export const BARCODE_SIZE_PRESETS: BarcodePresetItem[] = [
  // NIIMBOT B2 Pro Presets (Max width 5.0 cm, 300 DPI)
  {
    label: '5.0 × 3.0 cm',
    desc: 'ม้วนมาตรฐานคู่ตัว NIIMBOT B2 Pro (50×30 mm)',
    widthCm: 5.0,
    heightCm: 3.0,
    printer: 'both',
    columnsPerRow: 1,
  },
  {
    label: '4.0 × 3.0 cm',
    desc: 'สติกเกอร์ขนาดกลาง ยอดนิยม (40×30 mm)',
    widthCm: 4.0,
    heightCm: 3.0,
    printer: 'both',
    columnsPerRow: 1,
  },
  {
    label: '4.0 × 2.0 cm',
    desc: 'สติกเกอร์ทรงแคบติดถุงซิป/ตลับ (40×20 mm)',
    widthCm: 4.0,
    heightCm: 2.0,
    printer: 'niimbot_b21_pro',
    columnsPerRow: 1,
  },
  {
    label: '3.0 × 2.0 cm',
    desc: 'สติกเกอร์จิ๋วติดหินชิ้นเล็ก (30×20 mm)',
    widthCm: 3.0,
    heightCm: 2.0,
    printer: 'both',
    columnsPerRow: 1,
  },
  {
    label: '3.0 × 2.5 cm',
    desc: 'ป้ายห้อยจิวเวลรี่ / T-Tag (30×25 mm)',
    widthCm: 3.0,
    heightCm: 2.5,
    printer: 'niimbot_b21_pro',
    columnsPerRow: 1,
  },
  {
    label: '5.0 × 5.0 cm',
    desc: 'สติกเกอร์ทรงจัตุรัส NIIMBOT B2 Pro (50×50 mm)',
    widthCm: 5.0,
    heightCm: 5.0,
    printer: 'niimbot_b21_pro',
    columnsPerRow: 1,
  },

  // EasyPrint ES-9920EW Specific Presets (Supports up to 10.8 cm width & Multi-column)
  {
    label: '3.2 × 2.5 cm (1 ตอน)',
    desc: 'สติกเกอร์บาร์โค้ดมาตรฐาน 1 แถว (32×25 mm)',
    widthCm: 3.2,
    heightCm: 2.5,
    printer: 'easyprint_es9920ew',
    columnsPerRow: 1,
  },
  {
    label: '3.2 × 2.5 cm (3 ตอนเรียง)',
    desc: 'สติกเกอร์บาร์โค้ด 3 ดวงเรียงต่อแถว (ES-9920EW)',
    widthCm: 3.2,
    heightCm: 2.5,
    printer: 'easyprint_es9920ew',
    columnsPerRow: 3,
  },
  {
    label: '4.0 × 2.5 cm (2 ตอนคู่)',
    desc: 'สติกเกอร์บาร์โค้ด 2 ดวงคู่ต่อแถว (ES-9920EW)',
    widthCm: 4.0,
    heightCm: 2.5,
    printer: 'easyprint_es9920ew',
    columnsPerRow: 2,
  },
  {
    label: '6.0 × 4.0 cm',
    desc: 'สติกเกอร์ป้ายใหญ่ติดกล่องหิน (60×40 mm)',
    widthCm: 6.0,
    heightCm: 4.0,
    printer: 'easyprint_es9920ew',
    columnsPerRow: 1,
  },
  {
    label: '10.0 × 7.5 cm',
    desc: 'ป้ายขนาดใหญ่พิเศษ EasyPrint (100×75 mm)',
    widthCm: 10.0,
    heightCm: 7.5,
    printer: 'easyprint_es9920ew',
    columnsPerRow: 1,
  },
];

const LS_BARCODE_CONFIG_KEY = 'vivida_barcode_config_v2';

export function getSavedBarcodeConfig(): BarcodeLabelConfig {
  if (typeof window === 'undefined') return DEFAULT_BARCODE_CONFIG;
  try {
    const raw = localStorage.getItem(LS_BARCODE_CONFIG_KEY);
    if (!raw) return DEFAULT_BARCODE_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_BARCODE_CONFIG,
      ...parsed,
      widthCm: Number(parsed.widthCm) > 0 ? Number(parsed.widthCm) : DEFAULT_BARCODE_CONFIG.widthCm,
      heightCm: Number(parsed.heightCm) > 0 ? Number(parsed.heightCm) : DEFAULT_BARCODE_CONFIG.heightCm,
      columnsPerRow:
        parsed.columnsPerRow === 2 || parsed.columnsPerRow === 3 ? parsed.columnsPerRow : 1,
    };
  } catch {
    return DEFAULT_BARCODE_CONFIG;
  }
}

export function saveBarcodeConfig(config: BarcodeLabelConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_BARCODE_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save barcode config:', e);
  }
}
