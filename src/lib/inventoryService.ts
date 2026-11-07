import { supabase, isSupabaseConfigured } from './supabase';
import {
  Expense,
  StockLot,
  Product,
  StockMovement,
  ProductStatus,
  STONE_TYPES,
  STONE_SHAPES,
} from '@/types';
import {
  StoneShapeItem,
  StoneTypeItem,
  getStoneShapes,
  getStoneTypes,
  suggestAbbreviation,
} from './settingsService';

const LS_EXPENSES = 'crystal_expenses_v2';
const LS_LOTS = 'crystal_stock_lots_v2';
const LS_PRODUCTS = 'crystal_products_v2';
const LS_MOVEMENTS = 'crystal_movements_v2';

// Local storage fallback helper
function getLocal<T>(key: string, seed: T): T {
  if (typeof window === 'undefined') return seed;
  const val = localStorage.getItem(key);
  if (!val) {
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(val);
  } catch {
    return seed;
  }
}

function setLocal<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

// ------------------- EXPENSES & LOTS -------------------

export async function fetchExpenses(): Promise<Expense[]> {
  // If in browser, fetch through server API route (bypasses RLS using supabaseAdmin)
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/expenses');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (e) {
      console.warn('API /api/expenses error, falling back:', e);
    }
  }

  // Fallback to direct client supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      if (!error && data) return data as Expense[];
    } catch (e) {
      console.warn('Supabase fetch expenses error:', e);
    }
  }
  return getLocal<Expense[]>(LS_EXPENSES, []);
}

export async function fetchStockLots(): Promise<StockLot[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/lots');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (e) {
      console.warn('API /api/lots error, falling back:', e);
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('stock_lots')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data as StockLot[];
    } catch (e) {
      console.warn('Supabase fetch stock_lots error:', e);
    }
  }
  return getLocal<StockLot[]>(LS_LOTS, []);
}

export interface CreateExpenseParams {
  expense: Omit<Expense, 'id' | 'created_at'>;
  createLot?: {
    lot_code: string;
    total_weight_grams?: number;
    drive_lot_folder_url?: string;
    notes?: string;
  };
}

export async function createExpenseWithOptionalLot(
  params: CreateExpenseParams
): Promise<{ expense: Expense; lot?: StockLot }> {
  try {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const result = await res.json();
      return result;
    }
  } catch (apiErr) {
    console.warn('API route /api/expenses call error, fallback:', apiErr);
  }

  // Fallback to local
  const expenseId = `exp_${Date.now()}`;
  const newExpense: Expense = {
    ...params.expense,
    id: expenseId,
    created_at: new Date().toISOString(),
  };

  let newLot: StockLot | undefined;
  if (params.createLot) {
    newLot = {
      id: `lot_${Date.now()}`,
      lot_code: params.createLot.lot_code,
      expense_id: expenseId,
      total_cost: params.expense.total_amount,
      total_weight_grams: params.createLot.total_weight_grams || null,
      item_count: 0,
      drive_lot_folder_url: params.createLot.drive_lot_folder_url || null,
      notes: params.createLot.notes || null,
      created_at: new Date().toISOString(),
    };
  }

  const currentExpenses = getLocal<Expense[]>(LS_EXPENSES, []);
  setLocal(LS_EXPENSES, [newExpense, ...currentExpenses]);

  if (newLot) {
    const currentLots = getLocal<StockLot[]>(LS_LOTS, []);
    setLocal(LS_LOTS, [newLot, ...currentLots]);
  }

  return { expense: newExpense, lot: newLot };
}

// ------------------- PRODUCTS -------------------

export async function fetchProducts(): Promise<Product[]> {
  // If in browser, fetch through server API route (bypasses RLS with supabaseAdmin)
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (e) {
      console.warn('API /api/products error, falling back:', e);
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data as Product[];
    } catch (e) {
      console.warn('Supabase fetch products error:', e);
    }
  }
  return getLocal<Product[]>(LS_PRODUCTS, []);
}

export async function createProduct(
  productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>
): Promise<Product> {
  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData),
    });

    if (res.ok) {
      const data = await res.json();
      return data as Product;
    }
  } catch (apiErr) {
    console.warn('API /api/products POST error, fallback:', apiErr);
  }

  // Fallback to local
  const prodId = `prod_${Date.now()}`;
  const now = new Date().toISOString();
  const newProduct: Product = {
    ...productData,
    id: prodId,
    created_at: now,
    updated_at: now,
  };

  const initialMovement: StockMovement = {
    id: `mov_${Date.now()}`,
    product_id: prodId,
    change_qty: newProduct.qty_on_hand,
    reason: 'INITIAL_STOCK',
    note: 'บันทึกรับเข้าสต็อกครั้งแรก',
    created_at: now,
  };

  const currentProds = getLocal<Product[]>(LS_PRODUCTS, []);
  setLocal(LS_PRODUCTS, [newProduct, ...currentProds]);

  const currentMovs = getLocal<StockMovement[]>(LS_MOVEMENTS, []);
  setLocal(LS_MOVEMENTS, [initialMovement, ...currentMovs]);

  return newProduct;
}

