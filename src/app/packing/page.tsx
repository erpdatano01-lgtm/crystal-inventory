'use client';

import React, { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { fetchProducts } from '@/lib/inventoryService';
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

  // Past Packing Records
  const [packingRecords, setPackingRecords] = useState<PackingLog[]>([]);

  // Refs
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
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

    return () => {
      stopCamera();
    };
  }, []);

  // 2. Start / Stop Camera Stream
  const startCamera = async (facing: 'user' | 'environment' = cameraFacing) => {
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
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'เบราว์เซอร์ถูกปฏิเสธการเข้าถึงกล้อง กรุณากดอนุญาตการใช้กล้องและไมค์ในแถบ URL'
          : `ไม่สามารถเปิดกล้องได้: ${err.message || 'เกิดข้อผิดพลาด'}`
      );
      setIsCameraActive(false);
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
  const startRecording = async () => {
    if (!isCameraActive || !mediaStreamRef.current) {
      await startCamera();
      if (!mediaStreamRef.current) return;
    }

    recordedChunksRef.current = [];
    setRecordingDuration(0);
    setRecordedBlob(null);
    setRecordedVideoUrl(null);
    setUploadedPublicUrl(null);

    try {
      // Auto-detect optimal video mimeType
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : '';

      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(mediaStreamRef.current, options);

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
      };

      recorder.start(1000); // chunk every second
      mediaRecorderRef.current = recorder;
      setRecordingState('recording');

      // Start duration timer
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      showToast('🔴 เริ่มบันทึกคลิปการแพ็กแล้ว (กด Spacebar เพื่อหยุด)');
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
      showToast('⏹️ บันทึกคลิปแพ็กเสร็จสิ้น! สามารถเปิดดูตัวอย่างได้');
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

  // Keyboard shortcut: Spacebar to toggle recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (recordingState === 'idle') {
          startRecording();
        } else if (recordingState === 'recording') {
          stopRecording();
        } else if (recordingState === 'recorded') {
          resetRecording();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recordingState, isCameraActive]);

  // 4. File input fallback (Upload existing video or mobile native camera shot)
  const handleFileVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('กรุณาเลือกไฟล์วิดีโอ (เช่น MP4, MOV, WebM)');
      return;
    }

    const url = URL.createObjectURL(file);
    setRecordedBlob(file);
    setRecordedVideoUrl(url);
    setRecordingState('recorded');
    setRecordingDuration(0);
    showToast(`📹 โหลดคลิป "${file.name}" เรียบร้อยแล้ว`);
  };

  // 5. Save & Upload Video to R2 / Supabase
  const handleSaveAndUpload = async () => {
    if (!recordedBlob) {
      alert('ไม่พบไฟล์วิดีโอ กรุณาอัดคลิปก่อนกดบันทึก');
      return;
    }

    setIsUploading(true);
    let finalUrl = recordedVideoUrl || '';

    try {
      const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const targetCode = selectedOrder?.order_no || selectedSku || 'PACK';
      const fileName = `pack_${targetCode}_${Date.now()}.${ext}`;

      const formData = new FormData();
      formData.append('file', recordedBlob, fileName);
      formData.append('folder', 'packing');
      if (selectedSku) formData.append('sku', selectedSku);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) finalUrl = data.url;
      } else {
        console.warn('Upload API responded with non-200, fallback to local URL preview');
      }
    } catch (uploadErr) {
      console.warn('Upload error, persisting locally:', uploadErr);
    } finally {
      setIsUploading(false);
    }

    setUploadedPublicUrl(finalUrl);

    // Save Record to Local Storage
    const matchedProduct = products.find((p) => p.sku === selectedSku);
    const newRecord: PackingLog = {
      id: `pack_${Date.now()}`,
      order_id: selectedOrder?.id || null,
      order_no: selectedOrder?.order_no || null,
      sku: selectedSku || (selectedOrder?.items[0]?.sku ?? null),
      product_name: selectedOrder
        ? selectedOrder.items.map((i) => i.name).join(', ')
        : matchedProduct?.name || 'หิน Vivida Crystal',
      customer_name: selectedOrder?.customer_name || (customerIg ? `@${customerIg.replace('@', '')}` : 'ลูกค้า IG'),
      customer_ig: customerIg || (selectedOrder?.channel === 'INSTAGRAM' ? selectedOrder.customer_name : null),
      video_url: finalUrl,
      duration_seconds: recordingDuration,
      packed_at: new Date().toISOString(),
      tracking_no: trackingNo || selectedOrder?.tracking_no || null,
      notes: packingNotes || null,
    };

    const updatedRecords = [newRecord, ...packingRecords];
    setPackingRecords(updatedRecords);
    localStorage.setItem(LS_PACKING_RECORDS, JSON.stringify(updatedRecords));

    // If order was selected, auto-update order status to SHIPPED
    if (selectedOrder) {
      try {
        await fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedOrder.id,
            status: 'SHIPPED',
            packing_video_url: finalUrl,
            tracking_no: trackingNo || selectedOrder.tracking_no,
          }),
        });
      } catch (e) {
        console.warn('Order status update error:', e);
      }
    }

    showToast('🎉 บันทึกคลิปการแพ็กเข้าประวัติเรียบร้อยแล้ว!');
  };

  // 6. Download local video file (.webm / .mp4)
  const handleDownloadVideo = () => {
    if (!recordedVideoUrl) return;
    const a = document.createElement('a');
    a.href = recordedVideoUrl;
    const targetCode = selectedOrder?.order_no || selectedSku || 'PACK';
    a.download = `Vivida_Packing_${targetCode}_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('📥 ดาวน์โหลดคลิปวิดีโอลงเครื่องแล้ว');
  };

  // 7. Generate Friendly IG Message with Auto Copy
  const handleCopyIgMessage = () => {
    const custName = selectedOrder?.customer_name || (customerIg ? `@${customerIg.replace('@', '')}` : 'คุณลูกค้า');
    const stoneNames = selectedOrder
      ? selectedOrder.items.map((i) => `${i.name} (${i.sku})`).join(', ')
      : products.find((p) => p.sku === selectedSku)?.name || selectedSku || 'น้องหิน';

    const videoLink = uploadedPublicUrl || recordedVideoUrl || '(แนบคลิปส่งในแชท)';
    const trackStr = trackingNo ? `🚚 เลขพัสดุ Tracking: ${trackingNo}\n` : '';

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

  const activeStone = products.find((p) => p.sku === selectedSku);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:pl-64 pb-24 md:pb-12 text-slate-800">
      <Navbar />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-purple-200 text-xs font-semibold">
                <Video className="w-3.5 h-3.5 text-amber-400" />
                <span>Video Packing Station • ระบบบันทึกวิดีโอขณะแพ็กสินค้า</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                📦 ห้องแพ็กของ & บันทึกคลิปก่อนส่ง
              </h1>
              <p className="text-sm text-purple-200/90 max-w-2xl leading-relaxed">
                อัดวิดีโอตรวจสภาพหิน 360° พันบับเบิ้ล และปิดกล่องพัสดุเป็นหลักฐานกันเคลม
                พร้อมสร้างข้อความน่ารักๆ ส่งให้ลูกค้าทาง Instagram Direct ได้ใน 1 คลิก!
              </p>
            </div>

            {/* Quick Stats Badges */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-4 py-3 bg-white/10 backdrop-blur rounded-2xl border border-white/10">
                <span className="text-[11px] text-purple-200 block">ออเดอร์รอแพ็ก</span>
                <span className="text-xl font-black text-amber-400">
                  {orders.filter((o) => o.status === 'PAID' || o.status === 'WAITING_PAYMENT').length} บิล
                </span>
              </div>
              <div className="px-4 py-3 bg-white/10 backdrop-blur rounded-2xl border border-white/10">
                <span className="text-[11px] text-purple-200 block">คลิปที่บันทึกแล้ว</span>
                <span className="text-xl font-black text-emerald-400">{packingRecords.length} คลิป</span>
              </div>
            </div>
          </div>
        </div>

        {/* Studio Grid: Left Camera/Preview (2/3), Right Target/Checklist (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ========================================================= */}
          {/* LEFT: CAMERA VIEWFINDER & CONTROLS (7 or 8 Cols)           */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
            {/* Viewfinder Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
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
                    ? '📹 สตูดิโอกล้องสด (Live Packing Viewfinder)'
                    : '📹 หน้าจอกล้องสำหรับแพ็กของ'}
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
                  <p className="text-[11px] text-rose-600">
                    💡 ท่านยังสามารถใช้วิธีถ่ายด้วยกล้องมือถือแล้วกดปุ่ม "อัปโหลดคลิปจากเครื่อง" ด้านล่างได้เช่นกันครับ
                  </p>
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
                      คลิกปุ่มเปิดกล้องเพื่อเริ่มสตรีม หรือเลือกไฟล์วิดีโอจากเครื่อง
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

                  {/* Bottom Overlay: Order / Customer info badge */}
                  <div className="bg-black/70 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 max-w-md text-white text-xs space-y-0.5">
                    <div className="flex items-center gap-2 font-bold text-amber-300">
                      <span>📦 {selectedOrder ? selectedOrder.order_no : selectedSku || 'ออเดอร์แพ็กสินค้า'}</span>
                      {customerIg && <span className="text-purple-300 text-[11px]">@{customerIg.replace('@', '')}</span>}
                    </div>
                    <div className="text-[11px] text-slate-300 truncate">
                      {selectedOrder
                        ? selectedOrder.items.map((i) => i.name).join(', ')
                        : activeStone
                        ? `${activeStone.name} • ${activeStone.weight_grams ?? '-'}g`
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
              onChange={handleFileVideoUpload}
            />

            {/* Recording Action Bar & Controls */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Left: Main Action buttons */}
                <div className="flex items-center gap-2">
                  {recordingState === 'idle' && (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-black text-sm sm:text-base hover:from-rose-700 hover:to-red-700 active:scale-95 transition shadow-lg shadow-rose-600/25 flex items-center gap-2"
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-white animate-ping" />
                      <span>🔴 เริ่มอัดคลิปแพ็กของ</span>
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
                        <span>⏹️ หยุดบันทึก ({formatTime(recordingDuration)})</span>
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
                      <button
                        type="button"
                        onClick={handleSaveAndUpload}
                        disabled={isUploading}
                        className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm sm:text-base hover:from-emerald-700 hover:to-teal-700 active:scale-95 transition shadow-lg shadow-emerald-600/25 flex items-center gap-2 disabled:opacity-50"
                      >
                        {isUploading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>กำลังบันทึกคลิป...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-5 h-5" />
                            <span>💾 บันทึกคลิป & ปิดกล่อง</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={resetRecording}
                        className="px-3.5 py-3 rounded-2xl bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-300 transition flex items-center gap-1"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>อัดใหม่</span>
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
                  onClick={handleCopyIgMessage}
                  className="px-4 py-3 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-pink-500/20 hover:opacity-95 active:scale-95 transition flex items-center gap-1.5 ml-auto"
                  title="คัดลอกข้อความทักหาลูกค้าใน IG พร้อมลิงก์คลิป"
                >
                  <Share2 className="w-4 h-4" />
                  <span>📋 ก๊อปปี้ข้อความส่ง IG</span>
                </button>
              </div>

              {/* Keyboard Shortcut & Quick Hint */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60">
                <span className="flex items-center gap-1">
                  ⌨️ คีย์ลัด: กดปุ่ม <kbd className="px-1.5 py-0.5 bg-white border rounded font-mono font-bold">Spacebar</kbd> เพื่อเริ่มหรือหยุดบันทึกได้ทันที
                </span>
                <span>✨ ความยาวที่แนะนำ: 30 - 60 วินาที</span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT: ORDER SELECTOR & QUALITY CHECKLIST (4 or 5 Cols)   */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5">
            {/* Target Select Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-purple-600" />
                  <span>เลือกรายการที่กำลังจะแพ็ก</span>
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
                        if (ord?.channel === 'INSTAGRAM') {
                          setCustomerIg(ord.customer_name);
                        }
                        if (ord?.tracking_no) {
                          setTrackingNo(ord.tracking_no);
                        }
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
                          👤 ลูกค้า: <span className="font-bold">{selectedOrder.customer_name}</span>
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

              {/* Shipping Tracking Number Input */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-purple-600" />
                  <span>เลขพัสดุ Tracking (Flash / EMS / Kerry)</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น TH1234567890 หรือ TH0123"
                  value={trackingNo}
                  onChange={(e) => setTrackingNo(e.target.value)}
                  className="w-full px-3.5 py-2 text-base sm:text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                />
              </div>
            </div>

            {/* Quality Checklist Before Sealing (การตรวจสภาพเพื่อกันเคลม) */}
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
                    <span className="text-[11px] text-slate-500">ส่องไฟเช็คความสมบูรณ์ ไม่มีรอยแตกหักเพิ่ม</span>
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
        {/* BOTTOM: RECENT PACKING RECORDS HISTORY                    */}
        {/* ========================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <span>ประวัติการแพ็กของ & บันทึกคลิปล่าสุด (Recent Packing Logs)</span>
              </h3>
              <p className="text-xs text-slate-500">
                คลิปวิดีโอที่บันทึกไว้จะแสดงอยู่ที่นี่ สามารถกดเปิดดู หรือคัดลอกลิงก์ส่งให้ลูกค้าได้ตลอดเวลา
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-100">
              รวม {packingRecords.length} รายการ
            </span>
          </div>

          {packingRecords.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Package className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <p className="text-sm">ยังไม่มีคลิปบันทึกการแพ็กในระบบ</p>
              <p className="text-xs text-slate-400">เมื่อคุณกดอัดวิดีโอและบันทึก รายการจะปรากฏขึ้นที่นี่อัตโนมัติ</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packingRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-purple-300 transition space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-purple-900 font-mono">
                        {rec.order_no || rec.sku || 'PACK'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(rec.packed_at).toLocaleString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="text-xs space-y-0.5">
                      <p className="font-bold text-slate-800 truncate">{rec.product_name}</p>
                      <p className="text-slate-500 truncate">
                        👤 ผู้รับ: <span className="text-slate-700 font-medium">{rec.customer_name}</span>
                      </p>
                      {rec.tracking_no && (
                        <p className="text-[11px] font-mono text-emerald-700 font-semibold truncate">
                          🚚 {rec.tracking_no}
                        </p>
                      )}
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
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 space-y-3 p-4"
          >
            <div className="flex items-center justify-between text-white pb-2 border-b border-slate-800">
              <span className="font-bold text-sm flex items-center gap-2">
                <Video className="w-4 h-4 text-purple-400" />
                <span>คลิปวิดีโอตอนแพ็กสินค้า</span>
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

      {/* Floating Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs sm:text-sm font-semibold border border-slate-800 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
