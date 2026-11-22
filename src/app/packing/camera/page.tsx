'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Camera,
  RefreshCw,
  Wifi,
  WifiOff,
  Mic,
  MicOff,
  FlipHorizontal,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function RemoteCameraContent() {
  const searchParams = useSearchParams();
  const roomId = (searchParams.get('room') || '').trim().toUpperCase();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const appliedHostCandidatesRef = useRef<Set<string>>(new Set());
  const remoteSetRef = useRef<boolean>(false);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [micEnabled, setMicEnabled] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'starting' | 'waiting' | 'connected' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cleanup = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    remoteSetRef.current = false;
    appliedHostCandidatesRef.current.clear();
  };

  useEffect(() => {
    return () => cleanup();
  }, []);

  const startStreaming = async (facing: 'environment' | 'user' = facingMode, useMic = micEnabled) => {
    if (!roomId) {
      setStatus('error');
      setErrorMsg('ไม่พบรหัสห้อง (Room ID) กรุณาสแกน QR จากหน้าคอมใหม่อีกครั้ง');
      return;
    }

    cleanup();
    setStatus('starting');
    setErrorMsg(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง (กรุณาเปิดผ่าน HTTPS เช่น Safari / Chrome)');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: useMic,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = async (ev) => {
        if (ev.candidate) {
          try {
            await fetch('/api/packing/signal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId,
                action: 'candidate',
                role: 'camera',
                candidate: ev.candidate.toJSON(),
              }),
            });
          } catch {
            // ignore
          }
        }
      };

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === 'connected') {
          setStatus('connected');
        } else if (st === 'failed' || st === 'disconnected') {
          setStatus('waiting');
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait briefly for ICE candidates to bake into localDescription (Vanilla ICE)
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
          return;
        }
        const timer = setTimeout(resolve, 1800);
        const onState = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timer);
            pc.removeEventListener('icegatheringstatechange', onState);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', onState);
      });

      const finalOffer = pc.localDescription || offer;
      await fetch('/api/packing/signal', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          action: 'offer',
          offer: { type: finalOffer.type, sdp: finalOffer.sdp },
        }),
      });

      setStatus('waiting');

      // Poll for host answer & ICE candidates (bypass all caches)
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            `/api/packing/signal?room=${encodeURIComponent(roomId)}&t=${Date.now()}`,
            { cache: 'no-store' }
          );
          if (!res.ok) return;
          const room = await res.json();

          if (room.answer && !remoteSetRef.current && pc.signalingState !== 'closed') {
            remoteSetRef.current = true;
            await pc.setRemoteDescription(new RTCSessionDescription(room.answer));
          }

          if (remoteSetRef.current && Array.isArray(room.hostCandidates)) {
            for (const cand of room.hostCandidates) {
              const key = JSON.stringify(cand);
              if (!appliedHostCandidatesRef.current.has(key)) {
                appliedHostCandidatesRef.current.add(key);
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch {
                  // ignore
                }
              }
            }
          }
        } catch {
          // keep polling
        }
      }, 800);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || 'ไม่สามารถเปิดกล้องได้');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 select-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5 text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black tracking-tight truncate">
              Vivida Remote Camera
            </p>
            <p className="text-[11px] font-mono text-purple-300">
              ห้อง: {roomId || 'ไม่มีรหัส'}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {status === 'connected' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>กำลังส่งภาพสด</span>
            </span>
          ) : status === 'waiting' || status === 'starting' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
              <Wifi className="w-3.5 h-3.5 animate-pulse" />
              <span>กำลังเชื่อมต่อคอม...</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-[11px] font-bold">
              <WifiOff className="w-3.5 h-3.5" />
              <span>ยังไม่เริ่ม</span>
            </span>
          )}
        </div>
      </div>

      {/* Camera Preview */}
      <div className="relative flex-1 my-3 rounded-3xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {status === 'idle' && (
          <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center">
              <Camera className="w-8 h-8 text-purple-400" />
            </div>
            <div className="space-y-1 max-w-xs">
              <h2 className="text-base font-bold">พร้อมใช้กล้องมือถือส่งภาพเข้าคอม</h2>
              <p className="text-xs text-slate-400">
                ไม่ต้องใช้ Apple ID เดียวกัน แค่กดปุ่มด้านล่างและวางมือถือบนขาตั้งได้เลย
              </p>
            </div>
            <button
              type="button"
              onClick={() => startStreaming(facingMode, micEnabled)}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-sm shadow-lg shadow-purple-600/30 active:scale-95 transition"
            >
              📷 เปิดกล้อง & ส่งภาพเข้าคอม
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-rose-400" />
            <p className="text-sm font-bold text-rose-300">เกิดข้อผิดพลาด</p>
            <p className="text-xs text-slate-300 max-w-xs">{errorMsg}</p>
            <button
              type="button"
              onClick={() => startStreaming(facingMode, micEnabled)}
              className="px-5 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs"
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            const next = facingMode === 'environment' ? 'user' : 'environment';
            setFacingMode(next);
            if (status !== 'idle') startStreaming(next, micEnabled);
          }}
          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <FlipHorizontal className="w-4 h-4" />
          <span>{facingMode === 'environment' ? 'กล้องหลัง' : 'กล้องหน้า'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const nextMic = !micEnabled;
            setMicEnabled(nextMic);
            if (status !== 'idle') startStreaming(facingMode, nextMic);
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
            micEnabled ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'
          }`}
        >
          {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          <span>{micEnabled ? 'เปิดไมค์' : 'ปิดไมค์'}</span>
        </button>

        <button
          type="button"
          onClick={() => startStreaming(facingMode, micEnabled)}
          className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-4 h-4" />
          <span>เชื่อมใหม่</span>
        </button>
      </div>
    </div>
  );
}

export default function RemoteCameraPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center text-sm">
          กำลังโหลดกล้อง...
        </div>
      }
    >
      <RemoteCameraContent />
    </Suspense>
  );
}
