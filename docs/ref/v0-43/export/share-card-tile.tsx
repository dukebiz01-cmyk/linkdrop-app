import { useEffect, useState } from "react";
import {
  Send,
  Play,
  Image as ImageIcon,
  Clock,
  Diamond,
  Package,
  User,
  Users,
  ShoppingBag,
  Lock,
  Award,
  Route,
  X,
  ArrowUpRight,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Types (props 계약 유지 — 다른 창이 이 시그니처로 배선)
// 런타임 요소(타이머·재고·드로피·공유지도)는 전부 옵셔널 → 하위 호환
// ─────────────────────────────────────────────────────────────

export type DropFeedItem = {
  shareUuid: string;
  maker: { name: string };
  videoThumbnailUrl?: string;
  videoDurationSec: number;
  intent: string; // "정보" | "쿠폰" | "예약" | "구매" ...
  title: string;
  localName?: string; // 지역명 (예: "괴산")
  // ── 런타임 요소 (구조도 §3 매트릭스, 전부 옵셔널) ──
  expiresAt?: string; // ISO — ⏱ 타이머(실시간 D-N + 시:분:초). 서버 권위 시각.
  remainingStock?: number; // 📦 재고 — 실판매 실시간 차감(가짜 금지)
  dropyReward?: number; // 🎁 드로피 — 공유 시 최대 적립(+N P, 비현금 기여보상)
  shareCount?: number; // 🔗 공유지도 — 확산 규모(컴팩트 미니체인, 신원 마스킹)
  shareJourney?: ShareJourneyNode[]; // 🔗 공유지도 여정(익명 노드 체인) — 미주입 시 shareCount로 자동 생성
};

// 공유지도 노드 — 신원 마스킹. 기여도만 집계(모집 개념 없음)
export type ShareJourneyNode = {
  name: string; // 마스킹된 표기 (예: lee***9a) 또는 "나"
  role: string; // 개척 · 전달 · 결정타 · 구매 성사 등
  kind: "peer" | "me" | "buyer";
  emphasis?: boolean; // 결정타 등 강조
};

export type ShareCardTileProps = {
  drop: DropFeedItem;
  onShare?: (shareUuid: string) => void; // TODO: 부모에서 주입
  onClick?: () => void; // TODO: /d 이동
  purpose?: string; // 주입 시 종류칩 표시 (탐색=주입, 홈=미주입)
  layout?: "grid" | "row"; // grid=세로 카드(기본), row=가로 리스트
};

// 종류칩 라벨 + 색 토큰 (블루 단일 강조 원칙 — 칩은 무채색, 텍스트만 의미색)
function purposeMeta(v?: string): { label: string; tone: "info" | "coupon" | "sale" } | null {
  if (!v) return null;
  if (v === "정보" || v === "info") return { label: "정보", tone: "info" };
  if (v === "쿠폰" || v === "예약" || v === "coupon" || v === "reservation")
    return { label: "쿠폰", tone: "coupon" };
  if (v === "구매" || v === "commerce") return { label: "상품판매", tone: "sale" };
  return null;
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// ⏱ 실시간 카운트다운 훅 (서버 권위 시각 · 클라이언트 틱)
// 하이드레이션 안전: now는 마운트 후에만 계산
// ─────────────────────────────────────────────────────────────

type Countdown = { expired: boolean; days: number; hms: string; urgent: boolean };

function useCountdown(expiresAt?: string): Countdown | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt || now === null) return null;
  const diff = new Date(expiresAt).getTime() - now;
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return { expired: true, days: 0, hms: "00:00:00", urgent: true };

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return {
    expired: false,
    days,
    hms: `${pad(h)}:${pad(m)}:${pad(s)}`,
    urgent: diff <= 24 * 3600 * 1000, // 24h 이내만 강조(명도 기반·빨강 최소)
  };
}

// ─────────────────────────────────────────────────────────────
// ⏱ 타이머 배지 — 다크 글래스(명도 기반), 임박 시에만 앰버(빨강 회피)
// ─────────────────────────────────────────────────────────────

