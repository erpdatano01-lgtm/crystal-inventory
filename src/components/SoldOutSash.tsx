'use client';

import React from 'react';

interface SoldOutSashProps {
  label: 'ขายแล้ว' | 'หมดแล้ว' | 'แตกเสียหาย';
}

export default function SoldOutSash({ label }: SoldOutSashProps) {
  return (
    <div className="pointer-events-none absolute inset-0 bg-white/40 flex items-center justify-center overflow-hidden z-10">
      <div className="w-[140%] -rotate-12 bg-zinc-900/90 text-white text-center py-1.5 text-[11px] font-semibold tracking-widest border-y border-white/20">
        {label}
      </div>
    </div>
  );
}
