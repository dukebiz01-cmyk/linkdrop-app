import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";
import { CardStudioPage } from "@/components/card-model/CardStudioPage49";
// F3-10b — 실슬롯 행 타입(45 studio-build loader 동형 — 수신 /d 와 동일 RPC get_available_slots 소비).
import type { ReservationSlotRow } from "@/components/card-model/card-model-adapters";

// UI-5-T1 — v0-49 스튜디오 몸체 미리보기 라우트.
//   URL 직접 진입 전용(본선 링크·네비 미노출). 거울 파일 studio-build.tsx 무접촉.
//   게이트 = 기존 studio-build/_partner 와 동일(세션 → is_active_partner_owner).
//   F3-10b — loader 신설(45 _user/studio-build.tsx :105-112·:181-198 동형 축소판): store + 실슬롯만.
//   PartnerCalendarPage(캘린더 스텝 임베드) 저장/해제 성공 → 내장 router.invalidate() → 이 loader
//   재실행 → 미리보기 즉시 갱신. 실패해도 스튜디오는 정상 — slots=[] graceful.
type StudioBuild49LoaderData = {
  store: { id: string; display_name: string } | null;
  slots: ReservationSlotRow[];
};

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
  loader: async (): Promise<StudioBuild49LoaderData> => {
    const empty: StudioBuild49LoaderData = { store: null, slots: [] };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    if (!userId) return empty; // 인증은 beforeLoad 담당 — 여기선 graceful.

    // 내 매장(45 :105-112 동형 축소 — 이 슬라이스 소비분 id·display_name 만).
    const { data: storeRaw } = await supabase
      .from("partners")
      .select("id, display_name")
      .eq("owner_user_id", userId)
      .maybeSingle();
    const store = (storeRaw as { id: string; display_name: string } | null) ?? null;
    if (!store) return empty;

    // FIX-62 실슬롯 프리페치(45 :181-198 동형: 동일 RPC·KST 오늘 기준).
    let slots: ReservationSlotRow[] = [];
    try {
      const kstToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
        new Date(),
      );
      const { data: slotData, error: slotError } = await supabase.rpc("get_available_slots", {
        p_partner_id: store.id,
        p_date: kstToday,
      });
      if (!slotError && Array.isArray(slotData)) {
        slots = slotData as unknown as ReservationSlotRow[];
      }
    } catch (e) {
      console.error("[studio-build49] slot load failed", e);
    }

    return { store, slots };
  },
  component: StudioBuild49,
});

function StudioBuild49() {
  const data = Route.useLoaderData();
  return <CardStudioPage initialStore={data.store} initialSlots={data.slots} />;
}
