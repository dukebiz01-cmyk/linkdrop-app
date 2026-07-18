import { createFileRoute } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";
import type { CouponRow } from "@/routes/_partner/partner.coupons";
// ST3(S5-1) — 구 스튜디오(CardStudioPage)·?legacy=1 스위치백 장례: 렌더 = 신 스튜디오
//   (CardStudioPage45) 단일 경로. 구 컴포넌트가 홀로 소비하던 사슬(CardBody·DropCardShell·
//   ProductWidget·CouponPreview·buildProductWidget 등)은 S5-2에서 파일 단위 정리.
//   진입 계약 무변경: ?purpose 딥링크·/studio 리다이렉트·비사업자 잠금 열람(loader 게이트).
import {
  CardStudioPage45,
  type StudioLabCoupon,
  type StudioLabStore,
} from "@/components/card-model/CardStudioPage45";

type StudioBuildStore = {
  id: string;
  display_name: string;
  verification_status: string;
  // 4-A 매장 연락처 — link 블록(전화/길찾기/네이버예약) 표시용. DB 기존 컬럼.
  contact_phone: string | null;
  address: string | null;
  reservation_url: string | null;
};
type StudioBuildCoupon = {
  id: string;
  title: string | null;
  discount_value: number | null;
  discount_unit: string | null;
  // 쿠폰 표시용 — get_active_store_coupons(v5.11)가 이미 반환(loader 직접 캐스팅으로 통과).
  //   conditions(min_amount)는 그 RPC에 없어 옵셔널.
  coupon_type?: string | null;
  gift_item?: string | null;
  valid_until?: string | null;
  conditions?: { min_amount?: number; [k: string]: unknown } | null;
};
type StudioBuildLoaderData = {
  isBusiness: boolean;
  store: StudioBuildStore | null;
  coupons: StudioBuildCoupon[];
  // 쿠폰 만들기 시트(CouponManageView) 임베드용 — partner.coupons 와 동일 쿼리(coupons 테이블 직접).
  //   피커용 coupons(get_active_store_coupons)와 별개로 둘 다 반환.
  manageCoupons: CouponRow[];
  // P6-2 — 내 캐쉬(reward_ledger 누적, 구 /studio 셸 이식). 실패·미조회 = null(graceful).
  myRewards: number | null;
  /** ST2b-1 — 신 스튜디오(FIX-9) 도킹 가용 카드 실카운트. */
  dockCount: number;
};

