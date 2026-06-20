import {
  WizardSharePreview,
  type WizardSharePreviewData,
} from "@/components/wizard-share-preview";

// WHY: 기존 v0 공유 미리보기 디자인(WizardSharePreview)을 그대로 재사용.
// 데이터 빌드(buildWizardShareData)는 호출자(CreateDropWizard)가 수행.
export function Step5PurposeShare({
  data,
  shareUrl,
  onKakaoShare,
  onCopyLink,
  onGoHome,
  shareError,
  shareFeedback,
  isPublic,
  onTogglePublic,
}: {
  data: WizardSharePreviewData;
  shareUrl: string;
  onKakaoShare: () => Promise<void>;
  onCopyLink: () => Promise<void>;
  onGoHome: () => void;
  shareError: string | null;
  shareFeedback: string | null;
  isPublic?: boolean;
  onTogglePublic?: (next: boolean) => void;
}) {
  // phase1 FIX1: Step 3 = Step4 (section) + Step5 병합. WizardSharePreview 외부
  // 컨테이너가 `flex flex-1 flex-col` 라 부모 flex-col 안에서 viewport 점유 →
  // Step4 와 함께 stack 될 때 두 flex-1 자식이 viewport 분점 → 빈 화면.
  // className="flex-none" 으로 외부 flex-1 무효화 (twMerge 충돌 해소).
  // 내부 본문/sticky CTA 는 부모 페이지 스크롤 흐름 안에서 정상 작동.
  return (
    <WizardSharePreview
      className="flex-none"
      data={data}
      shareUrl={shareUrl}
      onKakaoShare={onKakaoShare}
      onCopyLink={onCopyLink}
      onGoHome={onGoHome}
      shareError={shareError}
      shareFeedback={shareFeedback}
      isPublic={isPublic}
      onTogglePublic={onTogglePublic}
    />
  );
}
