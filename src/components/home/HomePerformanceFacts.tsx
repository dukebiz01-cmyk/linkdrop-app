// HOME-LINGO 커밋2 — 성과 진단 1층(사실). server 실값만 렌더 · LLM 생성 0.
//   출처 = get_creator_performance RPC(브라우저 세션 JWT → auth.uid()=나). 기간 30d 고정 =
//   Edge(lingo-chat T-D)가 발화(2층)에 쓰는 기간과 동일 → 1층 사실 = 2층 해석 숫자 정합.
//   자체완결(useEffect + supabase.rpc) — route loader 안 씀(_user beforeLoad 가 auth 단독 처리).
//   CreatorCoachCard 스캐폴딩(로딩/실패-graceful/수집중) 승계, 단 LLM(generate-feedback) 대신 RPC 실값.
import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Hourglass, Send, MousePointerClick, CheckCircle2, Percent, Coins } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

const ACCENT = "#2563EB";

type Totals = { drops?: number; shares?: number; conversions?: number; conversion_rate?: number | null; gross_krw?: number; reward_krw?: number };
type Perf = {
  totals?: Totals;
  dimensions?: { funnel?: { shares?: number; clicks?: number; conversions?: number } };
  data_sufficiency?: { level?: string };
};

const won = (n?: number) => (typeof n === "number" ? n.toLocaleString("ko-KR") : "0");
const pct = (r?: number | null) => (typeof r === "number" ? `${(r * 100).toFixed(1)}%` : "—");

export function HomePerformanceFacts() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [data, setData] = useState<Perf | null>(null);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const supabase = getSupabase();
      // 브라우저 세션 JWT 자동 첨부 → RPC 내부 auth.uid()=나(SECURITY DEFINER). 기간 30d 고정.
      const { data: res, error } = await supabase.rpc("get_creator_performance", { p_period: "30d" });
      if (error || !res) { setFailed(true); setData(null); return; }
      setData(res as Perf);
    } catch { setFailed(true); setData(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  if (loading) {
    return (
      <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-[#F7F7F8] py-8 text-[13px] font-medium text-[#9A9A9A]">
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} style={{ color: ACCENT }} /> 실제 숫자를 불러오는 중…
      </div>
    );
  }
  if (failed || !data) {
    return (
      <div className="mt-3 flex flex-col items-center rounded-2xl bg-[#F7F7F8] px-5 py-6 text-center">
        <p className="text-[13px] font-bold text-[#0A0A0A]">숫자를 잠시 불러올 수 없어요</p>
        <p className="mt-1 text-[12px] font-medium text-[#9A9A9A]">잠시 후 다시 시도해 주세요.</p>
        <button type="button" onClick={() => void load()} className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-4 text-[12px] font-bold text-[#0A0A0A] active:scale-95">
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.25} /> 다시 시도
        </button>
      </div>
    );
  }

  const t = data.totals ?? {};
  const clicks = data.dimensions?.funnel?.clicks ?? 0;
  const shares = t.shares ?? 0;
  const conversions = t.conversions ?? 0;

  // 데이터 0 — "아직 쌓이기 전" 정직 안내(예측·독려 과장 금지, 사실만).
  if (shares === 0 && conversions === 0) {
    return (
      <div className="mt-3 flex flex-col items-center rounded-2xl bg-[#F7F7F8] px-5 py-7 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white [box-shadow:inset_0_0_0_1px_#ECECEE]">
          <Hourglass className="h-5 w-5 text-[#A3A3A3]" strokeWidth={1.75} />
        </span>
        <p className="mt-2.5 text-[13px] font-bold text-[#0A0A0A]">아직 성과가 쌓이기 전이에요</p>
        <p className="mt-1 text-[12px] font-medium leading-relaxed text-[#9A9A9A] [word-break:keep-all]">
          카드를 공유하면 여기에 실제 숫자(발송·클릭·전환)가 모여요.
        </p>
      </div>
    );
  }

  // 1층 사실 그리드 — 최근 30일 server 실값(가공·예측 0).
  const cells = [
    { icon: Send, label: "발송", value: won(shares) },
    { icon: MousePointerClick, label: "클릭", value: won(clicks) },
    { icon: CheckCircle2, label: "전환", value: won(conversions) },
    { icon: Percent, label: "전환율", value: pct(t.conversion_rate) },
    { icon: Coins, label: "적립", value: `${won(t.reward_krw)}원` },
  ];

  return (
    <div className="mt-3 rounded-2xl bg-[#F7F7F8] p-3.5">
      <p className="mb-2.5 text-[11px] font-bold text-[#9A9A9A]">최근 30일 · 실제 숫자</p>
      <div className="grid grid-cols-3 gap-2">
        {cells.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col items-center rounded-xl bg-white px-2 py-2.5 [box-shadow:inset_0_0_0_1px_#ECECEE]">
            <Icon className="h-3.5 w-3.5 text-[#A3A3A3]" strokeWidth={2.25} />
            <span className="mt-1 text-[15px] font-extrabold leading-none text-[#0A0A0A]">{value}</span>
            <span className="mt-1 text-[10px] font-semibold text-[#9A9A9A]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