function TimerBadge({ cd, compact = false }: { cd: Countdown; compact?: boolean }) {
  if (cd.expired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#334155]/85 px-1.5 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur-sm">
        <Clock className="size-3" strokeWidth={2.5} />
        마감
      </span>
    );
  }
  const tone = cd.urgent ? "bg-[#78350F]/85 text-[#FDE68A]" : "bg-black/68 text-white";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums backdrop-blur-sm ${tone}`}
    >
      <Clock className="size-3" strokeWidth={2.5} />
      {cd.days > 0 && <span className="tracking-tight">D-{cd.days}</span>}
      <span className={compact && cd.days > 0 ? "hidden" : ""}>{cd.hms}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// ⏱ 타이머(라이트) — 정보영역용, 임박 시에만 앰버(빨강 회피)
// ─────────────────────────────────────────────────────────────

function TimerInline({ cd }: { cd: Countdown }) {
  if (cd.expired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#F1F5F9] px-1.5 py-1 text-[10px] font-bold text-[#94A3B8]">
        <Clock className="size-3" strokeWidth={2.5} />
        마감
      </span>
    );
  }
  const tone = cd.urgent ? "bg-[#FEF3C7] text-[#B45309]" : "bg-[#F1F5F9] text-[#475569]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-bold tabular-nums ${tone}`}>
      <Clock className="size-3" strokeWidth={2.5} />
      {cd.days > 0 && <span className="tracking-tight">D-{cd.days}</span>}
      <span>{cd.hms}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// 🎁 드로피 배지 — 블루 강조(잘 보이게), 비현금 기여보상
// ─────────────────────────────────────────────────────────────

