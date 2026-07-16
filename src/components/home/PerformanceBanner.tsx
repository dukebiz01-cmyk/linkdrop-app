import { type ComponentType, useCallback, useEffect, useState } from "react";
import { Target, Gift, Heart } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

/**
 * PerformanceBanner — 홈 최상단 "내 성과" 스트립(V4: divide-x 헤어라인 + StatCell).
 *
 * 작업2(정본 정렬): 전환 = get_creator_performance 30d 실값(자체 fetch, 라벨 "최근 30일 전환").
 *   적립 = 드로피 숫자 락(T1 1e8086d) → "준비중" 고정. 구독자 = 호출부 실값(상인홈).
 * 정본 §5(상태 3종): 전환 셀 = 로딩(스켈레톤)/값/에러(다시 1버튼). 0 하드코딩으로 빈 상태 때우기 금지.
 * subscriberCount 주면 3셀(상인홈), 미주입이면 2셀(유저홈).
 */
function StatCell({
  icon: Icon,
  label,
  value,
  unit,
  accent = false,
  pending = false,
  loading = false,
  onRetry,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string | number;
  unit: string;
  accent?: boolean;
  // 락(T1 1e8086d) — 드로피 숫자 노출 금지. pending=true 면 숫자 대신 "준비중".
  pending?: boolean;
  // 정본 §5 — 로딩(스켈레톤) / 에러(onRetry 있으면 "다시" 버튼).
  loading?: boolean;
  onRetry?: () => void;
}) {
  const display = typeof value === "number" ? value.toLocaleString() : value;
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-2 py-4">
      <div className="mb-2 flex items-center gap-1">
        <Icon className={`size-3.5 ${accent ? "text-[#2563EB]" : "text-[#94A3B8]"}`} strokeWidth={2} />
        <span className="text-[11.5px] font-semibold text-[#64748B]">{label}</span>
      </div>
      {pending ? (
        <span className="text-[15px] font-semibold leading-none tracking-[-0.01em] text-[#94A3B8]">준비중</span>
      ) : loading ? (
        <span className="mt-0.5 h-[22px] w-9 animate-pulse rounded-md bg-[#EAEEF3]" aria-label="불러오는 중" />
      ) : onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-[44px] text-[12px] font-semibold text-[#94A3B8] underline underline-offset-2 hover:text-[#64748B]"
        >
          다시
        </button>
      ) : (
        <div className="flex items-baseline gap-1">
          <span
            className="text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums"
            style={{ color: accent ? "#2563EB" : "#0F172A" }}
          >
            {display}
          </span>
          <span className="text-[11.5px] font-semibold text-[#94A3B8]">{unit}</span>
        </div>
      )}
    </div>
  );
}

export function PerformanceBanner({
  subscriberCount,
}: {
  subscriberCount?: number;
}) {
  // 전환 = get_creator_performance 30d 실값(자체 fetch). null=로딩, err=실패.
  const [conv, setConv] = useState<number | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    setErr(false);
    setConv(null);
    try {
      const { data, error } = await getSupabase().rpc("get_creator_performance", { p_period: "30d" });
      if (error || !data) { setErr(true); return; }
      const totals = (data as { totals?: { conversions?: number } }).totals;
      setConv(totals?.conversions ?? 0);
    } catch {
      setErr(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="flex divide-x divide-[#EAEEF3] overflow-hidden rounded-2xl border border-[#E8EDF3] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)]">
      <StatCell
        icon={Target}
        label="최근 30일 전환"
        value={conv ?? 0}
        unit="건"
        accent
        loading={conv === null && !err}
        onRetry={err ? load : undefined}
      />
      {/* 적립 = 드로피 → 숫자 노출 락(T1 1e8086d): "준비중" 고정. */}
      <StatCell icon={Gift} label="적립" value="" unit="" pending />
      {/* 구독자 — 상인홈 전용(subscriberCount 주입 시 3셀). 미주입이면 2셀(유저홈). */}
      {subscriberCount !== undefined ? (
        <StatCell icon={Heart} label="구독자" value={subscriberCount} unit="명" />
      ) : null}
    </div>
  );
}
