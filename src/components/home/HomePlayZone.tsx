import { useState } from "react";
import { Flame, Check, Gift, Sparkles, Share2, Ticket, Eye, Zap } from "lucide-react";
import { toast } from "sonner";

/**
 * HomePlayZone — DROPY 이벤트존(출석 스트릭 · 데일리 미션 · 룰렛). v0-44 정본 이식.
 *
 * ★ 오픈 준비중 게이트(전면): 적립 실행(출석하기·미션 완료·룰렛 돌리기)은 전부 잠금 —
 *   탭하면 정직 안내 toast("곧 열려요" 톤, Dropy Mall 준비중 선례). 시각 연출(탭 전환·
 *   7일 그리드·룰렛 휠)은 정본 그대로 구경 가능, 실행만 잠금.
 * ★ 실지급 배선 0: dropy 적립 RPC·원장·잔액 변경 없음. 가짜 적립 연출(획득 토스트·
 *   잔액 증가)도 금지라 정본의 earn 토스트는 제거. onEarn prop 은 계약만 이식(미배선,
 *   오픈 시 재배선) — 어떤 경로에서도 호출되지 않는다.
 * ★ 정본 대비 변환: 데모 mock 제거(출석 3일·미션 진행 1/2 가정 → 전부 미진행 초기 상태),
 *   이모지(🎉) 제거(Lucide만), 헤더 배지 "매일 리셋" → "오픈 준비 중"(무채색 칩).
 *   색 팔레트·레이아웃은 정본 유지.
 */

type PlayZoneProps = {
  /** 획득한 드로피 상위 전달용(잔액 반영) — 오픈 준비중이라 미배선. 오픈 시 재배선. */
  onEarn?: (amount: number, source: string) => void;
  /** v0-45 — 풀스크린 화면(RoleHome DropyEventScreen)이 자체 헤더를 가져 내부 제목 블록 숨김. */
  hideHeading?: boolean;
};

type EventTab = "attendance" | "mission" | "roulette";

const EVENT_TABS: { id: EventTab; label: string; icon: typeof Flame }[] = [
  { id: "attendance", label: "출석", icon: Flame },
  { id: "mission", label: "미션", icon: Zap },
  { id: "roulette", label: "룰렛", icon: Sparkles },
];

// 오픈 준비중 게이트 — 모든 적립 실행 버튼의 공통 탭 응답(정직 표기, 가짜 성공 금지).
function notifyComingSoon() {
  toast.info("드로피 적립은 오픈 준비 중이에요. 곧 열려요.");
}

