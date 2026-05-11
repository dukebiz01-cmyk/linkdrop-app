## 목표
현재 TanStack Start 템플릿을 완전히 철거하고, **Vite SPA + React Router v6 + tailwind.config.ts + @supabase/supabase-js** 기반으로 사양서 그대로 Module 0a(프로젝트 셸) + Module 0(디자인 시스템·라우트·레이아웃·컴포넌트) 구현. 마지막에 13개 디자인 철학 인수 기준 self-check 리포트.

## 1단계: 템플릿 철거 (Module 0a)

**삭제**
- `src/routes/`, `src/routeTree.gen.ts`, `src/router.tsx`, `src/server.ts`, `src/start.ts`
- `src/lib/error-page.ts`, `src/lib/error-capture.ts`
- `wrangler.jsonc`, `vite.config.ts` (TanStack 전용)
- `@tanstack/react-router`, `@tanstack/react-start`, `@lovable.dev/vite-tanstack-config`, `@cloudflare/vite-plugin` 의존성 제거

**유지**
- `src/components/ui/*` (shadcn) — 사양서가 shadcn 기반
- `src/hooks/use-mobile.tsx`, `src/lib/utils.ts`
- `components.json`

**신규**
- `index.html` (Vite SPA entry, `<div id="root">`)
- `src/main.tsx` (ReactDOM.createRoot + BrowserRouter + QueryClientProvider)
- `src/App.tsx` (Routes 정의)
- `vite.config.ts` (Vite + React + path alias만)
- `tailwind.config.ts` (사양서 토큰 그대로: colors, spacing 8pt, borderRadius, fontFamily, fontWeight, letterSpacing)
- `postcss.config.js`
- `src/index.css` (Tailwind directives + base layer)
- `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- `src/lib/supabase.ts` (`createClient` 싱글턴)
- `src/types/database.ts` (수동 타입 placeholder — 사용자가 schema에서 생성한 타입 붙여넣을 자리)

## 2단계: 디자인 시스템 (Module 0)

`tailwind.config.ts`에 사양 그대로:
- `colors`: `bg`, `text`(5단계), `border`, `action`(검정), `accent`(#4F46E5), `intent.*`(strip/chip 전용)
- `spacing`: 8pt 그리드만 (`1`=4, `2`=8, `3`=12, `4`=16, `6`=24, `8`=32, `12`=48)
- `borderRadius`: `lg`(8), `2xl`(16) 두 개만
- `fontWeight`: medium/semibold/bold/extrabold 4단계
- `letterSpacing`: `ko`(-0.02em)
- `boxShadow`: `soft`(모달·드롭다운 전용) 1개
- `fontFamily`: Pretendard

`src/index.css`:
- `@layer base`에 `body`에 `tracking-ko` 적용
- `:focus-visible` 링 (키보드 전용)
- 한글 word-break 처리

## 3단계: 라우트·레이아웃·컴포넌트 (Module 0)

**3개 레이아웃** `src/layouts/`
- `RootLayout.tsx` (전역 토스트, 인증 가드 컨텍스트)
- `AppLayout.tsx` (로그인 후, 하단 탭/사이드)
- `AuthLayout.tsx` (로그인/회원가입 셸)

**12개 라우트 stub** `src/pages/` + `src/App.tsx`에 `<Routes>`
사양서의 12개 라우트를 그대로 — 모든 리스트 페이지에 `<EmptyState />` 컴포넌트 포함.

**공통 컴포넌트** `src/components/`
- `EmptyState.tsx`
- `ActionButton.tsx` (검정, 화면당 1개 enforce — 문서화)
- `IntentStrip.tsx`, `IntentChip.tsx`
- `ErrorMessage.tsx` (한국어 친근한 톤 헬퍼)

**로그인** (사양서에 있으면)
- `src/pages/Login.tsx` + `src/lib/auth.ts` (supabase.auth.signIn)
- `intent_types` 테이블 시드 호출은 백엔드(이미 적용됨)에 위임 — 클라는 SELECT만

## 4단계: 13개 self-check 리포트

구현 완료 후 다음을 자동 검사 후 마크다운 리포트:
1. `rg "p-2\.5|p-3\.5|gap-13|m-2\.5"` → 위반 0
2. `rg "rounded-(sm|md|xl|3xl|full)"` 화이트리스트 외 → 위반 위치
3. `rg "#[0-9a-fA-F]{6}"` → tailwind config 외 hex 검출
4. 카드 컴포넌트에 `shadow-` → 모달·드롭다운 외 위반
5. `rg "font-(thin|light|normal|black)"` → 위반
6. ActionButton 사용처 grep → 화면당 1개 검증 (수동 체크)
7. focus-visible CSS 확인
8. tracking-ko 전역 적용 확인
9. `rg "hover:scale|hover:shadow"` → 위반
10. 리스트 페이지마다 EmptyState import 확인
11. ErrorMessage 한국어 사용 확인
12. 버튼 min-h-[44px] / min-w-[44px] 확인
13. 이모지(`rg -P "[\x{1F300}-\x{1FAFF}]"`), `italic`, `underline` 검출

각 항목 ✓/✗ + 위반 시 `파일:줄` 출력.

## 기술 메모
- `supabase-js`는 anon key로 RLS 통과. SECURITY DEFINER `redeem_coupon`은 `supabase.rpc('redeem_coupon', {...})`로 호출.
- `.env`는 사용자가 직접 채움 — 빈 상태에선 supabase client가 throw하지 않도록 lazy init.
- 본 단계에선 schema 타입을 placeholder로 두고, 사용자가 `supabase gen types typescript` 결과를 `src/types/database.ts`에 붙여넣는 방식.
- 사양서(zip)에서 라우트 목록·컴포넌트 props·정확한 색 토큰을 1단계 시작 전에 1회 정독. 첨부의 `design-system.md`·`design-philosophy.md` 우선.

## 산출 순서
1. 의존성 정리(remove + add) — 1콜
2. 파일 삭제·신규 셸 — apply_patch 묶음
3. tailwind config + index.css — apply_patch
4. 레이아웃 + 12 라우트 stub + 공통 컴포넌트 — apply_patch 묶음
5. 빌드 통과 확인
6. self-check grep 스크립트 실행 → 리포트
