import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  BarChart3,
  Megaphone,
  Share2,
  Inbox,
  Unlink,
  Package,
  Store,
  Link2,
  Ticket,
  Copy,
  Pencil,
} from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { shareToKakao } from "@/lib/kakao";
import { Toaster } from "@/components/ui/sonner";
import { type AllianceActiveCoupon } from "@/components/partner/StoreProfileCard";
import { haversineKm, formatDistanceKm } from "@/lib/geo";

// 받은 제휴 요청 — maker_connections(target=내 partner, pending) + 요청자 partner 요약.
type IncomingRequest = {
  connectionId: string;
  name: string;
  industry: string | null; // 업종 한글 (없으면 미표시)
  address: string | null;
  distanceText: string | null; // 내 매장 기준 직선거리 (좌표 없으면 null)
};

// 내 동맹 — accepted 연결의 상대(ally) 요약. 탭 → /alliance/{slug ?? id}.
type Ally = {
  connectionId: string;
  partnerId: string;
  slug: string | null;
  name: string;
  industry: string | null; // 업종 한글 (없으면 미표시)
  address: string | null;
  distanceText: string | null; // 내 매장 기준 직선거리 (좌표 없으면 null)
};

type LoaderData = {
  ownerUserId: string | null;
  partnerId: string | null;
  partnerName: string | null;
  partnerSlug: string | null; // 명함 공유 URL (없으면 id fallback)
  // 매장 프로필 카드(명함) — 전부 기존 데이터/RPC 조합, DB 변경 없음.
  verificationStatus: string | null;
  businessTypeLabel: string | null; // 업종 한글 (business_categories depth=1 재사용)
  partnerKind: string | null; // 보조
  address: string | null;
  subscriberCount: number; // maker_follows active count
  activeCoupons: AllianceActiveCoupon[];
  // 예약관리 메뉴 배지 — 미확인(pending) 예약 개수.
  pendingReservationCount: number;
  // 받은 제휴 요청 (pending).
  incomingRequests: IncomingRequest[];
  // 내 동맹 (accepted).
  allies: Ally[];
};

