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
  { id: 'Chinese Writing Stone', code: 'CWS', label: 'Chinese Writing Stone', isDefault: true },
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
 * Suggests a concise 3-letter (or up to 4-letter) uppercase SKU code from an English/Thai name,
 * automatically avoiding any codes already present in `existingCodes`.
 */
export function suggestAbbreviation(
  name: string,
  existingCodes: string[] = []
): string {
  if (!name || !name.trim()) return '';

  const usedSet = new Set(
    existingCodes.map((c) => c.trim().toUpperCase()).filter(Boolean)
  );

  const candidates: string[] = [];
  const addCandidate = (code?: string) => {
    if (!code) return;
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length >= 2 && clean.length <= 6 && !candidates.includes(clean)) {
      candidates.push(clean);
    }
  };

  // Extract English words if mixed with Thai (e.g., "Larimar (ลาริมาร์)" -> "Larimar")
  const englishMatch = name.match(/[a-zA-Z0-9]+/g);
  if (englishMatch && englishMatch.length > 0) {
    const fullPhrase = englishMatch.map((w) => w.toUpperCase()).join(' ');

    // Special common crystal & shape abbreviations (curated to minimize collisions)
    const specialMap: Record<string, string[]> = {
      // Shapes
      SPHERE: ['SPH', 'SPR', 'SPHR'],
      TOWER: ['TOW', 'TWR', 'TOWR'],
      FACETED: ['FAC', 'FCT', 'FACE'],
      CABOCHON: ['CAB', 'CBC', 'CABO'],
      CARVED: ['CRV', 'CVD', 'CARV'],
      TUMBLE: ['TUM', 'TMB', 'TUMB'],
      PYRAMID: ['PYR', 'PRM', 'PYRM'],
      BRACELET: ['BRC', 'BRL', 'BRAC'],
      CLUSTER: ['CLU', 'CLS', 'CLST'],
      PENDANT: ['PDT', 'PND', 'PEND'],
      GEODE: ['GEO', 'GED', 'GEOD'],
      SLAB: ['SLB', 'SLA', 'SLAB'],
      HEART: ['HRT', 'HEA', 'HART'],
      POINT: ['PNT', 'POI', 'PONT'],
      PALM: ['PLM', 'PAL', 'PALM'],
      RAW: ['RAW', 'RWS', 'SPEC'],
      SPECIMEN: ['SPC', 'SPM', 'SPEC'],
      RING: ['RNG', 'RIN', 'RING'],
      NECKLACE: ['NCK', 'NEC', 'NECK'],
      EARRING: ['EAR', 'ERG', 'EARR'],
      WAND: ['WND', 'WAN', 'WAND'],
      FLAME: ['FLM', 'FLA', 'FLAM'],
      FREEFORM: ['FRF', 'FRM', 'FREE'],
      MOON: ['MON', 'MOO', 'MOON'],
      STAR: ['STR', 'STA', 'STAR'],
      EGG: ['EGG', 'EGS'],
      CUBE: ['CUB', 'CBE', 'CUBE'],
      BOWL: ['BWL', 'BOW', 'BOWL'],
      OBELISK: ['OBL', 'OBE', 'OBLK'],
      MERKABA: ['MRK', 'MKB', 'MERK'],
      DRUZY: ['DRZ', 'DRU', 'DRZY'],

      // Stones
      AMETHYST: ['AME', 'AMT', 'AMTH'],
      AMETRINE: ['AMT', 'AMR', 'AMTR'],
      AMAZONITE: ['AMZ', 'AMA', 'AMAZ'],
      AMBER: ['AMB', 'ABR', 'AMBR'],
      AQUAMARINE: ['AQU', 'AQM', 'AQUA'],
      APATITE: ['APA', 'APT', 'APAT'],
      APOPHYLLITE: ['APO', 'APP', 'APOP'],
      AVENTURINE: ['AVE', 'AVN', 'AVEN'],
      AZURITE: ['AZU', 'AZR', 'AZUR'],
      AGATE: ['AGA', 'AGT', 'AGAT'],
      ANGELITE: ['ANG', 'AGL', 'ANGL'],
      ARAGONITE: ['ARG', 'ARA', 'ARAG'],
      CALCITE: ['CAL', 'CLC', 'CALC'],
      CARNELIAN: ['CAR', 'CRN', 'CARN'],
      CELESTITE: ['CEL', 'CLS', 'CELS'],
      CHALCEDONY: ['CHD', 'CHL', 'CHAL'],
      CHAROITE: ['CHA', 'CHR', 'CHAR'],
      'CHINESE WRITING STONE': ['CWS', 'CHW', 'CWST'],
      'CHINESE ALPHABET STONE': ['CWS', 'CAS', 'CHW'],
      CHRYSOCOLLA: ['CHC', 'CRS', 'CHRY'],
      CHRYSOPRASE: ['CHP', 'CRP', 'CHPR'],
      CITRINE: ['CIT', 'CTR', 'CITR'],
      CINNABAR: ['CIN', 'CNB', 'CINN'],
      DANBURITE: ['DAN', 'DNB', 'DANB'],
      DIOPSIDE: ['DIO', 'DPS', 'DIOP'],
      DIOPTASE: ['DPT', 'DIP', 'DPTS'],
      EMERALD: ['EME', 'EMR', 'EMER'],
      EPIDOTE: ['EPI', 'EPD', 'EPID'],
      FLUORITE: ['FLU', 'FLR', 'FLUO'],
      GARNET: ['GAR', 'GRN', 'GARN'],
      HEMATITE: ['HEM', 'HMT', 'HEMA'],
      HERKIMER: ['HRK', 'HER', 'HERK'],
      HOWLITE: ['HOW', 'HWL', 'HOWL'],
      IOLITE: ['IOL', 'ILT', 'IOLI'],
      JADE: ['JAD', 'JDE', 'JADE'],
      JASPER: ['JAS', 'JSP', 'JASP'],
      KUNZITE: ['KUN', 'KNZ', 'KUNZ'],
      KYANITE: ['KYA', 'KYN', 'KYAN'],
      LABRADORITE: ['LAB', 'LBR', 'LABR'],
      'LAPIS LAZULI': ['LAP', 'LPZ', 'LAPS'],
      LARIMAR: ['LAR', 'LRM', 'LARI'],
      LEPIDOLITE: ['LEP', 'LPD', 'LEPI'],
      LODOLITE: ['LOD', 'LDL', 'LODO'],
      MALACHITE: ['MAL', 'MLC', 'MALA'],
      MOLDAVITE: ['MOL', 'MLD', 'MOLD'],
      MOONSTONE: ['MOO', 'MNS', 'MOON'],
      MORGANITE: ['MOR', 'MRG', 'MORG'],
      'MOSS AGATE': ['MSA', 'MOS', 'MSAG'],
      OBSIDIAN: ['OBS', 'OBD', 'OBSI'],
      ONYX: ['ONX', 'ONY', 'ONYX'],
      OPAL: ['OPL', 'OPA', 'OPAL'],
      PERIDOT: ['PER', 'PRD', 'PERI'],
      PIETERSITE: ['PIE', 'PTR', 'PIET'],
      PREHNITE: ['PRH', 'PRE', 'PREH'],
      PYRITE: ['PYR', 'PRT', 'PYRT'],
      'CLEAR QUARTZ': ['QUA', 'CLQ', 'CLRQ'],
      'ROSE QUARTZ': ['ROQ', 'RSQ', 'ROSQ'],
      'SMOKY QUARTZ': ['SMQ', 'SKQ', 'SMKQ'],
      'RUTILATED QUARTZ': ['RUT', 'RTQ', 'RUTQ'],
      'STRAWBERRY QUARTZ': ['STQ', 'SBQ', 'STRQ'],
      'FIRE QUARTZ': ['FIQ', 'FRQ', 'FIRQ'],
      RHODOCHROSITE: ['RDC', 'RHO', 'RHDC'],
      RHODONITE: ['RHD', 'RDN', 'RHDN'],
      RUBY: ['RUB', 'RBY', 'RUBY'],
      SAPPHIRE: ['SAP', 'SPH', 'SAPH'],
      SELENITE: ['SEL', 'SLN', 'SELE'],
      SERAPHINITE: ['SER', 'SRP', 'SERP'],
      SERPENTINE: ['SRP', 'SPT', 'SRPN'],
      SHUNGITE: ['SHG', 'SHU', 'SHNG'],
      SODALITE: ['SOD', 'SDL', 'SODA'],
      SPINEL: ['SPN', 'SPI', 'SPIN'],
      SUGILITE: ['SUG', 'SGL', 'SUGI'],
      SUNSTONE: ['SUN', 'SNS', 'SUNS'],
      'SUPER SEVEN': ['SP7', 'SS7', 'SUP7'],
      TANZANITE: ['TAN', 'TNZ', 'TANZ'],
      'TIGER EYE': ['TIG', 'TGE', 'TIGE'],
      TOPAZ: ['TOP', 'TPZ', 'TOPA'],
      'BLACK TOURMALINE': ['TOU', 'BTM', 'BTOR'],
      TOURMALINE: ['TOU', 'TRM', 'TOUR'],
      TURQUOISE: ['TRQ', 'TUR', 'TURQ'],
      UNAKITE: ['UNA', 'UNK', 'UNAK'],
      ZIRCON: ['ZIR', 'ZRC', 'ZIRC'],
      ZOISITE: ['ZOI', 'ZST', 'ZOIS'],
    };

    if (specialMap[fullPhrase]) {
      specialMap[fullPhrase].forEach(addCandidate);
    }

    if (englishMatch.length === 1) {
      const word = englishMatch[0].toUpperCase();
      if (specialMap[word]) {
        specialMap[word].forEach(addCandidate);
      }
      if (word.length <= 3) {
        addCandidate(word);
      } else {
        // 1. First 3 letters (e.g. AME)
        addCandidate(word.substring(0, 3));
        // 2. First 2 letters + each subsequent letter (e.g. AMT, AMR, AMN)
        for (let i = 3; i < word.length; i++) {
          addCandidate(word.substring(0, 2) + word[i]);
        }
        // 3. 1st + 3rd + subsequent letter (e.g. AET, AER)
        for (let i = 3; i < word.length; i++) {
          addCandidate(word[0] + word[2] + word[i]);
        }
        // 4. 4-letter prefix (e.g. AMET)
        addCandidate(word.substring(0, 4));
      }
    } else if (englishMatch.length === 2) {
      const w1 = englishMatch[0].toUpperCase();
      const w2 = englishMatch[1].toUpperCase();

      // e.g. Rose Quartz -> ROQ, RQU, RSQ, ROQU
      addCandidate(w1.substring(0, 2) + w2.substring(0, 1));
      addCandidate(w1.substring(0, 1) + w2.substring(0, 2));
      for (let i = 1; i < w2.length; i++) {
        addCandidate(w1.substring(0, 2) + w2[i]);
      }
      for (let i = 2; i < w1.length; i++) {
        addCandidate(w1[0] + w1[i] + w2[0]);
      }
      addCandidate(w1.substring(0, 2) + w2.substring(0, 2));
      addCandidate(w1.substring(0, 3));
    } else {
      // 3 or more words: Take first letter of each of first 3 words, then variations
      addCandidate(
        englishMatch
          .slice(0, 3)
          .map((w) => w[0].toUpperCase())
          .join('')
      );
      addCandidate(
        englishMatch[0].substring(0, 2).toUpperCase() +
          englishMatch[1][0].toUpperCase() +
          englishMatch[2][0].toUpperCase()
      );
      addCandidate(
        englishMatch
          .slice(0, 4)
          .map((w) => w[0].toUpperCase())
          .join('')
      );
    }
  } else {
    // Strictly Thai without English (e.g. "ไหมทอง")
    addCandidate('MIN');
    addCandidate('THA');
    addCandidate('GEM');
    addCandidate('CRY');
  }

  // Pick the first candidate not already used
  for (const cand of candidates) {
    if (!usedSet.has(cand)) {
      return cand;
    }
  }

  // Fallback: append number 2..99 to primary base so it never collides
  const base = (candidates[0] || 'CRY').substring(0, 3);
  for (let n = 2; n <= 99; n++) {
    const numbered = `${base}${n}`;
    if (!usedSet.has(numbered)) {
      return numbered;
    }
  }

  return base;
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
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Auto-migrate any Chinese Alphabet Stone to Chinese Writing Stone
      let migrated = false;
      const updated = parsed.map((item: StoneTypeItem) => {
        if (
          item.id.toLowerCase() === 'chinese alphabet stone' ||
          item.label.toLowerCase().includes('chinese alphabet stone')
        ) {
          migrated = true;
          return {
            ...item,
            id: 'Chinese Writing Stone',
            code: item.code === 'CAS' ? 'CWS' : item.code || 'CWS',
            label: item.label.replace(/Chinese Alphabet Stone/gi, 'Chinese Writing Stone'),
          };
        }
        return item;
      });
      if (migrated) {
        localStorage.setItem(LS_STONES_KEY, JSON.stringify(sortAlphabetically(updated)));
      }
      return sortAlphabetically(updated);
    }
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
