import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Lightbulb,
  Loader2,
  Minus,
  RefreshCw,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";

type GuideMetrics = {
  clicks?: number;
  shares?: number;
  reservations_confirmed?: number;
  coupon_redeemed?: number;
  settlements?: number;
  [k: string]: unknown;
};

type DiagnosisItem = {
  axis: string;
  severity: "high" | "medium" | "low" | "info";
  title: string;
  detail?: string;
};

type PrescriptionItem = {
  priority: number;
  action: string;
  expected: string | null;
};

type StrengthItem = {
  title: string;
  detail?: string;
};

type Comparison = {
  previous_at: string;
  previous_metrics: GuideMetrics;
  current_metrics: GuideMetrics;
  note?: string;
} | null;

type GuideResult = {
  partner_id: string;
  range_days: number;
  metrics: GuideMetrics;
  conversion_rates: Record<string, unknown>;
  diagnosis: DiagnosisItem[];
  prescriptions: PrescriptionItem[];
  strengths: StrengthItem[];
  comparison: Comparison;
  engine: string;
};

const STRIP_COLOR: Record<DiagnosisItem["severity"], string> = {
  high: "bg-[#0A0A0A]",
  medium: "bg-[#737373]",
  low: "bg-[#A3A3A3]",
  info: "bg-[#D4D4D4]",
};

const SEVERITY_LABEL: Record<DiagnosisItem["severity"], string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
  info: "안내",
};

const COMPARE_KEYS: Array<{ key: keyof GuideMetrics; label: string }> = [
  { key: "clicks", label: "조회" },
  { key: "shares", label: "공유" },
  { key: "reservations_confirmed", label: "예약 확정" },
  { key: "coupon_redeemed", label: "쿠폰 사용" },
  { key: "settlements", label: "정산" },
];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export function PartnerGuideSection({
  partnerId,
  range,
}: {
  partnerId: string;
  range: 7 | 30 | 90;
}) {
  const [data, setData] = useState<GuideResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(save: boolean) {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session?.user.id) {
        setError("로그인 정보를 확인하지 못했어요.");
        return;
      }
      const { data: res, error: rpcErr } = await supabase.rpc("get_partner_guide", {
        p_partner_id: partnerId,
        p_range_days: range,
        p_save: save,
      });
      if (rpcErr) {
        console.error("[partner.guide] rpc failed:", rpcErr);
        setError("가이드를 불러오지 못했어요.");
        toast.error(`가이드를 불러오지 못했어요: ${rpcErr.message}`);
        return;
      }
      setData(res as GuideResult);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(true);
    // partnerId/range 변경 시 재호출 (자동 진단 + guide_history INSERT)
  }, [partnerId, range]);

  if (loading && !data) {
    return (
      <section className="rounded-2xl border border-[#E5E5E5] bg-white p-5">
        <div className="flex items-center gap-2 text-[#737373]">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          <span className="text-sm font-medium tracking-ko">자동 진단 중…</span>
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-2xl border border-[#E5E5E5] bg-white p-5">
        <p className="text-sm font-medium tracking-ko text-[#737373]">
          {error ?? "가이드를 불러오지 못했어요."}
        </p>
        <button
          type="button"
          onClick={() => void load(true)}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E5E5] bg-white px-3 text-xs font-semibold tracking-ko text-[#0A0A0A] hover:bg-[#FAFAFA]"
        >
          <RefreshCw className="size-3.5" strokeWidth={2} />
          다시 시도
        </button>
      </section>
    );
  }

  const prescriptions = [...data.prescriptions].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );
  const hasDiagnosis = data.diagnosis.length > 0;
  const hasStrengths = data.strengths.length > 0;
  const showComparison = data.comparison != null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-bold tracking-ko text-[#0A0A0A]">
          <Lightbulb className="size-4" strokeWidth={2} />
          개선 가이드
        </h2>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E5E5E5] bg-white px-2.5 text-[11px] font-semibold tracking-ko text-[#525252] hover:bg-[#FAFAFA] disabled:opacity-60"
        >
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
          다시 진단받기
        </button>
      </div>

      <p className="text-[11px] font-medium tracking-ko text-[#A3A3A3]">자동 진단</p>

      {/* 진단 + 처방 */}
      {hasDiagnosis && (
        <ul className="space-y-3">
          {data.diagnosis.map((diag, i) => {
            const prescription = prescriptions[i] ?? null;
            return (
              <li
                key={`${diag.axis}-${i}`}
                className="overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white"
              >
                <div className="flex">
                  <span className={`w-1 shrink-0 ${STRIP_COLOR[diag.severity]}`} aria-hidden />
                  <div className="min-w-0 flex-1 px-4 py-3">
                    <span className="text-[10px] font-semibold tracking-ko text-[#737373]">
                      [{SEVERITY_LABEL[diag.severity]}]
                    </span>
                    <p className="mt-1 text-sm font-bold tracking-ko text-[#0A0A0A]">
                      {diag.title}
                    </p>
                    {diag.detail ? (
                      <p className="mt-1 text-xs font-medium leading-relaxed tracking-ko text-[#737373]">
                        {diag.detail}
                      </p>
                    ) : null}
                    {prescription ? (
                      <>
                        <div className="my-3 border-t border-dashed border-[#E5E5E5]" />
                        <p className="text-sm font-bold tracking-ko text-[#0A0A0A]">
                          → {prescription.action}
                        </p>
                        {prescription.expected ? (
                          <p className="mt-1 text-[11px] font-medium tracking-ko text-[#A3A3A3]">
                            {prescription.expected}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* 강점 */}
      {hasStrengths && (
        <ul className="space-y-2">
          {data.strengths.map((s, i) => (
            <li
              key={`${s.title}-${i}`}
              className="overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white"
            >
              <div className="flex">
                <span className="w-1 shrink-0 bg-[#0A0A0A]" aria-hidden />
                <div className="min-w-0 flex-1 px-4 py-3">
                  <p className="inline-flex items-center gap-1.5 text-sm font-bold tracking-ko text-[#0A0A0A]">
                    <Check className="size-4" strokeWidth={2.4} />
                    {s.title}
                  </p>
                  {s.detail ? (
                    <p className="mt-1 text-xs font-medium tracking-ko text-[#737373]">
                      {s.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 진단 0 + 강점 0 = S8 graceful 또는 전부 잘 됨 */}
      {!hasDiagnosis && !hasStrengths && (
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5">
          <p className="text-sm font-medium tracking-ko text-[#737373]">
            지금 잘 되고 있어요. 카드를 더 공유해 데이터를 모아보세요.
          </p>
        </div>
      )}

      {/* 추적 비교 */}
      {showComparison && (
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold tracking-ko text-[#0A0A0A]">
              지난 진단 이후 변화
            </p>
            <span className="text-[11px] font-medium tracking-ko text-[#A3A3A3]">
              {formatDateTime(data.comparison!.previous_at)}
            </span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {COMPARE_KEYS.map(({ key, label }) => {
              const prev = Number(data.comparison!.previous_metrics?.[key] ?? 0);
              const cur = Number(data.comparison!.current_metrics?.[key] ?? 0);
              const delta = cur - prev;
              const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
              const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
              const abs = Math.abs(delta).toLocaleString("ko-KR");
              return (
                <li
                  key={key as string}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm font-medium tracking-ko text-[#525252]">
                    {label}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold tracking-ko text-[#0A0A0A]">
                    <Icon className="size-3.5" strokeWidth={2.4} />
                    {sign}
                    {abs}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
