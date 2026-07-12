import { useState } from "react";
import { Play, Send, Image as ImageIcon, Diamond, Package, Users, Route, ArrowUpRight } from "lucide-react";
import type { DropFeedItem } from "@/components/home-page";
import { useCountdown } from "@/hooks/use-countdown";
// SM-4 통합 — 카드 펼침 여정도 공용 A(share-journey) 소비. 자체 mock(buildJourney/ShareJourneyInline) 폐기.
//   ShareJourneySheet = 실 RPC(get_share_journey) lazy 바텀시트(펼칠 때만 1콜 · 카드 렌더 시 fetch 0).
import { ShareJourneySheet } from "@/components/share-journey";

/**
 * ShareCardTile — V4 카드(정사각 썸네일 + 솔리드 정보영역 + 슬레이트 + 도트칩 + 섀도).
 *   유저홈 "오늘 공유하기 좋은 카드" · 탐색 그리드 공용. (아크릴 오버레이 → V4 솔리드로 교체.)
 *
 * STEP 2 그래프트(외과적 렌더 교체) — 렌더 레이아웃은 v0(share-card-tile.v0)로 교체하되
 *   ⏱ 타이머·📦 재고 배지는 live(TimerBadge/StockMeta)를 그대로 재사용(피드·/d·스튜디오 한 룩 =
 *   거울 일관성). 종류칩은 live purposeMeta(3종 락). v0 신규 부품(DropyBadge/ShareChainMeta/
 *   buildJourney/공유여정 인라인 아코디언·layout row) 편입. isMine=작은 'my' 마커, localName=옵셔널 가드.
 *
 * 공리 V4(styles.css 600b062): 슬레이트+섀도+blue accent 허용, raw hex 허용, backdrop-blur 허용. Lucide만, 이모지 0.
 * 루트=article(비-button) + onClick → 공유만 내부 button + stopPropagation(중첩 button 금지).
 * ★ props 계약 유지: { drop, purpose?, onShare?, onClick?, ... } + layout?("grid" 기본). 명시 prop 우선·drop.* 폴백.
 */
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type ChipTone = { dot: string; text: string };
type ChipMeta = { label: string; tone: ChipTone };

// 종류칩 메타 — 영문 intent / 국문 purpose 양쪽 매핑 + V4 톤(도트색·텍스트색).
//   Phase 0(형님 확정) — 3종 락: 정보 / 쿠폰(예약 포함 병합 유지) / 상품판매. 그 외 intent
//   (ticket/lead/discussion/…)·미주입 → null(칩 숨김) = 3종 락 — 의도된 정책(형님 확정).
//   ★ Phase 0 — 홈(RoleHome·HomeActivitySegment)도 탐색과 동일하게 purpose 주입(뱃지 전멸 해소).
function purposeMeta(v: string | undefined): ChipMeta | null {
  switch (v) {
    case "정보":
    case "info":
      // Phase 0 2-B — 정보 톤 식별 강화(슬레이트 한 단계 진하게). 쿠폰 블루·상품판매 블랙과 구분.
      return { label: "정보", tone: { dot: "#475569", text: "text-[#334155]" } };
    case "쿠폰":
    case "예약":
    case "coupon":
    case "reservation":
      return { label: "쿠폰", tone: { dot: "#2563EB", text: "text-[#1D4ED8]" } };
    case "구매":
    case "commerce":
      return { label: "상품판매", tone: { dot: "#0F172A", text: "text-[#0F172A]" } };
    default:
      return null;
  }
}

// ── Phase 1-A 하드락 (fix3 = L7 최종판) ──
//   L1/L3 — 기준은 expiresAt 하나: 리셋·재계산 금지(새로고침 동일값. 계산은 use-countdown 훅 소관).
//   L2 — 만료 후 연장 렌더 금지: "마감" 고정.
//   L6 — serverNow 우선(훅이 offset 보정. 주입 배선은 1-C).
//   L7 최종판 — 빨강=임박 1h 한정 · 펄스 금지 · 1초 틱 · 진짜 expiresAt만(3단계 톤: 다크→앰버→빨강).
//   L4 — remainingStock 은 공급값 표시만(가공·연출 감산 금지).

