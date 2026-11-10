'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { StoneTypeItem, suggestAbbreviation } from '@/lib/settingsService';
import { Gem, Search, ChevronDown, Check, Plus, X, Sparkles } from 'lucide-react';

export interface StoneTypeComboboxProps {
  value: string; // The stone_type id / name e.g. 'Amethyst'
  onChange: (value: string, selectedItem?: StoneTypeItem) => void;
  stones: StoneTypeItem[];
  onAddNewStone?: (newStone: StoneTypeItem) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export default function StoneTypeCombobox({
  value,
  onChange,
  stones,
  onAddNewStone,
  disabled = false,
  className = '',
  placeholder = 'พิมพ์ชื่อหิน (เช่น Amethyst, มอส, AME)...',
}: StoneTypeComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Find the selected stone object from stones list
  const selectedStone = useMemo(() => {
    if (!value) return null;
    const vLower = value.toLowerCase().trim();
    return stones.find(
      (s) => s.id.toLowerCase() === vLower || s.label.toLowerCase() === vLower
    ) || null;
  }, [stones, value]);

  // Filter stones based on user input (checks English ID, Thai Label, and SKU Code)
  const filteredStones = useMemo(() => {
    if (!searchQuery.trim()) return stones;
    const q = searchQuery.toLowerCase().trim();
    return stones.filter((s) => {
      const matchId = s.id.toLowerCase().includes(q);
      const matchLabel = s.label.toLowerCase().includes(q);
      const matchCode = s.code.toLowerCase().includes(q);
      return matchId || matchLabel || matchCode;
    });
  }, [stones, searchQuery]);

  // Check if search query exactly matches an existing stone
  const exactMatch = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null;
    return stones.find(
      (s) =>
        s.id.toLowerCase() === q ||
        s.code.toLowerCase() === q ||
        s.label.toLowerCase() === q
    );
  }, [stones, searchQuery]);

  // Allow adding a new stone if user typed something new
  const canAddNew = Boolean(searchQuery.trim().length >= 2 && !exactMatch);

  // Total items in list (filtered stones + 1 if can add new)
  const totalOptions = filteredStones.length + (canAddNew ? 1 : 0);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
        setHighlightIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightIndex >= 0 && listRef.current) {
      const itemElement = listRef.current.children[highlightIndex] as HTMLElement;
      if (itemElement) {
        itemElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex, isOpen]);

  const handleSelectStone = (item: StoneTypeItem) => {
    onChange(item.id, item);
    setSearchQuery('');
    setIsOpen(false);
    setHighlightIndex(-1);
  };

  const handleAddNewStone = () => {
    const raw = searchQuery.trim();
    if (!raw) return;

    const existingCodes = stones.map((s) => s.code);
    const suggestedCode = suggestAbbreviation(raw, existingCodes) || 'CRY';

    // Format clean display name
    const cleanId = raw
      .split(' ')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
      .join(' ')
      .trim();

    const newStone: StoneTypeItem = {
      id: cleanId,
      code: suggestedCode,
      label: `${cleanId} (${raw})`,
    };

    onAddNewStone?.(newStone);
    onChange(newStone.id, newStone);
    setSearchQuery('');
    setIsOpen(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < totalOptions - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : totalOptions - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < filteredStones.length) {
        handleSelectStone(filteredStones[highlightIndex]);
      } else if (highlightIndex === filteredStones.length && canAddNew) {
        handleAddNewStone();
      } else if (filteredStones.length === 1) {
        handleSelectStone(filteredStones[0]);
      } else if (canAddNew && filteredStones.length === 0) {
        handleAddNewStone();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery('');
      setHighlightIndex(-1);
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setHighlightIndex(-1);
  };

  // What to display inside the input box
  const inputValue = isOpen
    ? searchQuery
    : selectedStone
    ? `${selectedStone.label} [${selectedStone.code}]`
    : value || '';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Box */}
      <div
        className={`relative flex items-center bg-white border rounded-xl transition shadow-sm ${
          isOpen
            ? 'border-purple-600 ring-2 ring-purple-100 shadow-md'
            : 'border-purple-300 hover:border-purple-400'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
      >
        <div className="pl-3.5 pr-2 flex items-center pointer-events-none text-purple-600">
          <Gem className="w-4 h-4 shrink-0" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          disabled={disabled}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setHighlightIndex(-1);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="w-full h-11 text-base sm:text-sm bg-transparent outline-none font-semibold text-purple-950 placeholder:text-slate-400 placeholder:font-normal pr-16"
        />

        {/* Clear & Dropdown Actions */}
        <div className="absolute right-2 flex items-center gap-0.5">
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              title="ล้างข้อความค้นหา"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (!disabled) {
                setIsOpen((prev) => !prev);
                inputRef.current?.focus();
              }
            }}
            className="p-1.5 text-purple-600 hover:text-purple-800 rounded-lg hover:bg-purple-50 transition"
            title="เปิดรายการชนิดหิน"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-purple-700' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-purple-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header Search Info */}
          <div className="px-3.5 py-2 bg-purple-50/70 border-b border-purple-100 flex items-center justify-between text-[11px] text-purple-900 font-semibold">
            <span className="flex items-center gap-1.5">
              <Search className="w-3 h-3 text-purple-600" />
              {searchQuery ? `ผลการค้นหา: "${searchQuery}"` : 'เลือกหรือพิมพ์ค้นหาชนิดหิน'}
            </span>
            <span className="text-[10px] bg-purple-200/70 text-purple-800 px-2 py-0.5 rounded-full font-bold">
              {filteredStones.length} ชนิด
            </span>
          </div>

          {/* List Options */}
          <div
            ref={listRef}
            className="max-h-64 overflow-y-auto divide-y divide-slate-100 py-1"
          >
            {filteredStones.map((stone, idx) => {
              const isSelected =
                selectedStone?.id === stone.id ||
                value.toLowerCase().trim() === stone.id.toLowerCase();
              const isHighlighted = highlightIndex === idx;

              return (
                <div
                  key={stone.id}
                  onClick={() => handleSelectStone(stone)}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between text-xs transition ${
                    isHighlighted
                      ? 'bg-purple-100/70 text-purple-950 font-bold'
                      : isSelected
                      ? 'bg-purple-50 text-purple-900 font-semibold'
                      : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                        isSelected
                          ? 'bg-purple-600 text-white'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {stone.code.slice(0, 2)}
                    </div>
                    <div className="truncate">
                      <span className="font-semibold text-slate-900 block truncate">
                        {stone.label}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        ID: {stone.id}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[11px] font-extrabold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      [{stone.code}]
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-purple-600 shrink-0 font-bold" />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Option to Add New Stone Type on the fly */}
            {canAddNew && (
              <div
                onClick={handleAddNewStone}
                onMouseEnter={() => setHighlightIndex(filteredStones.length)}
                className={`p-3 cursor-pointer bg-gradient-to-r from-amber-50 to-purple-50 border-t border-amber-200/60 flex items-center justify-between text-xs transition ${
                  highlightIndex === filteredStones.length
                    ? 'ring-2 ring-inset ring-purple-400 bg-purple-100/90'
                    : 'hover:bg-purple-100/50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-purple-950 flex items-center gap-1.5 truncate">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      ใช้เป็นชนิดหินใหม่: &quot;{searchQuery.trim()}&quot;
                    </div>
                    <div className="text-[10px] text-slate-600 truncate">
                      ระบบจะสร้างรหัส SKU ให้อัตโนมัติ ({suggestAbbreviation(searchQuery.trim(), stones.map((s) => s.code)) || 'CRY'})
                    </div>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-purple-700 bg-purple-200/80 px-2 py-1 rounded-lg">
                  กดเพื่อเลือก
                </span>
              </div>
            )}

            {filteredStones.length === 0 && !canAddNew && (
              <div className="py-6 px-4 text-center text-xs text-slate-500">
                <Gem className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                ไม่พบชนิดหินที่ตรงกับคำค้นหา
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
