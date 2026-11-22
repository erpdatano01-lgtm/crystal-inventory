'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AdCampaign,
  CAMPAIGN_COLORS_CONFIG,
  CampaignColor,
  Product,
  STATUS_CONFIG,
} from '@/types';
import {
  Megaphone,
  Plus,
  Tag,
  Sparkles,
  Check,
  X,
  Search,
  Trash2,
  Receipt,
  Calculator,
  Package,
  TrendingUp,
  ArrowRight,
  Layers,
} from 'lucide-react';

function calcSuggestedPrice(
  costPrice: number,
  packagingCost: number,
  adsPct: number,
  profitPct: number
): number {
  const denom = 1 - (adsPct + profitPct) / 100;
  if (denom <= 0.1) {
    return Math.ceil(((costPrice + packagingCost) * 2.5) / 10) * 10;
  }
  const raw = (costPrice + packagingCost) / denom;
  return Math.ceil(raw / 10) * 10;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [targetProfitPct, setTargetProfitPct] = useState<number>(30);

  // Inline budget/settings edit state for active campaign
  const [budgetInput, setBudgetInput] = useState<string>('1000');
  const [adsPctInput, setAdsPctInput] = useState<string>('20');
  const [packCostInput, setPackCostInput] = useState<string>('25');
  const [savingCampaign, setSavingCampaign] = useState(false);

  // Create new campaign modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<CampaignColor>('pink');
  const [newBudget, setNewBudget] = useState('1000');
  const [newAdsPct, setNewAdsPct] = useState('20');
  const [newPackCost, setNewPackCost] = useState('25');
  const [creating, setCreating] = useState(false);

  // Add stones modal
  const [showAddStonesModal, setShowAddStonesModal] = useState(false);
  const [stoneSearch, setStoneSearch] = useState('');
  const [costTierFilter, setCostTierFilter] = useState<'ALL' | 'HERO' | 'CORE' | 'ADDON'>('ALL');
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  // Inline selling price edits
  const [editingPriceMap, setEditingPriceMap] = useState<Record<string, string>>({});
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);
  const [recordingExpense, setRecordingExpense] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [campRes, prodRes] = await Promise.all([
        fetch('/api/campaigns'),
        fetch('/api/products'),
      ]);
      const campData = await campRes.json();
      const prodData = await prodRes.json();

      const loadedCampaigns: AdCampaign[] = Array.isArray(campData.campaigns)
        ? campData.campaigns
        : [];
      setCampaigns(loadedCampaigns);
      setAssignments(campData.assignments || {});
      setProducts(Array.isArray(prodData) ? prodData : []);

      if (loadedCampaigns.length > 0) {
        setSelectedCampaignId((prev) =>
          loadedCampaigns.some((c) => c.id === prev) ? prev : loadedCampaigns[0].id
        );
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const activeCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  );

  useEffect(() => {
    if (activeCampaign) {
      setBudgetInput(String(activeCampaign.ads_budget ?? 0));
      setAdsPctInput(String(activeCampaign.target_ads_pct ?? 20));
      setPackCostInput(String(activeCampaign.packaging_cost_per_item ?? 25));
    }
  }, [activeCampaign]);

  // Sellable stones (exclude PKG- and GIFT-)
  const sellableStones = useMemo(
    () =>
      products.filter(
        (p) => !p.sku?.startsWith('PKG-') && !p.sku?.startsWith('GIFT-') && !p.is_freebie
      ),
    [products]
  );

  // Products in active campaign
  const activeStones = useMemo(() => {
    if (!activeCampaign) return [];
    return sellableStones.filter(
      (p) => (assignments[p.id] || p.campaign_tag) === activeCampaign.id
    );
  }, [sellableStones, assignments, activeCampaign]);

  // Unassigned available stones for adding into a campaign
  const unassignedAvailableStones = useMemo(() => {
    return sellableStones.filter((p) => {
      const tag = assignments[p.id] || p.campaign_tag;
      if (tag) return false;
      if (p.status === 'SOLD') return false;
      if (stoneSearch.trim()) {
        const q = stoneSearch.toLowerCase();
        const match =
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.stone_type.toLowerCase().includes(q);
        if (!match) return false;
      }
      const cost = Number(p.cost_price) || 0;
      if (costTierFilter === 'HERO' && cost < 400) return false;
      if (costTierFilter === 'CORE' && (cost < 100 || cost >= 400)) return false;
      if (costTierFilter === 'ADDON' && cost >= 100) return false;
      return true;
    });
  }, [sellableStones, assignments, stoneSearch, costTierFilter]);

  // Campaign Metrics
  const metrics = useMemo(() => {
    const budget = Number(budgetInput) || 0;
    const adsPct = Number(adsPctInput) || 0;
    const packCost = Number(packCostInput) || 0;

    const totalCost = activeStones.reduce((s, p) => s + (Number(p.cost_price) || 0), 0);
    const totalSelling = activeStones.reduce((s, p) => s + (Number(p.selling_price) || 0), 0);
    const totalPack = activeStones.length * packCost;
    const soldCount = activeStones.filter((p) => p.status === 'SOLD').length;
    const soldRevenue = activeStones
      .filter((p) => p.status === 'SOLD')
      .reduce((s, p) => s + (Number(p.selling_price) || 0), 0);
    const avgAdsPerItem = activeStones.length > 0 ? budget / activeStones.length : 0;
    const projectedNetProfit = totalSelling - totalCost - totalPack - budget;
    const actualAdsPctOfTotal = totalSelling > 0 ? (budget / totalSelling) * 100 : 0;

    return {
      budget,
      adsPct,
      packCost,
      totalCost,
      totalSelling,
      totalPack,
      soldCount,
      soldRevenue,
      avgAdsPerItem,
      projectedNetProfit,
      actualAdsPctOfTotal,
    };
  }, [activeStones, budgetInput, adsPctInput, packCostInput]);

  // Save campaign settings
  const handleSaveCampaignSettings = async () => {
    if (!activeCampaign) return;
    setSavingCampaign(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeCampaign.id,
          ads_budget: Number(budgetInput) || 0,
          target_ads_pct: Number(adsPctInput) || 0,
          packaging_cost_per_item: Number(packCostInput) || 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns);
      }
    } catch (err) {
      console.error(err);
      alert('บันทึกการตั้งค่าชุดไม่สำเร็จ');
    } finally {
      setSavingCampaign(false);
    }
  };

  // Create new campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert('กรุณากรอกชื่อชุดขาย / แคมเปญ');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          color: newColor,
          ads_budget: Number(newBudget) || 0,
          target_ads_pct: Number(newAdsPct) || 20,
          packaging_cost_per_item: Number(newPackCost) || 25,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'สร้างชุดไม่สำเร็จ');
        return;
      }
      setCampaigns(data.campaigns);
      setAssignments(data.assignments);
      setSelectedCampaignId(data.campaign.id);
      setShowCreateModal(false);
      setNewName('');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการสร้างชุดขาย');
    } finally {
      setCreating(false);
    }
  };

  // Delete campaign (does not delete products)
  const handleDeleteCampaign = async (camp: AdCampaign) => {
    if (
      !confirm(
        `ลบกลุ่ม "${camp.id}: ${camp.name}"?\n(ตัวหินในสต็อกจะไม่ถูกลบ แค่เอาป้ายกลุ่มนี้ออกเท่านั้น)`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/campaigns?id=${encodeURIComponent(camp.id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns);
        setAssignments(data.assignments);
        if (data.campaigns.length > 0) {
          setSelectedCampaignId(data.campaigns[0].id);
        } else {
          setSelectedCampaignId('');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Assign picked stones to active campaign
  const handleConfirmAddStones = async () => {
    if (!activeCampaign || pickedIds.size === 0) return;
    setAssigning(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignProductIds: Array.from(pickedIds),
          campaignId: activeCampaign.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments);
        setPickedIds(new Set());
        setShowAddStonesModal(false);
      }
    } catch (err) {
      console.error(err);
      alert('เพิ่มหินเข้าชุดไม่สำเร็จ');
    } finally {
      setAssigning(false);
    }
  };

  // Remove stone from campaign
  const handleRemoveStone = async (productId: string) => {
    try {
      const res = await fetch('/api/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignProductIds: [productId],
          campaignId: null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save individual stone selling_price
  const handleSaveStonePrice = async (product: Product, newPriceNum: number) => {
    if (Number.isNaN(newPriceNum) || newPriceNum < 0) return;
    setSavingPriceId(product.id);
    try {
      const res = await fetch(`/api/products?id=${encodeURIComponent(product.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selling_price: newPriceNum }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, selling_price: newPriceNum } : p))
        );
        setEditingPriceMap((prev) => {
          const copy = { ...prev };
          delete copy[product.id];
          return copy;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPriceId(null);
    }
  };

  // Record Ads budget into /expenses
  const handleRecordAdsExpense = async () => {
    if (!activeCampaign) return;
    const amount = Number(budgetInput) || 0;
    if (amount <= 0) {
      alert('กรุณากรอกงบ Ads มากกว่า 0 บาทก่อนบันทึก');
      return;
    }
    if (
      !confirm(
        `บันทึกรายจ่ายค่าโฆษณา ฿${amount.toLocaleString()} สำหรับ "${activeCampaign.id}: ${activeCampaign.name}" ลงในหน้า /expenses?`
      )
    ) {
      return;
    }
    setRecordingExpense(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expense_date: new Date().toISOString().slice(0, 10),
          category: 'BOOTH_MARKETING',
          title: `[${activeCampaign.id}] ค่าโฆษณา (Ads) - ${activeCampaign.name}`,
          total_amount: amount,
          payment_method: 'โอนเงิน / บัตรเครดิต',
          notes: `งบ Ads สำหรับชุด ${activeCampaign.id} (${activeStones.length} ชิ้น)`,
        }),
      });
      if (res.ok) {
        alert('บันทึกค่าโฆษณาลงหน้า /expenses เรียบร้อยแล้ว!');
      } else {
        alert('ไม่สามารถบันทึกค่าใช้จ่ายได้');
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกค่าใช้จ่าย');
    } finally {
      setRecordingExpense(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-pink-600 uppercase tracking-wider mb-1">
              <Megaphone className="w-4 h-4" />
              <span>Ad Batches & Blended Pricing</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              จัดชุดถ่ายขาย & คละค่า Ads
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              ติดป้ายแยกชุดหินที่คัดไปถ่ายลงขาย ไม่ให้ปนกับชุดอื่น พร้อมคำนวณราคาขายเผื่อค่าโฆษณาและค่าแพ็กอัตโนมัติ
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/products"
              className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition"
            >
              ดูคลังหินทั้งหมด
            </Link>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-500/20 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างชุดขายใหม่</span>
            </button>
          </div>
        </div>

        {/* Campaign Tabs */}
        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 text-slate-400 text-sm">
            กำลังโหลดข้อมูลชุดขาย...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 space-y-3">
            <Tag className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">ยังไม่มีชุดขาย / แคมเปญ</p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold"
            >
              + สร้างชุดแรก
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {campaigns.map((camp) => {
                const count = sellableStones.filter(
                  (p) => (assignments[p.id] || p.campaign_tag) === camp.id
                ).length;
                const colorCfg =
                  CAMPAIGN_COLORS_CONFIG[camp.color] || CAMPAIGN_COLORS_CONFIG.purple;
                const isActive = camp.id === activeCampaign?.id;

                return (
                  <button
                    key={camp.id}
                    type="button"
                    onClick={() => setSelectedCampaignId(camp.id)}
                    className={`shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-left transition ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${colorCfg.dotClass}`} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs">{camp.id}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                            isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {count} ชิ้น
                        </span>
                      </div>
                      <p
                        className={`text-xs truncate max-w-[160px] ${
                          isActive ? 'text-slate-200' : 'text-slate-500'
                        }`}
                      >
                        {camp.name}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {activeCampaign && (
              <div className="space-y-6">
                {/* Summary KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                      <span>ทุนหินรวมในชุดนี้</span>
                      <Layers className="w-4 h-4 text-purple-600" />
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-slate-900">
                      ฿{metrics.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      ทั้งหมด {activeStones.length} ชิ้น (ขายแล้ว {metrics.soldCount} ชิ้น)
                    </p>
                  </div>

                  <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                      <span>งบ Ads + ค่าแพ็กรวม</span>
                      <Megaphone className="w-4 h-4 text-pink-600" />
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-pink-600">
                      ฿{(metrics.budget + metrics.totalPack).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      เฉลี่ย Ads ฿{metrics.avgAdsPerItem.toFixed(0)}/ชิ้น (
                      {metrics.actualAdsPctOfTotal.toFixed(1)}% ของยอดขาย)
                    </p>
                  </div>

                  <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                      <span>มูลค่าตั้งขายรวม</span>
                      <Package className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-blue-900">
                      ฿{metrics.totalSelling.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      ขายได้จริงแล้ว ฿{metrics.soldRevenue.toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-slate-900 to-purple-950 text-white p-4 sm:p-5 rounded-3xl shadow-md">
                    <div className="flex items-center justify-between text-xs font-bold text-purple-200 mb-2">
                      <span>คาดการณ์กำไรสุทธิทั้งชุด</span>
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p
                      className={`text-xl sm:text-2xl font-black ${
                        metrics.projectedNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {metrics.projectedNetProfit >= 0 ? '+' : ''}฿
                      {metrics.projectedNetProfit.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </p>
                    <p className="text-[11px] text-purple-200/80 mt-1">
                      หักทุนหิน + ค่าแพ็ก + งบ Ads แล้ว
                    </p>
                  </div>
                </div>

                {/* Ads & Pricing Parameters Card */}
                <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-purple-600" />
                      <div>
                        <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                          ตั้งค่าคละค่า Ads & คำนวณราคาขาย ({activeCampaign.id}:{' '}
                          {activeCampaign.name})
                        </h2>
                        <p className="text-xs text-slate-500">
                          ปรับตัวเลขด้านล่างเพื่อดูราคาแนะนำรายชิ้นและจุดคุ้มทุนของทั้งชุด
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleRecordAdsExpense}
                        disabled={recordingExpense}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 text-xs font-bold transition"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>
                          {recordingExpense ? 'กำลังบันทึก...' : 'ลงบิลค่า Ads ใน /expenses'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPickedIds(new Set());
                          setShowAddStonesModal(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>เพิ่มหินเข้าชุดนี้</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCampaign(activeCampaign)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="ลบกลุ่มนี้ (ไม่ลบตัวหิน)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100 items-end">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        งบ Ads ทั้งชุด (฿)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        เผื่อค่า Ads (% ราคาขาย)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={70}
                        value={adsPctInput}
                        onChange={(e) => setAdsPctInput(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        ค่าแพ็ก+ของแถม/ชิ้น (฿)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={packCostInput}
                        onChange={(e) => setPackCostInput(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        เป้ากำไรสุทธิ (% แนะนำ)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={70}
                        value={targetProfitPct}
                        onChange={(e) => setTargetProfitPct(Number(e.target.value) || 30)}
                        className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={handleSaveCampaignSettings}
                        disabled={savingCampaign}
                        className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition disabled:opacity-50"
                      >
                        {savingCampaign ? 'กำลังบันทึก...' : 'บันทึกค่าตั้งต้นชุด'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stones Table in Campaign */}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-purple-600" />
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                        รายการหินในชุด {activeCampaign.id} ({activeStones.length} ชิ้น)
                      </h3>
                    </div>
                    <span className="text-xs text-slate-400">
                      แก้ราคาขายในตารางได้ทันที
                    </span>
                  </div>

                  {activeStones.length === 0 ? (
                    <div className="p-12 text-center space-y-3 text-slate-400">
                      <Sparkles className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-sm font-semibold text-slate-600">
                        ยังไม่มีหินในชุด {activeCampaign.id}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setPickedIds(new Set());
                          setShowAddStonesModal(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold"
                      >
                        + เลือกหินที่ยังไม่เข้าชุดไหนเข้ามา
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">สินค้า</th>
                            <th className="py-3 px-3 text-center">สถานะ</th>
                            <th className="py-3 px-3 text-right">ทุนหินจริง</th>
                            <th className="py-3 px-3 text-right">ราคาแนะนำ (เผื่อ Ads)</th>
                            <th className="py-3 px-3 text-right">ราคาขายจริง</th>
                            <th className="py-3 px-3 text-right">กำไรสุทธิ/ชิ้น</th>
                            <th className="py-3 px-4 text-right">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeStones.map((p) => {
                            const cost = Number(p.cost_price) || 0;
                            const sell = Number(p.selling_price) || 0;
                            const suggested = calcSuggestedPrice(
                              cost,
                              metrics.packCost,
                              metrics.adsPct,
                              targetProfitPct
                            );
                            const adsAllowance = sell * (metrics.adsPct / 100);
                            const netPerItem = sell - cost - metrics.packCost - adsAllowance;
                            const statusCfg =
                              STATUS_CONFIG[p.status] || STATUS_CONFIG.AVAILABLE;

                            const draftPrice =
                              editingPriceMap[p.id] !== undefined
                                ? editingPriceMap[p.id]
                                : String(sell);

                            return (
                              <tr key={p.id} className="hover:bg-slate-50/70 transition">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    {p.r2_thumbnail_url ? (
                                      <img
                                        src={p.r2_thumbnail_url}
                                        alt={p.name}
                                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                        <Package className="w-4 h-4" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="font-mono text-xs font-bold text-purple-700">
                                        {p.sku}
                                      </p>
                                      <p className="font-semibold text-slate-900 truncate max-w-[180px]">
                                        {p.name}
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3 px-3 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] border ${statusCfg.badgeClass}`}
                                  >
                                    {statusCfg.label.split(' ')[0]}
                                  </span>
                                </td>

                                <td className="py-3 px-3 text-right font-semibold text-slate-700">
                                  ฿{cost.toLocaleString()}
                                </td>

                                <td className="py-3 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveStonePrice(p, suggested)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition"
                                    title="คลิกเพื่อใช้ราคาแนะนำนี้ทันที"
                                  >
                                    <span>฿{suggested.toLocaleString()}</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                </td>

                                <td className="py-3 px-3 text-right">
                                  <div className="inline-flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      value={draftPrice}
                                      onChange={(e) =>
                                        setEditingPriceMap((prev) => ({
                                          ...prev,
                                          [p.id]: e.target.value,
                                        }))
                                      }
                                      className="w-24 px-2.5 py-1.5 text-right font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                    {editingPriceMap[p.id] !== undefined &&
                                      Number(editingPriceMap[p.id]) !== sell && (
                                        <button
                                          type="button"
                                          disabled={savingPriceId === p.id}
                                          onClick={() =>
                                            handleSaveStonePrice(p, Number(editingPriceMap[p.id]))
                                          }
                                          className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                                          title="บันทึกราคา"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                  </div>
                                </td>

                                <td className="py-3 px-3 text-right">
                                  {sell > 0 ? (
                                    <div>
                                      <span
                                        className={`font-black ${
                                          netPerItem >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                        }`}
                                      >
                                        {netPerItem >= 0 ? '+' : ''}฿
                                        {netPerItem.toLocaleString(undefined, {
                                          maximumFractionDigits: 0,
                                        })}
                                      </span>
                                      <p className="text-[10px] text-slate-400">
                                        หัก Ads {metrics.adsPct}% (฿{adsAllowance.toFixed(0)})
                                      </p>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400">ยังไม่ตั้งราคา</span>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStone(p.id)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                                  >
                                    นำออกจากชุด
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal: Create New Campaign */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">สร้างชุดขาย / แคมเปญยิง Ads ใหม่</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCampaign} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ชื่อชุดขาย / แคมเปญ *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ชุดที่ 2 - คริสตัลสีพาสเทล"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  สีป้าย Tag ประจำชุด
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {(Object.keys(CAMPAIGN_COLORS_CONFIG) as CampaignColor[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        newColor === c
                          ? 'ring-2 ring-slate-900 ' + CAMPAIGN_COLORS_CONFIG[c].badgeClass
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${CAMPAIGN_COLORS_CONFIG[c].dotClass}`}
                      />
                      <span>{CAMPAIGN_COLORS_CONFIG[c].label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    งบ Ads (฿)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newBudget}
                    onChange={(e) => setNewBudget(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    เผื่อ Ads (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={70}
                    value={newAdsPct}
                    onChange={(e) => setNewAdsPct(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    ค่าแพ็ก/ชิ้น (฿)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newPackCost}
                    onChange={(e) => setNewPackCost(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {creating ? 'กำลังสร้าง...' : 'สร้างชุดขาย'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Pick Unassigned Stones to Add */}
      {showAddStonesModal && activeCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base">
                  เลือกหินเข้าชุด {activeCampaign.id}: {activeCampaign.name}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  แสดงเฉพาะหินที่ยังไม่ได้จัดเข้าชุดอื่น (ป้องกันการหยิบซ้ำข้ามชุด)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStonesModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-2.5 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหา SKU, ชื่อหิน..."
                  value={stoneSearch}
                  onChange={(e) => setStoneSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {[
                  { id: 'ALL', label: 'ทั้งหมด' },
                  { id: 'HERO', label: 'ตัวดึงดูด (฿400+)' },
                  { id: 'CORE', label: 'ตัวทำยอด (฿100-399)' },
                  { id: 'ADDON', label: 'ตัวพ่วง (<฿100)' },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setCostTierFilter(tier.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                      costTierFilter === tier.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {unassignedAvailableStones.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-10">
                  ไม่พบหินที่ว่างตามเงื่อนไขที่เลือก
                </p>
              ) : (
                unassignedAvailableStones.map((p) => {
                  const checked = pickedIds.has(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition ${
                        checked
                          ? 'bg-purple-50 border-purple-400'
                          : 'bg-white border-slate-200 hover:border-purple-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setPickedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              return next;
                            });
                          }}
                          className="w-4 h-4 accent-purple-600 rounded"
                        />
                        {p.r2_thumbnail_url ? (
                          <img
                            src={p.r2_thumbnail_url}
                            alt={p.name}
                            className="w-10 h-10 rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-bold text-purple-700">{p.sku}</p>
                          <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-xs font-bold text-slate-700">
                          ทุน ฿{Number(p.cost_price).toLocaleString()}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          แนะนำ ~฿
                          {calcSuggestedPrice(
                            Number(p.cost_price) || 0,
                            metrics.packCost,
                            metrics.adsPct,
                            targetProfitPct
                          ).toLocaleString()}
                        </p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-600">
                เลือกแล้ว {pickedIds.size} ชิ้น
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddStonesModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={pickedIds.size === 0 || assigning}
                  onClick={handleConfirmAddStones}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {assigning ? 'กำลังเพิ่ม...' : `เพิ่มเข้าชุด ${activeCampaign.id}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