// 타이머 배지 — 썸네일 우하단(재생시간 배지 계열 시각). D-N HH:MM:SS(N>0) / HH:MM:SS(당일).
//   Phase 1-C — named export + serverNow 옵션 프로퍼티(1-A 예고분 배선). 렌더·로직 무수정.
export function TimerBadge({ expiresAt, serverNow }: { expiresAt: string; serverNow?: string }) {
  const cd = useCountdown(expiresAt, serverNow); // L6 — serverNow 수신 시 offset 보정
  if (!cd) return null; // 하이드레이션 안전 — 마운트 전 미렌더
  if (cd.expired) {
    // L2 — 만료 고정 표기(저채도). 연장 렌더 없음.
    return (
      <span className="absolute bottom-2 right-2 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white/60">
        마감
      </span>
    );
  }
  return (
    <span
      // fix3 색상 3단계(L7 최종판) — 평상(>24h) 다크 글래스 / 주의(≤24h) 앰버 /
      //   임박(≤1h) 빨강(이 구간 한정). 펄스·애니메이션 금지. tabular-nums = 자리 흔들림 방지.
      className={`absolute bottom-2 right-2 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white ${
        cd.imminent ? "bg-[#DC2626]/90" : cd.urgent ? "bg-[#B45309]/90" : "bg-black/65"
      }`}
    >
      {cd.days > 0 ? `D-${cd.days} ${cd.hms}` : cd.hms}
    </span>
  );
}

