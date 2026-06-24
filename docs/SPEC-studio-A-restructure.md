# [MODIFY] 스튜디오 셸 재구성 — 목적-first + 연결5 + §0 정리 (A)

## 대상 파일 (이것만)
- src/routes/_user/studio.tsx

다른 파일 절대 수정 금지: bottom-nav.tsx, create-wizard.tsx, create/*, partner/*, explore/* 등 일절 변경하지 말 것.
(아래 "사전 READ"는 읽기만 — 수정 금지.)

## 사전 READ (수정 금지, 확인 전용)
작업 전 아래 2개를 읽어서 "목적(intent/purpose) 전달 방식"만 파악한다:
- src/routes/_user/create-wizard.tsx
- src/components/create/Step2Purpose.tsx

확인할 것:
- create-wizard 라우트가 목적을 search param 또는 navigation state 로 받아 Step2Purpose 를 프리셀렉트할 수 있는가.
- Step2Purpose 가 쓰는 실제 목적 값/키(예: 'info' / 'coupon' / 'reservation' / 'commerce' 등 — 코드에 있는 그대로).

처리:
- 받을 수 있으면: 스튜디오 목적 버튼이 그 값을 넘겨 위저드에서 해당 목적이 프리셀렉트되게 한다. (값/키는 Step2Purpose 코드 기준 그대로 사용 — 임의 추측 금지.)
- 못 받으면: 목적 버튼은 /create-wizard 로 그냥 이동(프리셀렉트 없이) + 보고에 "목적 param 미지원" 명시.

※ 위저드/Step2Purpose 코드는 읽기만. 절대 수정하지 말 것.

## 변경 내용 (studio.tsx SECTIONS 재구성)
현재 3섹션(콘텐츠 만들기 / 목적·혜택 / 강화·노출)을 아래 3섹션으로 교체한다.

### 섹션 1 — "새 카드 만들기" (목적-first)
- 영상 가져오기  → /create-wizard  (기존 연결 그대로 유지)
- 정보           → 위저드(목적=정보)        ← 사전 READ대로 목적 전달
- 쿠폰·예약       → 위저드(목적=쿠폰·예약)
- 커머스         → 위저드(목적=커머스)

### 섹션 2 — "모셔오기" (큐레이션)
- 블로그·뉴스     → /explore  (네이버 모셔오기 기능이 거기 있음)
- 카드뉴스 모셔오기 → placeholder (toast "준비 중이에요")
  · 라벨 "카드뉴스" → "카드뉴스 모셔오기" 로 변경. 동작은 placeholder.
  · (사유: §0 — 카드뉴스 '생성' 금지, 외부 URL '모셔오기'만 허용. 신규 기능은 후속 트랙.)
- 이미지 올리기   → placeholder (toast "준비 중이에요")

### 섹션 3 — "내 카드 강화"
- 마케팅 강화     → /partner/promotion
  · /partner/promotion 이 현재 _user 스튜디오 컨텍스트에서 접근 가능한지 확인.
    _partner 게이트로 막히면 그대로 두되 보고에 "게이트 막힘" 명시(이번 범위에서 게이트 우회·수정 금지).
- 노출 강화       → placeholder (toast "준비 중이에요")
- 상위 노출       → placeholder (toast "준비 중이에요")

### 제거
- "영상 편집" 도구 완전 삭제: SECTIONS 배열 항목 제거 + 더 이상 안 쓰는 Scissors import 정리.
  · (사유: §0 — LinkDrop 은 원본 미디어 편집/생성 안 함. 구간지정(TimeLink)은 위저드 옵션 영역이지 스튜디오 강화 도구 아님.)

## 보존 (회귀 0)
- 상단 CreatorCoachCard + 헤더 "내 캐쉬 —" placeholder 그대로.
- 라우트 loader 없음 패턴 그대로(_user beforeLoad 가 auth 단독 처리 — 세션/userId throw 금지, 리다이렉트 루프 방지).
- TOOL_BTN_CLASS · ToolInner · grid 레이아웃 · v0.26 검정 미니멀(#0A0A0A 계열) · Lucide 라인 아이콘 스타일 그대로.
- placeholder 도구는 기존 toast.info 패턴 재사용.
- 위저드 / 파트너 / explore / bottom-nav 등 다른 파일 일절 무변경. DDL 0. 배포 0.

## 완료 후 보고
- 변경 파일 · 라인 수.
- 사전 READ 결과: create-wizard 가 목적 param 지원하는지(지원 시 키/방식) + 목적 버튼 최종 연결 방식.
- /partner/promotion 접근 가능 여부(게이트 막힘 유무).
- 최종 SECTIONS 구조(섹션명 + 각 도구의 연결 대상 / placeholder 여부).
- "영상 편집" 제거 확인 + Scissors import 정리 확인.
- typecheck: baseline(me.tsx:913, index.tsx:60) 외 신규 에러 0.
- 배포 분리: 프론트(bun run build + bunx wrangler deploy)는 Duke 가 별도 실행. CC 는 커밋/푸시/배포 하지 말 것.