export function HomePlayZone({ onEarn, hideHeading = false }: PlayZoneProps) {
  void onEarn; // 실지급 배선 금지(§0) — 게이트 해제 시 재배선.
  const [tab, setTab] = useState<EventTab>("attendance");

  return (
    <section>
      {!hideHeading && (
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-lg bg-[#2563EB]">
            <Sparkles className="size-3.5 text-white" strokeWidth={2.5} />
          </span>
          <h2 className="text-[16px] font-bold tracking-[-0.01em] text-[#0F172A]">DROPY 이벤트</h2>
          {/* 배지 — 정본 "매일 리셋"(미가동이라 거짓) 대신 정직 표기. Dropy Mall 준비중 칩 톤. */}
          <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-bold text-[#64748B]">
            오픈 준비 중
          </span>
        </div>
      )}

      {/* 내부 탭 — 정본 그대로(전환 동작 유지). */}
      <div className="mb-3 flex gap-1.5 rounded-2xl bg-[#F1F5F9] p-1">
        {EVENT_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold transition-all duration-150 ${
                active ? "bg-white text-[#0F172A] shadow-[0_2px_6px_rgba(15,23,42,0.08)]" : "text-[#94A3B8]"
              }`}
            >
              <t.icon className={`size-4 ${active ? "text-[#2563EB]" : "text-[#94A3B8]"}`} strokeWidth={2.5} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div>
        {tab === "attendance" && <AttendanceStreak />}
        {tab === "mission" && <DailyMissions />}
        {tab === "roulette" && <DropyRoulette />}
      </div>
      {/* 정본의 획득 토스트(+N dropy)는 제거 — 실지급 없는데 획득 연출 = 가짜 성공 금지. */}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// ① 출석 체크 스트릭 — mock(3일 가정) 제거: 0일 미진행 초기 상태.
// ─────────────────────────────────────────────────────────────

const STREAK_REWARDS = [5, 5, 10, 10, 15, 15, 50]; // 7일차 보너스

function AttendanceStreak() {
  const checkedDays = 0; // 미진행 초기 상태(오픈 준비중 — 진행 데이터 없음).
  const todayIndex = checkedDays;

  return (
    <div className="rounded-2xl border border-[#E8EDF3] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)]">
      <div className="mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[#FFF1E9]">
            <Flame className="size-4 text-[#F97316]" strokeWidth={2.5} />
          </span>
          <div className="flex flex-col">
            <span className="text-[13.5px] font-bold leading-tight text-[#0F172A]">출석 체크</span>
            <span className="text-[11px] font-medium leading-tight text-[#94A3B8]">
              <b className="text-[#F97316]">{checkedDays}일</b> 연속 · 7일차 보너스 +50
            </span>
          </div>
        </div>
      </div>

      {/* 7일 그리드 — 정본 시각 그대로(구경 가능). */}
      <div className="mb-3.5 flex items-center justify-between gap-1.5">
        {STREAK_REWARDS.map((reward, i) => {
          const isChecked = i < checkedDays;
          const isToday = i === todayIndex;
          const isBonus = i === 6;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`flex aspect-square w-full items-center justify-center rounded-xl text-[11px] font-bold transition-all duration-200 ${
                  isChecked
                    ? "bg-[#2563EB] text-white"
                    : isToday
                    ? "bg-[#EFF6FF] text-[#2563EB] ring-2 ring-inset ring-[#2563EB]"
                    : isBonus
                    ? "bg-[#FFF7ED] text-[#F97316]"
                    : "bg-[#F1F5F9] text-[#94A3B8]"
                }`}
              >
                {isChecked ? (
                  <Check className="size-4" strokeWidth={3} />
                ) : isBonus ? (
                  <Gift className="size-4" strokeWidth={2.5} />
                ) : (
                  `+${reward}`
                )}
              </div>
              <span className={`text-[9.5px] font-semibold ${isToday ? "text-[#2563EB]" : "text-[#CBD5E1]"}`}>
                {i + 1}일
              </span>
            </div>
          );
        })}
      </div>

      {/* 적립 실행 버튼 — 오픈 준비중 게이트: 비활성 스타일 + 탭 시 안내(HTML disabled 는
          onClick 을 삼켜 안내 불가라 스타일만 비활성). 정본의 출석 적립 로직 미이식. */}
      <button
        type="button"
        onClick={notifyComingSoon}
        aria-disabled="true"
        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#F1F5F9] text-[14px] font-bold text-[#94A3B8] transition-all duration-150 active:scale-[0.98]"
      >
        <Flame className="size-4" strokeWidth={2.5} />
        오늘 출석하고 +{STREAK_REWARDS[todayIndex]} 받기 — 준비 중
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ② 데일리 미션 — mock(진행 1/2 가정) 제거: 전부 0 진행 초기 상태.
// ─────────────────────────────────────────────────────────────

type Mission = {
  id: string;
  icon: typeof Share2;
  label: string;
  reward: number;
  goal: number;
  progress: number;
};

const INITIAL_MISSIONS: Mission[] = [
  { id: "share", icon: Share2, label: "카드 1개 공유하기", reward: 20, goal: 1, progress: 0 },
  { id: "browse", icon: Eye, label: "카드 3개 구경하기", reward: 10, goal: 3, progress: 0 },
  { id: "coupon", icon: Ticket, label: "쿠폰 사용하기", reward: 30, goal: 1, progress: 0 },
];

function DailyMissions() {
  const missions = INITIAL_MISSIONS;

  return (
    <div className="rounded-2xl border border-[#E8EDF3] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[#EFF6FF]">
            <Zap className="size-4 text-[#2563EB]" strokeWidth={2.5} />
          </span>
          <span className="text-[13.5px] font-bold text-[#0F172A]">데일리 미션</span>
        </div>
        <span className="text-[11.5px] font-semibold text-[#94A3B8]">0/{missions.length} 완료</span>
      </div>

      <div className="flex flex-col gap-2">
        {missions.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-xl bg-[#F8FAFC] px-3 py-2.5">
            <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-inset ring-[#E8EDF3]">
              <m.icon className="size-4 text-[#475569]" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[#0F172A]">{m.label}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#E8EDF3]">
                  <div
                    className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
                    style={{ width: `${Math.min(100, (m.progress / m.goal) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold tabular-nums text-[#94A3B8]">
                  {Math.min(m.progress, m.goal)}/{m.goal}
                </span>
              </div>
            </div>
            {/* 보상 수령 버튼 — 오픈 준비중 게이트(비활성 스타일 + 탭 시 안내). */}
            <button
              type="button"
              onClick={notifyComingSoon}
              aria-disabled="true"
              className="flex h-8 flex-shrink-0 items-center gap-1 rounded-lg bg-[#F1F5F9] px-2.5 text-[12px] font-bold text-[#CBD5E1] transition-all duration-150 active:scale-95"
            >
              <Gift className="size-3" strokeWidth={2.5} />+{m.reward}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ③ 드로피 룰렛 — 휠 시각은 정본 그대로(구경 가능), 스핀 실행만 잠금.
// ─────────────────────────────────────────────────────────────

const WHEEL = [10, 5, 30, 5, 20, 100, 10, 50]; // 8칸
const SEG = 360 / WHEEL.length;
const WHEEL_COLORS = ["#2563EB", "#0F172A"];

function DropyRoulette() {
  // conic-gradient 배경 — 정본 동일.
  const conic = `conic-gradient(${WHEEL.map((_, i) => {
    const c = WHEEL_COLORS[i % 2];
    return `${c} ${i * SEG}deg ${(i + 1) * SEG}deg`;
  }).join(", ")})`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E8EDF3] bg-gradient-to-b from-[#0F172A] to-[#1E293B] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-white/10">
          <Sparkles className="size-4 text-[#60A5FA]" strokeWidth={2.5} />
        </span>
        <span className="text-[13.5px] font-bold text-white">드로피 룰렛</span>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] font-bold text-[#B6C2D2]">
          오픈 준비 중
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* 휠 — 정본 시각 그대로(정지 상태 구경). */}
        <div className="relative flex-shrink-0" style={{ width: 132, height: 132 }}>
          {/* 포인터 */}
          <div
            className="absolute left-1/2 top-[-2px] z-20 -translate-x-1/2"
            style={{ width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "14px solid #F97316" }}
          />
          <div className="relative size-[132px] rounded-full ring-4 ring-white/15" style={{ background: conic }}>
            {WHEEL.map((amount, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 text-[12px] font-extrabold tabular-nums text-white"
                style={{
                  transform: `rotate(${i * SEG + SEG / 2}deg) translateY(-44px) rotate(${-(i * SEG + SEG / 2)}deg)`,
                  transformOrigin: "0 0",
                }}
              >
                {amount}
              </span>
            ))}
          </div>
          {/* 중앙 허브 */}
          <div className="absolute left-1/2 top-1/2 z-10 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg">
            <Gift className="size-4 text-[#2563EB]" strokeWidth={2.5} />
          </div>
        </div>

        {/* 우측: 안내 + 버튼(오픈 준비중 게이트 — 스핀·당첨·적립 미실행). */}
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="mb-3 text-[12.5px] font-medium leading-relaxed text-[#B6C2D2]">
            돌려서 최대 <b className="text-white">100 dropy</b>를 받는 룰렛을 준비하고 있어요
          </p>
          <button
            type="button"
            onClick={notifyComingSoon}
            aria-disabled="true"
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-white/10 text-[14px] font-bold text-[#94A3B8] transition-all duration-150 active:scale-[0.98]"
          >
            룰렛 돌리기 — 준비 중
          </button>
        </div>
      </div>
    </div>
  );
}
