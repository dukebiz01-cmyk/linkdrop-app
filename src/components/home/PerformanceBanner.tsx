import type { ComponentType } from "react";
import { Target, Gift, Heart } from "lucide-react";

/**
 * PerformanceBanner — 홈 최상단 "이번 달 내 성과" 스트립(V4: divide-x 헤어라인 + StatCell).
 *
 * placeholder 단계: 데이터 배선 추후. 지금은 호출부가 0을 주입(RPC 0).
 * subscriberCount 주면 3셀(상인홈), 미주입이면 2셀(유저홈). props 계약·호출부 불변.
 * 전환 = blue accent(#2563EB) 강조. 이모지 0, Lucide만.
 */
function StatCell({
  icon: Icon,
  label,
  value,
  unit,
  accent = false,
  pending = false,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string | number;
  unit: string;
  accent?: boolean;
  // 락(T1 1e8086d 정책) — 드로피 숫자 노출 금지. pending=true 면 숫자 대신 "준비중" 고정 표기.
  pending?: boolean;
}) {
  // STEP 3 v0 룩 — 숫자 천단위 구분(toLocaleString). 값 로직·placeholder(0)는 호출부 유지.
  const display = typeof value === "number" ? value.toLocaleString() : value;
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-2 py-4">
      <div className="mb-2 flex items-center gap-1">
        <Icon
          className={`size-3.5 ${accent ? "text-[#2563EB]" : "text-[#94A3B8]"}`}
          strokeWidth={2}
        />
        <span className="text-[11.5px] font-semibold text-[#64748B]">{label}</span>
      </div>
      {pending ? (
        // 드로피 준비중 — 숫자/원화 표기 금지 락. 위계는 유지(라벨-값 세로 정렬) 하되 값 자리에 준비중.
        <span className="text-[15px] font-semibold leading-none tracking-[-0.01em] text-[#94A3B8]">
          준비중
        </span>
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
  conversionCount = 0,
  subscriberCount,
}: {
  // 작업2/7 — 전환·구독자 = 실값 배선(호출부에서 실제 집계 주입). dropyAmount 는 락으로 제거(준비중 고정).
  conversionCount?: number;
  subscriberCount?: number;
}) {
  return (
    <div className="flex divide-x divide-[#EAEEF3] overflow-hidden rounded-2xl border border-[#E8EDF3] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)]">
      <StatCell icon={Target} label="전환" value={conversionCount} unit="건" accent />
      {/* 적립 = 드로피 → 숫자 노출 락(T1 1e8086d): "준비중" 고정 표기. */}
      <StatCell icon={Gift} label="적립" value="" unit="" pending />
      {/* 구독자 — 상인홈 전용(subscriberCount 주입 시 3셀). 미주입이면 2셀(유저홈). */}
      {subscriberCount !== undefined ? (
        <StatCell icon={Heart} label="구독자" value={subscriberCount} unit="명" />
      ) : null}
    </div>
  );
}
