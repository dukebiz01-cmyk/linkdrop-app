// UI-5-T7-W5b — 우리 동네 공동구매 패널(거울 예외 6호 — Duke v0 확정 디자인 이식·재구현).
//   원본 = v0 zip components/group-buy/group-buy-panel.tsx(574줄) 명세 기반: 구역 7(헤더 카운트다운 ·
//   가격 히어로/승리 화면 · 단계 트랙 · 티저 · 신뢰 고지 · CTA 2단 · 라이브 티커) + gb-* 연출 8종.
//   기술 제약: 의존 = react + lucide-react 만 · "use client" 없음(TanStack Start) · localStorage/Radix 0 ·
//   CSS keyframes 전용(가격 숫자 보간만 rAF — 라이브러리 0) · prefers-reduced-motion 전체 정지 ·
//   props 순수 렌더(자체 fetch 0 — 데이터·실집계는 호출부/W5c 소관) · 숫자 = toLocaleString("ko-KR").
//   다크패턴 금지: 라이브 티커는 실이벤트(lastJoinedAgo) 없으면 섹션 자체 미렌더.
import { useEffect, useRef, useState } from "react";
import { Clock, Users, Trophy, MessageCircle, ChevronDown } from "lucide-react";

const NAVY = "#12233D";
const ORANGE = "#EA580C";
const KAKAO = "#FEE500";

