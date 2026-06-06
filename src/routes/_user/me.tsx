import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  User,
  Gift,
  Heart,
  FileText,
  Store,
  Settings,
  LogOut,
  ChevronRight,
  BarChart3,
  Copy,
  Check,
  Wallet,
} from "lucide-react";
// Wallet = 쿠폰 지갑 섹션 헤더. Gift = 증정 쿠폰 혜택 라벨 재사용.
import { Toaster } from "@/components/ui/sonner";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
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
    discount_value: number | string | null;
    discount_unit: string | null;
    valid_until: string | null;
    coupon_type: string | null;
    gift_item: string | null;
    partner: {
      display_name: string;
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

type MePageData = {
  userId: string | null;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  isBusiness: boolean;
  myDrops: MyDropRow[];
  coupons: CouponClaimRow[];
};

/**
 * /me — 나 페이지 (N1).
 *
 * 부모 _user.tsx beforeLoad 가 인증 단독 담당. 자식 loader 는 graceful — userId null
 * 이어도 throw 없이 빈 데이터로 진행 (메모리 #17 fix1 패턴, profile.tsx 참조).
 *
 * 6 섹션: 내 정보 · 받은 혜택 · 내 구독 · 내 카드 · 내 매장(조건부) · 설정
 *
 * v5.5 마이그레이션으로 get_my_drops 반환에 share_uuid 추가됨 → ④ 내 카드의
 * "성과 보기" 링크 활성화 (isBusiness && share_uuid 동시 조건). N1-b.
 */
export const Route = createFileRoute("/_user/me")({
  head: () => ({ meta: [{ title: "나 — LinkDrop" }] }),
  loader: async (): Promise<MePageData> => {
    const empty: MePageData = {
      userId: null,
      email: null,
      displayName: "",
      avatarUrl: null,
      isBusiness: false,
      myDrops: [],
      coupons: [],
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
    const { data: coupons } = await supabase
      .from("coupon_claims")
      .select(
        "id, coupon_id, status, issued_at, used_at, expires_at, claim_code, " +
          "coupon:coupons(title, discount_value, discount_unit, valid_until, coupon_type, gift_item, " +
          "partner:partners(display_name))",
      )
      .eq("catcher_user_id", userId)
      .order("issued_at", { ascending: false })
      // 지갑 — 사실상 전체 노출(11개째부터 안 보이던 문제 해소). 페이지네이션은 범위 밖.
      .limit(100);

    return {
      userId,
      email,
      displayName: profile?.display_name ?? "",
      avatarUrl: profile?.avatar_url ?? null,
      isBusiness: Boolean(isBusiness),
      myDrops,
      coupons: (coupons as CouponClaimRow[] | null) ?? [],
    };
  },
  component: MePage,
});

function getInitial(displayName: string, email: string | null): string {
  const source = displayName.trim() || email?.split("@")[0] || "?";
  return source.charAt(0).toUpperCase();
}

function MePage() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  // 작업 C: 내 카드 접기/펼치기 (상위 2개 + 더보기/접기 토글)
  const [dropsExpanded, setDropsExpanded] = useState(false);
  // 작업 B: 내 카드 썸네일 탭 → 인앱 임베드 재생 (단일 모달 인스턴스)
  const [embedState, setEmbedState] = useState<{
    open: boolean;
    videoId: string;
    originalUrl: string;
    title: string;
  } | null>(null);

  // 쿠폰 지갑 — '사용 가능'(issued)만 강조 카운트. 현금처럼 쓸 수 있는 장 수.
  const availableCount = data.coupons.filter((c) => c.status === "issued").length;

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

        {/* ② 쿠폰 지갑 — 쿠폰 = 현금성 자산. 지갑 패널은 가볍게, 그 안의 쿠폰 '장'들이
            주인공. 헤더에 '사용 가능 N장' 강조. 카드 탭 = 상세, "코드 복사" = clipboard.
            박스 중첩 회피: 흰 패널 안에서 쿠폰들은 hairline divider 로만 구분(보더박스 X). */}
        <section className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-[#0A0A0A]" strokeWidth={2} />
              <h3 className="text-sm font-semibold text-[#0A0A0A]">쿠폰 지갑</h3>
            </div>
            {data.coupons.length > 0 ? (
              <span
                className={`text-sm font-bold ${
                  availableCount > 0 ? "text-[#0A0A0A]" : "text-[#94A3B8]"
                }`}
              >
                사용 가능 {availableCount}장
              </span>
            ) : null}
          </div>
          {data.coupons.length === 0 ? (
            <EmptyText text="받은 쿠폰이 여기 모여요." />
          ) : (
            <ul className="divide-y divide-[#F1F5F9]">
              {data.coupons.map((c) => (
                <CouponClaimCard key={c.id} row={c} />
              ))}
            </ul>
          )}
        </section>

        {/* ③ 내 구독 — 정적 빈상태 (테이블 없음) */}
        <SectionCard Icon={Heart} title="내 구독">
          <EmptyText text="구독한 매장이 여기 표시돼요." />
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

        {/* ⑥ 설정 — 로그아웃 */}
        <SectionCard Icon={Settings} title="설정">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="flex w-full min-h-[44px] items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-[#EF4444] hover:bg-[#FEF2F2]"
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
        </SectionCard>
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

function CouponClaimCard({ row }: { row: CouponClaimRow }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const couponTitle = row.coupon?.title?.trim() || "쿠폰";
  const storeName = row.coupon?.partner?.display_name?.trim() || "";
  const isGift = row.coupon?.coupon_type === "gift";
  const giftItem = row.coupon?.gift_item?.trim() || "";
  const isUsed = row.status === "used";
  const isExpired = row.status === "expired" || row.status === "cancelled";
  const dim = isUsed || isExpired;

  // 혜택/증정품 = 가장 큰 가치(현금 같은 자산). 증정이면 '{품목} 증정', 아니면 쿠폰 제목.
  const benefit = isGift && giftItem ? `${giftItem} 증정` : couponTitle;

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(row.claim_code);
      setCopied(true);
      toast.success("쿠폰 번호를 복사했어요.");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("복사에 실패했어요.");
    }
  }

  function goDetail() {
    void navigate({
      to: "/coupon/$claim_code",
      params: { claim_code: row.claim_code },
    });
  }

  return (
    // 지갑 안의 한 '장' — 보더박스 없이 hairline divider(ul)로만 구분, 박스 중첩 회피.
    // phase1 A: 카드 전체 클릭 + 복사 button 중첩 → div role=button, 키보드(Enter/Space) 유지.
    <li
      role="button"
      tabIndex={0}
      onClick={goDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goDetail();
        }
      }}
      className={`-mx-2 cursor-pointer rounded-xl px-2 py-4 text-left transition-colors hover:bg-[#FAFAFA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] ${
        dim ? "opacity-50" : ""
      }`}
    >
      {/* 상태(사용 가능=현금처럼 또렷) + 유효기간 */}
      <div className="flex items-center justify-between gap-2">
        <StatusPill status={row.status} />
        {row.expires_at ? (
          <span className="shrink-0 text-xs font-medium text-[#94A3B8]">
            {formatDate(row.expires_at)}까지
          </span>
        ) : null}
      </div>

      {/* 혜택/증정 = 가장 크게(가치) */}
      <p className="mt-2 flex items-start gap-1.5 text-lg font-extrabold leading-tight text-[#0F172A]">
        {isGift ? <Gift className="mt-0.5 size-5 shrink-0" strokeWidth={2.4} /> : null}
        <span className="min-w-0">{benefit}</span>
      </p>
      {storeName ? (
        <p className="mt-1 truncate text-sm font-medium text-[#64748B]">{storeName}</p>
      ) : null}

      {/* 쿠폰 번호 + 복사 */}
      <div className="mt-3 flex items-center gap-2">
        <span className="font-mono text-base font-bold tracking-wide text-[#0F172A]">
          {row.claim_code}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-semibold text-[#0A0A0A] hover:bg-[#FAFAFA]"
          aria-label="쿠폰 번호 복사"
        >
          {copied ? (
            <Check className="size-3" strokeWidth={2.4} />
          ) : (
            <Copy className="size-3" strokeWidth={2} />
          )}
          {copied ? "복사됨" : "코드 복사"}
        </button>
      </div>
    </li>
  );
}

// 상태 칩 — '사용 가능'은 검정 솔리드로 또렷하게(쓸 수 있는 돈처럼), 그 외는 회색 dim.
function StatusPill({ status }: { status: string | null }) {
  if (status === "issued") {
    return (
      <span className="inline-flex items-center rounded-md bg-[#0A0A0A] px-2 py-0.5 text-xs font-bold text-white">
        사용 가능
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-[#F1F5F9] px-2 py-0.5 text-xs font-semibold text-[#94A3B8]">
      {labelCouponStatus(status)}
    </span>
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function labelCouponStatus(s: string | null): string {
  switch (s) {
    case "issued":
      return "사용 가능";
    case "used":
      return "사용 완료";
    case "expired":
      return "기간 만료";
    case "cancelled":
      return "취소";
    default:
      return "상태 확인 중";
  }
}
