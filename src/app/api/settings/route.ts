import { NextResponse } from 'next/server';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, bucketName, isR2Configured } from '@/lib/r2';
import {
  DEFAULT_STONE_SHAPES,
  DEFAULT_STONE_TYPES,
  StoneShapeItem,
  StoneTypeItem,
  sortAlphabetically,
} from '@/lib/stoneConstants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SETTINGS_KEY = 'config/settings.json';

// In-memory cache for ultra-fast server responses
let cachedSettings: {
  shapes: StoneShapeItem[];
  stones: StoneTypeItem[];
  hideCost: boolean;
  updatedAt: string;
} | null = null;

function sanitizeStones(stones: StoneTypeItem[]): StoneTypeItem[] {
  return stones.map((s) => {
    if (
      s.id.toLowerCase() === 'bloodston' ||
      s.label.toLowerCase().includes('bloodston')
    ) {
      return {
        id: 'Bloodstone',
        code: s.code || 'BLO',
        label: 'Bloodstone (บลัดสโตน)',
        isDefault: s.isDefault ?? false,
      };
    }
    if (
      s.id.toLowerCase() === 'chinese alphabet stone' ||
      s.code === 'CAS' ||
      s.label.toLowerCase().includes('chinese alphabet stone')
    ) {
      return {
        id: 'Chinese Writing Stone',
        code: 'CWS',
        label: 'Chinese Writing Stone (หินอักษรจีน / หินตัวหนังสือจีน)',
        isDefault: false,
      };
    }
    return s;
  });
}

export async function GET() {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
  };

  try {
    if (isR2Configured && r2Client) {
      try {
        const cmd = new GetObjectCommand({
          Bucket: bucketName,
          Key: SETTINGS_KEY,
        });
        const res = await r2Client.send(cmd);
        if (res.Body) {
          const raw = await res.Body.transformToString();
          const parsed = JSON.parse(raw);

          const shapes = Array.isArray(parsed.shapes) && parsed.shapes.length > 0
            ? sortAlphabetically(parsed.shapes as StoneShapeItem[])
            : sortAlphabetically(DEFAULT_STONE_SHAPES);

          const stones = Array.isArray(parsed.stones) && parsed.stones.length > 0
            ? sortAlphabetically(sanitizeStones(parsed.stones as StoneTypeItem[]))
            : sortAlphabetically(DEFAULT_STONE_TYPES);

          const hideCost = typeof parsed.hideCost === 'boolean' ? parsed.hideCost : true;
          const updatedAt = parsed.updatedAt || new Date().toISOString();

          cachedSettings = { shapes, stones, hideCost, updatedAt };

          return NextResponse.json(
            {
              success: true,
              source: 'r2',
              shapes,
              stones,
              hideCost,
              updatedAt,
            },
            { headers }
          );
        }
      } catch (err: unknown) {
        const isNotFound =
          err && typeof err === 'object' && ('name' in err || 'Code' in err)
            ? (err as { name?: string; Code?: string }).name === 'NoSuchKey' ||
              (err as { name?: string; Code?: string }).Code === 'NoSuchKey'
            : false;

        if (!isNotFound) {
          console.warn('R2 GetObject error, falling back to cache/defaults:', err);
        }
      }
    }

    // Fallback: return cached or defaults
    const shapes = cachedSettings?.shapes || sortAlphabetically(DEFAULT_STONE_SHAPES);
    const stones = cachedSettings?.stones || sortAlphabetically(DEFAULT_STONE_TYPES);
    const hideCost = cachedSettings ? cachedSettings.hideCost : true;

    return NextResponse.json(
      {
        success: true,
        source: cachedSettings ? 'memory' : 'defaults',
        shapes,
        stones,
        hideCost,
        updatedAt: cachedSettings?.updatedAt || new Date().toISOString(),
      },
      { headers }
    );
  } catch (error) {
    console.error('Failed to load settings:', error);
    return NextResponse.json(
      {
        success: true,
        source: 'error-fallback',
        shapes: sortAlphabetically(DEFAULT_STONE_SHAPES),
        stones: sortAlphabetically(DEFAULT_STONE_TYPES),
        hideCost: true,
      },
      { status: 200, headers }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shapes, stones, hideCost } = body;

    const cleanShapes = Array.isArray(shapes) && shapes.length > 0
      ? sortAlphabetically(shapes as StoneShapeItem[])
      : sortAlphabetically(DEFAULT_STONE_SHAPES);

    const cleanStones = Array.isArray(stones) && stones.length > 0
      ? sortAlphabetically(sanitizeStones(stones as StoneTypeItem[]))
      : sortAlphabetically(DEFAULT_STONE_TYPES);

    const cleanHideCost = typeof hideCost === 'boolean' ? hideCost : true;
    const updatedAt = new Date().toISOString();

    const payload = {
      shapes: cleanShapes,
      stones: cleanStones,
      hideCost: cleanHideCost,
      updatedAt,
    };

    // Update in-memory cache immediately
    cachedSettings = payload;

    // Persist to Cloudflare R2
    if (isR2Configured && r2Client) {
      try {
        const cmd = new PutObjectCommand({
          Bucket: bucketName,
          Key: SETTINGS_KEY,
          Body: JSON.stringify(payload, null, 2),
          ContentType: 'application/json',
        });
        await r2Client.send(cmd);
      } catch (r2Err) {
        console.warn('Failed to write settings to R2:', r2Err);
      }
    }

    return NextResponse.json({
      success: true,
      savedToR2: Boolean(isR2Configured && r2Client),
      ...payload,
    });
  } catch (error) {
    console.error('Failed to save settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to persist settings' },
      { status: 500 }
    );
  }
}
