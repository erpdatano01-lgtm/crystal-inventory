'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import ImageUploader from '@/components/ImageUploader';
import ReceiptPrintModal from '@/components/ReceiptPrintModal';
import {
  fetchProducts,
  fetchExpenses,
} from '@/lib/inventoryService';
import {
  Product,
  Expense,
  Order,
  OrderItem,
  SalesChannel,
  OrderStatus,
  SALES_CHANNELS_CONFIG,
  ORDER_STATUS_CONFIG,
} from '@/types';
import {
  ShoppingBag,
  PlusCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Receipt,
  Printer,
  Eye,
  Trash2,
  CheckCircle2,
  Search,
  Filter,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Truck,
  Sparkles,
  X,
  FileSpreadsheet,
} from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & UI states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<Order | null>(null);
  const [selectedSlipUrl, setSelectedSlipUrl] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // New Order Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [channel, setChannel] = useState<SalesChannel>('WALK_IN');
  const [paymentMethod, setPaymentMethod] = useState('โอนเงิน (Mobile Banking)');
  const [trackingNo, setTrackingNo] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [orderSlipUrls, setOrderSlipUrls] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [ordRes, prodData, expData] = await Promise.all([
        fetch('/api/orders').then((r) => r.json()),
        fetchProducts(),
        fetchExpenses(),
      ]);
      if (Array.isArray(ordRes)) setOrders(ordRes);
      setProducts(prodData);
      setExpenses(expData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Products available to sell
  const availableProducts = useMemo(() => {
    return products.filter((p) => p.status === 'AVAILABLE' && p.qty_on_hand > 0);
  }, [products]);

  // Financial Summary (FlowAccount style)
  const totalSalesRevenue = useMemo(() => {
    return orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  }, [orders]);

  const totalCOGS = useMemo(() => {
    return orders.reduce((sum, o) => sum + (o.total_cost || 0), 0);
  }, [orders]);

  const grossProfit = totalSalesRevenue - totalCOGS;
  const grossMargin =
    totalSalesRevenue > 0 ? ((grossProfit / totalSalesRevenue) * 100).toFixed(1) : '0';

  const totalOperatingExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + Number(e.total_amount || 0), 0);
  }, [expenses]);

  const netProfit = grossProfit - totalOperatingExpenses;

  // Handle adding an item to order
  const handleSelectItem = (prod: Product) => {
    if (selectedItems.some((i) => i.product_id === prod.id)) return;
    const newItem: OrderItem = {
      product_id: prod.id,
      sku: prod.sku,
      name: prod.name,
      stone_type: prod.stone_type,
      unit_price: Number(prod.selling_price) || 0,
      cost_price: Number(prod.cost_price) || 0,
      qty: 1,
      weight_grams: prod.weight_grams,
      r2_thumbnail_url: prod.r2_thumbnail_url,
    };
    setSelectedItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (productId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.product_id !== productId));
  };

  // Form calculated totals
  const subtotal = useMemo(() => {
    return selectedItems.reduce((sum, i) => sum + i.unit_price * i.qty, 0);
  }, [selectedItems]);

  const orderTotalCost = useMemo(() => {
    return selectedItems.reduce((sum, i) => sum + i.cost_price * i.qty, 0);
  }, [selectedItems]);

  const orderTotalAmount = Math.max(0, subtotal - discount + shippingFee);
  const orderProfit = orderTotalAmount - orderTotalCost;

  // Submit Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      alert('กรุณาเลือกสินค้าอย่างน้อย 1 ชิ้น');
      return;
    }
    if (!customerName.trim()) {
      alert('กรุณากรอกชื่อลูกค้า');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderPayload: Partial<Order> = {
        order_date: new Date().toISOString().slice(0, 10),
        customer_name: customerName,
        customer_phone: customerPhone || null,
        customer_address: customerAddress || null,
        channel,
        items: selectedItems,
        subtotal,
        discount,
        shipping_fee: shippingFee,
        total_amount: orderTotalAmount,
        total_cost: orderTotalCost,
        profit: orderProfit,
        payment_method: paymentMethod,
        slip_url: orderSlipUrls[0] || null,
        tracking_no: trackingNo || null,
        notes: notes || null,
        status: 'PAID',
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create order');
      }

      const created: Order = await res.json();

      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setSelectedItems([]);
      setDiscount(0);
      setShippingFee(0);
      setNotes('');
      setOrderSlipUrls([]);
      setShowCreateModal(false);

      // Open print receipt modal directly
      setSelectedPrintOrder(created);

      // Reload data
      await loadData();
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Order
  const handleDeleteOrder = async (orderId: string, orderNo: string) => {
    const restore = confirm(
      `ยืนยันการลบบิล "${orderNo}"?\n\nกด "ตกลง (OK)" เพื่อลบบิลและคืนสินค้ากลับเข้าสต็อก (AVAILABLE)\nหรือกด "ยกเลิก (Cancel)" เพื่อไม่ทำรายการ`
    );
    if (!restore) return;

    try {
      const res = await fetch(`/api/orders?id=${orderId}&restoreStock=true`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        await loadData();
        alert(`ลบบิล ${orderNo} และคืนสต็อกเรียบร้อยแล้ว`);
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการลบบิล');
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = o.order_no.toLowerCase().includes(q);
        const matchCust = o.customer_name.toLowerCase().includes(q);
        const matchItem = o.items?.some(
          (i) => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
        );
        if (!matchNo && !matchCust && !matchItem) return false;
      }
      if (selectedChannel && o.channel !== selectedChannel) return false;
      if (selectedStatus && o.status !== selectedStatus) return false;
      return true;
    });
  }, [orders, searchQuery, selectedChannel, selectedStatus]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Page Title & Action Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 uppercase tracking-wide">
                FlowAccount Style
              </span>
              <span className="text-xs text-slate-400">ระบบเปิดบิล & สรุปบัญชีร้านหิน</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-purple-600" />
              เปิดบิลขาย & บัญชีกำไร-ขาดทุน (Sales & Billing)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              เปิดบิลออเดอร์ลูกค้า ตัดสต็อกหินอัตโนมัติ ออกใบเสร็จรับเงิน และสรุปบัญชีรายรับ-รายจ่าย
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-600/20 hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition"
            >
              <PlusCircle className="w-5 h-5" />
              <span>+ เปิดบิลขายใหม่</span>
            </button>
          </div>
        </div>

        {/* FlowAccount P&L Accounting Summary Dashboard (5 Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: Revenue */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-2">
              <span>1. ยอดขายรวม (Revenue)</span>
              <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-slate-900">
                ฿{totalSalesRevenue.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">จาก {orders.length} บิลขาย</p>
            </div>
          </div>

          {/* Card 2: COGS */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-2">
              <span>2. ทุนหินที่ขาย (COGS)</span>
              <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-amber-900">
                ฿{totalCOGS.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">ต้นทุนจริงของหินที่ขาย</p>
            </div>
          </div>

          {/* Card 3: Gross Profit */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-2">
              <span>3. กำไรขั้นต้น (Gross)</span>
              <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-blue-900">
                ฿{grossProfit.toLocaleString()}
              </p>
              <p className="text-[11px] text-blue-600 font-bold mt-1">Margin {grossMargin}%</p>
            </div>
          </div>

          {/* Card 4: Operating Expenses */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-2">
              <span>4. ค่าใช้จ่ายร้าน (Expense)</span>
              <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-rose-600">
                -฿{totalOperatingExpenses.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">ล็อตหิน/ส่ง/กล่อง/บูธ</p>
            </div>
          </div>

          {/* Card 5: Net Profit (Bottom line) */}
          <div className="col-span-2 lg:col-span-1 p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-purple-950 text-white shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-purple-200 font-bold mb-2">
              <span>5. กำไรสุทธิ (Net Profit)</span>
              <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p
                className={`text-xl sm:text-2xl font-black tracking-tight ${
                  netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ฿{netProfit.toLocaleString()}
              </p>
              <p className="text-[11px] text-purple-200/80 mt-1">
                {netProfit >= 0 ? 'กำไรหลังหักค่าใช้จ่ายทั้งหมด' : 'ยอดติดลบรวมค่าล็อต'}
              </p>
            </div>
          </div>
        </div>

        {/* Search & Channel Filters */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาเลขที่บิล, ชื่อลูกค้า, หรือรหัส SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-2xl text-xs sm:text-sm border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="">ทุกช่องทางขาย</option>
                {Object.entries(SALES_CHANNELS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="">ทุกสถานะบิล</option>
                {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Orders List Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                รายการบิลขายทั้งหมด ({filteredOrders.length})
              </h3>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs">กำลังโหลดรายการบิลขาย...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">ยังไม่มีรายการบิลขาย</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                เมื่อขายสินค้าได้ ให้กดปุ่ม "+ เปิดบิลขายใหม่" ด้านบนเพื่อบันทึกและพิมพ์ใบเสร็จรับเงิน
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">เลขที่บิล & วันที่</th>
                    <th className="py-3 px-4">ชื่อลูกค้า & ช่องทาง</th>
                    <th className="py-3 px-4">สินค้าในบิล</th>
                    <th className="py-3 px-4 text-right">ยอดรวมสุทธิ</th>
                    <th className="py-3 px-4 text-right">กำไรบิลนี้</th>
                    <th className="py-3 px-4 text-center">สถานะ</th>
                    <th className="py-3 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((ord) => {
                    const channelConfig =
                      SALES_CHANNELS_CONFIG[ord.channel] || SALES_CHANNELS_CONFIG.OTHER;
                    const statusConfig =
                      ORDER_STATUS_CONFIG[ord.status] || ORDER_STATUS_CONFIG.PAID;

                    return (
                      <tr key={ord.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4">
                          <p className="font-mono font-bold text-purple-700">{ord.order_no}</p>
                          <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            <span>{ord.order_date}</span>
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{ord.customer_name}</p>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border mt-0.5 ${channelConfig.badgeClass}`}
                          >
                            {channelConfig.label}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {ord.items.map((it, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-xs">
                                <span className="font-mono text-purple-600 font-semibold">
                                  {it.sku}
                                </span>
                                <span className="text-slate-700 truncate max-w-[140px]">
                                  {it.name}
                                </span>
                                <span className="text-slate-400 font-medium">x{it.qty}</span>
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <p className="font-black text-slate-900 text-sm">
                            ฿{ord.total_amount.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            วิธี: {ord.payment_method}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <span className="font-bold text-emerald-600">
                            +฿{ord.profit.toLocaleString()}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConfig.badgeClass}`}
                          >
                            {statusConfig.label}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Print Receipt Button */}
                            <button
                              onClick={() => setSelectedPrintOrder(ord)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition"
                              title="พิมพ์ใบเสร็จ / บิลส่งของ"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>พิมพ์บิล</span>
                            </button>

                            {/* View Slip if uploaded */}
                            {ord.slip_url && (
                              <button
                                onClick={() => setSelectedSlipUrl(ord.slip_url!)}
                                className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-slate-100 rounded-xl transition"
                                title="ดูสลิปโอนเงิน R2"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}

                            {/* Delete Order Button */}
                            <button
                              onClick={() => handleDeleteOrder(ord.id, ord.order_no)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                              title="ลบบิลและคืนสินค้ากลับสต็อก"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Create New Order / Invoice */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <ShoppingBag className="w-6 h-6" />
                    <span>เปิดบิลขายใหม่ (New Sales Invoice)</span>
                  </h3>
                  <p className="text-xs text-purple-200 mt-0.5">
                    เลือกหินที่ขาย ระบบจะตัดสต็อกเป็น SOLD อัตโนมัติและออกใบเสร็จรับเงิน
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrder} className="p-6 overflow-y-auto space-y-6">
                {/* 1. Customer Information */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <span>1. ข้อมูลลูกค้า & ช่องทางการขาย</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-xs font-semibold text-slate-700">ชื่อลูกค้า *</label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น คุณกมลวรรณ / ลูกค้าหน้าร้าน"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">เบอร์โทรศัพท์</label>
                      <input
                        type="text"
                        placeholder="08x-xxx-xxxx"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">ช่องทางจำหน่าย</label>
                      <select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value as SalesChannel)}
                        className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {Object.entries(SALES_CHANNELS_CONFIG).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        เลขพัสดุจัดส่ง (Tracking No.)
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น TH012345678 / Flash / Kerry"
                        value={trackingNo}
                        onChange={(e) => setTrackingNo(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">ที่อยู่จัดส่งพัสดุ</label>
                    <textarea
                      rows={2}
                      placeholder="บ้านเลขที่ ตำบล อำเภอ จังหวัด รหัสไปรษณีย์..."
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* 2. Select Items from Stock */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      2. เลือกหินจากสต็อกเพื่อขาย ({availableProducts.length} ชิ้นพร้อมขาย)
                    </h4>
                  </div>

                  {/* Pick dropdown */}
                  <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-200/80 space-y-2">
                    <p className="text-xs font-semibold text-purple-900">
                      คลิกเลือกหินที่ต้องการใส่ลงในบิลนี้:
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {availableProducts.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2 text-center">
                          ไม่มีหินสถานะพร้อมจำหน่ายในสต็อก (หรือขายหมดแล้ว)
                        </p>
                      ) : (
                        availableProducts.map((p) => {
                          const isPicked = selectedItems.some((i) => i.product_id === p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleSelectItem(p)}
                              disabled={isPicked}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition ${
                                isPicked
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-white hover:bg-purple-100/70 border border-slate-200 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {p.r2_thumbnail_url && (
                                  <img
                                    src={p.r2_thumbnail_url}
                                    alt=""
                                    className="w-7 h-7 rounded-lg object-cover"
                                  />
                                )}
                                <div>
                                  <span className="font-mono font-bold text-purple-700 mr-2">
                                    {p.sku}
                                  </span>
                                  <span className="font-semibold text-slate-800">{p.name}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">
                                  ฿{Number(p.selling_price).toLocaleString()}
                                </span>
                                {isPicked ? (
                                  <span className="text-[10px] text-slate-400">เลือกแล้ว</span>
                                ) : (
                                  <span className="text-[10px] text-purple-600 font-bold">+ เพิ่ม</span>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Selected Items Table in Form */}
                  {selectedItems.length > 0 && (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">หินที่เลือก</th>
                            <th className="py-2 px-3 text-right">ราคาขาย</th>
                            <th className="py-2 px-3 text-right">ราคาทุน</th>
                            <th className="py-2 px-2 text-center">ลบ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedItems.map((item) => (
                            <tr key={item.product_id}>
                              <td className="py-2.5 px-3">
                                <span className="font-mono font-bold text-purple-700 mr-1.5">
                                  {item.sku}
                                </span>
                                <span className="text-slate-800">{item.name}</span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                ฿{item.unit_price.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-400">
                                ฿{item.cost_price.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.product_id)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 3. Pricing, Discount & Payment */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    3. การเงิน, ส่วนลด & การชำระเงิน
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">ราคารวมสินค้า</label>
                      <input
                        type="text"
                        disabled
                        value={`฿${subtotal.toLocaleString()}`}
                        className="w-full px-3 py-2 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">ส่วนลด (บาท)</label>
                      <input
                        type="number"
                        min="0"
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">ค่าจัดส่ง (บาท)</label>
                      <input
                        type="number"
                        min="0"
                        value={shippingFee}
                        onChange={(e) => setShippingFee(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-purple-900">ยอดรวมสุทธิ (บาท)</label>
                      <input
                        type="text"
                        disabled
                        value={`฿${orderTotalAmount.toLocaleString()}`}
                        className="w-full px-3 py-2 text-sm font-black bg-purple-100 text-purple-950 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">ช่องทางชำระเงิน</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                      >
                        <option value="โอนเงิน (Mobile Banking)">โอนเงิน (Mobile Banking / QR)</option>
                        <option value="เงินสด (Cash)">เงินสด (Cash หน้าร้าน)</option>
                        <option value="บัตรเครดิต/เดบิต">บัตรเครดิต/เดบิต (Credit Card)</option>
                        <option value="เก็บเงินปลายทาง (COD)">เก็บเงินปลายทาง (COD)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">หมายเหตุบิล</label>
                      <input
                        type="text"
                        placeholder="เช่น ลูกค้าสั่งพิเศษ, นัดรับหน้าร้าน..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                      />
                    </div>
                  </div>

                  {/* Slip Upload */}
                  <div className="pt-2">
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      แนบสลิปโอนเงินลูกค้า (Cloudflare R2 WebP)
                    </label>
                    <ImageUploader
                      folder="receipts"
                      maxFiles={1}
                      images={orderSlipUrls}
                      onChange={setOrderSlipUrls}
                      label="สลิปโอนเงิน (WebP อัตโนมัติ)"
                      allowCamera={true}
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    * เมื่อกดยืนยัน หินทั้ง {selectedItems.length} ชิ้นจะถูกปรับเป็นสถานะ SOLD ทันที
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || selectedItems.length === 0}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-md hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50"
                    >
                      {isSubmitting ? 'กำลังบันทึกบิล...' : 'บันทึกเปิดบิล & พิมพ์ใบเสร็จ'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Printable Receipt Modal */}
        <ReceiptPrintModal
          order={selectedPrintOrder}
          onClose={() => setSelectedPrintOrder(null)}
        />

        {/* Lightbox for Slip Image */}
        {selectedSlipUrl && (
          <div
            onClick={() => setSelectedSlipUrl(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-4 max-w-lg w-full max-h-[85vh] flex flex-col relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-sm">
                  สลิปโอนเงินลูกค้า (Cloudflare R2)
                </h4>
                <button
                  onClick={() => setSelectedSlipUrl(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-auto py-3 flex items-center justify-center">
                <img
                  src={selectedSlipUrl}
                  alt="Customer Slip"
                  className="max-h-[65vh] object-contain rounded-xl"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
