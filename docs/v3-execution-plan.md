# LinkDrop v3.0 UI/UX 리뉴얼 — 실행 플랜

> 실행 트랙 지시서. 기획 배경 문서는 `docs/v3-renewal-spec.md` (보존, 수정 X) 참조.
> 이 문서는 Step 1~9 순차 실행의 단일 기준선이다.

## 0. 메타

- 작성일: 2026-05-20
- 근거: Duke 채팅 지시 (v3.0 백엔드/구조 트랙) + `docs/v3-renewal-spec.md` (기획 배경)
- 작성 원칙:
  - 기존 schema **확장만**. 새 테이블 생성 금지 (`info_drops` → `drops` 같은 신규 테이블 X).
  - `docs/v3-renewal-spec.md` §15 데이터 초안(`drops` / `drop_blocks` / `booking_links` 등)은 **참조하지 않는다.** 그것은 greenfield 초안이고 현 DB와 충돌한다.
  - SQL / TypeScript는 실제 코드로 작성. placeholder 금지.
  - Step별 보고 후 Duke OK 게이트를 통과해야 다음 Step 진행.

### 보강 설계 부분 — Duke 확정 완료 (2026-05-20)

지시 메시지 일부가 압축/잘림 상태여서 Claude가 보강 설계한 항목은 모두 **부록 A~F에서 Duke가 확정**했다. 상세는 문서 끝 「부록」 참조.

---

## 1. 본질

LinkDrop v3.0 = 영상 링크를 **목적 있는 행동 페이지**로 바꾸는 공유 전환 엔진.

```
영상 링크 → AI 분석 → 정보 / 쿠폰 / 예약 / 구매 / 상담 행동 페이지(Drop) → 카톡 공유 → 무로그인 열람 → 행동
```

진짜 가치는 예쁜 링크 페이지가 아니라 **영상 속 관심을 행동·매출로 바꾸는 전환 데이터**다.

---

## 2. 결정 락 (절대 변경 X)

### 2-1. B안 — 5 목적(UX) + 9 intent(DB 엔진) 분리

- **5 목적** (사용자가 보는 UX 레이어): 정보 / 쿠폰 / 예약 / 구매 / 상담
- **9 intent** (DB 엔진 레이어): 기존 `intent_types` 테이블 9행 **그대로 보존**
- 매핑: `intent_types.purpose` 컬럼을 **신규 추가**하여 9 intent → 5 목적 연결
- 새 `drops` 테이블 생성 **절대 금지**. 기존 `info_drops` **확장만**.
- **밈**(meme / viral_share) = Phase 2. `intent_types`에 `purpose='밈'` 매핑은 하되 Phase 1 사용자 UI 미노출.
- 메모리 slug: `linkdrop_v3_ux_5_purposes_engine_9_intents`

### 2-2. C안 — 캠핑장 예약 = 외부 link (Phase 1)

- Phase 1: 외부 예약 link (캠핏 / 야놀자 / 네이버 예약) + 전화 + 문자 + 카카오톡 연결
- LinkDrop 내부 **캘린더 UI 보존** + 날짜/박수/인원 **데이터 보존** → `info_drops.reservation_data` (jsonb) 신규 컬럼
- 자체 예약 시스템(재고·확정·정산) = **Phase 2** (이번 트랙 범위 밖)
- 이벤트 추적: `reservation_click`
- 메모리 slug: `linkdrop_v3_campsite_external_links_phase_1`

### 2-3. C안 — 4-카테고리 보존, Phase 1 미노출, Phase 2 활용

- 4-카테고리(로컬 / 퍼퓰러 / 페이머스 / 쇼퍼) = **보존**
- Phase 1: Drop 생성 UX에 **미노출**
- Phase 2: 탐색 / 추천 / 피드 / 마켓플레이스에서 활용
- `partners.category`, `drops.category`(=`info_drops`의 category 계열 컬럼) **컬럼 유지** — 삭제 금지
- 메모리 slug: `linkdrop_v3_4categories_phase_2_discovery`

### 2-4. 리뉴얼 UX 원칙

