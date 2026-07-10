# STEP 4 — explore 포트 실행 스펙 (비주얼 리프레시 · 이대로 실행)

대상: `/explore` (`src/routes/_user/explore.tsx` — 자기완결형 단일 파일)
디자인 소스: `docs/ref/explore.tsx` (v0)
전제: `ShareCardTile`은 이미 v0로 이식됨(재사용). live explore는 구조·데이터·§0가 이미 맞음 → **비주얼만 v0로 교체.**

---

## 핵심 = 구조는 유지, 겉모습만 v0
live explore는 이미 잘 짜여 있음(intent 4탭 · getDiscoverDrops 서버필터 · §0 무정렬). **로직·데이터는 그대로 두고 v0 비주얼만 입힌다.**

## 절대 원칙
- v0 mock 데이터·정렬 드롭다운 **사용 금지.**
- live 로더(getDiscoverDrops 4회)·§0 최신순 고정 **유지.**
- `git add -A` / `git stash` / `git commit` / `wrangler deploy` 금지.
- 스펙과 live 어긋나면 STOP·보고.

## 유지 (live 로직 — 무변경)
- **로더:** `getDiscoverDrops` 4회 병렬 — 전체(필터無) / 정보(purpose 정보) / 쿠폰(purpose 쿠폰+예약, bizOnly) / 상품판매(purpose 구매) + `serverNow`. **그대로.**
- **4탭 intent 택소노미:** 전체 · 정보 · 쿠폰 · 상품판매. `data[tab]` 선택 로직 유지.
- **§0 무정렬:** 최신순 고정(`published_at desc`). **정렬 드롭다운 미포함** — v0의 `sortOpen`/`SORTS`/정렬 메뉴 코드는 **가져오지 마라.**
- **ShareCardTile props 계약:** drop · purpose={drop.intent} · isMine · expiresAt · serverNow · remainingStock · shareCount · dropyReward · onShare · onClick(→/d). 홈과 동일.

## 교체 (비주얼 → v0)
- **카테고리 탭 칩:** v0식(아이콘 + 라벨, 블루 활성, 가로 스크롤). 라벨/키는 live 4탭 그대로.
- **뷰 토글:** grid | list (v0 헤더 우측 흰칩). 기본 grid. 세션 state만(localStorage 금지).
- **카드 레이아웃:**
  - grid = 2열 `grid-cols-2 gap-3`, ShareCardTile `layout="grid"`(세로).
  - **list = v0 가로카드** `flex flex-col gap-2.5`, ShareCardTile **`layout="row"`**. (live의 1열 세로 아님 — v0 row로 교체)
- **카운트 배지:** "N개의 카드" (v0 스타일).
- **빈 상태:** "아직 공개된 카드가 없어요" (v0).
- **헤더/explore mark:** v0 비주얼.

## 무접촉
`ShareCardTile`(재사용, 무수정 — 공유 export 포함) · `feed-queries.ts`(기존 함수 무변경) · `CardBody.*` · `adapters.ts` · `share-journey.tsx` · `studio-build.tsx` · `info-drop-page.tsx` · 홈 컴포넌트(RoleHome/HomeActivitySegment 등).

## 디자인 락
무채색 + **#2563EB 단색** · 이모지 금지 · **blink/pulse 금지** · 60대 · **Radix Dialog/Sheet/Drawer 금지**. (정렬 드롭다운 자체를 안 가져오므로 absolute 메뉴 이슈 없음)

## 검증
1. `bun run build` 성공.
2. `git status --short`: 예상 수정 = `src/routes/_user/explore.tsx`(주). 필요 시 소폭 스타일 유틸. **무접촉 파일 없어야.**
3. ShareCardTile 무변경 확인(공유 export 4개 시그니처 그대로).
4. 커밋·배포 안 함.
