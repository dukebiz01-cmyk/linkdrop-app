import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  User,
  Gift,
  Heart,
  FileText,
  Store,
  LogOut,
  ChevronRight,
  BarChart3,
  Wallet,
  Send,
} from "lucide-react";
// Wallet = 쿠폰 지갑 섹션 헤더. Send = 받은 쿠폰 메이커, Heart = 구독한 메이커. Gift = 증정 쿠폰 라벨.
import { Toaster } from "@/components/ui/sonner";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import {
  getCouponDisplayStatus,
  isCouponUsable,
  couponStatusLabel,
  type CouponDisplayStatus,
} from "@/lib/coupon-status";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { YouTubeEmbedModal } from "@/components/receiver/YouTubeEmbedModal";
import { parseVideoUrl } from "@/lib/video-metadata";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type CouponClaimRow = {
  id: string;
  coupon_id: string;
  status: string;
  issued_at: string | null;
  used_at: string | null;
  expires_at: string | null;
  claim_code: string;
  coupon: {
    title: string;
    coupon_type: string | null;
    gift_item: string | null;
    valid_until: string | null;
    conditions: { min_amount?: number; [k: string]: unknown } | null;
    per_user_limit: number | null;
    partner: {
      display_name: string;
      business_type: string | null;
      partner_kind: string | null;
      address: string | null;
    } | null;
  } | null;
};

type MyDropRow = {
  id: string;
  purpose: string | null;
  status: string | null;
  ai_summary: string | null;
  view_count: number | null;
  share_count: number | null;
  conversion_count: number | null;
  created_at: string | null;
  published_at: string | null;
  source: {
    title: string | null;
    thumbnail_url: string | null;
    provider: string | null;
    source_url?: string | null;
  } | null;
  // v5.5: 첫 share_event 의 share_uuid. 없으면 null (공유 안 된 옛 drop).
  share_uuid: string | null;
};

