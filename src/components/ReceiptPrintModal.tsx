'use client';

import React from 'react';
import { Order, SALES_CHANNELS_CONFIG, ORDER_STATUS_CONFIG } from '@/types';
import { Printer, X, Gem, CheckCircle, Truck, Phone, MapPin, Calendar, CreditCard } from 'lucide-react';

interface ReceiptPrintModalProps {
  order: Order | null;
  onClose: () => void;
}

export default function ReceiptPrintModal({ order, onClose }: ReceiptPrintModalProps) {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Controls (Hidden when printing) */}
        <div className="print:hidden p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-purple-400" />
            <span className="font-bold text-sm">ใบเสร็จรับเงิน / ใบส่งสินค้า ({order.order_no})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-xs rounded-xl shadow hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ใบเสร็จ / เซฟ PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-8 sm:p-10 overflow-y-auto print:p-0 print:overflow-visible print:max-h-none text-slate-800">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b-2 border-slate-200 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 p-0.5 flex items-center justify-center text-white shadow-md">
                <Gem className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Vivida Crystal
                </h2>
                <p className="text-xs text-slate-500">
                  ร้านหินมงคล ผลึกแร่ธรรมชาติ และคริสตัลเกรดสะสม (Vivida Crystal)
                </p>
                <p className="text-[11px] text-slate-400">
                  โทร: 08x-xxx-xxxx | LINE: @vividacrystal
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 uppercase tracking-wider mb-1">
                ใบเสร็จรับเงิน / ใบส่งของ
              </span>
              <p className="text-sm font-bold text-slate-900">
                เลขที่: <span className="font-mono text-purple-700">{order.order_no}</span>
              </p>
              <p className="text-xs text-slate-500 flex items-center sm:justify-end gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>วันที่: {order.order_date}</span>
              </p>
            </div>
          </div>

          {/* Customer & Order Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6 border-b border-slate-100 text-xs">
            <div className="space-y-1">
              <p className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                ข้อมูลลูกค้า (Customer Info)
              </p>
              <p className="font-bold text-slate-900 text-sm">{order.customer_name}</p>
              {order.customer_phone && (
                <p className="text-slate-600 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>เบอร์โทร: {order.customer_phone}</span>
                </p>
              )}
              {order.customer_address && (
                <p className="text-slate-600 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span>ที่อยู่จัดส่ง: {order.customer_address}</span>
                </p>
              )}
            </div>

            <div className="space-y-1 sm:text-right">
              <p className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                รายละเอียดการจัดส่ง & ชำระเงิน
              </p>
              <p className="text-slate-700">
                <span className="text-slate-400">ช่องทางขาย:</span>{' '}
                <span className="font-bold text-slate-800">
                  {SALES_CHANNELS_CONFIG[order.channel]?.label || order.channel}
                </span>
              </p>
              <p className="text-slate-700 flex items-center sm:justify-end gap-1">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                <span>วิธีชำระเงิน: <strong>{order.payment_method}</strong></span>
              </p>
              {order.tracking_no && (
                <p className="text-emerald-700 font-semibold flex items-center sm:justify-end gap-1">
                  <Truck className="w-3.5 h-3.5" />
                  <span>เลขพัสดุ: <strong className="font-mono">{order.tracking_no}</strong></span>
                </p>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="py-6">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-600 font-bold">
                  <th className="py-2.5 px-2 w-12 text-center">ลำดับ</th>
                  <th className="py-2.5 px-3">รหัส SKU & รายการหิน</th>
                  <th className="py-2.5 px-3 text-right">น้ำหนัก</th>
                  <th className="py-2.5 px-3 text-right">ราคาต่อหน่วย</th>
                  <th className="py-2.5 px-3 text-center">จำนวน</th>
                  <th className="py-2.5 px-3 text-right">ยอดรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-2 text-center text-slate-400 font-medium">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {item.r2_thumbnail_url && (
                          <img
                            src={item.r2_thumbnail_url}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                          />
                        )}
                        <div>
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-[11px] font-mono text-purple-700">{item.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      {item.weight_grams ? `${item.weight_grams} g` : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-700">
                      ฿{item.unit_price.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-800">
                      {item.qty}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      ฿{(item.unit_price * item.qty).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="pt-4 border-t-2 border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="text-xs text-slate-500 space-y-1">
              {order.notes && (
                <p>
                  <strong>หมายเหตุ:</strong> {order.notes}
                </p>
              )}
              <p className="text-[11px] text-slate-400">
                * สินค้าธรรมชาติ ผลึกหินแท้ 100% โปรดตรวจสอบสินค้าเมื่อได้รับพัสดุ
              </p>
            </div>

            <div className="w-full sm:w-64 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>ราคารวมสินค้า:</span>
                <span className="font-semibold">฿{order.subtotal.toLocaleString()}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>ส่วนลด:</span>
                  <span className="font-semibold">-฿{order.discount.toLocaleString()}</span>
                </div>
              )}
              {order.shipping_fee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>ค่าจัดส่ง:</span>
                  <span className="font-semibold">+฿{order.shipping_fee.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-purple-900 pt-2 border-t border-slate-200">
                <span>ยอดรวมสุทธิ:</span>
                <span>฿{order.total_amount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Signature / Stamp Footer */}
          <div className="mt-12 pt-8 border-t border-dashed border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
            <div>
              <div className="h-14 border-b border-slate-300 w-36 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">ผู้รับสินค้า / ลูกค้า</p>
              <p className="text-[10px] text-slate-400">วันที่: ..... / ..... / .........</p>
            </div>
            <div>
              <div className="h-14 border-b border-slate-300 w-36 mx-auto mb-2 flex items-center justify-center text-emerald-600 font-bold">
                <CheckCircle className="w-5 h-5 mr-1" />
                ชำระเงินแล้ว
              </div>
              <p className="font-semibold text-slate-700">ผู้มีอำนาจลงนาม / ร้านค้า</p>
              <p className="text-[10px] text-slate-400">Vivida Crystal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
