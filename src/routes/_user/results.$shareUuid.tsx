import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";
import { DropResultsPage, type DropResultsData } from "@/components/drop-results-page";

// /_user 부모 가드(session 체크)는 _user.tsx 가 담당. 여기선 본인 Drop 검증만 추가.
export const Route = createFileRoute("/_user/results/$shareUuid")({
  head: () => ({ meta: [{ title: "성과 — LinkDrop" }] }),
  loader: async ({ params }): Promise<DropResultsData> => {
    const supabase = await getAuthClient();
    if (!supabase) throw redirect({ to: "/login" });

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) throw redirect({ to: "/login" });

    const { data, error } = await supabase.rpc("get_drop_results", {
      p_share_uuid: params.shareUuid,
    });
    if (error || !data) throw redirect({ to: "/home" });

    const report = data as unknown as DropResultsData;
    const dropId = report.drop?.id;
    if (!dropId) throw redirect({ to: "/home" });

    // 본인 Drop 확인 — info_drops.owner_user_id 명시 비교 (RLS 의존 X).
    // 남의 share_uuid 로 진입해도 차단된다.
    const { data: drop } = await supabase
      .from("info_drops")
      .select("owner_user_id")
      .eq("id", dropId)
      .maybeSingle();
    if (!drop || drop.owner_user_id !== userId) {
      throw redirect({ to: "/home" });
    }

    return report;
  },
  component: ResultsRoute,
});

function ResultsRoute() {
  const report = Route.useLoaderData();
  const navigate = useNavigate();
  return (
    <DropResultsPage report={report} onBack={() => navigate({ to: "/home" })} />
  );
}