// 재고 메타 — "N개 남음". L4: 공급값 그대로 표시만. N≤5 앰버(L7), N≤0 "마감".
//   Phase 1-C — named export(수신카드 재사용).
//   SM-2-fix2 — 뱃지형 승격: 필 뱃지(배경 틴트+얇은 보더) + Package 아이콘 수직 센터 +
//   tabular-nums(자릿수 가변에도 흔들림 0). radius·높이·폰트 = TimerBadge 계열 통일
//   (rounded·px-1.5·py-0.5·text-[10px] — 지시의 rounded-md 대신 TimerBadge 동일 radius 택1).
//   색 로직 무변경(기본 슬레이트 / ≤5 앰버 / 0 저채도) — 컨테이너만 뱃지화.
// ST2b-2a A4 — unitLabel additive(FIX-45c 판매 구성 단위: '박스'/'망'/'kg' 등).
//   미주입 = '개'(기존 소비처 렌더와 문자 동등 — 회귀 0).
export function StockMeta({ remaining, unitLabel }: { remaining: number; unitLabel?: string }) {
  // BADGE-ⓑ(S24) — 썸네일 오버레이 승격: TimerBadge 동일 문법(text-[10px] font-semibold text-white
  //   + 배경 필: 평상 bg-black/65 / ≤5 앰버 / 0 저채도 "마감"). 위치는 소비처가 지정(비-positioned).
  if (remaining <= 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white/60">
        <Package className="size-3" strokeWidth={2} />
        마감
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white ${
        remaining <= 5 ? "bg-[#B45309]/90" : "bg-black/65"
      }`}
    >
      <Package className="size-3" strokeWidth={2} />
      {remaining}
      {unitLabel ?? "개"} 남음
    </span>
  );
}

// ── v0 그래프트: 🎁 드로피 배지(블루 솔리드 강조, 비현금 기여보상 +N P) ──────────
//   Phase 0 편입 — live 슬레이트 인라인 → v0 솔리드 블루(잘 보이게). 코드명 dropy 유지.
//   모집·수익 뉘앙스 문안 금지(값 점등 + aria 만).
function DropyBadge({ reward }: { reward: number }) {
  return (
    <span
      aria-label="판매 성사 시 적립"
      className="inline-flex items-center gap-0.5 rounded-md bg-[#2563EB] px-1.5 py-1 text-[10px] font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,0.35)]"
    >
      <Diamond className="size-3 fill-white/30" strokeWidth={2.5} />+{reward.toLocaleString()}P
    </span>
  );
}

// ── v0 그래프트: 🔗 공유지도 컴팩트 미니체인(익명 노드·신원 마스킹) ─────────
//   기여도만 집계(모집 개념 없음). compact = 카드 바닥 콤팩트(명수만).
function ShareChainMeta({ count, compact = false }: { count: number; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-[#475569]">
      <Users className="size-3 flex-shrink-0 text-[#94A3B8]" strokeWidth={2.25} />
      {compact ? `${count.toLocaleString()}명` : `${count.toLocaleString()}명 전달`}
    </span>
  );
}

export function ShareCardTile({
  drop,
  purpose,
  onShare,
  onClick,
  isMine,
  expiresAt: expiresAtProp,
  serverNow,
  remainingStock: remainingStockProp,
  dropyReward: dropyRewardProp,
  shareCount: shareCountProp,
  layout = "grid",
}: {
  drop: DropFeedItem;
  purpose?: string;
  onShare?: (uuid: string) => void;
  onClick?: () => void;
  /** P7c FEED-1 — 내 카드 마커. prop 우선, 미주입 시 drop.isMine 폴백. 둘 다 없으면 미렌더. */
  isMine?: boolean;
  /** Phase 1-A — ISO 마감시각. prop 우선, 없으면 drop.expiresAt. 미주입 = 타이머 미렌더. */
  expiresAt?: string;
  /** 1-C-2(L6) — 서버 기준시각(표면 loader 1회 공급). live TimerBadge offset 보정. */
  serverNow?: string;
  /** Phase 1-A — 파생 재고(1-B 공급). prop 우선, 없으면 drop.remainingStock. L4: 공급값 표시만. */
  remainingStock?: number;
  /** BADGE-ⓑ — 드로피 보상. prop 우선, 없으면 drop.dropyReward. 0/미주입 = 미렌더. */
  dropyReward?: number;
  /** SM-3 — 확산 규모("N명 전달" 컴팩트 필). prop 우선, 없으면 drop.shareCount. 0/미주입 = 미렌더. */
  shareCount?: number;
  /** v0 편입 — grid=세로 카드(기본) / row=가로 리스트. 현 호출부 미사용(기본 grid). */
  layout?: "grid" | "row";
}) {
  // 호출부 하위호환 — 명시 prop 우선, 없으면 drop.*(feed-queries 산출값). 값 동일이라 무해.
  const expiresAt = expiresAtProp ?? drop.expiresAt;
  const remainingStock = remainingStockProp ?? drop.remainingStock;
  const dropyReward = dropyRewardProp ?? drop.dropyReward;
  const shareCount = shareCountProp ?? drop.shareCount;
  // P7c FEED-1 — isMine prop·데이터 유지(나중 부활 대비). STEP 3에서 'my' 마커 렌더만 제거.
  void (isMine ?? drop.isMine);

  const chip = purposeMeta(purpose); // live purposeMeta — 홈 미주입=칩 숨김 / 주입 시 표시
  const accent = chip?.tone.dot ?? "#2563EB"; // 여정 강조색 — 칩 없으면 앱 블루
  // v0 칩 틴트(row 레이아웃용) — 쿠폰(#2563EB)=블루 틴트, 그 외=슬레이트(v0 토큰 일치).
  const chipBg = accent === "#2563EB" ? "bg-[#EEF3FE]" : "bg-[#F1F5F9]";
  const chipBorder = accent === "#2563EB" ? "border-[#DBE6FD]" : "border-[#E2E8F0]";

  const hasThumb = Boolean(drop.videoThumbnailUrl);
  const isVideo = drop.videoDurationSec > 0;
  const hasStock = typeof remainingStock === "number";
  const hasDropy = typeof dropyReward === "number" && dropyReward > 0;
  const hasChain = typeof shareCount === "number" && shareCount > 0;
  const hasMetaRow = hasStock || hasChain;
  const [journeyOpen, setJourneyOpen] = useState(false);

  // ── 가로형 리스트 행(row) ──────────────────────────────────────
  if (layout === "row") {
    return (
      <article
        onClick={onClick}
        className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-[#E8EDF3] bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-[#CBD5E1] hover:shadow-[0_8px_22px_rgba(15,23,42,0.09)]"
      >
        {/* 썸네일(고정 정사각) */}
        <div className="relative aspect-square w-[92px] flex-shrink-0 overflow-hidden rounded-xl bg-[#F1F5F9]">
          {hasThumb ? (
            <img
              src={drop.videoThumbnailUrl}
              alt={drop.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {isVideo ? (
                <Play className="size-6 text-[#94A3B8]" />
              ) : (
                <ImageIcon className="size-6 text-[#94A3B8]" />
              )}
            </div>
          )}
          {/* STEP 3 — 'my' 마커 렌더 제거(isMine 데이터는 보존, 나중 부활 대비). */}
          {/* ⏱ live 타이머(우선, absolute) 또는 재생시간(좌하단) */}
          {isVideo && !expiresAt ? (
            <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-white">
              {formatDuration(drop.videoDurationSec)}
            </span>
          ) : null}
          {expiresAt ? <TimerBadge expiresAt={expiresAt} serverNow={serverNow} /> : null}
        </div>

        {/* 본문 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {chip ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${chipBg} ${chipBorder} ${chip.tone.text}`}
              >
                <span className="size-1 rounded-full" style={{ backgroundColor: accent }} />
                {chip.label}
              </span>
            ) : null}
            <span className="truncate text-[11px] font-medium text-[#94A3B8]">
              {drop.maker.name}
              {drop.localName ? ` · ${drop.localName}` : ""}
            </span>
          </div>
          <div className="mt-1 line-clamp-2 text-[13.5px] font-semibold leading-[1.4] text-[#0F172A]">
            {drop.title}
          </div>
          {/* 📦 재고 · 🔗 공유체인(탭 → 공유지도) · 🎁 드로피 메타 */}
          {hasMetaRow || hasDropy ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {hasStock ? <StockMeta remaining={remainingStock!} /> : null}
              {hasChain ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setJourneyOpen((v) => !v);
                  }}
                  aria-haspopup="dialog"
                  className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 -mx-1 transition-colors active:bg-[#F1F5F9]"
                >
                  <ShareChainMeta count={shareCount!} />
                  <span
                    className="inline-flex items-center gap-0.5 text-[11px] font-semibold"
                    style={{ color: accent }}
                  >
                    <Route className="size-3.5" strokeWidth={2.25} />
                    <ArrowUpRight className="size-3.5" strokeWidth={2.5} />
                  </span>
                </button>
              ) : null}
              {hasDropy ? <DropyBadge reward={dropyReward!} /> : null}
            </div>
          ) : null}
          {/* SM-4 통합 — 펼침 여정 = 공용 실 RPC lazy 바텀시트(포털·1콜, 카드 렌더 시 fetch 0). */}
          {hasChain ? (
            <ShareJourneySheet
              open={journeyOpen}
              onClose={() => setJourneyOpen(false)}
              shareUuid={drop.shareUuid}
            />
          ) : null}
        </div>

        {/* 공유 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare?.(drop.shareUuid);
          }}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center"
          aria-label="공유"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EAEEF3] bg-white transition-all duration-150 group-hover:border-[#BFD3F9] group-hover:bg-[#F5F8FF] active:scale-90">
            <Send
              className="size-4 text-[#475569] transition-colors group-hover:text-[#2563EB]"
              strokeWidth={2}
            />
          </span>
        </button>
      </article>
    );
  }

  // ── 세로형 그리드 카드(기본) ─────────────────────────────
  return (
    <article
      onClick={onClick}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#E8EDF3] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:shadow-[0_10px_28px_rgba(15,23,42,0.1)]"
    >
      {/* 썸네일 — 고정 1:1 정사각(모든 카드 높이 정렬). 없으면 폴백(영상=Play / 사진=Image). */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#F1F5F9]">
        {hasThumb ? (
          <img
            src={drop.videoThumbnailUrl}
            alt={drop.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[450ms] ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:scale-[1.05]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {isVideo ? (
              <Play className="size-7 text-[#94A3B8]" />
            ) : (
              <ImageIcon className="size-7 text-[#94A3B8]" />
            )}
          </div>
        )}

        {/* 상단 스크림 — 칩·공유 가독성. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/25 to-transparent" />
        {/* 하단 스크림 — 재생시간·재고·타이머 대비(영상일 때만). */}
        {isVideo ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
        ) : null}

        {/* 종류칩(좌상단, 도트+라벨, purpose 주입 시만). STEP 3 — 'my' 마커 렌더 제거(isMine 데이터 보존). */}
        {chip ? (
          <div className="absolute left-2 top-2 flex items-center gap-1">
            <span
              className={`inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold shadow-[0_2px_6px_rgba(15,23,42,0.16)] backdrop-blur-sm ${chip.tone.text}`}
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: accent }} />
              {chip.label}
            </span>
          </div>
        ) : null}

        {/* 공유 — 우상단 아이콘 버튼(탭영역 44px, 가시 원 32px). stopPropagation. */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare?.(drop.shareUuid);
          }}
          className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center"
          aria-label="공유"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-[0_2px_6px_rgba(15,23,42,0.18)] backdrop-blur-sm transition-all duration-150 group-hover:bg-white active:scale-90">
            <Send
              className="size-[15px] text-[#0F172A] transition-colors group-hover:text-[#2563EB]"
              strokeWidth={2}
            />
          </span>
        </button>

        {/* 재생시간 — 좌하단(영상·타이머 없을 때). 타이머 있으면 우하단 live TimerBadge 로 대체. */}
        {isVideo && !expiresAt ? (
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white backdrop-blur-sm">
            {formatDuration(drop.videoDurationSec)}
          </span>
        ) : null}
        {/* ⏱ live 타이머(우하단, absolute) — 미주입 = 미렌더. serverNow 관통(L6). */}
        {expiresAt ? <TimerBadge expiresAt={expiresAt} serverNow={serverNow} /> : null}
      </div>

      {/* 정보영역 — 솔리드, flex-1 채우고 하단 메타는 바닥 정렬. */}
      <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
        <div className="truncate text-[11px] font-semibold text-[#64748B]">
          {drop.maker.name}
          {drop.localName ? ` · ${drop.localName}` : ""}
        </div>
        <div className="mt-1 line-clamp-2 min-h-[37px] text-[13.5px] font-semibold leading-[1.4] tracking-[-0.01em] text-[#0F172A]">
          {drop.title}
        </div>
        {/* 🎁 드로피 — 제목 바로 아래 고정(위치 통일). 타이머는 썸네일로 이동(live 룩). */}
        {hasDropy ? (
          <div className="mt-2 flex min-h-[24px] items-center gap-1.5">
            <DropyBadge reward={dropyReward!} />
          </div>
        ) : null}
        {/* 📦 재고 · 🔗 공유체인(탭 → 공유지도) 메타 — 항상 카드 바닥 고정. */}
        <div className="mt-auto flex flex-col">
          {hasMetaRow ? (
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#F1F5F9] pt-2.5">
              {hasChain ? (
                <ShareChainMeta count={shareCount!} compact />
              ) : hasStock ? (
                <StockMeta remaining={remainingStock!} />
              ) : (
                <span />
              )}
              {hasChain ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setJourneyOpen((v) => !v);
                  }}
                  aria-haspopup="dialog"
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 -mr-1 text-[11px] font-semibold transition-colors active:bg-[#EEF3FE]"
                  style={{ color: accent }}
                >
                  <Route className="size-3.5 flex-none" strokeWidth={2.25} />
                  여정
                  <ArrowUpRight className="size-3.5" strokeWidth={2.5} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {/* SM-4 통합 — 펼침 여정 = 공용 실 RPC lazy 바텀시트(포털·1콜, 카드 렌더 시 fetch 0). */}
        {hasChain ? (
          <ShareJourneySheet
            open={journeyOpen}
            onClose={() => setJourneyOpen(false)}
            shareUuid={drop.shareUuid}
          />
        ) : null}
      </div>
    </article>
  );
}

// 로딩 스켈레톤 — 동일 1:1 비율(탐색/홈 로딩 자리). 펄스만, 인터랙션 없음.
export function ShareCardTileSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#EAEEF3] bg-white">
      <div className="aspect-square w-full animate-pulse bg-[#F1F5F9]" />
      <div className="flex flex-col gap-1.5 px-3 pb-3 pt-2.5">
        <div className="h-3 w-2/5 animate-pulse rounded bg-[#F1F5F9]" />
        <div className="h-3.5 w-full animate-pulse rounded bg-[#F1F5F9]" />
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-[#F1F5F9]" />
      </div>
    </div>
  );
}
