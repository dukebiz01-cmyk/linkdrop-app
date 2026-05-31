import { ArrowLeft, Share2, MessageCircle, Smartphone, Instagram, Link as LinkIcon, MoreHorizontal, BadgeCheck, Clock4, TrendingUp } from "lucide-react";
import { ReportMetricsHero, type MetricData } from "@/components/report-metrics-hero";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

export type DropResultsData = {
  share_uuid: string;
  click_count: number | null;
  unique_clicker_count: number | null;
  conversion_count: number | null;
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

// share_channel enum 라벨 (메모리 #16 — 한국어, share_uuid/enum 키 노출 X)
const CHANNEL_META: Record<string, { label: string; Icon: typeof MessageCircle }> = {
  kakao: { label: "카카오톡", Icon: MessageCircle },
  sms: { label: "문자", Icon: Smartphone },
  instagram_dm: { label: "인스타 DM", Icon: Instagram },
  copy_link: { label: "링크 복사", Icon: LinkIcon },
  other: { label: "기타", Icon: MoreHorizontal },
};

// conversion_type enum + v5.4 lifecycle_events 화이트리스트 라벨 (메모리 #16 — 화면 한글만)
const CONVERSION_LABELS: Record<string, string> = {
  // conversion_events.conversion_type (확정성 시그널)
  coupon_use: "쿠폰 사용",
  reservation_confirm: "예약 확정",
  sale_complete: "구매 완료",
  ticket_purchase: "티켓 구매",
  ticket_checkin: "티켓 체크인",
  lead_approved: "상담 승인",
  // v5.4: lifecycle_events 추정 시그널 (외부 클릭)
  reservation_click: "예약 클릭 (추정)",
  phone_click: "전화 문의 클릭 (추정)",
  directions_click: "길찾기 클릭 (추정)",
  share_click: "공유 클릭 (추정)",
};

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function DropResultsPage({
  report,
  onBack,
}: {
  report: DropResultsData;
  onBack?: () => void;
}) {
  const clicks = num(report.click_count);
  const visitors = num(report.unique_visitors_estimate);
  const conversions = num(report.conversion_count);

  const metrics: MetricData[] = [
    { label: "조회수", value: clicks, unit: "회" },
    { label: "고유 방문자", value: visitors, unit: "명" },
    { label: "전환", value: conversions, unit: "건" },
  ];

  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
      <header className="flex items-center gap-3 bg-white px-5 py-4 border-b border-[#F1F5F9]">
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
        <h1 className="text-lg font-bold text-[#0F172A]">카드 성과</h1>
      </header>

      <div className="px-5 pt-5 space-y-4">
        {/* ① 요약 (블록 1·2 + 전환) */}
        <ReportMetricsHero title="이 카드의 성과" metrics={metrics} />
        {clicks === 0 ? (
          <EmptyHint text="아직 조회가 없어요. 공유를 더 늘려보세요." />
        ) : null}

        {/* ② 채널 분해 */}
        <ChannelsCard channels={report.channels ?? {}} />

        {/* ③ 전환 결과 — 확정/추정 분리 */}
        <ConversionsCard
          confirmedCoupon={num(report.confirmed_conversions?.coupon_used)}
          estimated={report.estimated_conversions ?? {}}
        />

        {/* ④ 시간대 차트 */}
        <HoursCard buckets={report.hour_buckets ?? []} />
      </div>
    </main>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="text-xs text-[#64748B] px-1">{text}</p>
  );
}

