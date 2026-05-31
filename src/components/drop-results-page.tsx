import { useMemo } from "react";
import {
  ArrowLeft,
  Eye,
  Users,
  Share2,
  Ticket,
  Calendar,
  Phone,
  MapPin,
  TrendingUp,
  MessageCircle,
  Smartphone,
  Instagram,
  Link as LinkIcon,
  MoreHorizontal,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

/**
 * ⑥ 성과 리포트 — 개별 영상(Drop) 성과 카드.
 *
 * 데이터: get_drop_results(p_share_uuid) RPC 1회 호출 결과를 그대로 받아 매핑.
 *   - 조회 = click_count (info_drops.view_count 캐시는 0 고장 — 절대 X)
 *   - 방문자(추정) = unique_visitors_estimate (분모 0이면 전환율 "—")
 *   - 재공유 = reshare_count (v5.5)
 *   - 확정 = confirmed_conversions.coupon_used + estimated_conversions.reservation_confirm
 *     (RPC상 estimated 블록이지만 실제 확정 전환이라 확정 칸 표시)
 *   - 추정 = events.naver_booking_click / phone_click / directions_click
 *     (phone/directions 0이면 숨김 — 현재 UI 미노출)
 *   - 시간대별 = hour_buckets
 *   - 공유 채널 = channels
 *
 * 표현(#16): 클릭=회, 전환=건. 'Drop' 단어 화면 노출 X.
 * 색 토큰(#15): primary #0A0A0A, success #10B981, 흰 배경, Lucide.
 */
export type DropResultsData = {
  share_uuid: string;
  click_count: number | null;
  unique_clicker_count: number | null;
  conversion_count: number | null;
  reshare_count: number | null;
  drop: {
    id: string;
    view_count?: number | null;
    share_count?: number | null;
    conversion_count?: number | null;
  };
  events?: Record<string, number>;
  channels?: Record<string, number>;
  hour_buckets?: Array<{ hour: string; views: number }>;
  confirmed_conversions?: { coupon_used: number };
  estimated_conversions?: Record<string, number>;
  unique_visitors_estimate?: number | null;
};

const CHANNEL_META: Record<
  string,
  { label: string; Icon: typeof MessageCircle }
> = {
  kakao: { label: "카카오톡", Icon: MessageCircle },
  sms: { label: "문자", Icon: Smartphone },
  instagram_dm: { label: "인스타 DM", Icon: Instagram },
  copy_link: { label: "링크 복사", Icon: LinkIcon },
  other: { label: "기타", Icon: MoreHorizontal },
};

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function formatHourLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const h = d.getHours();
  return `${h}시`;
}

