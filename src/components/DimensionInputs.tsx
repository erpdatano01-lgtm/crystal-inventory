'use client';

import React, { useState, useEffect } from 'react';
import { Maximize2 } from 'lucide-react';
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
  label = 'ขนาด (Dimensions)',
}: DimensionInputsProps) {
  const [isManual, setIsManual] = useState(false);

  // Structured fields (in cm)
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [val3, setVal3] = useState('');

  const isSphere = stoneShape === 'Sphere';
  const isTower = stoneShape === 'Tower';
  const isJewelryOrPalm = ['Palm', 'Cabochon', 'Faceted'].includes(stoneShape);

  // Placeholders based on shape
  let ph1 = 'กว้าง (cm)';
  let ph2 = 'ยาว (cm)';
  let ph3 = 'สูง (cm)';

  if (isSphere) {
    ph1 = 'เส้นผ่านศูนย์กลาง Ø (cm)';
  } else if (isTower) {
    ph1 = 'สูง H (cm)';
    ph2 = 'กว้างฐาน W (cm)';
    ph3 = 'หนาฐาน D (cm)';
  } else if (isJewelryOrPalm) {
    ph1 = 'ยาว L (cm)';
    ph2 = 'กว้าง W (cm)';
    ph3 = 'หนา/นูน T (cm)';
  }

  // Parse incoming value
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
    }
  }, [value, isSphere]);

  const handleBoxChange = (v1: string, v2: string, v3: string) => {
    setVal1(v1);
    setVal2(v2);
    setVal3(v3);

    const c1 = v1.trim();
    const c2 = v2.trim();
    const c3 = v3.trim();

    if (isSphere) {
      onChange(c1 ? `Ø ${c1} cm` : '');
      return;
    }

    if (isTower) {
      if (c1 && c2 && c3) onChange(`สูง ${c1} x ${c2} x ${c3} cm`);
      else if (c1 && c2) onChange(`สูง ${c1} x ${c2} cm`);
      else if (c1) onChange(`สูง ${c1} cm`);
      else onChange('');
      return;
    }

    const validParts = [c1, c2, c3].filter(Boolean);
    onChange(validParts.length > 0 ? `${validParts.join(' x ')} cm` : '');
  };

  return (
    <div>
      {/* Header aligned to h-6 */}
      <div className="h-6 flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
          <Maximize2 className="w-3.5 h-3.5 text-purple-600" />
          <span>{label}</span>
          <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
            cm
          </span>
        </label>

        <div className="flex items-center gap-2">
          <DimensionGuideButton
            activeShape={stoneShape}
            onSelectTemplate={(tpl) => {
              onChange(tpl);
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
            className="text-[10px] text-slate-400 hover:text-purple-700 underline transition cursor-pointer"
          >
            {isManual ? 'ช่องแยก' : 'พิมพ์อิสระ'}
          </button>
        </div>
      </div>

      {/* Input row matching exact h-11 */}
      {!isManual ? (
        isSphere ? (
          /* SPHERE: 1 Box */
          <div className="relative h-11">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-amber-700 text-sm pointer-events-none">
              Ø
            </span>
            <input
              type="number"
              step="0.1"
              placeholder="เช่น 5.5"
              value={val1}
              onChange={(e) => handleBoxChange(e.target.value, val2, val3)}
              className="w-full h-11 pl-9 pr-12 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 font-bold text-slate-800 outline-none transition"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
              cm
            </span>
          </div>
        ) : (
          /* 3 BOXES (TOWER / RAW / PALM / ETC.) */
          <div className="flex items-center gap-1.5 h-11">
            <div className="relative flex-1 h-11">
              <input
                type="number"
                step="0.1"
                placeholder={ph1}
                value={val1}
                onChange={(e) => handleBoxChange(e.target.value, val2, val3)}
                className="w-full h-11 px-2 text-center text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 font-bold text-slate-800 outline-none transition"
              />
            </div>
            <span className="font-bold text-purple-400 text-xs shrink-0">x</span>
            <div className="relative flex-1 h-11">
              <input
                type="number"
                step="0.1"
                placeholder={ph2}
                value={val2}
                onChange={(e) => handleBoxChange(val1, e.target.value, val3)}
                className="w-full h-11 px-2 text-center text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 font-bold text-slate-800 outline-none transition"
              />
            </div>
            <span className="font-bold text-purple-400 text-xs shrink-0">x</span>
            <div className="relative flex-1 h-11">
              <input
                type="number"
                step="0.1"
                placeholder={ph3}
                value={val3}
                onChange={(e) => handleBoxChange(val1, val2, e.target.value)}
                className="w-full h-11 px-2 text-center text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 font-bold text-slate-800 outline-none transition"
              />
            </div>
          </div>
        )
      ) : (
        /* Manual freeform input */
        <input
          type="text"
          placeholder="เช่น Ø 5.5 cm หรือ 12.5 x 3.5 x 3.0 cm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-11 px-3.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none font-medium text-slate-800 transition"
        />
      )}
    </div>
  );
}
