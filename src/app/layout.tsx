import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crystal & Mineral Inventory System | สต็อกร้านหินและบันทึกค่าใช้จ่าย',
  description: 'ระบบจัดการสต็อกร้านหินมงคล หินสวยงาม แร่ธรรมชาติ บันทึกค่าใช้จ่าย พร้อมอัปโหลดรูปขึ้น Cloudflare R2 บีบอัดเป็น WebP อัตโนมัติ',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
