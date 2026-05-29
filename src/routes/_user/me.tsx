import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  User,
  Gift,
  Heart,
  FileText,
  Store,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  source: { title: string | null; thumbnail_url: string | null; provider: string | null } | null;
  // v5.5: 첫 share_event 의 share_uuid. 없으면 null (공유 안 된 옛 drop).
  share_uuid: string | null;
};

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
    const { data: coupons } = await supabase
      .from("coupon_claims")
      .select("id, coupon_id, status, issued_at, used_at, expires_at")
      .eq("catcher_user_id", userId)
      .order("issued_at", { ascending: false })
      .limit(10);

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
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
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

        {/* ② 받은 혜택 */}
        <SectionCard Icon={Gift} title="받은 혜택">
          {data.coupons.length === 0 ? (
            <EmptyText text="받은 혜택이 여기 모여요." />
          ) : (
            <ul className="space-y-2">
              {data.coupons.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#0F172A]">
                      쿠폰 {c.id.slice(0, 6)}
                    </p>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      {labelCouponStatus(c.status)}
                      {c.expires_at ? ` · ${formatDate(c.expires_at)}까지` : null}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ③ 내 구독 — 정적 빈상태 (테이블 없음) */}
        <SectionCard Icon={Heart} title="내 구독">
          <EmptyText text="구독한 매장이 여기 표시돼요." />
        </SectionCard>

        {/* ④ 내 카드 — 성과 보기 링크는 비지니스만 (단, 현재 share_uuid 미반환으로 임시 비활성) */}
        <SectionCard Icon={FileText} title="내 카드">
          {data.myDrops.length === 0 ? (
            <EmptyText text="아직 만든 카드가 없어요." />
          ) : (
            <ul className="space-y-2">
              {data.myDrops.slice(0, 10).map((d) => (
                <li key={d.id} className="rounded-xl bg-[#F8FAFC] px-3 py-3">
                  <div className="flex items-center gap-3">
                    {d.source?.thumbnail_url ? (
                      <img
                        src={d.source.thumbnail_url}
                        alt=""
                        className="size-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="size-12 shrink-0 rounded-lg bg-[#E2E8F0]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#0F172A]">
                        {d.source?.title?.trim() || "(제목 없음)"}
                      </p>
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
                      className="mt-2 flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[#2563EB] hover:underline"
                    >
                      성과 보기
                      <ChevronRight className="size-4" strokeWidth={2} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ⑤ 내 매장 — 비지니스만 노출 */}
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
    </main>
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
        <Icon className="size-4 text-[#2563EB]" strokeWidth={2} />
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
