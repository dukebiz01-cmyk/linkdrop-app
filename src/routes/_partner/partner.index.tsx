import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  Ticket,
  ChevronRight,
  Sparkles,
  BarChart3,
  CalendarRange,
  Megaphone,
  Share2,
  Inbox,
  Unlink,
  Package,
} from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { shareToKakao } from "@/lib/kakao";
import { Toaster } from "@/components/ui/sonner";
import { StoreProfileCard, type AllianceActiveCoupon } from "@/components/partner/StoreProfileCard";
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
    ]);

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
      incomingRequests,
      allies,
    };
  },
  component: PartnerHome,
});

function PartnerHome() {
  const data = Route.useLoaderData();
  // 받은 제휴 요청 — 로컬 상태(수락/거절 시 즉시 제거).
  const [incoming, setIncoming] = useState<IncomingRequest[]>(data.incomingRequests);
  const [reqBusyId, setReqBusyId] = useState<string | null>(null);
  // 내 제휴 파트너 — 로컬 상태(제휴 해제 시 즉시 제거).
  const [allies, setAllies] = useState<Ally[]>(data.allies);
  const [endingId, setEndingId] = useState<string | null>(null);

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
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
      <header className="bg-white px-5 py-4 border-b border-[#F1F5F9]">
        <h1 className="text-lg font-bold text-[#0F172A]">{data.partnerName ?? "매장"}</h1>
        <p className="mt-0.5 text-xs text-[#64748B]">내 매장</p>
      </header>

      <div className="space-y-4 px-5 pt-4">
        {/* 매장 프로필 카드(명함) — 최상단. 명함 공유 버튼 추가(piece 2). */}
        {data.partnerId ? (
          <StoreProfileCard
            name={data.partnerName ?? "매장"}
            tier={data.verificationStatus === "approved" ? "biz" : "pb"}
            businessTypeLabel={data.businessTypeLabel}
            partnerKind={data.partnerKind}
            address={data.address}
            subscriberCount={data.subscriberCount}
            activeCoupons={data.activeCoupons}
            note="내 매장 명함"
            headerAction={
              <button
                type="button"
                onClick={handleShareCard}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#0E4D42] bg-white px-2.5 text-xs font-bold text-[#0E4D42] hover:bg-[#E1F5EE]"
              >
                <Share2 className="size-3.5" strokeWidth={2} />
                명함 공유
              </button>
            }
            footer={
              <button
                type="button"
                disabled
                aria-disabled
                className="flex min-h-[44px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#F5F5F5] px-4 text-sm font-bold text-[#A3A3A3]"
              >
                <Megaphone className="size-4" strokeWidth={2} />
                공동 혜택 만들기
                <span className="text-xs font-semibold">· 준비 중</span>
              </button>
            }
          />
        ) : null}

        {/* 받은 제휴 요청 — pending 0건이면 카드 숨김. */}
        {incoming.length > 0 ? (
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <Inbox className="size-4 text-[#0E4D42]" strokeWidth={2} />
              <h2 className="text-sm font-semibold text-[#0A0A0A]">받은 제휴 요청</h2>
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#0E4D42] px-1.5 text-[11px] font-bold text-white">
                {incoming.length}
              </span>
            </div>
            <ul className="divide-y divide-[#F1F5F9]">
              {incoming.map((r) => (
                <li key={r.connectionId} className="py-3 first:pt-0 last:pb-0">
                  <p className="truncate text-sm font-bold text-[#0F172A]">{r.name}</p>
                  <p className="mt-0.5 truncate text-xs text-[#64748B]">
                    {[r.industry, r.address?.trim(), r.distanceText].filter(Boolean).join(" · ") ||
                      "정보 없음"}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleConnection(r.connectionId, "rejected")}
                      disabled={reqBusyId === r.connectionId}
                      className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D4D4D4] bg-white px-4 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
                    >
                      <XCircle className="size-4" strokeWidth={2} />
                      거절
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConnection(r.connectionId, "accepted")}
                      disabled={reqBusyId === r.connectionId}
                      className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0A0A0A] px-4 text-sm font-bold text-white hover:bg-[#171717] disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-4" strokeWidth={2} />
                      수락
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* 내 제휴 파트너 — accepted 연결. 0건이면 카드 숨김. 행 탭 → 상대 /alliance 뷰. */}
        {allies.length > 0 ? (
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <Users className="size-4 text-[#0E4D42]" strokeWidth={2} />
              <h2 className="text-sm font-semibold text-[#0A0A0A]">내 제휴 파트너</h2>
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#0E4D42] px-1.5 text-[11px] font-bold text-white">
                {allies.length}
              </span>
            </div>
            <ul className="divide-y divide-[#F1F5F9]">
              {allies.map((a) => (
                <li key={a.connectionId} className="flex items-center gap-2">
                  <Link
                    to="/alliance/$slug"
                    params={{ slug: a.slug ?? a.partnerId }}
                    className="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-[#FAFAFA]"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E1F5EE] text-base font-bold text-[#0E4D42]">
                      {a.name.trim().charAt(0) || "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#0F172A]">{a.name}</p>
                      <p className="mt-0.5 truncate text-xs text-[#64748B]">
                        {[a.industry, a.address?.trim(), a.distanceText]
                          .filter(Boolean)
                          .join(" · ") || "정보 없음"}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-[#94A3B8]" strokeWidth={2} />
                  </Link>
                  {/* 제휴 해제 — 파괴적 액션이라 아웃라인/회색(teal 채움 아님). 행 탭과 분리. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleEndPartnership(a.connectionId, a.name);
                    }}
                    disabled={endingId === a.connectionId}
                    className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border border-[#D4D4D4] bg-white px-2.5 text-xs font-semibold text-[#64748B] hover:bg-[#FAFAFA] disabled:opacity-50"
                  >
                    <Unlink className="size-3.5" strokeWidth={2} />
                    제휴 해제
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ① 이번 달 성과 */}
        <Link
          to="/partner/results"
          search={{ range: 30 } as never}
          className="flex w-full min-h-[44px] items-center justify-between rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:bg-[#FAFAFA]"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#FAFAFA]">
              <BarChart3 className="size-5 text-[#0A0A0A]" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">이번 달 성과</p>
              <p className="mt-0.5 text-xs text-[#64748B]">조회·예약·쿠폰 한 눈에 보기</p>
            </div>
          </div>
          <ChevronRight className="size-5 text-[#94A3B8]" strokeWidth={2} />
        </Link>

        {/* ② 예약 캘린더 (신규) */}
        <Link
          to="/partner/calendar"
          className="flex w-full min-h-[44px] items-center justify-between rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:bg-[#FAFAFA]"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#FAFAFA]">
              <CalendarRange className="size-5 text-[#0A0A0A]" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">예약 캘린더</p>
              <p className="mt-0.5 text-xs text-[#64748B]">
                가능한 날짜를 마킹해 손님에게 보여줘요
              </p>
            </div>
          </div>
          <ChevronRight className="size-5 text-[#94A3B8]" strokeWidth={2} />
        </Link>

        {/* 판매 관리 — 자체업로드 상품 목록(S3a). */}
        <Link
          to="/partner/products"
          className="flex w-full min-h-[44px] items-center justify-between rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:bg-[#FAFAFA]"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#FAFAFA]">
              <Package className="size-5 text-[#0A0A0A]" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">판매 관리</p>
              <p className="mt-0.5 text-xs text-[#64748B]">내 상품을 등록하고 관리해요</p>
            </div>
          </div>
          <ChevronRight className="size-5 text-[#94A3B8]" strokeWidth={2} />
        </Link>

        {/* ③ 쿠폰 만들기 */}
        <Link
          to="/partner/coupons"
          className="flex w-full min-h-[44px] items-center justify-between rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:bg-[#FAFAFA]"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#FEF3C7]">
              <Sparkles className="size-5 text-[#D97706]" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">쿠폰 만들기</p>
              <p className="mt-0.5 text-xs text-[#64748B]">할인·혜택 쿠폰을 새로 만들어요</p>
            </div>
          </div>
          <ChevronRight className="size-5 text-[#94A3B8]" strokeWidth={2} />
        </Link>

        {/* ④ 쿠폰 처리 (redeem) */}
        <Link
          to="/partner/redeem"
          className="flex w-full min-h-[44px] items-center justify-between rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:bg-[#FAFAFA]"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#FAFAFA]">
              <Ticket className="size-5 text-[#0A0A0A]" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">쿠폰 처리</p>
              <p className="mt-0.5 text-xs text-[#64748B]">손님 쿠폰 코드를 입력해 주세요</p>
            </div>
          </div>
          <ChevronRight className="size-5 text-[#94A3B8]" strokeWidth={2} />
        </Link>

        {/* 예약관리 — 들어온 예약 inbox 는 /partner/reservations 로 분리(Phase 1). */}
        <Link
          to="/partner/reservations"
          className="flex w-full min-h-[44px] items-center justify-between rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:bg-[#FAFAFA]"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#FAFAFA]">
              <Calendar className="size-5 text-[#0A0A0A]" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">예약관리</p>
              <p className="mt-0.5 text-xs text-[#64748B]">들어온 예약을 확인하고 처리해요</p>
            </div>
          </div>
          <ChevronRight className="size-5 text-[#94A3B8]" strokeWidth={2} />
        </Link>
      </div>

      <Toaster richColors position="top-center" />
    </main>
  );
}
