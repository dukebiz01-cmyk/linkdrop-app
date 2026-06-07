import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Link2, MapPin, Store } from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { haversineKm, formatDistanceKm } from "@/lib/geo";
import { Toaster } from "@/components/ui/sonner";
import { StoreProfileCard, type AllianceActiveCoupon } from "@/components/partner/StoreProfileCard";

// 공유용 매장 명함 뷰 — 공개 라우트(로그인 게이트 없음). 공유 링크가 바로 열려야 한다.
// slug 우선 조회, 없으면 uuid 면 id 로 fallback (현재 모든 partner.slug 가 null).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AlliancePartner = {
  id: string;
  display_name: string;
  business_type: string | null;
  businessTypeLabel: string | null;
  partner_kind: string | null;
  address: string | null;
  contact_phone: string | null;
  verification_status: string | null;
};

type ConnState = { status: string; iAmRequester: boolean } | null;

type AllianceLoaderData = {
  partner: AlliancePartner | null;
  activeCoupons: AllianceActiveCoupon[];
  viewerPartnerId: string | null; // 보는 사람이 소유한 partner (사업자일 때)
  isOwnerOfThis: boolean; // 내 명함을 보는 중
  sameIndustry: boolean; // 동종(같은 business_type)
  connection: ConnState; // 나-상대 연결 상태
  isAuthedBusiness: boolean; // 사업자로 로그인됨
  // 내 매장 ↔ 보는 매장 직선거리 표시 문구. 좌표 없거나 비로그인/비사업자면 null.
  distanceText: string | null;
};

type ConnRow = {
  requester_partner_id: string;
  target_partner_id: string;
  status: string;
};

export const Route = createFileRoute("/alliance/$slug")({
  head: () => ({ meta: [{ title: "매장 명함 — LinkDrop" }] }),
  loader: async ({ params }): Promise<AllianceLoaderData> => {
    const empty: AllianceLoaderData = {
      partner: null,
      activeCoupons: [],
      viewerPartnerId: null,
      isOwnerOfThis: false,
      sameIndustry: false,
      connection: null,
      isAuthedBusiness: false,
      distanceText: null,
    };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const key = params.slug;
    const sel =
      "id, display_name, business_type, partner_kind, address, contact_phone, lat, lng, verification_status, slug";

    // slug 우선 → 없으면 uuid 면 id 로.
    let { data: partner } = await supabase
      .from("partners")
      .select(sel)
      .eq("slug", key)
      .maybeSingle();
    if (!partner && UUID_RE.test(key)) {
      ({ data: partner } = await supabase.from("partners").select(sel).eq("id", key).maybeSingle());
    }
    if (!partner) return empty;
    const viewed = partner as {
      id: string;
      display_name: string;
      business_type: string | null;
      partner_kind: string | null;
      address: string | null;
      contact_phone: string | null;
      lat: number | null;
      lng: number | null;
      verification_status: string | null;
    };

    // 보는 사람 — 세션 + 소유 partner(거리 계산용 좌표 포함).
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id ?? null;
    let viewerPartnerId: string | null = null;
    let viewerBusinessType: string | null = null;
    let viewerLat: number | null = null;
    let viewerLng: number | null = null;
    if (uid) {
      const { data: vp } = await supabase
        .from("partners")
        .select("id, business_type, lat, lng")
        .eq("owner_user_id", uid)
        .maybeSingle();
      viewerPartnerId = vp?.id ?? null;
      viewerBusinessType = (vp?.business_type as string | null) ?? null;
      viewerLat = (vp?.lat as number | null) ?? null;
      viewerLng = (vp?.lng as number | null) ?? null;
    }

    const [{ data: couponsRaw }, { data: majors }, connRes] = await Promise.all([
      supabase.rpc("get_active_store_coupons", { p_partner_id: viewed.id }),
      supabase.from("business_categories").select("code, label").eq("depth", 1),
      viewerPartnerId
        ? supabase
            .from("maker_connections")
            .select("requester_partner_id, target_partner_id, status")
            .or(
              `requester_partner_id.eq.${viewerPartnerId},target_partner_id.eq.${viewerPartnerId}`,
            )
        : Promise.resolve({ data: [] as ConnRow[] }),
    ]);

    const majorMap = new Map(
      ((majors as { code: string; label: string }[] | null) ?? []).map((m) => [m.code, m.label]),
    );
    const businessTypeLabel = viewed.business_type
      ? (majorMap.get(viewed.business_type) ?? null)
      : null;

    const isOwnerOfThis = Boolean(viewerPartnerId) && viewerPartnerId === viewed.id;
    const sameIndustry =
      Boolean(viewerPartnerId) &&
      !isOwnerOfThis &&
      Boolean(viewerBusinessType) &&
      Boolean(viewed.business_type) &&
      viewerBusinessType === viewed.business_type;

    // 나-상대 pair 연결만 추림 (RLS party_select 로 내 행만 보임).
    const pair = ((connRes.data as ConnRow[] | null) ?? []).filter(
      (c) =>
        (c.requester_partner_id === viewed.id && c.target_partner_id === viewerPartnerId) ||
        (c.requester_partner_id === viewerPartnerId && c.target_partner_id === viewed.id),
    );
    let connection: ConnState = null;
    const accepted = pair.find((c) => c.status === "accepted");
    const pendingMine = pair.find(
      (c) => c.status === "pending" && c.requester_partner_id === viewerPartnerId,
    );
    const pendingTheirs = pair.find(
      (c) => c.status === "pending" && c.target_partner_id === viewerPartnerId,
    );
    if (accepted) connection = { status: "accepted", iAmRequester: false };
    else if (pendingMine) connection = { status: "pending", iAmRequester: true };
    else if (pendingTheirs) connection = { status: "pending", iAmRequester: false };
    else if (pair.length)
      connection = {
        status: pair[0].status,
        iAmRequester: pair[0].requester_partner_id === viewerPartnerId,
      };

    // 거리 — 내 매장 ↔ 보는 매장 직선거리. 좌표 하나라도 없거나 비사업자면 null(haversine 가드).
    const distKm = viewerPartnerId
      ? haversineKm(viewerLat, viewerLng, viewed.lat, viewed.lng)
      : null;
    const distLabel = formatDistanceKm(distKm);
    const distanceText = distLabel ? `내 매장에서 ${distLabel}` : null;

    return {
      partner: {
        id: viewed.id,
        display_name: viewed.display_name,
        business_type: viewed.business_type ?? null,
        businessTypeLabel,
        partner_kind: viewed.partner_kind ?? null,
        address: viewed.address ?? null,
        contact_phone: viewed.contact_phone ?? null,
        verification_status: viewed.verification_status ?? null,
      },
      activeCoupons: (couponsRaw as AllianceActiveCoupon[] | null) ?? [],
      viewerPartnerId,
      isOwnerOfThis,
      sameIndustry,
      connection,
      isAuthedBusiness: Boolean(viewerPartnerId),
      distanceText,
    };
  },
  component: AllianceView,
});

