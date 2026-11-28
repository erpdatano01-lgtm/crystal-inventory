'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Gem, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';

  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setErrorMsg('กรุณากรอกรหัสผ่าน');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'รหัสผ่านไม่ถูกต้อง');
        setLoading(false);
        return;
      }

      router.replace(nextPath.startsWith('/') ? nextPath : '/');
      router.refresh();
    } catch {
      setErrorMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-5">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="p-7 sm:p-8 space-y-6">
          {/* Minimal Brand Header */}
          <div className="text-center space-y-3">
            <div className="w-11 h-11 rounded-xl bg-zinc-900 text-white flex items-center justify-center mx-auto">
              <Gem className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
                Vivida Crystal
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                เข้าสู่ระบบจัดการคลังและบัญชี
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>รหัสผ่าน</span>
              </label>

              <div className="relative">
                <input
                  type={showPasscode ? 'text' : 'password'}
                  inputMode="numeric"
                  autoFocus
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full pl-4 pr-11 py-3 text-base font-mono font-medium tracking-widest bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:border-zinc-900 text-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-700 transition"
                  aria-label="แสดง/ซ่อนรหัสผ่าน"
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-3 border-t border-zinc-100 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            <span>จำสถานะการเข้าสู่ระบบ 30 วัน</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fafafa] flex items-center justify-center text-zinc-500 text-sm">
          กำลังโหลด...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
