'use client';

export interface StoneShapeItem {
  id: string; // key/id e.g. 'Sphere', 'Tower', 'Heart'
  code: string; // SKU prefix e.g. 'SPH', 'TOW', 'HRT'
  label: string; // Display name e.g. 'Sphere (ทรงกลม)'
  desc?: string; // Description e.g. 'หินเจียทรงกลม ลูกแก้ว'
  isDefault?: boolean;
}

export interface StoneTypeItem {
  id: string; // key/id e.g. 'Amethyst', 'Citrine', 'Larimar'
  code: string; // SKU code e.g. 'AME', 'CIT', 'LAR'
  label: string; // Display name e.g. 'Amethyst (อเมทิสต์)'
  isDefault?: boolean;
}

export const DEFAULT_STONE_SHAPES: StoneShapeItem[] = [
  { id: 'Cabochon', code: 'CAB', label: 'Cabochon (หลังเบี้ย / All Shape)', desc: 'หินเจียหลังเบี้ยทุกทรง และเศษเจีย', isDefault: true },
  { id: 'Carved', code: 'CRV', label: 'Carved (หินแกะสลัก)', desc: 'งานแกะสลักรูปทรงต่างๆ', isDefault: true },
  { id: 'Faceted', code: 'FAC', label: 'Faceted (เจียเหลี่ยมเพชรพลอย)', desc: 'หินเจียแบบหน้าตัด เครื่องประดับ เพชรพลอย', isDefault: true },
  { id: 'Palm', code: 'PLM', label: 'Palm / Polished (เจียทรงมน/รี/หัวใจ)', desc: 'หินเจียทรงกลมแบน รี หัวใจ มนๆ ทุกแบบ', isDefault: true },
  { id: 'Raw', code: 'RAW', label: 'Raw / Specimen (หินดิบ)', desc: 'หินดิบ ผลึกธรรมชาติ ก้อนแร่สะสม', isDefault: true },
  { id: 'Sphere', code: 'SPH', label: 'Sphere (ทรงกลม)', desc: 'หินเจียทรงกลม ลูกแก้ว', isDefault: true },
  { id: 'Tower', code: 'TOW', label: 'Tower (แท่ง/เสา)', desc: 'หินทรงแท่งปลายแหลม ตั้งโต๊ะ', isDefault: true },
  { id: 'Tumble', code: 'TUM', label: 'Tumble (หินก้อนขัดเงา)', desc: 'หินก้อนกลิ้งขัดมัน พกพา', isDefault: true },
];

export const DEFAULT_STONE_TYPES: StoneTypeItem[] = [
  { id: 'Amethyst', code: 'AME', label: 'Amethyst (อเมทิสต์)', isDefault: true },
  { id: 'Aquamarine', code: 'AQU', label: 'Aquamarine (อความารีน)', isDefault: true },
  { id: 'Black Tourmaline', code: 'TOU', label: 'Black Tourmaline (ทัวร์มาลีนดำ)', isDefault: true },
  { id: 'Citrine', code: 'CIT', label: 'Citrine (ซิทริน)', isDefault: true },
  { id: 'Clear Quartz', code: 'QUA', label: 'Clear Quartz (เขี้ยวหนุมาน/ควอตซ์ใส)', isDefault: true },
  { id: 'Fluorite', code: 'FLU', label: 'Fluorite (ฟลูออไรต์)', isDefault: true },
  { id: 'Labradorite', code: 'LAB', label: 'Labradorite (ลาบราดอไรต์)', isDefault: true },
  { id: 'Lapis Lazuli', code: 'LAP', label: 'Lapis Lazuli (ลาพิส ลาซูลี)', isDefault: true },
  { id: 'Malachite', code: 'MAL', label: 'Malachite (มาลาไคต์)', isDefault: true },
  { id: 'Moldavite', code: 'MOL', label: 'Moldavite (โมลดาไวต์/สะเก็ดดาวเขียว)', isDefault: true },
  { id: 'Moonstone', code: 'MOO', label: 'Moonstone (มูนสโตน)', isDefault: true },
  { id: 'Pyrite', code: 'PYR', label: 'Pyrite (ไพไรต์/แร่ดูดทรัพย์)', isDefault: true },
  { id: 'Rose Quartz', code: 'ROQ', label: 'Rose Quartz (โรสควอตซ์)', isDefault: true },
  { id: 'Rutilated Quartz', code: 'RUT', label: 'Rutilated Quartz (ไหมทอง/ไหม 5 สี)', isDefault: true },
  { id: 'Selenite', code: 'SEL', label: 'Selenite (เซเลไนต์)', isDefault: true },
  { id: 'Smoky Quartz', code: 'SMQ', label: 'Smoky Quartz (สโมกกี้ควอตซ์)', isDefault: true },
  { id: 'Other', code: 'CRY', label: 'แร่/หินชนิดอื่นๆ (Other Mineral)', isDefault: true },
];

const LS_SHAPES_KEY = 'vivida_custom_shapes_v1';
const LS_STONES_KEY = 'vivida_custom_stones_v1';
const LS_HIDE_COST_KEY = 'vivida_hide_cost_v1';

/**
 * Get hide-cost preference (defaults to true for customer-facing privacy)
 */
export function getHideCostPreference(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(LS_HIDE_COST_KEY);
  if (val === null) return true; // Default: hide cost is ON
  return val === 'true';
}

/**
 * Save hide-cost preference
 */
