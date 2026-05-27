import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// ============================================================
// Types
// ============================================================

export interface MetricData {
  label: string;
  value: number;
  unit?: string; // e.g., "회", "건", "명"
  trend?: number; // percentage change (positive = up, negative = down)
  trendLabel?: string; // e.g., "지난주 대비"
}

export interface ReportMetricsHeroProps {
  metrics: MetricData[];
  title?: string;
}

// ============================================================
// Main Component
// ============================================================

export function ReportMetricsHero({
  metrics,
  title = "이번 주 성과"
}: ReportMetricsHeroProps) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      {title && (
        <h3 className="text-sm font-semibold text-[#0A0A0A] mb-4">{title}</h3>
      )}

      <div className="grid grid-cols-3 gap-4">
        {metrics.slice(0, 3).map((metric, idx) => (
          <div key={idx} className="text-center">
            <div className="flex items-baseline justify-center gap-0.5">
              <span className="text-2xl font-bold text-[#0A0A0A] tabular-nums">
                {metric.value.toLocaleString()}
              </span>
              {metric.unit && (
                <span className="text-sm text-[#525252]">{metric.unit}</span>
              )}
            </div>

            <p className="mt-1 text-xs text-[#525252]">{metric.label}</p>

            {metric.trend !== undefined && (
              <div className={`mt-2 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                metric.trend > 0
                  ? "bg-[#ECFDF5] text-[#059669]"
                  : metric.trend < 0
                    ? "bg-[#FEF2F2] text-[#EF4444]"
                    : "bg-[#F5F5F5] text-[#525252]"
              }`}>
                {metric.trend > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : metric.trend < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                {metric.trend > 0 ? "+" : ""}{metric.trend}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Compact Variant (for inline use)
// ============================================================

export function ReportMetricsCompact({ metrics }: { metrics: MetricData[] }) {
  return (
    <div className="flex items-center gap-4">
      {metrics.slice(0, 3).map((metric, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-[#0A0A0A] tabular-nums">
            {metric.value.toLocaleString()}{metric.unit}
          </span>
          <span className="text-xs text-[#525252]">{metric.label}</span>
          {metric.trend !== undefined && metric.trend !== 0 && (
            <span className={`text-xs font-medium ${
              metric.trend > 0 ? "text-[#059669]" : "text-[#EF4444]"
            }`}>
              {metric.trend > 0 ? (
                <TrendingUp className="h-3 w-3 inline" />
              ) : (
                <TrendingDown className="h-3 w-3 inline" />
              )}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Card Variant (larger display)
// ============================================================

export function ReportMetricsCard({
  metric,
  size = "default",
}: {
  metric: MetricData;
  size?: "default" | "large";
}) {
  const isLarge = size === "large";

  return (
    <div className={`rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${
      isLarge ? "p-6" : "p-4"
    }`}>
      <p className={`font-medium text-[#525252] ${isLarge ? "text-sm" : "text-xs"}`}>
        {metric.label}
      </p>

      <div className="mt-2 flex items-baseline gap-1">
        <span className={`font-bold text-[#0A0A0A] tabular-nums ${
          isLarge ? "text-4xl" : "text-2xl"
        }`}>
          {metric.value.toLocaleString()}
        </span>
        {metric.unit && (
          <span className={`text-[#525252] ${isLarge ? "text-lg" : "text-sm"}`}>
            {metric.unit}
          </span>
        )}
      </div>

      {metric.trend !== undefined && (
        <div className={`mt-3 flex items-center gap-1 ${
          metric.trend > 0
            ? "text-[#059669]"
            : metric.trend < 0
              ? "text-[#EF4444]"
              : "text-[#525252]"
        }`}>
          {metric.trend > 0 ? (
            <TrendingUp className={isLarge ? "h-5 w-5" : "h-4 w-4"} />
          ) : metric.trend < 0 ? (
            <TrendingDown className={isLarge ? "h-5 w-5" : "h-4 w-4"} />
          ) : (
            <Minus className={isLarge ? "h-5 w-5" : "h-4 w-4"} />
          )}
          <span className={`font-medium ${isLarge ? "text-sm" : "text-xs"}`}>
            {metric.trend > 0 ? "+" : ""}{metric.trend}%
            {metric.trendLabel && (
              <span className="ml-1 text-[#A3A3A3] font-normal">
                {metric.trendLabel}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

export default ReportMetricsHero;
