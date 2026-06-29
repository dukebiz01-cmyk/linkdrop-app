import type { ComponentType, ReactNode } from "react";
import { Sparkles } from "lucide-react";

/**
 * v4-bits — 홈 V4 공통 표시 헬퍼(RoleHome · HomeActivitySegment 공유).
 *   순수 presentational. 데이터·핸들러 없음(스타일만). raw hex·V4 섀도 허용.
 */
type IconComp = ComponentType<{ className?: string; strokeWidth?: number }>;

export function SectionHeader({
  icon: Icon,
  title,
  badge,
}: {
  icon: IconComp;
  title: string;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 px-0.5">
      <span className="flex size-7 items-center justify-center rounded-lg bg-[#EEF3FE]">
        <Icon className="size-4 text-[#2563EB]" strokeWidth={2} />
      </span>
      <h2 className="text-[15px] font-bold text-[#0F172A]">{title}</h2>
      {badge !== undefined && badge !== null ? (
        <span className="rounded-md bg-[#EFF4FE] px-1.5 py-0.5 text-[10px] font-bold text-[#2563EB]">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D7DEE7] bg-[#F8FAFC] px-6 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full border border-[#EAEEF3] bg-white">
        <Sparkles className="size-5 text-[#94A3B8]" strokeWidth={1.75} />
      </div>
      <p className="text-[13px] font-semibold text-[#475569]">{title}</p>
      {subtitle ? <p className="mt-1 text-[12px] text-[#94A3B8]">{subtitle}</p> : null}
    </div>
  );
}

export function SegmentToggle<K extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-[#EAEEF3] bg-[#F1F5F9] p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`min-h-[34px] rounded-lg px-3.5 text-[12.5px] font-semibold transition-all ${
            value === o.key
              ? "bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(15,23,42,0.1)]"
              : "text-[#64748B] hover:text-[#475569]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
