'use client';

import React from 'react';

interface SoldOutSashProps {
  label: 'ขายแล้ว' | 'หมดแล้ว' | 'แตกเสียหาย';
}

export default function SoldOutSash({ label }: SoldOutSashProps) {
  const displayWord = label === 'แตกเสียหาย' ? 'DAMAGED' : 'SOLD';

  return (
    <div className="pointer-events-none absolute inset-0 backdrop-blur-[3px] bg-white/50 flex items-center justify-center z-10">
      <span className="text-2xl sm:text-3xl font-semibold tracking-[0.22em] text-zinc-900 select-none">
        {displayWord}
      </span>
    </div>
  );
}
