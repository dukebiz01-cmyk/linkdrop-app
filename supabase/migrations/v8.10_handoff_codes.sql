-- v8.10 — KAKAO-LINGO-1 B방식: 카톡 인앱 → 외부 브라우저 세션 핸드오프 1회용 코드.
--
-- 사용 흐름(전부 서버 라우트가 service role 로만 접근):
--   POST /api/handoff/create   → 현재 세션의 refresh_token 을 code 와 함께 저장
--   POST /api/handoff/exchange → code 검증(1회용·60초 TTL) 후 used_at 마킹 + 토큰 반환
--
-- 보안: RLS ON + 정책 0개 + anon/authenticated 권한 revoke = 클라이언트 접근 전면 차단.
--   service role 은 RLS 를 우회하므로 서버 라우트만 읽고 쓸 수 있다.
--   TTL(60초)·1회용 판정은 exchange 서버 라우트의 단일 UPDATE 조건이 정본(DB 측 잡초는
--   used/만료 행 모두 무해 — 참조 0, 필요 시 후속 정리 배치).

create table public.handoff_codes (
  code uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  refresh_token text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table public.handoff_codes enable row level security;

revoke all on table public.handoff_codes from anon, authenticated;
