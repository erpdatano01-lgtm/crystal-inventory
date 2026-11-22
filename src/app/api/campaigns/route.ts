import { NextRequest, NextResponse } from 'next/server';
import {
  loadCampaignStore,
  saveCampaignStore,
  setProductCampaignAssignment,
} from '@/lib/campaignStore';
import { AdCampaign, CampaignColor } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_COLORS: CampaignColor[] = ['purple', 'pink', 'blue', 'emerald', 'amber', 'rose'];

function generateNextCampaignId(existing: AdCampaign[]): string {
  let maxNum = 0;
  for (const c of existing) {
    const match = c.id.match(/^ADS-(\d+)$/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  const nextNum = String(maxNum + 1).padStart(2, '0');
  return `ADS-${nextNum}`;
}

export async function GET() {
  try {
    const store = await loadCampaignStore();
    return NextResponse.json({
      campaigns: store.campaigns,
      assignments: store.assignments,
      updatedAt: store.updatedAt,
    });
  } catch (err: any) {
    console.error('GET /api/campaigns error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to load campaigns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const store = await loadCampaignStore();

    const newId = body.id?.trim() || generateNextCampaignId(store.campaigns);
    if (store.campaigns.some((c) => c.id === newId)) {
      return NextResponse.json({ error: `รหัสชุด "${newId}" มีอยู่แล้ว` }, { status: 400 });
    }

    const colorIdx = store.campaigns.length % VALID_COLORS.length;
    const color: CampaignColor = VALID_COLORS.includes(body.color)
      ? body.color
      : VALID_COLORS[colorIdx];

    const newCampaign: AdCampaign = {
      id: newId,
      name: String(body.name || `ชุดที่ ${store.campaigns.length + 1}`).trim(),
      color,
      ads_budget: Number(body.ads_budget) || 0,
      target_ads_pct: Number(body.target_ads_pct) || 20,
      packaging_cost_per_item: Number(body.packaging_cost_per_item) || 25,
      notes: body.notes ? String(body.notes) : '',
      created_at: new Date().toISOString(),
    };

    const nextAssignments = { ...store.assignments };
    if (Array.isArray(body.productIds)) {
      for (const pid of body.productIds) {
        if (pid) nextAssignments[pid] = newId;
      }
    }

    const saved = await saveCampaignStore({
      ...store,
      campaigns: [...store.campaigns, newCampaign],
      assignments: nextAssignments,
    });

    return NextResponse.json({
      success: true,
      campaign: newCampaign,
      campaigns: saved.campaigns,
      assignments: saved.assignments,
    });
  } catch (err: any) {
    console.error('POST /api/campaigns error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to create campaign' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Case 1: Assign or unassign products to a campaign
    if (Array.isArray(body.assignProductIds)) {
      const targetCampaignId: string | null = body.campaignId || null;
      const saved = await setProductCampaignAssignment(body.assignProductIds, targetCampaignId);
      return NextResponse.json({
        success: true,
        campaigns: saved.campaigns,
        assignments: saved.assignments,
      });
    }

    // Case 2: Update campaign metadata
    const id = body.id;
    if (!id) {
      return NextResponse.json({ error: 'Missing campaign id' }, { status: 400 });
    }

    const store = await loadCampaignStore();
    const idx = store.campaigns.findIndex((c) => c.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const existing = store.campaigns[idx];
    const updated: AdCampaign = {
      ...existing,
      name: body.name !== undefined ? String(body.name).trim() : existing.name,
      color: VALID_COLORS.includes(body.color) ? body.color : existing.color,
      ads_budget: body.ads_budget !== undefined ? Number(body.ads_budget) || 0 : existing.ads_budget,
      target_ads_pct:
        body.target_ads_pct !== undefined
          ? Math.max(0, Math.min(80, Number(body.target_ads_pct) || 0))
          : existing.target_ads_pct,
      packaging_cost_per_item:
        body.packaging_cost_per_item !== undefined
          ? Math.max(0, Number(body.packaging_cost_per_item) || 0)
          : existing.packaging_cost_per_item,
      notes: body.notes !== undefined ? String(body.notes) : existing.notes,
    };

    const nextCampaigns = [...store.campaigns];
    nextCampaigns[idx] = updated;

    const saved = await saveCampaignStore({
      ...store,
      campaigns: nextCampaigns,
    });

    return NextResponse.json({
      success: true,
      campaign: updated,
      campaigns: saved.campaigns,
      assignments: saved.assignments,
    });
  } catch (err: any) {
    console.error('PATCH /api/campaigns error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to update campaign' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing campaign id' }, { status: 400 });
    }

    const store = await loadCampaignStore();
    const nextCampaigns = store.campaigns.filter((c) => c.id !== id);
    const nextAssignments: Record<string, string> = {};
    for (const [pid, cid] of Object.entries(store.assignments)) {
      if (cid !== id) {
        nextAssignments[pid] = cid;
      }
    }

    const saved = await saveCampaignStore({
      ...store,
      campaigns: nextCampaigns,
      assignments: nextAssignments,
    });

    return NextResponse.json({
      success: true,
      campaigns: saved.campaigns,
      assignments: saved.assignments,
    });
  } catch (err: any) {
    console.error('DELETE /api/campaigns error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to delete campaign' }, { status: 500 });
  }
}
