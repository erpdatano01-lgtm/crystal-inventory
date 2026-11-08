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
  { id: 'Amazonite', code: 'AMA', label: 'Amazonite (แอมะซอไนต์)', isDefault: true },
  { id: 'Amethyst', code: 'AME', label: 'Amethyst (อเมทิสต์)', isDefault: true },
  { id: 'Aquamarine', code: 'AQU', label: 'Aquamarine (อความารีน)', isDefault: true },
  { id: 'Azurite', code: 'AZU', label: 'Azurite (อะซูไรต์)', isDefault: true },
  { id: 'Black Tourmaline', code: 'TOU', label: 'Black Tourmaline (ทัวร์มาลีนดำ)', isDefault: true },
  { id: 'Blue Lace Agate', code: 'BLA', label: 'Blue Lace Agate (บลูเลซอาเกต)', isDefault: true },
  { id: 'Chinese Writing Stone', code: 'CWS', label: 'Chinese Writing Stone (หินอักษรจีน / หินตัวหนังสือจีน)', isDefault: true },
  { id: 'Citrine', code: 'CIT', label: 'Citrine (ซิทริน)', isDefault: true },
  { id: 'Clear Quartz', code: 'QUA', label: 'Clear Quartz (เขี้ยวหนุมาน/ควอตซ์ใส)', isDefault: true },
  { id: 'Crazy Lace Agate', code: 'CLA', label: 'Crazy Lace Agate (เครซี่เลซอาเกต)', isDefault: true },
  { id: 'Fluorite', code: 'FLU', label: 'Fluorite (ฟลูออไรต์)', isDefault: true },
  { id: 'Green Tourmaline', code: 'GRT', label: 'Green Tourmaline (ทัวร์มาลีนเขียว)', isDefault: true },
  { id: 'Green Zebra Jasper', code: 'GZJ', label: 'Green Zebra Jasper (แจสเปอร์ลายม้าลายเขียว)', isDefault: true },
  { id: 'Jasper', code: 'JAS', label: 'Jasper (แจสเปอร์)', isDefault: true },
  { id: 'Labradorite', code: 'LAB', label: 'Labradorite (ลาบราดอไรต์)', isDefault: true },
  { id: 'Lapis Lazuli', code: 'LAP', label: 'Lapis Lazuli (ลาพิส ลาซูลี)', isDefault: true },
  { id: 'Malachite', code: 'MAL', label: 'Malachite (มาลาไคต์)', isDefault: true },
  { id: 'Moldavite', code: 'MOL', label: 'Moldavite (โมลดาไวต์/สะเก็ดดาวเขียว)', isDefault: true },
  { id: 'Moonstone', code: 'MOO', label: 'Moonstone (มูนสโตน)', isDefault: true },
  { id: 'Ocean Jasper', code: 'OCJ', label: 'Ocean Jasper (โอเชียนแจสเปอร์)', isDefault: true },
  { id: 'Picture Jasper', code: 'PIJ', label: 'Picture Jasper (พิคเจอร์แจสเปอร์)', isDefault: true },
  { id: 'Pyrite', code: 'PYR', label: 'Pyrite (ไพไรต์/แร่ดูดทรัพย์)', isDefault: true },
  { id: 'Red Jasper', code: 'REJ', label: 'Red Jasper (เรดแจสเปอร์)', isDefault: true },
  { id: 'Rose Quartz', code: 'ROQ', label: 'Rose Quartz (โรสควอตซ์)', isDefault: true },
  { id: 'Rutilated Quartz', code: 'RUT', label: 'Rutilated Quartz (ไหมทอง/ไหม 5 สี)', isDefault: true },
  { id: 'Selenite', code: 'SEL', label: 'Selenite (เซเลไนต์)', isDefault: true },
  { id: 'Smoky Quartz', code: 'SMQ', label: 'Smoky Quartz (สโมกกี้ควอตซ์)', isDefault: true },
  { id: 'Snowflake Obsidian', code: 'SNO', label: 'Snowflake Obsidian (สโนว์เฟล็กออบซิเดียน)', isDefault: true },
  { id: 'Other', code: 'CRY', label: 'แร่/หินชนิดอื่นๆ (Other Mineral)', isDefault: true },
];

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
