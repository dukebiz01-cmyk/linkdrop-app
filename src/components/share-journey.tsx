import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getSupabase } from "@/lib/supabase";

/**
 * SM-4 — 공유 여정 공용 컴포넌트 (SM-2 카드 아코디언 렌더부 + SM-2-fix3 원점 분기 추출).
 *   소비처: /d 카드 아코디언(info-drop-page) · 피드 타일 바텀시트(ShareCardTile).
 *
 * [보정2] SM-2 락 전부 상속 — 이 파일의 모든 렌더에 적용:
 *   · 역할 4종 락: 개척 · 전달 · 최고공헌 · 구매자 — 그 외 역할·인원수 과시("N명 모집" 류) 금지
 *   · 마스킹 고지 유지: "다른 참여자는 개인정보 보호로 익명 표시 · 기여도만 집계"
 *   · ⛔ 포인트 숫자 금지(Phase 3 소관)
 *   · ⛔ 모집·초대·수익 언어 0 ("퍼졌어요" 계열만)
 *   · 모션 0 (시트 개폐 기본 트랜지션만 — 타임라인 자체 애니메이션 없음)
 *
 * ⛔ Radix Dialog/Sheet/Drawer 금지(#418 크래시 락) — ShareJourneySheet 는 무의존 자체 구현
 *   (ReserveFunnelSheet 의 바텀시트 시각 패턴만 미러: rounded-t-2xl · px-6 pb-8 상단 여백).
 */

// SM-2 — get_share_journey 응답 노드(서버측 마스킹본만 — 원본 user_id·실명 없음, 응답 레벨 보장).
export type ShareJourneyRpcNode = {
  position: number;
  masked_name: string;
  role: string; // '개척' | '전달' | '최고공헌' (v8.3.1)
  is_viewer: boolean;
  has_conversion: boolean;
  spread_count: number;
};

/**
 * 타임라인 렌더 — SM-2 원문 그대로 추출(마크업·클래스 무수정 = 골든 동일 증빙 대상).
 *   상태(loading/error/rows)는 소비처 소유 — 카드는 SM-2 아코디언 state, 시트는 자체 lazy fetch.
 */
export function ShareJourneyTimeline({
  light,
  loading,
  error,
  rows,
}: {
  light: boolean;
  loading: boolean;
  error: boolean;
  rows: ShareJourneyRpcNode[] | null;
}) {
  // 톤 클래스 3종 — light/다크 공용(가독·프리티어 정합용 지역 상수).
  const jMuted = `text-[11px] font-medium tracking-ko ${light ? "text-text-subtle" : "text-white/50"}`;
  const jStrong = `text-[12px] font-semibold tracking-ko ${light ? "text-text-strong" : "text-white/90"}`;
  const jBadge = `rounded-lg px-1.5 text-[10px] font-semibold tracking-ko ${light ? "bg-surface text-text-muted" : "bg-white/15 text-white/70"}`;
  const jNotice = `text-[10px] font-medium leading-relaxed tracking-ko ${light ? "text-text-subtle" : "text-white/45"}`;
  const dotColor = (role: string) =>
    role === "개척" ? "#2563EB" : role === "최고공헌" ? "#B45309" : "#94A3B8";
  return (
    <div className="mt-1 space-y-2 text-left" data-testid="share-journey">
      {loading ? (
        <p className={jMuted}>여정을 불러오는 중…</p>
      ) : error ? (
        <p className={jMuted}>여정을 불러오지 못했어요</p>
      ) : rows && rows.length === 1 && rows[0].is_viewer && rows[0].role === "개척" ? (
        // SM-2-fix3 — 원점(발신자) 시점: 노드 1개=나·개척이면 빈약한 타임라인 대신
        //   개척 시점 문구로 전환(집계와의 시점 갭 보정). 타인 노드 미표시 =
        //   개인정보 설계 그대로 — RPC·그 외 케이스(수신자·다홉) 무변경.
        <>
          <p className={jStrong}>내가 개척한 드랍 · {rows[0].spread_count}명에게 퍼졌어요</p>
          <p className={jMuted}>이 카드로부터 {rows[0].spread_count}갈래로 퍼져나갔어요</p>
          <p className={jNotice}>다른 참여자는 개인정보 보호로 익명 표시 · 기여도만 집계</p>
        </>
      ) : rows && rows.length > 0 ? (
        <>
          {/* 확산 집계 — '퍼졌어요' 표기('모집' 계열 금지). */}
          <p className={jStrong}>이 드랍은 지금까지 {rows[0].spread_count}명에게 퍼졌어요</p>
          <ol className="space-y-1.5">
            {rows.flatMap((n) => {
              const items = [
                <li key={n.position} className="flex items-center gap-2">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: dotColor(n.role) }}
                  />
                  <span className={jStrong}>{n.is_viewer ? "나" : n.masked_name}</span>
                  <span className={jBadge}>{n.role}</span>
                </li>,
              ];
              if (n.has_conversion) {
                // [보정1] 구매·수령 신원 절대 미표시 — 클라 생성 익명 노드(플래그 기반).
                items.push(
                  <li key={`${n.position}-buyer`} className="flex items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-[#0F172A]" />
                    <span className={jStrong}>구매자</span>
                    <span className={jBadge}>구매 성사</span>
                  </li>,
                );
              }
              return items;
            })}
          </ol>
          <p className={jNotice}>다른 참여자는 개인정보 보호로 익명 표시 · 기여도만 집계</p>
        </>
      ) : (
        <p className={jMuted}>아직 공유 여정이 없어요</p>
      )}
    </div>
  );
}

