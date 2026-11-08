'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Gem,
  PackageCheck,
  ShoppingBag,
  Receipt,
  LayoutDashboard,
  PlusCircle,
  FileSpreadsheet,
  Menu,
  X,
  Sparkles,
  Settings,
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import GoogleSheetsModal from '@/components/GoogleSheetsModal';

export default function Navbar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    {
      href: '/',
      label: 'ภาพรวม',
      mobileLabel: 'ภาพรวม',
      sublabel: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      href: '/products',
      label: 'คลังสินค้า',
      mobileLabel: 'คลังหิน',
      sublabel: 'Products & Stones',
      icon: PackageCheck,
    },
    {
      href: '/products/new',
      label: 'รับหินเข้าสต็อก',
      mobileLabel: 'เพิ่มหิน',
      sublabel: 'New Stock Entry',
      icon: PlusCircle,
    },
    {
      href: '/orders',
      label: 'เปิดบิล & บัญชี',
      mobileLabel: 'เปิดบิล',
      sublabel: 'FlowAccount Orders',
      icon: ShoppingBag,
    },
    {
      href: '/expenses',
      label: 'ค่าใช้จ่าย & ล็อต',
      mobileLabel: 'รายจ่าย',
      sublabel: 'Expenses & Lots',
      icon: Receipt,
    },
    {
      href: '/settings',
      label: 'ตั้งค่าระบบ',
      mobileLabel: 'ตั้งค่า',
      sublabel: 'SKU, ทรง & ชนิดหิน',
      icon: Settings,
    },
  ];

  // Client-safe check based on NEXT_PUBLIC_ variables
  const isCloudConnected = Boolean(
    isSupabaseConfigured &&
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL &&
    !process.env.NEXT_PUBLIC_R2_PUBLIC_URL.includes('pub-xxxx')
  );

  return (
    <>
      {/* ========================================================= */}
      {/* 1. DESKTOP LEFT SIDEBAR (md:fixed md:w-64)                */}
      {/* ========================================================= */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 bg-white border-r border-slate-200 z-40 select-none">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-400 p-0.5 shadow-md shadow-purple-500/20 group-hover:scale-105 transition shrink-0">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
                <Gem className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-black tracking-tight text-slate-900 truncate">
                  Vivida Crystal
                </h1>
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 shrink-0">
                  Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                ระบบคลังหิน & บัญชี
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Links (Vertical Left Stack) */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            เมนูหลัก (Navigation)
          </div>

          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition group ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-slate-400 group-hover:text-purple-600 group-hover:bg-purple-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="truncate leading-tight">{link.label}</span>
                  <span
                    className={`text-[10px] font-normal leading-tight ${
                      isActive ? 'text-purple-200' : 'text-slate-400'
                    }`}
                  >
                    {link.sublabel}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Utilities */}
        <div className="p-4 border-t border-slate-100 space-y-2.5 bg-slate-50/50">
          {/* Google Sheets Sync Button */}
          <button
            type="button"
            onClick={() => setShowSheetsModal(true)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200/90 hover:bg-emerald-100 font-semibold text-xs transition active:scale-95 shadow-xs"
            title="เชื่อมต่อ Google Sheets ดึงข้อมูลสด"
          >
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Google Sheets Sync</span>
            </div>
            <span className="text-[10px] bg-emerald-200/60 text-emerald-900 px-1.5 py-0.5 rounded font-mono font-bold">
              LIVE
            </span>
          </button>

          {/* Cloud Status Badge */}
          {mounted && (
            <div
              suppressHydrationWarning
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-medium border ${
                isCloudConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isCloudConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="truncate">
                  {isCloudConnected ? 'Supabase & R2 Online' : 'โหมดจำลอง (Local)'}
                </span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {isCloudConnected ? 'Cloud' : 'Demo'}
              </span>
            </div>
          )}

          <div className="text-center pt-1">
            <span className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Vivida Crystal ERP
            </span>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MOBILE TOP BAR (md:hidden)                             */}
      {/* ========================================================= */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-white/95 backdrop-blur border-b border-slate-200 z-40 px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-amber-400 p-0.5 shadow-sm">
            <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
              <Gem className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h1 className="text-sm font-black text-slate-900">Vivida Crystal</h1>
              <span className="text-[8px] font-bold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800">
                Pro
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">ระบบคลังหิน & บัญชี</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSheetsModal(true)}
            className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold"
            title="Google Sheets"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            aria-label="Open Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 3. MOBILE DRAWER OVERLAY (md:hidden)                      */}
      {/* ========================================================= */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-72 max-w-[85%] bg-white h-full shadow-2xl flex flex-col p-5 space-y-4 animate-in slide-in-from-left duration-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Gem className="w-5 h-5 text-purple-600" />
                <span className="font-black text-slate-900">Vivida Crystal</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1.5 overflow-y-auto">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition ${
                      isActive
                        ? 'bg-purple-600 text-white font-bold shadow-md'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowSheetsModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Google Sheets Sync</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. MOBILE BOTTOM NAVIGATION (md:hidden)                   */}
      {/* ========================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 pb-safe">
        <div className="grid grid-cols-6 h-16 px-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center gap-1 min-w-0 px-0.5 transition ${
                  isActive
                    ? 'text-purple-600 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] leading-tight text-center truncate w-full">
                  {link.mobileLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Google Sheets Integration Modal */}
      <GoogleSheetsModal
        isOpen={showSheetsModal}
        onClose={() => setShowSheetsModal(false)}
      />
    </>
  );
}
