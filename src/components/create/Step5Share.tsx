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
}: {
  data: WizardSharePreviewData;
  shareUrl: string;
  onKakaoShare: () => Promise<void>;
  onCopyLink: () => Promise<void>;
  onGoHome: () => void;
  shareError: string | null;
  shareFeedback: string | null;
}) {
  return (
    <WizardSharePreview
      data={data}
      shareUrl={shareUrl}
      onKakaoShare={onKakaoShare}
      onCopyLink={onCopyLink}
      onGoHome={onGoHome}
      shareError={shareError}
      shareFeedback={shareFeedback}
    />
  );
}
