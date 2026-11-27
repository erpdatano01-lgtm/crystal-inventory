'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Order, SALES_CHANNELS_CONFIG } from '@/types';
import { encodeCode128B, generateBarcodeSvgString } from '@/lib/barcodeGenerator';
import {
  Printer,
  X,
  Gem,
  Truck,
  Phone,
  MapPin,
  QrCode,
  Barcode,
  Video,
  Package,
  Gift,
  CheckSquare,
  Sparkles,
  FileText,
  Download,
} from 'lucide-react';

interface ShippingLabelModalProps {
  order: Order | null;
  onClose: () => void;
  onSwitchToReceipt?: (order: Order) => void;
}

type LabelFormat = '100x150' | '50x50' | '50x30';
type QrPayloadMode = 'order_no' | 'packing_url';

export default function ShippingLabelModal({
  order,
  onClose,
  onSwitchToReceipt,
}: ShippingLabelModalProps) {
  const [labelFormat, setLabelFormat] = useState<LabelFormat>('100x150');
  const [qrMode, setQrMode] = useState<QrPayloadMode>('order_no');
  const [senderPhone, setSenderPhone] = useState('08x-xxx-xxxx');
  const [isDownloading, setIsDownloading] = useState(false);

  const encodedOrderBarcode = useMemo(() => {
    if (!order) return null;
    return encodeCode128B(order.order_no);
  }, [order]);

  const encodedTrackingBarcode = useMemo(() => {
    if (!order?.tracking_no) return null;
    return encodeCode128B(order.tracking_no);
  }, [order]);

  if (!order) return null;

  // Separate main stone items vs freebies (strictly SKU starting with GIFT)
  const mainItems = order.items.filter((i) => !i.sku?.startsWith('GIFT'));
  const giftItems = order.items.filter((i) => Boolean(i.sku?.startsWith('GIFT')));
  const totalMainQty = mainItems.reduce((sum, i) => sum + (i.qty || 1), 0);
  const totalGiftQty = giftItems.reduce((sum, i) => sum + (i.qty || 1), 0);
  const totalAllQty = totalMainQty + totalGiftQty;

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://crystal-inventory.vercel.app';
  const qrDataString =
    qrMode === 'packing_url'
      ? `${origin}/packing?order_no=${encodeURIComponent(order.order_no)}`
      : order.order_no;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?format=svg&size=240x240&margin=0&data=${encodeURIComponent(
    qrDataString
  )}`;

  const loadQrImage = async (): Promise<HTMLImageElement | null> => {
    try {
      const res = await fetch(qrImageUrl);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(objUrl);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(objUrl);
          resolve(null);
        };
        img.src = objUrl;
      });
    } catch {
      return null;
    }
  };

  const handleDownloadLabelPng = async () => {
    setIsDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // High-DPI dimensions matching labelFormat
      const sizeMap: Record<LabelFormat, { w: number; h: number }> = {
        '100x150': { w: 1000, h: 1500 },
        '50x50': { w: 700, h: 700 },
        '50x30': { w: 750, h: 450 },
      };
      const { w, h } = sizeMap[labelFormat];
      canvas.width = w;
      canvas.height = h;

      // White background & crisp outer border
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 6;
      ctx.strokeRect(12, 12, w - 24, h - 24);

      const qrImg = await loadQrImage();

      const drawBarcode = (
        code: string,
        x: number,
        y: number,
        bw: number,
        bh: number
      ) => {
        const enc = encodeCode128B(code);
        if (!enc) return;
        const unit = bw / enc.totalModules;
        ctx.fillStyle = '#000000';
        for (const bar of enc.bars) {
          ctx.fillRect(x + bar.x * unit, y, bar.width * unit, bh);
        }
      };

      const wrapLines = (text: string, maxW: number): string[] => {
        const words = text.split(/\s+/);
        const lines: string[] = [];
        let cur = '';
        for (const wd of words) {
          const test = cur ? `${cur} ${wd}` : wd;
          if (ctx.measureText(test).width > maxW && cur) {
            lines.push(cur);
            cur = wd;
          } else {
            cur = test;
          }
        }
        if (cur) lines.push(cur);
        return lines;
      };

      if (labelFormat === '100x150') {
        // Header
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 34px system-ui, -apple-system, sans-serif';
        ctx.fillText('VIVIDA CRYSTAL', 44, 78);
        ctx.font = '600 20px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(`Packing & Shipping • ${order.order_date}`, 44, 110);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 28px monospace';
        ctx.fillText(order.order_no, w - 44, 78);
        ctx.font = '700 20px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(
          `${SALES_CHANNELS_CONFIG[order.channel]?.label || order.channel}`,
          w - 44,
          110
        );
        ctx.textAlign = 'left';

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(40, 134);
        ctx.lineTo(w - 40, 134);
        ctx.stroke();

        // Recipient box
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(40, 156, w - 80, 260);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.strokeRect(40, 156, w - 80, 260);

        ctx.fillStyle = '#64748b';
        ctx.font = '800 18px system-ui, -apple-system, sans-serif';
        ctx.fillText('ผู้รับ (TO RECIPIENT)', 64, 192);

        ctx.fillStyle = '#0f172a';
        ctx.font = '900 36px system-ui, -apple-system, sans-serif';
        ctx.fillText(order.customer_name, 64, 240);

        let ry = 278;
        if (order.customer_phone) {
          ctx.font = '700 24px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#1e293b';
          ctx.fillText(`Tel: ${order.customer_phone}`, 64, ry);
          ry += 34;
        }
        ctx.font = '500 22px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#334155';
        const addrLines = wrapLines(
          order.customer_address || 'รับหน้าร้าน / ไม่ระบุที่อยู่จัดส่ง',
          w - 130
        ).slice(0, 3);
        for (const ln of addrLines) {
          ctx.fillText(ln, 64, ry);
          ry += 28;
        }

        // QR & Barcode Section
        if (qrImg) {
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2;
          ctx.strokeRect(40, 440, 230, 230);
          ctx.drawImage(qrImg, 52, 452, 206, 206);
        }

        ctx.fillStyle = '#475569';
        ctx.font = '800 20px system-ui, -apple-system, sans-serif';
        ctx.fillText('สแกนเข้าหน้าแพ็กของ (Packing Station)', 294, 466);
        drawBarcode(order.order_no, 294, 484, w - 340, 100);
        ctx.fillStyle = '#0f172a';
        ctx.font = '800 24px monospace';
        ctx.fillText(order.order_no, 294, 616);

        if (order.tracking_no) {
          ctx.fillStyle = '#1d4ed8';
          ctx.font = '800 22px monospace';
          ctx.fillText(`Tracking: ${order.tracking_no}`, 294, 656);
        }

        // Checklist Box
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(40, 696);
        ctx.lineTo(w - 40, 696);
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = '900 24px system-ui, -apple-system, sans-serif';
        ctx.fillText(`รายการเช็กของลงกล่อง (รวม ${totalAllQty} ชิ้น)`, 44, 738);

        let cy = 784;
        for (const it of order.items.slice(0, 16)) {
          ctx.fillStyle = '#0f172a';
          ctx.font = '700 20px monospace';
          ctx.fillText(`☐  ${it.sku}`, 44, cy);
          ctx.font = '500 20px system-ui, -apple-system, sans-serif';
          const labelName = it.sku?.startsWith('GIFT') ? `[ของแถม] ${it.name}` : it.name;
          ctx.fillText(labelName.slice(0, 32), 270, cy);
          ctx.textAlign = 'right';
          ctx.font = '800 22px system-ui, -apple-system, sans-serif';
          ctx.fillText(`x${it.qty || 1}`, w - 44, cy);
          ctx.textAlign = 'left';
          cy += 38;
        }

        // Footer
        ctx.fillStyle = '#475569';
        ctx.font = '600 18px system-ui, -apple-system, sans-serif';
        ctx.fillText(`ผู้ส่ง: Vivida Crystal (${senderPhone})`, 44, h - 42);
      } else if (labelFormat === '50x50') {
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 26px system-ui, -apple-system, sans-serif';
        ctx.fillText('VIVIDA CRYSTAL', 36, 62);
        ctx.textAlign = 'right';
        ctx.font = '700 20px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(order.order_date, w - 36, 62);
        ctx.textAlign = 'left';

        if (qrImg) {
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2;
          ctx.strokeRect(36, 94, 240, 240);
          ctx.drawImage(qrImg, 48, 106, 216, 216);
        }

        ctx.fillStyle = '#6b21a8';
        ctx.font = '900 26px monospace';
        ctx.fillText(order.order_no, 298, 134);

        ctx.fillStyle = '#0f172a';
        ctx.font = '900 30px system-ui, -apple-system, sans-serif';
        ctx.fillText(order.customer_name.slice(0, 18), 298, 184);

        if (order.customer_phone) {
          ctx.fillStyle = '#475569';
          ctx.font = '700 22px system-ui, -apple-system, sans-serif';
          ctx.fillText(order.customer_phone, 298, 224);
        }

        ctx.fillStyle = '#0f172a';
        ctx.font = '800 22px system-ui, -apple-system, sans-serif';
        ctx.fillText(
          `หิน ${totalMainQty}${totalGiftQty > 0 ? ` + แถม ${totalGiftQty}` : ''} ชิ้น`,
          298,
          270
        );

        drawBarcode(order.order_no, 36, 378, w - 72, 160);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#475569';
        ctx.font = '700 22px system-ui, -apple-system, sans-serif';
        ctx.fillText('สแกนเพื่อเริ่มแพ็ก & อัดคลิปพัสดุ', w / 2, 586);
        ctx.textAlign = 'left';
      } else {
        // 50x30 mini
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 24px system-ui, -apple-system, sans-serif';
        ctx.fillText('VIVIDA CRYSTAL', 32, 56);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#6b21a8';
        ctx.font = '900 24px monospace';
        ctx.fillText(order.order_no, w - 32, 56);
        ctx.textAlign = 'left';

        if (qrImg) {
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2;
          ctx.strokeRect(32, 86, 220, 220);
          ctx.drawImage(qrImg, 42, 96, 200, 200);
        }

        ctx.fillStyle = '#0f172a';
        ctx.font = '900 28px system-ui, -apple-system, sans-serif';
        ctx.fillText(order.customer_name.slice(0, 18), 274, 130);
        ctx.fillStyle = '#475569';
        ctx.font = '700 22px system-ui, -apple-system, sans-serif';
        ctx.fillText(
          `หิน ${totalMainQty}${totalGiftQty > 0 ? ` • แถม ${totalGiftQty}` : ''} (รวม ${totalAllQty} ชิ้น)`,
          274,
          172
        );
        drawBarcode(order.order_no, 274, 204, w - 310, 102);
      }

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${order.order_no}_${labelFormat}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download label error:', err);
      alert('ไม่สามารถดาวน์โหลดรูปใบปะหน้าได้ กรุณาลองใหม่');
    } finally {
      setIsDownloading(false);
    }
  };

  // Open a dedicated clean print window sized strictly to the selected thermal sticker
  const handlePrintThermalLabel = () => {
    const orderBarcodeSvg = generateBarcodeSvgString(order.order_no);
    const trackingBarcodeSvg = order.tracking_no
      ? generateBarcodeSvgString(order.tracking_no)
      : '';

    const dimensions =
      labelFormat === '100x150'
        ? { w: 100, h: 150 }
        : labelFormat === '50x50'
        ? { w: 50, h: 50 }
        : { w: 50, h: 30 };

    const checklistRowsHtml = order.items
      .map((it) => {
        const isGift = Boolean(it.sku?.startsWith('GIFT'));
        return `
          <tr>
            <td style="padding: 3px 4px; border-bottom: 1px dashed #cbd5e1; width: 18px; text-align: center; font-weight: bold;">☐</td>
            <td style="padding: 3px 4px; border-bottom: 1px dashed #cbd5e1; font-family: monospace; font-weight: 700; font-size: 10px;">
              ${it.sku}
              ${isGift ? '<span style="background:#d1fae5;color:#065f46;padding:0 3px;border-radius:3px;font-size:8px;margin-left:3px;">GIFT</span>' : ''}
            </td>
            <td style="padding: 3px 4px; border-bottom: 1px dashed #cbd5e1; font-size: 10px;">
              ${it.name} ${it.weight_grams ? `(${it.weight_grams}g)` : ''}
            </td>
            <td style="padding: 3px 4px; border-bottom: 1px dashed #cbd5e1; text-align: right; font-weight: 800; font-size: 10px;">
              x${it.qty || 1}
            </td>
          </tr>
        `;
      })
      .join('');

    let bodyHtml = '';

    if (labelFormat === '100x150') {
      bodyHtml = `
        <div style="width:100mm; height:150mm; box-sizing:border-box; padding:4mm; display:flex; flex-direction:column; justify-content:space-between; font-family:'Inter','Noto Sans Thai',sans-serif; color:#0f172a; background:#fff;">
          <!-- Top Header -->
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f172a; padding-bottom:2mm;">
              <div>
                <div style="font-size:14px; font-weight:900; letter-spacing:-0.3px;">💎 VIVIDA CRYSTAL</div>
                <div style="font-size:9px; color:#475569;">ผู้ส่ง: ร้านหินมงคล Vivida Crystal (${senderPhone})</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:9px; font-weight:800; background:#0f172a; color:#fff; padding:2px 6px; border-radius:4px; display:inline-block;">
                  ${SALES_CHANNELS_CONFIG[order.channel]?.label || order.channel}
                </div>
                <div style="font-size:9px; color:#475569; margin-top:1px;">วันที่: ${order.order_date}</div>
              </div>
            </div>

            <!-- Recipient Box -->
            <div style="margin-top:2.5mm; padding:2.5mm; border:2px solid #0f172a; border-radius:6px; background:#f8fafc;">
              <div style="font-size:9px; font-weight:800; color:#475569; text-transform:uppercase;">ผู้รับ (RECIPIENT / SHIP TO):</div>
              <div style="font-size:15px; font-weight:900; margin-top:1px;">${order.customer_name}</div>
              ${
                order.customer_phone
                  ? `<div style="font-size:12px; font-weight:800; margin-top:1px;">📞 โทร: ${order.customer_phone}</div>`
                  : ''
              }
              <div style="font-size:11px; line-height:1.35; margin-top:1.5mm; color:#1e293b;">
                ${order.customer_address || '(ไม่ได้ระบุที่อยู่จัดส่ง / รับหน้าร้าน)'}
              </div>
            </div>

            <!-- Hybrid Order QR + Barcode Box for Packing Station -->
            <div style="margin-top:2.5mm; padding:2.5mm; border:1.5px solid #334155; border-radius:6px; display:flex; align-items:center; gap:3mm;">
              <div style="width:24mm; height:24mm; flex-shrink:0; border:1px solid #cbd5e1; padding:1mm; border-radius:4px; background:#fff;">
                <img src="${qrImageUrl}" style="width:100%; height:100%; display:block;" alt="QR" />
              </div>
              <div style="flex:1; min-width:0; text-align:center;">
                <div style="font-size:8px; font-weight:800; color:#475569; text-transform:uppercase; margin-bottom:1mm;">
                  สแกนเปิดกล่อง & อัดวิดีโอแพ็กของ (SCAN TO PACK)
                </div>
                <div style="height:11mm; width:100%;">${orderBarcodeSvg}</div>
                <div style="font-family:monospace; font-size:13px; font-weight:900; letter-spacing:1px; margin-top:1mm;">
                  ${order.order_no}
                </div>
              </div>
            </div>

            <!-- Packing Checklist Slip -->
            <div style="margin-top:2.5mm;">
              <div style="display:flex; justify-content:space-between; align-items:center; background:#e2e8f0; padding:1.5mm 2mm; border-radius:4px; font-size:9px; font-weight:800;">
                <span>📦 รายการตรวจเช็กสินค้าลงกล่อง (Packing Checklist)</span>
                <span>หิน ${totalMainQty} • ของแถม ${totalGiftQty} (รวม ${totalAllQty} ชิ้น)</span>
              </div>
              <table style="width:100%; border-collapse:collapse; margin-top:1mm;">
                <tbody>
                  ${checklistRowsHtml}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Footer / Tracking No Box -->
          <div style="border-top:2px solid #0f172a; padding-top:2mm; display:flex; justify-content:space-between; align-items:center;">
            ${
              order.tracking_no
                ? `
                  <div style="flex:1;">
                    <div style="font-size:8px; font-weight:800; color:#475569;">เลขพัสดุจัดส่ง (TRACKING NO.):</div>
                    <div style="font-family:monospace; font-size:12px; font-weight:900;">🚚 ${order.tracking_no}</div>
                  </div>
                  <div style="width:42mm; height:9mm;">${trackingBarcodeSvg}</div>
                `
                : `
                  <div style="font-size:9px; color:#475569;">
                    <strong>🚚 เลขพัสดุ (Tracking):</strong> ____________________________
                  </div>
                  <div style="font-size:8px; font-weight:700; color:#64748b;">
                    ถ่ายวิดีโอขณะแกะพัสดุทุกครั้ง
                  </div>
                `
            }
          </div>
        </div>
      `;
    } else if (labelFormat === '50x50') {
      bodyHtml = `
        <div style="width:50mm; height:50mm; box-sizing:border-box; padding:2.5mm; display:flex; flex-direction:column; justify-content:space-between; font-family:'Inter','Noto Sans Thai',sans-serif; color:#000; background:#fff;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #000; padding-bottom:1mm;">
            <span style="font-size:9px; font-weight:900;">💎 VIVIDA CRYSTAL</span>
            <span style="font-size:7.5px; font-weight:800;">${order.order_date}</span>
          </div>

          <div style="display:flex; align-items:center; gap:2mm; margin-top:1mm;">
            <div style="width:17mm; height:17mm; flex-shrink:0;">
              <img src="${qrImageUrl}" style="width:100%; height:100%; display:block;" alt="QR" />
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-family:monospace; font-size:10px; font-weight:900; word-break:break-all;">${order.order_no}</div>
              <div style="font-size:9.5px; font-weight:800; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">👤 ${order.customer_name}</div>
              ${
                order.customer_phone
                  ? `<div style="font-size:8px; font-weight:700;">📞 ${order.customer_phone}</div>`
                  : ''
              }
              <div style="font-size:8px; font-weight:800; margin-top:1px; background:#f1f5f9; padding:1px 3px; border-radius:2px; display:inline-block;">
                หิน ${totalMainQty}${totalGiftQty > 0 ? ` + แถม ${totalGiftQty}` : ''} ชิ้น
              </div>
            </div>
          </div>

          <div style="margin-top:1mm;">
            <div style="height:8.5mm; width:100%;">${orderBarcodeSvg}</div>
            <div style="font-size:7.5px; text-align:center; font-weight:800; margin-top:0.5mm;">
              สแกนเพื่อเปิดกล่อง & อัดคลิปแพ็กของ
            </div>
          </div>
        </div>
      `;
    } else {
      // 50x30 mm NIIMBOT standard roll
      bodyHtml = `
        <div style="width:50mm; height:30mm; box-sizing:border-box; padding:1.8mm 2.2mm; display:flex; flex-direction:column; justify-content:space-between; font-family:'Inter','Noto Sans Thai',sans-serif; color:#000; background:#fff;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #000; padding-bottom:0.6mm;">
            <span style="font-size:8px; font-weight:900;">VIVIDA CRYSTAL</span>
            <span style="font-family:monospace; font-size:8.5px; font-weight:900;">${order.order_no}</span>
          </div>

          <div style="display:flex; align-items:center; gap:2mm; margin:0.8mm 0;">
            <div style="width:12.5mm; height:12.5mm; flex-shrink:0;">
              <img src="${qrImageUrl}" style="width:100%; height:100%; display:block;" alt="QR" />
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:9px; font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${order.customer_name}
              </div>
              <div style="font-size:7.5px; font-weight:700;">
                หิน ${totalMainQty}${totalGiftQty > 0 ? ` • แถม ${totalGiftQty}` : ''} (รวม ${totalAllQty} ชิ้น)
              </div>
              <div style="height:5.5mm; width:100%; margin-top:0.8mm;">${orderBarcodeSvg}</div>
            </div>
          </div>
        </div>
      `;
    }

    const printWin = window.open('', '_blank', 'width=520,height=720');
    if (!printWin) {
      window.print();
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Shipping Label - ${order.order_no}</title>
          <style>
            @page {
              size: ${dimensions.w}mm ${dimensions.h}mm;
              margin: 0;
            }
            html, body {
              margin: 0;
              padding: 0;
              width: ${dimensions.w}mm;
              height: ${dimensions.h}mm;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          </style>
        </head>
        <body>
          ${bodyHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94dvh]">
        {/* Top Control Header */}
        <div className="p-4 sm:px-6 bg-gradient-to-r from-slate-900 via-purple-950 to-indigo-950 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base flex items-center gap-2">
                <span>ใบปะหน้าพัสดุ & สแกนแพ็กของ ({order.order_no})</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold">
                  Hybrid QR + Barcode
                </span>
              </h3>
              <p className="text-[11px] text-purple-200/80">
                พิมพ์ติดหน้ากล่อง แล้วนำไปส่องกล้องที่หน้าแพ็กของเพื่อเปิดรายการ Checklist และอัดวิดีโออัตโนมัติ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToReceipt && (
              <button
                type="button"
                onClick={() => onSwitchToReceipt(order)}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-1.5 transition"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>สลับดูใบเสร็จ</span>
              </button>
            )}

            <Link
              href={`/packing?order_no=${encodeURIComponent(order.order_no)}`}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition active:scale-95"
            >
              <Video className="w-3.5 h-3.5" />
              <span>ไปหน้าอัดคลิปแพ็กบิลนี้</span>
            </Link>

            <button
              type="button"
              onClick={handleDownloadLabelPng}
              disabled={isDownloading}
              className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
              title="ดาวน์โหลดใบปะหน้าเป็นไฟล์รูปภาพ PNG"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'กำลังสร้างรูป...' : 'ดาวน์โหลด PNG'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintThermalLabel}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-purple-500/30 transition active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์ใบปะหน้า</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Settings Bar */}
        <div className="px-4 sm:px-6 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Format Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-600 mr-1">ขนาดสติกเกอร์:</span>
            <button
              type="button"
              onClick={() => setLabelFormat('100x150')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                labelFormat === '100x150'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              📦 ใบปะหน้ามาตรฐาน (100×150 mm + Checklist)
            </button>
            <button
              type="button"
              onClick={() => setLabelFormat('50x50')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                labelFormat === '50x50'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              🏷️ NIIMBOT สี่เหลี่ยม (50×50 mm)
            </button>
            <button
              type="button"
              onClick={() => setLabelFormat('50x30')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                labelFormat === '50x30'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              🏷️ NIIMBOT มินิ (50×30 mm)
            </button>
          </div>

          {/* QR Mode Selector */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">ข้อมูลใน QR:</span>
            <select
              value={qrMode}
              onChange={(e) => setQrMode(e.target.value as QrPayloadMode)}
              className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 font-semibold text-slate-700 outline-none"
            >
              <option value="order_no">รหัสบิลตรง ({order.order_no}) - สแกนไวสุด</option>
              <option value="packing_url">URL เปิดหน้าแพ็กอัตโนมัติ (สแกนด้วยกล้องมือถือ)</option>
            </select>
          </div>
        </div>

        {/* Live Label Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-200/70 flex flex-col items-center justify-start gap-6">
          {labelFormat === '100x150' && (
            <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-xl border-2 border-slate-800 p-5 space-y-4 text-slate-900">
              {/* Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                    <Gem className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-base tracking-tight leading-none">
                      VIVIDA CRYSTAL
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ผู้ส่ง: ร้านหินมงคล Vivida Crystal
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-black">
                    {SALES_CHANNELS_CONFIG[order.channel]?.label || order.channel}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">วันที่: {order.order_date}</p>
                </div>
              </div>

              {/* Recipient Box */}
              <div className="p-3.5 rounded-xl border-2 border-slate-900 bg-slate-50 space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  ผู้รับพัสดุ (SHIP TO / RECIPIENT):
                </span>
                <p className="text-lg font-black text-slate-900 leading-tight">
                  {order.customer_name}
                </p>
                {order.customer_phone && (
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-purple-700" />
                    <span>โทร: {order.customer_phone}</span>
                  </p>
                )}
                <p className="text-xs text-slate-700 flex items-start gap-1.5 pt-1 border-t border-slate-200/80 leading-relaxed">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <span>{order.customer_address || '(ไม่ได้ระบุที่อยู่จัดส่ง / รับหน้าร้าน)'}</span>
                </p>
              </div>

              {/* Hybrid QR + Code 128 Barcode Scan Box */}
              <div className="p-3 rounded-xl border-2 border-purple-900 bg-purple-50/40 flex items-center gap-3.5">
                <div className="w-24 h-24 shrink-0 bg-white p-1.5 rounded-xl border border-slate-300 shadow-xs flex items-center justify-center">
                  <img
                    src={qrImageUrl}
                    alt={`QR ${order.order_no}`}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0 text-center space-y-1.5">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[10px] font-black">
                    <Sparkles className="w-3 h-3 text-purple-700" />
                    <span>สแกนเปิดกล่อง & อัดคลิปแพ็กของ</span>
                  </div>

                  {/* SVG Code 128 Barcode */}
                  {encodedOrderBarcode && (
                    <div className="bg-white px-2 py-1.5 rounded-lg border border-slate-300">
                      <svg
                        viewBox={`0 0 ${encodedOrderBarcode.totalModules} 44`}
                        className="w-full h-10"
                        preserveAspectRatio="none"
                      >
                        {encodedOrderBarcode.bars.map((b, i) => (
                          <rect
                            key={i}
                            x={b.x}
                            y={0}
                            width={b.width}
                            height={44}
                            fill="#0f172a"
                          />
                        ))}
                      </svg>
                    </div>
                  )}

                  <p className="font-mono font-black text-sm tracking-widest text-slate-900">
                    {order.order_no}
                  </p>
                </div>
              </div>

              {/* Packing Checklist Slip */}
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold">
                  <span className="flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>รายการตรวจเช็กของลงกล่อง (Checklist)</span>
                  </span>
                  <span>
                    หิน {totalMainQty} • แถม {totalGiftQty} (รวม {totalAllQty} ชิ้น)
                  </span>
                </div>

                <div className="divide-y divide-dashed divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                  {order.items.map((it, idx) => {
                    const isGift = Boolean(it.sku?.startsWith('GIFT'));
                    return (
                      <div
                        key={idx}
                        className="px-3 py-2 bg-white flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-4 h-4 rounded border-2 border-slate-400 inline-block shrink-0" />
                          <span className="font-mono font-bold text-purple-800 shrink-0">
                            {it.sku}
                          </span>
                          {isGift && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] shrink-0">
                              🎁 ของแถม
                            </span>
                          )}
                          <span className="text-slate-700 truncate">{it.name}</span>
                          {it.weight_grams && (
                            <span className="text-slate-400 text-[11px] shrink-0">
                              ({it.weight_grams}g)
                            </span>
                          )}
                        </div>
                        <span className="font-black text-slate-900 shrink-0">
                          x{it.qty || 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Tracking Info */}
              <div className="pt-3 border-t-2 border-slate-900 flex items-center justify-between gap-3">
                {order.tracking_no ? (
                  <>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block">
                        เลขพัสดุจัดส่ง (TRACKING NO.):
                      </span>
                      <span className="font-mono font-black text-sm text-emerald-700 flex items-center gap-1">
                        <Truck className="w-4 h-4" />
                        <span>{order.tracking_no}</span>
                      </span>
                    </div>
                    {encodedTrackingBarcode && (
                      <div className="w-40 bg-white p-1 border border-slate-300 rounded">
                        <svg
                          viewBox={`0 0 ${encodedTrackingBarcode.totalModules} 32`}
                          className="w-full h-7"
                          preserveAspectRatio="none"
                        >
                          {encodedTrackingBarcode.bars.map((b, i) => (
                            <rect
                              key={i}
                              x={b.x}
                              y={0}
                              width={b.width}
                              height={32}
                              fill="#0f172a"
                            />
                          ))}
                        </svg>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full flex items-center justify-between text-xs text-slate-500">
                    <span>
                      <strong className="text-slate-800">🚚 เลขพัสดุ (Tracking):</strong>{' '}
                      ______________________
                    </span>
                    <span className="text-[10px] text-slate-400">ใส่/สแกนตอนแพ็กเสร็จได้</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {labelFormat === '50x50' && (
            <div className="w-[280px] h-[280px] bg-white rounded-2xl shadow-xl border-2 border-slate-900 p-4 flex flex-col justify-between text-slate-900">
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1.5">
                <span className="font-black text-xs">💎 VIVIDA CRYSTAL</span>
                <span className="text-[10px] font-bold text-slate-500">{order.order_date}</span>
              </div>

              <div className="flex items-center gap-3 my-1">
                <div className="w-24 h-24 shrink-0 border border-slate-300 rounded-lg p-1 bg-white">
                  <img src={qrImageUrl} alt="QR" className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-mono font-black text-xs text-purple-800 break-all">
                    {order.order_no}
                  </p>
                  <p className="font-black text-sm truncate">👤 {order.customer_name}</p>
                  {order.customer_phone && (
                    <p className="text-[11px] font-bold text-slate-600">
                      📞 {order.customer_phone}
                    </p>
                  )}
                  <span className="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] font-extrabold">
                    หิน {totalMainQty} {totalGiftQty > 0 ? `+ แถม ${totalGiftQty}` : ''} ชิ้น
                  </span>
                </div>
              </div>

              {encodedOrderBarcode && (
                <div className="space-y-1">
                  <div className="bg-white border border-slate-300 rounded p-1">
                    <svg
                      viewBox={`0 0 ${encodedOrderBarcode.totalModules} 36`}
                      className="w-full h-9"
                      preserveAspectRatio="none"
                    >
                      {encodedOrderBarcode.bars.map((b, i) => (
                        <rect key={i} x={b.x} y={0} width={b.width} height={36} fill="#000" />
                      ))}
                    </svg>
                  </div>
                  <p className="text-[10px] text-center font-bold text-slate-600">
                    สแกนเพื่อเปิดกล่อง & อัดคลิปแพ็กของ
                  </p>
                </div>
              )}
            </div>
          )}

          {labelFormat === '50x30' && (
            <div className="w-[300px] h-[180px] bg-white rounded-2xl shadow-xl border-2 border-slate-900 p-3.5 flex flex-col justify-between text-slate-900">
              <div className="flex items-center justify-between border-b border-slate-900 pb-1">
                <span className="font-black text-[11px]">💎 VIVIDA CRYSTAL</span>
                <span className="font-mono font-black text-xs text-purple-800">
                  {order.order_no}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-20 h-20 shrink-0 border border-slate-300 rounded p-1 bg-white">
                  <img src={qrImageUrl} alt="QR" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-black text-xs truncate">👤 {order.customer_name}</p>
                  <p className="text-[10px] font-bold text-slate-600">
                    หิน {totalMainQty} {totalGiftQty > 0 ? `• แถม ${totalGiftQty}` : ''} (รวม{' '}
                    {totalAllQty} ชิ้น)
                  </p>
                  {encodedOrderBarcode && (
                    <div className="pt-0.5">
                      <svg
                        viewBox={`0 0 ${encodedOrderBarcode.totalModules} 28`}
                        className="w-full h-7"
                        preserveAspectRatio="none"
                      >
                        {encodedOrderBarcode.bars.map((b, i) => (
                          <rect key={i} x={b.x} y={0} width={b.width} height={28} fill="#000" />
                        ))}
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
