import { createFileRoute } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";
import {
  CardStudioPage50,
  type CardStudioPage50Store,
} from "@/components/card-model/CardStudioPage50";

// P1 — 50 트랙 임시 검수 라우트(직접 URL 전용).
//   ⚠️ 앱 내 어떤 화면에도 이 라우트로 가는 링크를 두지 않는다(운영 노출 0).
//   loader = studio-build.tsx :103-110 의 store 로드만 최소 복제.
//   coupons/slots/dockCount/myRewards 는 P1 불필요 — 조회하지 않는다.
type StudioLabLoaderData = { store: CardStudioPage50Store | null };

export const Route = createFileRoute("/_user/studio-lab")({
  head: () => ({ meta: [{ title: "스튜디오 랩 — LinkDrop" }] }),
  loader: async (): Promise<StudioLabLoaderData> => {
    const empty: StudioLabLoaderData = { store: null };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    if (!userId) return empty; // 인증은 _user.tsx 담당 — 여기선 throw 안 함(graceful · studio-build 선례).

    // 내 매장 — studio-build.tsx 동일 쿼리에서 P1이 쓰는 3컬럼만.
    const { data: storeRaw } = await supabase
      .from("partners")
      .select("id, display_name, contact_phone")
      .eq("owner_user_id", userId)
      .maybeSingle();

    return { store: (storeRaw as unknown as CardStudioPage50Store | null) ?? null };
  },
  component: StudioLabPage,
});

function StudioLabPage() {
  const data = Route.useLoaderData();
  return <CardStudioPage50 store={data.store} />;
}
