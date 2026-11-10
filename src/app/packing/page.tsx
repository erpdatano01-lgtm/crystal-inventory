'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import { fetchProducts } from '@/lib/inventoryService';
import { encodeCode128B } from '@/lib/barcodeGenerator';
import { Product, Order, PackingLog } from '@/types';
import {
  Video,
  Camera,
  Play,
  Square,
  Pause,
  RotateCcw,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  Package,
  Layers,
  Copy,
  Download,
  Trash2,
  ExternalLink,
  Clock,
  ShieldCheck,
  AlertCircle,
  Truck,
  Eye,
  Check,
  RefreshCw,
  Sliders,
  Share2,
  X,
  Volume2,
  VolumeX,
  Barcode,
  Zap,
  Printer,
  Search,
  CheckCheck,
  Scan,
  Box,
  ArrowRight,
  Sparkle,
} from 'lucide-react';

const LS_PACKING_RECORDS = 'crystal_packing_records_v1';
const LS_ORDERS = 'crystal_orders_v2';

// Step flow definition
type PackingStep = 'STEP_1_SCAN_ORDER' | 'STEP_2_SCAN_ITEMS' | 'STEP_3_SEAL_BOX';

export default function PackingPage() {
  // Products & Orders state
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Workflow State Machine
  const [packingStep, setPackingStep] = useState<PackingStep>('STEP_1_SCAN_ORDER');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [trackingNo, setTrackingNo] = useState<string>('');
  const [customerIg, setCustomerIg] = useState<string>('');
  const [packingNotes, setPackingNotes] = useState<string>('');

  // Item verification checklist (maps SKU / item id to checked boolean)
  const [checkedItemSkus, setCheckedItemSkus] = useState<Record<string, boolean>>({});

  // Camera & Detection state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<'16-9' | '9-16'>('16-9');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Real-time Barcode Detection HUD
  const [lastDetectedCode, setLastDetectedCode] = useState<string | null>(null);
  const [detectionLaserActive, setDetectionLaserActive] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showCommandSheetModal, setShowCommandSheetModal] = useState<boolean>(false);

  // Recorder state
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'recorded'>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPublicUrl, setUploadedPublicUrl] = useState<string | null>(null);

  // Toast & Modals
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewVideoModalUrl, setPreviewVideoModalUrl] = useState<string | null>(null);

  // Past Packing Records & Search
  const [packingRecords, setPackingRecords] = useState<PackingLog[]>([]);
  const [searchHistoryQuery, setSearchHistoryQuery] = useState<string>('');

  // Refs
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastScanTimestampRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');
  const zxingReaderRef = useRef<any>(null);

  // Active Target Ref for async recording termination
  const activeTargetRef = useRef<{
    order: Order | null;
    sku: string | null;
    trackingNo: string | null;
    customerIg: string | null;
    productName: string | null;
  }>({
    order: null,
    sku: null,
    trackingNo: null,
    customerIg: null,
    productName: null,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // -------------------------------------------------------------
  // Web Audio API Synthesizer (Instant Audio Feedback)
  // -------------------------------------------------------------
  const playAudioCue = (type: 'order_open' | 'item_verified' | 'all_items_ready' | 'box_sealed' | 'error') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'order_open') {
        // High ascending double-beep (880Hz -> 1320Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      } else if (type === 'item_verified') {
        // Crisp single verification beep (1046Hz - C6)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
        gain.gain.setValueAtTime(0.22, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);
        osc.start();
        osc.stop(ctx.currentTime + 0.16);
      } else if (type === 'all_items_ready') {
        // Joyful 3-tone arpeggio (C5 -> E5 -> G5)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.09);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.22, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.38);
        osc.start();
        osc.stop(ctx.currentTime + 0.38);
      } else if (type === 'box_sealed') {
        // Grand Final Chime (784Hz -> 1046Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime);
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        // Error Buzz (220Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn('AudioContext error:', e);
    }
  };

  // 1. Initial Load: Products, Orders, Local Records & ZXing CDN polyfill
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const prods = await fetchProducts();
        setProducts(prods);

        try {
          const res = await fetch('/api/orders');
          if (res.ok) {
            const ords = await res.json();
            if (Array.isArray(ords)) setOrders(ords);
          } else {
            const localOrds = localStorage.getItem(LS_ORDERS);
            if (localOrds) setOrders(JSON.parse(localOrds));
          }
        } catch {
          const localOrds = localStorage.getItem(LS_ORDERS);
          if (localOrds) setOrders(JSON.parse(localOrds));
        }

        const localRecs = localStorage.getItem(LS_PACKING_RECORDS);
        if (localRecs) {
          try {
            setPackingRecords(JSON.parse(localRecs));
          } catch {
            setPackingRecords([]);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Dynamically inject ZXing scanner script as fallback for browsers without native BarcodeDetector
    if (typeof window !== 'undefined' && !('BarcodeDetector' in window) && !(window as any).ZXing) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js';
      script.async = true;
      document.head.appendChild(script);
    }

    // Auto-start camera on mount so it's ready to scan immediately
    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  // Sync activeTargetRef
  useEffect(() => {
    const matchedProduct = products.find((p) => p.sku === selectedSku);
    activeTargetRef.current = {
      order: selectedOrder,
      sku: selectedSku || (selectedOrder?.items[0]?.sku ?? null),
      trackingNo: trackingNo || selectedOrder?.tracking_no || null,
      customerIg: customerIg || (selectedOrder?.channel === 'INSTAGRAM' ? selectedOrder.customer_name : null),
      productName: selectedOrder
        ? selectedOrder.items.map((i) => i.name).join(', ')
        : matchedProduct?.name || selectedSku || 'หิน Vivida Crystal',
    };
  }, [selectedOrder, selectedSku, trackingNo, customerIg, products]);

  // 2. Camera Controls
  const startCamera = async (facing: 'user' | 'environment' = cameraFacing): Promise<MediaStream | null> => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการเข้าถึงกล้องโดยตรง');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: isMicEnabled,
      });

      mediaStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
      return stream;
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'เบราว์เซอร์ถูกปฏิเสธการเข้าถึงกล้อง กรุณากดอนุญาตการใช้กล้องและไมค์ในแถบ URL'
          : `ไม่สามารถเปิดกล้องได้: ${err.message || 'เกิดข้อผิดพลาด'}`
      );
      setIsCameraActive(false);
      return null;
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const toggleCameraFacing = () => {
    const next = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(next);
    if (isCameraActive) {
      startCamera(next);
    }
  };

  // 3. MediaRecorder controls
  const startRecording = async (overrideTarget?: typeof activeTargetRef.current) => {
    if (overrideTarget) {
      activeTargetRef.current = overrideTarget;
    }

    let stream = mediaStreamRef.current;
    if (!isCameraActive || !stream) {
      stream = await startCamera();
      if (!stream) return;
    }

    recordedChunksRef.current = [];
    setRecordingDuration(0);
    setRecordedBlob(null);
    setRecordedVideoUrl(null);
    setUploadedPublicUrl(null);

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : '';

      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setRecordingState('recorded');

        // Automatically Index & Save Record!
        autoIndexAndSaveRecording(blob, url, activeTargetRef.current);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setRecordingState('recording');

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('MediaRecorder start error:', err);
      alert(`ไม่สามารถเริ่มบันทึกวิดีโอได้: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  // 4. In-Camera Barcode Detection Engine
  const detectBarcodeFromVideoFrame = async (video: HTMLVideoElement): Promise<string | null> => {
    // Strategy A: Native Browser BarcodeDetector (Supported in modern Chrome, Edge, and iOS/macOS Safari)
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code'],
        });
        const barcodes = await detector.detect(video);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          return barcodes[0].rawValue.trim();
        }
      } catch {
        // Fallback to ZXing
      }
    }

    // Strategy B: ZXing Javascript Decoder fallback
    if (typeof window !== 'undefined' && (window as any).ZXing) {
      try {
        const ZXing = (window as any).ZXing;
        if (!zxingReaderRef.current) {
          zxingReaderRef.current = new ZXing.BrowserMultiFormatReader();
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(video.videoWidth || 640, 640);
        canvas.height = Math.min(video.videoHeight || 480, 480);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const res = zxingReaderRef.current.decodeFromCanvas(canvas);
          if (res && res.getText()) {
            return res.getText().trim();
          }
        }
      } catch {
        // No barcode in current frame
      }
    }

    return null;
  };

  // -------------------------------------------------------------
  // Camera Video Continuous Scanning Loop (Runs at ~4 FPS)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isCameraActive || recordingState === 'recorded') {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      return;
    }

    scanIntervalRef.current = setInterval(async () => {
      if (!videoPreviewRef.current || videoPreviewRef.current.readyState < 2) return;

      try {
        const detected = await detectBarcodeFromVideoFrame(videoPreviewRef.current);
        if (detected) {
          const now = Date.now();
          // Debounce: prevent duplicate scan within 1.5 seconds for same code
          if (detected === lastScannedCodeRef.current && now - lastScanTimestampRef.current < 1500) {
            return;
          }

          lastScannedCodeRef.current = detected;
          lastScanTimestampRef.current = now;
          setLastDetectedCode(detected);

          // Handle the barcode in the current workflow step!
          handleCameraDecodedBarcode(detected);
        }
      } catch (e) {
        // Frame scan error
      }
    }, 280);

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [isCameraActive, recordingState, packingStep, selectedOrder, checkedItemSkus, orders, products]);

  // -------------------------------------------------------------
  // WORKFLOW LOGIC: Camera Decoded Barcode Dispatcher
  // -------------------------------------------------------------
  const handleCameraDecodedBarcode = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    // STEP 1: Scan Order Barcode to Open Box & Start Recording
    if (packingStep === 'STEP_1_SCAN_ORDER') {
      // Find matching Order by Order No or Tracking No
      const matchedOrder = orders.find(
        (o) =>
          o.order_no.toLowerCase() === cleanCode.toLowerCase() ||
          (o.tracking_no && o.tracking_no.toLowerCase() === cleanCode.toLowerCase()) ||
          o.items.some((i) => i.sku.toLowerCase() === cleanCode.toLowerCase())
      );

      const matchedProduct = products.find((p) => p.sku.toLowerCase() === cleanCode.toLowerCase());

      if (matchedOrder) {
        openOrderBoxAndStartRecording(matchedOrder);
      } else if (matchedProduct) {
        // Single stone quick pack mode
        openQuickPackForStone(matchedProduct);
      } else {
        // Treat as a shipping label tracking number!
        const autoOrder: Order = {
          id: `ord_${Date.now()}`,
          order_no: `ORD-${cleanCode.slice(-6)}`,
          order_date: new Date().toISOString(),
          customer_name: 'ลูกค้าพัสดุ ' + cleanCode,
          channel: 'INSTAGRAM',
          items: products.slice(0, 1).map((p) => ({
            product_id: p.id,
            sku: p.sku,
            name: p.name,
            stone_type: p.stone_type,
            unit_price: p.selling_price,
            cost_price: p.cost_price,
            qty: 1,
            weight_grams: p.weight_grams,
            r2_thumbnail_url: p.r2_thumbnail_url,
          })),
          subtotal: 0,
          discount: 0,
          shipping_fee: 0,
          total_amount: 0,
          total_cost: 0,
          profit: 0,
          payment_method: 'PROMPTPAY',
          tracking_no: cleanCode,
          status: 'PAID',
          created_at: new Date().toISOString(),
        };
        openOrderBoxAndStartRecording(autoOrder);
      }
      return;
    }

    // STEP 2: Scan Stone Items in Box One by One
    if (packingStep === 'STEP_2_SCAN_ITEMS') {
      if (!selectedOrder) return;

      // Find if this code matches any item in the order
      const targetItem = selectedOrder.items.find(
        (item) => item.sku.toLowerCase() === cleanCode.toLowerCase()
      );

      if (targetItem) {
        // Mark this SKU as verified in box
        if (checkedItemSkus[targetItem.sku]) {
          showToast(`ℹ️ หิน ${targetItem.sku} สแกนตรวจจับไปแล้ว`);
          return;
        }

        const nextChecked = { ...checkedItemSkus, [targetItem.sku]: true };
        setCheckedItemSkus(nextChecked);
        playAudioCue('item_verified');
        showToast(`✅ กล้องตรวจพบ: ${targetItem.name} (${targetItem.sku}) บรรจุลงกล่องเรียบร้อย!`);

        // Check if ALL items in the order are now verified
        const allItemsCount = selectedOrder.items.length;
        const checkedCount = Object.values(nextChecked).filter(Boolean).length;

        if (checkedCount >= allItemsCount) {
          // UNLOCK STEP 3: SEAL & FINISH!
          setTimeout(() => {
            setPackingStep('STEP_3_SEAL_BOX');
            playAudioCue('all_items_ready');
            showToast('🎉 บรรจุหินครบทุกชิ้นแล้ว! ปลดล็อคขั้นตอนปิดกล่องพัสดุ');
          }, 400);
        }
      } else {
        playAudioCue('error');
        showToast(`⚠️ บาร์โค้ด "${cleanCode}" ไม่ตรงกับรายการในออเดอร์นี้`);
      }
    }
  };

  // Open Order Box & Start Recording
  const openOrderBoxAndStartRecording = (order: Order) => {
    setSelectedOrder(order);
    setTrackingNo(order.tracking_no || '');
    if (order.channel === 'INSTAGRAM') setCustomerIg(order.customer_name);

    // Reset item check state for this order
    const initialChecks: Record<string, boolean> = {};
    order.items.forEach((it) => {
      initialChecks[it.sku] = false;
    });
    setCheckedItemSkus(initialChecks);

    // Switch step to Item Packing
    setPackingStep('STEP_2_SCAN_ITEMS');
    playAudioCue('order_open');

    // Automatically START Recording!
    startRecording({
      order,
      sku: order.items[0]?.sku || null,
      trackingNo: order.tracking_no || null,
      customerIg: order.channel === 'INSTAGRAM' ? order.customer_name : null,
      productName: order.items.map((i) => i.name).join(', '),
    });

    showToast(`📦 กล้องตรวจพบออเดอร์ ${order.order_no}! เริ่มอัดวิดีโอ ➔ สแกนหินลงกล่องทีละชิ้นได้เลย`);
  };

  // Quick Pack for Single Stone
  const openQuickPackForStone = (stone: Product) => {
    setSelectedSku(stone.sku);
    setSelectedOrder(null);
    setCheckedItemSkus({ [stone.sku]: true });
    setPackingStep('STEP_3_SEAL_BOX');
    playAudioCue('order_open');

    startRecording({
      order: null,
      sku: stone.sku,
      trackingNo: trackingNo || null,
      customerIg: customerIg || null,
      productName: stone.name,
    });

    showToast(`💎 กล้องตรวจพบหิน ${stone.sku}! เริ่มอัดวิดีโอเรียบร้อย`);
  };

  // Manual Toggle Item Check (in case camera focus was blurry on label)
  const handleManualToggleItem = (sku: string) => {
    const nextChecked = { ...checkedItemSkus, [sku]: !checkedItemSkus[sku] };
    setCheckedItemSkus(nextChecked);

    if (selectedOrder) {
      const allCount = selectedOrder.items.length;
      const checkedCount = Object.values(nextChecked).filter(Boolean).length;
      if (checkedCount >= allCount) {
        setPackingStep('STEP_3_SEAL_BOX');
        playAudioCue('all_items_ready');
        showToast('🎉 บรรจุหินครบทุกชิ้นแล้ว! ปลดล็อคขั้นตอนปิดกล่องพัสดุ');
      } else {
        setPackingStep('STEP_2_SCAN_ITEMS');
      }
    }
  };

  // Finish Box & Seal
  const handleConfirmSealBox = () => {
    stopRecording();
    playAudioCue('box_sealed');
    showToast('🎉 ยืนยันปิดกล่องพัสดุเสร็จสิ้น! วิดีโอถูกบันทึกและผูกเลขพัสดุเรียบร้อย');
  };

  // Reset for next parcel
  const handleReadyForNextParcel = () => {
    setPackingStep('STEP_1_SCAN_ORDER');
    setSelectedOrder(null);
    setSelectedSku('');
    setTrackingNo('');
    setCheckedItemSkus({});
    setRecordedBlob(null);
    setRecordedVideoUrl(null);
    setUploadedPublicUrl(null);
    setRecordingState('idle');
    setRecordingDuration(0);
    recordedChunksRef.current = [];
    showToast('📦 พร้อมแพ็กกล่องถัดไป: นำบาร์โค้ดใบปะหน้ามาจ่อหน้ากล้องได้เลยครับ');
  };

  // Auto-Index & Save Record
  const autoIndexAndSaveRecording = async (
    blob: Blob,
    localUrl: string,
    target: typeof activeTargetRef.current
  ) => {
    setIsUploading(true);
    let finalUrl = localUrl;

    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const cleanTrack = target.trackingNo ? target.trackingNo.replace(/[^a-zA-Z0-9_-]/g, '') : '';
    const cleanOrder = target.order?.order_no ? target.order.order_no.replace(/[^a-zA-Z0-9_-]/g, '') : '';
    const cleanSku = target.sku ? target.sku.replace(/[^a-zA-Z0-9_-]/g, '') : '';

    const fileName = `PACK_${cleanTrack ? cleanTrack + '_' : ''}${cleanOrder ? cleanOrder + '_' : ''}${cleanSku ? cleanSku + '_' : ''}${Date.now()}.${ext}`;

    try {
      const formData = new FormData();
      formData.append('file', blob, fileName);
      formData.append('folder', 'packing');
      if (cleanSku) formData.append('sku', cleanSku);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) finalUrl = data.url;
      }
    } catch (e) {
      console.warn('Background upload error, falling back to local URL:', e);
    } finally {
      setIsUploading(false);
    }

    setUploadedPublicUrl(finalUrl);

    // Save Indexed Record
    const newRecord: PackingLog = {
      id: `pack_${Date.now()}`,
      order_id: target.order?.id || null,
      order_no: target.order?.order_no || null,
      sku: target.sku || null,
      product_name: target.productName || 'หิน Vivida Crystal',
      customer_name: target.order?.customer_name || (target.customerIg ? `@${target.customerIg.replace('@', '')}` : 'ลูกค้า IG'),
      customer_ig: target.customerIg || null,
      video_url: finalUrl,
      duration_seconds: recordingDuration,
      packed_at: new Date().toISOString(),
      tracking_no: target.trackingNo || null,
      notes: packingNotes || null,
    };

    setPackingRecords((prev) => {
      const next = [newRecord, ...prev];
      localStorage.setItem(LS_PACKING_RECORDS, JSON.stringify(next));
      return next;
    });

    // Automatically update Order in Supabase/API (Mark as SHIPPED + attach Tracking & Packing Video)
    if (target.order) {
      try {
        await fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: target.order.id,
            status: 'SHIPPED',
            packing_video_url: finalUrl,
            tracking_no: target.trackingNo || target.order.tracking_no,
          }),
        });
      } catch (err) {
        console.warn('Order sync error:', err);
      }
    }
  };

  // Download local video file (.webm / .mp4)
  const handleDownloadVideo = () => {
    if (!recordedVideoUrl) return;
    const a = document.createElement('a');
    a.href = recordedVideoUrl;
    const cleanTrack = trackingNo ? trackingNo.replace(/[^a-zA-Z0-9_-]/g, '') : '';
    const cleanOrder = selectedOrder?.order_no ? selectedOrder.order_no.replace(/[^a-zA-Z0-9_-]/g, '') : '';
    a.download = `PACK_${cleanTrack ? cleanTrack + '_' : ''}${cleanOrder ? cleanOrder + '_' : ''}${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('📥 ดาวน์โหลดคลิปวิดีโอลงเครื่องแล้ว');
  };

  // Generate IG Message
  const handleCopyIgMessage = (rec?: PackingLog) => {
    const custName = rec?.customer_name || selectedOrder?.customer_name || (customerIg ? `@${customerIg.replace('@', '')}` : 'คุณลูกค้า');
    const stoneNames = rec?.product_name || (selectedOrder ? selectedOrder.items.map((i) => `${i.name} (${i.sku})`).join(', ') : selectedSku || 'น้องหิน');
    const videoLink = rec?.video_url || uploadedPublicUrl || recordedVideoUrl || '(แนบคลิปส่งในแชท)';
    const trackCode = rec?.tracking_no || trackingNo;
    const trackStr = trackCode ? `🚚 เลขพัสดุ Tracking: ${trackCode}\n` : '';

    const text = `สวัสดีค่ะคุณ ${custName} 📦✨
ทางร้าน Vivida Crystal แพ็กน้อง ${stoneNames} ให้เรียบร้อยแล้วนะคะ
ห่อบับเบิ้ลกันกระแทกอย่างหนาแน่นและตรวจเช็คสภาพความสมบูรณ์ก่อนลงกล่องเรียบร้อยค่ะ 🥰

🎥 คลิปวิดีโอตอนแพ็ก: ${videoLink}
${trackStr}
ขอบคุณที่อุดหนุนและรับน้องไปดูแลนะคะ ขอให้น้องนำพาพลังงานดีๆ และความสุขมาให้ค่ะ 🙏💎💖`;

    navigator.clipboard.writeText(text);
    showToast('📋 คัดลอกข้อความส่งลูกค้า IG เรียบร้อยแล้ว!');
  };

  // Format Duration seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Progress computation
  const totalItemsCount = selectedOrder ? selectedOrder.items.length : 1;
  const verifiedItemsCount = Object.values(checkedItemSkus).filter(Boolean).length;
  const isAllItemsVerified = verifiedItemsCount >= totalItemsCount;

  // Filtered History
  const filteredPackingRecords = useMemo(() => {
    if (!searchHistoryQuery.trim()) return packingRecords;
    const q = searchHistoryQuery.toLowerCase();
    return packingRecords.filter(
      (r) =>
        (r.tracking_no && r.tracking_no.toLowerCase().includes(q)) ||
        (r.order_no && r.order_no.toLowerCase().includes(q)) ||
        (r.sku && r.sku.toLowerCase().includes(q)) ||
        (r.customer_name && r.customer_name.toLowerCase().includes(q)) ||
        (r.product_name && r.product_name.toLowerCase().includes(q))
    );
  }, [packingRecords, searchHistoryQuery]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:pl-64 pb-24 md:pb-12 text-slate-800">
      <Navbar />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* ========================================================= */}
        {/* 1. PROGRESS WORKFLOW STEPPER BAR                          */}
        {/* ========================================================= */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block">
                Camera Barcode Detection & Guided Packing
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                <Scan className="w-6 h-6 text-purple-600" />
                <span>ระบบสแกนบาร์โค้ดผ่านกล้อง & ตรวจจับหินลงกล่อง</span>
              </h1>
            </div>

            {/* Camera Detection Status Badge */}
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span>ตรวจจับบาร์โค้ดผ่านกล้อง: พร้อมทำงาน</span>
              </span>

              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-xl border transition ${
                  soundEnabled ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-400'
                }`}
                title={soundEnabled ? 'เปิดเสียงสัญญาณ Beep' : 'ปิดเสียงสัญญาณ'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Stepper Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Step 1 Pill */}
            <div
              className={`p-3.5 rounded-2xl border transition flex items-center gap-3 ${
                packingStep === 'STEP_1_SCAN_ORDER'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20'
                  : selectedOrder
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                  packingStep === 'STEP_1_SCAN_ORDER'
                    ? 'bg-white text-purple-700'
                    : selectedOrder
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {selectedOrder ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold block uppercase tracking-wider opacity-80">ขั้นตอนที่ 1</span>
                <span className="text-xs sm:text-sm font-black truncate block">
                  {selectedOrder ? `เปิดกล่อง: ${selectedOrder.order_no}` : 'สแกนใบปะหน้าเปิดกล่อง'}
                </span>
              </div>
            </div>

            {/* Step 2 Pill */}
            <div
              className={`p-3.5 rounded-2xl border transition flex items-center gap-3 ${
                packingStep === 'STEP_2_SCAN_ITEMS'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20'
                  : isAllItemsVerified && selectedOrder
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                  packingStep === 'STEP_2_SCAN_ITEMS'
                    ? 'bg-white text-purple-700'
                    : isAllItemsVerified && selectedOrder
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {isAllItemsVerified && selectedOrder ? <Check className="w-4 h-4 stroke-[3]" /> : '2'}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold block uppercase tracking-wider opacity-80">ขั้นตอนที่ 2</span>
                <span className="text-xs sm:text-sm font-black truncate block">
                  สแกนตรวจหินลงกล่อง ({verifiedItemsCount}/{totalItemsCount})
                </span>
              </div>
            </div>

            {/* Step 3 Pill */}
            <div
              className={`p-3.5 rounded-2xl border transition flex items-center gap-3 ${
                packingStep === 'STEP_3_SEAL_BOX'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25 animate-pulse'
                  : recordingState === 'recorded'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                  packingStep === 'STEP_3_SEAL_BOX'
                    ? 'bg-white text-emerald-700'
                    : recordingState === 'recorded'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {recordingState === 'recorded' ? <Check className="w-4 h-4 stroke-[3]" /> : '3'}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold block uppercase tracking-wider opacity-80">ขั้นตอนที่ 3</span>
                <span className="text-xs sm:text-sm font-black truncate block">
                  ปิดกล่อง & สิ้นสุดการแพ็ก
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. CAMERA STUDIO & ITEM VERIFICATION LIST (2 Columns)     */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: CAMERA VIEWFINDER WITH RETICLE SCANNER (7 or 8 Cols) */}
          <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
            {/* Viewfinder Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3.5 h-3.5 rounded-full ${
                    recordingState === 'recording'
                      ? 'bg-rose-500 animate-ping'
                      : isCameraActive
                      ? 'bg-emerald-500'
                      : 'bg-slate-300'
                  }`}
                />
                <h2 className="font-bold text-sm sm:text-base text-slate-800">
                  {recordingState === 'recorded'
                    ? '🎬 ตัวอย่างคลิปที่บันทึกเสร็จแล้ว'
                    : isCameraActive
                    ? '📹 สตูดิโอกล้อง (นำบาร์โค้ดมาจ่อหน้ากล้องได้เลย)'
                    : '📹 สตูดิโอกล้องสำหรับแพ็กของ'}
                </h2>
              </div>

              {/* Camera Switchers */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1 transition"
                  title="สลับกล้องหน้า/กล้องหลัง"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
                  <span className="hidden sm:inline">
                    {cameraFacing === 'environment' ? 'กล้องหลัง (โต๊ะแพ็ก)' : 'กล้องหน้า'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMicEnabled(!isMicEnabled)}
                  className={`p-2 rounded-xl border transition ${
                    isMicEnabled
                      ? 'border-slate-200 text-slate-700 hover:bg-slate-100'
                      : 'border-rose-200 bg-rose-50 text-rose-600'
                  }`}
                  title={isMicEnabled ? 'เปิดเสียงไมค์' : 'ปิดเสียงไมค์'}
                >
                  {isMicEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setAspectRatio(aspectRatio === '16-9' ? '9-16' : '16-9')}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1 transition"
                  title="เปลี่ยนสัดส่วนแนวนอน (16:9) หรือแนวตั้ง (9:16)"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <span>{aspectRatio === '16-9' ? 'แนวนอน 16:9' : 'แนวตั้ง 9:16'}</span>
                </button>
              </div>
            </div>

            {/* Viewfinder Screen Box */}
            <div
              className={`relative bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center transition-all ${
                aspectRatio === '16-9' ? 'aspect-video w-full' : 'aspect-[9/16] max-w-sm mx-auto'
              }`}
            >
              {/* Recorded Video Playback Preview */}
              {recordingState === 'recorded' && recordedVideoUrl ? (
                <video
                  src={recordedVideoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                /* Live Camera Stream */
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${!isCameraActive ? 'hidden' : ''}`}
                />
              )}

              {/* Camera Off Placeholder */}
              {!isCameraActive && recordingState !== 'recorded' && (
                <div className="text-center p-6 space-y-4 text-slate-400">
                  <div className="w-16 h-16 rounded-3xl bg-slate-800/80 mx-auto flex items-center justify-center text-purple-400 border border-slate-700">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">กล้องยังไม่ได้เปิดใช้งาน</p>
                    <p className="text-xs text-slate-400">คลิกเปิดกล้องเพื่อเริ่มตรวจจับบาร์โค้ด</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs sm:text-sm hover:bg-purple-700 transition shadow-lg shadow-purple-600/30 flex items-center gap-1.5 mx-auto"
                  >
                    <Camera className="w-4 h-4" />
                    <span>เปิดกล้องสตูดิโอ</span>
                  </button>
                </div>
              )}

              {/* ===================================================== */}
              {/* CAMERA AIMING RETICLE & LASER SCANNER OVERLAY         */}
              {/* ===================================================== */}
              {isCameraActive && recordingState !== 'recorded' && (
                <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between select-none">
                  {/* Top Overlay: Branding & Recording Indicator */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 text-white">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px] font-black tracking-wider uppercase">
                        VIVIDA CRYSTAL • CAMERA SCANNER
                      </span>
                    </div>

                    {recordingState === 'recording' && (
                      <div className="bg-rose-600/95 backdrop-blur-md px-3 py-1 rounded-xl text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-lg animate-pulse">
                        <span className="w-2.5 h-2.5 rounded-full bg-white" />
                        <span>REC {formatTime(recordingDuration)}</span>
                      </div>
                    )}
                  </div>

                  {/* CENTER: AIMING RETICLE BOX FOR BARCODE SCANNING */}
                  <div className="self-center relative w-72 h-44 rounded-2xl border-2 border-dashed border-emerald-400/80 bg-emerald-500/5 flex flex-col items-center justify-center p-3 text-center shadow-2xl">
                    {/* Animated Scanning Laser Line */}
                    <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bounce shadow-lg shadow-emerald-400" />

                    {/* Corner Reticle Brackets */}
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                    {/* Guidance Text inside Reticle */}
                    <div className="bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10 text-white text-xs space-y-0.5">
                      {packingStep === 'STEP_1_SCAN_ORDER' && (
                        <>
                          <p className="font-bold text-amber-300">🎯 จ่อบาร์โค้ดใบปะหน้าพัสดุ</p>
                          <p className="text-[10px] text-slate-300">เพื่อ "เปิดกล่อง" และเริ่มอัดวิดีโอ</p>
                        </>
                      )}
                      {packingStep === 'STEP_2_SCAN_ITEMS' && (
                        <>
                          <p className="font-bold text-emerald-300">💎 จ่อบาร์โค้ดหินทีละชิ้น</p>
                          <p className="text-[10px] text-slate-300">เพื่อตรวจเช็คของลงกล่อง</p>
                        </>
                      )}
                      {packingStep === 'STEP_3_SEAL_BOX' && (
                        <>
                          <p className="font-bold text-emerald-300">📦 หินครบทุกชิ้นแล้ว!</p>
                          <p className="text-[10px] text-slate-300">พันบับเบิ้ล & ปิดเทปกล่องหน้ากล้อง</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bottom Overlay: Last Detected Code Feedback */}
                  <div className="bg-black/75 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 max-w-md text-white text-xs flex items-center justify-between">
                    <span className="text-[11px] text-slate-300 truncate">
                      {lastDetectedCode ? `🔍 ล่าสุดตรวจพบ: ${lastDetectedCode}` : '📷 กำลังตรวจจับบาร์โค้ดในเฟรม...'}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold shrink-0">
                      Auto-Detect: ON
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Studio Action & Quick Control Bar */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Left Action buttons depending on Step */}
                <div className="flex items-center gap-2">
                  {packingStep === 'STEP_3_SEAL_BOX' && recordingState === 'recording' && (
                    <button
                      type="button"
                      onClick={handleConfirmSealBox}
                      className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm sm:text-base hover:from-emerald-700 hover:to-teal-700 active:scale-95 transition shadow-lg shadow-emerald-600/30 flex items-center gap-2 animate-bounce"
                    >
                      <CheckCheck className="w-5 h-5" />
                      <span>✅ ยืนยันปิดกล่อง & สิ้นสุดการแพ็ก</span>
                    </button>
                  )}

                  {recordingState === 'recorded' && (
                    <>
                      <button
                        type="button"
                        onClick={handleReadyForNextParcel}
                        className="px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-sm transition flex items-center gap-2 shadow-md shadow-purple-600/20 active:scale-95"
                      >
                        <Box className="w-4 h-4" />
                        <span>📦 พร้อมแพ็กกล่องถัดไป</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadVideo}
                        className="p-3 rounded-2xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition shadow-xs"
                        title="ดาวน์โหลดคลิปลงเครื่อง"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {recordingState === 'recording' && packingStep !== 'STEP_3_SEAL_BOX' && (
                    <div className="inline-flex items-center gap-2 text-xs font-bold text-purple-700 bg-purple-50 px-3.5 py-2.5 rounded-xl border border-purple-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      <span>กำลังอัดวิดีโอ: สแกนบาร์โค้ดหินในกล่องให้ครบเพื่อปลดล็อคปุ่มปิดกล่อง</span>
                    </div>
                  )}
                </div>

                {/* Right: Instagram Direct Message Auto-Copy Button */}
                <button
                  type="button"
                  onClick={() => handleCopyIgMessage()}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-pink-500/20 hover:opacity-95 active:scale-95 transition flex items-center gap-1.5 ml-auto"
                  title="คัดลอกข้อความทักหาลูกค้าใน IG พร้อมลิงก์คลิป"
                >
                  <Share2 className="w-4 h-4" />
                  <span>📋 ก๊อปปี้ข้อความส่ง IG</span>
                </button>
              </div>

              {/* Hint text */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60">
                <span>💡 นำบาร์โค้ดมาจ่อหน้ากล้องระยะประมาณ 10-25 ซม. ให้ตรงกับกรอบเล็งสีเขียว</span>
                <span>🔊 ระบบจะส่งเสียง Beep ทันทีเมื่อกล้องจับภาพได้</span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT: GUIDED ITEMS CHECKLIST & ORDER DETAILS (5 Cols)    */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5">
            {/* Box Target & Items Checklist Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <Box className="w-4 h-4 text-purple-600" />
                    <span>รายการสินค้าในกล่องนี้</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedOrder ? `ออเดอร์: ${selectedOrder.order_no}` : 'รอสแกนเปิดกล่อง'}
                  </p>
                </div>

                {/* Verified Counter Badge */}
                {selectedOrder && (
                  <span
                    className={`text-xs font-black px-2.5 py-1 rounded-full border ${
                      isAllItemsVerified
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    {verifiedItemsCount} / {totalItemsCount} ชิ้น
                  </span>
                )}
              </div>

              {/* STATE 1: WAITING FOR ORDER SCAN */}
              {!selectedOrder && packingStep === 'STEP_1_SCAN_ORDER' && (
                <div className="p-5 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
                    <Scan className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">ขั้นตอนที่ 1: เปิดกล่องพัสดุ</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      นำใบปะหน้าพัสดุ (Flash, EMS, Kerry) หรือบาร์โค้ดเลขออเดอร์มาจ่อหน้ากล้อง เพื่อโหลดรายการหินและเริ่มอัดวิดีโอ
                    </p>
                  </div>

                  {/* Manual Order Picker Fallback (just in case printed barcode is missing) */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-2">
                    <span className="text-[11px] text-slate-400 block">หรือคลิกเลือกออเดอร์เพื่อเปิดกล่องทันที:</span>
                    <select
                      value=""
                      onChange={(e) => {
                        const ord = orders.find((o) => o.id === e.target.value);
                        if (ord) openOrderBoxAndStartRecording(ord);
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                    >
                      <option value="">-- เลือกออเดอร์ที่ต้องการเปิดกล่อง --</option>
                      {orders.map((ord) => (
                        <option key={ord.id} value={ord.id}>
                          {ord.order_no} • {ord.customer_name} ({ord.items.length} ชิ้น)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* STATE 2 & 3: ORDER OPENED - SHOW ITEMS CHECKLIST */}
              {selectedOrder && (
                <div className="space-y-3">
                  {/* Order Customer Info */}
                  <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-100 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-950">{selectedOrder.order_no}</span>
                      <span className="text-[10px] text-purple-700 font-bold bg-purple-100 px-1.5 py-0.5 rounded">
                        {selectedOrder.channel}
                      </span>
                    </div>
                    <p className="text-slate-700">
                      👤 ลูกค้า: <span className="font-bold">{selectedOrder.customer_name}</span>
                    </p>
                    {trackingNo && (
                      <p className="font-mono text-emerald-700 font-bold text-[11px]">
                        🚚 แทร็กกิ้ง: {trackingNo}
                      </p>
                    )}
                  </div>

                  {/* Guided Items Checklist */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      จ่อบาร์โค้ดหินทีละชิ้นหน้ากล้องเพื่อเช็คของลงกล่อง:
                    </span>

                    {selectedOrder.items.map((item, idx) => {
                      const isChecked = Boolean(checkedItemSkus[item.sku]);
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                            isChecked
                              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                              : 'bg-white border-slate-200 text-slate-700 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Checkmark or Step Number */}
                            <button
                              type="button"
                              onClick={() => handleManualToggleItem(item.sku)}
                              className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition ${
                                isChecked
                                  ? 'bg-emerald-500 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                              title="คลิกเพื่อสลับสถานะด้วยตนเอง"
                            >
                              {isChecked ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                            </button>

                            <div className="min-w-0">
                              <span className="font-bold text-xs block truncate">{item.name}</span>
                              <span className="text-[10px] font-mono text-purple-700 font-semibold block">
                                รหัส: {item.sku}
                              </span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0 text-right">
                            {isChecked ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>ลงกล่องแล้ว</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                ⏳ รอสแกน
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* STEP 3 ACTION BOX: UNLOCKED ONLY WHEN ALL ITEMS VERIFIED */}
                  {packingStep === 'STEP_3_SEAL_BOX' ? (
                    <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl space-y-3 animate-in fade-in">
                      <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>ขั้นตอนที่ 3: หินครบทุกชิ้นแล้ว พร้อมปิดกล่องพัสดุ!</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        โชว์การพันบับเบิ้ลและปิดเทปกล่องพัสดุหน้ากล้องให้เรียบร้อย จากนั้นกดยืนยันเพื่อบันทึกคลิป
                      </p>
                      <button
                        type="button"
                        onClick={handleConfirmSealBox}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 active:scale-95"
                      >
                        <CheckCheck className="w-4 h-4" />
                        <span>✅ ยืนยันปิดกล่อง & เสร็จสิ้นการแพ็ก</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-500 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>ปุ่มปิดกล่องจะปลดล็อคอัตโนมัติเมื่อสแกนหินครบทุกชิ้น</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Checklist Quality Reminders */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-2.5">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>คำแนะนำการตรวจเช็คหน้ากล้อง</span>
              </span>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                <li>ส่องไฟหมุนหิน 360° ให้เห็นเนื้อผลึกชัดเจนในคลิป</li>
                <li>สแกนบาร์โค้ดป้ายหินให้ติดเสียง Beep ยืนยันทีละชิ้น</li>
                <li>พันบับเบิ้ลหนา 3-4 ชั้น ใส่การ์ดขอบคุณก่อนปิดกล่อง</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. RECENT PACKING RECORDS & TRACKING SEARCH INDEX         */}
        {/* ========================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <span>คลังประวัติวิดีโอแพ็กของ (Order & Tracking Video Logs)</span>
              </h3>
              <p className="text-xs text-slate-500">
                วิดีโอทุกคลิปถูกผูกชื่อไฟล์และค้นหาได้ทันทีด้วยเลข Tracking, เลข Order หรือชื่อลูกค้า
              </p>
            </div>

            {/* Search by Tracking No or Order ID */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาด้วยเลข Tracking หรือ Order ID..."
                value={searchHistoryQuery}
                onChange={(e) => setSearchHistoryQuery(e.target.value)}
                className="w-full pl-10 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-mono"
              />
              {searchHistoryQuery && (
                <button
                  type="button"
                  onClick={() => setSearchHistoryQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {filteredPackingRecords.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Package className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <p className="text-sm font-semibold text-slate-600">
                {searchHistoryQuery ? `ไม่พบคลิปที่ตรงกับ "${searchHistoryQuery}"` : 'ยังไม่มีคลิปบันทึกการแพ็กในระบบ'}
              </p>
              <p className="text-xs text-slate-400">
                เมื่อสแกนเปิดกล่องและแพ็กของเสร็จ รายการจะถูกบันทึกและแสดงที่นี่ทันที
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPackingRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-purple-300 transition space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        {rec.tracking_no ? (
                          <div className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300">
                            <Truck className="w-3 h-3 text-emerald-600" />
                            <span>{rec.tracking_no}</span>
                          </div>
                        ) : (
                          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-lg">
                            {rec.order_no || rec.sku || 'PACK'}
                          </span>
                        )}
                        {rec.order_no && rec.tracking_no && (
                          <span className="text-[10px] text-purple-700 font-mono font-semibold block">
                            บิล: {rec.order_no}
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(rec.packed_at).toLocaleString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="text-xs space-y-0.5 pt-1">
                      <p className="font-bold text-slate-800 truncate">{rec.product_name}</p>
                      <p className="text-slate-500 truncate">
                        👤 ผู้รับ: <span className="text-slate-700 font-medium">{rec.customer_name}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions for this record */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setPreviewVideoModalUrl(rec.video_url)}
                      className="flex-1 py-1.5 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 transition flex items-center justify-center gap-1 shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>ดูคลิป</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyIgMessage(rec)}
                      className="p-2 rounded-xl bg-pink-50 border border-pink-200 text-pink-700 hover:bg-pink-100 transition"
                      title="คัดลอกข้อความทักหาลูกค้าใน IG"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(rec.video_url);
                        showToast('📋 คัดลอกลิงก์วิดีโอแล้ว!');
                      }}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-purple-50 hover:text-purple-700 transition"
                      title="คัดลอกลิงก์วิดีโอ"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('ยืนยันลบรายการบันทึกนี้?')) {
                          const next = packingRecords.filter((r) => r.id !== rec.id);
                          setPackingRecords(next);
                          localStorage.setItem(LS_PACKING_RECORDS, JSON.stringify(next));
                          showToast('ลบรายการสำเร็จ');
                        }
                      }}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="ลบรายการ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Video Preview Modal */}
      {previewVideoModalUrl && (
        <div
          onClick={() => setPreviewVideoModalUrl(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 space-y-3 p-4"
          >
            <div className="flex items-center justify-between text-white pb-2 border-b border-slate-800">
              <span className="font-bold text-sm flex items-center gap-2">
                <Video className="w-4 h-4 text-purple-400" />
                <span>คลิปวิดีโอหลักฐานการแพ็กสินค้า</span>
              </span>
              <button
                type="button"
                onClick={() => setPreviewVideoModalUrl(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-video bg-black rounded-2xl overflow-hidden">
              <video src={previewVideoModalUrl} controls autoPlay className="w-full h-full object-contain" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(previewVideoModalUrl);
                  showToast('📋 คัดลอกลิงก์วิดีโอแล้ว!');
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 transition flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>คัดลอกลิงก์</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs sm:text-sm font-semibold border border-slate-800 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
