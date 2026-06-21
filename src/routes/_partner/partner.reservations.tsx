import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  CalendarRange,
  Users,
  Phone,
  MessageSquare,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { Toaster } from "@/components/ui/sonner";

// 예약관리 (Phase 1) — partner.index 본문에 있던 예약 inbox를 분리한 페이지.
//   데이터(get_partner_reservations)·수락/거절 RPC(confirm/reject_reservation)·렌더 동일.
//   _partner.tsx beforeLoad 가 인증/파트너 가드 → 이 loader 는 세션 없으면 graceful empty(throw 금지).

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
  // 복호화된 전체 번호(하이픈 없는 11자리). RPC가 반환(없으면 null) — types.ts 미반영이라 로컬 타입에만.
  customer_phone: string | null;
  customer_message: string | null;
  created_at: string | null;
};

type LoaderData = {
  reservations: ReservationRow[];
};

export const Route = createFileRoute("/_partner/partner/reservations")({
  head: () => ({ meta: [{ title: "예약관리 — LinkDrop" }] }),
  loader: async (): Promise<LoaderData> => {
    const empty: LoaderData = { reservations: [] };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const ownerUserId = sessionData.session?.user.id ?? null;
    if (!ownerUserId) return empty;

    const { data: partner } = await supabase
      .from("partners")
      .select("id")
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();
    if (!partner?.id) return empty;

    const { data: reservations } = await supabase.rpc("get_partner_reservations", {
      p_partner_id: partner.id,
    });

    return { reservations: (reservations as ReservationRow[] | null) ?? [] };
  },
  component: PartnerReservationsPage,
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

// 하이픈 없는 11자리(010XXXXXXXX) → 010-XXXX-XXXX. 형식 안 맞으면 원문 그대로.
function formatPhone(phone: string): string {
  return phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function PartnerReservationsPage() {
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
        console.error("[partner.reservations] confirm_reservation failed:", error);
        toast.error("확정 처리에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      toast.success("예약을 확정했어요.");
      await router.invalidate();
    } catch (err) {
      console.error("[partner.reservations] confirm unexpected:", err);
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
        console.error("[partner.reservations] reject_reservation failed:", error);
        toast.error("거절 처리에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      toast.success("예약을 거절했어요.");
      await router.invalidate();
    } catch (err) {
      console.error("[partner.reservations] reject unexpected:", err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
      <header className="bg-white px-5 py-4 border-b border-[#F1F5F9]">
        <Link
          to="/partner"
          className="inline-flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0F172A]"
        >
          <ArrowLeft className="size-3" strokeWidth={2} />
          매장 홈
        </Link>
        <h1 className="mt-1 text-lg font-bold text-[#0F172A]">예약관리</h1>
        <p className="mt-0.5 text-xs text-[#64748B]">들어온 예약을 확인하고 처리해요</p>
      </header>

      <div className="space-y-4 px-5 pt-4">
        {/* 예약 캘린더 진입 */}
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

        {/* 새로운 예약 (pending) — 미처리 개수 빨강 배지. 0이면 배지 없음 + 빈 상태. */}
        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <h2 className="text-sm font-semibold text-[#0A0A0A]">새로운 예약</h2>
            {pending.length > 0 ? (
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#EF4444] px-1.5 text-[11px] font-bold text-white">
                {pending.length}
              </span>
            ) : null}
          </div>
          {pending.length === 0 ? (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center">
              <p className="text-sm text-[#64748B]">새로 들어온 예약이 없어요.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {pending.map((r) => (
                <ReservationCard
                  key={r.reservation_id}
                  row={r}
                  acting={actingId === r.reservation_id}
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                />
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
                <ReservationCard key={r.reservation_id} row={r} />
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

// created_at → "M.D" (로컬, formatDate 와 동일 기준). "M.D 신청" 표기용.
function formatMonthDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

// 예약 상태 배지 — pending=대기/amber, confirmed=확정/green, rejected=거절/회색, completed=완료/회색.
function StatusBadge({ status }: { status: string | null }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-bold text-[#B45309]">
        대기
      </span>
    );
  }
  if (status === "confirmed") {
    return (
      <span className="inline-flex items-center rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-bold text-[#059669]">
        확정
      </span>
    );
  }
  const label =
    status === "rejected" ? "거절" : status === "completed" ? "완료" : (status ?? "상태");
  return (
    <span className="inline-flex items-center rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-bold text-[#94A3B8]">
      {label}
    </span>
  );
}

// 예약 카드 — 상태배지+신청일 / 날짜·슬롯 / 손님·인원 / 메모. pending 만 수락(검정)·거절(아웃라인).
// 데이터 출처(get_partner_reservations)·수락/거절 RPC 무변경.
function ReservationCard({
  row,
  acting = false,
  onConfirm,
  onReject,
}: {
  row: ReservationRow;
  acting?: boolean;
  onConfirm?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const isPending = row.status === "pending";
  return (
    <li
      className={`rounded-2xl border border-[#E5E7EB] bg-white p-4 ${isPending ? "" : "opacity-80"}`}
    >
      {/* 상단: 상태 배지 | 신청일(M.D) */}
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={row.status} />
        {row.created_at ? (
          <span className="shrink-0 text-xs font-medium text-[#94A3B8]">
            {formatMonthDay(row.created_at)} 신청
          </span>
        ) : null}
      </div>

      {/* 날짜 / 슬롯 (calendar_mode 분기는 formatDateRange 가 처리) */}
      <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
        <Calendar className="size-4 text-[#0A0A0A]" strokeWidth={2} />
        {formatDateRange(row)}
      </div>

      {/* 손님 · 인원 */}
      <div className="mt-1.5 flex items-center gap-2 text-sm text-[#475569]">
        <Users className="size-4 text-[#94A3B8]" strokeWidth={2} />
        {row.customer_name?.trim() || "손님"}
        {row.guest_count ? ` · ${row.guest_count}명` : ""}
      </div>

      {/* 손님 전화 — 전체번호(복호화) 있으면 번호+전화하기, 없으면 뒷자리 fallback */}
      {row.customer_phone ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[#475569]">
          <Phone className="size-4 text-[#94A3B8]" strokeWidth={2} />
          <span className="font-semibold text-[#0F172A]">{formatPhone(row.customer_phone)}</span>
          <a
            href={`tel:${row.customer_phone}`}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-[#0A0A0A] px-3 text-xs font-semibold text-white hover:bg-[#171717]"
          >
            <Phone className="size-3.5" strokeWidth={2} />
            전화하기
          </a>
        </div>
      ) : row.phone_last4 ? (
        <div className="mt-1.5 flex items-center gap-2 text-sm text-[#475569]">
          <Phone className="size-4 text-[#94A3B8]" strokeWidth={2} />
          뒷자리 {row.phone_last4}
        </div>
      ) : null}

      {/* 손님 메모 (있으면, 2줄 클램프) */}
      {row.customer_message?.trim() ? (
        <div className="mt-1.5 flex gap-2 text-sm text-[#475569]">
          <MessageSquare className="mt-0.5 size-4 shrink-0 text-[#94A3B8]" strokeWidth={2} />
          <p className="line-clamp-2 min-w-0 whitespace-pre-line">{row.customer_message}</p>
        </div>
      ) : null}

      {/* 액션 — pending 만. 수락=검정 채움 / 거절=아웃라인. RPC 로직 무변경. */}
      {isPending && onConfirm && onReject ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onReject(row.reservation_id)}
            disabled={acting}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D4D4D4] bg-white px-4 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
          >
            <XCircle className="size-4" strokeWidth={2} />
            거절
          </button>
          <button
            type="button"
            onClick={() => onConfirm(row.reservation_id)}
            disabled={acting}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0A0A0A] px-4 text-sm font-bold text-white hover:bg-[#171717] disabled:opacity-50"
          >
            <CheckCircle2 className="size-4" strokeWidth={2} />
            확정
          </button>
        </div>
      ) : null}
    </li>
  );
}
