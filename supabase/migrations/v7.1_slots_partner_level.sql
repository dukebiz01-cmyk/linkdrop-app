-- v7.1 — Phase A1+A2: reservation_slots 매장별 전환 (스키마)
--
-- 결정 사실 (READ 게이트):
--   • 슬롯 = 매장별 (partner_id). 예약 = 드롭별 attribution 유지.
--   • partner_id 컬럼/FK/인덱스(idx_reservation_slots_partner_id) 이미 존재.
--   • 기존 UNIQUE (drop_id, slot_date, slot_time) 와 idx_slots_drop_date 만 교체.
--
-- 영향:
--   • 슬롯 1행 (1187cebb / 282dca5c / 2026-06-15 / 자리3 / slot_time NULL)
--     → 새 UNIQUE 와 충돌 가능성 0 (해당 partner 동일 날짜 1행만) 이지만
--       명세 A1 따라 사전 DELETE 로 일관 처리. 검증 후 Phase B 에서 재마킹.
--   • drop_id NOT NULL → nullable (매장별이라 필수 아님, attribution 보조 유지)
--
-- ROLLBACK (수동):
--   ALTER TABLE public.reservation_slots ALTER COLUMN drop_id SET NOT NULL;
--   DROP INDEX IF EXISTS public.uq_slots_partner_date_time;
--   DROP INDEX IF EXISTS public.idx_slots_partner_date;
--   ALTER TABLE public.reservation_slots
--     ADD CONSTRAINT reservation_slots_drop_id_slot_date_slot_time_key
--     UNIQUE (drop_id, slot_date, slot_time);
--   CREATE INDEX idx_slots_drop_date ON public.reservation_slots (drop_id, slot_date);
--
-- 백업 (롤백 시 복원):
--   id=3dd96cb4-f742-4d38-a351-11d640843cee
--   drop_id=1187cebb-671e-4ccf-805a-9e5f108f8c3b
--   partner_id=282dca5c-aa4f-4800-9866-7e513b834c45
--   calendar_mode='date_range' / slot_date='2026-06-15' / slot_time=NULL
--   max_capacity=3 / current_bookings=0 / is_blocked=false

BEGIN;

-- A1: 1행 삭제 (UNIQUE 교체 + 일관성)
DELETE FROM public.reservation_slots;

-- A2-1: 기존 UNIQUE 제거
ALTER TABLE public.reservation_slots
  DROP CONSTRAINT IF EXISTS reservation_slots_drop_id_slot_date_slot_time_key;

-- A2-2: drop_id nullable
ALTER TABLE public.reservation_slots
  ALTER COLUMN drop_id DROP NOT NULL;

-- A2-3: 신규 UNIQUE — partner 레벨 + slot_time NULL 안전 (COALESCE 표현식)
--   date_range 모드는 slot_time NULL → 일반 UNIQUE 는 NULL 중복 허용해서
--   같은 날 여러 NULL 행 가능. COALESCE 로 '' 매핑해서 차단.
CREATE UNIQUE INDEX IF NOT EXISTS uq_slots_partner_date_time
  ON public.reservation_slots (partner_id, slot_date, COALESCE(slot_time, ''));

-- A2-4: 조회 인덱스 교체 (drop → partner)
DROP INDEX IF EXISTS public.idx_slots_drop_date;
CREATE INDEX IF NOT EXISTS idx_slots_partner_date
  ON public.reservation_slots (partner_id, slot_date);

COMMIT;
