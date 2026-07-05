import { useState } from "react";
import { Play, Send, Image as ImageIcon, Diamond, Package, User, ChevronRight } from "lucide-react";
import type { DropFeedItem } from "@/components/home-page";
import { useCountdown } from "@/hooks/use-countdown";
// SM-4 — 확산 필 탭 → 그 자리 바텀시트(무Radix 자체 구현·타일 자체 호스팅 = 피드 표면 0터치).
import { ShareJourneySheet } from "@/components/share-journey";

/**
 * ShareCardTile — V4 카드(정사각 썸네일 + 솔리드 정보영역 + 슬레이트 + 도트칩 + 섀도).
 *   유저홈 "오늘 공유하기 좋은 카드" · 탐색 그리드 공용. (아크릴 오버레이 → V4 솔리드로 교체.)
 *
 * 구조: 루트 article(group, flex-col, rounded-2xl, border #E8EDF3, V4 카드 섀도, hover -translate+elevation)
 *   / 썸네일 aspect-square(고정 1:1 → 카드 높이 정렬, group-hover scale) + 상단 스크림
 *   / 종류칩(top-left, 도트+라벨, purpose 주입 시만) · 공유 아이콘버튼(top-right, 44px 탭) · duration(좌하단)
 *   / 솔리드 정보영역(메이커·지역 1줄 + 제목 2줄 clamp, min-h 컬럼 정렬).
 *
 * 공리 V4(styles.css 600b062): 슬레이트+섀도+blue accent 허용, raw hex 허용, backdrop-blur 허용. Lucide만, 이모지 0.
 * 루트=article(비-button) + onClick → 공유만 내부 button + stopPropagation(중첩 button 금지).
 * ★ props 계약 유지: { drop, purpose?, onShare?, onClick? }. 홈=purpose 미주입(칩X), 탐색=주입(칩O).
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

// Phase 1-A — 공유 여정 노드. [보정2] props 타입 신설까지만 — 렌더 코드는 후속 Phase(작성 금지).
export type ShareJourneyNode = {
  name: string;
  role: string;
  kind: "peer" | "me" | "buyer";
  emphasis?: boolean;
};

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
export function StockMeta({ remaining }: { remaining: number }) {
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
      {remaining}개 남음
    </span>
  );
}

// SM-3 — 확산 컴팩트 필(1-A 보정2 shareCount 렌더 금지 해제분). 익명 아바타 스택(제네릭
//   실루엣 최대 3 — 이니셜·실명·이미지 0) + "N명 확산"("모집" 계열 금지). 재고 뱃지 동일
//   계열(rounded·px-1.5·py-0.5·text-[10px]) · 모션 0.
//   SM-4 — 탭 동선 신설: 필 탭 = 그 자리 여정 바텀시트(카드 본체 탭 /d 는 그대로).
//   [㉮] 정적 셰브론 1자(size-3 = 아바타 원과 동일 → 필 높이 무변경) · 모션 0 · 마스킹 무변경.
function SpreadPill({ count, onOpen }: { count: number; onOpen: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${count}명 전달 — 공유 여정 보기`}
      // BADGE-ⓑ(SM-5) — 승격: 11px·bold·#334155·틴트 #EFF3F8(대비↑). 구조·아바타 스택 무변경, 정적.
      // BADGE-fix1 — 라벨 "N명 전달"(역할 4종 락 어휘 통일) + 아이콘 잉크 계열(#334155) 대비 강화.
      className="inline-flex shrink-0 items-center gap-1 rounded border border-[#E8EDF3] bg-[#EFF3F8] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[#334155]"
    >
      <span className="flex -space-x-1">
        {Array.from({ length: Math.min(3, count) }).map((_, i) => (
          <span
            key={i}
            className="flex size-3 items-center justify-center rounded-full border border-white bg-[#334155]"
          >
            <User className="size-2 text-white" strokeWidth={2.5} />
          </span>
        ))}
      </span>
      {count}명 전달
      <ChevronRight className="size-3 text-[#334155]" strokeWidth={2} />
    </button>
  );
}

// 드로피 배지 — [보정1] 아이콘+숫자만("+{n}"), 단위 문자(P) 보류. 모집·수익 뉘앙스 문안 금지(코드명 dropy).
function DropyBadge({ amount }: { amount: number }) {
  return (
    // V4 앱 액센트 — 목적색(mode-accent) 체계와 무관.
    // BADGE-ⓑ(4b) — 값 점등: toLocaleString(3,200) + 조건 문구는 aria 만(시각 무노출, §0 절제 락).
    <span
      aria-label="판매 성사 시 적립"
      className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold tabular-nums text-[#2563EB]"
    >
      <Diamond className="size-3" strokeWidth={2.5} />+{amount.toLocaleString()}
    </span>
  );
}

export function ShareCardTile({
  drop,
  purpose,
  onShare,
  onClick,
  expiresAt,
  serverNow,
  remainingStock,
  dropyReward,
  shareCount,
  isMine,
}: {
  drop: DropFeedItem;
  purpose?: string;
  onShare?: (uuid: string) => void;
  onClick?: () => void;
  /** P7c FEED-1 — 내 카드 칩. prop 우선, 미주입 시 drop.isMine 폴백. 둘 다 없으면 미렌더. */
  isMine?: boolean;
  /** Phase 1-A — ISO 마감시각(coupons.valid_until 계열). 미주입 = 타이머 미렌더. */
  expiresAt?: string;
  /** 1-C-2(L6) — 서버 기준시각(표면 loader 1회 공급). use-countdown offset 보정. */
  serverNow?: string;
  /** Phase 1-A — 파생 재고(1-B 공급). 미주입 = 미렌더. L4: 공급값 표시만. */
  remainingStock?: number;
  /** Phase 1-A — 드로피 보상(값 주입은 P6 이후 — 렌더만 선구현). */
  dropyReward?: number;
  /** SM-3 — 확산 규모("N명 확산" 컴팩트 필, 1-A 보정2 렌더 금지 해제). 0/미주입 = 미렌더. */
  shareCount?: number;
  /** [보정2] 타입 신설까지만 — 렌더 코드 없음(후속 Phase). */
  shareJourney?: ShareJourneyNode[];
}) {
  const isVideo = drop.videoDurationSec > 0;
  const chip = purposeMeta(purpose);
  // P7c FEED-1 — prop 우선, 없으면 피드 산출값(drop.isMine).
  const mine = isMine ?? drop.isMine ?? false;
  const hasThumb = Boolean(drop.videoThumbnailUrl);
  // SM-4 — 여정 시트 개폐. 시트는 닫혀도 마운트 유지(open=false 는 null 렌더) → rows 캐시 보존.
  const [journeyOpen, setJourneyOpen] = useState(false);

  return (
    <article
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#E8EDF3] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:shadow-[0_10px_28px_rgba(15,23,42,0.1)]"
      onClick={onClick}
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
          <div className="absolute inset-0 flex items-center justify-center text-[#94A3B8]">
            {isVideo ? (
              <Play className="h-8 w-8" strokeWidth={1.5} />
            ) : (
              <ImageIcon className="h-8 w-8" strokeWidth={1.5} />
            )}
          </div>
        )}

        {/* 상단 스크림 — 칩·공유 가독성. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/30 to-transparent" />

        {/* 종류칩 — 좌상단, 도트+라벨(글래스 펄). purpose 주입 시만(홈 미주입=숨김).
            P7c FEED-1 — "내 카드" 칩을 종류칩 우측에 나란히(같은 좌상단 영역, 정적·모션 0). */}
        {chip || mine ? (
          <div className="absolute left-2 top-2 flex items-center gap-1">
            {chip ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold shadow-[0_2px_6px_rgba(15,23,42,0.16)] backdrop-blur-sm ${chip.tone.text}`}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: chip.tone.dot }} />
                {chip.label}
              </span>
            ) : null}
            {mine ? (
              // P7c 완성 — 흰 배경(종류칩 동일 톤): 어두운 썸네일 위 검정칩 매몰 해소. 그림자도 종류칩 동일.
              <span className="inline-flex items-center rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-neutral-800 shadow-[0_2px_6px_rgba(15,23,42,0.16)] backdrop-blur-sm">
                내 카드
              </span>
            ) : null}
          </div>
        ) : null}

        {/* 공유 — 우상단 아이콘 버튼. 탭영역 44px, 가시 원 32px. 카드 열기 방지 stopPropagation. */}
        <button
          type="button"
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

        {/* 재생시간 — 좌하단(영상만). BADGE-ⓑ(S24) — 재고 오버레이와 동시 존재 시 재고 우선
            (커머스 셀프업로드는 duration 없어 실충돌 희박 — 방어 게이트만). */}
        {isVideo && remainingStock == null ? (
          <span className="absolute bottom-2 left-2 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
            {formatDuration(drop.videoDurationSec)}
          </span>
        ) : null}

        {/* BADGE-ⓑ(S24) — 재고 썸네일 좌하단 승격: TimerBadge(우하단)와 대칭·동일 문법. */}
        {remainingStock != null ? (
          <span className="absolute bottom-2 left-2">
            <StockMeta remaining={remainingStock} />
          </span>
        ) : null}

        {/* Phase 1-A — 마감 타이머(우하단, 재생시간 배지 계열·종류칩과 충돌 없음). 미주입 = 미렌더.
            1-C-2 — serverNow 관통(L6). */}
        {expiresAt ? <TimerBadge expiresAt={expiresAt} serverNow={serverNow} /> : null}
      </div>

      {/* 정보영역 — 솔리드, 고정 높이 컬럼 정렬(메이커·지역 1줄 + 제목 2줄).
          BADGE-ⓑ(S24) — 재고는 썸네일 오버레이로 이동 → 메타행 = 메이커명 + DropyBadge + SpreadPill(폭 압박 해소). */}
      <div className="flex flex-col px-3 pb-3 pt-2.5">
        {dropyReward != null || (shareCount ?? 0) > 0 ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 truncate text-[11px] font-semibold text-[#64748B]">
              {drop.maker.name}
              {drop.localName ? ` · ${drop.localName}` : ""}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {dropyReward != null ? <DropyBadge amount={dropyReward} /> : null}
              {/* SM-3 — 확산 필(0/미주입 = 미렌더).
                  SM-4 — 필 탭 = 여정 시트(stopPropagation — 타일 onClick=/d 오발화 차단). */}
              {(shareCount ?? 0) > 0 ? (
                <SpreadPill
                  count={shareCount as number}
                  onOpen={(e) => {
                    e.stopPropagation();
                    setJourneyOpen(true);
                  }}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="truncate text-[11px] font-semibold text-[#64748B]">
            {drop.maker.name}
            {drop.localName ? ` · ${drop.localName}` : ""}
          </div>
        )}
        <div className="mt-1 line-clamp-2 min-h-[37px] text-[13.5px] font-semibold leading-[1.4] tracking-[-0.01em] text-[#0F172A]">
          {drop.title}
        </div>
      </div>

      {/* SM-4 — 여정 바텀시트(포털 → body). 확산 필 있을 때만 배선. 시트 내부 클릭은
          share-journey 루트 stopPropagation 이 타일 onClick 버블을 차단. */}
      {(shareCount ?? 0) > 0 ? (
        <ShareJourneySheet
          open={journeyOpen}
          onClose={() => setJourneyOpen(false)}
          shareUuid={drop.shareUuid}
        />
      ) : null}
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