// 유튜브 썸네일 URL 또는 source_url 에서 videoId 추출.
// thumbnail 패턴: https://i.ytimg.com/vi/{id}/... · https://img.youtube.com/vi/{id}/...
// source_url 은 parseVideoUrl 헬퍼 사용.
function extractYouTubeVideoIdFromThumb(thumb: string | null | undefined): string | null {
  if (!thumb) return null;
  const m = thumb.match(/(?:i\.ytimg\.com|img\.youtube\.com)\/vi\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

// 메이커(=사업체 partners 한 행) 표시 정보. partners 엔 로고 컬럼이 없어
// display_name 첫 글자 이니셜 아바타로 표시. metadata.description 우선 부제.
type MakerInfo = {
  id: string;
  display_name: string;
  partner_kind: string | null;
  metadata: { description?: string | null; [k: string]: unknown } | null;
  // pb/biz 등급 판정용 — verification_status='approved' 면 biz(인증), 아니면 pb.
  verification_status: string | null;
};

// 받은 쿠폰 → 메이커 dedup 용 raw row (client GROUP BY 불가 → JS dedup).
type ClaimMakerRow = {
  issued_at: string | null;
  coupon: {
    partner_id: string | null;
    partner: MakerInfo | null;
  } | null;
};

// maker_follows(active) + partners 조인 raw row.
type FollowRow = {
  followed_partner_id: string;
  created_at: string | null;
  partner: MakerInfo | null;
};

// 쿠폰 지갑 상태 필터 — 사용 가능(usable=available+expiring) / 곧 만료 / 사용 완료 / 만료.
type CouponFilter = "available" | "expiring" | "used" | "expired";

type MePageData = {
  userId: string | null;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  isBusiness: boolean;
  myDrops: MyDropRow[];
  coupons: CouponClaimRow[];
  // 업종 코드 → 한글 라벨 (business_categories depth=1, 등록화면 매핑 재사용).
  businessLabels: Record<string, string>;
  // 받은 쿠폰을 발행한 메이커(중복 제거) — 구독 버튼 부착.
  receivedMakers: MakerInfo[];
  // 현재 구독(active) 중인 메이커.
  subscribedMakers: MakerInfo[];
};

/**
 * /me — 나 페이지 (N1).
 *
 * 부모 _user.tsx beforeLoad 가 인증 단독 담당. 자식 loader 는 graceful — userId null
 * 이어도 throw 없이 빈 데이터로 진행 (메모리 #17 fix1 패턴, profile.tsx 참조).
 *
 * 섹션: 내 정보 · 쿠폰 지갑 · 받은 쿠폰 메이커 · 구독한 메이커 · 내 카드 · 내 매장(조건부) · 설정
 *
 * v5.5 마이그레이션으로 get_my_drops 반환에 share_uuid 추가됨 → ④ 내 카드의
 * "성과 보기" 링크 활성화 (isBusiness && share_uuid 동시 조건). N1-b.
 */
export const Route = createFileRoute("/_user/me")({
  head: () => ({ meta: [{ title: "나 — LinkDrop" }] }),
  // A안: 쿠폰 claim 직후 /me?claimed=<claim_code> 로 착지 → 해당 카드 입장 연출.
  // claimed 외 파라미터는 버린다(연출 후 즉시 제거되는 일회성 신호).
  validateSearch: (search: Record<string, unknown>): { claimed?: string } => {
    const claimed = typeof search.claimed === "string" ? search.claimed : undefined;
    return claimed ? { claimed } : {};
  },
  loader: async (): Promise<MePageData> => {
    const empty: MePageData = {
      userId: null,
      email: null,
      displayName: "",
      avatarUrl: null,
      isBusiness: false,
      myDrops: [],
      coupons: [],
      businessLabels: {},
      receivedMakers: [],
      subscribedMakers: [],
    };

    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    const email = sessionData.session?.user.email ?? null;
    if (!userId) return { ...empty, email };

    // 본인 기본 정보
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    // 비지니스 여부 (성과·매장 섹션 게이트)
    const { data: isBusiness } = await supabase.rpc("is_active_partner_owner", {
      _user_id: userId,
    });

    // 내 카드 (get_my_drops jsonb 반환)
    const { data: dropsJson } = await supabase.rpc("get_my_drops", {
      p_status: null,
      p_limit: 20,
      p_offset: 0,
    });
    const myDrops = Array.isArray(dropsJson) ? (dropsJson as MyDropRow[]) : [];

    // 받은 혜택 (RLS claims_self_read = catcher_user_id = auth.uid())
    // coupon5: coupons + partners 중첩 JOIN — 카드에 제목·매장명 표시.
    //   coupons_public_read(is_active=true) + partners_public_read(verification_status=approved)
    //   PUBLIC SELECT 정책으로 JOIN 통과.
    // status 필터 없음 → used/만료 모두 포함. issued_at 내림차순(최신순). 전체(11개째 이후 포함).
    const { data: couponsEmbed, error: couponsErr } = await supabase
      .from("coupon_claims")
      .select(
        "id, coupon_id, status, issued_at, used_at, expires_at, claim_code, " +
          "coupon:coupons(title, coupon_type, gift_item, valid_until, conditions, per_user_limit, " +
          "partner:partners(display_name, business_type, partner_kind, address))",
      )
      .eq("catcher_user_id", userId)
      .order("issued_at", { ascending: false })
      .limit(100);

    let coupons = (couponsEmbed as CouponClaimRow[] | null) ?? [];
    // 폴백: 임베드(coupons/partners) 조회가 어떤 이유로든 실패하면 지갑이 통째로 비지
    //   않도록 claim 만 다시 조회한다(카드 제목/매장명은 '쿠폰' fallback). 상태/정렬 동일.
    if (couponsErr) {
      console.error("[me] coupon_claims 임베드 조회 실패 — claim-only 폴백:", couponsErr);
      const { data: plain } = await supabase
        .from("coupon_claims")
        .select("id, coupon_id, status, issued_at, used_at, expires_at, claim_code")
        .eq("catcher_user_id", userId)
        .order("issued_at", { ascending: false })
        .limit(100);
      coupons = ((plain as Omit<CouponClaimRow, "coupon">[] | null) ?? []).map((c) => ({
        ...c,
        coupon: null,
      }));
    }

    // 업종 한글 라벨 — 등록화면과 동일 매핑(business_categories depth=1) 재사용. 카드의 '업종' 표시용.
    const { data: majors } = await supabase
      .from("business_categories")
      .select("code, label")
      .eq("depth", 1);
    const businessLabels: Record<string, string> = {};
    for (const m of (majors as { code: string; label: string }[] | null) ?? []) {
      businessLabels[m.code] = m.label;
    }

    // 받은 쿠폰 메이커 — claims → coupons → partners. client GROUP BY 불가라
    //   JS 에서 partner.id 기준 dedup(이미 issued_at desc 정렬 → 첫 등장이 최신).
    //   partner null(미승인 RLS 탈락)은 skip.
    const { data: claimMakerRows } = await supabase
      .from("coupon_claims")
      .select(
        "issued_at, coupon:coupons(partner_id, partner:partners(id, display_name, partner_kind, metadata, verification_status))",
      )
      .eq("catcher_user_id", userId)
      .order("issued_at", { ascending: false });

    const receivedMakers: MakerInfo[] = [];
    const seenMaker = new Set<string>();
    for (const row of (claimMakerRows as ClaimMakerRow[] | null) ?? []) {
      const partner = row.coupon?.partner;
      if (!partner?.id || seenMaker.has(partner.id)) continue;
      seenMaker.add(partner.id);
      receivedMakers.push(partner);
    }

    // 구독한 메이커 — maker_follows(본인 RLS, active) + partners(approved public read).
    const { data: follows } = await supabase
      .from("maker_follows")
      .select(
        "followed_partner_id, created_at, partner:partners(id, display_name, partner_kind, metadata, verification_status)",
      )
      .eq("follower_user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    const subscribedMakers: MakerInfo[] = ((follows as FollowRow[] | null) ?? [])
      .map((f) => f.partner)
      .filter((p): p is MakerInfo => Boolean(p?.id));

    return {
      userId,
      email,
      displayName: profile?.display_name ?? "",
      avatarUrl: profile?.avatar_url ?? null,
      isBusiness: Boolean(isBusiness),
      myDrops,
      coupons,
      businessLabels,
      receivedMakers,
      subscribedMakers,
    };
  },
  component: MePage,
});

function getInitial(displayName: string, email: string | null): string {
  const source = displayName.trim() || email?.split("@")[0] || "?";
  return source.charAt(0).toUpperCase();
}

// 필터별 빈 상태 문구.
function couponFilterEmptyText(f: CouponFilter): string {
  switch (f) {
    case "available":
      return "쓸 수 있는 혜택이 없어요.";
    case "expiring":
      return "곧 만료되는 혜택이 없어요.";
    case "used":
      return "사용 완료한 혜택이 없어요.";
    case "expired":
      return "만료된 혜택이 없어요.";
  }
}

function MePage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  // 담기는 연출 — claim 직후 해당 카드 강조(입장 애니 + 하이라이트 링) ~2초.
  const [highlightCode, setHighlightCode] = useState<string | null>(null);
  const claimedCardRef = useRef<HTMLLIElement | null>(null);
  const claimedHandledRef = useRef(false);
  // 작업 C: 내 카드 접기/펼치기 (상위 2개 + 더보기/접기 토글)
  const [dropsExpanded, setDropsExpanded] = useState(false);
  // 명시적 구독 — subscribedMakers 를 로컬 상태로 들고 구독/취소 시 reactive 갱신.
  const [subscribedMakers, setSubscribedMakers] = useState<MakerInfo[]>(data.subscribedMakers);
  const [busyMakerId, setBusyMakerId] = useState<string | null>(null);
  const subscribedIds = new Set(subscribedMakers.map((m) => m.id));
  // 작업 B: 내 카드 썸네일 탭 → 인앱 임베드 재생 (단일 모달 인스턴스)
  const [embedState, setEmbedState] = useState<{
    open: boolean;
    videoId: string;
    originalUrl: string;
    title: string;
  } | null>(null);

  // 쿠폰 지갑 필터 칩 — 기본 '사용 가능'(usable). 클라이언트 로컬 state(서버 호출 없음).
  const [couponFilter, setCouponFilter] = useState<CouponFilter>("available");

  // 상태별 카운트 (coupon-status 헬퍼). usable(쓸 수 있는) = 사용 가능 + 곧 만료.
  const usableCount = data.coupons.filter((c) => isCouponUsable(c)).length;
  const expiringCount = data.coupons.filter((c) => getCouponDisplayStatus(c) === "expiring").length;
  const usedCount = data.coupons.filter((c) => getCouponDisplayStatus(c) === "used").length;
  const expiredCount = data.coupons.filter((c) => getCouponDisplayStatus(c) === "expired").length;

  // 선택 필터에 맞는 쿠폰만(loader 의 최신순 정렬 그대로 유지).
  const filteredCoupons = data.coupons.filter((c) => {
    const s = getCouponDisplayStatus(c);
    return couponFilter === "available"
      ? s === "available" || s === "expiring"
      : s === couponFilter;
  });

  // A안 담김 연출 — mount 시 search.claimed 1회 처리.
  // 1) "쿠폰 지갑에 담겼어요" 토스트 → 2) URL 에서 claimed 제거(재연출 방지) →
  // 3) reduced-motion 아니면 해당 카드 하이라이트 + scrollIntoView, ~2초 후 해제.
  // SSR/하이드레이션 불일치 방지를 위해 모든 연출 결정은 mount 이후 effect 에서만.
  useEffect(() => {
    if (claimedHandledRef.current) return;
    const claimed = search.claimed;
    if (!claimed) return;
    claimedHandledRef.current = true;

    toast.success("쿠폰 지갑에 담겼어요");

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

    // 새로고침 재연출 방지 — claimed 제거(replace).
    void navigate({ to: "/me", search: {}, replace: true });

    if (reduced) return; // 연출 생략, 즉시 표시

    setHighlightCode(claimed);
    const clearTimer = window.setTimeout(() => setHighlightCode(null), 2000);
    const raf = requestAnimationFrame(() => {
      claimedCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => {
      window.clearTimeout(clearTimer);
      cancelAnimationFrame(raf);
    };
    // mount-only: search.claimed/navigate 는 1회만 읽음(재실행 시 가드로 차단).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEmbedFromDrop(d: MyDropRow) {
    const url = d.source?.source_url ?? "";
    const fromUrl = url ? parseVideoUrl(url) : null;
    const videoId = fromUrl?.videoId ?? extractYouTubeVideoIdFromThumb(d.source?.thumbnail_url);
    if (!videoId) {
      // 안전 fallback: videoId 없으면 모달 안 띄움. 빈 모달 금지.
      toast.info("이 영상은 인앱 재생을 지원하지 않아요.");
      return;
    }
    setEmbedState({
      open: true,
      videoId,
      originalUrl: url || `https://www.youtube.com/watch?v=${videoId}`,
      title: d.source?.title?.trim() || "영상 재생",
    });
  }

  // 구독 — maker_follows upsert(active). UNIQUE(follower,partner) 충돌 시 status 갱신.
  async function handleSubscribe(maker: MakerInfo) {
    if (!data.userId) return;
    setBusyMakerId(maker.id);
    try {
      const { error } = await getSupabase().from("maker_follows").upsert(
        {
          follower_user_id: data.userId,
          followed_partner_id: maker.id,
          source: "manual",
          consent_at: new Date().toISOString(),
          status: "active",
        },
        { onConflict: "follower_user_id,followed_partner_id" },
      );
      if (error) {
        console.error("[me] subscribe failed:", error);
        toast.error("구독에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setSubscribedMakers((prev) =>
        prev.some((m) => m.id === maker.id) ? prev : [maker, ...prev],
      );
      toast.success("구독했어요.");
    } catch (err) {
      console.error("[me] subscribe unexpected:", err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setBusyMakerId(null);
    }
  }

  // 구독 취소 — status='unfollowed'. 구독한 메이커 섹션에서 사라지고, 받은쿠폰 줄은 다시 [구독].
  async function handleUnsubscribe(partnerId: string) {
    if (!data.userId) return;
    setBusyMakerId(partnerId);
    try {
      const { error } = await getSupabase()
        .from("maker_follows")
        .update({ status: "unfollowed" })
        .eq("follower_user_id", data.userId)
        .eq("followed_partner_id", partnerId);
      if (error) {
        console.error("[me] unsubscribe failed:", error);
        toast.error("구독 취소에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setSubscribedMakers((prev) => prev.filter((m) => m.id !== partnerId));
      toast.success("구독을 취소했어요.");
    } catch (err) {
      console.error("[me] unsubscribe unexpected:", err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setBusyMakerId(null);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await getSupabase().auth.signOut();
    } catch (err) {
      console.error("[me] signOut failed:", err);
    } finally {
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F8FAFC] tracking-ko pb-12">
      <header className="bg-white px-5 py-4 border-b border-[#F1F5F9]">
        <h1 className="text-lg font-bold text-[#0F172A]">나</h1>
      </header>

      <div className="space-y-4 px-5 pt-4">
        {/* ① 내 정보 */}
        <SectionCard Icon={User} title="내 정보">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {data.avatarUrl ? <AvatarImage src={data.avatarUrl} alt="프로필 사진" /> : null}
              <AvatarFallback className="bg-[#F1F5F9] text-xl font-bold text-[#0F172A]">
                {getInitial(data.displayName, data.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-[#0F172A]">
                {data.displayName.trim() || "이름을 등록해 보세요"}
              </p>
              {data.email ? (
                <p className="truncate text-sm font-medium text-[#64748B]">{data.email}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: "/profile" })}
              className="flex h-11 min-h-[44px] items-center justify-center rounded-lg border border-[#E5E7EB] px-3 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              편집
            </button>
          </div>
        </SectionCard>

        {/* 작업 A — 내 매장: 비지니스에게 1순위. 프로필 바로 아래로 이동.
            비업주(팬)는 미표시. */}
        {data.isBusiness ? (
          <SectionCard Icon={Store} title="내 매장">
            <button
              type="button"
              onClick={() => navigate({ to: "/partner" })}
              className="flex w-full min-h-[44px] items-center justify-between rounded-xl bg-[#F8FAFC] px-4 py-3 text-sm font-semibold text-[#0F172A] hover:bg-[#F1F5F9]"
            >
              <span>매장 관리</span>
              <ChevronRight className="size-4 text-[#64748B]" strokeWidth={2} />
            </button>
          </SectionCard>
        ) : null}

        {/* ② 내 혜택 지갑 — 행동형 헤더 + 상태 필터 칩(2/5). 카드(1/5)·정렬·다른 섹션 무수정.
            필터는 클라이언트 로컬 state, 정렬은 loader 최신순 유지. */}
        <section className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          {/* 헤더 */}
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-[#0E4D42]" strokeWidth={2} />
              <h3 className="text-base font-bold text-[#0A0A0A]">내 혜택 지갑</h3>
            </div>
            <p className="mt-1 text-sm font-medium text-[#64748B]">
              쓸 수 있는 혜택 {usableCount}개
              {expiringCount > 0 ? (
                <span className="font-semibold text-[#B45309]"> · 곧 만료 {expiringCount}개</span>
              ) : null}
            </p>
          </div>

          {/* 상태 필터 칩 — 선택=teal/흰, 그 외=아웃라인/회색 */}
          {data.coupons.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {(
                [
                  { key: "available", label: "사용 가능", count: usableCount },
                  { key: "expiring", label: "곧 만료", count: expiringCount },
                  { key: "used", label: "사용 완료", count: usedCount },
                  { key: "expired", label: "만료", count: expiredCount },
                ] as const
              ).map((chip) => {
                const selected = couponFilter === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setCouponFilter(chip.key)}
                    className={`inline-flex min-h-[32px] items-center rounded-full px-3 text-xs font-bold transition-colors ${
                      selected
                        ? "bg-[#0E4D42] text-white"
                        : "border border-[#E5E7EB] bg-white text-[#64748B] hover:bg-[#FAFAFA]"
                    }`}
                  >
                    {chip.label} {chip.count}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* 리스트 */}
          {data.coupons.length === 0 ? (
            <EmptyText text="받은 쿠폰이 여기 모여요." />
          ) : filteredCoupons.length === 0 ? (
            <EmptyText text={couponFilterEmptyText(couponFilter)} />
          ) : (
            <ul className="space-y-3">
              {filteredCoupons.map((c) => {
                const active = highlightCode === c.claim_code;
                return (
                  <CouponClaimCard
                    key={c.id}
                    row={c}
                    active={active}
                    innerRef={active ? claimedCardRef : undefined}
                    businessLabels={data.businessLabels}
                  />
                );
              })}
            </ul>
          )}
        </section>

        {/* ③-A 받은 쿠폰 메이커 — 쿠폰을 발행한 메이커(중복 제거) + 구독 버튼.
            쿠폰 지갑과 동일 톤: hairline divide-y, 박스 중첩 금지, 이니셜 아바타. */}
        <SectionCard Icon={Send} title="받은 쿠폰 메이커">
          <p className="mb-3 text-xs font-medium text-[#64748B]">
            구독을 하면 해당 메이커의 혜택을 지속적으로 받아볼 수 있어요.
          </p>
          {data.receivedMakers.length === 0 ? (
            <EmptyText text="받은 쿠폰이 없어요." />
          ) : (
            <ul className="divide-y divide-[#F1F5F9]">
              {data.receivedMakers.map((m) => (
                <MakerRow
                  key={m.id}
                  maker={m}
                  right={
                    subscribedIds.has(m.id) ? (
                      <span className="shrink-0 text-sm font-semibold text-[#94A3B8]">구독 중</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSubscribe(m)}
                        disabled={busyMakerId === m.id}
                        className="inline-flex min-h-[36px] shrink-0 items-center rounded-lg bg-[#0A0A0A] px-3 text-sm font-bold text-white hover:bg-[#171717] disabled:opacity-50"
                      >
                        구독
                      </button>
                    )
                  }
                />
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ③-B 구독한 메이커 — maker_follows(본인, active). 구독 취소 = status='unfollowed'. */}
        <SectionCard Icon={Heart} title="구독한 메이커">
          {subscribedMakers.length === 0 ? (
            <EmptyText text="아직 구독한 메이커가 없어요." />
          ) : (
            <ul className="divide-y divide-[#F1F5F9]">
              {subscribedMakers.map((m) => (
                <MakerRow
                  key={m.id}
                  maker={m}
                  right={
                    <button
                      type="button"
                      onClick={() => handleUnsubscribe(m.id)}
                      disabled={busyMakerId === m.id}
                      className="inline-flex min-h-[36px] shrink-0 items-center rounded-lg border border-[#D4D4D4] bg-transparent px-3 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
                    >
                      구독 취소
                    </button>
                  }
                />
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ④ 내 카드 — 성과 보기 링크는 비지니스만 (share_uuid 있는 카드만 활성, v5.5 반환).
            작업 C: 기본 상위 2개만 노출 + 더보기/접기 토글. 개수 증가 대비.
            작업 B: 썸네일/제목 탭 → 인앱 임베드 모달 재생. */}
        <SectionCard Icon={FileText} title="내 카드">
          {data.myDrops.length === 0 ? (
            <EmptyText text="아직 만든 카드가 없어요." />
          ) : (
            <>
              <ul className="space-y-2">
                {data.myDrops.slice(0, dropsExpanded ? data.myDrops.length : 2).map((d) => (
                  <li key={d.id} className="rounded-xl bg-[#F8FAFC] px-3 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEmbedFromDrop(d)}
                        aria-label="영상 재생"
                        className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-[#E2E8F0] transition-opacity hover:opacity-90"
                      >
                        {d.source?.thumbnail_url ? (
                          <img
                            src={d.source.thumbnail_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => openEmbedFromDrop(d)}
                          className="block w-full min-w-0 text-left"
                        >
                          <p className="truncate text-sm font-semibold text-[#0F172A] hover:underline">
                            {d.source?.title?.trim() || "(제목 없음)"}
                          </p>
                        </button>
                        <p className="mt-0.5 text-xs text-[#64748B]">
                          조회 {numFmt(d.view_count)} · 공유 {numFmt(d.share_count)} · 전환{" "}
                          {numFmt(d.conversion_count)}
                        </p>
                      </div>
                    </div>
                    {data.isBusiness && d.share_uuid ? (
                      <button
                        type="button"
                        onClick={() =>
                          navigate({
                            to: "/results/$shareUuid",
                            params: { shareUuid: d.share_uuid! },
                          })
                        }
                        className="mt-2 flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[#0A0A0A] hover:underline"
                      >
                        <BarChart3 className="size-4" strokeWidth={2} />
                        성과 보기
                        <ChevronRight className="size-4" strokeWidth={2} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {data.myDrops.length > 2 ? (
                <button
                  type="button"
                  onClick={() => setDropsExpanded((v) => !v)}
                  className="mt-3 flex w-full min-h-[44px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-semibold tracking-ko text-[#0A0A0A] transition-colors hover:bg-[#FAFAFA]"
                >
                  {dropsExpanded ? "접기" : `더보기 (${data.myDrops.length - 2})`}
                </button>
              ) : null}
            </>
          )}
        </SectionCard>

        {/* ⑥ 설정 — 하단 계정 섹션. 본문과 얇은 구분선으로 분리, 로그아웃 행은
            '더보기' 버튼과 동일한 풀폭 정렬(border + bg-white + rounded-xl + min-h-[44px]). */}
        <section className="border-t border-[#E5E7EB] pt-4">
          <h2 className="mb-3 px-1 text-sm font-semibold text-[#0A0A0A]">설정</h2>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="flex w-full min-h-[44px] items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#EF4444] transition-colors hover:bg-[#FEF2F2]"
              >
                <LogOut className="size-4" strokeWidth={2} />
                로그아웃
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>로그아웃 하시겠어요?</AlertDialogTitle>
                <AlertDialogDescription>
                  다시 로그인할 때까지 이 기기에서 로그아웃돼요.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={signingOut}>취소</AlertDialogCancel>
                <AlertDialogAction
                  disabled={signingOut}
                  onClick={(e) => {
                    e.preventDefault();
                    void handleSignOut();
                  }}
                  className="bg-[#EF4444] text-white hover:bg-[#DC2626]"
                >
                  {signingOut ? "로그아웃 중…" : "로그아웃"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>
      {embedState ? (
        <YouTubeEmbedModal
          open={embedState.open}
          onOpenChange={(open) => {
            if (!open) setEmbedState(null);
          }}
          videoId={embedState.videoId}
          originalUrl={embedState.originalUrl}
          title={embedState.title}
        />
      ) : null}
      <Toaster richColors position="top-center" />
    </main>
  );
}

// 쿠폰 지갑 카드 — 티켓 디자인. 비주얼 + 정보(1/5). 친구에게 보내기/발신자/거리는 후속.
function CouponClaimCard({
  row,
  active = false,
  innerRef,
  businessLabels,
}: {
  row: CouponClaimRow;
  // active: 방금 담긴 카드 → 입장 애니 + 하이라이트 링. ~2초 후 부모가 해제.
  active?: boolean;
  innerRef?: React.Ref<HTMLLIElement>;
  businessLabels: Record<string, string>;
}) {
  const navigate = useNavigate();

  const coupon = row.coupon;
  const storeName = coupon?.partner?.display_name?.trim() || "매장";
  const storeInitial = storeName.charAt(0) || "?";
  const businessType = coupon?.partner?.business_type ?? null;
  const partnerKind = coupon?.partner?.partner_kind ?? null;
  const isGift = coupon?.coupon_type === "gift";
  const giftItem = coupon?.gift_item?.trim() || "";
  const benefit = isGift && giftItem ? `${giftItem} 증정` : coupon?.title?.trim() || "쿠폰";

  // 표시 상태 — coupon-status.ts 헬퍼 그대로(만료 반영).
  const displayStatus = getCouponDisplayStatus(row);
  const usable = displayStatus === "available" || displayStatus === "expiring";
  const dim = displayStatus === "used" || displayStatus === "expired";

  // 업종(business_categories 라벨 우선, 없으면 partner_kind 보조) · 지역(시/군 짧게)
  const industry = (businessType && businessLabels[businessType]) || partnerKindLabel(partnerKind);
  const region = shortRegion(coupon?.partner?.address);
  const storeSub = [industry, region].filter(Boolean).join(" · ");

  const conditionLine = buildConditionLine(coupon);

  // 기간: 사용가능·곧만료 → "YYYY.MM.DD까지"(valid_until) / 사용완료 → "M.D 사용"(used_at) / 만료 → 생략.
  const periodLine =
    usable && coupon?.valid_until
      ? `${formatDateFull(coupon.valid_until)}까지`
      : displayStatus === "used" && row.used_at
        ? `${formatMonthDayKST(row.used_at)} 사용`
        : null;

  // CTA 라벨 — 캠핑/펜션/숙박류면 예약, 그 외 매장.
  const isLodging = businessType === "stay_leisure" || partnerKind === "campsite";
  const ctaLabel = isLodging ? "예약하고 사용하기" : "매장에서 사용하기";

  function goDetail() {
    void navigate({ to: "/coupon/$claim_code", params: { claim_code: row.claim_code } });
  }

  return (
    <li
      ref={innerRef}
      role="button"
      tabIndex={0}
      onClick={goDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goDetail();
        }
      }}
      className={`block cursor-pointer overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white text-left transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] ${
        dim ? "opacity-50" : ""
      } ${active ? "wallet-card-in ring-2 ring-[#0A0A0A]" : ""}`}
    >
      <div className="px-4 pb-3 pt-4">
        {/* 상단: 상태 배지 | 받은 날짜 (기존 표기 유지: YY.MM.DD HH:mm) */}
        <div className="flex items-center justify-between gap-2">
          <CouponStatusBadge status={displayStatus} />
          {row.issued_at ? (
            <span className="shrink-0 text-xs font-medium text-[#94A3B8]">
              {formatReceivedKST(row.issued_at)} 받음
            </span>
          ) : null}
        </div>

        {/* 매장 — 이니셜 원(teal tint) + 이름 / 업종·지역 */}
        <div className="mt-3 flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#E1F5EE] text-xs font-bold text-[#085041]">
            {storeInitial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#0F172A]">{storeName}</p>
            {storeSub ? <p className="truncate text-xs text-[#94A3B8]">{storeSub}</p> : null}
          </div>
        </div>

        {/* 혜택 */}
        <p className="mt-3 flex items-start gap-1.5 text-[17px] font-extrabold leading-snug text-[#0F172A]">
          {isGift ? <Gift className="mt-0.5 size-[18px] shrink-0" strokeWidth={2.4} /> : null}
          <span className="min-w-0">{benefit}</span>
        </p>

        {/* 조건 1줄 */}
        {conditionLine ? <p className="mt-1 text-xs text-[#94A3B8]">{conditionLine}</p> : null}

        {/* 기간 */}
        {periodLine ? <p className="mt-1.5 text-xs text-[#94A3B8]">{periodLine}</p> : null}
      </div>

      {/* CTA (사용 가능/곧 만료만) — 점선 perforation + 노치 + 검정 버튼. 사용완료/만료는 히스토리(CTA 없음). */}
      {usable ? (
        <>
          <div className="relative" aria-hidden>
            <div className="mx-4 border-t border-dashed border-[#E2E8F0]" />
            <span className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F1F5F9]" />
            <span className="pointer-events-none absolute right-0 top-1/2 size-4 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F1F5F9]" />
          </div>
          <div className="px-4 pb-4 pt-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goDetail();
              }}
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#0A0A0A] px-4 text-sm font-bold text-white hover:bg-[#171717]"
            >
              {ctaLabel}
            </button>
          </div>
        </>
      ) : null}
    </li>
  );
}

// 상태 배지 — 사용가능 초록 / 곧만료 amber / 사용완료·만료 회색. 라벨은 couponStatusLabel.
function CouponStatusBadge({ status }: { status: CouponDisplayStatus }) {
  const cls =
    status === "available"
      ? "bg-[#ECFDF5] text-[#059669]"
      : status === "expiring"
        ? "bg-[#FFFBEB] text-[#B45309]"
        : "bg-[#F5F5F5] text-[#94A3B8]";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}
    >
      {couponStatusLabel(status)}
    </span>
  );
}

// 짧은 지역 — address 에서 시/군/구 토큰(없으면 첫 토큰).
function shortRegion(address: string | null | undefined): string | null {
  const a = address?.trim();
  if (!a) return null;
  const tokens = a.split(/\s+/);
  return tokens.find((t) => /[시군구]$/.test(t)) ?? tokens[0] ?? null;
}

// 조건 1줄 — conditions.min_amount("N원 이상") + per_user_limit("1인 N회"). 없으면 null.
function buildConditionLine(coupon: CouponClaimRow["coupon"]): string | null {
  if (!coupon) return null;
  const parts: string[] = [];
  const min =
    typeof coupon.conditions?.min_amount === "number" ? coupon.conditions.min_amount : null;
  if (min && min > 0) parts.push(`${min.toLocaleString("ko-KR")}원 이상`);
  const per = typeof coupon.per_user_limit === "number" ? coupon.per_user_limit : null;
  if (per && per > 0) parts.push(`1인 ${per}회`);
  return parts.length ? parts.join(" · ") : null;
}

// issued_at → "YY.MM.DD HH:mm" (Asia/Seoul). 받은 날짜 기존 표기.
function formatReceivedKST(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}

// used_at → "M.D" (Asia/Seoul). 사용일 표기.
function formatMonthDayKST(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${get("month")}.${get("day")}`;
}

// valid_until → "YYYY.MM.DD" (Asia/Seoul).
function formatDateFull(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")}`;
}

// partner_kind enum → 손님 친화 한글 라벨. 내부 용어 노출 금지.
function partnerKindLabel(kind: string | null | undefined): string {
  switch (kind) {
    case "campsite":
      return "캠핑장";
    case "store":
      return "매장";
    case "brand":
      return "브랜드";
    case "ticket_seller":
      return "티켓";
    case "campaign_org":
      return "캠페인";
    case "creator_owned":
      return "크리에이터";
    default:
      return "기타";
  }
}

// pb/biz 등급 판정 — verification_status='approved' 면 biz(인증), 아니면 pb(공개).
function makerTier(maker: MakerInfo): "pb" | "biz" {
  return maker.verification_status === "approved" ? "biz" : "pb";
}

// 메이커 등급 칩 — pb: 틸 톤 / biz: 퍼플 톤. 11px, radius-md, 대문자 라벨.
function MakerTierChip({ tier }: { tier: "pb" | "biz" }) {
  const cls = tier === "biz" ? "bg-[#F0EDFB] text-[#4C3FA0]" : "bg-[#E1F5EE] text-[#0E4D42]";
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold tracking-[0.02em] ${cls}`}
    >
      {tier.toUpperCase()}
    </span>
  );
}

// 메이커 1줄 행 — 이니셜 아바타 + 이름(+등급 칩) + 부제(설명 우선, 없으면 업종 라벨) + 우측 액션.
// partners 에 로고 컬럼이 없어 display_name 첫 글자 이니셜로 표시(쿠폰 지갑 패턴).
function MakerRow({ maker, right }: { maker: MakerInfo; right?: React.ReactNode }) {
  const name = maker.display_name?.trim() || "메이커";
  const description = maker.metadata?.description?.trim();
  const subtitle = description || partnerKindLabel(maker.partner_kind);
  const initial = name.charAt(0) || "?";
  const tier = makerTier(maker);

  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar className="size-10 shrink-0">
        <AvatarFallback className="bg-[#F1F5F9] text-base font-bold text-[#0F172A]">
          {initial}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-base font-bold text-[#0F172A]">{name}</p>
          <MakerTierChip tier={tier} />
        </div>
        <p className="mt-0.5 truncate text-sm font-medium text-[#64748B]">{subtitle}</p>
      </div>
      {right}
    </li>
  );
}

function SectionCard({
  Icon,
  title,
  children,
}: {
  Icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="size-4 text-[#0A0A0A]" strokeWidth={2} />
        <h3 className="text-sm font-semibold text-[#0A0A0A]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-[#64748B]">{text}</p>;
}

function numFmt(n: number | null | undefined): string {
  return (typeof n === "number" ? n : 0).toLocaleString();
}
