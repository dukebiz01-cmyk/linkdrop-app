import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { getFollowedMakerDrops, getDiscoverDrops, getSentDrops } from "@/lib/feed-queries";
import { getCouponDisplayStatus } from "@/lib/coupon-status";
import {
  RoleHome,
  type MerchantHomeData,
  type HomeGuide,
  type HomeReservation,
  type HomeProposal,
  type UserHomeData,
  type HomeCoupon,
} from "@/components/home/RoleHome";

// Slice 4a — 역할 홈. 기존 만들기 폼(HomePageV3)을 역할 랜딩 + 다이제스트로 교체.
//   isBusiness(is_active_partner_owner) 유지 + partnerId(partners owner_user_id) 추가.
//   상인일 때만 병렬 로드: 오늘의 AI(guide_history 최신 1행 — 재계산 없음) /
//   새 예약(get_partner_reservations, pending 상위) / 제안(maker_connections pending).
//   유저 데이터(곧 쓸 혜택·구독 새 카드)는 4b. HomePageV3 파일은 미사용 보존(롤백 안전).

type HomeLoaderData = {
  isBusiness: boolean;
  merchant: MerchantHomeData | null;
  user: UserHomeData | null;
  /** 1-C-2(L6) — 서버 기준시각 1회(타일 타이머 offset 보정, 1-C 미러). */
  serverNow?: string;
};

const RESERVATION_LIMIT = 3;
const PROPOSAL_LIMIT = 3;
const COUPON_LIMIT = 3;
const FOLLOWED_DROP_LIMIT = 6;
const RECOMMENDED_DROP_LIMIT = 4;

// get_my_wallet 반환 행 중 홈의 "곧 쓸 혜택"에 쓰는 필드만.
type WalletRow = {
  status: string | null;
  used_at: string | null;
  expires_at: string | null;
  claim_code: string;
  coupon_title: string | null;
};

