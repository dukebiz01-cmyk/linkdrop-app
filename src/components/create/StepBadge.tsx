import type { StepNum } from "@/components/create/types";

export function StepBadge({ n }: { n: StepNum }) {
  return <p className="text-xs font-semibold tracking-ko text-text-subtle">Step {n} / 5</p>;
}
