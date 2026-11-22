import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, bucketName, isR2Configured } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

function jsonNoStore(data: any, init?: { status?: number }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: NO_STORE_HEADERS,
  });
}

function sanitizeRoomId(raw: string | null): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 24);
}

// Separate key per artifact eliminates ALL concurrent write/overwrite race conditions
function keyFor(roomId: string, part: 'offer' | 'answer' | 'host-cand' | 'cam-cand'): string {
  return `tmp/webrtc-rooms/${roomId}/${part}.json`;
}

const memoryParts = new Map<string, any>();

async function readPart<T>(roomId: string, part: 'offer' | 'answer' | 'host-cand' | 'cam-cand'): Promise<T | null> {
  const k = keyFor(roomId, part);
  if (isR2Configured && r2Client) {
    try {
      const res = await r2Client.send(new GetObjectCommand({ Bucket: bucketName, Key: k }));
      const text = await res.Body?.transformToString();
      if (text) return JSON.parse(text) as T;
    } catch (err: any) {
      if (err?.name !== 'NoSuchKey' && err?.$metadata?.httpStatusCode !== 404) {
        console.warn(`R2 signal read error (${k}):`, err?.message);
      }
    }
    return null;
  }
  return (memoryParts.get(k) as T) || null;
}

async function writePart(roomId: string, part: 'offer' | 'answer' | 'host-cand' | 'cam-cand', value: any): Promise<void> {
  const k = keyFor(roomId, part);
  memoryParts.set(k, value);
  if (isR2Configured && r2Client) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: k,
        Body: JSON.stringify(value),
        ContentType: 'application/json',
      })
    );
  }
}

async function deletePart(roomId: string, part: 'offer' | 'answer' | 'host-cand' | 'cam-cand'): Promise<void> {
  const k = keyFor(roomId, part);
  memoryParts.delete(k);
  if (isR2Configured && r2Client) {
    try {
      await r2Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: k }));
    } catch {
      // ignore
    }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = sanitizeRoomId(searchParams.get('room'));
  if (!roomId) {
    return jsonNoStore({ error: 'Missing room parameter' }, { status: 400 });
  }

  const [offer, answer, hostCandidates, cameraCandidates] = await Promise.all([
    readPart<any>(roomId, 'offer'),
    readPart<any>(roomId, 'answer'),
    readPart<any[]>(roomId, 'host-cand'),
    readPart<any[]>(roomId, 'cam-cand'),
  ]);

  return jsonNoStore({
    roomId,
    offer: offer || null,
    answer: answer || null,
    hostCandidates: Array.isArray(hostCandidates) ? hostCandidates : [],
    cameraCandidates: Array.isArray(cameraCandidates) ? cameraCandidates : [],
    updatedAt: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const roomId = sanitizeRoomId(body?.roomId);
    const action = String(body?.action || '');

    if (!roomId) {
      return jsonNoStore({ error: 'Missing roomId' }, { status: 400 });
    }

    if (action === 'create' || action === 'reset') {
      await Promise.all([
        deletePart(roomId, 'offer'),
        deletePart(roomId, 'answer'),
        deletePart(roomId, 'host-cand'),
        deletePart(roomId, 'cam-cand'),
      ]);
      return jsonNoStore({
        roomId,
        offer: null,
        answer: null,
        hostCandidates: [],
        cameraCandidates: [],
      });
    }

    if (action === 'offer') {
      await Promise.all([
        writePart(roomId, 'offer', body.offer || null),
        deletePart(roomId, 'answer'),
        deletePart(roomId, 'host-cand'),
      ]);
      return jsonNoStore({ success: true, roomId, action: 'offer' });
    }

    if (action === 'answer') {
      await writePart(roomId, 'answer', body.answer || null);
      return jsonNoStore({ success: true, roomId, action: 'answer' });
    }

    if (action === 'candidate') {
      const part = body.role === 'host' ? 'host-cand' : 'cam-cand';
      const candidate = body.candidate;
      if (!candidate) {
        return jsonNoStore({ success: true });
      }
      const existing = (await readPart<any[]>(roomId, part)) || [];
      await writePart(roomId, part, [...existing, candidate]);
      return jsonNoStore({ success: true, roomId, part });
    }

    return jsonNoStore({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('POST /api/packing/signal error:', err);
    return jsonNoStore({ error: err?.message || 'Signaling error' }, { status: 500 });
  }
}