export const Route = createFileRoute("/_partner/partner/")({
  head: () => ({ meta: [{ title: "매장 관리 — LinkDrop" }] }),
  loader: async (): Promise<LoaderData> => {
    const empty: LoaderData = {
      ownerUserId: null,
      partnerId: null,
      partnerName: null,
      partnerSlug: null,
      verificationStatus: null,
      businessTypeLabel: null,
      partnerKind: null,
      address: null,
      subscriberCount: 0,
      activeCoupons: [],
      pendingReservationCount: 0,
      incomingRequests: [],
      allies: [],
    };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const ownerUserId = sessionData.session?.user.id ?? null;
    if (!ownerUserId) return empty;

    // owner 의 partner (가드가 is_active_partner_owner 통과 보장하므로 행 존재).
    // 매장 프로필 카드용 컬럼 추가(business_type/partner_kind/address/verification_status).
    const { data: partner } = await supabase
      .from("partners")
      .select(
        "id, display_name, slug, business_type, partner_kind, address, lat, lng, verification_status",
      )
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();

    if (!partner?.id) {
      return { ...empty, ownerUserId };
    }

    // 5개 병렬: 구독수(maker_follows active count, partner_owner SELECT RLS) /
    //   활성 쿠폰(get_active_store_coupons) / 업종 한글(business_categories depth=1, 등록화면 재사용) /
    //   받은 제휴 요청(maker_connections target=내 partner, pending + 요청자 partner 임베드) /
    //   내 동맹(maker_connections accepted, 나=requester|target, 양쪽 FK 임베드).
    //   예약 inbox 는 /partner/reservations 로 분리(Phase 1).
    const allyFields = "id, display_name, slug, business_type, partner_kind, address, lat, lng";
    const [
      { count: subscriberCount },
      { data: activeCouponsRaw },
      { data: majors },
      { data: incomingRaw },
      { data: acceptedRaw },
      { data: reservationsRaw },
    ] = await Promise.all([
      supabase
        .from("maker_follows")
        .select("*", { count: "exact", head: true })
        .eq("followed_partner_id", partner.id)
        .eq("status", "active"),
      supabase.rpc("get_active_store_coupons", { p_partner_id: partner.id }),
      supabase.from("business_categories").select("code, label").eq("depth", 1),
      supabase
        .from("maker_connections")
        .select(
          "id, requester_partner_id, status, requester:partners!maker_connections_requester_partner_id_fkey(id, display_name, business_type, partner_kind, address, lat, lng)",
        )
        .eq("target_partner_id", partner.id)
        .eq("status", "pending"),
      supabase
        .from("maker_connections")
        .select(
          `id, requester_partner_id, target_partner_id, status, ` +
            `requester:partners!maker_connections_requester_partner_id_fkey(${allyFields}), ` +
            `target:partners!maker_connections_target_partner_id_fkey(${allyFields})`,
        )
        .eq("status", "accepted")
        .or(`requester_partner_id.eq.${partner.id},target_partner_id.eq.${partner.id}`),
      // 예약관리 메뉴 pending 배지 — 기존 RPC 재사용(신규 RPC 0). 전체 반환 → pending 카운트.
      supabase.rpc("get_partner_reservations", { p_partner_id: partner.id }),
    ]);

    const pendingReservationCount = (
      (reservationsRaw as { status: string | null }[] | null) ?? []
    ).filter((r) => r.status === "pending").length;

    const majorMap = new Map(
      ((majors as { code: string; label: string }[] | null) ?? []).map((m) => [m.code, m.label]),
    );
    const businessTypeLabel = partner.business_type
      ? (majorMap.get(partner.business_type) ?? null)
      : null;

    // 내 매장 좌표 — 상대 매장과의 직선거리 계산 기준. 없으면 거리만 생략(행은 정상).
    const myLat = (partner.lat as number | null) ?? null;
    const myLng = (partner.lng as number | null) ?? null;
    const distanceTo = (lat: number | null, lng: number | null): string | null =>
      formatDistanceKm(haversineKm(myLat, myLng, lat, lng));

    type IncomingRaw = {
      id: string;
      requester_partner_id: string;
      status: string;
      requester: {
        id: string;
        display_name: string;
        business_type: string | null;
        partner_kind: string | null;
        address: string | null;
        lat: number | null;
        lng: number | null;
      } | null;
    };
    const incomingRequests: IncomingRequest[] = ((incomingRaw as IncomingRaw[] | null) ?? [])
      .filter((r) => r.requester)
      .map((r) => ({
        connectionId: r.id,
        name: r.requester!.display_name,
        industry: r.requester!.business_type
          ? (majorMap.get(r.requester!.business_type) ?? null)
          : null,
        address: r.requester!.address,
        distanceText: distanceTo(r.requester!.lat, r.requester!.lng),
      }));

    // 내 동맹 — ally 판별: requester_partner_id === 내 partner.id 면 target, 아니면 requester.
    type AllyPartner = {
      id: string;
      display_name: string;
      slug: string | null;
      business_type: string | null;
      partner_kind: string | null;
      address: string | null;
      lat: number | null;
      lng: number | null;
    };
    type AcceptedRaw = {
      id: string;
      requester_partner_id: string;
      target_partner_id: string;
      status: string;
      requester: AllyPartner | null;
      target: AllyPartner | null;
    };
    const allies: Ally[] = ((acceptedRaw as AcceptedRaw[] | null) ?? [])
      .map((r): Ally | null => {
        const ally = r.requester_partner_id === partner.id ? r.target : r.requester;
        if (!ally?.id) return null;
        return {
          connectionId: r.id,
          partnerId: ally.id,
          slug: ally.slug,
          name: ally.display_name,
          industry: ally.business_type ? (majorMap.get(ally.business_type) ?? null) : null,
          address: ally.address,
          distanceText: distanceTo(ally.lat, ally.lng),
        };
      })
      .filter((a): a is Ally => a !== null);

    return {
      ownerUserId,
      partnerId: partner.id,
      partnerName: partner.display_name ?? null,
      partnerSlug: partner.slug ?? null,
      verificationStatus: partner.verification_status ?? null,
      businessTypeLabel,
      partnerKind: partner.partner_kind ?? null,
      address: partner.address ?? null,
      subscriberCount: subscriberCount ?? 0,
      activeCoupons: (activeCouponsRaw as AllianceActiveCoupon[] | null) ?? [],
      pendingReservationCount,
      incomingRequests,
      allies,
    };
  },
  component: PartnerHome,
});

