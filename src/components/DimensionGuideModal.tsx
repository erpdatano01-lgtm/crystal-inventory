'use client';

import React, { useState } from 'react';
import { HelpCircle, X, Sparkles, Ruler, Check } from 'lucide-react';

interface DimensionGuideProps {
  activeShape?: string;
  onSelectTemplate?: (template: string) => void;
}

export default function DimensionGuideButton({
  activeShape = 'Sphere',
  onSelectTemplate,
}: DimensionGuideProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleApply = (tpl: string) => {
    if (onSelectTemplate) {
      onSelectTemplate(tpl);
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* Trigger Trick Badge Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 text-[10px] font-bold transition active:scale-95 cursor-pointer shadow-2xs"
        title="ดูรูปวิธีวัดขนาดหินแต่ละทรง"
      >
        <HelpCircle className="w-3 h-3 text-amber-700" />
        <span>ทริควัดขนาด</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-3xl w-full max-h-[88dvh] overflow-y-auto overscroll-contain p-5 sm:p-7 space-y-6 shadow-2xl cursor-default border border-purple-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-purple-600 text-white shadow-sm">
                  <Ruler className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    คู่มือ & ทริคการวัดขนาดหินคริสตัล (Measurement Guide)
                  </h3>
                  <p className="text-xs text-slate-500">
                    ภาพประกอบวิธีวัดขนาดตามมาตรฐานร้านหินและจิวเวลรี่ พร้อมปุ่มกดใช้รูปแบบทันที
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 4 Illustrated Visual Diagrams Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. SPHERE */}
              <div
                className={`p-4 rounded-2xl border-2 transition ${
                  activeShape === 'Sphere'
                    ? 'border-purple-500 bg-purple-50/40'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-purple-900 bg-purple-100 px-2.5 py-0.5 rounded-full">
                    1. Sphere (ทรงกลม / ลูกแก้ว)
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-500">
                    [SPH]
                  </span>
                </div>

                {/* SVG Diagram: Sphere Diameter */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-3 flex items-center justify-center h-36">
                  <svg viewBox="0 0 200 120" className="w-full h-full max-w-[190px]">
                    <defs>
                      <radialGradient id="sphereGrad" cx="35%" cy="30%" r="65%">
                        <stop offset="0%" stopColor="#e9d5ff" />
                        <stop offset="55%" stopColor="#9333ea" />
                        <stop offset="100%" stopColor="#4c1d95" />
                      </radialGradient>
                    </defs>
                    {/* Base shadow */}
                    <ellipse cx="100" cy="105" rx="36" ry="6" fill="#e2e8f0" />
                    {/* Sphere */}
                    <circle cx="100" cy="60" r="40" fill="url(#sphereGrad)" />
                    {/* Shine */}
                    <ellipse cx="85" cy="42" rx="10" ry="6" fill="white" opacity="0.45" transform="rotate(-25 85 42)" />
                    {/* Caliper / Diameter Line */}
                    <line x1="60" y1="16" x2="60" y2="60" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2" />
                    <line x1="140" y1="16" x2="140" y2="60" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2" />
                    <line x1="60" y1="20" x2="140" y2="20" stroke="#d97706" strokeWidth="2" />
                    <polygon points="60,20 66,16 66,24" fill="#d97706" />
                    <polygon points="140,20 134,16 134,24" fill="#d97706" />
                    <rect x="76" y="9" width="48" height="16" rx="4" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1" />
                    <text x="100" y="20" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#92400e">
                      Ø เส้นผ่านศูนย์กลาง
                    </text>
                  </svg>
                </div>

                <div className="mt-2.5 space-y-1.5 text-xs text-slate-600">
                  <p>
                    • <strong>วิธีวัด:</strong> ใช้เวอร์เนียร์ (Caliper) หนีบวัด{' '}
                    <strong className="text-purple-800">เส้นผ่านศูนย์กลาง (Ø)</strong> เพียงค่าเดียว
                  </p>
                  <p>• นิยมใช้หน่วย <strong>มิลลิเมตร (mm)</strong> หรือ <strong>ซม. (cm)</strong></p>
                  {onSelectTemplate && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleApply('Ø 55 mm')}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-200 text-[11px] font-mono font-bold transition"
                      >
                        + ใช้ &quot;Ø 55 mm&quot;
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApply('Ø 5.5 cm')}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-200 text-[11px] font-mono font-bold transition"
                      >
                        + ใช้ &quot;Ø 5.5 cm&quot;
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. TOWER */}
              <div
                className={`p-4 rounded-2xl border-2 transition ${
                  activeShape === 'Tower'
                    ? 'border-purple-500 bg-purple-50/40'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-indigo-900 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                    2. Tower (ทรงแท่ง / เสาปลายแหลม)
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-500">
                    [TOW]
                  </span>
                </div>

                {/* SVG Diagram: Crystal Tower */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-3 flex items-center justify-center h-36">
                  <svg viewBox="0 0 200 120" className="w-full h-full max-w-[190px]">
                    {/* Tower Polygon */}
                    <polygon points="100,12 78,38 78,96 122,96 122,38" fill="#818cf8" stroke="#4338ca" strokeWidth="1.5" />
                    <polygon points="100,12 100,96 122,96 122,38" fill="#6366f1" opacity="0.7" />
                    <line x1="78" y1="38" x2="100" y2="44" stroke="#4338ca" strokeWidth="1.2" />
                    <line x1="122" y1="38" x2="100" y2="44" stroke="#4338ca" strokeWidth="1.2" />
                    <line x1="100" y1="12" x2="100" y2="96" stroke="#c7d2fe" strokeWidth="1" />

                    {/* Height Arrow (H) */}
                    <line x1="56" y1="12" x2="56" y2="96" stroke="#10b981" strokeWidth="2" />
                    <polygon points="56,12 52,18 60,18" fill="#10b981" />
                    <polygon points="56,96 52,90 60,90" fill="#10b981" />
                    <line x1="56" y1="12" x2="96" y2="12" stroke="#10b981" strokeWidth="1" strokeDasharray="2,2" />
                    <line x1="56" y1="96" x2="76" y2="96" stroke="#10b981" strokeWidth="1" strokeDasharray="2,2" />
                    <text x="34" y="57" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#047857">
                      สูง (H)
                    </text>

                    {/* Base Width Arrow (W) */}
                    <line x1="78" y1="108" x2="122" y2="108" stroke="#d97706" strokeWidth="2" />
                    <polygon points="78,108 84,104 84,112" fill="#d97706" />
                    <polygon points="122,108 116,104 116,112" fill="#d97706" />
                    <text x="148" y="111" textAnchor="start" fontSize="9" fontWeight="bold" fill="#92400e">
                      กว้างฐาน (W)
                    </text>
                  </svg>
                </div>

                <div className="mt-2.5 space-y-1.5 text-xs text-slate-600">
                  <p>
                    • <strong>วิธีวัด:</strong> วัด{' '}
                    <strong className="text-indigo-800">ความสูง (H) × กว้างฐาน (W) × หนา (D)</strong>
                  </p>
                  <p>• วัดจากฐานถึงปลายยอดแหลม (หน่วย <strong>cm</strong>)</p>
                  {onSelectTemplate && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleApply('สูง 12.5 x ฐาน 3.5 x 3.0 cm')}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 text-[11px] font-mono font-bold transition"
                      >
                        + ใช้ &quot;สูง 12.5 x ฐาน 3.5 x 3.0 cm&quot;
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. RAW / SPECIMEN & CARVED */}
              <div
                className={`p-4 rounded-2xl border-2 transition ${
                  activeShape === 'Raw' || activeShape === 'Carved'
                    ? 'border-purple-500 bg-purple-50/40'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    3. Raw / Specimen & Carved (หินดิบ/แกะสลัก)
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-500">
                    [RAW / CRV]
                  </span>
                </div>

                {/* SVG Diagram: Raw Cluster */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-3 flex items-center justify-center h-36">
                  <svg viewBox="0 0 200 120" className="w-full h-full max-w-[190px]">
                    {/* Bounding Box Dashed */}
                    <rect x="50" y="22" width="100" height="68" fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,3" />
                    {/* Raw cluster crystals */}
                    <polygon points="55,90 50,58 68,40 82,65 75,90" fill="#a855f7" stroke="#6b21a8" strokeWidth="1.2" />
                    <polygon points="72,90 75,35 98,22 115,48 110,90" fill="#9333ea" stroke="#581c87" strokeWidth="1.2" />
                    <polygon points="105,90 112,45 135,34 148,65 142,90" fill="#c084fc" stroke="#6b21a8" strokeWidth="1.2" />
                    {/* Width W */}
                    <line x1="50" y1="104" x2="150" y2="104" stroke="#0284c7" strokeWidth="2" />
                    <polygon points="50,104 56,100 56,108" fill="#0284c7" />
                    <polygon points="150,104 144,100 144,108" fill="#0284c7" />
                    <text x="100" y="115" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#0369a1">
                      กว้างสุด (W) × ยาว/ลึก (D)
                    </text>
                    {/* Height H */}
                    <line x1="36" y1="22" x2="36" y2="90" stroke="#10b981" strokeWidth="2" />
                    <polygon points="36,22 32,28 40,28" fill="#10b981" />
                    <polygon points="36,90 32,84 40,84" fill="#10b981" />
                    <text x="20" y="58" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#047857">
                      สูง (H)
                    </text>
                  </svg>
                </div>

                <div className="mt-2.5 space-y-1.5 text-xs text-slate-600">
                  <p>
                    • <strong>วิธีวัด:</strong> วางหินในท่าตั้งโชว์ปกติ แล้ววัดกรอบนอกสุดที่ยื่นออกมากที่สุด{' '}
                    <strong className="text-emerald-800">กว้าง × ยาว(ลึก) × สูง (cm)</strong>
                  </p>
                  {onSelectTemplate && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleApply('9.5 x 7.2 x 6.0 cm')}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 text-[11px] font-mono font-bold transition"
                      >
                        + ใช้ &quot;9.5 x 7.2 x 6.0 cm&quot;
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. PALM / CABOCHON / FACETED / TUMBLE */}
              <div
                className={`p-4 rounded-2xl border-2 transition ${
                  ['Palm', 'Cabochon', 'Faceted', 'Tumble'].includes(activeShape)
                    ? 'border-purple-500 bg-purple-50/40'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full">
                    4. Palm / Cabochon / Faceted / Tumble
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-500">
                    [PLM/CAB/FAC/TUM]
                  </span>
                </div>

                {/* SVG Diagram: Oval Cabochon / Palm Stone */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-3 flex items-center justify-center h-36">
                  <svg viewBox="0 0 200 120" className="w-full h-full max-w-[190px]">
                    {/* Top View Oval */}
                    <ellipse cx="72" cy="56" rx="34" ry="24" fill="#fbbf24" stroke="#b45309" strokeWidth="1.5" />
                    <ellipse cx="62" cy="48" rx="14" ry="7" fill="#fef3c7" opacity="0.6" transform="rotate(-15 62 48)" />
                    {/* Length L */}
                    <line x1="38" y1="92" x2="106" y2="92" stroke="#d97706" strokeWidth="1.8" />
                    <polygon points="38,92 44,88 44,96" fill="#d97706" />
                    <polygon points="106,92 100,88 100,96" fill="#d97706" />
                    <text x="72" y="104" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#92400e">
                      ยาว (L)
                    </text>
                    {/* Width W */}
                    <line x1="24" y1="32" x2="24" y2="80" stroke="#0284c7" strokeWidth="1.8" />
                    <polygon points="24,32 20,38 28,38" fill="#0284c7" />
                    <polygon points="24,80 20,74 28,74" fill="#0284c7" />
                    <text x="14" y="58" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#0369a1">
                      W
                    </text>

                    {/* Side View Dome (Thickness T) */}
                    <path d="M 135,72 Q 155,34 175,72 Z" fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" />
                    <line x1="184" y1="52" x2="184" y2="72" stroke="#10b981" strokeWidth="1.8" />
                    <text x="160" y="90" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#047857">
                      หนา/นูน (T)
                    </text>
                  </svg>
                </div>

                <div className="mt-2.5 space-y-1.5 text-xs text-slate-600">
                  <p>
                    • <strong>วิธีวัด:</strong> วัด{' '}
                    <strong className="text-amber-900">ยาว (L) × กว้าง (W) × ความหนา/นูน (T)</strong>
                  </p>
                  <p>• งานเจียหลังเบี้ยและพลอย <strong>ต้องใช้หน่วย มิลลิเมตร (mm)</strong> เสมอ ताकिช่างขึ้นตัวเรือนได้แม่นยำ</p>
                  {onSelectTemplate && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleApply('25 x 18 x 8 mm')}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-600 hover:text-white text-amber-800 border border-amber-300 text-[11px] font-mono font-bold transition"
                      >
                        + ใช้ &quot;25 x 18 x 8 mm&quot;
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApply('45 x 35 x 15 mm')}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-600 hover:text-white text-amber-800 border border-amber-300 text-[11px] font-mono font-bold transition"
                      >
                        + ใช้ &quot;45 x 35 x 15 mm (Palm)&quot;
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Golden Rules Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-purple-50 to-indigo-50 border border-amber-200/80 text-xs space-y-1.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>สรุปทริคจำง่ายเวลาลงสต็อกร้าน Vivida Crystal:</span>
              </div>
              <ul className="list-disc list-inside text-slate-700 space-y-1 pl-1">
                <li>
                  <strong>หินชิ้นเล็ก / หินเจียทำเครื่องประดับ (Cabochon, Faceted, Tumble, Sphere ลูกเล็ก):</strong> ใช้หน่วย{' '}
                  <span className="font-mono font-bold text-purple-800 bg-white px-1.5 py-0.5 rounded border">mm (มิลลิเมตร)</span> เช่น <code className="font-bold">18 x 14 x 6 mm</code> (10 mm = 1 cm)
                </li>
                <li>
                  <strong>หินตั้งโชว์ / ก้อนใหญ่ (Raw Specimen, Tower, Carved):</strong> ใช้หน่วย{' '}
                  <span className="font-mono font-bold text-indigo-800 bg-white px-1.5 py-0.5 rounded border">cm (เซนติเมตร)</span> เช่น <code className="font-bold">12.5 x 8.0 x 6.5 cm</code>
                </li>
              </ul>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Check className="w-4 h-4" />
                <span>เข้าใจแล้ว ปิดหน้าต่าง</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
