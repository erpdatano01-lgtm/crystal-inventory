'use client';

import React, { useState, useRef } from 'react';
import { Camera, UploadCloud, X, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import { compressAndConvertToWebP, formatFileSize } from '@/utils/imageCompression';

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxFiles?: number;
  label?: string;
  allowCamera?: boolean;
  folder?: 'receipts' | 'products';
  sku?: string;
}

interface UploadingState {
  originalName: string;
  progress: number;
  originalSize: number;
  compressedSize?: number;
  reductionPercentage?: number;
  status: 'compressing' | 'uploading' | 'done' | 'error';
  errorMessage?: string;
}

export default function ImageUploader({
  images,
  onChange,
  maxFiles = 5,
  label = 'รูปภาพ (แปลง WebP อัตโนมัติ)',
  allowCamera = true,
  folder = 'products',
  sku,
}: ImageUploaderProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleProcessFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    if (images.length + fileArray.length > maxFiles) {
      alert(`สามารถอัปโหลดได้สูงสุด ${maxFiles} รูป`);
      return;
    }

    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) {
        alert(`ไฟล์ ${file.name} ไม่ใช่รูปภาพ`);
        continue;
      }

      const uploadId = file.name;
      const initialUploadState: UploadingState = {
        originalName: file.name,
        progress: 10,
        originalSize: file.size,
        status: 'compressing',
      };

      setUploadingFiles((prev) => [...prev, initialUploadState]);

      try {
        // Step 1: Compress & convert to .webp client-side (Max 1200px, 0.8 quality)
        const compression = await compressAndConvertToWebP(file, 1200, 0.8);

        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.originalName === uploadId
              ? {
                  ...item,
                  compressedSize: compression.compressedSize,
                  reductionPercentage: compression.reductionPercentage,
                  progress: 50,
                  status: 'uploading',
                }
              : item
          )
        );

        // Step 2: Upload to Cloudflare R2 / Server API with folder & sku
        const formData = new FormData();
        formData.append('file', compression.file);
        formData.append('folder', folder);
        if (sku) formData.append('sku', sku);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Upload failed');
        }

        const data = await res.json();
        const uploadedUrl = data.url;

        onChange([...images, uploadedUrl]);

        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.originalName === uploadId
              ? { ...item, progress: 100, status: 'done' }
              : item
          )
        );

        setTimeout(() => {
          setUploadingFiles((prev) =>
            prev.filter((item) => item.originalName !== uploadId)
          );
        }, 2200);
      } catch (err: any) {
        console.error('Image processing/upload error:', err);
        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.originalName === uploadId
              ? {
                  ...item,
                  status: 'error',
                  errorMessage: err.message || 'เกิดข้อผิดพลาดในการอัปโหลด',
                }
              : item
          )
        );
      }
    }
  };

  const removeImage = (indexToRemove: number) => {
    onChange(images.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          {label}
        </label>
        <span className="text-xs text-slate-500">
          {images.length}/{maxFiles} รูป
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={maxFiles > 1}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleProcessFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleProcessFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {allowCamera && (
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl shadow-sm hover:from-purple-700 hover:to-indigo-700 active:scale-[0.98] transition font-medium text-xs sm:text-sm"
          >
            <Camera className="w-4 h-4" />
            <span>ถ่ายรูปด้วยกล้องมือถือ</span>
          </button>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) handleProcessFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-xl cursor-pointer text-xs sm:text-sm font-medium transition ${
            isDragging
              ? 'border-purple-500 bg-purple-50 text-purple-700'
              : 'border-slate-300 hover:border-purple-400 bg-slate-50 hover:bg-slate-100 text-slate-700'
          } ${!allowCamera ? 'sm:col-span-2' : ''}`}
        >
          <UploadCloud className="w-4 h-4 text-slate-500" />
          <span>เลือกรูปจากคลังภาพ (Photo Library)</span>
        </div>
      </div>

      {uploadingFiles.length > 0 && (
        <div className="space-y-2 mt-2">
          {uploadingFiles.map((item, idx) => (
            <div
              key={idx}
              className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between font-medium">
                <span className="truncate max-w-[200px] text-slate-800">
                  {item.originalName}
                </span>
                <span className="flex items-center gap-1">
                  {item.status === 'compressing' && (
                    <span className="text-amber-600 animate-pulse">
                      ⚡ ย่อเป็น WebP (Max 1200px)...
                    </span>
                  )}
                  {item.status === 'uploading' && (
                    <span className="text-blue-600">
                      ☁️ ส่งขึ้น R2 ({folder})...
                    </span>
                  )}
                  {item.status === 'done' && (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> อัปโหลดสำเร็จ
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> ล้มเหลว
                    </span>
                  )}
                </span>
              </div>

              {item.compressedSize && (
                <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 px-2 py-1 rounded">
                  <span>เดิม: {formatFileSize(item.originalSize)}</span>
                  <span>→</span>
                  <span className="font-semibold text-purple-700">
                    WebP: {formatFileSize(item.compressedSize)}
                  </span>
                  <span className="text-emerald-600 font-medium">
                    (ลดลง {item.reductionPercentage}%)
                  </span>
                </div>
              )}

              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    item.status === 'error'
                      ? 'bg-rose-500'
                      : item.status === 'done'
                      ? 'bg-emerald-500'
                      : 'bg-purple-600'
                  }`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 pt-2">
          {images.map((url, idx) => (
            <div
              key={idx}
              className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group bg-slate-100 shadow-sm"
            >
              <img
                src={url}
                alt={`Image ${idx + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              />
              {idx === 0 && (
                <span className="absolute top-1 left-1 bg-purple-700/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                  รูปหลัก
                </span>
              )}
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-full transition shadow"
                title="ลบรูปนี้"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
