'use client';

import React, { useState, useRef } from 'react';
import { Video, UploadCloud, X, CheckCircle2, Film, AlertCircle, Play } from 'lucide-react';
import { formatFileSize } from '@/utils/imageCompression';

interface VideoUploaderProps {
  videoUrl: string | null;
  onChange: (url: string | null) => void;
  sku?: string;
  label?: string;
}

export default function VideoUploader({
  videoUrl,
  onChange,
  sku,
  label = 'วิดีโอหินส่องไฟ / ประกายผลึก (ถ่ายหรือเลือกจากเครื่อง)',
}: VideoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleProcessVideo = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('กรุณาเลือกไฟล์วิดีโอ (เช่น MP4, MOV, WebM)');
      return;
    }

    // Limit to 100MB
    if (file.size > 100 * 1024 * 1024) {
      alert('ขนาดไฟล์วิดีโอเกิน 100MB กรุณาเลือกคลิปที่มีความยาวสั้นลง');
      return;
    }

    setFileInfo({ name: file.name, size: file.size });
    setIsUploading(true);
    setUploadProgress(20);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'products');
      if (sku) formData.append('sku', sku);

      setUploadProgress(45);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }

      setUploadProgress(85);
      const data = await res.json();
      onChange(data.url);
      setUploadProgress(100);

      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);
    } catch (err: any) {
      console.error('Video upload error:', err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการอัปโหลดวิดีโอ');
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    onChange(null);
    setFileInfo(null);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Film className="w-3.5 h-3.5 text-purple-600" />
          {label}
        </label>
        {videoUrl && (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
            ✓ มีคลิปวิดีโอแล้ว
          </span>
        )}
      </div>

      {/* Hidden file & camera inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleProcessVideo(e.target.files[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleProcessVideo(e.target.files[0]);
          e.target.value = '';
        }}
      />

      {/* Upload Buttons */}
      {!videoUrl ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl shadow-sm hover:from-purple-700 hover:to-indigo-700 active:scale-[0.98] transition font-medium text-xs sm:text-sm disabled:opacity-50"
          >
            <Video className="w-4 h-4" />
            <span>ถ่ายคลิปด้วยกล้องมือถือ</span>
          </button>

          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 hover:border-purple-400 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl cursor-pointer text-xs sm:text-sm font-medium transition disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4 text-slate-500" />
            <span>เลือกคลิปวิดีโอจากเครื่อง</span>
          </button>
        </div>
      ) : (
        /* Video Preview */
        <div className="relative p-3 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300 px-1">
            <span className="flex items-center gap-1.5 font-medium truncate max-w-[220px]">
              <Film className="w-3.5 h-3.5 text-purple-400" />
              {fileInfo?.name || 'คลิปวิดีโอของหินชิ้นนี้'}
            </span>
            <button
              type="button"
              onClick={handleRemove}
              className="px-2 py-1 bg-rose-500/80 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition"
            >
              <X className="w-3 h-3" />
              <span>ลบคลิป</span>
            </button>
          </div>

          <video
            src={videoUrl}
            controls
            playsInline
            className="w-full max-h-56 rounded-xl bg-black object-contain"
          />
        </div>
      )}

      {/* Progress & Error indicators */}
      {isUploading && (
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm text-xs space-y-2">
          <div className="flex items-center justify-between font-medium text-slate-700">
            <span className="truncate max-w-[200px]">{fileInfo?.name}</span>
            <span className="text-purple-600 animate-pulse font-bold">
              กำลังอัปโหลดวิดีโอ {uploadProgress}%...
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          {fileInfo && (
            <div className="text-[11px] text-slate-400">
              ขนาดไฟล์: {formatFileSize(fileInfo.size)}
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
