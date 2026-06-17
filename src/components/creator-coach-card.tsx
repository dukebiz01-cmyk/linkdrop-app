import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  Trophy,
  Clock,
  Share2,
  Filter,
  BarChart3,
  Lightbulb,
  Loader2,
  RefreshCw,
  Hourglass,
  ArrowRight,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";

// ③ AI 코치 카드 — generate-feedback Edge(Sonnet) 결과를 그대로 렌더하는 자체완결 컴포넌트.
//   ★ route loader 안 씀 — 순수 클라이언트(useEffect + supabase.functions.invoke). _user beforeLoad 가
//      auth 단독 처리하므로 여기서 세션/userId throw 금지(리다이렉트 루프 방지).
//   출력 스키마 해석만 — Edge·RPC 무변경. 나중에 성과 화면으로 통째 이동 가능하게 자체완결.

type Period = "7d" | "30d" | "all";

type Insight = { icon_hint?: string; headline?: string; metric?: string; action?: string };
type Recommendation = { pattern?: string; rationale?: string };
type Feedback = {
  status?: "ok" | "collecting";
  data_sufficiency?: {
    drop_count?: number;
    level?: string;
    // Edge 가 추후 2축을 노출하면 자동 반영(현재는 level=activity_level 만 옴).
    activity_level?: string;
    conversion_level?: string;
  };
  insights?: Insight[];
  recommendations?: Recommendation[];
  generated_at?: string;
  model?: string;
  cached?: boolean;
  parse_error?: boolean;
  message?: string;
};

// AI 가 주는 자유문자열 icon_hint → 알려진 힌트만 아이콘 매핑, 그 외 기본 아이콘(보안·견고성).
//   ⚠️ icon_hint 를 클래스명/동적 컴포넌트명으로 직접 쓰지 않는다.
const ICON_MAP = {
  trophy: Trophy,
  clock: Clock,
  channel: Share2,
  funnel: Filter,
  chart: BarChart3,
} as const;

function iconFor(hint?: string) {
  return (hint && ICON_MAP[hint as keyof typeof ICON_MAP]) || Lightbulb;
}

const PERIODS: { id: Period; label: string }[] = [
  { id: "7d", label: "7일" },
  { id: "30d", label: "30일" },
  { id: "all", label: "전체" },
];

export function CreatorCoachCard() {
  // 기본 'all' — 검증 시 채워진 결과를 먼저 보려고.
  const [period, setPeriod] = useState<Period>("all");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [data, setData] = useState<Feedback | null>(null);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    setFailed(false);
    try {
      const supabase = getSupabase();
      // invoke 가 현재 세션 JWT 를 Authorization 으로 자동 첨부 → Edge verify_jwt 통과 + RPC auth.uid()=나.
      const { data: res, error } = await supabase.functions.invoke("generate-feedback", {
        body: { period: p },
      });
      if (error || !res) {
        setFailed(true);
        setData(null);
        return;
      }
      setData(res as Feedback);
    } catch {
      setFailed(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(period);
  }, [period, load]);

  // data_sufficiency 미세 노트 — 전환 데이터가 적을 때만 작게 (conversion_level 우선, 없으면 level).
  const convLevel = data?.data_sufficiency?.conversion_level ?? data?.data_sufficiency?.level;
  const lowConversionNote =
    data?.status === "ok" && (convLevel === "insufficient" || convLevel === "tentative");

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      {/* 헤더 — 타이틀 + 기간 토글 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-[#0F172A]" strokeWidth={2} />
          <h2 className="text-base font-bold text-[#0F172A]">AI 코치</h2>
        </div>
        <div className="flex gap-0.5 rounded-lg bg-[#F1F5F9] p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              className={`min-h-[36px] rounded-md px-2.5 text-xs font-semibold transition-colors ${
                period === p.id
                  ? "bg-white text-[#0F172A] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {/* 1) 로딩 */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#64748B]">
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            성과를 분석하는 중…
          </div>
        ) : /* 4) 실패/파싱불가 — graceful + 다시 */
        failed || data?.parse_error || !data ? (
          <div className="flex flex-col items-center rounded-xl bg-[#F8FAFC] px-6 py-8 text-center">
            <p className="text-sm font-semibold text-[#0F172A]">분석을 잠시 불러올 수 없어요</p>
            <p className="mt-1 text-xs font-medium text-[#64748B]">잠시 후 다시 시도해 주세요.</p>
            <button
              type="button"
              onClick={() => void load(period)}
              className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              <RefreshCw className="size-4" strokeWidth={2} />
              다시 시도
            </button>
          </div>
        ) : /* 2) 수집중 */
        data.status === "collecting" ? (
          <div className="flex flex-col items-center rounded-xl bg-[#F8FAFC] px-6 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#F1F5F9]">
              <Hourglass className="size-6 text-[#64748B]" strokeWidth={1.5} />
            </span>
            <p className="mt-3 text-sm font-semibold text-[#0F172A]">데이터를 모으는 중이에요</p>
            <p className="mt-1 text-xs font-medium text-[#64748B]">
              {data.message?.trim() || "발송이 더 쌓이면 분석을 시작해요"}
            </p>
          </div>
        ) : (
          /* 3) 정상 — insights + recommendations */
          <div className="space-y-5">
            <ul className="space-y-4">
              {(data.insights ?? []).map((it, i) => {
                const Icon = iconFor(it.icon_hint);
                return (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9]">
                      <Icon className="size-4 text-[#0F172A]" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      {it.headline ? (
                        <p className="text-sm font-bold text-[#0F172A]">{it.headline}</p>
                      ) : null}
                      {it.metric ? (
                        <p className="mt-0.5 text-xs font-medium text-[#64748B]">{it.metric}</p>
                      ) : null}
                      {it.action ? (
                        <p className="mt-1.5 flex items-start gap-1 text-xs font-semibold text-[#0F172A]">
                          <ArrowRight className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.5} />
                          <span>{it.action}</span>
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            {(data.recommendations ?? []).length > 0 ? (
              <div className="rounded-xl bg-[#F8FAFC] p-4">
                <p className="text-xs font-bold text-[#0F172A]">이렇게 해보세요</p>
                <ul className="mt-2 space-y-2">
                  {(data.recommendations ?? []).map((r, i) => (
                    <li key={i} className="text-xs">
                      {r.pattern ? (
                        <span className="font-semibold text-[#0F172A]">{r.pattern}</span>
                      ) : null}
                      {r.pattern && r.rationale ? (
                        <span className="text-[#64748B]"> — </span>
                      ) : null}
                      {r.rationale ? (
                        <span className="font-medium text-[#64748B]">{r.rationale}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {lowConversionNote ? (
              <p className="text-[11px] font-medium text-[#94A3B8]">
                전환 데이터가 아직 적어요 — 더 쌓이면 분석이 정확해져요.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