// get_partner_reservations 반환 행 중 홈에서 쓰는 필드만.
type ReservationRpcRow = {
  reservation_id: string;
  status: string | null;
  customer_name: string | null;
  reserved_date: string | null;
  time_slot: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

// partner.reservations.tsx 의 formatDateRange 와 동일 규칙(홈 표시용 축약).
function reservationDateLabel(r: ReservationRpcRow): string {
  if (r.check_in_date && r.check_out_date) {
    return `${formatDate(r.check_in_date)} ~ ${formatDate(r.check_out_date)}`;
  }
  if (r.reserved_date) {
    return `${formatDate(r.reserved_date)}${r.time_slot ? ` ${r.time_slot}` : ""}`;
  }
  return "날짜 미정";
}

export const Route = createFileRoute("/_user/home")({
  head: () => ({ meta: [{ title: "홈" }] }),
  loader: async (): Promise<HomeLoaderData> => {
    const base: HomeLoaderData = { isBusiness: false, merchant: null, user: null };
    const supabase = await getAuthClient();
    if (!supabase) return base;
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    if (!userId) return base;

    const { data: isBusinessRaw } = await supabase.rpc("is_active_partner_owner", {
      _user_id: userId,
    });
    const isBusiness = Boolean(isBusinessRaw);

    // 유저(비사업자) 홈 — 곧 쓸 혜택(get_my_wallet → expiring) + 구독 메이커 새 카드.
    if (!isBusiness) {
      const [walletRes, followedDrops, recommendedDrops, sentDrops] = await Promise.all([
        supabase.rpc("get_my_wallet"),
        getFollowedMakerDrops(supabase, userId, { currentUserId: userId }),
        getDiscoverDrops(supabase, { currentUserId: userId }),
        getSentDrops(supabase, userId),
      ]);
      const walletRows = (walletRes.data as WalletRow[] | null) ?? [];
      const expiringCoupons: HomeCoupon[] = walletRows
        .filter(
          (r) =>
            getCouponDisplayStatus({
              status: r.status,
              used_at: r.used_at,
              expires_at: r.expires_at,
            }) === "expiring",
        )
        .slice(0, COUPON_LIMIT)
        .map((r) => ({
          claimCode: r.claim_code,
          title: r.coupon_title?.trim() || "혜택",
          expiresAt: r.expires_at,
        }));
      return {
        isBusiness,
        merchant: null,
        user: {
          expiringCoupons,
          followedDrops: followedDrops.slice(0, FOLLOWED_DROP_LIMIT),
          recommendedDrops: recommendedDrops.slice(0, RECOMMENDED_DROP_LIMIT),
          sentDrops,
        },
        serverNow: new Date().toISOString(),
      };
    }

    // partner 행 — 명함/식별용 (기존 partner.index 패턴).
    const { data: partner } = await supabase
      .from("partners")
      .select("id, display_name, partner_kind, address, verification_status")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!partner?.id) return { isBusiness, merchant: null, user: null };
    const partnerId = partner.id;

    // 병렬: 오늘의 AI(캐시 SELECT) / 새 예약(RPC) / 제안(pending) /
    //   + 상인홈 새 디자인용 피드(유저 분기와 동일 함수): 추천·내공유·구독 + 구독자 count(partner.index 재사용).
    const [guideRes, reservationRes, proposalRes, recommendedDrops, sentDrops, followedDrops, subscriberRes] =
      await Promise.all([
        supabase
          .from("guide_history")
          .select("diagnosis, prescriptions, snapshot_at")
          .eq("partner_id", partnerId)
          .order("snapshot_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.rpc("get_partner_reservations", { p_partner_id: partnerId }),
        supabase
          .from("maker_connections")
          .select(
            "id, requester:partners!maker_connections_requester_partner_id_fkey(display_name)",
          )
          .eq("target_partner_id", partnerId)
          .eq("status", "pending"),
        getDiscoverDrops(supabase, { currentUserId: userId }),
        getSentDrops(supabase, userId),
        getFollowedMakerDrops(supabase, userId, { currentUserId: userId }),
        supabase
          .from("maker_follows")
          .select("*", { count: "exact", head: true })
          .eq("followed_partner_id", partnerId)
          .eq("status", "active"),
      ]);

    // 오늘의 AI — guide_history 최신 스냅샷(diagnosis/prescriptions jsonb).
    const guideRow = guideRes.data as { diagnosis: unknown; prescriptions: unknown } | null;
    const guide: HomeGuide = guideRow
      ? ({
          diagnosis: guideRow.diagnosis,
          prescriptions: guideRow.prescriptions,
        } as unknown as HomeGuide)
      : null;

    // 새 예약 — pending 만, 최근순 상위 N (partner.reservations.tsx 와 동일 status 필터).
    const reservationRows = (reservationRes.data as ReservationRpcRow[] | null) ?? [];
    const pendingReservations = reservationRows.filter((r) => r.status === "pending");
    // 배지용 pending 총개수(상위 N 리스트와 별개 — 3건 초과해도 실제 개수 표시).
    const newReservationsCount = pendingReservations.length;
    const newReservations: HomeReservation[] = pendingReservations
      .slice(0, RESERVATION_LIMIT)
      .map((r) => ({
        reservationId: r.reservation_id,
        customerName: r.customer_name,
        dateLabel: reservationDateLabel(r),
      }));

    // 제안 — maker_connections pending(요청자 임베드) 상위 N.
    type ProposalRaw = { id: string; requester: { display_name: string } | null };
    const proposals: HomeProposal[] = ((proposalRes.data as ProposalRaw[] | null) ?? [])
      .filter((p) => p.requester)
      .slice(0, PROPOSAL_LIMIT)
      .map((p) => ({ connectionId: p.id, name: p.requester!.display_name }));

    const merchant: MerchantHomeData = {
      partnerName: partner.display_name ?? "",
      partnerKind: partner.partner_kind ?? null,
      address: partner.address ?? null,
      tier: partner.verification_status === "approved" ? "biz" : "pb",
      guide,
      newReservations,
      newReservationsCount,
      proposals,
      subscriberCount: subscriberRes.count ?? 0,
    };

    // 상인홈도 새 디자인의 피드 섹션(오늘 공유·활동 세그먼트)을 user 로 받는다(유저 분기와 동일 슬라이스).
    //   expiringCoupons 는 상인홈 미사용 → 빈 배열.
    return {
      isBusiness,
      merchant,
      user: {
        expiringCoupons: [],
        followedDrops: followedDrops.slice(0, FOLLOWED_DROP_LIMIT),
        recommendedDrops: recommendedDrops.slice(0, RECOMMENDED_DROP_LIMIT),
        sentDrops,
      },
      serverNow: new Date().toISOString(),
    };
  },
  component: HomeRoute,
});

function HomeRoute() {
  const navigate = useNavigate();
  const router = useRouter();
  const { isBusiness, merchant, user, serverNow } = Route.useLoaderData();

  // PTR-1 — 당겨서 새로고침: loader 재실행(router.invalidate, 전체 리로드 아님).
  //   최소 300ms 표시 보장(인디케이터 인지) — invalidate 가 즉시 끝나도 스피너 확인 가능.
  const { pullDistance, refreshing, ready } = usePullToRefresh({
    onRefresh: async () => {
      const started = Date.now();
      await router.invalidate();
      const elapsed = Date.now() - started;
      if (elapsed < 300) await new Promise((r) => setTimeout(r, 300 - elapsed));
    },
  });

  return (
    <>
      {/* PTR-1 인디케이터 — 당김 거리만큼만 높이(레이아웃 점프 없음, 인디케이터 영역 한정).
          스피너 회전은 기능 피드백(L7 허용). 자식(RoleHome) 무수정 — 래퍼 레벨 부착. */}
      <div
        style={{ height: refreshing ? 64 : pullDistance }}
        className="flex items-end justify-center overflow-hidden"
        aria-hidden={pullDistance <= 0 && !refreshing}
      >
        {pullDistance > 0 || refreshing ? (
          <div className="flex items-center gap-1.5 pb-3 text-xs font-medium text-[#64748B]">
            {refreshing ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                새로고침 중…
              </>
            ) : ready ? (
              "놓으면 새로고침"
            ) : (
              "당겨서 새로고침"
            )}
          </div>
        ) : null}
      </div>
      <RoleHome
        isBusiness={isBusiness}
        merchant={merchant}
        user={user}
        serverNow={serverNow}
        onGoResults={() => void navigate({ to: "/partner/results" })}
        onGoReservations={() => void navigate({ to: "/partner/reservations" })}
        onGoProposals={() => void navigate({ to: "/partner" })}
      />
    </>
  );
}
