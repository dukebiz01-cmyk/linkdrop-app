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
  MapPin,
  Tag,
  Megaphone,
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

// 매장 프로필 카드 — 진행 중 혜택(활성 쿠폰) 표시용. get_active_store_coupons 반환 일부.
type ActiveCouponRow = {
  id: string;
  title: string | null;
  valid_until: string | null;
};

type LoaderData = {
  ownerUserId: string | null;
  partnerId: string | null;
  partnerName: string | null;
  reservations: ReservationRow[];
  // 매장 프로필 카드(명함) — 전부 기존 데이터/RPC 조합, DB 변경 없음.
  verificationStatus: string | null;
  businessTypeLabel: string | null; // 업종 한글 (business_categories depth=1 재사용)
  partnerKind: string | null; // 보조
  address: string | null;
  subscriberCount: number; // maker_follows active count
  activeCoupons: ActiveCouponRow[];
};

export const Route = createFileRoute("/_partner/partner/")({
  head: () => ({ meta: [{ title: "들어온 예약 — LinkDrop" }] }),
  loader: async (): Promise<LoaderData> => {
    const empty: LoaderData = {
      ownerUserId: null,
      partnerId: null,
      partnerName: null,
      reservations: [],
      verificationStatus: null,
      businessTypeLabel: null,
      partnerKind: null,
      address: null,
      subscriberCount: 0,
      activeCoupons: [],
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
      .select("id, display_name, business_type, partner_kind, address, verification_status")
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();

    if (!partner?.id) {
      return { ...empty, ownerUserId };
    }

    // 4개 병렬: 예약 / 구독수(maker_follows active count, partner_owner SELECT RLS) /
    //   활성 쿠폰(get_active_store_coupons) / 업종 한글(business_categories depth=1, 등록화면 재사용).
    const [
      { data: reservations },
      { count: subscriberCount },
      { data: activeCouponsRaw },
      { data: majors },
    ] = await Promise.all([
      supabase.rpc("get_partner_reservations", { p_partner_id: partner.id }),
      supabase
        .from("maker_follows")
        .select("*", { count: "exact", head: true })
        .eq("followed_partner_id", partner.id)
        .eq("status", "active"),
      supabase.rpc("get_active_store_coupons", { p_partner_id: partner.id }),
      supabase.from("business_categories").select("code, label").eq("depth", 1),
    ]);

    const majorMap = new Map(
      ((majors as { code: string; label: string }[] | null) ?? []).map((m) => [m.code, m.label]),
    );
    const businessTypeLabel = partner.business_type
      ? (majorMap.get(partner.business_type) ?? null)
      : null;

    return {
      ownerUserId,
      partnerId: partner.id,
      partnerName: partner.display_name ?? null,
      reservations: (reservations as ReservationRow[] | null) ?? [],
      verificationStatus: partner.verification_status ?? null,
      businessTypeLabel,
      partnerKind: partner.partner_kind ?? null,
      address: partner.address ?? null,
      subscriberCount: subscriberCount ?? 0,
      activeCoupons: (activeCouponsRaw as ActiveCouponRow[] | null) ?? [],
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

// partner_kind enum → 한글 라벨 (업종 보조 표시용). business_type 한글이 우선.
function partnerKindLabel(kind: string | null): string | null {
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
    case "other":
      return "기타";
    default:
      return null;
  }
}

// 등급 칩 — me.tsx 와 동일 스타일. biz: 퍼플 / pb: 틸. 대문자, 11px, tracking 0.02em.
function TierChip({ tier }: { tier: "biz" | "pb" }) {
  const cls = tier === "biz" ? "bg-[#F0EDFB] text-[#4C3FA0]" : "bg-[#E1F5EE] text-[#0E4D42]";
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold tracking-[0.02em] ${cls}`}
    >
      {tier.toUpperCase()}
    </span>
  );
}

// 프로필 한 줄 — 아이콘 + 작은 회색 라벨 + 값.
function ProfileRow({
  Icon,
  label,
  value,
  muted = false,
}: {
  Icon: typeof Tag;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="size-4 shrink-0 text-[#94A3B8]" strokeWidth={2} />
      <span className="w-9 shrink-0 text-xs font-medium text-[#94A3B8]">{label}</span>
      <span className={`truncate font-medium ${muted ? "text-[#94A3B8]" : "text-[#0F172A]"}`}>
        {value}
      </span>
    </div>
  );
}

// 매장 프로필 카드(명함) — 사장 본인. 흰 배경 + 보더, 딥 틸 액센트. 검정 미니멀.
function StoreProfileCard({
  name,
  tier,
  businessTypeLabel,
  partnerKind,
  address,
  subscriberCount,
  activeCoupons,
}: {
  name: string;
  tier: "biz" | "pb";
  businessTypeLabel: string | null;
  partnerKind: string | null;
  address: string | null;
  subscriberCount: number;
  activeCoupons: ActiveCouponRow[];
}) {
  const initial = name.trim().charAt(0) || "?";
  const industry = businessTypeLabel || partnerKindLabel(partnerKind);
  const visibleCoupons = activeCoupons.slice(0, 3);
  const extra = activeCoupons.length - visibleCoupons.length;
  const addr = address?.trim();

  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
      {/* 헤더 — 이니셜 아바타 + 이름 + 등급 칩 */}
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#E1F5EE] text-lg font-bold text-[#0E4D42]">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-base font-bold text-[#0F172A]">{name}</p>
            <TierChip tier={tier} />
          </div>
          <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">내 매장 명함</p>
        </div>
      </div>

      {/* 업종 · 지역 · 구독수 */}
      <div className="mt-4 space-y-2">
        <ProfileRow Icon={Tag} label="업종" value={industry || "미등록"} muted={!industry} />
        <ProfileRow Icon={MapPin} label="지역" value={addr || "위치 미등록"} muted={!addr} />
        <ProfileRow Icon={Users} label="구독" value={`${subscriberCount.toLocaleString()}명`} />
      </div>

      {/* 진행 중 혜택 (활성 쿠폰) */}
      <div className="mt-4 border-t border-[#F1F5F9] pt-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Ticket className="size-4 text-[#0E4D42]" strokeWidth={2} />
          <h3 className="text-sm font-semibold text-[#0A0A0A]">진행 중 혜택</h3>
        </div>
        {activeCoupons.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">진행 중인 혜택 없음</p>
        ) : (
          <ul className="space-y-1.5">
            {visibleCoupons.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-[#0F172A]">
                  {c.title?.trim() || "쿠폰"}
                </span>
                {c.valid_until ? (
                  <span className="shrink-0 text-xs text-[#94A3B8]">
                    {formatDate(c.valid_until)}까지
                  </span>
                ) : null}
              </li>
            ))}
            {extra > 0 ? (
              <li className="text-xs font-medium text-[#64748B]">외 {extra}개</li>
            ) : null}
          </ul>
        )}
      </div>

      {/* 공동프로모션 만들기 — 비활성(준비 중). piece 4에서 활성화. */}
      <button
        type="button"
        disabled
        aria-disabled
        className="mt-4 flex min-h-[44px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#F5F5F5] px-4 text-sm font-bold text-[#A3A3A3]"
      >
        <Megaphone className="size-4" strokeWidth={2} />
        공동프로모션 만들기
        <span className="text-xs font-semibold">· 준비 중</span>
      </button>
    </section>
  );
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
        {/* 매장 프로필 카드(명함) — 동맹 piece 1. 최상단. 상대 노출/연결은 다음 piece. */}
        {data.partnerId ? (
          <StoreProfileCard
            name={data.partnerName ?? "매장"}
            tier={data.verificationStatus === "approved" ? "biz" : "pb"}
            businessTypeLabel={data.businessTypeLabel}
            partnerKind={data.partnerKind}
            address={data.address}
            subscriberCount={data.subscriberCount}
            activeCoupons={data.activeCoupons}
          />
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
