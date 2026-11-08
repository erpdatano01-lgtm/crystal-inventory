import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vivida Crystal | ระบบบริหารจัดการสต็อกหินและบัญชี',
  description: 'ระบบจัดการสต็อกร้านหินมงคล คริสตัล แร่ธรรมชาติ Vivida Crystal บันทึกค่าใช้จ่าย เปิดบิลขาย และพิมพ์ใบเสร็จ',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="bg-slate-50 text-slate-900 antialiased selection:bg-purple-200 selection:text-purple-900">
        {children}
      </body>
    </html>
  );
}
