'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import ImageUploader from '@/components/ImageUploader';
import {
  fetchExpenses,
  fetchStockLots,
  createExpenseWithOptionalLot,
  deleteExpense,
  resetTestData,
} from '@/lib/inventoryService';
import {
  Expense,
  StockLot,
  ExpenseCategory,
  EXPENSE_CATEGORIES_CONFIG,
} from '@/types';
import {
  Receipt,
  PlusCircle,
  Calendar,
  Layers,
  FolderOpen,
  ExternalLink,
  Eye,
  X,
  Sparkles,
  CheckCircle2,
  DollarSign,
  Scale,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';
import GoogleSheetsModal from '@/components/GoogleSheetsModal';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [lots, setLots] = useState<StockLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

  // Form states
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [category, setCategory] = useState<ExpenseCategory>('STOCK_LOT');
  const [title, setTitle] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('โอนเงิน (Mobile Banking)');
  const [driveDocUrl, setDriveDocUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptImages, setReceiptImages] = useState<string[]>([]);

  // Special STOCK_LOT auto lot creation
  const [autoCreateLot, setAutoCreateLot] = useState(true);
  const [lotCode, setLotCode] = useState('');
  const [totalWeightGrams, setTotalWeightGrams] = useState('');
  const [driveLotFolderUrl, setDriveLotFolderUrl] = useState('');
  const [lotNotes, setLotNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-generate lot code helper
  const generateLotCode = () => {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `LOT-${yyyymm}-`;

    const existingNums = lots
      .filter((l) => l.lot_code.startsWith(prefix))
      .map((l) => parseInt(l.lot_code.replace(prefix, ''), 10))
      .filter((n) => !isNaN(n));

    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    return `${prefix}${String(nextNum).padStart(2, '0')}`;
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [e, l] = await Promise.all([fetchExpenses(), fetchStockLots()]);
        setExpenses(e);
        setLots(l);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleDeleteExpense = async (id: string, title: string) => {
    if (!confirm(`ยืนยันการลบรายการค่าใช้จ่าย "${title}"?`)) {
      return;
    }
    const ok = await deleteExpense(id);
    if (ok) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      alert('ลบรายการค่าใช้จ่ายเรียบร้อยแล้ว');
    } else {
      alert('เกิดข้อผิดพลาดในการลบรายการ');
    }
  };

  const handleResetTestExpenses = async () => {
    if (!confirm('⚠️ คำเตือน: คุณต้องการ "ล้างประวัติค่าใช้จ่ายและล็อตทดสอบทั้งหมด" ใช่หรือไม่?')) {
      return;
    }
    const ok = await resetTestData('expenses');
    if (ok) {
      setExpenses([]);
      setLots([]);
      alert('ล้างข้อมูลค่าใช้จ่ายและล็อตทดสอบเรียบร้อยแล้ว');
    } else {
      alert('เกิดข้อผิดพลาดในการล้างข้อมูล');
    }
  };

  // Update suggested lot code when opening form or category changes
  useEffect(() => {
    if (category === 'STOCK_LOT') {
      setLotCode(generateLotCode());
    }
  }, [category, lots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !totalAmount) {
      alert('กรุณาระบุชื่อรายการและยอดเงิน');
      return;
    }

    const numAmount = parseFloat(totalAmount) || 0;
    setIsSubmitting(true);

    try {
      const payload: Parameters<typeof createExpenseWithOptionalLot>[0] = {
        expense: {
          expense_date: expenseDate,
          category,
          title: title.trim(),
          vendor_name: vendorName.trim() || null,
          total_amount: numAmount,
          payment_method: paymentMethod || null,
          r2_receipt_url: receiptImages.length > 0 ? receiptImages[0] : null,
          drive_doc_url: driveDocUrl.trim() || null,
          notes: notes.trim() || null,
        },
      };

      if (category === 'STOCK_LOT' && autoCreateLot && lotCode.trim()) {
        payload.createLot = {
          lot_code: lotCode.trim(),
          total_weight_grams: totalWeightGrams ? parseFloat(totalWeightGrams) : undefined,
          drive_lot_folder_url: driveLotFolderUrl.trim() || undefined,
          notes: lotNotes.trim() || undefined,
        };
      }

      const result = await createExpenseWithOptionalLot(payload);

      setExpenses((prev) => [result.expense, ...prev]);
      if (result.lot) {
        setLots((prev) => [result.lot!, ...prev]);
      }

      // Reset
      setTitle('');
      setVendorName('');
      setTotalAmount('');
      setDriveDocUrl('');
      setNotes('');
      setReceiptImages([]);
      setTotalWeightGrams('');
      setDriveLotFolderUrl('');
      setLotNotes('');
      setShowAddForm(false);
      alert('บันทึกค่าใช้จ่าย' + (result.lot ? ` และเปิดล็อต ${result.lot.lot_code} เรียบร้อย!` : ' สำเร็จ!'));
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalExpenseSum = expenses.reduce(
    (sum, e) => sum + Number(e.total_amount || 0),
    0
  );

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-12 bg-slate-50">
      <Navbar />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        {/* Header & Quick Action */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-6 h-6 text-purple-600" />
              บันทึกค่าใช้จ่าย & เปิดล็อตหิน (Expenses & Stock Lots)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              บันทึกบิลค่าใช้จ่ายร้านค้า แนบสลิป WebP ขึ้น Cloudflare R2 และเปิดรหัส Lot สำหรับหินนำเข้า
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-right">
              <span className="text-[11px] text-slate-400 block">ยอดรวมค่าใช้จ่ายทั้งหมด</span>
              <span className="text-xl sm:text-2xl font-extrabold text-rose-600">
                ฿{totalExpenseSum.toLocaleString()}
              </span>
            </div>

            {/* Google Sheets Live Feed Button */}
            <button
              onClick={() => setShowSheetsModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-semibold text-xs sm:text-sm transition active:scale-95 shadow-xs"
              title="ดึงข้อมูลค่าใช้จ่ายและล็อตหินไปแสดงผลบน Google Sheets อัตโนมัติ"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Google Sheets</span>
            </button>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-xs sm:text-sm shadow-md shadow-purple-600/20 hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{showAddForm ? 'ปิดแบบฟอร์ม' : '+ บันทึกค่าใช้จ่ายใหม่'}</span>
            </button>
          </div>
        </div>

        {/* Add Expense & Auto Lot Form */}
        {showAddForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white p-6 sm:p-7 rounded-3xl border-2 border-purple-200 shadow-xl space-y-5 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    แบบฟอร์มบันทึกค่าใช้จ่าย
                  </h3>
                  <p className="text-xs text-slate-500">
                    บันทึกข้อมูลลงตาราง expenses พร้อมฟีเจอร์สร้างล็อตสต็อกอัตโนมัติ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Row 1: Date, Category, Total Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  วันที่เกิดค่าใช้จ่าย (expense_date) *
                </label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หมวดหมู่ค่าใช้จ่าย (category) *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-purple-900"
                >
                  {Object.entries(EXPENSE_CATEGORIES_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ยอดเงินรวม (total_amount) บาท *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none font-bold text-rose-600"
                />
              </div>
            </div>

            {/* Row 2: Title & Vendor */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อรายการ / วัตถุประสงค์ (title) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ซื้อก้อนผลึกอเมทิสต์และซิทรินนำเข้าบราซิล ล็อตประจำเดือน"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ผู้รับเงิน / ร้านค้า (vendor_name)
                </label>
                <input
                  type="text"
                  placeholder="เช่น Minas Gerais Gems, Shopee, ไปรษณีย์ไทย"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>

            {/* Row 3: Payment method, Google Drive Doc URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  วิธีการชำระเงิน (payment_method)
                </label>
                <input
                  type="text"
                  placeholder="เช่น โอนเงินผ่านธนาคาร, บัตรเครดิต, พร้อมเพย์"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                  ลิงก์เอกสารใบเสร็จใน Google Drive (drive_doc_url)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={driveDocUrl}
                  onChange={(e) => setDriveDocUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none font-mono text-xs"
                />
              </div>
            </div>

            {/* SPECIAL FEATURE: STOCK_LOT AUTO CREATION */}
            {category === 'STOCK_LOT' && (
              <div className="p-5 bg-gradient-to-br from-purple-50/90 to-indigo-50/80 border-2 border-purple-200 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoCreateLot}
                      onChange={(e) => setAutoCreateLot(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="font-bold text-sm text-purple-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      สร้างรหัส Lot สินค้าอัตโนมัติ (บันทึกลงตาราง stock_lots พร้อมกันทันที)
                    </span>
                  </label>
                  <span className="text-xs text-purple-700 font-semibold px-2.5 py-0.5 rounded-full bg-purple-100">
                    Stock Lot Feature
                  </span>
                </div>

                {autoCreateLot && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        รหัส Lot สินค้า (lot_code) *
                      </label>
                      <input
                        type="text"
                        required
                        value={lotCode}
                        onChange={(e) => setLotCode(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-mono font-bold text-purple-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5 text-slate-500" />
                        น้ำหนักรวมทั้งล็อต (กรัม)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="เช่น 4850"
                        value={totalWeightGrams}
                        onChange={(e) => setTotalWeightGrams(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                        ลิงก์โฟลเดอร์ Google Drive ของล็อตนี้
                      </label>
                      <input
                        type="url"
                        placeholder="https://drive.google.com/drive/folders/..."
                        value={driveLotFolderUrl}
                        onChange={(e) => setDriveLotFolderUrl(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Receipt Image Upload (R2 folder: receipts) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <ImageUploader
                images={receiptImages}
                onChange={setReceiptImages}
                maxFiles={1}
                folder="receipts"
                label="อัปโหลดรูปสลิป / ใบเสร็จ (r2_receipt_url) - ย่อเป็น WebP ขึ้น R2 อัตโนมัติ"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                หมายเหตุเพิ่มเติม (notes)
              </label>
              <textarea
                rows={2}
                placeholder="ระบุบันทึกช่วยจำ เช่น เลขพัสดุ หรือรายละเอียดล็อตสินค้า"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs sm:text-sm font-semibold shadow-md shadow-purple-600/25 hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>บันทึกข้อมูล</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Expenses Table / List */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-600" />
              รายการค่าใช้จ่ายล่าสุด ({expenses.length} รายการ)
            </h3>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">กำลังโหลดรายการค่าใช้จ่าย...</p>
            </div>
          ) : expenses.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Receipt className="w-10 h-10 mx-auto text-purple-300" />
              <p className="text-sm font-semibold text-slate-700">ยังไม่มีรายการค่าใช้จ่าย</p>
              <p className="text-xs text-slate-400">กดปุ่ม "+ บันทึกค่าใช้จ่ายใหม่" ด้านบนเพื่อเริ่มบันทึกบิล</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {expenses.map((item) => {
                const catConfig =
                  EXPENSE_CATEGORIES_CONFIG[item.category] ||
                  EXPENSE_CATEGORIES_CONFIG.OTHER;

                // Check if there is an associated lot
                const linkedLot = lots.find((l) => l.expense_id === item.id);

                return (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 rounded-2xl bg-purple-50 text-purple-700 mt-0.5 shrink-0">
                        <Receipt className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-slate-900 text-sm sm:text-base">
                            {item.title}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${catConfig.badgeClass}`}
                          >
                            {catConfig.label}
                          </span>
                          {linkedLot && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                              🔗 {linkedLot.lot_code}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {item.expense_date}
                          </span>
                          {item.vendor_name && (
                            <span>• ร้าน/ผู้ขาย: {item.vendor_name}</span>
                          )}
                          {item.payment_method && (
                            <span>• จ่ายโดย: {item.payment_method}</span>
                          )}
                        </div>

                        {item.notes && (
                          <p className="text-xs text-slate-400 mt-1 italic">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full sm:w-auto gap-3 self-end sm:self-center">
                      <span className="text-base sm:text-lg font-bold text-rose-600">
                        -฿{Number(item.total_amount).toLocaleString()}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {item.r2_receipt_url && (
                          <button
                            onClick={() => setSelectedReceiptUrl(item.r2_receipt_url!)}
                            className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                            title="ดูสลิป"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>สลิป R2</span>
                          </button>
                        )}

                        {item.drive_doc_url && (
                          <a
                            href={item.drive_doc_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-slate-100 rounded-xl transition"
                            title="เปิดเอกสารใน Google Drive"
                          >
                            <FolderOpen className="w-4 h-4" />
                          </a>
                        )}

                        {/* Delete Expense Button */}
                        <button
                          onClick={() => handleDeleteExpense(item.id, item.title)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                          title="ลบรายการค่าใช้จ่ายนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lightbox for Receipt Image */}
        {selectedReceiptUrl && (
          <div
            onClick={() => setSelectedReceiptUrl(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-4 max-w-lg w-full max-h-[85vh] flex flex-col relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-sm">
                  สลิป / ใบเสร็จรับเงิน (Cloudflare R2 WebP)
                </h4>
                <button
                  onClick={() => setSelectedReceiptUrl(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-auto py-3 flex items-center justify-center">
                <img
                  src={selectedReceiptUrl}
                  alt="Receipt"
                  className="max-h-[65vh] object-contain rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        {/* Google Sheets Live Feed Modal */}
        <GoogleSheetsModal
          isOpen={showSheetsModal}
          onClose={() => setShowSheetsModal(false)}
          defaultTab="expenses"
        />
      </main>
    </div>
  );
}
