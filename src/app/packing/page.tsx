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
} from 'lucide-react';

const LS_PACKING_RECORDS = 'crystal_packing_records_v1';
const LS_ORDERS = 'crystal_orders_v2';

export default function PackingPage() {
  // Products & Orders state
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Target
  const [packMode, setPackMode] = useState<'order' | 'quick'>('order');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [customerIg, setCustomerIg] = useState<string>('');
  const [trackingNo, setTrackingNo] = useState<string>('');
  const [packingNotes, setPackingNotes] = useState<string>('');

  // Barcode Trigger & Auto-record state
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [isAutoTriggerEnabled, setIsAutoTriggerEnabled] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [showCommandSheetModal, setShowCommandSheetModal] = useState<boolean>(false);

  // Checklist state
  const [checkInspection, setCheckInspection] = useState(false);
  const [checkBubble, setCheckBubble] = useState(false);
  const [checkGifts, setCheckGifts] = useState(false);
  const [checkLabel, setCheckLabel] = useState(false);

  // Camera & Stream state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<'16-9' | '9-16'>('16-9');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Recorder state
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'recorded'>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPublicUrl, setUploadedPublicUrl] = useState<string | null>(null);

  // Toast & Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewVideoModalUrl, setPreviewVideoModalUrl] = useState<string | null>(null);

  // Past Packing Records & Search
  const [packingRecords, setPackingRecords] = useState<PackingLog[]>([]);
  const [searchHistoryQuery, setSearchHistoryQuery] = useState<string>('');

  // Refs for Media & Hardware Scanner
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Active Target Ref to prevent closure staleness in async onstop callbacks
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
  // Web Audio API Synthesizer (Instant Audio Cues for Packing Table)
  // -------------------------------------------------------------
  const playAudioCue = (type: 'scan_start' | 'stop_success' | 'chain_switch' | 'error') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'scan_start') {
        // Dual-tone high pitch beep (880Hz -> 1320Hz)
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
      } else if (type === 'stop_success') {
        // Success Chime: Major Triad (523Hz -> 659Hz -> 784Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.09);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'chain_switch') {
        // Switch sound: Fast chime-beep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime);
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
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

  // 1. Initial Load of Products, Orders & Local Records
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const prods = await fetchProducts();
        setProducts(prods);

        // Fetch Orders
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

        // Fetch Packing Records
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

    // Auto-focus barcode input for quick scanner readiness
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 500);

    return () => {
      stopCamera();
    };
  }, []);

  // Update activeTargetRef whenever target state changes
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

  // 2. Start / Stop Camera Stream
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

  // 3. Core MediaRecorder Controls
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

        // Automatically trigger Order Indexing & Save!
        autoIndexAndSaveRecording(blob, url, activeTargetRef.current);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setRecordingState('recording');

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      playAudioCue('scan_start');
      showToast('🔴 เริ่มอัดคลิปพัสดุอัตโนมัติแล้ว! (ยิงบาร์โค้ดใบถัดไปเพื่อบันทึกต่อ)');
    } catch (err: any) {
      console.error('MediaRecorder start error:', err);
      alert(`ไม่สามารถเริ่มบันทึกวิดีโอได้: ${err.message}`);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      showToast('⏸️ พักการบันทึกชั่วคราว');
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      showToast('▶️ บันทึกต่อแล้ว');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      playAudioCue('stop_success');
    }
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    setRecordedVideoUrl(null);
    setUploadedPublicUrl(null);
    setRecordingState('idle');
    setRecordingDuration(0);
    recordedChunksRef.current = [];
    if (!isCameraActive) startCamera();
  };

  // -------------------------------------------------------------
  // Order Indexing: Automatically Bind Video with Tracking / Order ID
  // -------------------------------------------------------------
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

    // Standardized Index Naming: PACK_[TRACKING]_[ORDER]_[SKU]_[TIMESTAMP].ext
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

    showToast(`✅ ผูกวิดีโอเข้ากับพัสดุ ${target.trackingNo || target.order?.order_no || target.sku} สำเร็จ!`);
  };

  // -------------------------------------------------------------
  // Barcode Trigger Handler (Auto-Record & Chain Next Order)
  // -------------------------------------------------------------
  const handleBarcodeTrigger = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    setLastScannedCode(code);
    setBarcodeInput('');

    // Check for Command Barcodes
    const upper = code.toUpperCase();
    if (['FINISH', 'STOP', 'DONE', 'END', 'OK'].includes(upper)) {
      if (recordingState === 'recording') {
        stopRecording();
        showToast('⏹️ ยืนยันการแพ็กเสร็จสิ้น! วิดีโอถูกบันทึกและผูกเลขพัสดุแล้ว');
      } else {
        playAudioCue('error');
        showToast('ยังไม่ได้เริ่มอัดคลิป');
      }
      return;
    }

    if (['PAUSE'].includes(upper)) {
      pauseRecording();
      return;
    }

    if (['RESUME', 'CONTINUE'].includes(upper)) {
      resumeRecording();
      return;
    }

    // 1. Identify Target: Match against Orders (by tracking_no, order_no, or item sku)
    const matchedOrder = orders.find(
      (o) =>
        (o.tracking_no && o.tracking_no.toLowerCase() === code.toLowerCase()) ||
        o.order_no.toLowerCase() === code.toLowerCase() ||
        o.items.some((i) => i.sku.toLowerCase() === code.toLowerCase())
    );

    // 2. Match against Products (by SKU)
    const matchedProduct = products.find((p) => p.sku.toLowerCase() === code.toLowerCase());

    // 3. Determine Tracking Number
    let detectedTrackingNo = '';
    if (matchedOrder?.tracking_no) {
      detectedTrackingNo = matchedOrder.tracking_no;
    } else if (!matchedProduct && !code.startsWith('INV-')) {
      // It's likely a shipping label tracking number (e.g. Flash, EMS, Kerry)
      detectedTrackingNo = code;
    }

    // Prepare target object
    const newTarget = {
      order: matchedOrder || null,
      sku: matchedProduct?.sku || (matchedOrder?.items[0]?.sku ?? null),
      trackingNo: detectedTrackingNo || (matchedOrder?.tracking_no ?? code),
      customerIg: matchedOrder?.channel === 'INSTAGRAM' ? matchedOrder.customer_name : '',
      productName: matchedOrder
        ? matchedOrder.items.map((i) => i.name).join(', ')
        : matchedProduct?.name || code,
    };

    // Update UI states
    setSelectedOrder(matchedOrder || null);
    if (matchedOrder) {
      setPackMode('order');
      setTrackingNo(detectedTrackingNo || matchedOrder.tracking_no || '');
      if (matchedOrder.channel === 'INSTAGRAM') setCustomerIg(matchedOrder.customer_name);
    } else if (matchedProduct) {
      setPackMode('quick');
      setSelectedSku(matchedProduct.sku);
      setTrackingNo(detectedTrackingNo);
    } else {
      setPackMode('quick');
      setTrackingNo(detectedTrackingNo || code);
    }

    // 4. Barcode Trigger Action:
    if (!isAutoTriggerEnabled) {
      showToast(`🔍 สแกนบาร์โค้ด: ${code} (โหลดข้อมูลเรียบร้อย กดเริ่มอัดได้เลย)`);
      return;
    }

    // Case A: Currently recording another parcel -> STOP & SAVE PREVIOUS, THEN CHAIN START NEW!
    if (recordingState === 'recording') {
      playAudioCue('chain_switch');
      stopRecording(); // Trigger onstop to save previous parcel

      // Allow 300ms for recorder state to settle then start new recording
      setTimeout(() => {
        startRecording(newTarget);
      }, 350);

      showToast(`📦 บันทึกพัสดุก่อนหน้าแล้ว ➔ 🔴 สแกนใบใหม่ เริ่มอัด ${newTarget.trackingNo || code} ทันที!`);
      return;
    }

    // Case B: Idle or recorded -> Start new recording immediately!
    await startRecording(newTarget);
    showToast(`⚡ Barcode Trigger: ยิงใบปะหน้า ${newTarget.trackingNo || code} ➔ เริ่มอัดวิดีโอทันที!`);
  };

  // Keyboard wedge listener for physical barcode scanners
  const scannerBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Spacebar hotkey to toggle recording (if not typing in input)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        if (recordingState === 'idle') {
          startRecording();
        } else if (recordingState === 'recording') {
          stopRecording();
        } else if (recordingState === 'recorded') {
          resetRecording();
        }
        return;
      }

      // Barcode hardware scanner recognition: rapid consecutive keypresses
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      if (timeDiff > 100 && scannerBufferRef.current.length > 0) {
        scannerBufferRef.current = '';
      }

      if (e.key === 'Enter') {
        if (scannerBufferRef.current.length >= 3) {
          const scanned = scannerBufferRef.current;
          scannerBufferRef.current = '';
          handleBarcodeTrigger(scanned);
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        scannerBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [recordingState, orders, products, isAutoTriggerEnabled, soundEnabled]);

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

  // Generate Friendly IG Message with Auto Copy
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
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Filtered History Records by Search Query
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

  const activeStone = products.find((p) => p.sku === selectedSku);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:pl-64 pb-24 md:pb-12 text-slate-800">
      <Navbar />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* ========================================================= */}
        {/* 1. TOP HEADER & BARCODE TRIGGER SCANNER DOCK               */}
        {/* ========================================================= */}
        <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden space-y-5">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Header Title & Badges */}
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-purple-200 text-xs font-semibold">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Barcode Auto-Trigger & Order Indexing System</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                📦 ระบบบันทึกวิดีโอขณะแพ็กสินค้า (Video Packing Station)
              </h1>
              <p className="text-xs sm:text-sm text-purple-200/90 max-w-2xl">
                ยิงบาร์โค้ดใบปะหน้า ➔ กล้องเริ่มอัดทันที ➔ บันทึกผูกชื่อไฟล์เข้ากับเลข Tracking อัตโนมัติ!
              </p>
            </div>

            {/* Print Command Sheet Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCommandSheetModal(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition flex items-center gap-1.5 backdrop-blur shadow-sm active:scale-95"
                title="เปิดแผ่นบาร์โค้ดคำสั่งสำหรับปริ้นแปะข้างโต๊ะแพ็ก (FINISH / PAUSE)"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>🖨️ บาร์โค้ดคำสั่งโต๊ะแพ็ก</span>
              </button>
            </div>
          </div>

          {/* BARCODE SCANNER DOCK (The Auto-Trigger Hub) */}
          <div className="relative z-10 p-4 sm:p-5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs sm:text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                  <Barcode className="w-4 h-4" />
                  <span>เครื่องสแกนบาร์โค้ดพร้อมทำงาน (Barcode Scanner Ready)</span>
                </span>
              </div>

              {/* Toggles: Auto-Trigger & Sound */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsAutoTriggerEnabled(!isAutoTriggerEnabled)}
                  className={`px-3 py-1.5 rounded-xl border font-bold transition flex items-center gap-1.5 ${
                    isAutoTriggerEnabled
                      ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300'
                      : 'bg-white/5 border-white/20 text-slate-400'
                  }`}
                  title="เมื่อสแกนบาร์โค้ด ระบบจะสั่งให้กล้องเริ่มอัดวิดีโอทันที"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>สแกนแล้วเริ่มอัดอัตโนมัติ: {isAutoTriggerEnabled ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-xl border transition ${
                    soundEnabled ? 'border-purple-400 bg-purple-500/20 text-purple-200' : 'border-white/10 text-slate-500'
                  }`}
                  title={soundEnabled ? 'เปิดเสียงสัญญาณ Beep' : 'ปิดเสียงสัญญาณ'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Big Barcode Scanner Input */}
            <div className="relative">
              <Barcode className="w-6 h-6 text-purple-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="ยิงบาร์โค้ดที่ใบปะหน้าพัสดุ (Flash, Kerry, EMS) หรือเลขออเดอร์ INV-... ที่นี่"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeTrigger(barcodeInput);
                  }
                }}
                className="w-full pl-13 pr-28 py-3.5 text-base sm:text-lg bg-slate-950/80 border-2 border-purple-400/50 focus:border-purple-400 text-white placeholder:text-slate-400 rounded-xl outline-none font-mono tracking-wider shadow-inner"
              />
              <button
                type="button"
                onClick={() => handleBarcodeTrigger(barcodeInput)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm transition active:scale-95 shadow-md"
              >
                ยิงตรวจ
              </button>
            </div>

            {/* Quick Demo Simulator Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-purple-200/90 pt-1">
              <span className="text-slate-300">💡 ทดสอบยิงบาร์โค้ดจำลอง:</span>
              <button
                type="button"
                onClick={() => handleBarcodeTrigger('TH9876543210')}
                className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 font-mono text-amber-300 transition"
              >
                ⚡ สแกน Tracking: TH9876543210
              </button>
              <button
                type="button"
                onClick={() => handleBarcodeTrigger('INV-202611-001')}
                className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 font-mono text-purple-300 transition"
              >
                ⚡ สแกนบิล: INV-202611-001
              </button>
              <button
                type="button"
                onClick={() => handleBarcodeTrigger('CAB-MSA-002')}
                className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 font-mono text-emerald-300 transition"
              >
                ⚡ สแกนหิน: CAB-MSA-002
              </button>
              <button
                type="button"
                onClick={() => handleBarcodeTrigger('FINISH')}
                className="px-2 py-0.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 border border-rose-400 font-mono text-white font-bold transition ml-auto"
              >
                ⏹️ สแกนคำสั่ง: FINISH (เสร็จสิ้น)
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. MAIN STUDIO GRID (Left: Camera / Right: Target Details) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CAMERA VIEWFINDER & CONTROLS (7 or 8 Cols) */}
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
                    ? '🎬 ตัวอย่างคลิปที่บันทึกเสร็จแล้ว (ผูกเลขพัสดุเรียบร้อย)'
                    : isCameraActive
                    ? '📹 สตูดิโอกล้องสด (Live Packing Viewfinder)'
                    : '📹 สตูดิโอกล้องสำหรับแพ็กของ'}
                </h2>
              </div>

              {/* Camera Switchers */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1 transition"
                  title="สลับกล้องหน้า/กล้องหลัง (สำหรับมือถือ/ไอแพด)"
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
                  title={isMicEnabled ? 'เปิดเสียงไมค์' : 'ปิดเสียงไมค์ (Muted)'}
                >
                  {isMicEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setAspectRatio(aspectRatio === '16-9' ? '9-16' : '16-9')}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1 transition"
                  title="เปลี่ยนสัดส่วนแนวนอน (16:9) หรือแนวตั้ง IG Reels/Stories (9:16)"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <span>{aspectRatio === '16-9' ? 'แนวนอน 16:9' : 'แนวตั้ง 9:16'}</span>
                </button>
              </div>
            </div>

            {/* Error Message if camera failed */}
            {cameraError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">เข้าถึงกล้องไม่สำเร็จ</p>
                  <p className="text-rose-700">{cameraError}</p>
                </div>
              </div>
            )}

            {/* Viewfinder Screen Box */}
            <div
              className={`relative bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center transition-all ${
                aspectRatio === '16-9' ? 'aspect-video w-full' : 'aspect-[9/16] max-w-sm mx-auto'
              }`}
            >
              {/* State A: Previewing Recorded Video */}
              {recordingState === 'recorded' && recordedVideoUrl ? (
                <video
                  src={recordedVideoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                /* State B: Live Camera Stream */
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
                    <p className="text-xs text-slate-400">
                      ยิงบาร์โค้ดใบปะหน้า หรือคลิกปุ่มเปิดกล้องเพื่อเริ่มสตรีม
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="px-4 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs sm:text-sm hover:bg-purple-700 active:scale-95 transition shadow-lg shadow-purple-600/30 flex items-center gap-1.5"
                    >
                      <Camera className="w-4 h-4" />
                      <span>เปิดกล้องสตูดิโอ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold text-xs sm:text-sm hover:bg-slate-700 border border-slate-700 transition flex items-center gap-1.5"
                    >
                      <UploadCloud className="w-4 h-4 text-purple-400" />
                      <span>เลือกไฟล์จากเครื่อง</span>
                    </button>
                  </div>
                </div>
              )}

              {/* OVERLAY HUD (Watermark & Target details during Live stream or Recording) */}
              {(isCameraActive || recordingState === 'recording') && (
                <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between select-none">
                  {/* Top Overlay: Shop Branding & Live Stamp */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 text-white">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px] font-black tracking-wider uppercase">
                        VIVIDA CRYSTAL • PACKING PROOF
                      </span>
                    </div>

                    {/* Recording Red Badge with Live Timer */}
                    {recordingState === 'recording' && (
                      <div className="bg-rose-600/90 backdrop-blur-md px-3 py-1 rounded-xl text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-lg animate-pulse">
                        <span className="w-2.5 h-2.5 rounded-full bg-white" />
                        <span>REC {formatTime(recordingDuration)}</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Overlay: Live Order & Tracking Index HUD */}
                  <div className="bg-black/75 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-white/10 max-w-md text-white text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-amber-300 flex items-center gap-1.5 truncate">
                        <Truck className="w-3.5 h-3.5 text-amber-400" />
                        <span>{trackingNo ? `TRACK: ${trackingNo}` : selectedOrder?.order_no || selectedSku || 'ออเดอร์แพ็กสินค้า'}</span>
                      </span>
                      {selectedOrder?.order_no && trackingNo && (
                        <span className="text-[10px] text-purple-300 font-mono font-semibold">
                          ({selectedOrder.order_no})
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-300 truncate">
                      {selectedOrder
                        ? `${selectedOrder.customer_name} • ${selectedOrder.items.map((i) => i.name).join(', ')}`
                        : activeStone
                        ? `${activeStone.name} (${activeStone.sku}) • ${activeStone.weight_grams ?? '-'}g`
                        : 'กำลังตรวจสภาพหินและบรรจุกล่องพัสดุ'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden native file input for upload fallback */}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                setRecordedBlob(file);
                setRecordedVideoUrl(url);
                setRecordingState('recorded');
                autoIndexAndSaveRecording(file, url, activeTargetRef.current);
              }}
            />

            {/* Action Bar & Controls */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Left: Main Action buttons */}
                <div className="flex items-center gap-2">
                  {recordingState === 'idle' && (
                    <button
                      type="button"
                      onClick={() => startRecording()}
                      className="px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-black text-sm sm:text-base hover:from-rose-700 hover:to-red-700 active:scale-95 transition shadow-lg shadow-rose-600/25 flex items-center gap-2"
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-white animate-ping" />
                      <span>🔴 เริ่มอัดคลิป (หรือยิงบาร์โค้ด)</span>
                    </button>
                  )}

                  {recordingState === 'recording' && (
                    <>
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black text-sm sm:text-base hover:bg-black active:scale-95 transition shadow-lg flex items-center gap-2"
                      >
                        <Square className="w-4 h-4 fill-white" />
                        <span>⏹️ ยืนยันแพ็กเสร็จสิ้น ({formatTime(recordingDuration)})</span>
                      </button>
                      <button
                        type="button"
                        onClick={pauseRecording}
                        className="p-3 rounded-2xl bg-amber-100 text-amber-800 hover:bg-amber-200 transition"
                        title="พักชั่วคราว"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {recordingState === 'paused' && (
                    <>
                      <button
                        type="button"
                        onClick={resumeRecording}
                        className="px-4 py-3 rounded-2xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 active:scale-95 transition flex items-center gap-1.5"
                      >
                        <Play className="w-4 h-4" />
                        <span>▶️ อัดต่อ</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="px-4 py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-black transition flex items-center gap-1.5"
                      >
                        <Square className="w-4 h-4" />
                        <span>เสร็จสิ้น</span>
                      </button>
                    </>
                  )}

                  {recordingState === 'recorded' && (
                    <>
                      <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>ผูกเลขพัสดุเรียบร้อย!</span>
                      </div>

                      <button
                        type="button"
                        onClick={resetRecording}
                        className="px-3.5 py-3 rounded-2xl bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-300 transition flex items-center gap-1"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>พร้อมแพ็กกล่องถัดไป</span>
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
                </div>

                {/* Right: Instagram Direct Message Auto-Copy Button */}
                <button
                  type="button"
                  onClick={() => handleCopyIgMessage()}
                  className="px-4 py-3 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-pink-500/20 hover:opacity-95 active:scale-95 transition flex items-center gap-1.5 ml-auto"
                  title="คัดลอกข้อความทักหาลูกค้าใน IG พร้อมลิงก์คลิป"
                >
                  <Share2 className="w-4 h-4" />
                  <span>📋 ก๊อปปี้ข้อความส่ง IG</span>
                </button>
              </div>

              {/* Barcode Chaining workflow indicator */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60">
                <span className="flex items-center gap-1">
                  ⚡ <strong>Auto-Chain:</strong> ขณะกำลังอัดอยู่ สามารถยิงบาร์โค้ดกล่องถัดไปได้ทันที ระบบจะเซฟกล่องเก่าและเริ่มอัดกล่องใหม่ให้อัตโนมัติ!
                </span>
                <span>⌨️ กด Spacebar เพื่อเริ่ม/หยุดได้เช่นกัน</span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT: ORDER TARGET & CHECKLIST (4 or 5 Cols)             */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5">
            {/* Target Select Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-purple-600" />
                  <span>ข้อมูลพัสดุที่กำลังบันทึก (Indexed Target)</span>
                </h3>

                {/* Mode Switcher */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setPackMode('order');
                      setSelectedSku('');
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      packMode === 'order' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    จากบิล Order
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPackMode('quick');
                      setSelectedOrder(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      packMode === 'quick' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    แพ็กด่วนตาม SKU
                  </button>
                </div>
              </div>

              {/* Active Tracking Number Index Display */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-purple-600" />
                    <span>เลขแทร็กกิ้งพัสดุ (Tracking Number)</span>
                  </span>
                  {trackingNo && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      ผูกกับวิดีโอนี้
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="เช่น TH1234567890 (หรือยิงจากบาร์โค้ดใบปะหน้า)"
                    value={trackingNo}
                    onChange={(e) => setTrackingNo(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-base sm:text-sm font-mono bg-purple-50/50 border-2 border-purple-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-bold text-slate-900"
                  />
                  {trackingNo && (
                    <button
                      type="button"
                      onClick={() => setTrackingNo('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* MODE 1: SELECT ORDER */}
              {packMode === 'order' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      เลือกบิลออเดอร์ (Orders รอแพ็ก)
                    </label>
                    <select
                      value={selectedOrder?.id || ''}
                      onChange={(e) => {
                        const ord = orders.find((o) => o.id === e.target.value) || null;
                        setSelectedOrder(ord);
                        if (ord?.channel === 'INSTAGRAM') setCustomerIg(ord.customer_name);
                        if (ord?.tracking_no) setTrackingNo(ord.tracking_no);
                      }}
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                    >
                      <option value="">-- กรุณาเลือกบิลออเดอร์ --</option>
                      {orders.map((ord) => (
                        <option key={ord.id} value={ord.id}>
                          {ord.order_no} • {ord.customer_name} (฿{ord.total_amount.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected Order Summary Box */}
                  {selectedOrder && (
                    <div className="p-3.5 bg-purple-50/60 rounded-2xl border border-purple-200/80 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-purple-950">{selectedOrder.order_no}</span>
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px]">
                          {selectedOrder.channel}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 space-y-1">
                        <p>
                          👤 ผู้รับ: <span className="font-bold">{selectedOrder.customer_name}</span>
                        </p>
                        {selectedOrder.customer_phone && <p>📞 เบอร์โทร: {selectedOrder.customer_phone}</p>}
                        {selectedOrder.customer_address && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">
                            📍 ที่อยู่: {selectedOrder.customer_address}
                          </p>
                        )}
                      </div>

                      {/* Items list inside Order */}
                      <div className="pt-2 border-t border-purple-200/60 space-y-1.5">
                        <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
                          รายการหินในกล่องนี้ ({selectedOrder.items.length} รายการ):
                        </span>
                        {selectedOrder.items.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-xl bg-white border border-purple-100 text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-bold text-slate-800 block truncate">{it.name}</span>
                              <span className="text-[10px] font-mono text-purple-600">{it.sku}</span>
                            </div>
                            <span className="font-bold text-slate-900 shrink-0">x{it.qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MODE 2: QUICK PACK BY SKU */}
              {packMode === 'quick' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      เลือกรหัสหิน (SKU)
                    </label>
                    <select
                      value={selectedSku}
                      onChange={(e) => setSelectedSku(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                    >
                      <option value="">-- เลือกรหัสหินที่ต้องการแพ็ก --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.sku}>
                          {p.sku} • {p.name} ({p.weight_grams ?? '-'}g)
                        </option>
                      ))}
                    </select>
                  </div>

                  {activeStone && (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                      <p className="font-bold text-slate-800">{activeStone.name}</p>
                      <p className="text-slate-500">
                        ขนาด: {activeStone.dimensions || '-'} • น้ำหนัก: {activeStone.weight_grams ?? '-'} กรัม
                      </p>
                      <p className="text-purple-700 font-semibold">ที่เก็บ: {activeStone.storage_location || '-'}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      ชื่อลูกค้า หรือ บัญชี Instagram
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น @praew_crystals หรือ คุณแพรว"
                      value={customerIg}
                      onChange={(e) => setCustomerIg(e.target.value)}
                      className="w-full px-3.5 py-2 text-base sm:text-sm bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quality Checklist Before Sealing */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-1.5 text-slate-900 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Checklist ตรวจสอบก่อนปิดกล่อง (กันเคลม)</span>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition select-none">
                  <input
                    type="checkbox"
                    checked={checkInspection}
                    onChange={(e) => setCheckInspection(e.target.checked)}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">1. หมุนโชว์สภาพหิน 360° หน้ากล้อง</span>
                    <span className="text-[11px] text-slate-500">ส่องไฟเช็คความสมบูรณ์ ไม่มีรอยแตกหักใหม่</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition select-none">
                  <input
                    type="checkbox"
                    checked={checkBubble}
                    onChange={(e) => setCheckBubble(e.target.checked)}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">2. พันบับเบิ้ลกันกระแทกอย่างหนา</span>
                    <span className="text-[11px] text-slate-500">พันอย่างน้อย 3-4 ชั้น ยึดเทปแน่นหนา</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition select-none">
                  <input
                    type="checkbox"
                    checked={checkGifts}
                    onChange={(e) => setCheckGifts(e.target.checked)}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">3. ใส่การ์ดขอบคุณ & ของแถมหินมงคล</span>
                    <span className="text-[11px] text-slate-500">สร้างความประทับใจให้ลูกค้า IG</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition select-none">
                  <input
                    type="checkbox"
                    checked={checkLabel}
                    onChange={(e) => setCheckLabel(e.target.checked)}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">4. ปิดเทปกล่อง & แปะใบปะหน้าชัดเจน</span>
                    <span className="text-[11px] text-slate-500">โชว์ชื่อผู้รับและเลขพัสดุหน้ากล่องในคลิป</span>
                  </div>
                </label>
              </div>
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
                <span>คลังประวัติวิดีโอผูกเลขพัสดุ (Order & Tracking Video Logs)</span>
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
                placeholder="ค้นหาด้วยเลข Tracking (TH...) หรือ Order ID..."
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
                เมื่อยิงบาร์โค้ดใบปะหน้าและอัดคลิปเสร็จ รายการจะถูกผูกเลขพัสดุและจัดเก็บที่นี่ทันที
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
                    {/* Header tags: Tracking & Order */}
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

      {/* ========================================================= */}
      {/* 4. MODALS (Video Preview Modal & Barcode Command Sheet)    */}
      {/* ========================================================= */}

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

      {/* Barcode Command Sheet Modal (สำหรับปริ้นแปะข้างโต๊ะแพ็กของ) */}
      {showCommandSheetModal && (
        <div
          onClick={() => setShowCommandSheetModal(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 p-6 space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="space-y-0.5">
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-purple-600" />
                  <span>แผ่นบาร์โค้ดคำสั่งสำหรับโต๊ะแพ็ก</span>
                </h3>
                <p className="text-xs text-slate-500">
                  สามารถปริ้นแผ่นนี้ไปแปะไว้ข้างโต๊ะแพ็ก เพื่อยิงคำสั่งได้โดยไม่ต้องแตะคีย์บอร์ด
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCommandSheetModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Command Barcode Strips */}
            <div className="space-y-4">
              {/* Command 1: FINISH */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                <span className="text-xs font-bold text-rose-700 uppercase tracking-wider block">
                  1. ยิงเพื่อยืนยันการแพ็กเสร็จสิ้น & บันทึกคลิป
                </span>
                <div className="h-14 flex items-center justify-center bg-white p-2 rounded-xl border border-slate-100">
                  <svg
                    viewBox={`0 0 ${encodeCode128B('FINISH').totalModules} 100`}
                    preserveAspectRatio="none"
                    className="w-48 h-full"
                    style={{ shapeRendering: 'crispEdges' }}
                  >
                    {encodeCode128B('FINISH').bars.map((bar, i) => (
                      <rect key={i} x={bar.x} y={0} width={bar.width} height={100} fill="black" />
                    ))}
                  </svg>
                </div>
                <span className="font-mono font-bold text-xs text-slate-900 block">* FINISH *</span>
              </div>

              {/* Command 2: PAUSE */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">
                  2. ยิงเพื่อพักการบันทึกชั่วคราว
                </span>
                <div className="h-14 flex items-center justify-center bg-white p-2 rounded-xl border border-slate-100">
                  <svg
                    viewBox={`0 0 ${encodeCode128B('PAUSE').totalModules} 100`}
                    preserveAspectRatio="none"
                    className="w-48 h-full"
                    style={{ shapeRendering: 'crispEdges' }}
                  >
                    {encodeCode128B('PAUSE').bars.map((bar, i) => (
                      <rect key={i} x={bar.x} y={0} width={bar.width} height={100} fill="black" />
                    ))}
                  </svg>
                </div>
                <span className="font-mono font-bold text-xs text-slate-900 block">* PAUSE *</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-400">💡 รองรับสแกนเนอร์บาร์โค้ด 1D/2D ทุกรุ่น</span>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 transition flex items-center gap-1.5 shadow-md shadow-purple-600/20"
              >
                <Printer className="w-4 h-4" />
                <span>สั่งพิมพ์แผ่นนี้</span>
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
