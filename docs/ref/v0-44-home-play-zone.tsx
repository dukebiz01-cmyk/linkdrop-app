"use client";

import { useEffect, useRef, useState } from "react";
import { Flame, Check, Gift, Sparkles, ChevronRight, Share2, Ticket, Eye, Zap } from "lucide-react";

const POINT = "#2563EB";
const INK = "#0F172A";

// ─────────────────────────────────────────────────────────────
// Dropy Play Zone — 일반 유저 리텐션: 출석 스트릭 · 데일리 미션 · 룰렛
// ─────────────────────────────────────────────────────────────

type PlayZoneProps = {
  /** 획득한 드로피를 상위로 전달 (잔액 반영용) */
  onEarn?: (amount: number, source: string) => void;
};

type EventTab = "attendance" | "mission" | "roulette";

const EVENT_TABS: { id: EventTab; label: string; icon: typeof Flame }[] = [
  { id: "attendance", label: "출석", icon: Flame },
  { id: "mission", label: "미션", icon: Zap },
  { id: "roulette", label: "룰렛", icon: Sparkles },
];

export function HomePlayZone({ onEarn }: PlayZoneProps) {
  const [toast, setToast] = useState<{ amount: number; label: string } | null>(null);
  const [tab, setTab] = useState<EventTab>("attendance");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const earn = (amount: number, label: string) => {
    onEarn?.(amount, label);
    setToast({ amount, label });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-lg bg-[#2563EB]">
          <Sparkles className="size-3.5 text-white" strokeWidth={2.5} />
        </span>
        <h2 className="text-[16px] font-bold tracking-[-0.01em] text-[#0F172A]">DROPY 이벤트</h2>
        <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-bold text-[#2563EB]">
          매일 리셋
        </span>
      </div>

      {/* 내부 탭 */}
      <div className="mb-3 flex gap-1.5 rounded-2xl bg-[#F1F5F9] p-1">
        {EVENT_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
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
        {tab === "attendance" && <AttendanceStreak onEarn={earn} />}
        {tab === "mission" && <DailyMissions onEarn={earn} />}
        {tab === "roulette" && <DropyRoulette onEarn={earn} />}
      </div>

      {/* 획득 토스트 */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div className="animate-slide-up flex items-center gap-2 rounded-full bg-[#0F172A] py-2.5 pl-3 pr-4 shadow-[0_12px_30px_rgba(15,23,42,0.3)]">
            <span className="flex size-6 items-center justify-center rounded-full bg-[#2563EB]">
              <Gift className="size-3.5 text-white" strokeWidth={2.5} />
            </span>
            <span className="text-[13px] font-bold text-white">
              +{toast.amount} dropy · {toast.label}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// ① 출석 체크 스트릭
// ─────────────────────────────────────────────────────────────

const STREAK_REWARDS = [5, 5, 10, 10, 15, 15, 50]; // 7일차 보너스

function AttendanceStreak({ onEarn }: { onEarn: (a: number, l: string) => void }) {
  // 데모: 앞 3일 이미 출석했다고 가정
  const [checkedDays, setCheckedDays] = useState(3);
  const [justChecked, setJustChecked] = useState(false);

  const todayIndex = checkedDays; // 다음 출석할 날 (0-based)
  const done = checkedDays >= 7;
  const alreadyToday = justChecked;

  const handleCheck = () => {
    if (done || alreadyToday) return;
    const reward = STREAK_REWARDS[todayIndex] ?? 5;
    setCheckedDays((d) => d + 1);
    setJustChecked(true);
    onEarn(reward, `출석 ${todayIndex + 1}일차`);
  };

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

      {/* 7일 그리드 */}
      <div className="mb-3.5 flex items-center justify-between gap-1.5">
        {STREAK_REWARDS.map((reward, i) => {
          const isChecked = i < checkedDays;
          const isToday = i === todayIndex && !alreadyToday && !done;
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

      <button
        onClick={handleCheck}
        disabled={done || alreadyToday}
        className={`flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[14px] font-bold transition-all duration-150 active:scale-[0.98] ${
          done || alreadyToday
            ? "bg-[#F1F5F9] text-[#94A3B8]"
            : "bg-[#0F172A] text-white shadow-[0_6px_16px_-6px_rgba(15,23,42,0.5)]"
        }`}
      >
        {done ? (
          "이번 주 출석 완료 🎉"
        ) : alreadyToday ? (
          <>
            <Check className="size-4" strokeWidth={2.5} />
            오늘 출석 완료
          </>
        ) : (
          <>
            <Flame className="size-4" strokeWidth={2.5} />
            오늘 출석하고 +{STREAK_REWARDS[todayIndex]} 받기
          </>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ② 데일리 미션
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
  { id: "share", icon: Share2, label: "카드 1개 공유하기", reward: 20, goal: 1, progress: 1 },
  { id: "browse", icon: Eye, label: "카드 3개 구경하기", reward: 10, goal: 3, progress: 2 },
  { id: "coupon", icon: Ticket, label: "쿠폰 사용하기", reward: 30, goal: 1, progress: 0 },
];

function DailyMissions({ onEarn }: { onEarn: (a: number, l: string) => void }) {
  const [missions, setMissions] = useState(INITIAL_MISSIONS);
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});

  const claim = (m: Mission) => {
    if (claimed[m.id] || m.progress < m.goal) return;
    setClaimed((c) => ({ ...c, [m.id]: true }));
    onEarn(m.reward, "데일리 미션");
  };

  const doneCount = missions.filter((m) => claimed[m.id]).length;

  return (
    <div className="rounded-2xl border border-[#E8EDF3] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[#EFF6FF]">
            <Zap className="size-4 text-[#2563EB]" strokeWidth={2.5} />
          </span>
          <span className="text-[13.5px] font-bold text-[#0F172A]">데일리 미션</span>
        </div>
        <span className="text-[11.5px] font-semibold text-[#94A3B8]">
          {doneCount}/{missions.length} 완료
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {missions.map((m) => {
          const complete = m.progress >= m.goal;
          const isClaimed = claimed[m.id];
          return (
            <div
              key={m.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                isClaimed ? "bg-[#F8FAFC]" : "bg-[#F8FAFC]"
              }`}
            >
              <span
                className={`flex size-8 flex-shrink-0 items-center justify-center rounded-lg ${
                  isClaimed ? "bg-[#DCFCE7]" : "bg-white ring-1 ring-inset ring-[#E8EDF3]"
                }`}
              >
                {isClaimed ? (
                  <Check className="size-4 text-[#16A34A]" strokeWidth={3} />
                ) : (
                  <m.icon className="size-4 text-[#475569]" strokeWidth={2} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-[13px] font-semibold ${
                    isClaimed ? "text-[#94A3B8] line-through" : "text-[#0F172A]"
                  }`}
                >
                  {m.label}
                </p>
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
              <button
                onClick={() => claim(m)}
                disabled={!complete || isClaimed}
                className={`flex h-8 flex-shrink-0 items-center gap-1 rounded-lg px-2.5 text-[12px] font-bold transition-all duration-150 active:scale-95 ${
                  isClaimed
                    ? "bg-transparent text-[#94A3B8]"
                    : complete
                    ? "bg-[#2563EB] text-white"
                    : "bg-[#F1F5F9] text-[#CBD5E1]"
                }`}
              >
                {isClaimed ? (
                  "받음"
                ) : (
                  <>
                    <Gift className="size-3" strokeWidth={2.5} />+{m.reward}
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ③ 드로피 룰렛
// ─────────────────────────────────────────────────────────────

const WHEEL = [10, 5, 30, 5, 20, 100, 10, 50]; // 8칸
const SEG = 360 / WHEEL.length;
const WHEEL_COLORS = ["#2563EB", "#0F172A"];

function DropyRoulette({ onEarn }: { onEarn: (a: number, l: string) => void }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [used, setUsed] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  const spin = () => {
    if (spinning || used) return;
    setSpinning(true);
    setResult(null);

    const winIndex = Math.floor(Math.random() * WHEEL.length);
    const reward = WHEEL[winIndex];
    // 포인터는 상단(12시). 해당 칸 중앙이 상단에 오도록 회전.
    const targetAngle = 360 * 5 - (winIndex * SEG + SEG / 2);
    const next = rotation + (targetAngle - (rotation % 360));
    setRotation(next + 360 * 5);

    setTimeout(() => {
      setSpinning(false);
      setUsed(true);
      setResult(reward);
      onEarn(reward, "룰렛 당첨");
    }, 3600);
  };

  // conic-gradient 배경
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
          하루 1회 무료
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* 휠 */}
        <div className="relative flex-shrink-0" style={{ width: 132, height: 132 }}>
          {/* 포인터 */}
          <div
            className="absolute left-1/2 top-[-2px] z-20 -translate-x-1/2"
            style={{ width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "14px solid #F97316" }}
          />
          <div
            className="relative size-[132px] rounded-full ring-4 ring-white/15"
            style={{
              background: conic,
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 3.6s cubic-bezier(0.16, 1, 0.3, 1)" : "none",
            }}
          >
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

        {/* 우측: 결과 + 버튼 */}
        <div className="flex min-w-0 flex-1 flex-col">
          {result !== null ? (
            <div className="mb-3">
              <p className="text-[11.5px] font-medium text-[#B6C2D2]">축하해요! 당첨</p>
              <p className="text-[26px] font-extrabold leading-tight text-white">
                +{result} <span className="text-[14px] font-bold text-[#60A5FA]">dropy</span>
              </p>
            </div>
          ) : (
            <p className="mb-3 text-[12.5px] font-medium leading-relaxed text-[#B6C2D2]">
              돌려서 최대 <b className="text-white">100 dropy</b>를 받아보세요
            </p>
          )}

          <button
            onClick={spin}
            disabled={spinning || used}
            className={`flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[14px] font-bold transition-all duration-150 active:scale-[0.98] ${
              used
                ? "bg-white/10 text-[#94A3B8]"
                : spinning
                ? "bg-[#2563EB]/60 text-white"
                : "bg-[#2563EB] text-white shadow-[0_6px_16px_-6px_rgba(37,99,235,0.8)]"
            }`}
          >
            {used ? "내일 다시 도전" : spinning ? "돌리는 중..." : "룰렛 돌리기"}
          </button>
        </div>
      </div>
    </div>
  );
}
