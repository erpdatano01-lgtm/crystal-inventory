import { NextRequest, NextResponse } from 'next/server';
import { getR2PresignedUploadUrl, isR2Configured } from '@/lib/r2';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    if (!isR2Configured) {
      return NextResponse.json(
        { error: 'Cloudflare R2 is not configured in environment variables' },
        { status: 400 }
      );
    }

    const {
      fileName,
      folder = 'products',
      sku,
      contentType = 'image/webp',
    } = await request.json();

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    const result = await getR2PresignedUploadUrl(
      fileName,
      folder,
      sku,
      contentType
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Presigned URL error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate presigned URL' },
      { status: 500 }
    );
  }
}