/**
 * SM-4 — 피드 인라인 바텀시트(무Radix 자체 구현). 확산 필 탭 → 그 자리에서 여정 열람.
 *   · lazy 1회: 첫 오픈에만 get_share_journey 호출, 이후 재오픈 = 컴포넌트 state 캐시
 *     (SM-2 원칙 상속 — 체인은 열람 중 급변하지 않음. RPC 재호출 0)
 *   · 실패 내성: 오류 = 타임라인 error 1줄("여정을 불러오지 못했어요") — 피드 가용성 무영향
 *   · 포털(body) 렌더 — 타일 hover transform 이 fixed 기준점을 깨는 문제 회피.
 *     탭 이후에만 열리므로(클라 전용 경로) SSR 에서 document 접근 없음.
 *   · 루트 stopPropagation — 포털 이벤트가 React 트리로 버블해 타일 onClick(/d 이동) 오발화 차단.
 *   · 모션 = 개폐 기본 트랜지션만(슬라이드 업 1회) — 그 외 애니메이션 0.
 */
export function ShareJourneySheet({
  open,
  onClose,
  shareUuid,
}: {
  open: boolean;
  onClose: () => void;
  shareUuid: string;
}) {
  const [rows, setRows] = useState<ShareJourneyRpcNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // ref 가드(state 아님) — state 로 두면 setFetched 재렌더가 이펙트 클린업을 발화해
  //   진행 중 fetch 를 취소, loading 고착(실측 재현). ref 는 재렌더·클린업 무발화.
  const fetchedRef = useRef(false);
  const [shown, setShown] = useState(false); // 개폐 기본 트랜지션용(오픈 직후 1프레임 뒤 슬라이드 업)

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // 오픈 중 배경 스크롤 잠금(자체 구현 — Radix 대체 최소분).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || fetchedRef.current) return; // lazy 1회 — 재오픈 = 캐시(RPC 재호출 0)
    fetchedRef.current = true;
    // 취소 없음 — 닫힘 중에도 완주시켜 rows 캐시(React 18: 언마운트 후 setState 무해).
    void (async () => {
      setLoading(true);
      try {
        // get_share_journey 는 types.ts 미반영(TEMP — 타입 재생성 후 캐스트 제거. SM-2 동일).
        const { data, error: rpcError } = (await getSupabase().rpc(
          "get_share_journey" as never,
          { p_share_uuid: shareUuid } as never,
        )) as { data: unknown; error: unknown };
        if (rpcError || !Array.isArray(data)) {
          setError(true);
          return;
        }
        setRows(data as ShareJourneyRpcNode[]);
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, shareUuid]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="공유 여정"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className={`absolute inset-0 h-full w-full bg-black/60 transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-[480px] rounded-t-2xl bg-white px-6 pb-8 pt-4 tracking-ko shadow-soft transition-transform duration-300 ${shown ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E2E8F0]" aria-hidden />
        <h2 className="text-lg font-bold text-[#0F172A]">공유 여정</h2>
        <div className="mt-2">
          <ShareJourneyTimeline light loading={loading} error={error} rows={rows} />
        </div>
        {/* 시트 → 카드 동선 1줄. 카드 본체 탭(/d 직행)은 기존 그대로 — 시트는 확산 필 전용. */}
        <a
          href={`/d/${shareUuid}`}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#E8EDF3] bg-[#F8FAFC] text-sm font-semibold tracking-ko text-[#334155]"
        >
          카드 보기 →
        </a>
      </div>
    </div>,
    document.body,
  );
}
