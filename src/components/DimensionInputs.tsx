'use client';

import React, { useState, useEffect } from 'react';
import { Maximize2, Sparkles, HelpCircle } from 'lucide-react';
import DimensionGuideButton from './DimensionGuideModal';

interface DimensionInputsProps {
  value: string;
  onChange: (val: string) => void;
  stoneShape?: string;
  label?: string;
}

export default function DimensionInputs({
  value,
  onChange,
  stoneShape = 'Sphere',
  label = 'ขนาด (dimensions)',
}: DimensionInputsProps) {
  // Mode: structured boxes vs freeform manual text
  const [isManual, setIsManual] = useState(false);

  // Structured fields (all in cm)
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [val3, setVal3] = useState('');

  // Determine shape category
  const isSphere = stoneShape === 'Sphere';
  const isTower = stoneShape === 'Tower';
  const isJewelryOrPalm = ['Palm', 'Cabochon', 'Faceted'].includes(stoneShape);

  // Labels for the boxes based on shape
  let label1 = 'กว้าง (W)';
  let label2 = 'ยาว (L)';
  let label3 = 'สูง (H)';
  let placeholder1 = '9.5';
  let placeholder2 = '7.2';
  let placeholder3 = '6.0';

  if (isSphere) {
    label1 = 'เส้นผ่านศูนย์กลาง (Ø)';
    placeholder1 = '5.5';
  } else if (isTower) {
    label1 = 'สูง (H)';
    label2 = 'กว้างฐาน (W)';
    label3 = 'หนาฐาน (D)';
    placeholder1 = '12.5';
    placeholder2 = '3.5';
    placeholder3 = '3.0';
  } else if (isJewelryOrPalm) {
    label1 = 'ยาว (L)';
    label2 = 'กว้าง (W)';
    label3 = 'หนา/นูน (T)';
    placeholder1 = '4.5';
    placeholder2 = '3.2';
    placeholder3 = '1.5';
  }

  // Parse initial or external value if possible
  useEffect(() => {
    if (!value) return;

    if (isSphere) {
      const match = value.match(/(?:Ø|เส้นผ่านศูนย์กลาง)?\s*([\d.]+)/i);
      if (match && match[1]) {
        setVal1(match[1]);
        return;
      }
    }

    const parts = value.match(/([\d.]+)\s*x\s*([\d.]+)(?:\s*x\s*([\d.]+))?/i);
    if (parts) {
      setVal1(parts[1] || '');
      setVal2(parts[2] || '');
      setVal3(parts[3] || '');
    } else if (value.trim() && !isManual) {
      // If it has non-standard custom format and we haven't typed yet
      // leave as is or allow manual
    }
  }, [value, isSphere]);

  // Update formatted string when structured inputs change
  const handleBoxChange = (v1: string, v2: string, v3: string) => {
    setVal1(v1);
    setVal2(v2);
    setVal3(v3);

    const clean1 = v1.trim();
    const clean2 = v2.trim();
    const clean3 = v3.trim();

    if (isSphere) {
      if (clean1) {
        onChange(`Ø ${clean1} cm`);
      } else {
        onChange('');
      }
      return;
    }

    if (isTower) {
      if (clean1 && clean2 && clean3) {
        onChange(`สูง ${clean1} x ${clean2} x ${clean3} cm`);
      } else if (clean1 && clean2) {
        onChange(`สูง ${clean1} x ${clean2} cm`);
      } else if (clean1) {
        onChange(`สูง ${clean1} cm`);
      } else {
        onChange('');
      }
      return;
    }

    // Standard 3D: W x L x H or L x W x T
    const validParts = [clean1, clean2, clean3].filter(Boolean);
    if (validParts.length > 0) {
      onChange(`${validParts.join(' x ')} cm`);
    } else {
      onChange('');
    }
  };

  return (
    <div className="space-y-1.5">
      {/* Header bar: Label + Guide Button + Toggle Manual */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
          <Maximize2 className="w-3.5 h-3.5 text-purple-600" />
          <span>{label}</span>
          <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
            หน่วย cm
          </span>
        </label>

        <div className="flex items-center gap-1.5">
          <DimensionGuideButton
            activeShape={stoneShape}
            onSelectTemplate={(tpl) => {
              onChange(tpl);
              // also try to parse into boxes
              const p = tpl.match(/([\d.]+)\s*x\s*([\d.]+)(?:\s*x\s*([\d.]+))?/i);
              if (p) {
                setVal1(p[1] || '');
                setVal2(p[2] || '');
                setVal3(p[3] || '');
              }
            }}
          />

          <button
            type="button"
            onClick={() => setIsManual(!isManual)}
            className="text-[10px] text-slate-500 hover:text-purple-700 underline transition cursor-pointer"
          >
            {isManual ? 'สลับเป็นช่องแยก' : 'พิมพ์เองอิสระ'}
          </button>
        </div>
      </div>

      {/* Mode 1: Structured separate boxes */}
      {!isManual ? (
        <div className="space-y-1.5">
          {isSphere ? (
            /* SPHERE: 1 Box */
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-amber-700 text-sm">
                  Ø
                </span>
                <input
                  type="number"
                  step="0.1"
                  placeholder={placeholder1}
                  value={val1}
                  onChange={(e) => handleBoxChange(e.target.value, val2, val3)}
                  className="w-full pl-8 pr-12 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-bold text-slate-800 outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  cm
                </span>
              </div>
            </div>
          ) : (
            /* 3 BOXES (TOWER / RAW / PALM / ETC.) */
            <div className="flex items-center gap-1.5">
              {/* Box 1 */}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-500 font-semibold mb-0.5 truncate text-center">
                  {label1}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    placeholder={placeholder1}
                    value={val1}
                    onChange={(e) => handleBoxChange(e.target.value, val2, val3)}
                    className="w-full px-2.5 py-2 text-center text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-bold text-slate-800 outline-none"
                  />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 pointer-events-none">
                    cm
                  </span>
                </div>
              </div>

              {/* Separator 'x' */}
              <span className="font-bold text-purple-600 text-sm pt-4">x</span>

              {/* Box 2 */}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-500 font-semibold mb-0.5 truncate text-center">
                  {label2}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    placeholder={placeholder2}
                    value={val2}
                    onChange={(e) => handleBoxChange(val1, e.target.value, val3)}
                    className="w-full px-2.5 py-2 text-center text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-bold text-slate-800 outline-none"
                  />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 pointer-events-none">
                    cm
                  </span>
                </div>
              </div>

              {/* Separator 'x' */}
              <span className="font-bold text-purple-600 text-sm pt-4">x</span>

              {/* Box 3 */}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-500 font-semibold mb-0.5 truncate text-center">
                  {label3}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    placeholder={placeholder3}
                    value={val3}
                    onChange={(e) => handleBoxChange(val1, val2, e.target.value)}
                    className="w-full px-2.5 py-2 text-center text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-bold text-slate-800 outline-none"
                  />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 pointer-events-none">
                    cm
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Live Preview Text */}
          <div className="flex items-center justify-between px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200/80 text-[11px]">
            <span className="text-slate-500">ผลลัพธ์ที่บันทึก:</span>
            <span className="font-mono font-bold text-purple-900 truncate">
              {value || '(ยังไม่ได้ระบุขนาด)'}
            </span>
          </div>
        </div>
      ) : (
        /* Mode 2: Freeform manual text input */
        <div>
          <input
            type="text"
            placeholder="เช่น 9.5 x 7.2 x 6.0 cm หรือ Ø 5.5 cm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3.5 py-2 text-sm bg-white border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-medium text-slate-800 outline-none"
          />
        </div>
      )}
    </div>
  );
}
