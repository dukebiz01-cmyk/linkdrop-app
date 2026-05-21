import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreateDropWizard } from "@/components/create-drop-wizard";

/**
 * v3 5단계 드롭 만들기 wizard.
 * WHY: 기존 /create(BlockEditor·Supabase 분리 INSERT)는 유지하고, 신규 UX는 별도 라우트로 검증한다.
 */
export const Route = createFileRoute("/_user/create-wizard")({
  head: () => ({ meta: [{ title: "드롭 만들기" }] }),
  component: CreateWizardPage,
});

function CreateWizardPage() {
  const navigate = useNavigate();

  return (
    <CreateDropWizard
      onClose={() => navigate({ to: "/home" })}
      onComplete={async (data) => {
        // wizard 완료 → POST /api/drops (extract-meta → create_drop_v2 → generate-summary
        //   → detect-product orchestration) → 생성된 Drop 의 /d/$shareUuid 로 이동.
        try {
          const res = await fetch("/api/drops", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              media_url: data.video.url,
              purpose: data.purpose,
              curator_message: data.makerMessage || null,
            }),
          });
          const json = (await res.json()) as {
            drop?: { share_uuid?: string };
            message?: string;
          };
          if (!res.ok || !json.drop?.share_uuid) {
            console.error("[create-wizard] /api/drops 실패:", json.message);
            return;
          }
          navigate({ to: "/d/$shareUuid", params: { shareUuid: json.drop.share_uuid } });
        } catch (e) {
          console.error("[create-wizard] Drop 생성 오류:", e);
        }
      }}
    />
  );
}
