import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, bucketName, isR2Configured } from '@/lib/r2';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabaseAdmin';
import { AdCampaign } from '@/types';

const CAMPAIGNS_KEY = 'config/campaigns.json';

export interface CampaignStoreData {
  campaigns: AdCampaign[];
  assignments: Record<string, string>; // product_id -> campaign_id
  updatedAt: string;
}

let cachedStore: CampaignStoreData | null = null;

async function buildInitialCampaignStore(): Promise<CampaignStoreData> {
  const now = new Date().toISOString();
  const initialCampaign: AdCampaign = {
    id: 'ADS-01',
    name: 'ชุดที่ 1 (ตั้งราคาแล้ว)',
    color: 'purple',
    ads_budget: 1000,
    target_ads_pct: 20,
    packaging_cost_per_item: 25,
    notes: 'ชุดแรกที่เลือกและตั้งราคาขายไว้แล้ว (ระบบจัดกลุ่มให้อัตโนมัติ)',
    created_at: now,
  };

  const assignments: Record<string, string> = {};

  if (isSupabaseAdminConfigured && supabaseAdmin) {
    try {
      const { data: pricedProducts } = await supabaseAdmin
        .from('products')
        .select('id, sku, selling_price')
        .gt('selling_price', 0);

      for (const p of pricedProducts || []) {
        const sku = String(p.sku || '');
        if (!sku.startsWith('PKG-') && !sku.startsWith('GIFT-')) {
          assignments[p.id] = 'ADS-01';
        }
      }
    } catch (err) {
      console.warn('Failed to query initial priced products for ADS-01:', err);
    }
  }

  return {
    campaigns: [initialCampaign],
    assignments,
    updatedAt: now,
  };
}

export async function loadCampaignStore(): Promise<CampaignStoreData> {
  if (cachedStore) {
    return cachedStore;
  }

  if (isR2Configured && r2Client) {
    try {
      const cmd = new GetObjectCommand({
        Bucket: bucketName,
        Key: CAMPAIGNS_KEY,
      });
      const res = await r2Client.send(cmd);
      const bodyStr = await res.Body?.transformToString();
      if (bodyStr) {
        const parsed = JSON.parse(bodyStr);
        cachedStore = {
          campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
          assignments:
            parsed.assignments && typeof parsed.assignments === 'object'
              ? parsed.assignments
              : {},
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
        return cachedStore;
      }
    } catch (err: any) {
      if (err?.name !== 'NoSuchKey' && err?.$metadata?.httpStatusCode !== 404) {
        console.warn('Failed to load campaigns from R2:', err?.message);
      }
    }
  }

  // First-time initialization: seed ADS-01 with all priced stones
  const initial = await buildInitialCampaignStore();
  await saveCampaignStore(initial);
  return initial;
}

export async function saveCampaignStore(store: CampaignStoreData): Promise<CampaignStoreData> {
  const nextStore: CampaignStoreData = {
    campaigns: store.campaigns,
    assignments: store.assignments,
    updatedAt: new Date().toISOString(),
  };

  cachedStore = nextStore;

  if (isR2Configured && r2Client) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: CAMPAIGNS_KEY,
        Body: JSON.stringify(nextStore, null, 2),
        ContentType: 'application/json',
      })
    );
  }

  return nextStore;
}

export async function setProductCampaignAssignment(
  productIds: string[],
  campaignId: string | null
): Promise<CampaignStoreData> {
  const store = await loadCampaignStore();
  const nextAssignments = { ...store.assignments };

  for (const pid of productIds) {
    if (!pid) continue;
    if (campaignId) {
      nextAssignments[pid] = campaignId;
    } else {
      delete nextAssignments[pid];
    }
  }

  return saveCampaignStore({
    ...store,
    assignments: nextAssignments,
  });
}
