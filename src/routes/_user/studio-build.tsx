import { createFileRoute } from "@tanstack/react-router";
import { getAuthClient } from "@/lib/auth-context";
import type { CouponRow } from "@/routes/_partner/partner.coupons";
// ST3(S5-1) — 구 스튜디오(CardStudioPage)·?legacy=1 스위치백 장례 → UI-5-T6b — 렌더 = 49 신스튜디오.
//   ⚠️ 거울 취급 파일 — Duke 명시 수정 승인 2호(T-6b: 주소 유지·내용물 교체 (b)안 확정).
//   45(CardStudioPage45)는 import 만 해제·파일 무수정 보존 = 롤백 자산(이 import 되돌림 한 줄 = revert).
//   진입 계약 무변경: 주소 /studio-build 유지 → 탭바·홈·수신 유도·카톡 핸드오프(DEFAULT_NEXT) 전부
//   무수정 도달. ?purpose 딥링크는 URL 계약 유지(validateSearch 존치 — 49 미소비 = 무영향 통과).
import { CardStudioPage } from "@/components/card-model/CardStudioPage49";
import { Link } from "@tanstack/react-router";
// FIX-62 — 실슬롯 행 타입(수신 /d loader 와 동일 RPC get_available_slots 소비).
import type { ReservationSlotRow } from "@/components/card-model/card-model-adapters";

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
  /** FIX-62 — 매장 실슬롯(get_available_slots · 수신 /d loader 와 동일 RPC·정렬).
   *  캘린더 스텝 done 판정 + 미리보기 예약 가능일의 단일 공급원. 실패/매장없음 = []. */
  slots: ReservationSlotRow[];
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
      slots: [],
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

    // FIX-62 — 실슬롯 프리페치(수신 d.$shareUuid loader :237-252 동형: 동일 RPC·KST 오늘 기준).
    //   PartnerCalendarPage(캘린더 스텝 임베드) 저장/해제 성공 → router.invalidate() → 이 loader
    //   재실행 → 미리보기 즉시 갱신. 실패해도 스튜디오는 정상 — slots=[] graceful.
    let slots: ReservationSlotRow[] = [];
    try {
      const kstToday = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
      }).format(new Date());
      const { data: slotData, error: slotError } = await supabase.rpc("get_available_slots", {
        p_partner_id: store.id,
        p_date: kstToday,
      });
      if (!slotError && Array.isArray(slotData)) {
        slots = slotData as unknown as ReservationSlotRow[];
      }
    } catch (e) {
      console.error("[studio-build] slot load failed", e);
    }

    return { isBusiness, store, coupons, manageCoupons, myRewards, dockCount, slots };
  },
  component: StudioBuild,
});

// UI-5-T6b — 49 렌더(주소 유지·내용물 교체). loader 무변(상위집합) — 49 소비분만 주입:
//   initialStore(id·display_name — StudioBuildStore 구조적 상위집합이라 그대로 통과) · initialSlots.
//   45 전용 props 미전달 정리 근거: coupons/manageCoupons = 49 가 get_active_store_coupons 자체
//   로드(E5d) / dockCount = 49 dock 은 목업(E4e-2 차단) / myRewards = 49 헤더 미표시 /
//   initialPurpose = 49 모드 프리셋 미지원(딥링크는 URL 계약만 유지). 잉여 loader 재료는 45
//   롤백 자산 겸 후속 이식분으로 보존(loader 수술 금지 — 조사 확정).
function StudioBuild() {
  const data = Route.useLoaderData();
  // UI-5-T6b — 비사업자 = ⓑ 등록 유도 화면(Duke 확정): 강제 이송 금지(P6-3 잠금 열람 취지 승계),
  //   판정 = 기존 loader 재료(isBusiness·store) 재사용.
  if (!data.isBusiness || !data.store) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-[17px] font-extrabold leading-snug tracking-ko text-[#16161D] [word-break:keep-all]">
          카드 만들기는 사장님 전용이에요 — 1분이면 등록할 수 있어요
        </p>
        <Link
          to="/partner/register"
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#1D4ED8] px-4 text-[14px] font-bold text-white transition-transform active:scale-[0.98]"
        >
          파트너 등록하기
        </Link>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="min-h-[44px] px-2 text-[13px] font-medium text-[#8A8A8A] transition-opacity active:opacity-70"
        >
          둘러보기
        </button>
      </main>
    );
  }
  return <CardStudioPage initialStore={data.store} initialSlots={data.slots} />;
}