function DropyBadge({ reward }: { reward: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-[#2563EB] px-1.5 py-1 text-[10px] font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,0.35)]">
      <Diamond className="size-3 fill-white/30" strokeWidth={2.5} />
      +{reward.toLocaleString()}P
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// 📦 재고 메타 — 실판매 차감, 소진 임박만 앰버(빨강 회피)
// ─────────────────────────────────────────────────────────────

function StockMeta({ stock }: { stock: number }) {
  const soldOut = stock <= 0;
  const low = stock > 0 && stock <= 5;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[10.5px] font-semibold tabular-nums ${
        soldOut ? "text-[#94A3B8]" : low ? "text-[#B45309]" : "text-[#64748B]"
      }`}
    >
      <Package className="size-3 flex-shrink-0" strokeWidth={2.25} />
      {soldOut ? "마감" : `${stock}개 남음`}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// 🔗 공유지도 컴팩트 미니체인 — 익명 노드(신원 마스킹) + 확산 규모
// ─────────────────────────────────────────────────────────────

function ShareChainMeta({ count, compact = false }: { count: number; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-[#475569]">
      <Users className="size-3 flex-shrink-0 text-[#94A3B8]" strokeWidth={2.25} />
      {compact ? `${count.toLocaleString()}명` : `${count.toLocaleString()}명 전달`}
    </span>
  );
}

// shareCount만 있고 여정이 없을 때 익명 노드 체인 자동 생성 (신원 마스킹)
// 보상 네이밍 확정: 최대공헌(전환 결정) · 개척/전달(차등 기여)
function buildJourney(count: number): ShareJourneyNode[] {
  const masks = ["lee***9a", "par***k2", "kim***7q", "cho***x3", "yun***m5"];
  const peers = Math.min(masks.length, Math.max(1, count > 2 ? 2 : 1));
  const nodes: ShareJourneyNode[] = masks.slice(0, peers).map((m, i) => ({
    name: m,
    role: i === 0 ? "개척" : "전달",
    kind: "peer" as const,
  }));
  nodes.push({ name: "나", role: "최대공헌", kind: "me", emphasis: true });
  nodes.push({ name: "구매자", role: "구매 성사", kind: "buyer" });
  return nodes;
}

// ─────────────────────────────────────────────────────────────
// 🔗 공유 여정 바텀시트 — 카드 높이에 영향 없이 몰입형 오버레이
// ─────────────────────────────────────────────────────────────

function ShareJourneySheet({
  open,
  onClose,
  nodes,
  count,
  title,
  accent = "#2563EB",
}: {
  open: boolean;
  onClose: () => void;
  nodes: ShareJourneyNode[];
  count: number;
  title: string;
  accent?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const meIndex = nodes.findIndex((n) => n.kind === "me");
  const meRank = meIndex >= 0 ? meIndex + 1 : nodes.length;

  // SSR 안전: 마운트 전에는 렌더하지 않음. 오버레이/포털 대신 카드 아래 인라인 아코디언으로 펼침.
  if (!mounted) return null;

  return (
    <div
      className="grid transition-all duration-300 ease-out"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      aria-hidden={!open}
    >
      <div className="overflow-hidden">
        <div className="relative mt-2.5 w-full overflow-hidden rounded-2xl border border-[#EEF2F6] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        {/* 헤더 */}
        <div className="flex items-start gap-3 px-5 pb-4 pt-4">
          <span
            className="flex size-11 flex-none items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${accent}14`, color: accent }}
          >
            <Route className="size-[22px]" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-bold leading-tight text-[#0F172A]">공유 여정</h3>
            <p className="mt-0.5 truncate text-[12.5px] font-medium text-[#94A3B8]">{title}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="닫기"
            className="-mr-1 -mt-1 flex size-9 flex-none items-center justify-center rounded-full text-[#94A3B8] transition-colors active:bg-[#F1F5F9]"
          >
            <X className="size-5" strokeWidth={2.25} />
          </button>
        </div>

        <div className="px-5 pb-6">
          {/* 확산 지표 히어로 */}
          <div
            className="flex items-center justify-between rounded-2xl px-4 py-3.5"
            style={{ backgroundColor: "#0F172A" }}
          >
            <div>
              <p className="text-[11.5px] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
                지금까지 퍼진 사람
              </p>
              <p className="mt-0.5 text-[26px] font-bold leading-none tabular-nums text-white">
                {count.toLocaleString()}
                <span className="ml-1 text-[14px] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>명</span>
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold"
              style={{ backgroundColor: accent, color: "#fff" }}
            >
              <ArrowUpRight className="size-3.5" strokeWidth={2.5} />
              내 기여 {meRank}번째
            </span>
          </div>

          {/* 타임라인 레일 */}
          <div className="mt-5">
            {nodes.map((node, i) => {
              const isLast = i === nodes.length - 1;
              const isMe = node.kind === "me";
              const isBuyer = node.kind === "buyer";
              return (
                <div key={i} className="flex gap-3.5">
                  {/* 노드 + 레일 */}
                  <div className="flex flex-none flex-col items-center">
                    <span className="relative flex items-center justify-center">
                      {isMe && (
                        <span
                          className="absolute -inset-1 rounded-full"
                          style={{ backgroundColor: `${accent}26` }}
                        />
                      )}
                      <span
                        className="relative flex size-9 items-center justify-center rounded-full"
                        style={
                          isMe
                            ? { backgroundColor: accent, color: "#fff", boxShadow: `0 6px 16px -4px ${accent}80` }
                            : isBuyer
                              ? { backgroundColor: "#fff", color: accent, boxShadow: `inset 0 0 0 2px ${accent}` }
                              : { backgroundColor: "#F1F5F9", color: "#94A3B8" }
                        }
                      >
                        {isBuyer ? (
                          <ShoppingBag className="size-[18px]" strokeWidth={2.25} />
                        ) : (
                          <User className="size-[18px]" strokeWidth={2.25} />
                        )}
                      </span>
                    </span>
                    {!isLast && (
                      <span
                        className="my-1 w-0.5 flex-1 rounded-full"
                        style={{ minHeight: 22, backgroundColor: isMe ? `${accent}55` : "#E8EDF3" }}
                      />
                    )}
                  </div>

                  {/* 내용 */}
                  <div className={`flex-1 ${isLast ? "pb-0" : "pb-5"}`}>
                    <div
                      className="flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5"
                      style={
                        isMe
                          ? { borderColor: `${accent}33`, backgroundColor: `${accent}0A` }
                          : { borderColor: "#EEF2F6", backgroundColor: "#fff" }
                      }
                    >
                      <div className="min-w-0">
                        <span className={`block truncate text-[13.5px] tabular-nums ${isMe ? "font-bold text-[#0F172A]" : "font-semibold text-[#64748B]"}`}>
                          {node.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] font-medium text-[#94A3B8]">
                          {isMe ? "전환을 결정한 기여" : isBuyer ? "여정의 도착점" : "카드를 이어준 기여"}
                        </span>
                      </div>
                      <span
                        className="inline-flex flex-none items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold"
                        style={
                          node.emphasis
                            ? { backgroundColor: accent, color: "#fff" }
                            : isBuyer
                              ? { backgroundColor: `${accent}14`, color: accent }
                              : { backgroundColor: "#F1F5F9", color: "#64748B" }
                        }
                      >
                        {node.emphasis && <Award className="size-3" strokeWidth={2.5} />}
                        {node.role}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 범례 */}
          <div className="mt-1 flex flex-col gap-2 rounded-2xl bg-[#F8FAFC] px-3.5 py-3">
            <span className="flex items-center gap-2 text-[11.5px] text-[#64748B]">
              <Award className="size-3.5 flex-none" style={{ color: accent }} strokeWidth={2.5} />
              <b className="flex-none font-semibold text-[#0F172A]">최대공헌</b>
              전환을 결정한 기여에 가중
            </span>
            <span className="flex items-center gap-2 text-[11.5px] text-[#64748B]">
              <span className="size-2.5 flex-none rounded-full border border-[#E2E8F0] bg-[#F1F5F9]" />
              <b className="flex-none font-semibold text-[#0F172A]">개척·전달</b>
              이어준 정도만큼 차등 기여
            </span>
          </div>

          {/* 프라이버시 */}
          <p className="mt-3 flex items-start gap-2 px-0.5 text-[11px] leading-relaxed text-[#94A3B8]">
            <Lock className="mt-0.5 size-3.5 flex-none" strokeWidth={2} />
            타인은 익명 처리돼요. 구매·수령 정보는 공개되지 않고, 기여도만 집계됩니다(모집·강요 없음).
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ShareCardTile — 고정비율 썸네일 + 솔리드 정보영역 (완벽한 컬럼 정렬)
// ────���────────────────────────────────────────────────────────

export function ShareCardTile({ drop, onShare, onClick, purpose, layout = "grid" }: ShareCardTileProps) {
  const meta = purposeMeta(purpose ?? drop.intent);
  const hasThumb = Boolean(drop.videoThumbnailUrl);
  const cd = useCountdown(drop.expiresAt);
  const hasStock = typeof drop.remainingStock === "number";
  const hasDropy = typeof drop.dropyReward === "number" && drop.dropyReward > 0;
  const hasChain = typeof drop.shareCount === "number" && drop.shareCount > 0;
  const hasMetaRow = hasStock || hasChain;
  const [journeyOpen, setJourneyOpen] = useState(false);
  const journeyNodes = hasChain
    ? drop.shareJourney ?? buildJourney(drop.shareCount!)
    : [];

  // 종류별 톤: 도트 색 + 텍스트 색 + 틴트 배경 (절제된 의미색)
  const tone =
    meta?.tone === "coupon"
      ? { dot: "#2563EB", text: "text-[#1D4ED8]", chip: "bg-[#EEF3FE]", chipBorder: "border-[#DBE6FD]" }
      : meta?.tone === "sale"
        ? { dot: "#0F172A", text: "text-[#0F172A]", chip: "bg-[#F1F5F9]", chipBorder: "border-[#E2E8F0]" }
        : { dot: "#64748B", text: "text-[#475569]", chip: "bg-[#F1F5F9]", chipBorder: "border-[#E2E8F0]" };

  // ── 가로형 리스트 행 ──────────────────────────────────────
  if (layout === "row") {
    return (
      <article
        onClick={onClick}
        className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-[#E8EDF3] bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-[#CBD5E1] hover:shadow-[0_8px_22px_rgba(15,23,42,0.09)]"
      >
        {/* 썸네일 (고정 정사각) */}
        <div className="relative aspect-square w-[92px] flex-shrink-0 overflow-hidden rounded-xl bg-[#F1F5F9]">
          {hasThumb ? (
            <img
              src={drop.videoThumbnailUrl || "/placeholder.svg"}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {drop.videoDurationSec > 0 ? (
                <Play className="size-6 text-[#94A3B8]" />
              ) : (
                <ImageIcon className="size-6 text-[#94A3B8]" />
              )}
            </div>
          )}
          {/* ⏱ 타이머(우선) 또는 재생시간 */}
          <div className="absolute bottom-1 left-1">
            {cd ? <TimerBadge cd={cd} compact /> : drop.videoDurationSec > 0 ? (
              <span className="rounded bg-black/65 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-white">
                {formatDuration(drop.videoDurationSec)}
              </span>
            ) : null}
          </div>
        </div>

        {/* 본문 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {meta && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${tone.chip} ${tone.chipBorder} ${tone.text}`}
              >
                <span className="size-1 rounded-full" style={{ backgroundColor: tone.dot }} />
                {meta.label}
              </span>
            )}
            <span className="truncate text-[11px] font-medium text-[#94A3B8]">
              {drop.maker.name}
              {drop.localName ? ` · ${drop.localName}` : ""}
            </span>
          </div>
          <div className="mt-1 line-clamp-2 text-[13.5px] font-semibold leading-[1.4] text-[#0F172A]">
            {drop.title}
          </div>
          {/* 📦 재고 · 🎁 드로피 · 🔗 공유체인(탭 → 공유지도) 메타 */}
          {(hasMetaRow || hasDropy) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {hasStock && <StockMeta stock={drop.remainingStock!} />}
              {hasChain && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setJourneyOpen((v) => !v);
                  }}
                  aria-haspopup="dialog"
                  className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 -mx-1 transition-colors active:bg-[#F1F5F9]"
                >
                  <ShareChainMeta count={drop.shareCount!} />
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: tone.dot }}>
                    <Route className="size-3.5" strokeWidth={2.25} />
                    <ArrowUpRight className="size-3.5" strokeWidth={2.5} />
                  </span>
                </button>
              )}
              {hasDropy && <DropyBadge reward={drop.dropyReward!} />}
            </div>
          )}
          {hasChain && (
            <ShareJourneySheet
              open={journeyOpen}
              onClose={() => setJourneyOpen(false)}
              nodes={journeyNodes}
              count={drop.shareCount!}
              title={drop.title}
              accent={tone.dot}
            />
          )}
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
            <Send className="size-4 text-[#475569] transition-colors group-hover:text-[#2563EB]" strokeWidth={2} />
          </span>
        </button>
      </article>
    );
  }

  // ── 세로형 그리드 카드 (기본) ─────────────────────────────
  return (
    <article
      onClick={onClick}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#E8EDF3] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:shadow-[0_10px_28px_rgba(15,23,42,0.1)]"
    >
      {/* 썸네일 — 고정 1:1 비율로 모든 카드 높이 정렬 */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#F1F5F9]">
        {hasThumb ? (
          <img
            src={drop.videoThumbnailUrl || "/placeholder.svg"}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[450ms] ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:scale-[1.05]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {drop.videoDurationSec > 0 ? (
              <Play className="size-7 text-[#94A3B8]" />
            ) : (
              <ImageIcon className="size-7 text-[#94A3B8]" />
            )}
          </div>
        )}

        {/* 종류칩 좌상단 대비용 상단 스크림(은은하게) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/25 to-transparent" />
        {/* 재생시간 대비용 하단 스크림 (영상일 때만) */}
        {drop.videoDurationSec > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
        )}

        {/* 종류칩 (좌상단) — 도트 + 라벨, 글래스 펄 */}
        {meta && (
          <span
            className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold shadow-[0_2px_6px_rgba(15,23,42,0.16)] backdrop-blur-sm ${tone.text}`}
          >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: tone.dot }} />
            {meta.label}
          </span>
        )}

        {/* 공유 버튼 (우상단) — 탭영역 44px */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare?.(drop.shareUuid);
          }}
          className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center"
          aria-label="공유"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-[0_2px_6px_rgba(15,23,42,0.18)] backdrop-blur-sm transition-all duration-150 group-hover:bg-white active:scale-90">
            <Send className="size-[15px] text-[#0F172A] transition-colors group-hover:text-[#2563EB]" strokeWidth={2} />
          </span>
        </button>

        {/* 재생시간만 좌하단(미디어 속성) — 타이머·드로피는 정보영역으로 이동 */}
        {!cd && drop.videoDurationSec > 0 && (
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white backdrop-blur-sm">
            {formatDuration(drop.videoDurationSec)}
          </span>
        )}
      </div>

      {/* 정보영역 — 솔리드, flex-1로 채우고 하단 메타는 바닥 정렬 */}
      <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
        <div className="truncate text-[11px] font-semibold text-[#64748B]">
          {drop.maker.name}
          {drop.localName ? ` · ${drop.localName}` : ""}
        </div>
        <div className="mt-1 line-clamp-2 min-h-[37px] text-[13.5px] font-semibold leading-[1.4] tracking-[-0.01em] text-[#0F172A]">
          {drop.title}
        </div>
        {/* 🎁 드로피 · ⏱ 타이머 — 제목 바로 아래 고정(위치 통일), 없으면 자리 유지 */}
        <div className="mt-2 flex min-h-[24px] items-center gap-1.5">
          {hasDropy && <DropyBadge reward={drop.dropyReward!} />}
          {cd && <TimerInline cd={cd} />}
        </div>
        {/* 📦 재고 · 🔗 공유체인(탭 → 공유지도) 메타 — 항상 카드 바닥 고정 */}
        <div className="mt-auto flex flex-col">
        {hasMetaRow && (
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#F1F5F9] pt-2.5">
            {hasChain ? <ShareChainMeta count={drop.shareCount!} compact /> : hasStock ? <StockMeta stock={drop.remainingStock!} /> : <span />}
            {hasChain && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setJourneyOpen((v) => !v);
                }}
                aria-haspopup="dialog"
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 -mr-1 text-[11px] font-semibold transition-colors active:bg-[#EEF3FE]"
                style={{ color: tone.dot }}
              >
                <Route className="size-3.5 flex-none" strokeWidth={2.25} />
                여정
                <ArrowUpRight className="size-3.5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}
        </div>
        {hasChain && (
          <ShareJourneySheet
            open={journeyOpen}
            onClose={() => setJourneyOpen(false)}
            nodes={journeyNodes}
            count={drop.shareCount!}
            title={drop.title}
            accent={tone.dot}
          />
        )}
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────
// Loading Skeleton (동일 구조/비율 — 화면 간 일관성)
// ─────────────────────────────────────────────────────────────

export function ShareCardTileSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#EAEEF3] bg-white">
      <div className="aspect-square w-full animate-pulse bg-[#F1F5F9]" />
      <div className="space-y-2 px-3 pb-3 pt-2.5">
        <div className="h-2.5 w-16 animate-pulse rounded bg-[#F1F5F9]" />
        <div className="h-3 w-full animate-pulse rounded bg-[#F1F5F9]" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-[#F1F5F9]" />
      </div>
    </div>
  );
}
