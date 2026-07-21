import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";
import { CardStudioPage } from "@/components/card-model/CardStudioPage49";

// UI-5-T1 — v0-49 스튜디오 몸체 미리보기 라우트.
//   URL 직접 진입 전용(본선 링크·네비 미노출). 거울 파일 studio-build.tsx 무접촉.
//   게이트 = 기존 studio-build/_partner 와 동일(세션 → is_active_partner_owner).
export const Route = createFileRoute("/studio-build49")({
  head: () => ({ meta: [{ title: "카드 스튜디오 v49 (미리보기) — LinkDrop" }] }),
  beforeLoad: async ({ location }) => {
    const supabase = await getAuthClient();
    if (!supabase) return; // 로컬 미설정 시 렌더 통과(기존 게이트 관례).
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
    const { data: isOwner } = await supabase.rpc("is_active_partner_owner", {
      _user_id: session.user.id,
    });
    if (!isOwner) {
      throw redirect({ to: "/partner/register" });
    }
  },
  component: StudioBuild49,
});

function StudioBuild49() {
  return <CardStudioPage />;
}
