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
  Video,
  CornerDownRight,
  Gift,
  Box,
  Megaphone,
  Lock,
  Layers,
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import GoogleSheetsModal from '@/components/GoogleSheetsModal';

interface NavItem {
  href: string;
  label: string;
  mobileLabel: string;
  sublabel: string;
  badge?: string;
  icon: any;
  isSubItem?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

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

  const navSections: NavSection[] = [
    {
      title: 'ภาพรวมระบบ',
      items: [
        {
          href: '/',
          label: 'ภาพรวม',
          mobileLabel: 'ภาพรวม',
          sublabel: 'Dashboard สรุปผล',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: 'คลังสินค้า (Inventory)',
      items: [
        {
          href: '/products',
          label: 'คลังหิน & คริสตัล',
          mobileLabel: 'คลังหิน',
          sublabel: 'รายการหินทั้งหมดในคลัง',
          icon: PackageCheck,
        },
        {
          href: '/products/new',
          label: 'รับหินเข้าสต็อก',
          mobileLabel: 'รับเข้า',
          sublabel: 'ลงทะเบียน & บาร์โค้ด',
          icon: PlusCircle,
          isSubItem: true,
        },
        {
          href: '/settings',
          label: 'ตั้งค่าระบบรับหิน',
          mobileLabel: 'ตั้งค่า',
          sublabel: 'ชนิดหิน, รูปทรง, รหัส SKU',
          icon: Settings,
          isSubItem: true,
        },
        {
          href: '/stone-freebies',
          label: 'คลังหินของแถม',
          mobileLabel: 'หินของแถม',
          sublabel: 'หินกลิ้ง, หินดิบ & หินแถมลูกค้า',
          icon: Gem,
        },
        {
          href: '/freebies',
          label: 'คลังของแถม',
          mobileLabel: 'ของแถม',
          sublabel: 'โมเดลแมว, แม่เหล็ก & ของแจก',
          icon: Gift,
        },
        {
          href: '/packaging',
          label: 'คลังแพ็คเกจจิ้ง',
          mobileLabel: 'แพ็คเกจ',
          sublabel: 'กล่องพัสดุ, ถุงซิป & การ์ด',
          icon: Box,
        },
        {
          href: '/stands',
          label: 'คลังขาตั้ง & ฐานวาง',
          mobileLabel: 'ขาตั้ง',
          sublabel: 'ฐานลูกแก้ว, ขาตั้งอะคริลิค',
          icon: Layers,
        },
      ],
    },
    {
      title: 'การขาย & จัดส่ง',
      items: [
        {
          href: '/campaigns',
          label: 'จัดชุดขาย & Ads',
          mobileLabel: 'ชุดขาย/Ads',
          sublabel: 'แยกกลุ่มถ่าย & คละค่า Ads',
          icon: Megaphone,
        },
        {
          href: '/orders',
          label: 'เปิดบิล & บัญชี',
          mobileLabel: 'เปิดบิล',
          sublabel: 'FlowAccount Orders',
          icon: ShoppingBag,
        },
        {
          href: '/packing',
          label: 'อัดคลิปแพ็กของ',
          mobileLabel: 'แพ็กของ',
          sublabel: 'สแกนใบปะหน้า & เช็กของ',
          icon: Video,
        },
      ],
    },
    {
      title: 'ต้นทุน & บัญชีรายจ่าย',
      items: [
        {
          href: '/expenses',
          label: 'ค่าใช้จ่าย & ล็อต',
          mobileLabel: 'รายจ่าย',
          sublabel: 'Expenses & Lots',
          icon: Receipt,
        },
      ],
    },
  ];

  const flatNavLinks = navSections.flatMap((section) => section.items);

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
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 bg-white border-r border-zinc-200 z-40 select-none">
        {/* Brand Header */}
        <div className="px-5 py-5 border-b border-zinc-100">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0">
              <Gem className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold tracking-tight text-zinc-900 truncate">
                Vivida Crystal
              </h1>
              <p className="text-[11px] text-zinc-400 truncate">
                คลังหิน &amp; บัญชี
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Links (Grouped Sections) */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {section.title && (
                <div className="px-3 pb-1 text-[10px] font-medium tracking-wider text-zinc-400 uppercase">
                  {section.title}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-[13px] transition group ${
                        link.isSubItem ? 'ml-4 pl-2.5' : ''
                      } ${
                        isActive
                          ? 'bg-zinc-900 text-white font-medium'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/80 font-normal'
                      }`}
                    >
                      {link.isSubItem && (
                        <CornerDownRight
                          className={`w-3.5 h-3.5 shrink-0 -mr-0.5 ${
                            isActive
                              ? 'text-zinc-400'
                              : 'text-zinc-400 group-hover:text-zinc-700'
                          }`}
                        />
                      )}
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive
                            ? 'text-white'
                            : 'text-zinc-400 group-hover:text-zinc-700'
                        }`}
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate leading-tight">{link.label}</span>
                          {link.badge && (
                            <span
                              className={`text-[9px] font-medium px-1.5 py-0.2 rounded shrink-0 ${
                                isActive
                                  ? 'bg-white/15 text-white'
                                  : 'bg-zinc-100 text-zinc-600'
                              }`}
                            >
                              {link.badge}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer Utilities */}
        <div className="p-4 border-t border-zinc-100 space-y-2">
          {/* Google Sheets Sync Button */}
          <button
            type="button"
            onClick={() => setShowSheetsModal(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 font-medium text-xs transition"
            title="เชื่อมต่อ Google Sheets ดึงข้อมูลสด"
          >
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>Google Sheets</span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">SYNC</span>
          </button>

          {/* Cloud Status Badge */}
          {mounted && (
            <div
              suppressHydrationWarning
              className="flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] text-zinc-500 border border-zinc-100 bg-zinc-50/70"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isCloudConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span className="truncate">
                  {isCloudConnected ? 'Cloud Online' : 'Local Mode'}
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={async () => {
              await fetch('/api/auth/passcode', { method: 'DELETE' });
              window.location.href = '/login';
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-200/80 transition"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>ล็อคหน้าเว็บ</span>
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MOBILE TOP BAR (md:hidden)                             */}
      {/* ========================================================= */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-white/95 backdrop-blur border-b border-zinc-200 z-40 px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center">
            <Gem className="w-4 h-4" />
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

            <nav className="flex-1 space-y-3 overflow-y-auto">
              {navSections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-1">
                  {section.title && (
                    <div className="px-2 pt-1 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      {section.title}
                    </div>
                  )}
                  <div className="space-y-1">
                    {section.items.map((link) => {
                      const Icon = link.icon;
                      const isActive = pathname === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                            link.isSubItem ? 'ml-4 pl-2.5' : ''
                          } ${
                            isActive
                              ? 'bg-purple-600 text-white font-bold shadow-md'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {link.isSubItem && (
                            <CornerDownRight
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isActive ? 'text-purple-200' : 'text-slate-400'
                              }`}
                            />
                          )}
                          <Icon className="w-4 h-4 shrink-0" />
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate">{link.label}</span>
                              {link.badge && (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                                    isActive
                                      ? 'bg-white/20 text-white'
                                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                                  }`}
                                >
                                  {link.badge}
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-normal truncate ${
                                isActive ? 'text-purple-200' : 'text-slate-400'
                              }`}
                            >
                              {link.sublabel}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
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
        <div className="grid grid-cols-8 h-16 px-0.5">
          {flatNavLinks
            .filter((l) => l.href !== '/settings')
            .map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-0 px-0.5 transition ${
                  isActive
                    ? 'text-purple-600 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-[9px] leading-tight text-center truncate w-full">
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