- 영상 → Drop → 행동 전환이 중심
- 홈 = 영상 링크 입력 화면 (피드 아님)
- 받은 사람 = **무로그인 열람** (로그인 요구는 바이럴을 죽인다)
- AI 가격비교 = 핵심 차별화 기능
- 쉬운 말: "URL" → "영상 링크", "CTA" → "버튼"
- 5단계 wizard, 30초 안에 첫 Drop 완성
- 초등학생 + 어르신도 사용 가능한 난이도
- 메모리 slug: `linkdrop_v3_renewal_ux_principles`

---

## 3. 절대 금지

- **docx §15의 '기존 테이블 대체' 부분 참조 절대 X** (Duke 2026-05-20 정정):
  - `drops` 신규 생성 X — `info_drops` 활용
  - `drop_blocks` 신규 생성 X — `component_blocks` 활용
  - `booking_links` 신규 생성 X — `drop_ctas` 활용
  - 기존 테이블명 변경 X
- 단, **1:N 관계상 진짜 필요한 보조 데이터 정규화 테이블은 정공법 허용**:
  - jsonb 비효율인 경우 (예: `product_offers` — 1 상품 : N 셀러)
  - 검색/RLS가 필요한 경우 (예: `consultation_leads.phone_hash`)
  - 집계 query가 필요한 경우 (예: 이벤트 시계열 집계)
  - schema 진화가 필요한 경우
- 9 intent 시스템 변경 X (`intent_types` 9행 보존)
- 4-카테고리 삭제 X
- 기존 테이블명 변경 X (`info_drops` → `drops` X, `share_events` → `events` X)
- 디자인 토큰 변경 X (`#2563EB` / `#0A0A0A` / `#525252` / `#A3A3A3` / `#E5E5E5` / `#F5F5F5` / `#FAFAFA`, Pretendard)
- TimeLink 헬퍼(`src/lib/time-link.ts`) 변경 X
- 자체 캠핑장 예약 시스템 X (Phase 2)
- 자체 결제 X (Phase 2+)
- 신뢰 라벨 X (Phase 2)
- Kakao Share SDK 교체 X
- Supabase + Cloudflare 인프라 변경 X
- PR #10~#22 기존 작업 되돌리기 X

---

## 4. 진행 방식 / 보고 형식

각 Step 종료 시 다음을 보고하고 Duke OK를 기다린다:

1. 진행한 작업
2. 변경 파일 목록
3. 검증 결과
4. 다음 Step 진행 여부 — Duke 확인 대기

게이트 순서:
`플랜 작성 완료` → Duke 검토 → `Step 1` → 보고 → Duke OK → `Step 2` → … → `Step 9`

---

## Step 1 — 메모리 4건 갱신

`C:\Users\THE E&M\.claude\projects\C--Users-THE-E-M-Desktop-linkdrop-app\memory\` 에 project 타입 메모리 4건을 작성하고 `MEMORY.md` 인덱스에 등록한다.

| # | slug | 내용 요약 |
|---|------|----------|
| 1 | `project_linkdrop_v3_ux_5_purposes_engine_9_intents` | B안: 5목적 UX / 9 intent DB 분리. `intent_types.purpose` 매핑. 새 `drops` 테이블 금지. |
| 2 | `project_linkdrop_v3_campsite_external_links_phase_1` | C안: 캠핑 예약 = 외부 link Phase 1. 캘린더 UI/데이터(`reservation_data` jsonb) 보존. 자체 예약 = Phase 2. |
| 3 | `project_linkdrop_v3_4categories_phase_2_discovery` | C안: 4-카테고리 보존, Phase 1 미노출, Phase 2 탐색/추천 활용. `partners.category` 유지. |
| 4 | `project_linkdrop_v3_renewal_ux_principles` | 영상→Drop→행동. 홈=링크입력. 무로그인 열람. AI 가격비교 차별화. 쉬운 말. 5단계 wizard. |

각 메모리는 본문에 **Why** / **How to apply** 라인을 포함하고, `[[...]]`로 상호 링크한다.

**검증:** 4개 파일 생성 + `MEMORY.md`에 4줄 추가 확인.

---

## Step 2 — 현재 schema 진단

`mcp__supabase__execute_sql` 4건 실행. **읽기 전용. 이 Step에서는 DDL 금지.**

### 진단 1 — intent_types 9행 + purpose 컬럼 존재 여부

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'intent_types'
ORDER BY ordinal_position;

SELECT * FROM public.intent_types ORDER BY id;
```

확인 대상: `purpose` 컬럼이 이미 있는지, 9행의 `key` / `name` 값.

