import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, bucketName, isR2Configured } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SignalRoom {
  roomId: string;
  offer: any | null;
  answer: any | null;
  hostCandidates: any[];
  cameraCandidates: any[];
  updatedAt: string;
}

const memoryRooms = new Map<string, SignalRoom>();

function sanitizeRoomId(raw: string | null): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 24);
}

function r2RoomKey(roomId: string): string {
  return `tmp/webrtc-rooms/${roomId}.json`;
}

async function readRoom(roomId: string): Promise<SignalRoom | null> {
  if (isR2Configured && r2Client) {
    try {
      const res = await r2Client.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: r2RoomKey(roomId),
        })
      );
      const text = await res.Body?.transformToString();
      if (text) {
        const parsed = JSON.parse(text) as SignalRoom;
        memoryRooms.set(roomId, parsed);
        return parsed;
      }
    } catch (err: any) {
      if (err?.name !== 'NoSuchKey' && err?.$metadata?.httpStatusCode !== 404) {
        console.warn('R2 signal read error:', err?.message);
      }
    }
  }
  return memoryRooms.get(roomId) || null;
}

async function writeRoom(room: SignalRoom): Promise<SignalRoom> {
  const next: SignalRoom = {
    ...room,
    updatedAt: new Date().toISOString(),
  };
  memoryRooms.set(room.roomId, next);

  if (isR2Configured && r2Client) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: r2RoomKey(room.roomId),
        Body: JSON.stringify(next),
        ContentType: 'application/json',
      })
    );
  }
  return next;
}

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = sanitizeRoomId(searchParams.get('room'));
  if (!roomId) {
    return jsonNoStore({ error: 'Missing room parameter' }, { status: 400 });
  }

  const room = await readRoom(roomId);
  if (!room) {
    return jsonNoStore({
      roomId,
      offer: null,
      answer: null,
      hostCandidates: [],
      cameraCandidates: [],
      updatedAt: null,
    });
  }

  return jsonNoStore(room);
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
      const fresh: SignalRoom = {
        roomId,
        offer: null,
        answer: null,
        hostCandidates: [],
        cameraCandidates: [],
        updatedAt: new Date().toISOString(),
      };
      await writeRoom(fresh);
      return jsonNoStore(fresh);
    }

    const existing: SignalRoom = (await readRoom(roomId)) || {
      roomId,
      offer: null,
      answer: null,
      hostCandidates: [],
      cameraCandidates: [],
      updatedAt: new Date().toISOString(),
    };

    if (action === 'offer') {
      const updated = await writeRoom({
        ...existing,
        offer: body.offer || null,
        answer: null,
        hostCandidates: [],
        cameraCandidates: [],
      });
      return jsonNoStore(updated);
    }

    if (action === 'answer') {
      const updated = await writeRoom({
        ...existing,
        answer: body.answer || null,
      });
      return jsonNoStore(updated);
    }

    if (action === 'candidate') {
      const role = body.role === 'host' ? 'host' : 'camera';
      const candidate = body.candidate;
      if (!candidate) {
        return jsonNoStore(existing);
      }

      const hostCandidates =
        role === 'host'
          ? [...(existing.hostCandidates || []), candidate]
          : existing.hostCandidates || [];
      const cameraCandidates =
        role === 'camera'
          ? [...(existing.cameraCandidates || []), candidate]
          : existing.cameraCandidates || [];

      const updated = await writeRoom({
        ...existing,
        hostCandidates,
        cameraCandidates,
      });
      return jsonNoStore(updated);
    }

    return jsonNoStore({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('POST /api/packing/signal error:', err);
    return jsonNoStore({ error: err?.message || 'Signaling error' }, { status: 500 });
  }
}
