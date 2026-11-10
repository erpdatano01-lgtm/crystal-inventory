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
  // Keep printable ASCII 32..126
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

  const quietZone = 8; // Quiet zone modules on each side
  let cursor = quietZone;
  const bars: BarcodeBar[] = [];

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code] || CODE128_PATTERNS[0];
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]);
      if (i % 2 === 0) {
        // Even index = black bar
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

export interface BarcodeLabelConfig {
  widthCm: number;
  heightCm: number;
  paperMode: 'roll' | 'a4';
  showStoreName: boolean;
  showStoneName: boolean;
  showWeightAndDim: boolean;
  showPrice: boolean;
  showSkuText: boolean;
  fontScale: 'sm' | 'md' | 'lg';
}

export const DEFAULT_BARCODE_CONFIG: BarcodeLabelConfig = {
  widthCm: 4.0,
  heightCm: 2.5,
  paperMode: 'roll',
  showStoreName: true,
  showStoneName: true,
  showWeightAndDim: true,
  showPrice: true,
  showSkuText: true,
  fontScale: 'md',
};

export const BARCODE_SIZE_PRESETS: {
  label: string;
  desc: string;
  widthCm: number;
  heightCm: number;
}[] = [
  { label: '2.5 × 1.5 cm', desc: 'มินิ (ติดตลับพลอย/Cabochon)', widthCm: 2.5, heightCm: 1.5 },
  { label: '3.0 × 2.0 cm', desc: 'เล็ก (ติดถุงซิป/หินชิ้นเล็ก)', widthCm: 3.0, heightCm: 2.0 },
  { label: '3.2 × 2.5 cm', desc: 'มาตรฐานร้านจิวเวลรี่', widthCm: 3.2, heightCm: 2.5 },
  { label: '4.0 × 2.5 cm', desc: 'มาตรฐานยอดนิยม (40×25 mm)', widthCm: 4.0, heightCm: 2.5 },
  { label: '4.0 × 3.0 cm', desc: 'ขนาดกลาง ข้อมูลครบ (40×30 mm)', widthCm: 4.0, heightCm: 3.0 },
  { label: '5.0 × 3.0 cm', desc: 'ขนาดใหญ่ ติดกล่อง/ฐานไม้ (50×30 mm)', widthCm: 5.0, heightCm: 3.0 },
];

const LS_BARCODE_CONFIG_KEY = 'vivida_barcode_config_v1';

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
