# STEP 5 — me v4 (내 페이지) 포트 실행 스펙 (계획 반영 · 결제 보존 최우선)

대상: `/me` (`src/routes/_user/me.tsx`)
디자인 소스: `docs/ref/me.tsx` (v0 me v4)
전제: CC 계획 완료. 결제 배선(CashSection/useHectoCharge/Hecto API·server·DB) 확인됨.
원칙: **구조·데이터·결제 보존 + 비주얼만 v0** (STEP4 선례).

---

## 🔴 #1 결제 보존 (절대 — 재구현 0)
- **캐시 탭 = 라이브 `<CashSection/>` 그대로 마운트(a안).** v4는 CashSection을 **감싸는 셸·토큰만** 조정.
- `useHectoCharge` · 약관 3항목(구매조건 / 캐시약관 **환급불가** / 개인정보) · 이용내역 · **[결제취소]** · SDK 로드 = **무수정.**
- **무접촉:** `/api/hecto/order|next|noti|cancel|cancel-tx` · `server/payments/hecto/*` · DB(`cash_wallets`/`cash_ledger`/`payment_notifications`) · RPC(`grant_cash_charge`/`use_cash`/`cash_charge_cancel_*`).
- CashSection UI를 v4 mock으로 **"다시 짜지 마라"**(약관 게이트·noti·취소 깨짐 위험).
- ※ v4 `CashPanel` mock 마크업은 **참고만.** 캐시 탭 비주얼은 CashSection 기존 UI 유지(v4 토큰으로 셸만 정리).

## 지갑 3탭 (cash/coupon/dropy) — v4 비주얼 + 라이브 데이터
- 탭 전환 = 기존 `walletTab` state 유지.
- **cash** → `<CashSection/>` (위 보존).
- **coupon** → 라이브 `coupons`(CouponClaimRow) 필터 리스트, v4 `CouponTicketCard` 비주얼.
- **dropy** → 라이브 드로피 섹션, v4 `DropyTxnRow` 비주얼.

## 나머지 = v4 비주얼 + 라이브 데이터
- 프로필 히어로(잉크 카드) + 자산요약(cash/dropy/coupon) + 보조스탯(만든/보낸/구독) — v4, 라이브.
- 구독한 매장(MakerRow) · 받은 쿠폰 메이커 · 만든 카드 — v4, 라이브(`myDrops`·`subscribedMakers` 등).
- 설정 = v4 **인라인 아코디언(#418 준수)** + 로그아웃(기존 AlertDialog + signOut **보존**).

## 하위페이지 배선 (기존 라우트 재사용 — 신규 최소)
- 프로필 편집 → `/profile` · 내 매장 → `/partner`(isBusiness) · 내 주문 → `/me-orders` · 알림함 → `/inbox`.
- 만든 카드 항목 → 기존 카드 진입(`/card-edit`·`/results`·`/d` 등 기존대로) 또는 인라인 유지.
- 설정 items(알림/개인정보/도움말) → 기존 대상 or 인라인. **별도 라우트 없는 건 신규 생성 대신 기존/인라인.**
- ⚠️ 신규 라우트가 꼭 필요하면 `routeTree.gen` 자동재생성 → 커밋 시 별도 유닛.

## 무접촉
Hecto API·server·DB·RPC · CashSection/useHectoCharge **로직** · `feed-queries` · `CardBody.*` · `adapters` · `share-journey` · `studio-build` · `explore` · 홈 컴포넌트(배포분).
mock 금지(라이브 로더만). `git add -A`/`stash`/`commit`/`wrangler deploy` 금지.

## 디자인 락
무채색 + **#2563EB** · 이모지 금지 · **blink/pulse 금지** · 60대 · **Radix Dialog/Sheet/Drawer 금지**(인라인).

## 검증
1. `bun run build` 성공.
2. ★ **결제 무결성**: `?purpose=cash_charge` 주문 생성 · mchtParam(uid) 회수 · 약관 미체크 시 결제 비활성 · charge행에서만 [결제취소] · 잔액 폴링 — 포트 후 **동일**.
3. 지갑 3탭·프로필·구독·설정 라이브 데이터 정상.
4. 무접촉 파일 손 안 댐(`git status`).
5. 커밋·배포 안 함.
