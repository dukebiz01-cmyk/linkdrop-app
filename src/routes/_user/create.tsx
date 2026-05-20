import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreateDropWizard } from "@/components/create-drop-wizard";

// 이전 v2 BlockEditor 플로우 — 참고·복구용 (라우트에서 미사용)
// import { CreateLegacyPage } from "@/components/create-legacy-page";

export const Route = createFileRoute("/_user/create")({
  head: () => ({ meta: [{ title: "만들기" }] }),
  component: CreatePage,
});

function CreatePage() {
  const navigate = useNavigate();

  return (
    <CreateDropWizard
      onClose={() => navigate({ to: "/home" })}
      onComplete={(data) => {
        // TODO: Step 5 완료 후 createDropV2 RPC 연결
        console.log("[create] wizard complete (mock)", data);
      }}
    />
  );
}
