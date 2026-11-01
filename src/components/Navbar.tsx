'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Gem,
  PackageCheck,
  Receipt,
  LayoutDashboard,
  PlusCircle,
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function Navbar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navLinks = [
    { href: '/', label: 'ภาพรวม (Dashboard)', icon: LayoutDashboard },
    { href: '/products', label: 'คลังสินค้า (Products)', icon: PackageCheck },
    { href: '/products/new', label: '+ รับหินเข้าสต็อก', icon: PlusCircle },
    { href: '/expenses', label: 'ค่าใช้จ่าย & เปิดล็อต', icon: Receipt },
  ];

  // Client-safe check based on NEXT_PUBLIC_ variables
  const isCloudConnected = Boolean(
    isSupabaseConfigured &&
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL &&
    !process.env.NEXT_PUBLIC_R2_PUBLIC_URL.includes('pub-xxxx')
  );

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-400 p-0.5 shadow-md shadow-purple-500/20 group-hover:scale-105 transition">
                <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                  <Gem className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                  Crystal & Mineral
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    Pro
                  </span>
                </h1>
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  ระบบสต็อกหินและบันทึกค่าใช้จ่าย
                </p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1.5">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition ${
                      isActive
                        ? 'bg-purple-100/70 text-purple-800 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Status Indicator & Quick CTA */}
            <div className="flex items-center gap-2.5">
              {/* Cloud Connection Badge (Hydration-safe) */}
              {mounted && (
                <div
                  suppressHydrationWarning
                  className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                    isCloudConnected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                  title={
                    isCloudConnected
                      ? 'เชื่อมต่อ Supabase & Cloudflare R2 สำเร็จ'
                      : 'โหมดสาธิตในเครื่อง (เชื่อมต่อ .env.local เพื่อบันทึกลง Cloud)'
                  }
                >
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  <span>
                    {isCloudConnected ? 'Cloud Connected' : 'Demo Mode'}
                  </span>
                </div>
              )}

              <Link
                href="/products/new"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20 hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition font-semibold text-xs sm:text-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ รับหินเข้าสต็อก</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 pb-safe">
        <div className="grid grid-cols-4 h-16">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center gap-1 transition ${
                  isActive
                    ? 'text-purple-600 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] leading-tight text-center">
                  {link.label.replace('+ ', '')}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
