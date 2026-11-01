import { NextRequest, NextResponse } from 'next/server';
import { uploadToR2, isR2Configured } from '@/lib/r2';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as 'receipts' | 'products') || 'products';
    const sku = (formData.get('sku') as string) || undefined;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name || `img_${Date.now()}.webp`;
    const contentType = file.type || 'image/webp';

    // If R2 is not configured, fall back to Data URL for instant local demo mode
    if (!isR2Configured) {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      const dataUrl = `data:${contentType};base64,${base64}`;

      return NextResponse.json({
        url: dataUrl,
        fileName,
        storage: 'local_demo',
        message: 'R2 not configured. Local data URL preview used.',
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const publicUrl = await uploadToR2(buffer, fileName, folder, sku, contentType);

    return NextResponse.json({
      url: publicUrl,
      fileName,
      storage: 'cloudflare_r2',
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}
