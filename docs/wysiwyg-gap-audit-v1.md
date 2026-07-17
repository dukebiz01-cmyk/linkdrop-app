# WYSIWYG 전수 격차 감사 v1 (2026-07-17)

> W-READ 감사 산출물. 코드 수정 0. S1 커밋 보류·S2 미착수 상태의 **작업 트리 기준**
> (미커밋 변경 포함: `src/components/card-model/CardModelBody.tsx`, `src/components/info-drop-page.tsx`).
> 슬라이스 명칭은 `docs/mirror-convergence-boundary-v1.md` §④ (S1 info / S2 coupon / S3 reservation / S4 purchase) 기준.

## 0. 감사 조건·한계 (사실 명시)

- dev 서버 청결 재기동 후 localhost:8080 실렌더 (Vite 7.3.2).
- 파일럿 실카드 4종 (모래재/노을재 캠핑장 + 찰옥수수, 전부 published):

  | variant | drop_id | share_uuid | card_color |
  |---|---|---|---|
  | 정보 | `4dd875a2` | `a8acb1fd-e27e-4174-aea0-dbe5a204c627` | `#0F172A` |
  | 쿠폰 | `b1b1038d` (funnel_coupon 연결) | `cf851707-5fec-4f77-9fc2-c58e98e604a0` | null |
  | 예약 | `ef05abf8` (쿠폰 동시 장착) | `32908f71-1fbf-439a-adec-f7790b84d795` | `#1E3A8A` |
  | 구매 | `8d589db5` (찰옥수수, 7/16 발행) | `c5205d49-be62-43d8-9090-fa631a18251a` | null |

- **시크릿 창 미사용**: 브라우저 확장이 일반 프로필에서만 동작. /d 열람은 Duke 세션이 남은 일반 탭에서 수행
  — /d 는 무로그인 열람 설계라 콘텐츠 자체는 동일하나, 세션 유무에 따른 차이(P6-4 열람자 사업자 분기 등)는 이 감사에서 분리 검증 못 함.
- **test01@drop.how 로그인 미수행**: 비밀번호 직접 입력은 내(Claude) 안전 규칙상 금지라 시도 자체를 안 함.
  다만 기존 세션이 `is_active_partner_owner` 게이트를 통과해 **스튜디오(CardStudioPage45)가 실렌더됨** — 게이트 차단 없음, 코드 READ 재구성 불필요.
- 스튜디오 렌더는 매장 "모래재 캠핑장" 컨텍스트. 같은 영상(`youtube.com/watch?v=bJfLWylz1Zk`)을 퍼블릭 모드에 실제 장착([이 영상으로 확정])해 비교.
  예약·쿠폰/상품판매 모드는 **프레임(빈 카드) 수준까지만** 실렌더 — 쿠폰·캘린더·상품 완전 장착 상태는 렌더러 불안정(장시간 CDP 프리즈 반복)으로 코드 READ 보강. 해당 칸은 표에 `[code]` 표기.
- **Duke 육안 이관 항목**: ① 예약·쿠폰 모드에서 쿠폰+캘린더 장착 완료 상태의 미리보기 ↔ /d 쿠폰·예약 실카드,
  ② 상품판매 모드 상품 등록 완료 상태 ↔ /d 구매 실카드, ③ [수신자 화면 미리보기] 버튼(스튜디오 내장, ref 존재 확인) 화면 ↔ /d 실화면.
