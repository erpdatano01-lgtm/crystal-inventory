'use client';

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  X,
  Copy,
  Check,
  Download,
  ExternalLink,
  Sparkles,
  Info,
  HelpCircle,
  Table,
  Receipt,
  RefreshCw,
} from 'lucide-react';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'products' | 'expenses';
}

export default function GoogleSheetsModal({
  isOpen,
  onClose,
  defaultTab = 'products',
}: GoogleSheetsModalProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'expenses'>(defaultTab);
  const [origin, setOrigin] = useState('');
  const [copiedFormula, setCopiedFormula] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  if (!isOpen) return null;

  const currentEndpoint =
    activeTab === 'products'
      ? `${origin}/api/export/products`
      : `${origin}/api/export/expenses`;

  const sheetFormula = `=IMPORTDATA("${currentEndpoint}")`;

  const copyToClipboard = async (text: string, type: 'formula' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'formula') {
        setCopiedFormula(true);
        setTimeout(() => setCopiedFormula(false), 2000);
      } else {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <FileSpreadsheet className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">เชื่อมต่อ Google Sheets (Live Sync)</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 uppercase tracking-wide">
                  Real-time Feed
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                ซิงค์สต็อกหินและบันทึกค่าใช้จ่ายไปแสดงผลบน Google Sheets อัตโนมัติด้วยสูตร 1 บรรทัด
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition active:scale-95 text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 pt-4 border-b border-slate-100 flex gap-2 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition border-b-2 ${
              activeTab === 'products'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>ตารางสต็อกสินค้า (Products)</span>
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition border-b-2 ${
              activeTab === 'expenses'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>ตารางค่าใช้จ่าย & ล็อตหิน (Expenses)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Main Action Box: Formula to Copy */}
          <div className="bg-emerald-50/70 border-2 border-emerald-500/30 rounded-2xl p-4 sm:p-5 relative">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                สูตรสำหรับวางในช่อง A1 ของ Google Sheets:
              </label>
              <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> อัปเดตสดอัตโนมัติ
              </span>
            </div>

            <div className="flex items-center gap-2 bg-white rounded-xl border border-emerald-300 p-2 shadow-sm">
              <code className="text-xs sm:text-sm font-mono text-emerald-950 font-semibold flex-1 overflow-x-auto select-all px-2 py-1">
                {sheetFormula}
              </code>
              <button
                onClick={() => copyToClipboard(sheetFormula, 'formula')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition active:scale-95 shrink-0 ${
                  copiedFormula
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                }`}
              >
                {copiedFormula ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>คัดลอกแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>คัดลอกสูตร</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-slate-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>สูตรนี้จะดึงข้อมูลทั้งตารางพร้อมหัวข้อภาษาไทยและคำนวณกำไรให้ทันที</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={currentEndpoint}
                  download={
                    activeTab === 'products'
                      ? 'crystal_products_export.csv'
                      : 'crystal_expenses_export.csv'
                  }
                  className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold underline decoration-slate-300 hover:decoration-slate-600"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลดไฟล์ .CSV</span>
                </a>
              </div>
            </div>
          </div>

          {/* 3 Simple Steps Guide */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-3">
              <HelpCircle className="w-4 h-4 text-purple-600" />
              วิธีใช้งานง่ายๆ 3 ขั้นตอน:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs flex flex-col">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center mb-2">
                  1
                </div>
                <p className="text-xs font-bold text-slate-900">เปิด Google Sheets</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  สร้าง Spreadsheet เปล่าใหม่ขึ้นมา 1 ไฟล์
                </p>
                <a
                  href="https://sheets.new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto pt-2 text-[11px] text-emerald-600 font-bold inline-flex items-center gap-1 hover:underline"
                >
                  <span>คลิกเปิดชีตใหม่</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs flex flex-col">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center mb-2">
                  2
                </div>
                <p className="text-xs font-bold text-slate-900">คลิกที่ช่อง A1</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  เลือกช่องแรกบนซ้ายสุด (Cell A1) ในหน้ากระดาษ
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs flex flex-col">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center mb-2">
                  3
                </div>
                <p className="text-xs font-bold text-slate-900">วางสูตรแล้วกด Enter</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  กด <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px]">Ctrl+V</kbd> วางสูตรแล้วกด Enter ข้อมูลจะวิ่งมาทันที!
                </p>
              </div>
            </div>
          </div>

          {/* Table Preview Info */}
          <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200/60">
            <p className="font-semibold text-slate-800">
              💡 ข้อมูลที่จะแสดงใน Google Sheets สำหรับ{' '}
              {activeTab === 'products' ? 'สต็อกสินค้า' : 'ค่าใช้จ่าย'}:
            </p>
            {activeTab === 'products' ? (
              <ul className="list-disc list-inside space-y-1 text-slate-500 pl-1">
                <li>รหัส SKU, ชื่อหิน, ชนิดแร่, ขนาด, น้ำหนักรวม (กรัม)</li>
                <li>สถานะสินค้า (พร้อมจำหน่าย, ติดจอง, ขายแล้ว)</li>
                <li>ราคาทุน, ราคาขาย, ราคาขั้นต่ำ, กำไรคาดการณ์ และ % Margin คำนวณให้อัตโนมัติ</li>
                <li>ลิงก์รูปถ่ายหินบน Cloudflare R2 และลิงก์วิดีโอ/โฟลเดอร์ Google Drive</li>
              </ul>
            ) : (
              <ul className="list-disc list-inside space-y-1 text-slate-500 pl-1">
                <li>วันที่ทำรายการ, หมวดหมู่ค่าใช้จ่าย, รายละเอียดบิล, ยอดเงินรวม</li>
                <li>ชื่อร้านค้า/แหล่งที่มา, ช่องทางการชำระเงิน</li>
                <li>รหัสล็อตหินที่สร้างคู่กัน (Lot Code) พร้อมน้ำหนักล็อต</li>
                <li>ลิงก์เปิดดูสลิปโอนเงิน/ใบเสร็จ WebP บน Cloudflare R2</li>
              </ul>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            * Google Sheets จะดึงข้อมูลอัปเดตใหม่อัตโนมัติเป็นระยะ
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition active:scale-95"
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
}