export function DropResultsPage({
  report,
  onBack,
}: {
  report: DropResultsData;
  onBack?: () => void;
}) {
  // ── 1. RPC → 화면 매핑 (명세 정확히)
  const views = num(report.click_count);
  const visitors = num(report.unique_visitors_estimate);
  const reshares = num(report.reshare_count);

  const couponUsed = num(report.confirmed_conversions?.coupon_used);
  const reservationConfirm = num(
    report.estimated_conversions?.reservation_confirm,
  );
  const confirmedTotal = couponUsed + reservationConfirm;

  const naverBookingClick = num(report.events?.naver_booking_click);
  const phoneClick = num(report.events?.phone_click);
  const directionsClick = num(report.events?.directions_click);

  // ── 2. 전환율 — (확정 합) / 방문자 × 100. 0 분모 가드.
  const conversionRate = useMemo(() => {
    if (visitors <= 0) return null;
    return (confirmedTotal / visitors) * 100;
  }, [confirmedTotal, visitors]);

  // 헤드라인 표시 — 0 분모/100%+ 캡/정수 반올림. 보조문구(실제 16÷4)는 별도 유지.
  const conversionRateLabel = (() => {
    if (conversionRate === null) return "—";
    if (conversionRate > 100) return "100%+";
    return `${Math.round(conversionRate)}%`;
  })();

  // ── 3. 확정/추정 카드 데이터 (0이어도 표시: 핵심 / 0 숨김: 보조)
  const confirmedRows: Array<{
    id: string;
    Icon: typeof Ticket;
    label: string;
    count: number;
  }> = [
    { id: "coupon_used", Icon: Ticket, label: "쿠폰 사용", count: couponUsed },
    {
      id: "reservation_confirm",
      Icon: Calendar,
      label: "예약 확정",
      count: reservationConfirm,
    },
  ];

  const estimatedRows: Array<{
    id: string;
    Icon: typeof Calendar;
    label: string;
    unit: string;
    count: number;
  }> = [
    {
      id: "naver_booking_click",
      Icon: Calendar,
      label: "예약 클릭",
      unit: "회",
      count: naverBookingClick,
    },
  ];
  // 명세: 전화·길찾기는 값이 0이면 숨김 (UI 미노출 흔적 0 → 빈 지표 노출 금지)
  if (phoneClick > 0) {
    estimatedRows.push({
      id: "phone_click",
      Icon: Phone,
      label: "전화 클릭",
      unit: "회",
      count: phoneClick,
    });
  }
  if (directionsClick > 0) {
    estimatedRows.push({
      id: "directions_click",
      Icon: MapPin,
      label: "길찾기 클릭",
      unit: "회",
      count: directionsClick,
    });
  }

  // ── 4. 채널·시간대 데이터
  const channelEntries = Object.entries(report.channels ?? {});
  const totalShares = channelEntries.reduce((sum, [, v]) => sum + num(v), 0);

  const hourBuckets = (report.hour_buckets ?? []).map((b) => ({
    time: formatHourLabel(b.hour),
    views: num(b.views),
  }));

  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
      {/* 1. 헤더 */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[#F1F5F9] bg-white px-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#0F172A] hover:bg-[#F1F5F9]"
            aria-label="뒤로"
          >
            <ArrowLeft className="size-5" strokeWidth={2} />
          </button>
        ) : null}
        <h1 className="flex-1 truncate text-base font-bold text-[#0F172A]">
          성과
        </h1>
      </header>

      <div className="space-y-4 px-5 pt-5">
        {/* 2. 헤드라인 — 전환율 */}
        <section className="rounded-2xl bg-gradient-to-br from-[#FAFAFA] to-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A0A0A]">
              <TrendingUp className="size-4 text-white" strokeWidth={2} />
            </span>
            <span className="text-sm text-[#475569]">전환율</span>
          </div>
          <p className="mt-3 text-[40px] font-bold leading-none tabular-nums text-[#0F172A]">
            {conversionRateLabel}
          </p>
          <p className="mt-2 text-xs text-[#64748B]">
            확정 {confirmedTotal}건 ÷ 방문자(추정){" "}
            {visitors.toLocaleString()}명 기준
          </p>
        </section>

        {/* 3. 큰 숫자 3개 — 조회·방문자(추정)·재공유 */}
        <section className="grid grid-cols-3 gap-3">
          <BigStat
            Icon={Eye}
            iconBg="#F1F5F9"
            iconColor="#0F172A"
            label="조회"
            value={views}
            unit="회"
          />
          <BigStat
            Icon={Users}
            iconBg="#ECFDF5"
            iconColor="#10B981"
            label="방문자(추정)"
            value={visitors}
            unit="명"
          />
          <BigStat
            Icon={Share2}
            iconBg="#FAFAFA"
            iconColor="#0A0A0A"
            label="재공유"
            value={reshares}
            unit="회"
          />
        </section>

        {/* 4. 확정 카드 */}
        <section className="rounded-2xl bg-[#F1F5F9] p-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0A0A0A] px-2.5 py-1 text-[11px] font-semibold text-white">
            확정
          </span>
          <div className="mt-4 space-y-3">
            {confirmedRows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded-xl bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FAFAFA]">
                    <row.Icon
                      className="size-4 text-[#0A0A0A]"
                      strokeWidth={2}
                    />
                  </span>
                  <span className="text-sm font-medium text-[#334155]">
                    {row.label}
                  </span>
                </div>
                <span className="text-xl font-bold tabular-nums text-[#0F172A]">
                  {row.count.toLocaleString()}
                  <span className="text-sm font-medium text-[#94A3B8]">
                    건
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 5. 추정 카드 */}
        <section className="rounded-2xl bg-white p-5 border border-[#E5E7EB]">
          <span className="inline-flex rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold text-[#64748B]">
            추정
          </span>
          <div className="mt-4 space-y-2">
            {estimatedRows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
                    <row.Icon
                      className="size-4 text-[#64748B]"
                      strokeWidth={2}
                    />
                  </span>
                  <span className="text-sm text-[#475569]">{row.label}</span>
                </div>
                <span className="text-base font-semibold tabular-nums text-[#334155]">
                  {row.count.toLocaleString()}
                  <span className="text-xs font-medium text-[#94A3B8]">
                    {row.unit}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 6. 공유 통계 (channels) */}
        <section className="rounded-2xl bg-white p-5 border border-[#E5E7EB]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#475569]">공유</span>
            <span className="text-lg font-bold tabular-nums text-[#0F172A]">
              {totalShares.toLocaleString()}
              <span className="text-sm font-medium text-[#94A3B8]">건</span>
            </span>
          </div>
          {channelEntries.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#64748B]">
              {channelEntries.map(([code, count]) => {
                const meta = CHANNEL_META[code] ?? {
                  label: code,
                  Icon: MoreHorizontal,
                };
                return (
                  <li
                    key={code}
                    className="inline-flex items-center gap-1.5"
                  >
                    <meta.Icon
                      className="size-3 text-[#94A3B8]"
                      strokeWidth={2}
                    />
                    <span>
                      {meta.label} {num(count).toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[#94A3B8]">아직 공유 기록이 없어요.</p>
          )}
        </section>

        {/* 7. 시간대별 그래프 */}
        {hourBuckets.length > 0 ? (
          <section className="rounded-2xl bg-white p-5 border border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-[#94A3B8]" strokeWidth={2} />
              <span className="text-sm font-medium text-[#475569]">
                시간대별 조회
              </span>
            </div>
            <div className="mt-4 h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourBuckets}>
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "white",
                    }}
                    labelStyle={{ color: "#94A3B8" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="#0A0A0A"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#0A0A0A" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function BigStat({
  Icon,
  iconBg,
  iconColor,
  label,
  value,
  unit,
}: {
  Icon: typeof Eye;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: iconBg }}
        >
          <Icon
            className="size-3.5"
            strokeWidth={2}
            style={{ color: iconColor }}
          />
        </span>
        <span className="text-[11px] text-[#64748B]">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold leading-none tabular-nums text-[#0F172A]">
        {value.toLocaleString()}
        <span className="ml-0.5 text-sm font-medium text-[#94A3B8]">
          {unit}
        </span>
      </p>
    </div>
  );
}