function CardShell({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: typeof Share2;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="size-4 text-[#0A0A0A]" strokeWidth={2} />
        <h3 className="text-sm font-semibold text-[#0A0A0A]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ChannelsCard({ channels }: { channels: Record<string, number> }) {
  // 정의된 채널 순서 + 그 외(other)는 마지막에
  const order = ["kakao", "sms", "instagram_dm", "copy_link", "other"];
  const total = Object.values(channels).reduce((a, b) => a + b, 0);

  return (
    <CardShell title="공유 채널" Icon={Share2}>
      {total === 0 ? (
        <p className="text-sm text-[#64748B]">
          아직 공유 기록이 없어요. 친구에게 카드를 보내보세요.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {order.map((key) => {
            const cnt = channels[key] ?? 0;
            if (cnt === 0) return null;
            const meta = CHANNEL_META[key] ?? CHANNEL_META.other;
            const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
            const Icon = meta.Icon;
            return (
              <li key={key} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9]">
                  <Icon className="size-4 text-[#475569]" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-[#0F172A]">{meta.label}</span>
                    <span className="text-sm font-semibold text-[#0F172A] tabular-nums">
                      {cnt.toLocaleString()}건
                      <span className="ml-1 text-xs font-normal text-[#64748B]">({pct}%)</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#F1F5F9]">
                    <div
                      className="h-full rounded-full bg-[#0A0A0A]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </CardShell>
  );
}

function ConversionsCard({
  confirmedCoupon,
  estimated,
}: {
  confirmedCoupon: number;
  estimated: Record<string, number>;
}) {
  const estTotal = Object.values(estimated).reduce((a, b) => a + b, 0);
  const isEmpty = confirmedCoupon === 0 && estTotal === 0;

  return (
    <CardShell title="전환 결과" Icon={TrendingUp}>
      {isEmpty ? (
        <p className="text-sm text-[#64748B]">
          전환은 첫 쿠폰 사용·예약 클릭부터 보여드려요.
        </p>
      ) : (
        <div className="space-y-4">
          {/* 확정 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <BadgeCheck className="size-3.5 text-[#059669]" strokeWidth={2} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#059669]">
                확정
              </span>
              <span className="ml-1 text-[10px] text-[#64748B]">매장에서 실제 사용</span>
            </div>
            <div className="rounded-xl bg-[#ECFDF5] px-4 py-3 flex items-baseline justify-between">
              <span className="text-sm font-medium text-[#065F46]">쿠폰 사용</span>
              <span className="text-xl font-bold text-[#065F46] tabular-nums">
                {confirmedCoupon.toLocaleString()}
                <span className="ml-0.5 text-sm font-medium">건</span>
              </span>
            </div>
          </div>

          {/* 추정 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Clock4 className="size-3.5 text-[#D97706]" strokeWidth={2} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#D97706]">
                추정
              </span>
              <span className="ml-1 text-[10px] text-[#64748B]">아직 확인 안 된 시그널</span>
            </div>
            {estTotal === 0 ? (
              <p className="rounded-xl bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
                아직 추정 전환이 없어요.
              </p>
            ) : (
              <ul className="rounded-xl bg-[#FFFBEB] divide-y divide-[#FEF3C7]">
                {Object.entries(estimated)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, cnt]) => (
                    <li
                      key={type}
                      className="flex items-baseline justify-between px-4 py-2.5"
                    >
                      <span className="text-sm font-medium text-[#92400E]">
                        {CONVERSION_LABELS[type] ?? type}
                      </span>
                      <span className="text-sm font-semibold text-[#92400E] tabular-nums">
                        {cnt.toLocaleString()}건
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </CardShell>
  );
}

function HoursCard({ buckets }: { buckets: Array<{ hour: string; views: number }> }) {
  const data = buckets.map((b) => {
    const d = new Date(b.hour);
    const hh = Number.isNaN(d.getTime()) ? "" : String(d.getHours()).padStart(2, "0");
    return { hour: hh ? `${hh}시` : b.hour, views: num(b.views) };
  });
  const maxViews = Math.max(0, ...data.map((d) => d.views));

  return (
    <CardShell title="시간대별 조회" Icon={Clock4}>
      {data.length === 0 ? (
        <p className="text-sm text-[#64748B]">
          데이터가 쌓이면 시간대별로 보여드려요.
        </p>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11, fill: "#64748B" }}
                tickLine={false}
                axisLine={{ stroke: "#E2E8F0" }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#64748B" }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Bar dataKey="views" radius={[4, 4, 0, 0]}>
                {data.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.views === maxViews && maxViews > 0 ? "#0A0A0A" : "#93C5FD"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardShell>
  );
}
