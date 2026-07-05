-- S2b 매장 slug 백필 박제 (migrations 아님 · 재적용 금지)
-- 시점: 2026-07-05 · HEAD bcc05ad(S2c) 기준 · 형님 승인(노을재 배정 = A안 dukebiz08 주력행)
-- 목적: 파일럿 매장 영문 슬러그 부여 → drop.how/{slug} 매장 apex 라우팅(S2c) 실데이터
--
-- [판별 근거] 노을재 2행은 중복 아님 — owner 상이한 별개 매장(282dca5c=dukebiz08 drops356 주력 / 420d5151=dukebiz01 drops33)
--             slug UNIQUE라 주력행에 noeulhouse 부여, dukebiz01행·코미테스트는 null 유지(추후 필요 시 별도 slug)
-- [실행]
UPDATE public.partners SET slug = 'noeulhouse'
WHERE id = '282dca5c-aa4f-4800-9866-7e513b834c45' AND slug IS NULL;
UPDATE public.partners SET slug = 'moraejae'
WHERE id = '6e2df38d-5ac1-4208-a100-c3d4bfe4ceda' AND slug IS NULL;
-- [검증 통과] 노을재캠핑장(dukebiz08)=noeulhouse · 모래재=moraejae · 나머지 2행 null (2026-07-05)
-- 멱등: AND slug IS NULL 가드 — 재실행 시 0 rows.
