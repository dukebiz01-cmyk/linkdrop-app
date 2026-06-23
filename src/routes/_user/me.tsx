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
  Pencil,
  Package,
} from "lucide-react";
// Wallet = 쿠폰 지갑 섹션 헤더. Send = 받은 쿠폰 메이커, Heart = 구독한 메이커. Gift = 증정 쿠폰 라벨.
import { Toaster } from "@/components/ui/sonner";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { shareToKakao } from "@/lib/kakao";
import { reshareDrop } from "@/lib/reshare-drop";
import { getSentDrops } from "@/lib/feed-queries";
import { DropFeedCard } from "@/components/drop-feed-card";
import type { DropFeedItem } from "@/components/home-page";
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
  // 재공유(3/5) — claim 의 출처 share_event(부모). 없으면 친구에게 보내기 버튼 미표시.
  // 발신자(4/5) — sender_user_id. 이름은 public_profiles 별도 조회(senderNames).
  share_event_id: string | null;
  share_event: {
    share_uuid: string | null;
    share_code: string | null;
    info_drop_id: string | null;
    sender_user_id: string | null;
  } | null;
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
      owner_user_id: string | null; // 매장 직접 판별(sender==owner)
    } | null;
  } | null;
};

// get_my_wallet RPC(setof jsonb) flat row — CouponClaimRow 중첩 구조로 reshape 전 형태.
type WalletRpcRow = {
  id: string;
  coupon_id: string;
  status: string;
  issued_at: string | null;
  used_at: string | null;
  expires_at: string | null;
  claim_code: string;
  share_event_id: string | null;
  share_uuid: string | null;
  share_code: string | null;
  info_drop_id: string | null;
  sender_user_id: string | null;
  coupon_title: string | null;
  coupon_type: string | null;
  gift_item: string | null;
  valid_until: string | null;
  conditions: { min_amount?: number; [k: string]: unknown } | null;
  per_user_limit: number | null;
  partner_display_name: string | null;
  business_type: string | null;
  partner_kind: string | null;
  partner_address: string | null;
  partner_owner_user_id: string | null;
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
// A안 — 필터는 3탭(사용가능/사용완료/만료지남). '곧 만료'(expiring)는 독립 탭이 아니라
//   '사용가능' 탭 안에서 카드 배지로만 구분(getCouponDisplayStatus 재사용).
type CouponFilter = "available" | "used" | "expired";

type MePageData = {
  userId: string | null;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  isBusiness: boolean;
  myDrops: MyDropRow[];
  // 내가(로그인 유저가) sender 로 공유한 카드 — 홈에서 이동(getSentDrops 재사용).
  sentDrops: DropFeedItem[];
  coupons: CouponClaimRow[];
  // 업종 코드 → 한글 라벨 (business_categories depth=1, 등록화면 매핑 재사용).
  businessLabels: Record<string, string>;
  // 발신자 id → display_name (public_profiles, RLS 우회 뷰). 발신자 라벨용.
  senderNames: Record<string, string>;
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
      sentDrops: [],
      coupons: [],
      businessLabels: {},
      senderNames: {},
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

    // 보낸 카드 — 내가 sender 로 공유한 카드(홈에서 이동). getSentDrops 재사용(신규 백엔드 0).
    const sentDrops = await getSentDrops(supabase, userId);

    // 받은 혜택 — get_my_wallet RPC(SECURITY DEFINER, auth.uid() 본인 claim만 RLS 우회).
    //   기존 임베드(coupons/partners/share_events) 가 RLS 로 깨지던 문제 해소. setof jsonb →
    //   flat 객체 배열을 기존 CouponClaimRow 중첩 구조로 reshape(카드 코드 그대로 동작).
    //   used/만료 포함·issued_at 최신순은 RPC 가 보장.
    const { data: walletRows, error: walletErr } = await supabase.rpc("get_my_wallet");
    if (walletErr) console.error("[me] get_my_wallet 실패:", walletErr);
    const coupons: CouponClaimRow[] = ((walletRows as WalletRpcRow[] | null) ?? []).map((r) => ({
      id: r.id,
      coupon_id: r.coupon_id,
      status: r.status,
      issued_at: r.issued_at,
      used_at: r.used_at,
      expires_at: r.expires_at,
      claim_code: r.claim_code,
      share_event_id: r.share_event_id,
      share_event: r.share_event_id
        ? {
            share_uuid: r.share_uuid,
            share_code: r.share_code,
            info_drop_id: r.info_drop_id,
            sender_user_id: r.sender_user_id,
          }
        : null,
      coupon:
        r.coupon_title != null
          ? {
              title: r.coupon_title,
              coupon_type: r.coupon_type,
              gift_item: r.gift_item,
              valid_until: r.valid_until,
              conditions: r.conditions,
              per_user_limit: r.per_user_limit,
              partner: {
                display_name: r.partner_display_name ?? "",
                business_type: r.business_type,
                partner_kind: r.partner_kind,
                address: r.partner_address,
                owner_user_id: r.partner_owner_user_id,
              },
            }
          : null,
    }));

    // 업종 한글 라벨 — 등록화면과 동일 매핑(business_categories depth=1) 재사용. 카드의 '업종' 표시용.
    const { data: majors } = await supabase
      .from("business_categories")
      .select("code, label")
      .eq("depth", 1);
    const businessLabels: Record<string, string> = {};
    for (const m of (majors as { code: string; label: string }[] | null) ?? []) {
      businessLabels[m.code] = m.label;
    }

    // 발신자 이름 — share_event.sender_user_id 의 display_name. profiles 는 self-read 라
    //   타인 이름은 public_profiles 뷰(RLS 우회)로 별도 조회. 발신자 라벨용.
    const senderIds = Array.from(
      new Set(
        coupons.map((c) => c.share_event?.sender_user_id).filter((x): x is string => Boolean(x)),
      ),
    );
    const senderNames: Record<string, string> = {};
    if (senderIds.length > 0) {
      const { data: pp } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", senderIds);
      for (const r of (pp as { id: string; display_name: string | null }[] | null) ?? []) {
        if (r.display_name) senderNames[r.id] = r.display_name;
      }
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
      sentDrops,
      coupons,
      businessLabels,
      senderNames,
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

        {/* 내 주문 — 손님 선주문 상태(읽기전용) 진입. "내 매장" 패턴 미러(additive). */}
        <SectionCard Icon={Package} title="내 주문">
          <button
            type="button"
            onClick={() => navigate({ to: "/me-orders" })}
            className="flex w-full min-h-[44px] items-center justify-between rounded-xl bg-[#F8FAFC] px-4 py-3 text-sm font-semibold text-[#0F172A] hover:bg-[#F1F5F9]"
          >
            <span>주문 상태 보기</span>
            <ChevronRight className="size-4 text-[#64748B]" strokeWidth={2} />
          </button>
        </SectionCard>

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
                <span className="font-semibold"> · 곧 만료 {expiringCount}개</span>
              ) : null}
            </p>
          </div>

          {/* 상태 필터 칩 — 선택=teal/흰, 그 외=아웃라인/회색 */}
          {data.coupons.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {(
                [
                  { key: "available", label: "사용 가능", count: usableCount },
                  { key: "used", label: "사용 완료", count: usedCount },
                  { key: "expired", label: "만료 지남", count: expiredCount },
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
                    senderNames={data.senderNames}
                    userId={data.userId}
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
        <SectionCard Icon={FileText} title="만든 카드">
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
                    {/* 수정 — curator_message 라이트 편집. share_uuid 있을 때만(owner 전원). */}
                    {d.share_uuid ? (
                      <button
                        type="button"
                        onClick={() =>
                          navigate({
                            to: "/card-edit/$shareUuid",
                            params: { shareUuid: d.share_uuid! },
                          })
                        }
                        className="mt-2 flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[#0A0A0A] hover:underline"
                      >
                        <Pencil className="size-4" strokeWidth={2} />
                        수정
                        <ChevronRight className="size-4" strokeWidth={2} />
                      </button>
                    ) : null}
                    {/* 재발송(공유) — 기존 카드 카톡 재공유. share_uuid 있을 때만(owner 전원). reshareDrop 재사용. */}
                    {d.share_uuid ? (
                      <button
                        type="button"
                        onClick={() =>
                          void reshareDrop({
                            shareUuid: d.share_uuid!,
                            title: d.source?.title ?? "(제목 없음)",
                            imageUrl: d.source?.thumbnail_url ?? undefined,
                            purpose: d.purpose ?? undefined,
                          })
                        }
                        className="mt-2 flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[#0A0A0A] hover:underline"
                      >
                        <Send className="size-4" strokeWidth={2} />
                        공유
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

        {/* ⑤ 보낸 카드 — 내가 공유한 카드(홈에서 이동). 카드에서 바로 재공유(reshareDrop).
            더보기 토글은 후속 — 지금은 전부 렌더. sentDrops.length > 0 게이트(빈 박스 방지). */}
        {data.sentDrops.length > 0 ? (
          <SectionCard Icon={FileText} title="보낸 카드">
            <div className="space-y-3">
              {data.sentDrops.map((drop) => (
                <DropFeedCard
                  key={drop.shareUuid}
                  {...drop}
                  onClick={() =>
                    void navigate({ to: "/d/$shareUuid", params: { shareUuid: drop.shareUuid } })
                  }
                  onCtaClick={() =>
                    void navigate({ to: "/d/$shareUuid", params: { shareUuid: drop.shareUuid } })
                  }
                  onShare={() =>
                    void reshareDrop({
                      shareUuid: drop.shareUuid,
                      title: drop.title,
                      imageUrl: drop.videoThumbnailUrl,
                      purpose: drop.intent,
                    })
                  }
                />
              ))}
            </div>
          </SectionCard>
        ) : null}

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

// 쿠폰 지갑 카드 — 티켓 디자인(1/5) + 친구에게 보내기 재공유(3/5). 발신자 라벨/거리는 후속.
function CouponClaimCard({
  row,
  active = false,
  innerRef,
  businessLabels,
  senderNames,
  userId,
}: {
  row: CouponClaimRow;
  // active: 방금 담긴 카드 → 입장 애니 + 하이라이트 링. ~2초 후 부모가 해제.
  active?: boolean;
  innerRef?: React.Ref<HTMLLIElement>;
  businessLabels: Record<string, string>;
  senderNames: Record<string, string>;
  userId: string | null;
}) {
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);

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

  // 발신자 라벨(4/5) — sender==owner → 매장 직접 / sender(친구) → 공유 / 없음·해석불가 → 추천.
  const senderId = row.share_event?.sender_user_id ?? null;
  const ownerId = coupon?.partner?.owner_user_id ?? null;
  const senderLabel: { kind: "store" | "friend" | "platform"; text: string } = (() => {
    if (senderId && ownerId && senderId === ownerId) {
      return { kind: "store", text: `${storeName}${josaIGa(storeName)} 보낸 혜택` };
    }
    if (senderId) {
      const name = senderNames[senderId];
      if (name) return { kind: "friend", text: `${name}님이 공유한 혜택` };
    }
    return { kind: "platform", text: "LinkDrop 추천 혜택" };
  })();

  function goDetail() {
    void navigate({ to: "/coupon/$claim_code", params: { claim_code: row.claim_code } });
  }

  // 친구에게 보내기 = 출처 드롭 재공유. claim 의 share_event(출처) 가 있어야만 노출.
  const se = row.share_event;
  const canReshare = usable && Boolean(se?.info_drop_id || se?.share_uuid || se?.share_code);

  // 출처 드롭을 카카오로 재공유(보낸 사람=현재 유저). 새 share edge 실패 시 원본 링크 폴백.
  async function handleSend(e: React.MouseEvent) {
    e.stopPropagation();
    if (sending) return;
    setSending(true);
    try {
      let link: string | null = null;
      // 1) 새 share edge (sender=나, parent=claim 의 출처 share_event) → drop.how/{code}
      if (se?.info_drop_id && row.share_event_id) {
        try {
          const { data: edgeRows, error: edgeErr } = await getSupabase().rpc(
            "ld_create_share_edge_v3",
            {
              p_info_drop_id: se.info_drop_id,
              p_sender_user_id: userId,
              p_channel: "kakao",
              p_parent_share_event_id: row.share_event_id,
            },
          );
          if (!edgeErr) {
            const r = Array.isArray(edgeRows) ? edgeRows[0] : edgeRows;
            const code =
              r && typeof r === "object" && "share_code" in r
                ? String((r as { share_code: unknown }).share_code ?? "")
                : "";
            if (code) link = `https://drop.how/${code}`;
          } else {
            console.warn("[me] reshare RPC failed:", edgeErr);
          }
        } catch (err) {
          console.warn("[me] reshare RPC unexpected:", err);
        }
      }
      // 2) 폴백 — 원본 share 링크(보낸 사람 기록 없음)
      if (!link) {
        link = se?.share_code
          ? `https://drop.how/${se.share_code}`
          : se?.share_uuid
            ? `https://app.drop.how/d/${se.share_uuid}`
            : null;
      }
      if (!link) {
        toast.error("공유 링크를 만들 수 없어요.");
        return;
      }
      // 클립보드 복사 보장 + 카카오 best-effort(실패해도 복사로 충분).
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        /* noop */
      }
      const res = await shareToKakao({
        title: `${storeName}의 혜택`,
        description: benefit,
        imageUrl: "",
        linkUrl: link,
        buttons: [{ title: "혜택 받기", link }],
      });
      toast.success(res.ok ? "친구에게 보냈어요." : "링크를 복사했어요. 친구에게 붙여넣어 주세요.");
    } catch (err) {
      console.error("[me] 친구에게 보내기 실패:", err);
      toast.error("공유에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
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

        {/* 발신자 라벨 — 매장 직접 / 친구 공유 / 추천. 모든 상태(dim 카드면 같이 흐림). */}
        <div className="mt-2.5">
          <SenderPill label={senderLabel} />
        </div>
      </div>

      {/* CTA (사용 가능/곧 만료만) — 점선 perforation + 노치 + 검정 버튼. 사용완료/만료는 히스토리(CTA 없음). */}
      {usable ? (
        <>
          <div className="relative" aria-hidden>
            <div className="mx-4 border-t border-dashed border-[#E2E8F0]" />
            <span className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F1F5F9]" />
            <span className="pointer-events-none absolute right-0 top-1/2 size-4 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F1F5F9]" />
          </div>
          <div className="flex gap-2 px-4 pb-4 pt-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goDetail();
              }}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#0A0A0A] px-4 text-sm font-bold text-white hover:bg-[#171717]"
            >
              {ctaLabel}
            </button>
            {/* 친구에게 보내기 = 출처 드롭 재공유. 아웃라인(보더/투명/검정 글자). 출처 있을 때만. */}
            {canReshare ? (
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D4D4D4] bg-white px-3 text-sm font-bold text-[#0A0A0A] hover:bg-[#FAFAFA] disabled:opacity-50"
              >
                <Send className="size-4" strokeWidth={2} />
                친구에게 보내기
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </li>
  );
}

// 받침 유무로 이/가 선택(한글 음절만). 그 외는 '이'.
function josaIGa(word: string): string {
  const w = word.trim();
  const last = w.charCodeAt(w.length - 1);
  if (last >= 0xac00 && last <= 0xd7a3) {
    return (last - 0xac00) % 28 !== 0 ? "이" : "가";
  }
  return "이";
}

// 발신자 pill — 친구 공유=teal+사람 / 매장 직접=회색+가게 / 추천=회색(아이콘 없음).
function SenderPill({ label }: { label: { kind: "store" | "friend" | "platform"; text: string } }) {
  if (label.kind === "friend") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[11px] font-bold text-[#085041]">
        <User className="size-3" strokeWidth={2.2} />
        {label.text}
      </span>
    );
  }
  if (label.kind === "store") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[11px] font-bold text-[#64748B]">
        <Store className="size-3" strokeWidth={2.2} />
        {label.text}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[11px] font-bold text-[#94A3B8]">
      {label.text}
    </span>
  );
}

// 상태 배지 — 사용가능 초록 / 곧만료 amber / 사용완료·만료 회색. 라벨은 couponStatusLabel.
function CouponStatusBadge({ status }: { status: CouponDisplayStatus }) {
  const cls =
    status === "available"
      ? "bg-[#ECFDF5] text-[#059669]"
      : status === "expiring"
        ? "bg-[#0A0A0A] text-white" // A안 — 곧 만료 배지 = 블랙 미니멀(신규 색·빨강 없음)
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
