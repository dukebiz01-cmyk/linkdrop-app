-- REPORT-RESHARE 권한 복구 — get_drop_results EXECUTE 권한 PUBLIC 부여
-- 사유: 직전 마이그레이션(report_reshare_count)에서 CREATE OR REPLACE 후 PUBLIC EXECUTE
--       grant 가 회귀됨. 다른 RPC(get_drop_detail, get_my_drops) 와 동일 패턴으로 복구.
-- 본문 무변경. 명세 build-step6a-rpc-reshare 옵션 A.

GRANT EXECUTE ON FUNCTION public.get_drop_results(uuid) TO PUBLIC;
