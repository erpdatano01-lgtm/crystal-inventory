'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import ImageUploader from '@/components/ImageUploader';
import ReceiptPrintModal from '@/components/ReceiptPrintModal';
import ShippingLabelModal from '@/components/ShippingLabelModal';
import {
  fetchProducts,
  fetchExpenses,
  isPackagingItem,
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
  Gift,
  Gem,
  QrCode,
  Video,
  Zap,
  Pencil,
  RotateCcw,
} from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & UI states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<Order | null>(null);
  const [selectedLabelOrder, setSelectedLabelOrder] = useState<Order | null>(null);
  const [selectedSlipUrl, setSelectedSlipUrl] = useState<string | null>(null);
  const [editingTrackingOrder, setEditingTrackingOrder] = useState<Order | null>(null);
  const [trackingInputVal, setTrackingInputVal] = useState('');
  const [isUpdatingTracking, setIsUpdatingTracking] = useState(false);
  const [damagedLoss, setDamagedLoss] = useState<number>(0);
  const [damagedCount, setDamagedCount] = useState<number>(0);

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
  const [orderItemFilter, setOrderItemFilter] = useState<'SALE' | 'FREEBIE' | 'ALL'>('SALE');
  const [orderItemSearch, setOrderItemSearch] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpenBoxMode, setIsOpenBoxMode] = useState(false);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number>(1500);
  const [initialOrderStatus, setInitialOrderStatus] = useState<OrderStatus>('PENDING');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Add-to-Open-Box Modal state
  const [addingToBoxOrder, setAddingToBoxOrder] = useState<Order | null>(null);
  const [boxExtraItems, setBoxExtraItems] = useState<OrderItem[]>([]);
  const [boxExtraSearch, setBoxExtraSearch] = useState('');
  const [boxExtraPayMethod, setBoxExtraPayMethod] = useState('โอนเงิน (Mobile Banking)');
  const [boxExtraNote, setBoxExtraNote] = useState('');
  const [isSavingBoxAdd, setIsSavingBoxAdd] = useState(false);

  // Payment Modal state (opened when clicking ชำระเงิน or selecting PAID)
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [payModalMethod, setPayModalMethod] = useState('โอนเงิน (Mobile Banking)');
  const [payModalSlipUrls, setPayModalSlipUrls] = useState<string[]>([]);
  const [payModalNote, setPayModalNote] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // Period / Monthly P&L Filter state
  const [periodMode, setPeriodMode] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [damagedItems, setDamagedItems] = useState<Array<{ loss: number; created_at: string }>>([]);

  // Batch Tracking Scanner Modal state
  const [showBatchTrackingModal, setShowBatchTrackingModal] = useState(false);
  const [batchOrderInput, setBatchOrderInput] = useState('');
  const [batchTrackInput, setBatchTrackInput] = useState('');
  const [batchLogs, setBatchLogs] = useState<Array<{ orderNo: string; customer: string; trackingNo: string }>>([]);
  const [isSavingBatchTrack, setIsSavingBatchTrack] = useState(false);

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [ordRes, prodData, expData, dmgRes] = await Promise.all([
        fetch('/api/orders').then((r) => r.json()),
        fetchProducts(),
        fetchExpenses(),
        fetch('/api/products/handle-damaged').then((r) => r.json()).catch(() => ({ totalDamagedLoss: 0, count: 0 })),
      ]);
      if (Array.isArray(ordRes)) setOrders(ordRes);
      setProducts(prodData);
      setExpenses(expData);
      setDamagedLoss(Number(dmgRes?.totalDamagedLoss) || 0);
      setDamagedCount(Number(dmgRes?.count) || 0);
      setDamagedItems(Array.isArray(dmgRes?.items) ? dmgRes.items : []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-open Create Order Modal if navigated from /products with ?sell=SKU
  useEffect(() => {
    if (typeof window === 'undefined' || products.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const sellSku = params.get('sell');
    if (!sellSku) return;
    const target = products.find(
      (p) => p.sku.toUpperCase() === sellSku.trim().toUpperCase() && p.status === 'AVAILABLE' && p.qty_on_hand > 0
    );
    if (target) {
      setShowCreateModal(true);
      setSelectedItems((prev) => {
        if (prev.some((i) => i.product_id === target.id)) return prev;
        return [
          ...prev,
          {
            product_id: target.id,
            sku: target.sku,
            name: target.name,
            stone_type: target.stone_type,
            unit_price: Number(target.selling_price) || 0,
            cost_price: Number(target.cost_price) || 0,
            qty: 1,
            weight_grams: target.weight_grams,
            r2_thumbnail_url: target.r2_thumbnail_url,
          },
        ];
      });
      window.history.replaceState({}, '', '/orders');
    }
  }, [products]);

  // Products available to sell or gift (exclude internal packaging supplies)
  const availableProducts = useMemo(() => {
    return products.filter(
      (p) => p.status === 'AVAILABLE' && p.qty_on_hand > 0 && !isPackagingItem(p)
    );
  }, [products]);

  // Unique Customer Directory for 1-click Auto-fill on repeat orders
  const customerDirectory = useMemo(() => {
    const map = new Map<
      string,
      { name: string; phone: string; address: string; channel: SalesChannel }
    >();
    for (const o of orders) {
      const name = (o.customer_name || '').trim();
      if (!name || name.includes('ลูกค้าทั่วไป')) continue;
      if (!map.has(name)) {
        map.set(name, {
          name,
          phone: o.customer_phone || '',
          address: o.customer_address || '',
          channel: o.channel || 'WALK_IN',
        });
      } else {
        const existing = map.get(name)!;
        if (!existing.phone && o.customer_phone) existing.phone = o.customer_phone;
        if (!existing.address && o.customer_address) existing.address = o.customer_address;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [orders]);

  // Period Date Range Filtering
  const isDateInPeriod = (dateStr?: string | null): boolean => {
    if (periodMode === 'ALL') return true;
    const d = (dateStr || '').slice(0, 10);
    if (!d) return false;
    const now = new Date();
    const thisMonthPrefix = now.toISOString().slice(0, 7);
    if (periodMode === 'THIS_MONTH') {
      return d.startsWith(thisMonthPrefix);
    }
    if (periodMode === 'LAST_MONTH') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthPrefix = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
      return d.startsWith(lastMonthPrefix);
    }
    if (periodMode === 'CUSTOM') {
      if (customStartDate && d < customStartDate) return false;
      if (customEndDate && d > customEndDate) return false;
      return true;
    }
    return true;
  };

  const periodOrders = useMemo(
    () => orders.filter((o) => isDateInPeriod(o.order_date || o.created_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, periodMode, customStartDate, customEndDate]
  );

  const periodExpenses = useMemo(
    () => expenses.filter((e) => isDateInPeriod(e.expense_date || e.created_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, periodMode, customStartDate, customEndDate]
  );

  const periodDamagedLoss = useMemo(() => {
    if (periodMode === 'ALL') return damagedLoss;
    return damagedItems
      .filter((d) => isDateInPeriod(d.created_at))
      .reduce((s, d) => s + (Number(d.loss) || 0), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [damagedLoss, damagedItems, periodMode, customStartDate, customEndDate]);

  const periodDamagedCount = useMemo(() => {
    if (periodMode === 'ALL') return damagedCount;
    return damagedItems.filter((d) => isDateInPeriod(d.created_at)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [damagedCount, damagedItems, periodMode, customStartDate, customEndDate]);

  // Financial Summary (FlowAccount style, respects selected Period)
  const totalSalesRevenue = useMemo(() => {
    return periodOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  }, [periodOrders]);

  const totalCOGS = useMemo(() => {
    return periodOrders.reduce((sum, o) => sum + (o.total_cost || 0), 0);
  }, [periodOrders]);

  const grossProfit = totalSalesRevenue - totalCOGS;
  const grossMargin =
    totalSalesRevenue > 0 ? ((grossProfit / totalSalesRevenue) * 100).toFixed(1) : '0';

  const totalOperatingExpenses = useMemo(() => {
    return periodExpenses.reduce((sum, e) => sum + Number(e.total_amount || 0), 0);
  }, [periodExpenses]);

  const netProfit = grossProfit - totalOperatingExpenses - periodDamagedLoss;

  // Filter available products for order creation modal
  const filteredOrderPickerProducts = useMemo(() => {
    let list = availableProducts;
    if (orderItemFilter === 'FREEBIE') {
      list = list.filter((p) => p.sku?.startsWith('GIFT'));
    } else if (orderItemFilter === 'SALE') {
      list = list.filter((p) => !p.sku?.startsWith('GIFT'));
    }

    if (!orderItemSearch.trim()) return list;
    const q = orderItemSearch.toLowerCase();
    return list.filter(
      (p) =>
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.stone_type.toLowerCase().includes(q)
    );
  }, [availableProducts, orderItemFilter, orderItemSearch]);

  // Handle adding an item to order
  const handleSelectItem = (prod: Product) => {
    if (selectedItems.some((i) => i.product_id === prod.id)) return;
    const isFreebie = Boolean(prod.sku?.startsWith('GIFT'));
    const newItem: OrderItem = {
      product_id: prod.id,
      sku: prod.sku,
      name: prod.name,
      stone_type: prod.stone_type,
      unit_price: isFreebie ? 0 : (Number(prod.selling_price) || 0),
      cost_price: Number(prod.cost_price) || 0,
      qty: 1,
      is_freebie: isFreebie,
      weight_grams: prod.weight_grams,
      r2_thumbnail_url: prod.r2_thumbnail_url,
    };
    setSelectedItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItemQty = (productId: string, delta: number) => {
    const prod = availableProducts.find((p) => p.id === productId);
    const maxQty = prod ? Math.max(1, prod.qty_on_hand) : 999;
    setSelectedItems((prev) =>
      prev.map((it) => {
        if (it.product_id === productId) {
          const nextQty = Math.min(maxQty, Math.max(1, it.qty + delta));
          return { ...it, qty: nextQty };
        }
        return it;
      })
    );
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

  // Open Edit Modal for PENDING orders
  const openEditOrderModal = (ord: Order) => {
    setEditingOrder(ord);
    setCustomerName(ord.customer_name || '');
    setCustomerPhone(ord.customer_phone || '');
    setCustomerAddress(ord.customer_address || '');
    setChannel(ord.channel || 'WALK_IN');
    setPaymentMethod(ord.payment_method || 'โอนเงิน (Mobile Banking)');
    setTrackingNo(ord.tracking_no || '');
    setNotes(ord.notes || '');
    setDiscount(Number(ord.discount) || 0);
    setShippingFee(Number(ord.shipping_fee) || 0);
    setOrderSlipUrls(ord.slip_url ? [ord.slip_url] : []);
    setSelectedItems(ord.items || []);
    setIsOpenBoxMode(ord.status === 'OPEN_BOX' || Boolean(ord.is_open_box));
    setFreeShippingThreshold(Number(ord.free_shipping_threshold) || 1500);
    setInitialOrderStatus(ord.status || 'PENDING');
    setShowCreateModal(true);
  };

  // Submit Order (Create or Edit when PENDING)
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
      const targetStatus: OrderStatus = isOpenBoxMode ? 'OPEN_BOX' : initialOrderStatus;

      if (editingOrder) {
        const res = await fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingOrder.id,
            order_no: editingOrder.order_no,
            customer_name: customerName,
            customer_phone: customerPhone || null,
            customer_address: customerAddress || null,
            channel,
            payment_method: paymentMethod,
            slip_url: orderSlipUrls[0] || null,
            notes: notes || null,
            discount,
            shipping_fee: shippingFee,
            status: targetStatus,
            is_open_box: isOpenBoxMode,
            free_shipping_threshold: isOpenBoxMode ? freeShippingThreshold : null,
            replaceItems: selectedItems,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to update order');
        }

        const editedNo = editingOrder.order_no;
        setEditingOrder(null);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
        setSelectedItems([]);
        setDiscount(0);
        setShippingFee(0);
        setTrackingNo('');
        setNotes('');
        setOrderSlipUrls([]);
        setIsOpenBoxMode(false);
        setInitialOrderStatus('PENDING');
        setShowCreateModal(false);

        await loadData();
        alert(`แก้ไขบิล ${editedNo} เรียบร้อยแล้ว`);
        return;
      }

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
        status: targetStatus,
        is_open_box: isOpenBoxMode,
        free_shipping_threshold: isOpenBoxMode ? freeShippingThreshold : null,
        payment_logs: [
          {
            date: new Date().toISOString().slice(0, 10),
            amount: orderTotalAmount,
            method: paymentMethod,
            slip_url: orderSlipUrls[0] || null,
            note: isOpenBoxMode ? 'เปิดกล่องรอบที่ 1' : 'บันทึกบิล',
          },
        ],
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
      setIsOpenBoxMode(false);
      setInitialOrderStatus('PENDING');
      setShowCreateModal(false);

      // Reload data (FlowAccount style: stays on orders table with PENDING / OPEN_BOX status)
      await loadData();
      alert(
        isOpenBoxMode
          ? `เปิดกล่องสะสม ${created.order_no} สำเร็จ! (สะสม ฿${created.total_amount.toLocaleString()} / เป้าส่งฟรี ฿${freeShippingThreshold.toLocaleString()})`
          : `บันทึกบิล ${created.order_no} สถานะ "${ORDER_STATUS_CONFIG[targetStatus].label}" เรียบร้อยแล้ว`
      );
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open dedicated Payment Modal (Payment Method + Slip upload)
  const openPaymentModal = (ord: Order) => {
    setPayingOrder(ord);
    setPayModalMethod(ord.payment_method && ord.payment_method !== 'รอชำระเงิน' ? ord.payment_method : 'โอนเงิน (Mobile Banking)');
    setPayModalSlipUrls(ord.slip_url ? [ord.slip_url] : []);
    setPayModalNote('');
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingOrder) return;
    setIsSavingPayment(true);
    try {
      const slipUrl = payModalSlipUrls[0] || null;
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payingOrder.id,
          order_no: payingOrder.order_no,
          status: 'PAID',
          is_open_box: false,
          payment_method: payModalMethod,
          slip_url: slipUrl,
          appendPayment: {
            date: new Date().toISOString().slice(0, 10),
            amount: payingOrder.total_amount,
            method: payModalMethod,
            slip_url: slipUrl,
            note: payModalNote || 'รับชำระเงินแล้ว',
          },
        }),
      });
      if (!res.ok) throw new Error('Payment update failed');
      setPayingOrder(null);
      setPayModalSlipUrls([]);
      setPayModalNote('');
      await loadData();
    } catch {
      alert('ไม่สามารถบันทึกการชำระเงินได้');
    } finally {
      setIsSavingPayment(false);
    }
  };

  // Reset order back to PENDING (clears payment, slip, tracking)
  const handleResetOrderToPending = async (ord: Order) => {
    if (
      !confirm(
        `รีเซ็ตบิล "${ord.order_no}" กลับเป็นสถานะ "รอดำเนินการ"?\n\nข้อมูลการชำระเงิน, สลิป และเลขพัสดุของบิลนี้จะถูกล้างกลับเป็นค่าเริ่มต้น`
      )
    ) {
      return;
    }
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ord.id,
          order_no: ord.order_no,
          status: 'PENDING',
          is_open_box: false,
          slip_url: null,
          tracking_no: null,
          payment_method: 'รอชำระเงิน',
          payment_logs: [],
        }),
      });
      if (res.ok) {
        await loadData();
      } else {
        alert('ไม่สามารถรีเซ็ตบิลได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการรีเซ็ตบิล');
    }
  };

  // FlowAccount-style quick status update on any order row
  const handleQuickOrderStatusChange = async (ord: Order, nextStatus: OrderStatus) => {
    // Cannot switch back to PENDING directly via dropdown (must use Reset button)
    if (nextStatus === 'PENDING' && ord.status !== 'PENDING') {
      alert('กรุณากดปุ่ม "🔄 รีเซ็ต" เพื่อล้างข้อมูลและย้อนกลับไปสถานะรอดำเนินการ');
      return;
    }
    // Switching to PAID opens the dedicated Payment + Slip Modal
    if (nextStatus === 'PAID' && ord.status !== 'PAID') {
      openPaymentModal(ord);
      return;
    }
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ord.id,
          order_no: ord.order_no,
          status: nextStatus,
          is_open_box: nextStatus === 'OPEN_BOX',
        }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === ord.id || o.order_no === ord.order_no
              ? { ...o, status: nextStatus, is_open_box: nextStatus === 'OPEN_BOX' }
              : o
          )
        );
      } else {
        alert('ไม่สามารถเปลี่ยนสถานะบิลได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ');
    }
  };

  // Append new stones + payment round into an existing Open Box order
  const handleAddItemsToBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingToBoxOrder || boxExtraItems.length === 0) return;
    setIsSavingBoxAdd(true);
    try {
      const extraAmount = boxExtraItems.reduce((s, i) => s + i.unit_price * i.qty, 0);
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: addingToBoxOrder.id,
          order_no: addingToBoxOrder.order_no,
          appendItems: boxExtraItems,
          appendPayment: {
            date: new Date().toISOString().slice(0, 10),
            amount: extraAmount,
            method: boxExtraPayMethod,
            note: boxExtraNote || `เพิ่มหินเข้ากล่อง (${boxExtraItems.length} ชิ้น)`,
          },
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to append items');
      }
      setAddingToBoxOrder(null);
      setBoxExtraItems([]);
      setBoxExtraNote('');
      setBoxExtraSearch('');
      await loadData();
    } catch (err: any) {
      alert(`เพิ่มหินเข้ากล่องไม่สำเร็จ: ${err?.message || ''}`);
    } finally {
      setIsSavingBoxAdd(false);
    }
  };

  // Update Tracking No (Flexible post-billing / post-packing tracking update)
  const handleSaveTrackingNo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingTrackingOrder) return;
    setIsUpdatingTracking(true);
    try {
      const cleanTrack = trackingInputVal.trim() || null;
      const nextStatus: OrderStatus = cleanTrack ? 'SHIPPED' : editingTrackingOrder.status;

      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTrackingOrder.id,
          order_no: editingTrackingOrder.order_no,
          tracking_no: cleanTrack,
          status: nextStatus,
        }),
      });

      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === editingTrackingOrder.id || o.order_no === editingTrackingOrder.order_no
              ? { ...o, tracking_no: cleanTrack, status: nextStatus }
              : o
          )
        );
        setEditingTrackingOrder(null);
        setTrackingInputVal('');
      } else {
        alert('ไม่สามารถอัปเดตเลขพัสดุได้');
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกเลขพัสดุ');
    } finally {
      setIsUpdatingTracking(false);
    }
  };

  // Delete Order
  const handleDeleteOrder = async (orderId: string, orderNo: string) => {
    const restore = confirm(
      `ยืนยันการลบบิล "${orderNo}"?\n\nกด "ตกลง (OK)" เพื่อลบบิลและคืนสินค้ากลับเข้าสต็อก (AVAILABLE)\nหรือกด "ยกเลิก (Cancel)" เพื่อไม่ทำรายการ`
    );
    if (!restore) return;

    try {
      const res = await fetch(
        `/api/orders?id=${encodeURIComponent(orderId)}&order_no=${encodeURIComponent(orderNo)}&restoreStock=true`,
        {
          method: 'DELETE',
        }
      );
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId && o.order_no !== orderNo));
        await loadData();
        alert(`ลบบิล ${orderNo} และคืนสต็อกเรียบร้อยแล้ว`);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`ไม่สามารถลบบิลได้: ${err?.error || 'เกิดข้อผิดพลาดในการลบบิล'}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`เกิดข้อผิดพลาดในการลบบิล: ${err?.message || ''}`);
    }
  };

  // Batch Tracking Save
  const handleSaveBatchTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawOrder = batchOrderInput.trim();
    const rawTrack = batchTrackInput.trim();
    if (!rawOrder || !rawTrack) return;

    // Extract order_no if scanned from QR URL (?order_no=...)
    let resolvedOrderNo = rawOrder;
    try {
      if (rawOrder.includes('order_no=')) {
        const u = new URL(rawOrder.startsWith('http') ? rawOrder : `https://x.com?${rawOrder}`);
        resolvedOrderNo = u.searchParams.get('order_no') || rawOrder;
      }
    } catch {
      // keep rawOrder
    }

    const matched = orders.find(
      (o) =>
        o.order_no.toLowerCase() === resolvedOrderNo.toLowerCase() ||
        o.id.toLowerCase() === resolvedOrderNo.toLowerCase()
    );
    if (!matched) {
      alert(`ไม่พบบิลเลขที่ "${resolvedOrderNo}"`);
      return;
    }

    setIsSavingBatchTrack(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: matched.id,
          order_no: matched.order_no,
          tracking_no: rawTrack,
          status: 'SHIPPED',
        }),
      });
      if (!res.ok) throw new Error('Update failed');

      setOrders((prev) =>
        prev.map((o) =>
          o.id === matched.id || o.order_no === matched.order_no
            ? { ...o, tracking_no: rawTrack, status: 'SHIPPED' }
            : o
        )
      );
      setBatchLogs((prev) => [
        { orderNo: matched.order_no, customer: matched.customer_name, trackingNo: rawTrack },
        ...prev,
      ]);
      setBatchOrderInput('');
      setBatchTrackInput('');
    } catch {
      alert('ไม่สามารถบันทึกเลขพัสดุได้');
    } finally {
      setIsSavingBatchTrack(false);
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return periodOrders.filter((o) => {
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
  }, [periodOrders, searchQuery, selectedChannel, selectedStatus]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-12 md:pl-64 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0">
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

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <button
              type="button"
              onClick={() => {
                setBatchLogs([]);
                setBatchOrderInput('');
                setBatchTrackInput('');
                setShowBatchTrackingModal(true);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-sm active:scale-95 transition"
            >
              <Truck className="w-4 h-4 text-emerald-400" />
              <span>ยิงเลขพัสดุรวดเดียว</span>
            </button>

            <button
              onClick={() => {
                setEditingOrder(null);
                setShowCreateModal(true);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-600/20 hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition"
            >
              <PlusCircle className="w-5 h-5" />
              <span>+ เปิดบิลขายใหม่</span>
            </button>
          </div>
        </div>

        {/* Period / Monthly Filter Bar */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-xs font-bold text-slate-500 px-1.5 shrink-0">ช่วงเวลาบัญชี:</span>
            {[
              { id: 'ALL', label: 'ทั้งหมด' },
              { id: 'THIS_MONTH', label: 'เดือนนี้' },
              { id: 'LAST_MONTH', label: 'เดือนที่แล้ว' },
              { id: 'CUSTOM', label: 'กำหนดเอง' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodMode(p.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                  periodMode === p.id
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {periodMode === 'CUSTOM' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
              />
              <span className="text-slate-400">ถึง</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
              />
            </div>
          )}
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
              <p className="text-[11px] text-slate-400 mt-1">จาก {periodOrders.length} บิลขาย</p>
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

          {/* Card 4: Operating Expenses & Damaged Loss */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-2">
              <span>4. ค่าใช้จ่าย &amp; สูญเสีย</span>
              <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-rose-600">
                -฿{(totalOperatingExpenses + periodDamagedLoss).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {periodDamagedLoss > 0
                  ? `รายจ่าย ฿${totalOperatingExpenses.toLocaleString()} + แตก ${periodDamagedCount} ชิ้น (฿${periodDamagedLoss.toLocaleString()})`
                  : 'ล็อตหิน/ส่ง/กล่อง/บูธ/Ads'}
              </p>
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
                className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-2xl text-base sm:text-sm border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
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
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                รายการบิลขายทั้งหมด ({filteredOrders.length})
              </h3>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { key: '', label: `ทั้งหมด (${orders.length})` },
                { key: 'OPEN_BOX', label: `📦 เปิดกล่อง (${orders.filter((o) => o.status === 'OPEN_BOX').length})` },
                { key: 'PENDING', label: `⏳ รอดำเนินการ (${orders.filter((o) => o.status === 'PENDING').length})` },
                { key: 'PAID', label: `✅ ชำระแล้ว (${orders.filter((o) => o.status === 'PAID').length})` },
                { key: 'SHIPPED', label: `🚚 จัดส่งแล้ว (${orders.filter((o) => o.status === 'SHIPPED').length})` },
              ].map((tab) => (
                <button
                  key={tab.key || 'ALL'}
                  type="button"
                  onClick={() => setSelectedStatus(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                    selectedStatus === tab.key
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
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
                            {ord.items.map((it, idx) => {
                              const isGift = Boolean(it.sku?.startsWith('GIFT'));
                              return (
                                <div key={idx} className="flex items-center gap-1.5 text-xs">
                                  <span className="font-mono text-purple-600 font-semibold">
                                    {it.sku}
                                  </span>
                                  {isGift && (
                                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1 rounded">
                                      ของแถม
                                    </span>
                                  )}
                                  <span className="text-slate-700 truncate max-w-[140px]">
                                    {it.name}
                                  </span>
                                  <span className="text-slate-400 font-medium">x{it.qty}</span>
                                </div>
                              );
                            })}
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
                          <div className="flex flex-col items-center gap-1.5">
                            {/* FlowAccount-style inline status dropdown */}
                            <select
                              value={ord.status}
                              onChange={(e) =>
                                handleQuickOrderStatusChange(ord, e.target.value as OrderStatus)
                              }
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer outline-none ${statusConfig.badgeClass}`}
                            >
                              {Object.entries(ORDER_STATUS_CONFIG).map(([k, cfg]) => (
                                <option
                                  key={k}
                                  value={k}
                                  disabled={k === 'PENDING' && ord.status !== 'PENDING'}
                                  className="bg-white text-slate-900"
                                >
                                  {cfg.label}
                                </option>
                              ))}
                            </select>

                            {/* Open Box Free-Shipping Progress & Actions */}
                            {ord.status === 'OPEN_BOX' && (() => {
                              const threshold = Number(ord.free_shipping_threshold) || 1500;
                              const currentTotal = Number(ord.total_amount) || 0;
                              const pct = Math.min(100, Math.round((currentTotal / threshold) * 100));
                              const reached = currentTotal >= threshold;
                              return (
                                <div className="w-44 p-2 rounded-xl bg-indigo-50/70 border border-indigo-200 text-left space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px] font-bold">
                                    <span className={reached ? 'text-emerald-700' : 'text-indigo-800'}>
                                      {reached ? '🎉 ครบส่งฟรีแล้ว!' : `สะสม ${pct}%`}
                                    </span>
                                    <span className="text-slate-600">
                                      ฿{currentTotal.toLocaleString()}/{threshold.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 bg-white rounded-full overflow-hidden border border-indigo-100">
                                    <div
                                      className={`h-full transition-all ${
                                        reached ? 'bg-emerald-500' : 'bg-indigo-500'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAddingToBoxOrder(ord);
                                        setBoxExtraItems([]);
                                        setBoxExtraNote('');
                                        setBoxExtraSearch('');
                                      }}
                                      className="flex-1 py-1 px-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition"
                                    >
                                      + เพิ่มหินเข้ากล่อง
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await handleQuickOrderStatusChange(ord, 'PENDING');
                                        setSelectedLabelOrder({ ...ord, status: 'PENDING', is_open_box: false });
                                      }}
                                      className="py-1 px-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition"
                                      title="ปิดกล่อง & เตรียมส่ง"
                                    >
                                      ปิดกล่อง
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Flexible Tracking No Badge / Add Button */}
                            {ord.tracking_no ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTrackingOrder(ord);
                                  setTrackingInputVal(ord.tracking_no || '');
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-mono text-[10px] font-bold transition"
                                title="คลิกเพื่อแก้ไขเลขพัสดุ"
                              >
                                <Truck className="w-3 h-3 text-blue-600" />
                                <span>{ord.tracking_no}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTrackingOrder(ord);
                                  setTrackingInputVal('');
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-700 border border-dashed border-slate-300 hover:border-purple-300 text-[10px] font-bold transition"
                                title="ใส่หรือสแกนเลขพัสดุทีหลังได้"
                              >
                                <Truck className="w-3 h-3" />
                                <span>+ ใส่เลขพัสดุ</span>
                              </button>
                            )}

                            {/* Packing Video Link if recorded */}
                            {ord.packing_video_url &&
                              (ord.packing_video_url.startsWith('blob:') ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold"
                                  title="คลิปนี้อัดไว้ก่อนอัปเกรดระบบคลาวด์ (ไม่ได้อัปโหลดขึ้น R2)"
                                >
                                  <Video className="w-3 h-3" />
                                  <span>คลิปเก่าไม่อยู่บนคลาวด์</span>
                                </span>
                              ) : (
                                <a
                                  href={ord.packing_video_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold transition"
                                  title="เปิดดูคลิปวิดีโอหลักฐานการแพ็กของบิลนี้"
                                >
                                  <Video className="w-3 h-3" />
                                  <span>ดูคลิปแพ็ก</span>
                                </a>
                              ))}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Print Shipping Label Button (QR + Barcode for Packing Station) */}
                            <button
                              type="button"
                              onClick={() => setSelectedLabelOrder(ord)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition"
                              title="พิมพ์ใบปะหน้าซองพัสดุ (มี QR & Barcode สำหรับสแกนแพ็กของ)"
                            >
                              <QrCode className="w-3.5 h-3.5 text-amber-700" />
                              <span>ใบปะหน้า</span>
                            </button>

                            {/* Go to Video Packing Station for this Order */}
                            <Link
                              href={`/packing?order_no=${encodeURIComponent(ord.order_no)}`}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition"
                              title="เปิดหน้าอัดคลิปแพ็กของสำหรับบิลนี้"
                            >
                              <Video className="w-3.5 h-3.5 text-emerald-600" />
                              <span>แพ็กของ</span>
                            </Link>

                            {/* Print Receipt Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedPrintOrder(ord)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition"
                              title="พิมพ์ใบเสร็จรับเงิน / บิลส่งของ"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>ใบเสร็จ</span>
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

                            {/* Payment Button (Only when PENDING or WAITING_PAYMENT) */}
                            {(ord.status === 'PENDING' || ord.status === 'WAITING_PAYMENT') && (
                              <button
                                type="button"
                                onClick={() => openPaymentModal(ord)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                                title="รับชำระเงิน & แนบสลิป"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>ชำระเงิน</span>
                              </button>
                            )}

                            {/* Reset back to PENDING Button (When not PENDING) */}
                            {ord.status !== 'PENDING' && (
                              <button
                                type="button"
                                onClick={() => handleResetOrderToPending(ord)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 rounded-xl text-xs font-bold transition"
                                title="รีเซ็ตข้อมูลชำระเงิน/จัดส่ง กลับไปเป็นสถานะรอดำเนินการ"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>รีเซ็ต</span>
                              </button>
                            )}

                            {/* Edit Order Button (Allowed when status is PENDING, OPEN_BOX, or WAITING_PAYMENT) */}
                            {(ord.status === 'PENDING' ||
                              ord.status === 'OPEN_BOX' ||
                              ord.status === 'WAITING_PAYMENT') && (
                              <button
                                type="button"
                                onClick={() => openEditOrderModal(ord)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition"
                                title="แก้ไขบิล (ทำได้ขณะที่สถานะเป็นรอดำเนินการ / เปิดกล่อง / รอชำระเงิน)"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>แก้ไข</span>
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
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90dvh]">
              <div className="shrink-0 px-5 py-4 sm:p-6 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                    <span className="truncate">
                      {editingOrder
                        ? `แก้ไขบิล ${editingOrder.order_no}`
                        : 'เปิดบิลขายใหม่ (New Sales Invoice)'}
                    </span>
                  </h3>
                  <p className="text-xs text-purple-200 mt-0.5 truncate">
                    {editingOrder
                      ? 'แก้ไขข้อมูลลูกค้า รายการสินค้า หรือส่วนลดได้ขณะที่สถานะเป็นรอดำเนินการ'
                      : 'เลือกหินที่ขาย ระบบจะตัดสต็อกและบันทึกลงบัญชีอัตโนมัติ'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="submit"
                    form="create-order-form"
                    disabled={isSubmitting || selectedItems.length === 0}
                    className="px-3.5 py-2 min-h-[38px] text-xs font-bold rounded-xl bg-white/20 hover:bg-white/30 text-white active:scale-95 transition disabled:opacity-40"
                  >
                    {isSubmitting ? 'กำลังบันทึก...' : editingOrder ? 'บันทึกการแก้ไข' : 'บันทึก'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingOrder(null);
                    }}
                    className="p-2 rounded-full hover:bg-white/10 text-white shrink-0"
                    aria-label="ปิดหน้าต่าง"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form id="create-order-form" onSubmit={handleCreateOrder} className="flex flex-col flex-1 min-h-0">
                <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain space-y-6 flex-1">
                {/* 0. Order Mode (Normal Pending Bill vs Open Box) */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpenBoxMode(false);
                        setInitialOrderStatus('PENDING');
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                        !isOpenBoxMode
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🧾 บิลขายปกติ (รอดำเนินการ)
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOpenBoxMode(true)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                        isOpenBoxMode
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      📦 เปิดกล่องสะสม (รอครบส่งฟรี)
                    </button>
                  </div>

                  {isOpenBoxMode ? (
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <span className="text-xs font-semibold text-indigo-900">
                        🎯 ยอดสะสมครบส่งฟรี (฿):
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={freeShippingThreshold}
                        onChange={(e) => setFreeShippingThreshold(Number(e.target.value) || 0)}
                        className="w-32 px-3 py-1.5 text-sm font-bold text-right bg-white border border-indigo-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  ) : editingOrder ? (
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <span className="text-xs font-semibold text-slate-700">
                        สถานะบิล:
                      </span>
                      <select
                        value={initialOrderStatus}
                        onChange={(e) => setInitialOrderStatus(e.target.value as OrderStatus)}
                        className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="PENDING">⏳ รอดำเนินการ (Pending)</option>
                        <option value="PAID">✅ ชำระเงินแล้ว (Paid)</option>
                        <option value="WAITING_PAYMENT">💸 รอชำระเงิน (Unpaid)</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 pt-1 text-xs">
                      <span className="font-semibold text-slate-600">สถานะเริ่มต้นหลังเปิดบิล:</span>
                      <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200 font-bold">
                        ⏳ รอดำเนินการ (Pending)
                      </span>
                    </div>
                  )}
                </div>

                {/* 1. Customer Information */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span>1. ข้อมูลลูกค้า &amp; ช่องทางการขาย</span>
                    </h4>
                    {customerDirectory.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          const c = customerDirectory.find((x) => x.name === e.target.value);
                          if (c) {
                            setCustomerName(c.name);
                            if (c.phone) setCustomerPhone(c.phone);
                            if (c.address) setCustomerAddress(c.address);
                            setChannel(c.channel);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">👥 เลือกลูกค้าเดิมเพื่อเติมข้อมูลอัตโนมัติ...</option>
                        {customerDirectory.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name} {c.phone ? `(${c.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-xs font-semibold text-slate-700">ชื่อลูกค้า *</label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น คุณกมลวรรณ / ลูกค้าหน้าร้าน"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">เบอร์โทรศัพท์</label>
                      <input
                        type="text"
                        placeholder="08x-xxx-xxxx"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">ช่องทางจำหน่าย</label>
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as SalesChannel)}
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {Object.entries(SALES_CHANNELS_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">ที่อยู่จัดส่งพัสดุ</label>
                    <textarea
                      rows={2}
                      placeholder="บ้านเลขที่ ตำบล อำเภอ จังหวัด รหัสไปรษณีย์..."
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* 2. Select Items from Stock */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span>2. เลือกสินค้า & ของแถมลงในบิล</span>
                      <span className="text-[11px] font-normal text-slate-500">
                        ({availableProducts.length} ชิ้นพร้อมจำหน่าย)
                      </span>
                    </h4>
                  </div>

                  {/* Pick dropdown with Category tabs & search */}
                  <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-200/80 space-y-2.5">
                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1.5 p-1 bg-white/80 rounded-xl border border-purple-200">
                      <button
                        type="button"
                        onClick={() => setOrderItemFilter('SALE')}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition ${
                          orderItemFilter === 'SALE'
                            ? 'bg-purple-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        💎 สินค้าขาย ({availableProducts.filter((p) => !p.sku?.startsWith('GIFT')).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderItemFilter('FREEBIE')}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition ${
                          orderItemFilter === 'FREEBIE'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-emerald-700 hover:text-emerald-900'
                        }`}
                      >
                        🎁 ของแถม ({availableProducts.filter((p) => p.sku?.startsWith('GIFT')).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderItemFilter('ALL')}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition ${
                          orderItemFilter === 'ALL'
                            ? 'bg-slate-700 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ทั้งหมด ({availableProducts.length})
                      </button>
                    </div>

                    {/* Search box in order picker */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={orderItemSearch}
                        onChange={(e) => setOrderItemSearch(e.target.value)}
                        placeholder="พิมพ์ค้นหา SKU หรือชื่อสินค้า/ของแถม..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                      {filteredOrderPickerProducts.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center">
                          ไม่พบรายการที่ตรงกับการค้นหา
                        </p>
                      ) : (
                        filteredOrderPickerProducts.map((p) => {
                          const isPicked = selectedItems.some((i) => i.product_id === p.id);
                          const isGift = Boolean(p.sku?.startsWith('GIFT'));
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleSelectItem(p)}
                              disabled={isPicked}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition ${
                                isPicked
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : isGift
                                  ? 'bg-emerald-50/70 hover:bg-emerald-100/90 border border-emerald-200 shadow-2xs'
                                  : 'bg-white hover:bg-purple-100/70 border border-slate-200 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {p.r2_thumbnail_url ? (
                                  <img
                                    src={p.r2_thumbnail_url}
                                    alt=""
                                    className="w-7 h-7 rounded-lg object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 text-slate-500">
                                    {isGift ? <Gift className="w-3.5 h-3.5 text-emerald-600" /> : <Gem className="w-3.5 h-3.5 text-purple-600" />}
                                  </div>
                                )}
                                <div className="truncate">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="font-mono font-bold text-purple-700">
                                      {p.sku}
                                    </span>
                                    {p.campaign_tag && (
                                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                        🏷️ {p.campaign_tag}
                                      </span>
                                    )}
                                    {isGift && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        ของแถม
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-semibold text-slate-800 text-[11px] truncate block">{p.name}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className={`font-bold ${isGift ? 'text-emerald-700' : 'text-slate-900'}`}>
                                  {isGift ? 'FREE GIFT (฿0)' : `฿${Number(p.selling_price).toLocaleString()}`}
                                </span>
                                {isPicked ? (
                                  <span className="text-[10px] text-slate-400 font-medium">เลือกแล้ว</span>
                                ) : (
                                  <span className={`text-[10px] font-bold ${isGift ? 'text-emerald-700' : 'text-purple-600'}`}>
                                    + เพิ่ม
                                  </span>
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
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3 text-left">รายการที่เลือก ({selectedItems.length})</th>
                            <th className="py-2 px-2 text-center w-24">จำนวน</th>
                            <th className="py-2 px-3 text-right">ราคาขาย</th>
                            <th className="py-2 px-3 text-right">ราคาทุน</th>
                            <th className="py-2 px-2 text-center w-8">ลบ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedItems.map((item) => {
                            const isGift = Boolean(item.sku?.startsWith('GIFT'));
                            return (
                              <tr key={item.product_id} className={isGift ? 'bg-emerald-50/40' : 'bg-white'}>
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-bold text-purple-700">
                                      {item.sku}
                                    </span>
                                    {isGift && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        🎁 ของแถม
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-slate-800 text-[11px] block">{item.name}</span>
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <div className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-lg border border-slate-200">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItemQty(item.product_id, -1)}
                                      className="text-slate-600 hover:text-black font-bold px-1 text-xs"
                                    >
                                      -
                                    </button>
                                    <span className="font-bold text-slate-800 text-xs min-w-4 text-center">
                                      {item.qty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItemQty(item.product_id, 1)}
                                      className="text-slate-600 hover:text-black font-bold px-1 text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold">
                                  {isGift ? (
                                    <span className="text-emerald-700 font-bold">฿0 (แถมฟรี)</span>
                                  ) : (
                                    <span className="text-slate-900">
                                      ฿{(item.unit_price * item.qty).toLocaleString()}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right text-slate-400 text-[11px]">
                                  ฿{(item.cost_price * item.qty).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.product_id)}
                                    className="text-rose-500 hover:text-rose-700 p-1"
                                    title="ลบรายการ"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
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
                        className="w-full px-3 py-2 text-base sm:text-xs font-bold bg-slate-100 text-slate-700 rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">ส่วนลด (บาท)</label>
                      <input
                        type="number"
                        min="0"
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">ค่าจัดส่ง (บาท)</label>
                      <input
                        type="number"
                        min="0"
                        value={shippingFee}
                        onChange={(e) => setShippingFee(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-purple-900">ยอดรวมสุทธิ (บาท)</label>
                      <input
                        type="text"
                        disabled
                        value={`฿${orderTotalAmount.toLocaleString()}`}
                        className="w-full px-3 py-2 text-base sm:text-sm font-black bg-purple-100 text-purple-950 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className={`grid grid-cols-1 ${editingOrder ? 'sm:grid-cols-2' : ''} gap-3 pt-2`}>
                    {editingOrder && (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">ช่องทางชำระเงิน</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                        >
                          <option value="โอนเงิน (Mobile Banking)">โอนเงิน (Mobile Banking / QR)</option>
                          <option value="เงินสด (Cash)">เงินสด (Cash หน้าร้าน)</option>
                          <option value="บัตรเครดิต/เดบิต">บัตรเครดิต/เดบิต (Credit Card)</option>
                          <option value="เก็บเงินปลายทาง (COD)">เก็บเงินปลายทาง (COD)</option>
                        </select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">หมายเหตุบิล</label>
                      <input
                        type="text"
                        placeholder="เช่น ลูกค้าสั่งพิเศษ, นัดรับหน้าร้าน..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
                </div>

                {/* Pinned Submit Action Footer */}
                <div className="shrink-0 px-5 sm:px-6 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="text-[11px] sm:text-xs text-slate-500">
                    * เมื่อกดยืนยัน หินทั้ง {selectedItems.length} ชิ้นจะถูกปรับเป็นสถานะ SOLD ทันที
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 sm:flex-initial px-4 py-3 sm:py-2.5 min-h-[46px] rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || selectedItems.length === 0}
                      className="flex-[2] sm:flex-initial px-6 py-3 sm:py-2.5 min-h-[46px] rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm shadow-md hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition disabled:opacity-50"
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
          onOpenShippingLabel={(ord) => {
            setSelectedPrintOrder(null);
            setSelectedLabelOrder(ord);
          }}
        />

        {/* Shipping Label & Packing Slip Modal (QR + Code 128 Barcode) */}
        <ShippingLabelModal
          order={selectedLabelOrder}
          onClose={() => setSelectedLabelOrder(null)}
          onSwitchToReceipt={(ord) => {
            setSelectedLabelOrder(null);
            setSelectedPrintOrder(ord);
          }}
        />

        {/* Flexible Tracking No. Update Modal */}
        {editingTrackingOrder && (
          <div
            onClick={() => setEditingTrackingOrder(null)}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSaveTrackingNo}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="font-black text-slate-900 text-base flex items-center gap-2">
                    <Truck className="w-5 h-5 text-purple-600" />
                    <span>อัปเดตเลขพัสดุจัดส่ง (Tracking No.)</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    บิล: <strong className="font-mono text-purple-700">{editingTrackingOrder.order_no}</strong> • {editingTrackingOrder.customer_name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTrackingOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  สแกนบาร์โค้ดสลิปขนส่ง หรือพิมพ์เลขพัสดุ:
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="เช่น TH0123456789A, EF123456789TH..."
                  value={trackingInputVal}
                  onChange={(e) => setTrackingInputVal(e.target.value)}
                  className="w-full px-4 py-3 text-sm font-mono font-bold bg-slate-50 border-2 border-purple-200 rounded-2xl focus:bg-white focus:outline-none focus:border-purple-600 transition"
                />
                <p className="text-[11px] text-slate-400">
                  * เมื่อบันทึกเลขพัสดุ ระบบจะปรับสถานะบิลเป็น &quot;จัดส่งแล้ว (SHIPPED)&quot; ให้อัตโนมัติ
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTrackingOrder(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingTracking}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-black shadow-md hover:from-purple-700 hover:to-indigo-700 transition disabled:opacity-50"
                >
                  {isUpdatingTracking ? 'กำลังบันทึก...' : '💾 บันทึกเลขพัสดุ'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lightbox for Slip Image */}
        {selectedSlipUrl && (
          <div
            onClick={() => setSelectedSlipUrl(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-4 max-w-lg w-full max-h-[85dvh] flex flex-col relative"
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

        {/* Add Items & Payment Round to Existing Open Box Modal */}
        {addingToBoxOrder && (
          <div
            onClick={() => setAddingToBoxOrder(null)}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-2xl max-h-[88dvh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="p-5 bg-indigo-900 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-bold text-base">
                    📦 เพิ่มหินเข้ากล่อง {addingToBoxOrder.order_no}
                  </h3>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    ลูกค้า: {addingToBoxOrder.customer_name} • สะสมเดิม ฿
                    {addingToBoxOrder.total_amount.toLocaleString()} / เป้าส่งฟรี ฿
                    {(Number(addingToBoxOrder.free_shipping_threshold) || 1500).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddingToBoxOrder(null)}
                  className="p-1.5 rounded-full hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddItemsToBox} className="flex flex-col flex-1 min-h-0">
                <div className="p-5 overflow-y-auto space-y-4 flex-1">
                  {/* Search Available Stones & Gifts */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ค้นหา SKU หรือชื่อหินที่จะเพิ่มเข้ากล่อง..."
                      value={boxExtraSearch}
                      onChange={(e) => setBoxExtraSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {availableProducts
                      .filter((p) => {
                        if (!boxExtraSearch.trim()) return true;
                        const q = boxExtraSearch.toLowerCase();
                        return (
                          p.sku.toLowerCase().includes(q) ||
                          p.name.toLowerCase().includes(q) ||
                          p.stone_type.toLowerCase().includes(q)
                        );
                      })
                      .map((p) => {
                        const picked = boxExtraItems.some((i) => i.product_id === p.id);
                        const isGift = Boolean(p.sku?.startsWith('GIFT'));
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={picked}
                            onClick={() => {
                              setBoxExtraItems((prev) => [
                                ...prev,
                                {
                                  product_id: p.id,
                                  sku: p.sku,
                                  name: p.name,
                                  stone_type: p.stone_type,
                                  unit_price: isGift ? 0 : Number(p.selling_price) || 0,
                                  cost_price: Number(p.cost_price) || 0,
                                  qty: 1,
                                  is_freebie: isGift,
                                  weight_grams: p.weight_grams,
                                  r2_thumbnail_url: p.r2_thumbnail_url,
                                },
                              ]);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition ${
                              picked
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : 'bg-white hover:bg-indigo-50 border-slate-200'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="font-mono font-bold text-indigo-700 mr-2">
                                {p.sku}
                              </span>
                              <span className="font-semibold text-slate-900">{p.name}</span>
                            </div>
                            <span className="font-bold text-slate-800 shrink-0 ml-2">
                              {isGift ? '฿0 (ของแถม)' : `฿${Number(p.selling_price || 0).toLocaleString()}`}
                            </span>
                          </button>
                        );
                      })}
                  </div>

                  {/* Selected Extra Items */}
                  {boxExtraItems.length > 0 && (
                    <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                      <p className="text-xs font-bold text-indigo-900">
                        รายการที่เลือกเพิ่มรอบนี้ ({boxExtraItems.length} ชิ้น):
                      </p>
                      {boxExtraItems.map((it, idx) => (
                        <div key={it.product_id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-semibold text-slate-800">
                            {it.sku} • {it.name}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="number"
                              min={0}
                              value={it.unit_price}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setBoxExtraItems((prev) =>
                                  prev.map((x, i) => (i === idx ? { ...x, unit_price: val } : x))
                                );
                              }}
                              className="w-20 px-2 py-1 text-right font-bold bg-white border border-indigo-200 rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setBoxExtraItems((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-rose-500 hover:text-rose-700 font-bold px-1"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}

                      {(() => {
                        const addSum = boxExtraItems.reduce((s, i) => s + i.unit_price * i.qty, 0);
                        const nextTotal = addingToBoxOrder.total_amount + addSum;
                        const threshold =
                          Number(addingToBoxOrder.free_shipping_threshold) || 1500;
                        const reached = nextTotal >= threshold;
                        return (
                          <div className="pt-2 border-t border-indigo-200 flex items-center justify-between text-xs font-bold">
                            <span className={reached ? 'text-emerald-700' : 'text-indigo-800'}>
                              {reached
                                ? '🎉 รอบนี้ครบโควต้าส่งฟรีแล้ว!'
                                : `ขาดอีก ฿${(threshold - nextTotal).toLocaleString()} จะครบส่งฟรี`}
                            </span>
                            <span className="text-slate-900">
                              ยอดรวมกล่องใหม่: ฿{nextTotal.toLocaleString()}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        วิธีรับเงินรอบนี้
                      </label>
                      <input
                        type="text"
                        value={boxExtraPayMethod}
                        onChange={(e) => setBoxExtraPayMethod(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        หมายเหตุรอบนี้
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น โอนเพิ่มรอบ 2"
                        value={boxExtraNote}
                        onChange={(e) => setBoxExtraNote(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAddingToBoxOrder(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={boxExtraItems.length === 0 || isSavingBoxAdd}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50"
                  >
                    {isSavingBoxAdd ? 'กำลังบันทึก...' : 'บันทึกเพิ่มเข้ากล่อง & ตัดสต็อก'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dedicated Payment & Slip Upload Modal */}
        {payingOrder && (
          <div
            onClick={() => setPayingOrder(null)}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="p-5 bg-emerald-700 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    <span>รับชำระเงินบิล {payingOrder.order_no}</span>
                  </h3>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    ลูกค้า: {payingOrder.customer_name} • ยอดสุทธิ ฿
                    {payingOrder.total_amount.toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPayingOrder(null)}
                  className="p-1.5 rounded-full hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmPayment} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    ช่องทางชำระเงิน
                  </label>
                  <select
                    value={payModalMethod}
                    onChange={(e) => setPayModalMethod(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="โอนเงิน (Mobile Banking)">โอนเงิน (Mobile Banking / QR)</option>
                    <option value="เงินสด (Cash)">เงินสด (Cash หน้าร้าน)</option>
                    <option value="บัตรเครดิต/เดบิต">บัตรเครดิต/เดบิต (Credit Card)</option>
                    <option value="เก็บเงินปลายทาง (COD)">เก็บเงินปลายทาง (COD)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    แนบสลิปโอนเงินลูกค้า (Cloudflare R2 WebP)
                  </label>
                  <ImageUploader
                    folder="receipts"
                    maxFiles={1}
                    images={payModalSlipUrls}
                    onChange={setPayModalSlipUrls}
                    label="อัปโหลดสลิปโอนเงิน"
                    allowCamera={true}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    หมายเหตุการรับเงิน (ไม่บังคับ)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น โอนเข้าบัญชี KBANK เวลา 14:30"
                    value={payModalNote}
                    onChange={(e) => setPayModalNote(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPayingOrder(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPayment}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
                  >
                    {isSavingPayment ? 'กำลังบันทึก...' : '✅ ยืนยันรับชำระเงิน'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Batch Tracking Scanner Modal */}
        {showBatchTrackingModal && (
          <div
            onClick={() => setShowBatchTrackingModal(false)}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="font-bold text-base">ยิงเลขพัสดุรวดเดียว (Batch Tracking)</h3>
                    <p className="text-[11px] text-slate-300">
                      เลือกหรือยิงรหัสบิล แล้วตามด้วยเลขพัสดุ ระบบจะบันทึกและปรับเป็น &quot;จัดส่งแล้ว&quot; อัตโนมัติ
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBatchTrackingModal(false)}
                  className="p-1.5 rounded-full hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveBatchTracking} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    1. เลขที่บิล (พิมพ์/สแกน หรือเลือกจากรายการที่ยังไม่มีเลขพัสดุ)
                  </label>
                  <div className="space-y-2">
                    <select
                      value={batchOrderInput}
                      onChange={(e) => setBatchOrderInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    >
                      <option value="">-- เลือกบิลที่รอใส่เลขพัสดุ --</option>
                      {orders
                        .filter((o) => !o.tracking_no && o.status !== 'CANCELLED' && o.status !== 'OPEN_BOX')
                        .map((o) => (
                          <option key={o.id} value={o.order_no}>
                            {o.order_no} • {o.customer_name} (฿{o.total_amount.toLocaleString()})
                          </option>
                        ))}
                    </select>
                    <input
                      type="text"
                      placeholder="หรือยิง QR/บาร์โค้ดรหัสบิล INV-..."
                      value={batchOrderInput}
                      onChange={(e) => setBatchOrderInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    2. เลขพัสดุ (Tracking No.)
                  </label>
                  <input
                    type="text"
                    placeholder="ยิงบาร์โค้ดหรือพิมพ์เลขพัสดุ แล้วกด Enter..."
                    value={batchTrackInput}
                    onChange={(e) => setBatchTrackInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-bold bg-emerald-50/50 border border-emerald-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!batchOrderInput.trim() || !batchTrackInput.trim() || isSavingBatchTrack}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition disabled:opacity-40"
                >
                  {isSavingBatchTrack ? 'กำลังบันทึก...' : '✅ บันทึกเลขพัสดุ & ไปกล่องถัดไป'}
                </button>

                {batchLogs.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-1.5 max-h-40 overflow-y-auto">
                    <p className="text-[11px] font-bold text-slate-500">
                      บันทึกแล้วในรอบนี้ ({batchLogs.length} กล่อง):
                    </p>
                    {batchLogs.map((log, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs p-2 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200"
                      >
                        <span className="font-mono font-bold">{log.orderNo} ({log.customer})</span>
                        <span className="font-mono font-bold">{log.trackingNo}</span>
                      </div>
                    ))}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
