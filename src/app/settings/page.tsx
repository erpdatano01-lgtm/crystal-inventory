'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import {
  Settings,
  Gem,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Sparkles,
  Check,
  X,
  Search,
  Layers,
  HelpCircle,
  AlertCircle,
  Tag,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import {
  StoneShapeItem,
  StoneTypeItem,
  getStoneShapes,
  saveStoneShapes,
  resetStoneShapes,
  getStoneTypes,
  saveStoneTypes,
  resetStoneTypes,
  suggestAbbreviation,
  getHideCostPreference,
  setHideCostPreference,
} from '@/lib/settingsService';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'shapes' | 'stones' | 'tester' | 'privacy'>('shapes');
  const [hideCost, setHideCost] = useState(true);

  // Shapes state
  const [shapes, setShapes] = useState<StoneShapeItem[]>([]);
  const [shapeSearch, setShapeSearch] = useState('');
  const [editingShape, setEditingShape] = useState<StoneShapeItem | null>(null);
  const [isAddingShape, setIsAddingShape] = useState(false);
  const [shapeForm, setShapeForm] = useState<{
    id: string;
    code: string;
    nameEn: string;
    nameTh: string;
    desc: string;
  }>({
    id: '',
    code: '',
    nameEn: '',
    nameTh: '',
    desc: '',
  });

  // Stones state
  const [stones, setStones] = useState<StoneTypeItem[]>([]);
  const [stoneSearch, setStoneSearch] = useState('');
  const [editingStone, setEditingStone] = useState<StoneTypeItem | null>(null);
  const [isAddingStone, setIsAddingStone] = useState(false);
  const [stoneForm, setStoneForm] = useState<{
    id: string;
    code: string;
    nameEn: string;
    nameTh: string;
  }>({
    id: '',
    code: '',
    nameEn: '',
    nameTh: '',
  });

  // SKU Tester state
  const [testShapeId, setTestShapeId] = useState<string>('Sphere');
  const [testStoneId, setTestStoneId] = useState<string>('Amethyst');
  const [testNumber, setTestNumber] = useState<number>(1);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Load settings on mount
  useEffect(() => {
    setShapes(getStoneShapes());
    setStones(getStoneTypes());
    setHideCost(getHideCostPreference());
  }, []);

  // ----------------------------------------------------
  // SHAPES HANDLERS
  // ----------------------------------------------------
  const handleOpenAddShape = () => {
    setShapeForm({ id: '', code: '', nameEn: '', nameTh: '', desc: '' });
    setIsAddingShape(true);
    setEditingShape(null);
  };

  const handleOpenEditShape = (sh: StoneShapeItem) => {
    // Try to extract English & Thai
    const match = sh.label.match(/^(.*?)\s*(?:\((.*?)\))?$/);
    const nameEn = match ? match[1].replace(/^\d+\.\s*/, '').trim() : sh.id;
    const nameTh = match && match[2] ? match[2].trim() : '';

    setShapeForm({
      id: sh.id,
      code: sh.code,
      nameEn,
      nameTh,
      desc: sh.desc || '',
    });
    setEditingShape(sh);
    setIsAddingShape(false);
  };

  const handleShapeNameEnChange = (enName: string) => {
    const updated = { ...shapeForm, nameEn: enName, id: enName.trim() };
    // Auto detect unique suggestion (never collides with existing shape codes)
    if (!editingShape) {
      const existingCodes = shapes.map((s) => s.code);
      updated.code = suggestAbbreviation(enName, existingCodes);
    }
    setShapeForm(updated);
  };

  // Real-time duplicate checks for Shape Modal
  const otherShapes = shapes.filter((s) => s.id !== editingShape?.id);
  const conflictingShapeByName = shapeForm.nameEn.trim()
    ? otherShapes.find(
        (s) => s.id.toLowerCase() === shapeForm.nameEn.trim().toLowerCase()
      )
    : undefined;
  const conflictingShapeByCode = shapeForm.code.trim()
    ? otherShapes.find(
        (s) => s.code.toUpperCase() === shapeForm.code.trim().toUpperCase()
      )
    : undefined;
  const suggestedUniqueShapeCode = suggestAbbreviation(
    shapeForm.nameEn || 'SHAPE',
    otherShapes.map((s) => s.code)
  );

  // Check if saved shapes list already has any duplicate codes (from prior localStorage)
  const duplicateShapeCodes = shapes.filter(
    (sh, idx) =>
      shapes.findIndex(
        (other) => other.code.toUpperCase() === sh.code.toUpperCase()
      ) !== idx
  );

  const handleFixDuplicateShapeCodes = () => {
    const used: string[] = [];
    const fixed = shapes.map((sh) => {
      const upper = sh.code.toUpperCase();
      if (!used.includes(upper)) {
        used.push(upper);
        return sh;
      }
      const nextCode = suggestAbbreviation(sh.id, used);
      used.push(nextCode.toUpperCase());
      return { ...sh, code: nextCode };
    });
    setShapes(fixed);
    saveStoneShapes(fixed);
    showToast('ปรับแก้ตัวย่อรูปทรงที่ซ้ำกันให้ไม่ซ้ำเรียบร้อยแล้ว!');
  };

  const handleSaveShape = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = shapeForm.nameEn.trim() || shapeForm.id.trim();
    const cleanCode = shapeForm.code.trim().toUpperCase();

    if (!cleanId || !cleanCode) {
      alert('กรุณากรอกชื่อทรงหิน และตัวย่อ SKU');
      return;
    }

    const dupName = otherShapes.find(
      (s) => s.id.toLowerCase() === cleanId.toLowerCase()
    );
    if (dupName) {
      alert(`มีรูปทรง "${dupName.label}" อยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น`);
      return;
    }

    const dupCode = otherShapes.find(
      (s) => s.code.toUpperCase() === cleanCode
    );
    if (dupCode) {
      alert(
        `ตัวย่อ SKU "${cleanCode}" ถูกใช้ไปแล้วโดย "${dupCode.label}"\nไม่สามารถใช้ตัวย่อซ้ำกันได้เพราะจะทำให้รหัส SKU ชนกัน (แนะนำให้ใช้ "${suggestedUniqueShapeCode}")`
      );
      return;
    }

    const fullLabel = shapeForm.nameTh.trim()
      ? `${cleanId} (${shapeForm.nameTh.trim()})`
      : cleanId;

    let updatedList: StoneShapeItem[];

    if (editingShape) {
      updatedList = shapes.map((sh) =>
        sh.id === editingShape.id
          ? {
              ...sh,
              id: cleanId,
              code: cleanCode,
              label: fullLabel,
              desc: shapeForm.desc.trim(),
            }
          : sh
      );
      showToast(`แก้ไขทรงหิน ${cleanId} [${cleanCode}] เรียบร้อย!`);
    } else {
      const newItem: StoneShapeItem = {
        id: cleanId,
        code: cleanCode,
        label: fullLabel,
        desc: shapeForm.desc.trim(),
        isDefault: false,
      };
      updatedList = [...shapes, newItem];
      showToast(`เพิ่มทรงหิน ${cleanId} [${cleanCode}] เรียบร้อย!`);
    }

    setShapes(updatedList);
    saveStoneShapes(updatedList);
    setIsAddingShape(false);
    setEditingShape(null);
  };

  const handleDeleteShape = (id: string) => {
    if (shapes.length <= 1) {
      alert('ต้องมีรูปทรงหินอย่างน้อย 1 รายการ');
      return;
    }
    if (confirm(`คุณต้องการลบรูปทรง "${id}" ใช่หรือไม่?`)) {
      const updated = shapes.filter((sh) => sh.id !== id);
      setShapes(updated);
      saveStoneShapes(updated);
      showToast(`ลบรูปทรง ${id} เรียบร้อยแล้ว`);
    }
  };

  const handleResetShapes = () => {
    if (confirm('ต้องการคืนค่ารูปทรงหินทั้งหมดกลับเป็นค่าเริ่มต้น 8 ทรงมาตรฐานใช่หรือไม่?')) {
      const defaults = resetStoneShapes();
      setShapes(defaults);
      showToast('คืนค่ารูปทรงเริ่มต้นเรียบร้อยแล้ว');
    }
  };

  // ----------------------------------------------------
  // STONES HANDLERS
  // ----------------------------------------------------
  const handleOpenAddStone = () => {
    setStoneForm({ id: '', code: '', nameEn: '', nameTh: '' });
    setIsAddingStone(true);
    setEditingStone(null);
  };

  const handleOpenEditStone = (st: StoneTypeItem) => {
    const match = st.label.match(/^(.*?)\s*(?:\((.*?)\))?$/);
    const nameEn = match ? match[1].trim() : st.id;
    const nameTh = match && match[2] ? match[2].trim() : '';

    setStoneForm({
      id: st.id,
      code: st.code,
      nameEn,
      nameTh,
    });
    setEditingStone(st);
    setIsAddingStone(false);
  };

  const handleStoneNameEnChange = (enName: string) => {
    const updated = { ...stoneForm, nameEn: enName, id: enName.trim() };
    if (!editingStone) {
      const existingCodes = stones.map((s) => s.code);
      updated.code = suggestAbbreviation(enName, existingCodes);
    }
    setStoneForm(updated);
  };

  // Real-time duplicate checks for Stone Modal
  const otherStones = stones.filter((s) => s.id !== editingStone?.id);
  const conflictingStoneByName = stoneForm.nameEn.trim()
    ? otherStones.find(
        (s) => s.id.toLowerCase() === stoneForm.nameEn.trim().toLowerCase()
      )
    : undefined;
  const conflictingStoneByCode = stoneForm.code.trim()
    ? otherStones.find(
        (s) => s.code.toUpperCase() === stoneForm.code.trim().toUpperCase()
      )
    : undefined;
  const suggestedUniqueStoneCode = suggestAbbreviation(
    stoneForm.nameEn || 'STONE',
    otherStones.map((s) => s.code)
  );

  // Check if saved stones list already has any duplicate codes (from prior localStorage)
  const duplicateStoneCodes = stones.filter(
    (st, idx) =>
      stones.findIndex(
        (other) => other.code.toUpperCase() === st.code.toUpperCase()
      ) !== idx
  );

  const handleFixDuplicateStoneCodes = () => {
    const used: string[] = [];
    const fixed = stones.map((st) => {
      const upper = st.code.toUpperCase();
      if (!used.includes(upper)) {
        used.push(upper);
        return st;
      }
      const nextCode = suggestAbbreviation(st.id, used);
      used.push(nextCode.toUpperCase());
      return { ...st, code: nextCode };
    });
    setStones(fixed);
    saveStoneTypes(fixed);
    showToast('ปรับแก้ตัวย่อชนิดหินที่ซ้ำกันให้ไม่ซ้ำเรียบร้อยแล้ว!');
  };

  const handleSaveStone = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = stoneForm.nameEn.trim() || stoneForm.id.trim();
    const cleanCode = stoneForm.code.trim().toUpperCase();

    if (!cleanId || !cleanCode) {
      alert('กรุณากรอกชื่อชนิดหิน และตัวย่อ SKU');
      return;
    }

    const dupName = otherStones.find(
      (s) => s.id.toLowerCase() === cleanId.toLowerCase()
    );
    if (dupName) {
      alert(`มีชนิดหิน "${dupName.label}" อยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น`);
      return;
    }

    const dupCode = otherStones.find(
      (s) => s.code.toUpperCase() === cleanCode
    );
    if (dupCode) {
      alert(
        `ตัวย่อ SKU "${cleanCode}" ถูกใช้ไปแล้วโดย "${dupCode.label}"\nไม่สามารถใช้ตัวย่อซ้ำกันได้เพราะจะทำให้รหัส SKU ชนกัน (แนะนำให้ใช้ "${suggestedUniqueStoneCode}")`
      );
      return;
    }

    const fullLabel = stoneForm.nameTh.trim()
      ? `${cleanId} (${stoneForm.nameTh.trim()})`
      : cleanId;

    let updatedList: StoneTypeItem[];

    if (editingStone) {
      updatedList = stones.map((st) =>
        st.id === editingStone.id
          ? {
              ...st,
              id: cleanId,
              code: cleanCode,
              label: fullLabel,
            }
          : st
      );
      showToast(`แก้ไขชนิดหิน ${cleanId} [${cleanCode}] เรียบร้อย!`);
    } else {
      const newItem: StoneTypeItem = {
        id: cleanId,
        code: cleanCode,
        label: fullLabel,
        isDefault: false,
      };
      updatedList = [...stones, newItem];
      showToast(`เพิ่มชนิดหิน ${cleanId} [${cleanCode}] เรียบร้อย!`);
    }

    setStones(updatedList);
    saveStoneTypes(updatedList);
    setIsAddingStone(false);
    setEditingStone(null);
  };

  const handleDeleteStone = (id: string) => {
    if (stones.length <= 1) {
      alert('ต้องมีชนิดหินอย่างน้อย 1 รายการ');
      return;
    }
    if (confirm(`คุณต้องการลบชนิดหิน "${id}" ใช่หรือไม่?`)) {
      const updated = stones.filter((st) => st.id !== id);
      setStones(updated);
      saveStoneTypes(updated);
      showToast(`ลบชนิดหิน ${id} เรียบร้อยแล้ว`);
    }
  };

  const handleResetStones = () => {
    if (confirm('ต้องการคืนค่าชนิดหินทั้งหมดกลับเป็นค่ามาตรฐาน 17 ชนิดใช่หรือไม่?')) {
      const defaults = resetStoneTypes();
      setStones(defaults);
      showToast('คืนค่าชนิดหินเริ่มต้นเรียบร้อยแล้ว');
    }
  };

  // Filtered lists
  const filteredShapes = shapes.filter(
    (s) =>
      s.id.toLowerCase().includes(shapeSearch.toLowerCase()) ||
      s.code.toLowerCase().includes(shapeSearch.toLowerCase()) ||
      s.label.toLowerCase().includes(shapeSearch.toLowerCase())
  );

  const filteredStones = stones.filter(
    (s) =>
      s.id.toLowerCase().includes(stoneSearch.toLowerCase()) ||
      s.code.toLowerCase().includes(stoneSearch.toLowerCase()) ||
      s.label.toLowerCase().includes(stoneSearch.toLowerCase())
  );

  // Compute test SKU
  const matchedTestShape = shapes.find((s) => s.id === testShapeId) || shapes[0];
  const matchedTestStone = stones.find((s) => s.id === testStoneId) || stones[0];
  const testShapeCode = matchedTestShape ? matchedTestShape.code : 'RAW';
  const testStoneCode = matchedTestStone ? matchedTestStone.code : 'CRY';
  const computedSku = `${testShapeCode}-${testStoneCode}-${String(testNumber).padStart(3, '0')}`;

  return (
    <div className="min-h-screen flex flex-col pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-12 bg-slate-50 md:pl-64 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0">
      <Navbar />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold animate-in fade-in slide-in-from-bottom duration-200 border border-slate-700">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <Settings className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                ตั้งค่าระบบ & กฎการสร้าง SKU (Settings)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              เพิ่ม ลด หรือแก้ไขรูปทรงหิน (Shapes), ชนิดหิน (Stone Types) และปรับแต่งตัวย่อ SKU ได้อิสระ
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 sm:inline-flex sm:items-center gap-1.5 p-1.5 bg-slate-200/80 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('shapes')}
            className={`px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 min-w-0 ${
              activeTab === 'shapes'
                ? 'bg-white text-purple-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="truncate">รูปทรงหิน</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 shrink-0">
              {shapes.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('stones')}
            className={`px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 min-w-0 ${
              activeTab === 'stones'
                ? 'bg-white text-purple-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Gem className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="truncate">ชนิดหิน & แร่</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 shrink-0">
              {stones.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tester')}
            className={`px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 min-w-0 ${
              activeTab === 'tester'
                ? 'bg-white text-purple-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="truncate">ทดลองสร้าง SKU</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 min-w-0 ${
              activeTab === 'privacy'
                ? 'bg-white text-purple-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">ซ่อนราคาทุน</span>
            {hideCost && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold shrink-0">
                ON
              </span>
            )}
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: SHAPES                                             */}
        {/* ========================================================= */}
        {activeTab === 'shapes' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="ค้นหารูปทรง หรือตัวย่อ SKU..."
                  value={shapeSearch}
                  onChange={(e) => setShapeSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetShapes}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition"
                  title="คืนค่ารูปทรงเริ่มต้น"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>คืนค่าเริ่มต้น</span>
                </button>

                <button
                  onClick={handleOpenAddShape}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-purple-600/20 hover:from-purple-700 hover:to-indigo-700 transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ เพิ่มรูปทรงใหม่</span>
                </button>
              </div>
            </div>

            {duplicateShapeCodes.length > 0 && (
              <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 text-xs text-rose-900">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">
                      พบตัวย่อรูปทรงซ้ำกัน ({duplicateShapeCodes.map((d) => d.code).join(', ')})
                    </p>
                    <p className="text-rose-700 mt-0.5">
                      ตัวย่อที่ซ้ำกันจะทำให้รหัส SKU ชนกัน กดปุ่มด้านขวาเพื่อแยกตัวย่อให้อัตโนมัติ หรือกดแก้ไขที่การ์ดโดยตรง
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleFixDuplicateShapeCodes}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition shrink-0"
                >
                  ✨ แยกตัวย่อที่ซ้ำอัตโนมัติ
                </button>
              </div>
            )}

            {/* Shapes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredShapes.map((sh, idx) => {
                const dupPartners = shapes.filter(
                  (other) =>
                    other.id !== sh.id &&
                    other.code.toUpperCase() === sh.code.toUpperCase()
                );
                const isDupCode = dupPartners.length > 0;
                return (
                <div
                  key={sh.id}
                  className={`p-4 bg-white rounded-2xl border shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-3 ${
                    isDupCode ? 'border-2 border-rose-400 bg-rose-50/20' : 'border-slate-200/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg border ${
                            isDupCode
                              ? 'bg-rose-100 text-rose-900 border-rose-300'
                              : 'bg-purple-100 text-purple-900 border-purple-200'
                          }`}
                        >
                          {sh.code}
                        </span>
                        {isDupCode && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white">
                            ⚠️ ซ้ำกับ {dupPartners[0].id}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        #{String(idx + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900">{sh.label}</h3>
                    {sh.desc && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{sh.desc}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-[11px] text-slate-400 font-mono">
                      ตัวอย่าง SKU: <strong className="text-purple-700">{sh.code}-AME-001</strong>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditShape(sh)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="แก้ไขรูปทรงนี้"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteShape(sh.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                        title="ลบรูปทรงนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: STONE TYPES                                        */}
        {/* ========================================================= */}
        {activeTab === 'stones' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อชนิดหิน แร่ หรือตัวย่อ SKU..."
                  value={stoneSearch}
                  onChange={(e) => setStoneSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetStones}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition"
                  title="คืนค่าชนิดหินเริ่มต้น"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>คืนค่าเริ่มต้น</span>
                </button>

                <button
                  onClick={handleOpenAddStone}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 hover:from-indigo-700 hover:to-purple-700 transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ เพิ่มชนิดหินใหม่</span>
                </button>
              </div>
            </div>

            {duplicateStoneCodes.length > 0 && (
              <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 text-xs text-rose-900">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">
                      พบตัวย่อชนิดหินซ้ำกัน ({duplicateStoneCodes.map((d) => d.code).join(', ')})
                    </p>
                    <p className="text-rose-700 mt-0.5">
                      ตัวย่อที่ซ้ำกันจะทำให้รหัส SKU ชนกัน กดปุ่มด้านขวาเพื่อแยกตัวย่อให้อัตโนมัติ หรือกดแก้ไขที่การ์ดโดยตรง
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleFixDuplicateStoneCodes}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition shrink-0"
                >
                  ✨ แยกตัวย่อที่ซ้ำอัตโนมัติ
                </button>
              </div>
            )}

            {/* Stones Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredStones.map((st, idx) => {
                const dupPartners = stones.filter(
                  (other) =>
                    other.id !== st.id &&
                    other.code.toUpperCase() === st.code.toUpperCase()
                );
                const isDupCode = dupPartners.length > 0;
                return (
                <div
                  key={st.id}
                  className={`p-4 bg-white rounded-2xl border shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-3 ${
                    isDupCode ? 'border-2 border-rose-400 bg-rose-50/20' : 'border-slate-200/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg border ${
                            isDupCode
                              ? 'bg-rose-100 text-rose-900 border-rose-300'
                              : 'bg-indigo-100 text-indigo-900 border-indigo-200'
                          }`}
                        >
                          {st.code}
                        </span>
                        {isDupCode && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white">
                            ⚠️ ซ้ำกับ {dupPartners[0].id}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        #{String(idx + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900">{st.label}</h3>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-[11px] text-slate-400 font-mono">
                      ตัวอย่าง SKU: <strong className="text-indigo-700">SPH-{st.code}-001</strong>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditStone(st)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="แก้ไขชนิดหินนี้"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteStone(st.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                        title="ลบชนิดหินนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: SKU TESTER                                         */}
        {/* ========================================================= */}
        {activeTab === 'tester' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                ทดลองสร้างรหัส Smart SKU ตามตั้งค่าปัจจุบัน
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                เลือกลองจับคู่รูปทรงและชนิดหิน เพื่อดูว่ารหัส SKU จะถูกสร้างขึ้นมาอย่างไร
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  เลือกรูปทรง (Shape)
                </label>
                <select
                  value={testShapeId}
                  onChange={(e) => setTestShapeId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 font-semibold"
                >
                  {shapes.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      [{sh.code}] {sh.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  เลือกชนิดหิน (Stone Type)
                </label>
                <select
                  value={testStoneId}
                  onChange={(e) => setTestStoneId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  {stones.map((st) => (
                    <option key={st.id} value={st.id}>
                      [{st.code}] {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ลำดับชิ้น (Seq Number)
                </label>
                <input
                  type="number"
                  min="1"
                  value={testNumber}
                  onChange={(e) => setTestNumber(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 font-bold"
                />
              </div>
            </div>

            {/* Computed SKU Display */}
            <div className="p-6 bg-gradient-to-r from-purple-50 via-indigo-50 to-amber-50 rounded-2xl border-2 border-purple-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  รหัส Smart SKU ที่ระบบจะสร้างให้อัตโนมัติ:
                </span>
                <div className="text-3xl sm:text-4xl font-black font-mono tracking-wider text-purple-900">
                  {computedSku}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600 bg-white/80 backdrop-blur p-3 rounded-xl border border-purple-100">
                <div className="text-center">
                  <span className="font-mono font-bold text-purple-700 block text-sm">
                    {testShapeCode}
                  </span>
                  <span className="text-[10px] text-slate-400">รูปทรง</span>
                </div>
                <span className="text-slate-300">-</span>
                <div className="text-center">
                  <span className="font-mono font-bold text-indigo-700 block text-sm">
                    {testStoneCode}
                  </span>
                  <span className="text-[10px] text-slate-400">ชนิดหิน</span>
                </div>
                <span className="text-slate-300">-</span>
                <div className="text-center">
                  <span className="font-mono font-bold text-amber-700 block text-sm">
                    {String(testNumber).padStart(3, '0')}
                  </span>
                  <span className="text-[10px] text-slate-400">ลำดับชิ้น</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: PRIVACY & COST HIDING                              */}
        {/* ========================================================= */}
        {activeTab === 'privacy' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                โหมดความปลอดภัย & ซ่อนราคาทุน (Cost Privacy & Storefront View)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                กำหนดการแสดงผลราคาทุนในระบบ เพื่อความปลอดภัยเมื่อถือจอให้ลูกค้าเลือกชมสินค้าหน้าร้าน
              </p>
            </div>

            {/* Toggle Card */}
            <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 rounded-2xl border-2 border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">
                    เปิดโหมดซ่อนราคาทุนเป็นค่าเริ่มต้น
                  </span>
                  {hideCost ? (
                    <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                      เปิดใช้งานอยู่ (ปลอดภัย)
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-300 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                      ปิดอยู่ (แสดงทุน)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 max-w-xl">
                  เมื่อเปิดใช้งาน ในหน้าคลังสินค้าจะแสดงเฉพาะราคาขาย โดยไม่แสดงราคาทุน และ<strong>ไม่แสดงคำว่า &quot;โหมดลูกค้า&quot; หรือข้อความแจ้งเตือนใดๆ</strong> ให้ลูกค้าทราบ
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !hideCost;
                  setHideCost(next);
                  setHideCostPreference(next);
                  showToast(next ? '🔒 บันทึก: เปิดโหมดซ่อนราคาทุนแล้ว' : '👁️ บันทึก: ปิดโหมดซ่อนราคาทุนแล้ว');
                }}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-sm ${
                  hideCost
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                }`}
              >
                {hideCost ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    <span>ซ่อนราคาทุน (ON)</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>แสดงราคาทุน (OFF)</span>
                  </>
                )}
              </button>
            </div>

            {/* Comparison Preview */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                เปรียบเทียบสิ่งที่แสดงบนหน้าจอ
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer View Preview */}
                <div className="p-4 bg-slate-50 rounded-2xl border-2 border-emerald-300 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      มุมมองที่ลูกค้าเห็น (เมื่อเปิดซ่อนทุน)
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      เนียนตา 100%
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="text-[11px] text-purple-700 font-bold">Azurite</div>
                    <div className="font-bold text-slate-900">Azurite Cabochon #01</div>
                    <div className="p-2 bg-slate-50 rounded-lg flex items-center justify-between font-black text-slate-900">
                      <span className="text-[10px] text-slate-400 font-normal">ราคาขาย</span>
                      <span className="text-sm">฿1,800</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    ✓ แสดงเฉพาะราคาขายปกติ ไม่มีคำว่า &quot;โหมดลูกค้า&quot; หรือข้อความใดๆ ให้ลูกค้ารู้
                  </p>
                </div>

                {/* Owner View Preview */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-purple-600" />
                      มุมมองสำหรับเจ้าของร้าน (เมื่อกดแสดงทุน)
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="text-[11px] text-purple-700 font-bold">Azurite</div>
                    <div className="font-bold text-slate-900">Azurite Cabochon #01</div>
                    <div className="p-2 bg-slate-50 rounded-lg space-y-1">
                      <div className="flex items-center justify-between font-black text-slate-900">
                        <span className="text-[10px] text-slate-400 font-normal">ราคาขาย</span>
                        <span className="text-sm">฿1,800</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
                        <span>ทุน: ฿650</span>
                        <span className="text-amber-700 font-semibold">ต่ำสุด: ฿1,500</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    เจ้าของร้านสามารถกดปุ่มรูปตาที่หัวหน้าจอคลังสินค้า เพื่อสลับดูราคาทุนได้ตลอดเวลา
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL: ADD / EDIT SHAPE                                   */}
        {/* ========================================================= */}
        {(isAddingShape || editingShape) && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[90dvh] sm:max-h-[88dvh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
              {/* Sticky Header */}
              <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-100 bg-white gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 truncate">
                  <Layers className="w-5 h-5 text-purple-600 shrink-0" />
                  <span className="truncate">{editingShape ? 'แก้ไขรูปทรงหิน' : 'เพิ่มรูปทรงหินใหม่'}</span>
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="submit"
                    form="shape-modal-form"
                    disabled={Boolean(conflictingShapeByName || conflictingShapeByCode)}
                    className="px-3.5 py-2 min-h-[38px] text-xs font-bold rounded-xl bg-purple-600 text-white hover:bg-purple-700 active:scale-95 transition shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                  >
                    บันทึก
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingShape(false);
                      setEditingShape(null);
                    }}
                    className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form id="shape-modal-form" onSubmit={handleSaveShape} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ชื่อรูปทรง (อังกฤษ) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น Heart, Pyramid, Moon, Bracelet"
                      value={shapeForm.nameEn}
                      onChange={(e) => handleShapeNameEnChange(e.target.value)}
                      className={`w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl outline-none font-medium ${
                        conflictingShapeByName
                          ? 'bg-rose-50 border-2 border-rose-400 text-rose-900 focus:ring-2 focus:ring-rose-500'
                          : 'bg-slate-50 border border-slate-300 focus:bg-white focus:ring-2 focus:ring-purple-500'
                      }`}
                    />
                    {conflictingShapeByName ? (
                      <span className="text-xs text-rose-600 font-bold mt-1 block">
                        ⚠️ มีรูปทรง &quot;{conflictingShapeByName.label}&quot; อยู่ในระบบแล้ว
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 mt-0.5 block">
                        ใช้เป็น ID อ้างอิง และระบบจะตรวจจับตัวย่อที่ไม่ซ้ำให้อัตโนมัติ
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ชื่อภาษาไทย (ถ้ามี)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ทรงหัวใจ, ทรงปิรามิด, พระจันทร์เสี้ยว"
                      value={shapeForm.nameTh}
                      onChange={(e) => setShapeForm({ ...shapeForm, nameTh: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  {/* SKU Code (Auto or Custom) */}
                  <div
                    className={`p-3.5 rounded-2xl space-y-2 border ${
                      conflictingShapeByCode
                        ? 'bg-rose-50/90 border-2 border-rose-300'
                        : 'bg-purple-50/80 border-purple-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-purple-600" />
                        ตัวย่อสำหรับทำ SKU (ห้ามซ้ำกัน) *
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setShapeForm({
                            ...shapeForm,
                            code: suggestedUniqueShapeCode,
                          })
                        }
                        className="text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-white px-2 py-0.5 rounded-md border border-purple-300 shadow-2xs transition flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        สุ่มตัวย่อไม่ซ้ำ ({suggestedUniqueShapeCode})
                      </button>
                    </div>

                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="เช่น HRT, PYR, MON, BRC"
                      value={shapeForm.code}
                      onChange={(e) =>
                        setShapeForm({ ...shapeForm, code: e.target.value.toUpperCase() })
                      }
                      className={`w-full px-3.5 py-2.5 text-base bg-white rounded-xl outline-none font-mono font-black uppercase ${
                        conflictingShapeByCode
                          ? 'border-2 border-rose-500 text-rose-900 focus:ring-2 focus:ring-rose-500'
                          : 'border border-purple-300 text-purple-900 focus:ring-2 focus:ring-purple-500'
                      }`}
                    />
                    {conflictingShapeByCode ? (
                      <div className="p-2.5 rounded-xl bg-rose-100/90 border border-rose-300 text-xs text-rose-900 space-y-1.5">
                        <p className="font-bold flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            ตัวย่อ &quot;{shapeForm.code.trim().toUpperCase()}&quot; ซ้ำกับ &quot;{conflictingShapeByCode.label}&quot;!
                          </span>
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-rose-700">
                            หากใช้ตัวย่อซ้ำ รหัส SKU จะชนกัน
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setShapeForm({ ...shapeForm, code: suggestedUniqueShapeCode })
                            }
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shrink-0"
                          >
                            ใช้ &quot;{suggestedUniqueShapeCode}&quot; แทน
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] text-purple-700 font-medium pt-1">
                        <span>ตัวอย่าง SKU ที่ได้ (ไม่ซ้ำแน่นอน):</span>
                        <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-purple-200">
                          {shapeForm.code || '???'} - AME - 001
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      คำอธิบาย / วิธีวัดขนาด (ไม่บังคับ)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="เช่น หินเจียรูปหัวใจ ขนาดกว้าง x ยาว x หนา..."
                      value={shapeForm.desc}
                      onChange={(e) => setShapeForm({ ...shapeForm, desc: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>

                {/* Pinned Sticky Footer */}
                <div className="shrink-0 px-5 sm:px-6 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-slate-200 bg-white flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingShape(false);
                      setEditingShape(null);
                    }}
                    className="flex-1 sm:flex-initial px-4 py-3 sm:py-2.5 min-h-[46px] rounded-2xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(conflictingShapeByName || conflictingShapeByCode)}
                    className="flex-[2] sm:flex-initial px-5 py-3 sm:py-2.5 min-h-[46px] rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold shadow-md shadow-purple-600/20 hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {editingShape ? 'บันทึกการแก้ไข' : 'เพิ่มรูปทรง'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL: ADD / EDIT STONE                                   */}
        {/* ========================================================= */}
        {(isAddingStone || editingStone) && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[90dvh] sm:max-h-[88dvh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
              {/* Sticky Header */}
              <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-100 bg-white gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 truncate">
                  <Gem className="w-5 h-5 text-indigo-600 shrink-0" />
                  <span className="truncate">{editingStone ? 'แก้ไขชนิดหิน & แร่' : 'เพิ่มชนิดหินใหม่'}</span>
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="submit"
                    form="stone-modal-form"
                    disabled={Boolean(conflictingStoneByName || conflictingStoneByCode)}
                    className="px-3.5 py-2 min-h-[38px] text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                  >
                    บันทึก
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingStone(false);
                      setEditingStone(null);
                    }}
                    className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form id="stone-modal-form" onSubmit={handleSaveStone} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ชื่อชนิดหิน (อังกฤษ) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น Larimar, Super Seven, Danburite, Kyanite"
                      value={stoneForm.nameEn}
                      onChange={(e) => handleStoneNameEnChange(e.target.value)}
                      className={`w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl outline-none font-medium ${
                        conflictingStoneByName
                          ? 'bg-rose-50 border-2 border-rose-400 text-rose-900 focus:ring-2 focus:ring-rose-500'
                          : 'bg-slate-50 border border-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-500'
                      }`}
                    />
                    {conflictingStoneByName ? (
                      <span className="text-xs text-rose-600 font-bold mt-1 block">
                        ⚠️ มีชนิดหิน &quot;{conflictingStoneByName.label}&quot; อยู่ในระบบแล้ว
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 mt-0.5 block">
                        ระบบจะตรวจจับตัวย่อที่ไม่ซ้ำกับหินอื่นให้อัตโนมัติ หรือจะพิมพ์เองก็ได้
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ชื่อภาษาไทย (ถ้ามี)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ลาริมาร์, ซุปเปอร์เซเว่น, แดนบูไรต์"
                      value={stoneForm.nameTh}
                      onChange={(e) => setStoneForm({ ...stoneForm, nameTh: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {/* SKU Code (Auto or Custom) */}
                  <div
                    className={`p-3.5 rounded-2xl space-y-2 border ${
                      conflictingStoneByCode
                        ? 'bg-rose-50/90 border-2 border-rose-300'
                        : 'bg-indigo-50/80 border-indigo-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-600" />
                        ตัวย่อชนิดหินสำหรับ SKU (ห้ามซ้ำกัน) *
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setStoneForm({
                            ...stoneForm,
                            code: suggestedUniqueStoneCode,
                          })
                        }
                        className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-white px-2 py-0.5 rounded-md border border-indigo-300 shadow-2xs transition flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        สุ่มตัวย่อไม่ซ้ำ ({suggestedUniqueStoneCode})
                      </button>
                    </div>

                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="เช่น LAR, SP7, DAN, KYA"
                      value={stoneForm.code}
                      onChange={(e) =>
                        setStoneForm({ ...stoneForm, code: e.target.value.toUpperCase() })
                      }
                      className={`w-full px-3.5 py-2.5 text-base bg-white rounded-xl outline-none font-mono font-black uppercase ${
                        conflictingStoneByCode
                          ? 'border-2 border-rose-500 text-rose-900 focus:ring-2 focus:ring-rose-500'
                          : 'border border-indigo-300 text-indigo-900 focus:ring-2 focus:ring-indigo-500'
                      }`}
                    />
                    {conflictingStoneByCode ? (
                      <div className="p-2.5 rounded-xl bg-rose-100/90 border border-rose-300 text-xs text-rose-900 space-y-1.5">
                        <p className="font-bold flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            ตัวย่อ &quot;{stoneForm.code.trim().toUpperCase()}&quot; ซ้ำกับ &quot;{conflictingStoneByCode.label}&quot;!
                          </span>
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-rose-700">
                            หากใช้ตัวย่อซ้ำ รหัส SKU จะชนกัน
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setStoneForm({ ...stoneForm, code: suggestedUniqueStoneCode })
                            }
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shrink-0"
                          >
                            ใช้ &quot;{suggestedUniqueStoneCode}&quot; แทน
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] text-indigo-700 font-medium pt-1">
                        <span>ตัวอย่าง SKU ที่ได้ (ไม่ซ้ำแน่นอน):</span>
                        <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-indigo-200">
                          SPH - {stoneForm.code || '???'} - 001
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pinned Sticky Footer */}
                <div className="shrink-0 px-5 sm:px-6 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-slate-200 bg-white flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingStone(false);
                      setEditingStone(null);
                    }}
                    className="flex-1 sm:flex-initial px-4 py-3 sm:py-2.5 min-h-[46px] rounded-2xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(conflictingStoneByName || conflictingStoneByCode)}
                    className="flex-[2] sm:flex-initial px-5 py-3 sm:py-2.5 min-h-[46px] rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold shadow-md shadow-indigo-600/20 hover:from-indigo-700 hover:to-purple-700 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {editingStone ? 'บันทึกการแก้ไข' : 'เพิ่มชนิดหิน'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