### 진단 2 — info_drops 전체 컬럼 + purpose / reservation_data 존재 여부

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'info_drops'
ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.info_drops'::regclass;
```

확인 대상: `purpose` / `reservation_data` 컬럼 부재 확인, `intent_id` FK, `category` 계열 컬럼, CHECK 제약 (메모리 `[[project-supabase-mcp-write]]` — information_schema는 CHECK를 감추므로 `pg_constraint` 필수).

### 진단 3 — share_events 이벤트 추적 컬럼 *(Claude 보강 — Duke 검토)*

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'share_events'
ORDER BY ordinal_position;

SELECT typname, enumlabel
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
WHERE typname LIKE '%event%' OR typname LIKE '%channel%'
ORDER BY typname, e.enumsortorder;
```

확인 대상: `reservation_click` 이벤트를 어디에 기록할지 (`share_events` 확장 vs 별도 이벤트 테이블). **`share_events` → `events` 테이블명 변경 금지.**

### 진단 4 — partners.category / 4-카테고리 컬럼 *(Claude 보강 — Duke 검토)*

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('partners', 'info_drops', 'content_sources')
  AND column_name ILIKE '%categor%';
```

확인 대상: 2-3 결정 락의 `partners.category` / `drops.category` 컬럼 실제 위치 확인 (보존 대상 식별).

**검증:** 4건 결과를 보고서로 정리 → Duke 검토 → Step 3 진행 여부 결정.

---

## Step 3 — Migration (intent_types.purpose + info_drops 확장)

> ⚠ 이 SQL은 **설계안**이다. Step 2 진단 결과(컬럼 존재 여부, 9 intent key 실제값)에 맞춰 Step 3 실행 시점에 확정한다.
> 적용은 `node scripts/apply-migration.mjs` 사용 (메모리 `[[project-supabase-mcp-write]]`).

### 3-1. 마이그레이션 파일: `supabase/migrations/v3.0_purpose_mapping.sql`

```sql
-- v3.0 — 5 목적(UX) ↔ 9 intent(엔진) 매핑 + 예약 데이터 컬럼
--
-- 결정 락 2-1 (B안): intent_types.purpose 컬럼으로 9 intent를 5 목적에 매핑.
-- 결정 락 2-2 (C안): info_drops.reservation_data jsonb로 캘린더 UI 데이터 보존.
-- 새 테이블 생성 없음. 기존 schema 확장만.

-- (1) 5 목적 enum — 안전하게 신규 타입
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'drop_purpose') THEN
    CREATE TYPE public.drop_purpose AS ENUM ('정보', '쿠폰', '예약', '구매', '상담');
  END IF;
END $$;

-- (2) intent_types.purpose 컬럼 추가
ALTER TABLE public.intent_types
  ADD COLUMN IF NOT EXISTS purpose public.drop_purpose;

-- (3) 9 intent → 5 목적 매핑  [⚠ Duke 검토 필요 — 진단 1 결과로 key 확정]
--     아래는 d.$shareUuid.tsx의 INTENT_FALLBACK_LABEL 9키 기준 Claude 초안.
UPDATE public.intent_types SET purpose = '정보'::public.drop_purpose WHERE key IN ('info', 'custom');
UPDATE public.intent_types SET purpose = '쿠폰'::public.drop_purpose WHERE key IN ('coupon', 'campaign');
UPDATE public.intent_types SET purpose = '예약'::public.drop_purpose WHERE key IN ('reservation', 'ticket');
UPDATE public.intent_types SET purpose = '구매'::public.drop_purpose WHERE key IN ('commerce');
UPDATE public.intent_types SET purpose = '상담'::public.drop_purpose WHERE key IN ('lead', 'discussion');

-- (4) info_drops.purpose — 조회 편의를 위한 비정규화 컬럼 (intent_id 경유 derive 가능하나 인덱스/필터용)
ALTER TABLE public.info_drops
  ADD COLUMN IF NOT EXISTS purpose public.drop_purpose;

-- (5) info_drops 기존 row → purpose 자동 backfill (intent_id 조인)
UPDATE public.info_drops d
SET purpose = it.purpose
FROM public.intent_types it
WHERE d.intent_id = it.id
  AND d.purpose IS NULL;

-- (6) info_drops.reservation_data — 캘린더 UI 데이터 (날짜/박수/인원). C안.
ALTER TABLE public.info_drops
  ADD COLUMN IF NOT EXISTS reservation_data jsonb;

