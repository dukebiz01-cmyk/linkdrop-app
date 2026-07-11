import { createFileRoute } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";
import {
  CardStudioPage45,
  type StudioLabCoupon,
  type StudioLabStore,
} from "@/components/card-model/CardStudioPage45";

/**
 * ⚠️ 임시 검증 라우트 — ST2b 스위치 후 제거.
 *
 * ST2a: v0-45 포지 스튜디오(CardStudioPage45) 검증 전용. URL 직접 접근만(/studio-lab) —
 * 하단 네비·홈 등 어디에도 진입점 없음. 인증은 부모 _user.tsx beforeLoad 담당.
 *
 * 사업자 게이트 = studio-build 와 동일(P6-3 완화 시맨틱): is_active_partner_owner 로
 * 판별하되 비오너도 진입 허용(전면 redirect 없음 — studio-build 동작 동등), 사업자
 * 모드(예약·상품판매)는 컴포넌트 switchMode 잠금 + 저장측 create_drop_v2 비사업자
 * purpose 게이트(v7.4)가 이중 방어.
 *
 * loader = studio-build.tsx:2682-2778 발췌 복제(isBusiness·store·coupons 만 —
 * manageCoupons/myRewards 는 45 UX 에 없어 미조회). // ST2b 스위치 시 원본 제거
 */

type StudioLabLoaderData = {
  isBusiness: boolean;
  store: StudioLabStore | null;
  coupons: StudioLabCoupon[];
  /** FIX-9 — 도킹 가용(공개 발행) 카드 실카운트. head count 만(행 미전송). */
  dockCount: number;
};

export const Route = createFileRoute("/_user/studio-lab")({
  head: () => ({ meta: [{ title: "카드 스튜디오 랩 — LinkDrop" }] }),
  // 목적 진입 쿼리 — studio-build validateSearch 동등(?purpose=정보|쿠폰|예약|구매).
  validateSearch: (
    search: Record<string, unknown>,
  ): { purpose?: "정보" | "쿠폰" | "예약" | "구매" } => {
    const p = search.purpose;
    return p === "정보" || p === "쿠폰" || p === "예약" || p === "구매" ? { purpose: p } : {};
  },
  loader: async (): Promise<StudioLabLoaderData> => {
    const empty: StudioLabLoaderData = { isBusiness: false, store: null, coupons: [], dockCount: 0 };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    if (!userId) return empty; // 인증은 _user.tsx 담당 — graceful.

    // FIX-9 — 도킹 가용 카드 실카운트(getDockCandidates 와 동일 조건: published + 공개).
    //   가짜 숫자 금지 — 실패 시 0(숫자 대신 "먼저 만들기" 안내로 전환).
    let dockCount = 0;
    try {
      const { count } = await supabase
        .from("info_drops")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .eq("is_public", true);
      dockCount = count ?? 0;
    } catch {
      // graceful — 0 유지.
    }

    // 비즈니스 여부 (studio-build/create-wizard 패턴). // ST2b 스위치 시 원본 제거
    const { data: isBusinessRaw } = await supabase.rpc("is_active_partner_owner", {
      _user_id: userId,
    });
    const isBusiness = Boolean(isBusinessRaw);

    // 내 매장 — link 블록(전화/위치)·partner_id 발행 연결용. // ST2b 스위치 시 원본 제거
    // FIX-10 — facilities(jsonb, 마스터 신설 컬럼) 동봉: 시설 태그 저장·재로드 왕복.
    //   types.ts 미반영 컬럼이라 결과만 캐스트(런타임은 컬럼 존재 — 마스터 SQL 적용 완료).
    const { data: storeRaw } = await supabase
      .from("partners")
      .select("id, display_name, verification_status, contact_phone, address, reservation_url, facilities" as never)
      .eq("owner_user_id", userId)
      .maybeSingle();
    const store = (storeRaw as unknown as StudioLabStore | null) ?? null;

    if (!isBusiness || !store) {
      // 비오너/매장 미보유 — 진입 허용(잠금 열람), 매장 데이터 미조회.
      return { ...empty, isBusiness, dockCount };
    }

    // 활성 쿠폰 — get_active_store_coupons(types.ts 미반영 → as never 캐스트, 메서드 직접 호출).
    // ST2b 스위치 시 원본 제거(studio-build :2732-2744 발췌).
    let coupons: StudioLabCoupon[] = [];
    try {
      const { data: rowsRaw, error: rowsErr } = (await supabase.rpc(
        "get_active_store_coupons" as never,
        { p_partner_id: store.id } as never,
      )) as { data: unknown; error: unknown };
      if (!rowsErr && Array.isArray(rowsRaw)) {
        coupons = rowsRaw as StudioLabCoupon[];
      }
    } catch (e) {
      console.error("[studio-lab] coupon load failed", e);
    }

    return { isBusiness, store, coupons, dockCount };
  },
  component: StudioLabPage,
});

function StudioLabPage() {
  const { isBusiness, store, coupons, dockCount } = Route.useLoaderData();
  const { purpose } = Route.useSearch();
  return (
    <CardStudioPage45
      isBusiness={isBusiness}
      store={store}
      coupons={coupons}
      dockCount={dockCount}
      initialPurpose={purpose}
    />
  );
}