export const Route = createFileRoute("/_user/studio-build")({
  head: () => ({ meta: [{ title: "카드 스튜디오 — LinkDrop" }] }),
  // 링고 스타터 목적 프리셋 — ?purpose=정보|쿠폰|예약|구매. 그 외/미지정 = undefined(무영향, 하위호환).
  //   초기 buildMode 만 프리셋(switchMode 미호출). 비사업자 가드는 렌더가 담당.
  validateSearch: (
    search: Record<string, unknown>,
  ): { purpose?: "정보" | "쿠폰" | "예약" | "구매" } => {
    const p = search.purpose;
    return p === "정보" || p === "쿠폰" || p === "예약" || p === "구매" ? { purpose: p } : {};
  },
  // S1 — 실데이터 로딩 길 + 비즈니스 게이트.
  //   인증은 부모 _user.tsx beforeLoad 담당 → 세션 throw 금지(graceful). 매장 없으면 등록 유도.
  loader: async (): Promise<StudioBuildLoaderData> => {
    const empty: StudioBuildLoaderData = {
      isBusiness: false,
      store: null,
      coupons: [],
      manageCoupons: [],
      myRewards: null,
      dockCount: 0,
    };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    if (!userId) return empty; // 인증은 _user.tsx 담당 — 여기선 throw 안 함(graceful).

    // ST2b-1 — 도킹 가용 카드 실카운트(신 스튜디오 FIX-9 소비 — studio-lab loader 동일 쿼리).
    //   가짜 숫자 금지 — 실패 시 0.
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

    // 비즈니스 여부 (create-wizard.tsx:77 패턴).
    const { data: isBusinessRaw } = await supabase.rpc("is_active_partner_owner", {
      _user_id: userId,
    });
    const isBusiness = Boolean(isBusinessRaw);

    // 내 매장 (partner.register.tsx:57-61 패턴).
    // ST2b-1 — facilities 동봉(신 스튜디오 FIX-10 시설 태그 재로드 — studio-lab select 동일).
    //   types.ts 미반영 컬럼이라 select 는 as never + 결과 캐스트(studio-lab 정본 패턴).
    const { data: storeRaw } = await supabase
      .from("partners")
      .select(
        "id, display_name, verification_status, contact_phone, address, reservation_url, facilities" as never,
      )
      .eq("owner_user_id", userId)
      .maybeSingle();
    const store = (storeRaw as unknown as StudioBuildStore | null) ?? null;

    // P6-3(형님 확정 A안) — 전면 redirect 차단 → "잠금 열람"으로 완화: 비사업자(또는 매장
    //   미보유)도 진입 허용. 사업자 모드 잠금은 컴포넌트 게이트(switchMode·탭 Lock)가,
    //   저장측은 create_drop_v2 비사업자 purpose 게이트(v7.4)가 이중 방어. 매장 데이터
    //   (쿠폰·manageCoupons)는 사업자+매장 보유일 때만 조회(아래 기존 경로 그대로).
    if (!isBusiness || !store) {
      // 내 캐쉬만 조회(P6-2 본체 블록은 사업자 경로에 0터치 보존 — 이 분기 전용 사본).
      let lockedRewards: number | null = null;
      try {
        const rpc = supabase.rpc as unknown as (
          fn: string,
        ) => Promise<{ data: unknown; error: unknown }>;
        const { data: rewardsRaw, error: rewardsErr } = await rpc("get_my_rewards");
        if (!rewardsErr) lockedRewards = Number(rewardsRaw) || 0;
      } catch {
        // graceful — null 유지
      }
      return { ...empty, isBusiness, myRewards: lockedRewards, dockCount };
    }

    // 활성 쿠폰 (create-drop-wizard.tsx:401 패턴). get_active_store_coupons 는 types.ts 미반영.
    //   ⚠️ supabase.rpc 를 변수로 떼면 this 분실('rest' 에러) → 메서드 직접 호출하고 캐스트는
    //   인자(as never)·결과에만 적용 (PreorderSheet.tsx:80-81 정본 패턴). 실패 시 빈 배열.
    let coupons: StudioBuildCoupon[] = [];
    try {
      const { data: rowsRaw, error: rowsErr } = (await supabase.rpc(
        "get_active_store_coupons" as never,
        { p_partner_id: store.id } as never,
      )) as { data: unknown; error: unknown };
      if (!rowsErr && Array.isArray(rowsRaw)) {
        coupons = rowsRaw as StudioBuildCoupon[];
      }
    } catch (e) {
      // 무증상 실패 재발 방지 — 콘솔에 단서 남김(이전엔 빈 catch라 'rest' 에러가 묻혔음).
      console.error("[studio-build] coupon load failed", e);
    }

    // 쿠폰 만들기 시트용 — partner.coupons CouponsPage 와 동일 쿼리(coupons 테이블 직접, partner_id 필터, created_at desc).
    //   CouponManageView 는 이 목록(전체 쿠폰: 활성/비활성 포함)을 그대로 받아 렌더한다.
    let manageCoupons: CouponRow[] = [];
    try {
      const { data: rows, error: rowsErr } = await supabase
        .from("coupons")
        .select(
          "id, title, coupon_type, discount_value, discount_unit, conditions, valid_until, total_count, is_active, created_at, gift_item",
        )
        .eq("partner_id", store.id)
        .order("created_at", { ascending: false });
      if (!rowsErr && Array.isArray(rows)) {
        manageCoupons = rows as CouponRow[];
      }
    } catch (e) {
      console.error("[studio-build] manage coupons load failed", e);
    }

    // P6-2 — 내 캐쉬(구 /studio loader :44-54 이식). get_my_rewards 는 types.ts 미반영이라
    //   untyped rpc 우회(TEMP — 타입 재생성 후 제거). 실패 시 null(throw 금지, graceful 유지).
    let myRewards: number | null = null;
    try {
      const rpc = supabase.rpc as unknown as (
        fn: string,
      ) => Promise<{ data: unknown; error: unknown }>;
      const { data: rewardsRaw, error: rewardsErr } = await rpc("get_my_rewards");
      if (!rewardsErr) myRewards = Number(rewardsRaw) || 0;
    } catch {
      // 조회 실패 — 헤더는 표기 생략 대신 0원 렌더 방지 위해 null 유지.
    }

    return { isBusiness, store, coupons, manageCoupons, myRewards, dockCount };
  },
  component: StudioBuild,
});

// ST3(S5-1) — 신 스튜디오 단일 렌더(구 스위치 제거). 타입 호환:
//   StudioBuildStore ⊂ StudioLabStore(facilities 옵셔널) · StudioBuildCoupon ≡ StudioLabCoupon.
function StudioBuild() {
  const search = Route.useSearch();
  const data = Route.useLoaderData();
  return (
    <CardStudioPage45
      isBusiness={data.isBusiness}
      store={data.store as StudioLabStore | null}
      coupons={data.coupons as StudioLabCoupon[]}
      manageCoupons={data.manageCoupons}
      dockCount={data.dockCount}
      initialPurpose={search.purpose}
    />
  );
}