// v0 store-hub TopBar — 뒤로가기(→/me, 갇힘 해결) + 제목. BottomNav 는 _partner 레이아웃이 별도 유지.
function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#F0F0F0] bg-white/95 px-4 backdrop-blur-xl">
      <button
        type="button"
        onClick={onBack}
        aria-label="뒤로"
        className="flex size-9 items-center justify-center rounded-lg text-[#525252] transition-colors hover:bg-[#F5F5F5]"
      >
        <ChevronLeft className="size-5" strokeWidth={2.25} />
      </button>
      <span className="text-[15px] font-semibold text-[#0A0A0A]">{title}</span>
      <div className="w-9" />
    </header>
  );
}

// 12 대분류(business_categories depth=1) — code→라벨. 편집 select 옵션(정합: 유효 code 만 저장).
//   ※ business_type 은 DB text(enum 아님) — 앱단 정합을 위해 이 목록의 code 만 사용.
const MAJOR_CATEGORIES: { code: string; label: string }[] = [
  { code: "stay_leisure", label: "캠핑·펜션" },
  { code: "food", label: "맛집·외식" },
  { code: "cafe_dessert", label: "카페·디저트" },
  { code: "beauty", label: "미용·뷰티" },
  { code: "realestate", label: "부동산" },
  { code: "medical", label: "병원·의료" },
  { code: "pet", label: "반려동물" },
  { code: "education", label: "교육·클래스" },
  { code: "local_service", label: "생활서비스" },
  { code: "retail", label: "쇼핑·상품" },
  { code: "travel_event", label: "여행·체험·이벤트" },
  { code: "professional", label: "전문상담" },
];

// v0 store-hub 섹션 타이틀(아이콘 + 볼드 제목).
function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: typeof Store;
  title: string;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-1.5">
      <Icon className="size-4 text-[#525252]" strokeWidth={2.25} />
      <h3 className="text-[14px] font-bold text-[#0A0A0A]">{title}</h3>
    </div>
  );
}

// v0 명함 info 행(라벨 + 값, accent 옵션).
function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 shrink-0 text-[12px] font-semibold text-[#A3A3A3]">{label}</span>
      <span
        className={`min-w-0 flex-1 truncate text-[13.5px] font-medium ${accent ? "text-[#2563EB]" : "text-[#0A0A0A]"}`}
      >
        {value}
      </span>
    </div>
  );
}