export async function updateProductStatus(
  id: string,
  newStatus: ProductStatus,
  note?: string
): Promise<Product | null> {
  try {
    const res = await fetch('/api/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus, note }),
    });

    if (res.ok) {
      const data = await res.json();
      return data as Product;
    }
  } catch (apiErr) {
    console.warn('API /api/products PATCH error, fallback:', apiErr);
  }

  // Fallback to local
  const prods = getLocal<Product[]>(LS_PRODUCTS, []);
  const idx = prods.findIndex((p) => p.id === id);
  if (idx !== -1) {
    const p = prods[idx];
    const isSold = newStatus === 'SOLD';
    const newQty = isSold ? Math.max(0, p.qty_on_hand - 1) : p.qty_on_hand;
    p.status = newStatus;
    p.qty_on_hand = newQty;
    p.updated_at = new Date().toISOString();
    prods[idx] = p;
    setLocal(LS_PRODUCTS, prods);

    if (isSold) {
      const movs = getLocal<StockMovement[]>(LS_MOVEMENTS, []);
      movs.unshift({
        id: `mov_${Date.now()}`,
        product_id: id,
        change_qty: -1,
        reason: 'SOLD',
        note: note || 'ขายหน้าร้าน (เปลี่ยนสถานะเป็น SOLD)',
        created_at: new Date().toISOString(),
      });
      setLocal(LS_MOVEMENTS, movs);
    }
    return p;
  }

  return null;
}

// Smart SKU Generator: [SHAPE_CODE]-[STONE_CODE]-[001] (e.g., SPH-AME-001)
export function generateSmartSku(
  stoneType: string,
  existingSkus: string[],
  shapeId: string = 'Raw',
  customShapes?: StoneShapeItem[],
  customStones?: StoneTypeItem[]
): string {
  const shapesList = customShapes && customShapes.length > 0 ? customShapes : getStoneShapes();
  const stonesList = customStones && customStones.length > 0 ? customStones : getStoneTypes();

  const matchedStone = stonesList.find((s) => s.id === stoneType || s.label.includes(stoneType));
  const stoneCode = matchedStone ? matchedStone.code : suggestAbbreviation(stoneType) || 'CRY';

  const matchedShape = shapesList.find((sh) => sh.id === shapeId || sh.label.includes(shapeId));
  const shapeCode = matchedShape ? matchedShape.code : suggestAbbreviation(shapeId) || 'RAW';

  const prefix = `${shapeCode.toUpperCase()}-${stoneCode.toUpperCase()}-`;

  const numbers = existingSkus
    .filter((s) => s.startsWith(prefix))
    .map((s) => {
      const parts = s.split('-');
      const numStr = parts[parts.length - 1];
      return parseInt(numStr, 10);
    })
    .filter((n) => !isNaN(n));

  const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

// Delete product
export async function deleteProduct(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      // Also clean up local storage fallback
      const prods = getLocal<Product[]>(LS_PRODUCTS, []).filter((p) => p.id !== id);
      setLocal(LS_PRODUCTS, prods);
      return true;
    }
  } catch (err) {
    console.error('Delete product error:', err);
  }
  return false;
}

// Delete expense
export async function deleteExpense(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      const exps = getLocal<Expense[]>(LS_EXPENSES, []).filter((e) => e.id !== id);
      setLocal(LS_EXPENSES, exps);
      return true;
    }
  } catch (err) {
    console.error('Delete expense error:', err);
  }
  return false;
}

// Reset / Clear all test data
export async function resetTestData(target: 'all' | 'products' | 'expenses' = 'all'): Promise<boolean> {
  try {
    const res = await fetch('/api/reset-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
    });
    if (res.ok) {
      if (target === 'all' || target === 'products') {
        setLocal(LS_PRODUCTS, []);
        setLocal(LS_MOVEMENTS, []);
      }
      if (target === 'all' || target === 'expenses') {
        setLocal(LS_EXPENSES, []);
        setLocal(LS_LOTS, []);
      }
      return true;
    }
  } catch (err) {
    console.error('Reset data error:', err);
  }
  return false;
}