export function setHideCostPreference(hide: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_HIDE_COST_KEY, String(hide));
}

/**
 * Intelligent abbreviation generator:
 * Suggests a concise 3-letter uppercase SKU code from an English/Thai name,
 * while allowing user to override/customize.
 */
export function suggestAbbreviation(name: string): string {
  if (!name || !name.trim()) return '';

  // Extract English words if mixed with Thai (e.g., "Larimar (ลาริมาร์)" -> "Larimar")
  const englishMatch = name.match(/[a-zA-Z0-9]+/g);
  if (englishMatch && englishMatch.length > 0) {
    if (englishMatch.length === 1) {
      const word = englishMatch[0].toUpperCase();
      if (word.length <= 3) return word;

      // Special common abbreviations
      const specialMap: Record<string, string> = {
        SPHERE: 'SPH',
        TOWER: 'TOW',
        FACETED: 'FAC',
        CABOCHON: 'CAB',
        CARVED: 'CRV',
        TUMBLE: 'TUM',
        PYRAMID: 'PYR',
        BRACELET: 'BRC',
        CLUSTER: 'CLU',
        PENDANT: 'PDT',
        GEODE: 'GEO',
        SLAB: 'SLB',
        HEART: 'HRT',
        POINT: 'PNT',
      };
      if (specialMap[word]) return specialMap[word];

      // Default: First 3 letters
      return word.substring(0, 3);
    } else if (englishMatch.length === 2) {
      const w1 = englishMatch[0].toUpperCase();
      const w2 = englishMatch[1].toUpperCase();

      // e.g. Rose Quartz -> ROQ, Clear Quartz -> CLQ, Super Seven -> SS7
      if (w2.length >= 1) {
        return (w1.substring(0, 2) + w2.substring(0, 1)).toUpperCase();
      }
      return w1.substring(0, 3).toUpperCase();
    } else {
      // 3 or more words: Take first letter of each of first 3 words
      return englishMatch
        .slice(0, 3)
        .map((w) => w[0].toUpperCase())
        .join('');
    }
  }

  // If strictly Thai without English (e.g. "ไหมทอง")
  const thaiText = name.trim();
  if (thaiText.length > 0) {
    // Generate standard prefix
    return 'MIN';
  }

  return 'CRY';
}

/**
 * Sort items alphabetically A-Z by English name / id
 * Keeps 'Other' at the end of the list
 */
export function sortAlphabetically<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.id.toLowerCase() === 'other') return 1;
    if (b.id.toLowerCase() === 'other') return -1;
    return a.id.localeCompare(b.id, 'en', { sensitivity: 'base' });
  });
}

/**
 * Get all active shapes (persisted in localStorage, fallback to defaults)
 * Always sorted alphabetically A-Z
 */
export function getStoneShapes(): StoneShapeItem[] {
  if (typeof window === 'undefined') return sortAlphabetically(DEFAULT_STONE_SHAPES);
  try {
    const raw = localStorage.getItem(LS_SHAPES_KEY);
    if (!raw) {
      const sorted = sortAlphabetically(DEFAULT_STONE_SHAPES);
      localStorage.setItem(LS_SHAPES_KEY, JSON.stringify(sorted));
      return sorted;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return sortAlphabetically(parsed);
  } catch (e) {
    console.warn('Error reading shapes from localStorage:', e);
  }
  return sortAlphabetically(DEFAULT_STONE_SHAPES);
}

/**
 * Save shapes to localStorage (automatically sorted A-Z)
 */
export function saveStoneShapes(shapes: StoneShapeItem[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_SHAPES_KEY, JSON.stringify(sortAlphabetically(shapes)));
}

/**
 * Reset shapes to factory defaults
 */
export function resetStoneShapes(): StoneShapeItem[] {
  const sorted = sortAlphabetically(DEFAULT_STONE_SHAPES);
  if (typeof window !== 'undefined') {
    localStorage.setItem(LS_SHAPES_KEY, JSON.stringify(sorted));
  }
  return sorted;
}

/**
 * Get all active stone types (persisted in localStorage, fallback to defaults)
 * Always sorted alphabetically A-Z (Amethyst, Aquamarine, Black Tourmaline...)
 */
export function getStoneTypes(): StoneTypeItem[] {
  if (typeof window === 'undefined') return sortAlphabetically(DEFAULT_STONE_TYPES);
  try {
    const raw = localStorage.getItem(LS_STONES_KEY);
    if (!raw) {
      const sorted = sortAlphabetically(DEFAULT_STONE_TYPES);
      localStorage.setItem(LS_STONES_KEY, JSON.stringify(sorted));
      return sorted;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return sortAlphabetically(parsed);
  } catch (e) {
    console.warn('Error reading stone types from localStorage:', e);
  }
  return sortAlphabetically(DEFAULT_STONE_TYPES);
}

/**
 * Save stone types to localStorage (automatically sorted A-Z)
 */
export function saveStoneTypes(types: StoneTypeItem[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_STONES_KEY, JSON.stringify(sortAlphabetically(types)));
}

/**
 * Reset stone types to factory defaults
 */
export function resetStoneTypes(): StoneTypeItem[] {
  const sorted = sortAlphabetically(DEFAULT_STONE_TYPES);
  if (typeof window !== 'undefined') {
    localStorage.setItem(LS_STONES_KEY, JSON.stringify(sorted));
  }
  return sorted;
}
