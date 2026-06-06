import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Users,
  Phone,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Ticket,
  ChevronRight,
  Sparkles,
  BarChart3,
  CalendarRange,
} from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { Toaster } from "@/components/ui/sonner";

type ReservationRow = {
  reservation_id: string;
  drop_id: string | null;
  calendar_mode: string | null;
  reserved_date: string | null;
  time_slot: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  guest_count: number | null;
  status: string | null;
  customer_name: string | null;
  phone_last4: string | null;
  customer_message: string | null;
  created_at: string | null;
};

type LoaderData = {
  ownerUserId: string | null;
  partnerId: string | null;
  partnerName: string | null;
  reservations: ReservationRow[];
};

export const Route = createFileRoute("/_partner/partner/")({
  head: () => ({ meta: [{ title: "들어온 예약 — LinkDrop" }] }),
  loader: async (): Promise<LoaderData> => {
    const empty: LoaderData = {
      ownerUserId: null,
      partnerId: null,
      partnerName: null,
      reservations: [],
    };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const ownerUserId = sessionData.session?.user.id ?? null;
    if (!ownerUserId) return empty;

    // owner 의 partner (가드가 is_active_partner_owner 통과 보장하므로 행 존재).
    const { data: partner } = await supabase
      .from("partners")
      .select("id, display_name")
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();

    if (!partner?.id) {
      return { ...empty, ownerUserId };
    }

    const { data: reservations } = await supabase.rpc("get_partner_reservations", {
      p_partner_id: partner.id,
    });

    return {
      ownerUserId,
      partnerId: partner.id,
      partnerName: partner.display_name ?? null,
      reservations: (reservations as ReservationRow[] | null) ?? [],
    };
  },
  component: PartnerHome,
});

function formatDateRange(row: ReservationRow): string {
  if (row.check_in_date && row.check_out_date) {
    return `${formatDate(row.check_in_date)} ~ ${formatDate(row.check_out_date)}`;
  }
  if (row.reserved_date) {
    const time = row.time_slot ? ` ${row.time_slot}` : "";
    return `${formatDate(row.reserved_date)}${time}`;
  }
  return "날짜 미정";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function PartnerHome() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);
  // 처리 끝남 목록 접기/펼치기 — 기본 5건만, 더보기로 전체.
  const [othersExpanded, setOthersExpanded] = useState(false);

  const pending = data.reservations.filter((r) => r.status === "pending");
  const others = data.reservations.filter((r) => r.status !== "pending");
  const OTHERS_PREVIEW = 5;
  const visibleOthers = othersExpanded ? others : others.slice(0, OTHERS_PREVIEW);

  async function handleConfirm(reservationId: string) {
    setActingId(reservationId);
    try {
      const { error } = await getSupabase().rpc("confirm_reservation", {
        p_reservation_id: reservationId,
        p_partner_message: "",
      });
      if (error) {
        console.error("[partner.index] confirm_reservation failed:", error);
        toast.error("확정 처리에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      toast.success("예약을 확정했어요.");
      await router.invalidate();
    } catch (err) {
      console.error("[partner.index] confirm unexpected:", err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(reservationId: string) {
    setActingId(reservationId);
    try {
      const { error } = await getSupabase().rpc("reject_reservation", {
        p_reservation_id: reservationId,
        p_reason: "",
      });
      if (error) {
        console.error("[partner.index] reject_reservation failed:", error);
        toast.error("거절 처리에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      toast.success("예약을 거절했어요.");
      await router.invalidate();
    } catch (err) {
      console.error("[partner.index] reject unexpected:", err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
      <header className="bg-white px-5 py-4 border-b border-[#F1F5F9]">
        <h1 className="text-lg font-bold text-[#0F172A]">{data.partnerName ?? "매장"}</h1>
        <p className="mt-0.5 text-xs text-[#64748B]">내 매장</p>
      </header>

      <div className="space-y-4 px-5 pt-4">
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

        {/* 들어온 예약 (pending) */}
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-[#0A0A0A]">
            들어온 예약 ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-center shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <p className="text-sm text-[#64748B]">들어온 예약이 없어요.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {pending.map((r) => (
                <li
                  key={r.reservation_id}
                  className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                >
                  <ReservationBody row={r} />
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleReject(r.reservation_id)}
                      disabled={actingId === r.reservation_id}
                      className="flex flex-1 min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
                    >
                      <XCircle className="size-4" strokeWidth={2} />
                      거절
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirm(r.reservation_id)}
                      disabled={actingId === r.reservation_id}
                      className="flex flex-1 min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#0A0A0A] px-4 py-2 text-sm font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)] disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-4" strokeWidth={2} />
                      확정
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 처리 끝난 예약 (confirmed/rejected/completed) — 기본 5건만, 더보기로 전체.
            정렬은 로더(get_partner_reservations, created_at DESC) 그대로. */}
        {others.length > 0 ? (
          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-[#0A0A0A]">
              처리 끝남 ({others.length})
            </h2>
            <ul className="space-y-3">
              {visibleOthers.map((r) => (
                <li
                  key={r.reservation_id}
                  className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] opacity-80"
                >
                  <div className="mb-2">
                    <StatusBadge status={r.status} />
                  </div>
                  <ReservationBody row={r} />
                </li>
              ))}
            </ul>
            {others.length > OTHERS_PREVIEW ? (
              <button
                type="button"
                onClick={() => setOthersExpanded((v) => !v)}
                className="mt-3 flex w-full min-h-[44px] items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#0A0A0A] hover:bg-[#FAFAFA]"
              >
                {othersExpanded ? "접기" : `더보기 (${others.length - OTHERS_PREVIEW}건)`}
              </button>
            ) : null}
          </section>
        ) : null}
      </div>

      <Toaster richColors position="top-center" />
    </main>
  );
}

function ReservationBody({ row }: { row: ReservationRow }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
        <Calendar className="size-4 text-[#0A0A0A]" strokeWidth={2} />
        {formatDateRange(row)}
      </div>
      <div className="flex items-center gap-2 text-sm text-[#475569]">
        <Users className="size-4 text-[#94A3B8]" strokeWidth={2} />
        {row.customer_name?.trim() || "손님"}
        {row.guest_count ? ` · ${row.guest_count}명` : ""}
      </div>
      {row.phone_last4 ? (
        <div className="flex items-center gap-2 text-sm text-[#475569]">
          <Phone className="size-4 text-[#94A3B8]" strokeWidth={2} />
          뒷자리 {row.phone_last4}
        </div>
      ) : null}
      {row.customer_message?.trim() ? (
        <div className="flex gap-2 text-sm text-[#475569]">
          <MessageSquare className="mt-0.5 size-4 shrink-0 text-[#94A3B8]" strokeWidth={2} />
          {/* 메모가 길어도 카드는 짧게 — 2줄로 줄이고 말줄임(…). */}
          <p className="line-clamp-2 min-w-0 whitespace-pre-line">{row.customer_message}</p>
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "confirmed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-[#059669]">
        <CheckCircle2 className="size-3" strokeWidth={2} />
        확정됨
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-semibold text-[#EF4444]">
        <XCircle className="size-3" strokeWidth={2} />
        거절됨
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]">
      {status ?? "상태"}
    </span>
  );
}