function DisabledFooter({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled
      className="flex min-h-[44px] w-full cursor-not-allowed items-center justify-center rounded-xl bg-[#F5F5F5] px-4 text-sm font-bold text-[#A3A3A3]"
    >
      {label}
    </button>
  );
}

function AllianceView() {
  const data = Route.useLoaderData();
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);

  const partner = data.partner;

  async function handleRequest() {
    if (!data.viewerPartnerId || !partner) return;
    setBusy(true);
    try {
      const { error } = await getSupabase().from("maker_connections").insert({
        requester_partner_id: data.viewerPartnerId,
        target_partner_id: partner.id,
        status: "pending",
      });
      if (error) {
        // UNIQUE(requester,target) 충돌 = 이미 요청함.
        if (error.code === "23505") {
          setRequested(true);
          toast.info("이미 제휴를 요청했어요.");
          return;
        }
        console.error("[alliance] request failed:", error);
        toast.error("요청에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setRequested(true);
      toast.success("제휴를 요청했어요.");
    } catch (err) {
      console.error("[alliance] request unexpected:", err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setBusy(false);
    }
  }

  if (!partner) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-6 tracking-ko">
        <div className="text-center">
          <Store className="mx-auto size-8 text-[#CBD5E1]" strokeWidth={2} />
          <p className="mt-3 text-sm font-medium text-[#64748B]">명함을 찾을 수 없어요.</p>
        </div>
        <Toaster richColors position="top-center" />
      </main>
    );
  }

  const tier: "biz" | "pb" = partner.verification_status === "approved" ? "biz" : "pb";

  function buildFooter() {
    if (!data.isAuthedBusiness) {
      return (
        <p className="text-center text-xs font-medium text-[#94A3B8]">
          사업자로 로그인하면 제휴를 요청할 수 있어요.
        </p>
      );
    }
    if (data.isOwnerOfThis) {
      return <p className="text-center text-xs font-medium text-[#94A3B8]">내 명함이에요.</p>;
    }
    if (data.sameIndustry) {
      return <DisabledFooter label="동종 업종은 제휴할 수 없어요" />;
    }
    const conn = data.connection;
    if (requested || (conn?.status === "pending" && conn.iAmRequester)) {
      return <DisabledFooter label="요청함" />;
    }
    if (conn?.status === "accepted") return <DisabledFooter label="제휴 중" />;
    if (conn?.status === "pending" && !conn.iAmRequester) {
      return <DisabledFooter label="요청 받음" />;
    }
    if (conn?.status === "rejected") return <DisabledFooter label="요청 거절됨" />;
    if (conn?.status === "blocked") return <DisabledFooter label="차단됨" />;

    return (
      <button
        type="button"
        onClick={handleRequest}
        disabled={busy}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-4 text-sm font-bold text-white hover:bg-[#171717] disabled:opacity-50"
      >
        <Link2 className="size-4" strokeWidth={2} />
        제휴 요청
      </button>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
      <header className="border-b border-[#F1F5F9] bg-white px-5 py-4">
        <h1 className="text-lg font-bold text-[#0F172A]">매장 명함</h1>
        <p className="mt-0.5 text-xs text-[#64748B]">LinkDrop 제휴 제안</p>
      </header>

      <div className="mx-auto max-w-md px-5 pt-4">
        <StoreProfileCard
          name={partner.display_name}
          tier={tier}
          businessTypeLabel={partner.businessTypeLabel}
          partnerKind={partner.partner_kind}
          address={partner.address}
          contactPhone={partner.contact_phone}
          activeCoupons={data.activeCoupons}
          footer={
            <div className="space-y-2">
              {/* 거리 — 내 매장 기준 직선거리(차로 표현 금지). 좌표/사업자 조건 충족 시만. */}
              {data.distanceText ? (
                <p className="flex items-center justify-center gap-1 text-xs font-medium text-[#94A3B8]">
                  <MapPin className="size-3.5" strokeWidth={2} />
                  {data.distanceText}
                </p>
              ) : null}
              {buildFooter()}
            </div>
          }
        />
      </div>

      <Toaster richColors position="top-center" />
    </main>
  );
}
