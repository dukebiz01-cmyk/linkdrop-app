import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { toast } from "sonner";
import {
  User,
  Gift,
  Heart,
  FileText,
  Store,
  LogOut,
  ChevronRight,
  Wallet,
  Send,
  Pencil,
  Package,
  Settings,
  Diamond,
  Clock,
  Bell,
  X,
  Building2,
  TicketPercent,
  Sparkles,
  Globe,
  ShieldCheck,
  HelpCircle,
  ShoppingBag,
} from "lucide-react";
// Wallet = 쿠폰 지갑 섹션 헤더. Send = 받은 쿠폰 메이커, Heart = 구독한 메이커. Gift = 증정 쿠폰 라벨.
import { Toaster } from "@/components/ui/sonner";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { shareToKakao } from "@/lib/kakao";
import {
  getCouponDisplayStatus,
  isCouponUsable,
  couponStatusLabel,
  getExpiryCountdown,
  type CouponDisplayStatus,
} from "@/lib/coupon-status";
import { CashSection } from "@/components/wallet/CashSection";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
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

// 유튜브 썸네일 URL 에서 videoId 추출 — src/lib/video-id.ts 로 공용화 이동(import 로 대체).

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
  coupons: CouponClaimRow[];
  // 업종 코드 → 한글 라벨 (business_categories depth=1, 등록화면 매핑 재사용).
  businessLabels: Record<string, string>;
  // 발신자 id → display_name (public_profiles, RLS 우회 뷰). 발신자 라벨용.
  senderNames: Record<string, string>;
  // 현재 구독(active) 중인 메이커.
  subscribedMakers: MakerInfo[];
  // v0 히어로 자산요약 — 캐시 잔액(유상+무상 스냅샷, 표시용). CashSection 이 실시간 소스.
  cashBalance: number;
  // v0 히어로 보조스탯 — 내가 sender 로 보낸(공유한) 카드 수.
  sentCount: number;
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
      senderNames: {},
      subscribedMakers: [],
      cashBalance: 0,
      sentCount: 0,
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

    // v0 히어로 자산요약 — 캐시 잔액(본인 SELECT, 표시 스냅샷). CashSection 이 실시간 갱신 소스.
    //   결제 로직 무관(순수 조회). 조회 실패 = 0(히어로만 영향, 다른 섹션 무관).
    const { data: cashRow } = await supabase
      .from("cash_wallets")
      .select("paid_balance, bonus_balance")
      .eq("user_id", userId)
      .maybeSingle();
    const cashBalance =
      ((cashRow as { paid_balance?: number; bonus_balance?: number } | null)?.paid_balance ?? 0) +
      ((cashRow as { paid_balance?: number; bonus_balance?: number } | null)?.bonus_balance ?? 0);

    // v0 히어로 보조스탯 — 내가 보낸(공유한) 카드 수(share_events sender=본인 count).
    //   select('id') — '*' 는 v2.4 컬럼레벨 grant(service_role 전용 PII/fraud 컬럼)에 걸려 403.
    const { count: sentCountRaw, error: sentCountErr } = await supabase
      .from("share_events")
      .select("id", { count: "exact", head: true })
      .eq("sender_user_id", userId);
    if (sentCountErr) console.warn("[me] sentCount query failed:", sentCountErr.message);
    const sentCount = sentCountRaw ?? 0;

    return {
      userId,
      email,
      displayName: profile?.display_name ?? "",
      avatarUrl: profile?.avatar_url ?? null,
      isBusiness: Boolean(isBusiness),
      myDrops,
      coupons,
      businessLabels,
      senderNames,
      subscribedMakers,
      cashBalance,
      sentCount,
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

// V4 내비 카드 — 아이콘칩 + 제목/부제 + chevron. 행동(onClick)은 호출부가 주입.
function NavCard({
  icon: Icon,
  title,
  subtitle,
  onClick,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-[#E8EDF3] bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:shadow-[0_10px_24px_rgba(15,23,42,0.09)]"
    >
      <span className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#0F172A] transition-colors group-hover:bg-[#EEF3FE] group-hover:text-[#2563EB]">
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-[#0F172A]">{title}</div>
        <div className="truncate text-[11px] text-[#94A3B8]">{subtitle}</div>
      </div>
      <ChevronRight className="size-4 flex-shrink-0 text-[#CBD5E1]" />
    </button>
  );
}

// v0 me 마크 — 사람(내 페이지) 인라인 SVG(외부 아이콘 대신, v0 헤더 비주얼 그대로).
function MeMark({ className = "h-[22px] w-[22px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3.9" fill="#0F172A" />
      <path
        d="M4.6 19.4a7.4 7.4 0 0 1 14.8 0 1.3 1.3 0 0 1-1.3 1.3H5.9a1.3 1.3 0 0 1-1.3-1.3Z"
        fill="#0F172A"
      />
    </svg>
  );
}

function MePage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  // 설정 — 헤더 기어 → 인라인 아코디언(#418, 포털/시트 아님) 개폐.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 담기는 연출 — claim 직후 해당 카드 강조(입장 애니 + 하이라이트 링) ~2초.
  const [highlightCode, setHighlightCode] = useState<string | null>(null);
  const claimedCardRef = useRef<HTMLLIElement | null>(null);
  const claimedHandledRef = useRef(false);
  // 작업 C: 내 카드 접기/펼치기 (상위 2개 + 더보기/접기 토글)
  // 명시적 구독 — subscribedMakers 를 로컬 상태로 들고 구독/취소 시 reactive 갱신.
  const [subscribedMakers, setSubscribedMakers] = useState<MakerInfo[]>(data.subscribedMakers);
  const [busyMakerId, setBusyMakerId] = useState<string | null>(null);

  // 쿠폰 지갑 필터 칩 — 기본 '사용 가능'(usable). 클라이언트 로컬 state(서버 호출 없음).
  const [couponFilter, setCouponFilter] = useState<CouponFilter>("available");
  // 내지갑 상위 탭 — 캐시 / 쿠폰 / 드로피(드로피=빈 상태 placeholder). 기본 캐시. 클라 로컬 state.
  const [walletTab, setWalletTab] = useState<"cash" | "coupon" | "dropy">("cash");

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
    <main className="min-h-screen overflow-x-hidden bg-[#F6F8FB] tracking-ko pb-24">
      {/* 헤더 — v0: MeMark + "내 페이지" + 🔔(→/inbox) + ⚙️(설정 인라인 토글). */}
      <header className="flex items-center justify-between px-4 pb-2 pt-5">
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-9 items-center justify-center rounded-xl bg-[#F1F5F9]"
            aria-hidden="true"
          >
            <MeMark className="h-[22px] w-[22px]" />
          </span>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">내 페이지</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate({ to: "/inbox" })}
            aria-label="알림함"
            className="flex size-9 items-center justify-center rounded-full bg-white text-[#475569] shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-inset ring-[#EAEEF3] transition-colors hover:text-[#0F172A] active:scale-95"
          >
            <Bell className="size-[18px]" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="설정"
            aria-expanded={settingsOpen}
            className="flex size-9 items-center justify-center rounded-full bg-white text-[#475569] shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-inset ring-[#EAEEF3] transition-colors hover:text-[#0F172A] active:scale-95"
          >
            <Settings className="size-[18px]" strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* 설정 — 헤더 기어 아래 인라인 아코디언(#418: 바텀시트/포털 아님, grid 0fr→1fr).
          로그아웃·버전표기는 본문 최하단으로 이동(v0-44 정본 위치) — 여기엔 설정 목록만. */}
      <div
        className="grid px-4 transition-all duration-300 ease-out"
        style={{ gridTemplateRows: settingsOpen ? "1fr" : "0fr" }}
        aria-hidden={!settingsOpen}
      >
        <div className="overflow-hidden">
          <div className="mt-2 rounded-3xl bg-white px-5 pb-6 pt-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-inset ring-[#EAEEF3]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[17px] font-bold tracking-[-0.01em] text-[#0F172A]">설정</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label="닫기"
                className="flex size-8 items-center justify-center rounded-full text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                <X className="size-5" strokeWidth={2.25} />
              </button>
            </div>

            {/* v0-44 SettingsSheet 톤 — 설정 항목 리스트(인라인, #418: 포털 아님). 각 항목 → 설정 서브페이지. */}
            <div className="mb-3 flex flex-col">
              {(
                [
                  { icon: Globe, label: "언어", sub: "한국어", to: "/settings/language" as const },
                  {
                    icon: Bell,
                    label: "알림 설정",
                    sub: "푸시·이메일",
                    to: "/settings/notifications" as const,
                  },
                  {
                    icon: ShieldCheck,
                    label: "개인정보 보호",
                    sub: "보안·데이터",
                    to: "/settings/privacy" as const,
                  },
                ]
              ).map((row) => {
                const RowIcon = row.icon;
                return (
                  <button
                    key={row.label}
                    type="button"
                    onClick={() => navigate({ to: row.to })}
                    className="flex min-h-[52px] items-center justify-between rounded-xl px-1 transition-colors hover:bg-[#F1F5F9]"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-[#F1F5F9]">
                        <RowIcon className="size-[18px] text-[#475569]" strokeWidth={2} />
                      </span>
                      <span className="text-[14px] font-medium text-[#0F172A]">{row.label}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-[12.5px] font-medium text-[#94A3B8]">{row.sub}</span>
                      <ChevronRight className="size-4 text-[#CBD5E1]" />
                    </span>
                  </button>
                );
              })}
              {/* 도움말·문의 — 서브페이지 미신설(라우트 없음). 죽은 탭·가짜 이동 방지: 준비 중 비활성 표기. */}
              <div className="flex min-h-[52px] items-center justify-between rounded-xl px-1 opacity-60">
                <span className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-[#F1F5F9]">
                    <HelpCircle className="size-[18px] text-[#475569]" strokeWidth={2} />
                  </span>
                  <span className="text-[14px] font-medium text-[#0F172A]">도움말 · 문의</span>
                </span>
                <span className="text-[11px] font-medium text-[#94A3B8]">준비 중</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 pt-4">
        {/* ① 내 정보 — V4 잉크 히어로(아바타 + 이름/이메일 + 편집 + 자산요약 스트립). 데이터·편집 핸들러 보존. */}
        <section className="overflow-hidden rounded-3xl bg-[#0F172A] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.22)]">
          <div className="flex items-center gap-3.5">
            {data.avatarUrl ? (
              <img
                src={data.avatarUrl}
                alt="프로필 사진"
                className="size-14 flex-shrink-0 rounded-full object-cover ring-2 ring-white/15 ring-offset-2 ring-offset-[#0F172A]"
              />
            ) : (
              <div className="flex size-14 flex-shrink-0 items-center justify-center rounded-full bg-white text-[20px] font-bold text-[#0F172A] ring-2 ring-white/15 ring-offset-2 ring-offset-[#0F172A]">
                {getInitial(data.displayName, data.email)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[17px] font-bold text-white">
                  {data.displayName.trim() || "이름을 등록해 보세요"}
                </span>
                {data.isBusiness ? (
                  <span className="flex-shrink-0 rounded-full bg-[#2563EB] px-2 py-0.5 text-[10px] font-bold text-white">
                    비즈
                  </span>
                ) : null}
              </div>
              {data.email ? (
                <div className="mt-1 truncate text-[12.5px] text-[#CBD5E1]">{data.email}</div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: "/profile" })}
              className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
              aria-label="프로필 편집"
            >
              <Pencil className="size-4" strokeWidth={2} />
            </button>
          </div>

          {/* 자산요약 스트립(v0) — 자산 [캐시/드로피/쿠폰] 탭 이동 버튼. §0: 드로피 = "준비중"(숫자 금지).
              캐시 = 로더 스냅샷(실시간 소스는 캐시 탭 CashSection). 쿠폰 = 사용가능 수. */}
          <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-inset ring-white/10">
            {(
              [
                { key: "cash", label: "캐시", value: data.cashBalance.toLocaleString(), accent: true, ready: true },
                { key: "dropy", label: "드로피", value: "준비중", accent: false, ready: false },
                { key: "coupon", label: "쿠폰", value: String(usableCount), accent: false, ready: true },
              ] as const
            ).map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setWalletTab(s.key)}
                className={`flex flex-col items-center py-3.5 transition-colors hover:bg-white/[0.06] active:bg-white/10 ${i > 0 ? "border-l border-white/10" : ""}`}
              >
                <span
                  className={`font-bold leading-none tabular-nums ${s.ready ? "text-[20px]" : "text-[13px]"} ${s.accent ? "text-[#60A5FA]" : "text-white"}`}
                >
                  {s.value}
                </span>
                <span className="mt-2 flex items-center gap-0.5 text-[11.5px] font-semibold tracking-wide text-[#B6C2D2]">
                  {s.label}
                  <ChevronRight className="size-3 text-[#7C8BA1]" strokeWidth={2.5} />
                </span>
              </button>
            ))}
          </div>

          {/* 보조 스탯(v0) — 만든 카드 / 보낸 카드 / 구독. */}
          <div className="mt-3 grid grid-cols-3">
            {(
              [
                { key: "made", label: "만든 카드", value: data.myDrops.length },
                { key: "sent", label: "보낸 카드", value: data.sentCount },
                { key: "sub", label: "구독", value: subscribedMakers.length },
              ] as const
            ).map((s, i) => (
              <div
                key={s.key}
                className={`flex items-center justify-center gap-1.5 py-0.5 ${i > 0 ? "border-l border-white/10" : ""}`}
              >
                <span className="text-[13px] font-bold tabular-nums text-white">{s.value}</span>
                <span className="text-[11px] font-medium text-[#8A99AD]">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* v0-44 정본 L815~823 구조: 비즈=[내 매장 + 판매관리] 2-col / 비즈아님=[내 주문].
            ★ 진입 카드만(대상 페이지 무접촉). 내매장=/partner (트랙2 store-hub 정식, 6d72fa7).
            판매관리=/partner/products (판매관리 3탭 정식, 6d72fa7). */}
        <div className={`grid gap-3 ${data.isBusiness ? "grid-cols-2" : "grid-cols-1"}`}>
          {data.isBusiness ? (
            <>
              <NavCard
                icon={Building2}
                title="내 매장"
                subtitle="매출·프로모션·예약"
                onClick={() => navigate({ to: "/partner" })}
              />
              <NavCard
                icon={Package}
                title="판매관리"
                subtitle="상품·주문 관리"
                onClick={() => navigate({ to: "/partner/products" })}
              />
            </>
          ) : (
            <NavCard
              icon={Package}
              title="내 주문"
              subtitle="주문·예약 내역"
              onClick={() => navigate({ to: "/me-orders" })}
            />
          )}
        </div>

        {/* 구독 요금제(비즈 전용, →/subscribe) — /subscribe beforeLoad 가 파트너오너 아니면 /home 리다이렉트하므로
            노출도 isBusiness 게이트(비사업자에겐 dead-end 방지). 진입 카드만 — 요금제 화면 무접촉. */}
        {data.isBusiness ? (
          <NavCard
            icon={Sparkles}
            title="구독 요금제"
            subtitle="비즈니스 구독 · 월 자동결제"
            onClick={() => navigate({ to: "/subscribe" })}
          />
        ) : null}

        {/* ② 내 혜택 지갑 — 행동형 헤더 + 상태 필터 칩(2/5). 카드(1/5)·정렬·다른 섹션 무수정.
            필터는 클라이언트 로컬 state, 정렬은 loader 최신순 유지. */}
        <section className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          {/* 헤더 — v0 아이콘칩 + "내 지갑". */}
          <div className="mb-3.5 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#EEF3FE]">
              <Wallet className="size-4 text-[#2563EB]" strokeWidth={2} />
            </span>
            <h3 className="text-[14px] font-bold tracking-[-0.01em] text-[#0F172A]">내 지갑</h3>
          </div>

          {/* 세그먼트(v0) — 캐시 / 드로피 / 쿠폰(사용가능 수 뱃지). 흰칩 선택. */}
          <div className="mb-4 flex rounded-xl bg-[#F1F5F9] p-1">
            {(
              [
                { key: "cash", label: "캐시", n: undefined },
                { key: "dropy", label: "드로피", n: undefined },
                { key: "coupon", label: "쿠폰", n: usableCount },
              ] as const
            ).map((tab) => {
              const selected = walletTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setWalletTab(tab.key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold transition-all ${
                    selected
                      ? "bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(15,23,42,0.1)]"
                      : "text-[#64748B] hover:text-[#475569]"
                  }`}
                >
                  {tab.label}
                  {tab.n !== undefined && tab.n > 0 ? (
                    <span
                      className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums ${
                        selected ? "bg-[#2563EB] text-white" : "bg-[#E2E8F0] text-[#64748B]"
                      }`}
                    >
                      {tab.n}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* CASH-c4 — cash 섹션(잔액·충전·내역·고지). 캐시 탭 콘텐츠. */}
          {walletTab === "cash" && <CashSection />}

          {walletTab === "coupon" && (
            <>
              {/* 부제 — 원본 무수정 이동 */}
              <p className="mt-1 text-sm font-medium text-[#64748B]">
                쓸 수 있는 혜택 {usableCount}개
                {expiringCount > 0 ? (
                  <span className="font-semibold"> · 곧 만료 {expiringCount}개</span>
                ) : null}
              </p>

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
                    className={`inline-flex min-h-[32px] items-center rounded-lg px-3 text-[11.5px] font-semibold transition-all ${
                      selected
                        ? "bg-[#0F172A] text-white shadow-[0_2px_6px_rgba(15,23,42,0.18)]"
                        : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E8EDF3]"
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
            </>
          )}

          {walletTab === "dropy" && (
            // ★§0 — dropy 숫자/원화 표시 금지. "준비 중" 안내만.
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-[#F1F5F9]">
                <Diamond className="size-5 text-[#94A3B8]" strokeWidth={2} />
              </span>
              <p className="text-[13px] font-semibold text-[#475569]">dropy는 준비 중이에요</p>
              <p className="text-[12px] text-[#94A3B8]">전환 적립이 시작되면 여기에 표시돼요</p>
            </div>
          )}
        </section>

        {/* ③-A 받은 쿠폰 메이커 섹션 제거 — 받은 쿠폰은 지갑 쿠폰 탭, 메이커 구독은 드롭 페이지(info-drop-page)
            handleSubscribeConfirm(maker_follows)에서 처리(중복 해소). ③-B 구독한 메이커는 유지. */}

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
                    // v0 Heart 알약 톤 — 탭 시 구독 취소(handleUnsubscribe 실함수 유지, 축소 아님).
                    <button
                      type="button"
                      onClick={() => handleUnsubscribe(m.id)}
                      disabled={busyMakerId === m.id}
                      aria-label="구독 취소"
                      className="group inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-full bg-[#EEF3FE] px-3 text-[11px] font-bold text-[#2563EB] transition-colors hover:bg-[#FEE2E2] hover:text-[#DC2626] active:scale-95 disabled:opacity-50"
                    >
                      <Heart className="size-3 fill-current group-hover:fill-none" strokeWidth={2} />
                      <span className="group-hover:hidden">구독중</span>
                      <span className="hidden group-hover:inline">구독 취소</span>
                    </button>
                  }
                />
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ④ 만든 카드 — B' 전환: 리치 리스트(성과/수정/재생/공유)는 홈 '내가만든' 탭으로 통합.
            여기는 딥링크 진입 카드만(/home?activity=made). */}
        <NavCard
          icon={FileText}
          title="만든 카드"
          subtitle={`성과·수정·재생 — ${data.myDrops.length}장`}
          onClick={() => navigate({ to: "/home", search: { activity: "made" } })}
        />

        {/* ⑤ Dropy Mall — v0-45 세로 카드형(헤더 행 + 상품 사진 그리드 + 하단 행). §0/법무: 준비 중 게이트.
            실기능(상품·가격·구매) 미이식 · 탭 이동 없음(비인터랙티브 div — 현행 유지).
            정본 NEW 칩은 "준비 중" 정직 표기로 대체 유지("곧 제공" 금지).
            잔액 칩 — 실지급 배선 0 = 전 유저 실잔액 0(가짜값 아님). 오픈 시 실 잔액 배선.
            근거: 자사몰 = post-pilot 선불전자지급수단·상품권 법무 게이트. 지금 실거래 열면 §0·법무 위반. */}
        <div
          className="rounded-2xl bg-[#0F172A] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.22)]"
          aria-label="Dropy Mall — 준비 중"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15">
              <ShoppingBag className="size-[19px] text-[#60A5FA]" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-extrabold tracking-[-0.01em] text-white">
                  Dropy Mall
                </span>
                <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-[#B6C2D2]">
                  준비 중
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] font-medium text-[#B6C2D2]">
                드로피로 구매하는 쇼핑몰
              </p>
            </div>
            <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5">
              <Diamond className="size-3.5 text-[#60A5FA]" strokeWidth={2.5} />
              <span className="text-[12px] font-bold tabular-nums text-white">0</span>
            </span>
          </div>

          {/* 상품 사진 그리드 — public/dropy-mall/*.webp(마스터 배치 최적화 에셋). */}
          <div className="mt-3.5 grid grid-cols-4 gap-2">
            {(
              [
                { src: "/dropy-mall/apple.webp", alt: "사과" },
                { src: "/dropy-mall/gochujang.webp", alt: "고추장" },
                { src: "/dropy-mall/jam.webp", alt: "수제잼" },
                { src: "/dropy-mall/tumbler.webp", alt: "텀블러" },
              ] as const
            ).map((p) => (
              <div
                key={p.src}
                className="aspect-square overflow-hidden rounded-xl bg-white/95 ring-1 ring-inset ring-white/10"
              >
                <img
                  src={p.src}
                  alt={p.alt}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>

          <p className="mt-2.5 flex items-center justify-center gap-0.5 text-[11.5px] font-semibold text-[#93A3B8]">
            농산물·가공품·굿즈 둘러보기
            <ChevronRight className="size-3.5" strokeWidth={2.5} />
          </p>
        </div>

        {/* T7 PWA v1 — 설치 버튼(정직 렌더: installable/kakao 외 null). 로그아웃 위 지정 지점. */}
        <InstallAppButton />

        {/* 로그아웃 + 버전 — 설정 아코디언에서 본문 최하단으로 이동(v0-44 정본 위치).
            핸들러(handleSignOut)·AlertDialog 확인 플로우 무변경, 위치만. */}
        <div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-[#EAEEF3] bg-white text-[#64748B] transition-colors hover:border-[#E2E8F0] hover:bg-[#F8FAFC] hover:text-[#0F172A] active:scale-[0.99]"
              >
                <LogOut className="size-[17px]" strokeWidth={2.25} />
                <span className="text-[13px] font-bold tracking-[0.06em]">로그아웃</span>
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
                  className="bg-[#0F172A] text-white hover:bg-[#1E293B]"
                >
                  {signingOut ? "로그아웃 중…" : "로그아웃"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p className="mt-4 text-center text-[11px] text-[#CBD5E1]">LinkDrop v1.0.0</p>
        </div>
      </div>
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
  const ctaLabel = "쿠폰 사용";

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
      className={`flex cursor-pointer overflow-hidden rounded-2xl border text-left transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] ${
        usable ? "border-[#EAE2D2] bg-[#FBF8F2]" : "border-[#E2E8F0] bg-[#F8FAFC]"
      } ${active ? "wallet-card-in ring-2 ring-[#0F172A]" : ""}`}
    >
      {/* v0-44 좌측 티켓 스텁(TicketPercent) — 시각 톤만. 사용가능=앰버 틴트 / 완료·만료=회색. */}
      <div
        className={`flex w-12 shrink-0 flex-col items-center justify-center border-r border-dashed ${
          usable ? "border-[#E0D6C2] bg-[#F3ECDD]" : "border-[#E2E8F0] bg-[#EFF1F4]"
        }`}
        aria-hidden
      >
        <TicketPercent
          className={`size-[22px] ${usable ? "text-[#B07D2B]" : "text-[#94A3B8]"}`}
          strokeWidth={2}
        />
      </div>
      {/* 우측 본문 — 기존 리치 콘텐츠(상태·매장·혜택·조건·기간·발신자 + CTA) 전부 유지. */}
      <div className="min-w-0 flex-1">
      <div className="px-4 pb-3 pt-4">
        {/* 상단: 상태 배지 | 받은 날짜 (기존 표기 유지: YY.MM.DD HH:mm) */}
        <div className="flex items-center justify-between gap-2">
          <CouponStatusBadge status={displayStatus} expiresAt={row.expires_at} />
          {row.issued_at ? (
            <span className="shrink-0 text-[10px] font-medium text-[#CBD5E1]">
              {formatReceivedKST(row.issued_at)} 받음
            </span>
          ) : null}
        </div>

        {/* 매장 — 이니셜 원(teal tint) + 이름 / 업종·지역 */}
        <div className="mt-3 flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-xs font-bold text-[#2563EB]">
            {storeInitial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#0F172A]">{storeName}</p>
            {storeSub ? <p className="truncate text-xs text-[#94A3B8]">{storeSub}</p> : null}
          </div>
        </div>

        {/* 혜택 */}
        <p
          className={`mt-3 flex items-start gap-1.5 text-[22px] font-extrabold leading-snug tracking-[-0.01em] ${
            dim ? "text-[#94A3B8]" : "text-[#0F172A]"
          }`}
        >
          {isGift ? <Gift className="mt-0.5 size-[20px] shrink-0" strokeWidth={2.4} /> : null}
          <span className="min-w-0">{benefit}</span>
        </p>

        {/* 조건 1줄 */}
        {conditionLine ? <p className="mt-1 text-xs text-[#94A3B8]">{conditionLine}</p> : null}

        {/* 기간 */}
        {periodLine ? (
          <p className={`mt-1.5 text-xs ${usable ? "text-[#A07A38]" : "text-[#94A3B8]"}`}>{periodLine}</p>
        ) : null}

        {/* 발신자 라벨 — 매장 직접 / 친구 공유 / 추천. 모든 상태(dim 카드면 같이 흐림). */}
        <div className="mt-2.5">
          <SenderPill label={senderLabel} />
        </div>
      </div>

      {/* CTA (사용 가능/곧 만료만) — 점선 tear 라인 + 검정 버튼. 좌측 스텁 seam 이 티켓 노치 역할(중복 원노치 제거).
          사용완료/만료는 히스토리(CTA 없음). */}
      {usable ? (
        <>
          <div className="mx-4 border-t border-dashed border-[#E2E8F0]" aria-hidden />
          <div className="flex gap-2 px-4 pb-4 pt-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goDetail();
              }}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-[#0F172A] px-4 text-sm font-bold text-white hover:bg-[#1E293B]"
            >
              {ctaLabel}
            </button>
            {/* 친구에게 보내기 = 출처 드롭 재공유. 아웃라인(보더/투명/검정 글자). 출처 있을 때만. */}
            {canReshare ? (
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-bold text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-50"
              >
                <Send className="size-4" strokeWidth={2} />
                쿠폰 선물
              </button>
            ) : null}
          </div>
        </>
      ) : null}
      </div>
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
function CouponStatusBadge({
  status,
  expiresAt,
}: {
  status: CouponDisplayStatus;
  expiresAt?: string | null;
}) {
  const countdown = status === "expiring" ? getExpiryCountdown(expiresAt ?? null) : null;
  const label = countdown ?? couponStatusLabel(status);
  const cls =
    status === "available"
      ? "bg-[#EFF6FF] text-[#2563EB]" // 사용가능 = 블루(emerald 대체)
      : status === "expiring"
        ? "bg-[#FEF3C7] text-[#B45309]" // 곧만료 = amber(검정 대체)
        : "bg-[#F5F5F5] text-[#94A3B8]"; // 완료/만료 = 회색 유지
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}
    >
      {status === "expiring" && <Clock className="h-3 w-3" />}
      {label}
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
// below = 프로필 행 아래 임베드 슬롯(받은 쿠폰 메이커 대표 공개카드). 없으면 프로필 행만(기존 동작).
function MakerRow({
  maker,
  right,
  below,
}: {
  maker: MakerInfo;
  right?: React.ReactNode;
  below?: React.ReactNode;
}) {
  const name = maker.display_name?.trim() || "메이커";
  const description = maker.metadata?.description?.trim();
  const subtitle = description || partnerKindLabel(maker.partner_kind);
  const initial = name.charAt(0) || "?";
  const tier = makerTier(maker);

  return (
    <li className="py-2.5">
      <div className="flex items-center gap-3">
        {/* v0 톤 — rounded-2xl 그라데이션 이니셜 아바타(from-#1E293B to-#475569). partners 로고 컬럼 없음 유지. */}
        <div className="relative flex size-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1E293B] to-[#475569] text-[14px] font-bold text-white ring-1 ring-inset ring-white/10">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[#0F172A]">
              {name}
            </p>
            <MakerTierChip tier={tier} />
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-[#94A3B8]">{subtitle}</p>
        </div>
        {right}
      </div>
      {below ? <div className="mt-3">{below}</div> : null}
    </li>
  );
}

function SectionCard({
  Icon,
  title,
  children,
  action,
}: {
  Icon: typeof User;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E8EDF3] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-[#EEF3FE]">
          <Icon className="size-4 text-[#2563EB]" strokeWidth={2} />
        </span>
        <h3 className="text-[14px] font-bold tracking-[-0.01em] text-[#0F172A]">{title}</h3>
        {action ? <span className="ml-auto">{action}</span> : null}
      </div>
      {children}
    </section>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-[#64748B]">{text}</p>;
}
