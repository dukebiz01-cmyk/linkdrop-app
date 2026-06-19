import type { StepNum } from "@/components/create/types";

// UI declutter — "Step n / 3" 표시 제거. 호출 15곳은 그대로 두고 본문만 null 반환
//   (호출부 삭제는 별도 정리). 시그니처(n: StepNum)는 호환 위해 유지.
export function StepBadge(_props: { n: StepNum }) {
  return null;
}