COMMENT ON COLUMN public.info_drops.reservation_data IS
  'Phase 1 예약 캘린더 데이터: { checkin, checkout, nights, adults, children, pets, external_links[] }. 자체 예약 시스템은 Phase 2.';

-- (7) info_drops.purpose 동기화 트리거 — intent_id 변경 시 purpose 재계산
CREATE OR REPLACE FUNCTION public.sync_info_drop_purpose()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  SELECT purpose INTO NEW.purpose
  FROM public.intent_types
  WHERE id = NEW.intent_id;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sync_info_drop_purpose ON public.info_drops;
CREATE TRIGGER trg_sync_info_drop_purpose
  BEFORE INSERT OR UPDATE OF intent_id ON public.info_drops
  FOR EACH ROW EXECUTE FUNCTION public.sync_info_drop_purpose();

-- (8) 인덱스 — 목적별 필터링
CREATE INDEX IF NOT EXISTS idx_info_drops_purpose ON public.info_drops (purpose);
```

### 3-2. `reservation_click` 이벤트  [⚠ 진단 3 결과 의존]

진단 3에서 `share_events`에 이벤트 타입 enum이 있으면 거기에 `reservation_click` 값을 `ALTER TYPE ... ADD VALUE`로 추가. 별도 이벤트 테이블이면 그 테이블에 추가. **`share_events` → `events` 마이그레이션은 하지 않는다.**

### 3-3. TypeScript 타입 재생성

```bash
# 메모리 [[project-supabase-v2-keys]] / CLAUDE.md 참조
bunx supabase gen types typescript --project-id xukxtzjfqfwalqpmfidb > src/integrations/supabase/types.ts
```

**검증:** `SELECT key, purpose FROM intent_types` 9행 매핑 확인 + `info_drops` backfill 행수 + Korean 문자열 `position('?' in ...) = 0` 센티넬 (메모리 `[[project-supabase-mcp-write]]` — PowerShell 파이프 인코딩 트랩).

---

## Step 4 — 홈 영상 링크 입력 UX 리뉴얼  *[Claude 설계 — Duke 검토]*

기획 문서 §3 기준. 대상: `src/routes/_user/home.tsx` + 홈 컴포넌트.

- 카피 교체: "유튜브·인스타 URL을 붙여넣으세요" → "보낼 영상을 가져오세요"
- 보조 안내: "유튜브나 인스타에서 [공유] → [링크 복사] 후 아래에 붙여넣으면 AI가 Drop을 만들어줍니다."
- 입력 우선순위: ① 붙여넣기 버튼 ② 직접 입력 ③ (Phase 2) PWA Web Share Target
- "링크 복사 방법 보기" 도움말 링크
- 홈은 피드가 아니라 **입력 화면** — 결정 락 2-4. (기존 `/home` 피드는 Phase 2 탐색으로 이동, 이번 트랙에선 미삭제·미노출 판단 필요 → Duke 확인)
- v0 `home-page.tsx` 직접 수정 금지 (메모리 `[[preserve-v0-home-page]]`) — route/wrapper에서 처리

**범위 미확정:** 기존 홈 피드를 어디로 보낼지 (숨김 vs 별도 라우트) — Step 4 착수 전 Duke 확인.

---

## Step 5 — 5 목적 선택 wizard  *[Claude 설계 — Duke 검토]*

기획 문서 §4 기준. 대상: `src/routes/_user/create.tsx` + `src/lib/create-flow/`.

- 영상 가져온 후 목적 선택: **정보 / 쿠폰 / 구매 / 상담 / 밈** — 단 결정 락은 5목적을 "정보/쿠폰/예약/구매/상담"으로 정의. **불일치: 기획 문서는 밈 포함, 결정 락은 예약 포함.** → Duke 확정 필요.
- 선택한 목적 → `intent_types.purpose` 역매핑으로 허용 intent 후보 좁히기
- "예약"은 독립 목적 아님 — 쿠폰/상담/구매 안의 행동 버튼 (기획 §4)
- 5단계 wizard, 30초 목표 (결정 락 2-4)
- 기존 `BlockEditor` / `intent_types` 기반 블록 구조 재사용 — 새 모델 금지

**핵심 미확정:** "5 목적"의 정확한 5개 (밈 vs 예약) — Step 5 착수 전 Duke 확정 **필수**.

---

## Step 6 — 받은 사람 무로그인 화면  *[Claude 설계 — Duke 검토]*

기획 문서 §12 기준. 대상: `src/routes/d.$shareUuid.tsx` + `src/components/info-drop-page.tsx` (v0 — 직접 수정 신중).

- 무로그인 열람 유지 (이미 PR #18·#20에서 anon loader 동작)
- 화면 순서: 영상/썸네일 → 보낸 사람 메시지 → AI 요약 → 목적별 핵심 카드 → 행동 버튼 → 공유 버튼 → 고지 문구
- 목적별 행동 버튼을 `info_drops.purpose`로 분기
- 로그인은 쿠폰 저장/보관함/리워드 수령 시에만 선택적

---

## Step 7 — 예약 캘린더 UI (Phase 1 외부 link)  *[Claude 설계 — Duke 검토]*

기획 문서 §7 + 결정 락 2-2 기준.

- 캘린더 UI: 입실일 → 퇴실일 → 1/2/3박 → 인원 → 반려견 여부
- 선택 데이터 → `info_drops.reservation_data` (jsonb) 저장
- 최종 연결: 외부 예약 link (캠핏/야놀자/네이버) + 전화 + 문자 + 카카오톡 — **자체 예약 확정 없음**
- `shadcn/ui` `calendar.tsx` 재사용
- `reservation_click` 이벤트 기록 (Step 3-2)

---

## Step 8 — AI 가격비교 (구매 목적 핵심 차별화)  *[Claude 설계 — Duke 검토]*

기획 문서 §8 + 결정 락 2-4 기준.

- 구매 목적 Drop: 영상 속 상품 후보 + 국내/해외 가격 비교 카드
- Phase 1: 수동/반자동 입력 (기획 §17 1차 MVP) — 자동 가격 갱신은 Phase 3
- 가격 비교 고지 문구 필수 노출: "검색 당시 기준 가격입니다. 최종 가격은 구매처에서 확인해 주세요."
- 데이터: `info_drops` 확장 컬럼 또는 `component_blocks`의 신규 block_type — **새 테이블 금지.** Step 8 착수 전 진단으로 확정.
- 배민 할인 메뉴는 구매 아님 → 쿠폰 (기획 §6-3)

---

## Step 9 — 검증 + Production 배포

1. **로컬 검증 체크리스트**
   - `bun run build` clean
   - `bun run lint` clean
   - 5목적 wizard → Drop 생성 → `/d/{uuid}` 무로그인 열람 end-to-end
   - `intent_types.purpose` 9행 매핑 + `info_drops` backfill 검증
   - Korean 문자열 `?` 치환 센티넬 검사
2. **branch**: `feat/v3-renewal` (base=main — 메모리 `[[avoid-stacked-prs]]`)
3. **PR**: 단일 PR, base=main. squash merge.
4. **Cloudflare 재배포**: `bun run build && bunx wrangler deploy -c dist/server/wrangler.json` (메모리 work queue 백로그 — Workers Builds git 연동 전까지 수동)
5. **Version ID 보고**

---

## 부록 — 확정 사항 (Duke 2026-05-20 확정 완료)

### A. 5 목적 = 정보 / 쿠폰 / 예약 / 구매 / 상담  ✅

결정 락 2-1 유지. 근거: 괴산 캠핑장 협회 = 첫 매출(예약 핵심), 캠핑장 캘린더 UI = 차별화 hook, "티켓/예약 우선 = 빠른 매출" (Duke 명시).
- **예약은 메인 5목적 중 하나다.** `docs/v3-renewal-spec.md` §4의 "예약 = 행동 버튼" 서술은 잔재로 무시한다.
- 밈(meme / viral_share) = Phase 2. `intent_types`에 `purpose='밈'` 매핑은 하되 Phase 1 사용자 UI 미노출.

### B. 메모리 slug 4건  ✅

1. `linkdrop_v3_ux_5_purposes_engine_9_intents`
2. `linkdrop_v3_campsite_external_links_phase_1`
3. `linkdrop_v3_4categories_phase_2_discovery`
4. `linkdrop_v3_renewal_ux_principles`

### C. 9 intent → 5 목적 매핑  ✅ Step 2 진단으로 9행 확정 (Duke 2026-05-20)

실제 `intent_types` 9행이 전부 (후보표의 `place_info`/`vacancy_deal`/`meme` 등은 DB에 없음):

| 목적 | intent key (9행 전부) |
|------|------------------------|
| 정보 (4) | `info`, `discussion`, `custom`, `campaign` |
| 쿠폰 (1) | `coupon` |
| 예약 (2) | `reservation`, `ticket` |
| 구매 (1) | `commerce` |
| 상담 (1) | `lead` |

밈(`meme`/`viral_share`)은 현재 9행에 없음 → Phase 2 별도 INSERT. Phase 1에서 즉시 추가하지 않는다.
`drop_purpose` enum도 Phase 1은 5값(`정보/쿠폰/예약/구매/상담`)만; `밈`은 Phase 2에 `ALTER TYPE ADD VALUE`.

### D. Step 2 진단 3·4번  ✅

- 진단 3 → `partners` 컬럼 (`category` 존재 + Phase 2 활용 확인)
- 진단 4 → row count: `intent_types` / `info_drops` / `share_events` / `partners` / `coupons`

### E. 홈 피드 처리  ✅

- 이 plan = **백엔드/구조 트랙**. schema / RPC / API만 작업한다.
- `/home` 피드 UI는 보존한다 (Phase 2 발견 기능). 이 트랙에서 건드리지 않는다.
- `/home`을 영상 링크 입력 중심으로 새로 작성하는 것은 **별도 UI 트랙** 소관.
- → 따라서 아래 Step 4~8 본문의 UI 중심 설계는 **UI 트랙 참고용으로 강등**. 이 plan의 Step 4~8은 schema/RPC/API 범위로 재정의한다 (부록 F).

### F. Step 4~8 진행 방식  ✅

- 각 Step 종료 시 Duke 보고 + 다음 Step 진행 여부 대기.
- 잘림 위험 시 Step 내부를 Section 단위로 분할 가능.
- 진행 속도보다 **안전 우선**.
- Step 4~8의 정확한 백엔드 범위(RPC/API/추가 schema)는 **Step 3 완료 후 Duke와 재정의**한다.

### G. partners.category 불일치 해결  ✅ (b)안 채택 (Duke 2026-05-20)

- 4-카테고리(로컬/퍼퓰러/페이머스/쇼퍼) = `info_drops.category_key` + `info_drops.vertical_key` 보존 대상.
- `partners.partner_kind` (enum) = 매장 종류(음식점/캠핑장 등) — 4-카테고리와 무관, 별도 보존.
- `partners`에 `category` 컬럼은 **없음**. 결정 락 2-3 초안의 `partners.category` 표현은 본 진단으로 정정됨.
- → Step 3 migration은 `partners`를 건드리지 않는다. `info_drops.category_key`/`vertical_key`는 그대로 유지.

### H. ⚠ Section 3-8 신규 테이블 — 절대 금지 충돌, 작성 보류 (Duke 확정 대기)

Duke의 Step 3 진행 지시에 `Section 3-8: 신규 테이블 (drop_ctas, product_detections, product_offers, consultation_leads, visitors, events, share_links, ai_generations, consent_records, audit_logs) + RLS` 가 포함되었으나, 본 문서 §3 절대 금지 및 결정 락 2-1과 충돌한다:

- §3 절대 금지: "`docs/v3-renewal-spec.md` §15 데이터 초안(… `product_detections` 등 신규 테이블) 참조 X" — `product_detections` / `product_offers` / `consultation_leads` / `events`는 docx §15 테이블명과 동일.
- Duke 본인이 앞서 "`share_events` → `events` 마이그레이션 X"라고 명시 — 그런데 `events` 신규 생성 지시.
- 결정 락 2-1: "새 테이블 생성 절대 금지, `info_drops` 확장만".

→ **Section 1·2만 작성·적용하고 Section 3-8은 보류.** Duke가 ⓐ 절대 금지 유지(보조 데이터는 `info_drops` jsonb/`component_blocks` 확장) ⓑ 절대 금지를 "docx 설계를 베끼지 말라"로 한정 해석하여 정공법 신규 테이블 허용 — 중 하나를 확정해야 Section 3-8 진행.

---

*부록 A~H. Section 1·2 확정·작성 완료, Section 3-8 Duke 확정 대기 (2026-05-20).*

---

## Step 6 후속 노트 (2026-05-21)

### ⚠ Step 7 작업 시 필수 — `verify_jwt` 복원

Step 6 Edge Function 4개(`extract-meta` / `suggest-purpose` / `generate-summary` / `detect-product`)는 **현재 전부 `verify_jwt=false`** 로 배포돼 있다. 이유: V2 publishable key(`sb_publishable_*`)가 JWT 형식이 아니라 `verify_jwt=true`로는 테스트 호출이 `UNAUTHORIZED_INVALID_JWT_FORMAT`로 막혔다.

→ **Step 7(API 레이어)에서 user 세션 JWT 호출 경로를 확정한 뒤, 4개 함수를 `verify_jwt=true`로 일괄 복원**해야 한다. 현재 abuse 가드는 `extract-meta`=SSRF, AI 3개=`check_ai_quota`뿐 — `verify_jwt` 없이는 quota의 `user_id`를 위조 가능하므로 복원 전까지 production 노출 주의. 기존 `extract-url-metadata`도 V2 전환 후 `verify_jwt` 재점검 필요.

### Phase 2 — AI quota 리셋 타임존 정정

`check_ai_quota`의 일일 리셋은 `current_date`(UTC) 기준 = **KST 09:00 리셋**. Phase 1은 이대로 허용. Phase 2에서 KST 자정(UTC 15:00) 기준으로 정정 — `ai_usage_quotas`에 timezone 컬럼 추가 또는 리셋 cron을 UTC 15:00에 거는 방식.

### 명세 정정 사항

`docs/v3-step6-ai-edge-functions-spec.md` §7 monitoring query 들이 `cost_usd` 컬럼을 가정하나, 실제 `ai_generations` 컬럼은 `cost_krw`다 (A안). §7 query 사용 시 `cost_usd`→`cost_krw`로 읽을 것 (원본 명세 파일은 미수정, 이 노트로 갈음).

### `detect-product` 정상 흐름 — 미검증 (Phase 1 입력 한계)

`detect-product`의 코드/흐름(crash 방어, `NO_PRODUCT_FOUND` 처리, `ai_generation` 기록)은 검증됐으나, **`product_detections`/`product_offers` INSERT + `ai_generation_id` FK 연결 경로는 실데이터로 미검증**이다.

원인: YouTube oEmbed가 영상 description 을 제공하지 않아 `extract-meta`는 `title`+`author_name`만 확보 → `detect-product`에 들어가는 정보로는 Claude 가 구체 상품을 식별 못 함(보수적으로 `NO_PRODUCT_FOUND`, 의도대로 정상 동작).

→ 이 INSERT 경로 검증은 **Step 9 `/create` 통합 테스트**(사용자가 구매 목적 + 상품 정보 입력) 또는 **Phase 2 YouTube Data API**(description 확보) 과제. `detect-product` 자체 수정 불필요 — 입력 데이터 문제.

---

## Step 7 종료 노트 (2026-05-21)

### 완료
- API Route 7개 작성 (`/api/drops` `/api/drops/$shareCode` `/api/events` `/api/consultations` `/api/coupons/claim` `/api/price-compare` `/api/oembed`) — TanStack Start `server.handlers` 패턴, build exit 0, `routeTree.gen.ts` 등록.
- `v3.4` (`coupon_claims` 확장 + `claim_coupon_anon` RPC) 적용.
- `src/lib/edge-invoke.server.ts` 추가.

### `verify_jwt` 최종 상태 (Step 6 미해결 #1 → 해결)
- `extract-meta` = **`verify_jwt=false`** — `/api/oembed`가 무로그인 경로로 호출하므로 유지. SSRF 가드로 abuse 방어.
- `suggest-purpose` / `generate-summary` / `detect-product` = **`verify_jwt=true` 복원 완료**. API Route(로그인)가 user JWT를 `Authorization`에 실어 호출.
- ⚠ 기존 `extract-url-metadata`(`verify_jwt=true`)는 V2 키 환경에서 별도 점검 필요 — Phase 2.

### 호출 테스트 — Step 8 이관 (B안)
7개 Route는 build로 구조·타입 검증만 완료. 실제 HTTP 호출 테스트는 Cloudflare 배포(Step 9) 전이라 불가하고, 로그인 Route는 세션 쿠키가 필요하므로 **Step 8 UI 통합에서 end-to-end 검증**한다.