// 활성 쿠폰 valid_until → "YY.MM.DD까지".
function fmtCouponDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}까지`;
}

function PartnerHome() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  // 받은 제휴 요청 — 로컬 상태(수락/거절 시 즉시 제거).
  const [incoming, setIncoming] = useState<IncomingRequest[]>(data.incomingRequests);
  const [reqBusyId, setReqBusyId] = useState<string | null>(null);
  // 내 제휴 파트너 — 로컬 상태(제휴 해제 시 즉시 제거).
  const [allies, setAllies] = useState<Ally[]>(data.allies);
  const [endingId, setEndingId] = useState<string | null>(null);

  const router = useRouter();
  // 명함 인라인 편집(#418: 인라인 폼, 시트/다이얼로그 아님). slug·BIZ·owner·좌표는 편집 불가(표시만).
  const [editingCard, setEditingCard] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [cardForm, setCardForm] = useState({
    displayName: "",
    businessType: "",
    subCategories: [] as string[],
    address: "",
  });
  const [subOptions, setSubOptions] = useState<{ code: string; label: string }[]>([]);
  // metadata 병합용 원본 — sub_categories 외 키(예: description) 보존(덮어쓰기 유실 방지).
  const [origMetadata, setOrigMetadata] = useState<Record<string, unknown>>({});

  // 편집 진입 — 현재 business_type·metadata 클라 조회(loader 무접촉). display_name·address 는 data 재사용.
  async function openCardEdit() {
    if (!data.partnerId) return;
    const { data: row } = await getSupabase()
      .from("partners")
      .select("business_type, metadata")
      .eq("id", data.partnerId)
      .maybeSingle();
    const meta = ((row as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}) as Record<
      string,
      unknown
    >;
    // 하위호환: metadata.sub_categories(배열) 우선, 없으면 레거시 sub_category(단일) → 배열.
    const rawSubs = meta.sub_categories ?? (meta.sub_category ? [meta.sub_category] : []);
    const subs = Array.isArray(rawSubs)
      ? rawSubs.filter((x): x is string => typeof x === "string")
      : [];
    setOrigMetadata(meta);
    setCardForm({
      displayName: data.partnerName ?? "",
      businessType: (row as { business_type?: string | null } | null)?.business_type ?? "",
      subCategories: subs,
      address: data.address ?? "",
    });
    setEditingCard(true);
  }

  // 대분류 변경 시 세부 옵션 로드(depth=2, parent_code). 편집 중에만.
  useEffect(() => {
    if (!editingCard || !cardForm.businessType) {
      setSubOptions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data: subs } = await getSupabase()
        .from("business_categories")
        .select("code, label")
        .eq("parent_code", cardForm.businessType)
        .order("sort_order");
      if (!cancelled) setSubOptions((subs as { code: string; label: string }[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [editingCard, cardForm.businessType]);

  // 대분류 변경 → 세부 선택 초기화(정합). 동일 code 재선택은 무시.
  function onSelectMajor(code: string) {
    setCardForm((f) =>
      f.businessType === code ? f : { ...f, businessType: code, subCategories: [] },
    );
  }
  function toggleCardSub(code: string) {
    setCardForm((f) => ({
      ...f,
      subCategories: f.subCategories.includes(code)
        ? f.subCategories.filter((c) => c !== code)
        : [...f.subCategories, code],
    }));
  }

  const cardCanSave = cardForm.displayName.trim().length > 0 && !savingCard;

  // 저장 — partners.update(RLS partners_owner_all: 오너 본인 자동 적용). metadata 기존 키 보존 병합.
  //   slug·verification_status·owner_user_id·lat/lng 미포함(편집 잠금). §0 가짜 성공 금지: error 시 토스트만.
  async function handleCardSave() {
    if (!data.partnerId || !cardCanSave) return;
    setSavingCard(true);
    try {
      const nextMeta: Record<string, unknown> = { ...origMetadata };
      delete nextMeta.sub_category; // 레거시 단일키 제거(배열로 일원화)
      if (cardForm.subCategories.length > 0) nextMeta.sub_categories = cardForm.subCategories;
      else delete nextMeta.sub_categories;
      const { error } = await getSupabase()
        .from("partners")
        .update({
          display_name: cardForm.displayName.trim(),
          business_type: cardForm.businessType || null,
          address: cardForm.address.trim() || null,
          metadata: nextMeta,
        })
        .eq("id", data.partnerId);
      if (error) {
        console.error("[partner.index] partner update failed:", error);
        toast.error("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      toast.success("매장 정보를 저장했어요.");
      setEditingCard(false);
      await router.invalidate(); // loader 재실행 → 명함 최신 반영
    } catch (err) {
      console.error("[partner.index] partner update unexpected:", err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setSavingCard(false);
    }
  }

  // 취소 — 로컬 편집 상태 폐기(표시는 loader data 기준이라 자동 원복).
  function handleCardCancel() {
    setEditingCard(false);
  }

  // 명함 공유 — /alliance/{slug} (없으면 {id}) 절대 URL 클립보드 복사 + 가능하면 카톡.
  async function handleShareCard() {
    if (!data.partnerId) return;
    const path = data.partnerSlug ? `/alliance/${data.partnerSlug}` : `/alliance/${data.partnerId}`;
    const url = `https://app.drop.how${path}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("명함 링크를 복사했어요.");
    } catch {
      toast.error("복사에 실패했어요.");
    }
    // best-effort 카톡 공유 — 실패해도 클립보드 복사로 충분.
    try {
      await shareToKakao({
        title: `${data.partnerName ?? "매장"} 명함`,
        description: "LinkDrop에서 제휴를 제안해 보세요.",
        imageUrl: "",
        linkUrl: url,
      });
    } catch {
      /* noop */
    }
  }

  // 받은 제휴 요청 수락/거절 — maker_connections UPDATE(target_update RLS 허용).
  async function handleConnection(connectionId: string, next: "accepted" | "rejected") {
    setReqBusyId(connectionId);
    try {
      const { error } = await getSupabase()
        .from("maker_connections")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", connectionId);
      if (error) {
        console.error("[partner.index] connection update failed:", error);
        toast.error("처리에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setIncoming((prev) => prev.filter((r) => r.connectionId !== connectionId));
      toast.success(next === "accepted" ? "제휴를 수락했어요." : "제휴 요청을 거절했어요.");
    } catch (err) {
      console.error("[partner.index] connection update unexpected:", err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setReqBusyId(null);
    }
  }

  // 제휴 해제 — end_partnership RPC(accepted면 양쪽 누구나 DELETE). confirm 후 호출.
  async function handleEndPartnership(connectionId: string, name: string) {
    if (typeof window !== "undefined" && !window.confirm(`${name}님과의 제휴를 해제할까요?`)) {
      return;
    }
    setEndingId(connectionId);
    try {
      const { error } = await getSupabase().rpc("end_partnership", {
        p_connection_id: connectionId,
      });
      if (error) {
        console.error("[partner.index] end_partnership failed:", error);
        toast.error("해제에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setAllies((prev) => prev.filter((x) => x.connectionId !== connectionId));
      toast.success("제휴를 해제했어요.");
    } catch (err) {
      console.error("[partner.index] end_partnership unexpected:", err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setEndingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA] tracking-ko pb-12">
      {/* ★ 갇힘 해결 — v0 TopBar 뒤로가기(→/me). _partner BottomNav 는 그대로 유지(파트너↔메인 왕래). */}
      <TopBar title="내 매장" onBack={() => navigate({ to: "/me" })} />

      <div className="space-y-4 px-5 pt-4">
        {/* 명함(v0 store-hub 톤) — StoreProfileCard(공유 컴포넌트) 무접촉, 같은 실데이터를 인라인 배선.
            partnerName·verificationStatus(tier)·businessTypeLabel·address·subscriberCount·slug·handleShareCard 유지. */}
        {data.partnerId ? (
          <section className="rounded-3xl border border-[#ECECEC] bg-white p-5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]">
            {/* 헤더 — 아바타 + 제목/BIZ + 우측 액션(표시: 편집·명함공유 / 편집중: 취소·저장) */}
            <div className="flex items-start gap-3.5">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#0A0A0A] text-[20px] font-bold text-white">
                {(editingCard ? cardForm.displayName || "매" : (data.partnerName ?? "매장"))
                  .trim()
                  .charAt(0) || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {editingCard ? (
                    <span className="text-[15px] font-bold text-[#0A0A0A]">매장 정보 편집</span>
                  ) : (
                    <h2 className="truncate text-[18px] font-bold text-[#0A0A0A]">
                      {data.partnerName ?? "매장"}
                    </h2>
                  )}
                  {/* BIZ/PB — 인증 상태, 편집 불가(표시만). */}
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      data.verificationStatus === "approved"
                        ? "bg-[#2563EB] text-white"
                        : "bg-[#E1F5EE] text-[#0E4D42]"
                    }`}
                  >
                    {data.verificationStatus === "approved" ? "BIZ" : "PB"}
                  </span>
                </div>
                <p className="mt-0.5 text-[12.5px] text-[#6E6E6E]">내 매장 명함</p>
              </div>
              {editingCard ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCardCancel}
                    disabled={savingCard}
                    className="flex h-9 items-center rounded-full border border-[#E5E5E5] bg-white px-3 text-[12px] font-bold text-[#525252] hover:bg-[#F5F5F5] disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCardSave()}
                    disabled={!cardCanSave}
                    className="flex h-9 items-center rounded-full bg-[#2563EB] px-3.5 text-[12px] font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
                  >
                    {savingCard ? "저장 중…" : "저장"}
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void openCardEdit()}
                    aria-label="매장 정보 편집"
                    className="flex size-9 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#525252] hover:bg-[#F5F5F5]"
                  >
                    <Pencil className="size-4" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={handleShareCard}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-[#2563EB] px-3 text-[12px] font-bold text-white transition-transform active:scale-95"
                  >
                    <Share2 className="size-3.5" strokeWidth={2.5} />
                    명함 공유
                  </button>
                </div>
              )}
            </div>

            {editingCard ? (
              /* 인라인 편집 폼(#418) — 매장명·업종(12)·세부업종(칩)·지역. slug·인증 편집 불가. */
              <div className="mt-4 flex flex-col gap-3 border-t border-[#F0F0F0] pt-4">
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-semibold text-[#525252]">매장명</span>
                  <input
                    type="text"
                    value={cardForm.displayName}
                    onChange={(e) => setCardForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="매장 이름"
                    className="min-h-[44px] rounded-lg border border-[#E8EDF3] bg-white px-3 text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8]"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-semibold text-[#525252]">업종</span>
                  <select
                    value={cardForm.businessType}
                    onChange={(e) => onSelectMajor(e.target.value)}
                    className="min-h-[44px] rounded-lg border border-[#E8EDF3] bg-white px-3 text-sm font-medium text-[#0F172A]"
                  >
                    <option value="">업종 선택</option>
                    {MAJOR_CATEGORIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                {cardForm.businessType && subOptions.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[#525252]">
                      세부 업종 (복수 선택)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {subOptions.map((s) => {
                        const on = cardForm.subCategories.includes(s.code);
                        return (
                          <button
                            key={s.code}
                            type="button"
                            onClick={() => toggleCardSub(s.code)}
                            aria-pressed={on}
                            className={`min-h-[36px] rounded-full border px-3 text-[12px] font-semibold transition-colors ${
                              on
                                ? "border-[#2563EB] bg-[#EEF3FE] text-[#2563EB]"
                                : "border-[#E8EDF3] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                            }`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-semibold text-[#525252]">지역</span>
                  <input
                    type="text"
                    value={cardForm.address}
                    onChange={(e) => setCardForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="예: 충북 괴산군 칠성면"
                    className="min-h-[44px] rounded-lg border border-[#E8EDF3] bg-white px-3 text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8]"
                  />
                </label>
                <p className="text-[11px] text-[#94A3B8]">
                  가게 링크(drop.how/{data.partnerSlug ?? "…"})·인증(BIZ)은 여기서 변경할 수 없어요.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#F0F0F0] pt-4">
                <InfoRow label="업종" value={data.businessTypeLabel ?? "미등록"} />
                <InfoRow label="구독" value={`${data.subscriberCount.toLocaleString()}명`} />
                <div className="col-span-2">
                  <InfoRow label="지역" value={data.address?.trim() || "위치 미등록"} />
                </div>
                {data.partnerSlug ? (
                  <div className="col-span-2">
                    <InfoRow label="링크" value={`drop.how/${data.partnerSlug}`} accent />
                  </div>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        {/* 진행 중 혜택(v0) — 실데이터 activeCoupons(get_active_store_coupons). mock DEMO_BENEFITS 금지. */}
        {data.partnerId ? (
          <div>
            <SectionTitle icon={Sparkles} title="진행 중 혜택" />
            <div className="space-y-2.5">
              {data.activeCoupons.length === 0 ? (
                <p className="rounded-2xl border border-[#ECECEC] bg-white p-4 text-[13px] text-[#8A8A8A]">
                  진행 중인 혜택 없음
                </p>
              ) : (
                data.activeCoupons.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-2xl border border-[#ECECEC] bg-white p-4"
                  >
                    <span className="flex size-9 items-center justify-center rounded-xl bg-[#EEF3FE] text-[#2563EB]">
                      <Ticket className="size-4" strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-[#0A0A0A]">
                        {c.title?.trim() || "쿠폰"}
                      </p>
                      {c.valid_until ? (
                        <p className="mt-0.5 text-[12px] text-[#8A8A8A]">
                          {fmtCouponDate(c.valid_until)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              {/* 공동 혜택 만들기 — 준비 중(기존 disabled 보존). */}
              <button
                type="button"
                disabled
                aria-disabled
                className="flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#D4D4D4] py-3 text-[13px] font-semibold text-[#8A8A8A]"
              >
                <Megaphone className="size-4" strokeWidth={2} />
                공동 혜택 만들기 · 준비 중
              </button>
            </div>
          </div>
        ) : null}

        {/* 내 가게 링크(v0) — Link2 SectionTitle + drop.how/{slug} 원탭 복사. 실 slug·복사 유지. */}
        {data.partnerId ? (
          <div>
            <SectionTitle icon={Link2} title="내 가게 링크" />
            {data.partnerSlug ? (
              <div className="flex items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white p-3.5">
                <Link2 className="size-4 shrink-0 text-[#8A8A8A]" strokeWidth={2.25} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#0A0A0A]">
                  drop.how/{data.partnerSlug}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      try {
                        await navigator.clipboard.writeText(`https://drop.how/${data.partnerSlug}`);
                        toast.success("링크를 복사했어요");
                      } catch {
                        toast.error("복사에 실패했어요.");
                      }
                    })();
                  }}
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[#EEF3FE] px-3 text-[12px] font-bold text-[#2563EB]"
                >
                  <Copy className="size-3.5" strokeWidth={2.5} />
                  복사
                </button>
              </div>
            ) : (
              <p className="rounded-2xl border border-[#ECECEC] bg-white p-4 text-[13px] text-[#8A8A8A]">
                가게 영문 주소를 설정하면 짧은 링크가 생겨요
              </p>
            )}
          </div>
        ) : null}

        {/* 받은 제휴 요청(v0 톤) — pending 0건이면 숨김. handleConnection accept/reject 유지(★v0에 없어도 보존). */}
        {incoming.length > 0 ? (
          <div>
            <SectionTitle icon={Inbox} title={`받은 제휴 요청 ${incoming.length}`} />
            <ul className="space-y-2.5">
              {incoming.map((r) => (
                <li key={r.connectionId} className="rounded-2xl border border-[#ECECEC] bg-white p-4">
                  <p className="truncate text-[14px] font-bold text-[#0A0A0A]">{r.name}</p>
                  <p className="mt-0.5 truncate text-[12px] text-[#8A8A8A]">
                    {[r.industry, r.address?.trim(), r.distanceText].filter(Boolean).join(" · ") ||
                      "정보 없음"}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleConnection(r.connectionId, "rejected")}
                      disabled={reqBusyId === r.connectionId}
                      className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E5E5E5] bg-white px-4 text-sm font-semibold text-[#0A0A0A] hover:bg-[#F5F5F5] disabled:opacity-50"
                    >
                      <XCircle className="size-4" strokeWidth={2} />
                      거절
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConnection(r.connectionId, "accepted")}
                      disabled={reqBusyId === r.connectionId}
                      className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-4 text-sm font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-4" strokeWidth={2} />
                      수락
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* 내 제휴 파트너(v0 톤) — accepted. 0건 숨김. 행 탭 → /alliance. 제휴 해제(end_partnership) 유지. */}
        {allies.length > 0 ? (
          <div>
            <SectionTitle icon={Users} title={`내 제휴 파트너 ${allies.length}`} />
            <ul className="space-y-2.5">
              {allies.map((a) => (
                <li
                  key={a.connectionId}
                  className="flex items-center gap-3 rounded-2xl border border-[#ECECEC] bg-white p-4"
                >
                  <Link
                    to="/alliance/$slug"
                    params={{ slug: a.slug ?? a.partnerId }}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F1F1F2] text-[15px] font-bold text-[#525252]">
                      {a.name.trim().charAt(0) || "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-[#0A0A0A]">{a.name}</p>
                      <p className="mt-0.5 truncate text-[12px] text-[#8A8A8A]">
                        {[a.industry, a.address?.trim(), a.distanceText]
                          .filter(Boolean)
                          .join(" · ") || "정보 없음"}
                      </p>
                    </div>
                  </Link>
                  {/* 제휴 해제 — 파괴적 액션이라 아웃라인/회색. 행 탭과 분리. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleEndPartnership(a.connectionId, a.name);
                    }}
                    disabled={endingId === a.connectionId}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E5E5E5] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#525252] hover:bg-[#F5F5F5] disabled:opacity-50"
                  >
                    <Unlink className="size-3.5" strokeWidth={2} />
                    제휴 해제
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* 매장 관리 — v0 store-hub 2-col 타일 그리드. 4그룹 실 라우트 배선 유지(판매/매출/프로모션/예약).
            coupons/redeem/calendar 딥링크는 각 그룹 페이지 내부에서 도달(허브 직접 링크 안 함). */}
        <div>
          <div className="mb-2.5 flex items-center gap-1.5">
            <Store className="size-4 text-[#525252]" strokeWidth={2.25} />
            <h3 className="text-[14px] font-bold text-[#0A0A0A]">매장 관리</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* 판매관리 → /partner/products */}
            <Link
              to="/partner/products"
              className="group flex flex-col items-start rounded-2xl border border-[#ECECEC] bg-white p-4 text-left transition-all hover:border-[#D4D4D4] active:scale-[0.98]"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-[#EEF3FE] text-[#2563EB]">
                <Package className="size-[22px]" strokeWidth={2} />
              </span>
              <span className="mt-3 flex w-full items-center justify-between">
                <span className="text-[15px] font-bold text-[#0A0A0A]">판매관리</span>
                <ChevronRight
                  className="size-4 text-[#C4C4C4] transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </span>
              <span className="mt-0.5 text-[12px] text-[#8A8A8A]">상품·주문 관리</span>
            </Link>

            {/* 매출관리 → /partner/results?range=30 */}
            <Link
              to="/partner/results"
              search={{ range: 30 } as never}
              className="group flex flex-col items-start rounded-2xl border border-[#ECECEC] bg-white p-4 text-left transition-all hover:border-[#D4D4D4] active:scale-[0.98]"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-[#EEF3FE] text-[#2563EB]">
                <BarChart3 className="size-[22px]" strokeWidth={2} />
              </span>
              <span className="mt-3 flex w-full items-center justify-between">
                <span className="text-[15px] font-bold text-[#0A0A0A]">매출관리</span>
                <ChevronRight
                  className="size-4 text-[#C4C4C4] transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </span>
              <span className="mt-0.5 text-[12px] text-[#8A8A8A]">매장 지표·정산</span>
            </Link>

            {/* 프로모션관리 → /partner/promotion */}
            <Link
              to="/partner/promotion"
              className="group flex flex-col items-start rounded-2xl border border-[#ECECEC] bg-white p-4 text-left transition-all hover:border-[#D4D4D4] active:scale-[0.98]"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-[#EEF3FE] text-[#2563EB]">
                <Sparkles className="size-[22px]" strokeWidth={2} />
              </span>
              <span className="mt-3 flex w-full items-center justify-between">
                <span className="text-[15px] font-bold text-[#0A0A0A]">프로모션관리</span>
                <ChevronRight
                  className="size-4 text-[#C4C4C4] transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </span>
              <span className="mt-0.5 text-[12px] text-[#8A8A8A]">쿠폰 만들기·처리</span>
            </Link>

            {/* 예약관리 → /partner/reservations (pending 배지 유지) */}
            <Link
              to="/partner/reservations"
              className="group flex flex-col items-start rounded-2xl border border-[#ECECEC] bg-white p-4 text-left transition-all hover:border-[#D4D4D4] active:scale-[0.98]"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-[#EEF3FE] text-[#2563EB]">
                <Calendar className="size-[22px]" strokeWidth={2} />
              </span>
              <span className="mt-3 flex w-full items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="text-[15px] font-bold text-[#0A0A0A]">예약관리</span>
                  {/* 미확인(pending) 예약 배지 — 0 이면 숨김. */}
                  {data.pendingReservationCount > 0 ? (
                    <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#0A0A0A] px-1 text-[10px] font-bold text-white">
                      {data.pendingReservationCount}
                    </span>
                  ) : null}
                </span>
                <ChevronRight
                  className="size-4 text-[#C4C4C4] transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </span>
              <span className="mt-0.5 text-[12px] text-[#8A8A8A]">예약·캘린더</span>
            </Link>
          </div>
        </div>
      </div>

      <Toaster richColors position="top-center" />
    </main>
  );
}