const won = (n: number) => Math.round(n).toLocaleString("ko-KR");

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** ① 헤더 카운트다운 — 실계산(1s tick). 24h 초과 = "N일 HH:MM:SS" 분기 · 만료 = "마감됨". */
function useCountdown(endsAt: string | Date): { label: string; over: boolean } {
  const target = typeof endsAt === "string" ? new Date(endsAt).getTime() : endsAt.getTime();
  const calc = () => {
    const diff = target - Date.now();
    if (!Number.isFinite(target) || diff <= 0) return { label: "마감됨", over: true };
    const s = Math.floor(diff / 1000);
    const days = Math.floor(s / 86400);
    const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return { label: days > 0 ? `마감까지 ${days}일 ${hh}:${mm}:${ss}` : `마감까지 ${hh}:${mm}:${ss}`, over: false };
  };
  const [state, setState] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setState(calc()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return state;
}

export type GroupBuyTier = { qty: number; price: number; reached: boolean };

export function GroupBuyPanel({
  basePrice,
  currentPrice,
  totalQty,
  tiers,
  nextTierQty,
  nextTierPrice,
  endsAt,
  minQty,
  onFailMode,
  lastJoinedAgo = null,
  justJoined = false,
  joinOrder = null,
  shipFeeKrw = null,
  scheduleLabel = null,
  onReserve,
  onInvite,
}: {
  basePrice: number;
  currentPrice: number;
  totalQty: number;
  tiers: GroupBuyTier[];
  nextTierQty: number | null;
  nextTierPrice: number | null;
  endsAt: string | Date;
  minQty: number;
  onFailMode: "base" | "cancel";
  lastJoinedAgo?: string | null;
  justJoined?: boolean;
  joinOrder?: number | null;
  /** W5b-F2 — 배송비 별도(구매자 부담일 때만 호출부가 주입 · null = 미표시 — 무료배송 미표기). */
  shipFeeKrw?: number | null;
  /** W5b-F2 — 시간표 1줄(조립 = 호출부/어댑터 파생 · null = 미표시 — 재료 부재 시 정직 생략). */
  scheduleLabel?: string | null;
  onReserve: () => void;
  onInvite: () => void;
}) {
  const reduced = useReducedMotion();
  const { label: countdown, over } = useCountdown(endsAt);

  // ② 가격 히어로 — 정가→현재가 easeOutCubic 1s 하강(rAF 값 보간 — 라이브러리 0). reduced = 즉시 고정.
  const [shownPrice, setShownPrice] = useState(reduced ? currentPrice : basePrice);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (reduced || currentPrice >= basePrice) {
      setShownPrice(currentPrice);
      return;
    }
    const t0 = performance.now();
    const dur = 1000;
    const tick = (t: number) => {
      const x = Math.min(1, (t - t0) / dur);
      const ease = 1 - Math.pow(1 - x, 3); // easeOutCubic
      setShownPrice(Math.round(basePrice + (currentPrice - basePrice) * ease));
      if (x < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePrice, currentPrice, reduced]);

  const dropped = basePrice - currentPrice;
  const remainToNext = nextTierQty != null ? Math.max(0, nextTierQty - totalQty) : null;

  // ③ 단계 트랙 — 실수량 보간 진행률(구간 내 선형).
  const reachedCount = tiers.filter((t) => t.reached).length;
  const progressPct = (() => {
    if (tiers.length === 0) return 0;
    const nodeW = 100 / tiers.length;
    let pct = 0;
    for (let i = 0; i < tiers.length; i++) {
      const prevQty = i === 0 ? 0 : tiers[i - 1].qty;
      if (totalQty >= tiers[i].qty) pct = nodeW * (i + 1);
      else {
        const span = tiers[i].qty - prevQty;
        pct += span > 0 ? nodeW * Math.max(0, Math.min(1, (totalQty - prevQty) / span)) : 0;
        break;
      }
    }
    return Math.max(0, Math.min(100, pct));
  })();

  return (
    <div className="gbp overflow-hidden rounded-2xl" style={{ boxShadow: "0 0 0 1px #E8E8EC" }}>
      <style>{`
        /* gb-* 연출 8종 — 전부 CSS keyframes · reduced-motion 일괄 정지. */
        @keyframes gb-fill{from{width:0}}
        @keyframes gb-shine{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}
        @keyframes gb-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.75}}
        @keyframes gb-glow{0%,100%{box-shadow:0 0 0 0 rgba(254,229,0,.55)}50%{box-shadow:0 0 0 8px rgba(254,229,0,0)}}
        @keyframes gb-pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
        @keyframes gb-fade-up{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes gb-badge-in{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
        @keyframes gb-ticker-in{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        .gbp .gb-fill{animation:gb-fill .9s cubic-bezier(.25,.8,.3,1) both}
        .gbp .gb-shine{animation:gb-shine 1.6s ease-in-out .9s infinite}
        .gbp .gb-pulse{animation:gb-pulse 1.4s ease-in-out infinite}
        .gbp .gb-glow{animation:gb-glow 1.8s ease-in-out infinite}
        .gbp .gb-pop{animation:gb-pop .5s cubic-bezier(.3,1.4,.5,1) both}
        .gbp .gb-fade-up{animation:gb-fade-up .45s ease-out both}
        .gbp .gb-badge-in{animation:gb-badge-in .5s cubic-bezier(.3,1.4,.5,1) .35s both}
        .gbp .gb-ticker-in{animation:gb-ticker-in .4s ease-out both}
        @media (prefers-reduced-motion: reduce){
          .gbp .gb-fill,.gbp .gb-shine,.gbp .gb-pulse,.gbp .gb-glow,.gbp .gb-pop,.gbp .gb-fade-up,
          .gbp .gb-badge-in,.gbp .gb-ticker-in{animation:none !important}
        }
      `}</style>

      {/* ① 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: NAVY }}>
        <span className="flex items-center gap-1.5 text-[12px] font-bold text-white">
          <Users className="h-3.5 w-3.5" strokeWidth={2.5} />
          우리 동네 공동구매
        </span>
        <span
          className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white"
        >
          <Clock className="h-3 w-3" strokeWidth={2.5} />
          {countdown}
        </span>
      </div>

      <div className="space-y-3 bg-white p-4">
        {justJoined ? (
          /* ② 승리 화면 — justJoined */
          <div className="gb-pop flex flex-col items-center gap-1.5 py-2 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "#FFF4EC", color: ORANGE }}
            >
              <Trophy className="h-6 w-6" strokeWidth={2.25} />
            </span>
            <p className="text-[16px] font-bold" style={{ color: NAVY }}>
              {joinOrder != null ? `${joinOrder.toLocaleString("ko-KR")}번째로 참여했어요!` : "참여했어요!"}
            </p>
            <p className="text-[12px] font-medium text-[#64748B] [word-break:keep-all]">
              함께하는 분이 늘수록 모두의 가격이 내려가요
            </p>
          </div>
        ) : (
          /* ② 가격 히어로 */
          <div className="gb-fade-up">
            <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
              <span className="text-[34px] font-bold leading-none tabular-nums" style={{ color: NAVY }}>
                {won(shownPrice)}원
              </span>
              {dropped > 0 && (
                <span className="text-[14px] font-semibold text-[#94A3B8] line-through tabular-nums">
                  {won(basePrice)}원
                </span>
              )}
              {dropped > 0 && (
                <span
                  className="gb-badge-in rounded-full px-2 py-0.5 text-[11px] font-bold text-white tabular-nums"
                  style={{ backgroundColor: ORANGE }}
                >
                  {won(dropped)}원 내려감
                </span>
              )}
            </div>
            {remainToNext != null && nextTierPrice != null && remainToNext > 0 && (
              <p className="mt-1.5 text-[12.5px] font-semibold [word-break:keep-all]" style={{ color: ORANGE }}>
                {remainToNext.toLocaleString("ko-KR")}명 더 참여하면 {won(nextTierPrice)}원으로 또 내려가요
              </p>
            )}
            {/* W5b-F2 — 배송비 별도 1줄(구매자 부담일 때만 · 무료배송 = 미표시). */}
            {shipFeeKrw != null && shipFeeKrw > 0 && (
              <p className="mt-1 text-[11.5px] font-medium text-[#64748B] tabular-nums">
                배송비 {won(shipFeeKrw)}원 별도
              </p>
            )}
            {totalQty > 0 && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-[#64748B]">
                <span className="flex -space-x-1.5">
                  {Array.from({ length: Math.min(3, totalQty) }).map((_, i) => (
                    <span
                      key={i}
                      className="flex h-4 w-4 items-center justify-center rounded-full border border-white text-[8px] font-bold text-white"
                      style={{ backgroundColor: i === 0 ? ORANGE : i === 1 ? NAVY : "#64748B" }}
                    >
                      <Users className="h-2 w-2" strokeWidth={3} />
                    </span>
                  ))}
                </span>
                이웃 {totalQty.toLocaleString("ko-KR")}명 참여 중
              </p>
            )}
          </div>
        )}

        {/* ③ 할인 단계 트랙 */}
        {tiers.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center justify-between text-[11px] font-bold">
              <span style={{ color: reachedCount > 0 ? ORANGE : "#64748B" }}>
                {reachedCount > 0 ? `지금 ${reachedCount}단계 할인 중` : "할인 단계"}
              </span>
              <span className="text-[#94A3B8]">최대 {tiers.length}단계</span>
            </p>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
              <div
                className="gb-fill relative h-full overflow-hidden rounded-full"
                style={{ width: `${progressPct}%`, backgroundColor: ORANGE }}
              >
                <span
                  className="gb-shine absolute inset-y-0 w-1/3"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.6), transparent)" }}
                />
              </div>
            </div>
            <div className="mt-1.5 flex justify-between">
              {tiers.map((t, i) => {
                const isCurrent = t.reached && (i === tiers.length - 1 || !tiers[i + 1].reached);
                const isNext = !t.reached && (i === 0 ? true : tiers[i - 1].reached);
                return (
                  <div key={i} className="flex min-w-0 flex-col items-center gap-0.5">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${isNext ? "gb-pulse" : ""}`}
                      style={{
                        backgroundColor: t.reached ? ORANGE : "#CBD5E1",
                        boxShadow: isCurrent ? `0 0 0 3px rgba(234,88,12,.25)` : undefined,
                      }}
                    />
                    <span
                      className="text-[10px] font-bold tabular-nums"
                      style={{ color: t.reached ? NAVY : "#94A3B8" }}
                    >
                      {t.qty.toLocaleString("ko-KR")}명
                    </span>
                    <span
                      className="text-[10px] font-semibold tabular-nums"
                      style={{ color: t.reached ? ORANGE : "#94A3B8" }}
                    >
                      {won(t.price)}원
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ④ 다음 레벨 티저 — 남은 15명 이내 = 펄스 */}
        {!justJoined && remainToNext != null && nextTierPrice != null && remainToNext > 0 && (
          <p
            className={`rounded-xl px-3 py-2 text-center text-[12.5px] font-bold [word-break:keep-all] ${remainToNext <= 15 ? "gb-pulse" : ""}`}
            style={{ backgroundColor: "#FFF4EC", color: ORANGE }}
          >
            {remainToNext.toLocaleString("ko-KR")}명만 더 모이면 {won(nextTierPrice)}원으로 내려가요!
          </p>
        )}

        {/* W5b-F2 — 시간표 1줄(신뢰 고지 위 · null = 미표시). */}
        {scheduleLabel && (
          <p className="flex items-center gap-1.5 rounded-lg bg-[#F8FAFC] px-3 py-1.5 text-[11.5px] font-semibold text-[#475569] tabular-nums [word-break:keep-all]">
            <Clock className="h-3 w-3 flex-none" strokeWidth={2.5} />
            {scheduleLabel}
          </p>
        )}

        {/* ⑤ 신뢰 고지 2줄 — failMode 분기 */}
        <div className="space-y-1 rounded-xl bg-[#F8FAFC] px-3 py-2.5">
          <p className="flex items-start gap-1.5 text-[11.5px] font-medium leading-relaxed text-[#475569] [word-break:keep-all]">
            <ChevronDown className="mt-0.5 h-3 w-3 flex-none rotate-[-90deg]" strokeWidth={2.5} />
            마감되면 가장 낮은 가격으로 모두 똑같이 결제돼요
          </p>
          <p className="flex items-start gap-1.5 text-[11.5px] font-medium leading-relaxed text-[#475569] [word-break:keep-all]">
            <ChevronDown className="mt-0.5 h-3 w-3 flex-none rotate-[-90deg]" strokeWidth={2.5} />
            {onFailMode === "base"
              ? `${minQty.toLocaleString("ko-KR")}명이 안 모여도 기본 가격으로 안전하게 받아요`
              : `${minQty.toLocaleString("ko-KR")}명이 안 모이면 주문이 자동 취소되고 결제는 없어요`}
          </p>
        </div>

        {/* ⑥ CTA 2단 — justJoined = 초대 단독 */}
        <div className="space-y-2">
          {!justJoined && (
            <button
              type="button"
              onClick={onReserve}
              disabled={over}
              className="flex min-h-[48px] w-full items-center justify-center rounded-xl text-[14px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-45"
              style={{ backgroundColor: NAVY }}
            >
              참여하기
            </button>
          )}
          <button
            type="button"
            onClick={onInvite}
            className="gb-glow flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-xl text-[14px] font-bold transition-transform active:scale-[0.98]"
            style={{ backgroundColor: KAKAO, color: "#191919" }}
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2.5} fill="#191919" />
            카카오톡 친구초대
          </button>
          <p className="text-center text-[11px] font-medium text-[#94A3B8] [word-break:keep-all]">
            {justJoined ? "함께하는 분이 늘수록 모두의 가격이 내려가요" : "참여 후 가격이 내려가면 그대로 적용돼요"}
          </p>
        </div>

        {/* ⑦ 라이브 티커 — 실이벤트 없으면 미렌더(다크패턴 금지 · W5b 호출부 = null 고정). */}
        {lastJoinedAgo && (
          <p className="gb-ticker-in flex items-center gap-1.5 rounded-lg bg-[#F1F5F9] px-3 py-1.5 text-[11px] font-semibold text-[#475569]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ORANGE }} />
            {lastJoinedAgo} 새로운 이웃이 참여했어요
          </p>
        )}
      </div>
    </div>
  );
}