- 관찰 이상 1건(비재현): /d info 스크롤 도중 HMR/리하이드레이션 시점에 카드가 **흰색으로 1프레임 렌더**된 캡처 존재.
  청결 재로드 시 항상 다크(#0F172A)로 렌더 — SSR/CSR 색 적용 시차 의심, 재현 실패로 격차표 미등재(관찰 기록만).

## 1. variant 4종 거울 대조

캡처 ID (세션 스크린샷): 정보 /d `ss_7741flido`·`ss_48919ubvv` / 쿠폰 /d `ss_2218k5015`·`ss_74580wbog`·`ss_0993ye4lf` /
예약 /d `ss_5817y1h76`·`ss_2338430xb`·`ss_58374zzxa` / 구매 /d `ss_24952t0pm`·`ss_3069czp7z` /
스튜디오 퍼블릭 `ss_8304rd0no`·`ss_6942vn54s`·`ss_3714f2x7o` / 예약·쿠폰 `ss_3927rzfng`·`ss_213838q6i` / 상품판매 `ss_8260w1i4q`.

### 1-0. 전 variant 공통 격차

| 항목 | 스튜디오 미리보기 | /d 실화면 | 격차 유형 |
|---|---|---|---|
| 페이지 셸 배경 | `PAGE_BG #FAFAFA` (CardStudioPage45:197) | info=`#F5F5F5` 고정 / 비-info=`cardColor ?? #1E3A8A` (info-drop-page:1303) | 스타일 |
| 보낸이 헤더 (아바타·"○○님이 보냈어요"·사용자 공유 배지) | 없음 | 있음 (최상단) | 크롬위치 |
| 소식 받기 버튼 | 없음 | 있음 | 필드누락(미리보기에) |
| 하단 액션바 | [링크 복사]·[카톡 공유] 2버튼 + dashed "한마디 여기에 붙어요"/"행동 버튼이 생겨요" 자리표시 | Wand pill + 복사 + 댓글 3버튼 | 컴포넌트상이 |
| FTC 광고 고지 | 있음 (문구 거의 동일) | 있음 + **문제 신고 링크** + **공유 여정 보기** collapse | 필드누락(미리보기에) |
| 카드 배경색 | 항상 `#FFFFFF` (CARD_BASE — ENABLE_CARD_COLORS=false 고정) | 저장색 있으면 적용, null이면 info 흰/비-info 네이비 | **FIX-56** |
| URL `?variant=` | — | validateSearch 정규화가 항상 `?variant=info` 를 URL에 기록 (d.$shareUuid:163). 실제 렌더 variant 는 purpose 기반(infoDropAdapter→resolvedVariant :803) — URL 파람은 DB 카드에 사실상 무시 | 관찰(혼동 소지) |

### 1-1. 정보 (스튜디오 퍼블릭 ↔ /d info)

| 항목 | 스튜디오 | /d | 격차 유형 |
|---|---|---|---|
| 카드 chip | "퍼블릭 카드" | "정보 카드" | 스타일(라벨 상이) |
| 카드 배경 | 흰색 | **저장색 `#0F172A` 적용**(다크) — CardModelBody:196 | FIX-56 |
| 영상·제목 | 동일 (영상 썸네일 + 원제목) | 동일 | — |
| 한마디 | placeholder "한마디를 입력해 보세요" | (미입력 카드라 비표시) | — |
| AI 키포인트 (체크 3줄) | **미리보기 미표시** (pickedPoints 는 발행 시 `update_drop_key_points` 로만 영속) | 카드 내 3줄 렌더 | 필드누락 |
| 영상 요약 collapse | 없음 | 있음 (카드 밖 크롬) | 컴포넌트상이 |

### 1-2. 쿠폰 (스튜디오 예약·쿠폰 ↔ /d coupon)

| 항목 | 스튜디오 | /d | 격차 유형 |
|---|---|---|---|
| 카드 프레임 | **흰 카드 (CardModelBody)** | **네이비 DropCardShell** (`cardColor ?? #1E3A8A`, DropCardShell:67) | 컴포넌트상이 (S2 본체) |
| 카드 chip | "예약·쿠폰 카드" (민트/블루 chip) | 없음 — 대신 "▶ YouTube · 원제목" 헤더라인 | 스타일 |
| 제목 | 매장명 fallback ("모래재 캠핑장") | 영상 원제목 | 필드누락(제목 소스 상이) |
| 매장정보 | [매장정보] 버튼 (카드 내) | [정보 보기] collapse (카드 하단) | 크롬위치 |
| 키포인트 | 미표시 | 체크 5줄 | 필드누락 |
| 쿠폰 존 | 장착 시 카드 내 렌더 `[code]` (덱 12종 중 쿠폰 블록) | "예약하면 받는 혜택" + **D-day 타이머 배지(D-18 hh:mm:ss)** + 쿠폰 카드(혜택명·쿠폰 증정 chip·기한) | 필드누락(타이머 미리보기 부재 — S0 "쿠폰 타이머 갭" 잔존) |
| CTA | (장착 전 자리표시) | [쿠폰 받기] **파란(#2563EB 계열) 채움 버튼** + [예약 날짜 선택] collapse | 컴포넌트상이 |

### 1-3. 예약 (스튜디오 예약·쿠폰 ↔ /d reservation)

| 항목 | 스튜디오 | /d | 격차 유형 |
|---|---|---|---|
| 모드↔variant 매핑 | **모드 1개(예약·쿠폰)** | **variant 2개(coupon/reservation)로 분기** — purpose 저장값이 결정 | 구조(1:2 매핑 자체가 WYSIWYG 위반 소지) |
| 인트로 헤더 | 없음 | "예약" 그린 chip + "날짜 선택과 예약 연결" 헤드라인 + 설명 + 매장명 | 필드누락 |
| 카드 프레임 | 흰 카드 | 네이비 셸 (`#1E3A8A` — 이 카드는 저장색과 fallback 이 동치) | 컴포넌트상이 |
| 쿠폰 CTA 색 | — | [쿠폰 받기] **흰색 버튼** (coupon variant 에선 파랑 — variant 별 CTA 색 상이) | 스타일 |
| 캘린더 | [예약 캘린더 장착] CTA → 장착 시 카드 내 `[code]` | [예약 날짜 선택] collapse (페이지 크롬, S3 존치 대상) | 크롬위치 |
| 키포인트/타이머 | 1-2 와 동일 격차 | 체크 5줄 + D-타이머 | 필드누락 |

### 1-4. 구매 (스튜디오 상품판매 ↔ /d purchase)

| 항목 | 스튜디오 | /d | 격차 유형 |
|---|---|---|---|
| 위저드 크롬 | **7단계**(사진→상품명→원산지→가격→발송기준→도킹→발행), 그린 액센트 | — | (제작 전용 크롬) |
| 카드 프레임 | 흰 카드 + 그린 dashed 등록 placeholder | 네이비 셸 + 흰 상품 카드 | 컴포넌트상이 (S4 본체) |
| 상품 필드 | 이미지·이름·가격 등록 시 카드 반영 `[code]` (:1896-1907 self_upload body) | 이미지·이름·가격(15,000원)·**매장명+주소 전문** 노출 | 필드누락+주소(FIX-54 계열 재점검 대상) |
| 재고/발송 | productStockLimit state 존재 (:802) `[code]` | "신선 원물·7월 23일 수확·발송 예정·30박스 한정" 박스 + **우하단 floating "30박스 남음" chip** | 필드누락 |
| Droppy 라인 | `[code]` 미확인 | "◇ Droppy · 판매 성사 시 적립 (준비중)" — 드로피 준비중 락 준수 확인 | — |
| CTA | — | [주문예약] 그린 채움 + Wand pill 도 그린(액센트 전파) | — |
| AI 요약 | — | "AI 요약" collapse (정보의 "영상 요약"과 라벨 상이) | 스타일 |

## 2. FIX-56 색 정본 판정 (통합)

### 실태 (파일:라인 근거)

- `CARD_COLORS` 6색: `CardStudioPage45.tsx:186-193` (ink `#0F172A` / forest `#14532D` / navy `#1E3A8A` / wine `#7F1D1D` / sand `#78350F` / slate `#334155`) + 기본 `CARD_BASE #FFFFFF`(:198).
- **색선택 칩은 렌더 도달 불가(봉인)**: `ENABLE_CARD_COLORS = false` (:275) → 덱에서 bgcolor 블록 필터(:855), 팔레트 패널 게이트(:3282). 주석 명시 "코드 삭제 금지(보존) — true 로 되돌리면 재활성".
- `cardColor` 기본값: `useState(CARD_BASE)` = `#FFFFFF` (:600). 발행 시 `set_drop_card_color` 는 **기본색이면 스킵**(:2029-2039) → **현행 신규 발행은 색을 영원히 저장하지 않음**.
- 흐름: `cardColor` → `fromStudioState`(card-model-adapters.ts:297, 기본 `DEFAULT_CARD_COLOR #FFFFFF`:31) → `CardModelBody` `style={{backgroundColor: cardColor}}`(:196).
- /d 수신 출처: `adapters.ts:438` `cardColor: d.drop.card_color ?? undefined` (기본색 강제 안 함) →
  - info variant: CardModelBody 카드 본체에 **저장색 적용** (실측: `#0F172A` 카드 다크 렌더 확인)
  - coupon/reserve: `DropCardShell cardColor={cardColor ?? "#1E3A8A"}` (info-drop-page:1436/1528) — 저장색 적용, null=네이비
  - 텍스트 밝기 분기는 `isLightCard = cardColor === "#FFFFFF"` 정확 일치 1개뿐(:808).
- 구발행 저장색 DB 실측 분포: null 395 / `#FFFFFF` 52 / `#1E3A8A` 13 / `#14532D` 6 / `#0F172A` 4.

### 폐기 근거 탐색 결과

- git: `2806a75` "…배경색 UI 제거(플래그 보존)…(FIX-28)" 이 봉인 커밋(제목뿐, 본문 근거 없음). 선행 `de4463c` "색 선택 임시 숨김(navy 고정)". 도입 `af1bdbf`(6색 팔레트), 파이프 `a87700c`, DB `e2aaa73`(v7.2). `FIX-56`·`palette` grep 히트 0.
- docs: 폐기 결정문·대체 배색(카드 기본 배경 정본) **어느 문서에도 없음**. v7.2 마이그레이션 주석은 "저장만, NULL=흰배경 fallback" 정책만 기록.

### 판정

> **확정 (Day45 Duke)**: 팔레트 영구 폐기. 수신 렌더는 저장색 무시 — 흰색(#FFFFFF) 정본. DB `card_color` 값은 보존(읽기만 차단).
> 적용: `fromDropDetail` cardColor 고정(신 경로만). 구 경로 navy 폴백(:1303/1436/1528)은 S2/S3 수렴 때 경로째 소멸(기결정).

(아래는 확정 전 감사 시점의 판정 기록 — 이력 보존)

**정본 미기록 — Duke 확정 필요.** 현행 코드의 사실상 기본값만 존재: 스튜디오/신규발행 `#FFFFFF`, /d info 흰색, /d coupon·reserve `#1E3A8A`.
확정 필요한 질문 2개: ① 팔레트(6색) 영구 폐기냐 재활성이냐(플래그 보존 중) ② 구발행 저장색 75건(비-null)을 계속 존중하느냐, 정본 배색으로 리셋하느냐.
어느 쪽이든 "스튜디오 미리보기 흰색 ↔ /d 비-info 네이비" 불일치는 FIX-56 범위에서 해소해야 WYSIWYG 성립.

## 3. 발행 후 편집 격차표 (헌법② 기초자료)

발행 후 수정 서버 능력(RPC)은 4종 존재하나, **발행 후 편집 UI가 노출하는 것은 curator_message 1개뿐**.

| RPC (정본) | 수정 필드 | 발행 시 호출 | 발행 후 UI |
|---|---|---|---|
| `update_drop` (v8.8, 4-인자) | share_events.curator_message / info_drops.curator_note / product 블록 `{sale_start,sale_end}` 화이트리스트 merge | CardStudioPage45:2015 (sale 기간만) | **card-edit.$shareUuid:81 — curator_message 만** (note는 null 고정, block_patch 미전달) |
| `set_drop_funnel_coupon` (v5.12) | funnel_coupon_id | :1982 | 없음 |
| `set_drop_card_color` (v7.2) | card_color | :2031 (기본색이라 실제 항상 스킵) | 없음 |
| `update_drop_key_points` (**SQL 저장소 부재** — 선존 RPC, 수정 컬럼 미단정) | (개연성: ai_key_points) | :1994 | 없음 |

| 항목 | 스튜디오 제작 시 | 발행 후 편집 | 격차 |
|---|---|---|---|
| 한마디(curator_message) | O (cfgSubtitle) | **O** (card-edit 유일 항목) | — |
| 영상/핵심구간·블록 | O | ✗ | UI+RPC 둘 다 없음 |
| 목적(purpose)·공개여부 | O | ✗ | 〃 |
| 쿠폰 연결 | O | ✗ | **RPC 있음, UI 없음** |
| 키포인트 | O | ✗ | 〃 |
| 판매기간(sale_start/end) | O | ✗ | 〃 (update_drop block_patch) |
| 카드색 | (봉인) | ✗ | RPC 있음, 입구 양쪽 다 봉인 |
| 상품 정보(이름·가격·이미지) | O | ✗ | UI+RPC 없음 |

- me 만든카드 "수정" 경로: me.tsx 에는 카드별 수정 없음(→ /home?activity=made 링크만).
  실버튼은 `HomeActivitySegment.tsx:200-214` → `/card-edit/$shareUuid` → curator_message 단일 편집. 스튜디오 재진입 아님.

## 4. 격차 총목록 · 트랙 배정 초안 (Duke 확정 전)

| # | 격차 | 소속 트랙 |
|---|---|---|
| G1 | 카드색 불일치 (스튜디오 항상 흰 ↔ /d 저장색/네이비) + 팔레트 정본 미기록 | **FIX-56** (선결 — S2~S4 프레임 색이 여기 걸림) |
| G2 | 쿠폰 variant 본체: DropCardShell↔CardModelBody 프레임·chip·제목 소스·쿠폰 존·타이머 미리보기 부재 | **S2 (coupon)** |
| G3 | 예약 variant: 인트로 헤더·CTA 색 상이·캘린더 크롬 경계 (본체만 교체, 캘린더 존치 원칙 준수) | **S3 (reservation)** |
| G4 | 구매 variant: 상품 카드 프레임·재고 chip·발송 박스·주소 노출 재점검 | **S4 (purchase)** |
| G5 | 키포인트 미리보기 부재 (전 variant, 발행 후에만 보임) | S2 편입 권고 (본체 필드) |
| G6 | 페이지 크롬 비대칭 (보낸이 헤더·소식받기·영상요약·문제신고·공유여정 — 미리보기에 없음) | S5/수신자 미리보기 트랙 (스튜디오 [수신자 화면 미리보기] 버튼 활용 검증 우선) |
| G7 | 발행 후 편집: RPC 4종 대비 UI 1종(curator_message) — 쿠폰·키포인트·판매기간 재편집 입구 부재 | **재편집 트랙 (헌법②)** |
| G8 | 모드(3)↔variant(4) 1:2 매핑, `?variant=info` URL 잔재 | 구조 정리 — S2/S3 착수 시 경계 문서에 판정 추가 |

우선순위 권고: **FIX-56(G1) → S2(G2+G5) → S3(G3) → S4(G4) → 재편집(G7) → 크롬(G6/G8)**.
근거: G1이 모든 프레임 색의 선결 조건이고, G7은 서버 능력이 이미 있어 UI 작업만으로 격차 해소 가능(독립 트랙 병행 가능).
