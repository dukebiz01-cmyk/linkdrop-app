-- v7.2 — 노을재(가상 테스트 partner) reservation_url 임시 입력
--
-- 배경: 손님 깔때기 추적 테스트용. 노을재(282dca5c) = 가상 캠핑장.
-- 모래재 = 실제 운영 캠핑장이나 LinkDrop DB 에 partner 0 행 (display_name/
-- address 어디에도 모래재 단독 partner 없음 → 격리 자동).
-- 모래재 네이버 지도 URL 을 노을재 reservation_url 에 임시 저장.
--
-- 사용:
--   /d/{노을재 드롭} 캘린더 [예약하기] → allowlist (commit 38d033b) 통과
--   → trackReceiverEvent("reservation_click") (commit 30255ab)
--   → window.open(reservation_url) → 모래재 네이버 지도 새 탭
--   → 시트 "네이버에서 예약하기" → naver_booking_click
--   → 복귀 모달 "예약했어요" → naver_booking_returned
--   → 업주 /partner/results 에 카운트 노출
--
-- 영향:
--   · partners.reservation_url 컬럼만 UPDATE. 1 행 (id=282dca5c).
--   · 기존 reservations 행 / coupon_claims / lifecycle_events 영향 0.
--   · 다른 partner (420d5151, ee064abd 등) 영향 0.
--   · 모래재 partner DB 에 없음 → 자동 격리.
--
-- ROLLBACK:
--   UPDATE partners SET reservation_url = NULL
--   WHERE id = '282dca5c-aa4f-4800-9866-7e513b834c45';

UPDATE public.partners
SET reservation_url = 'https://map.naver.com/p/entry/place/36893742?placePath=/room&entry=plt&searchType=place'
WHERE id = '282dca5c-aa4f-4800-9866-7e513b834c45';
