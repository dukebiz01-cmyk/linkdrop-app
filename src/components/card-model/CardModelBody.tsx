import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import type { LucideIcon } from "lucide-react";
// 거울 수렴 S1 — 영상 인플레이스 임베드는 공용 부품 재사용(신규 임베드 구현 금지 · 중복 3벌 방지).
import { YouTubeLiteEmbed } from "@/components/receiver/youtube-lite-embed";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Crown,
  Gift,
  ImageIcon,
  Lock,
  MapPin,
  Megaphone,
  MessageCircle,
  PartyPopper,
  Phone,
  Play,
  Rocket,
  Scissors,
  Share2,
  Star,
  Store,
  Tag,
  Ticket,
  TrendingUp,
  Truck,
  Users,
  Wand2,
  Waypoints,
  Zap,
} from "lucide-react";
import {
  SHIP_STAGES,
  type CardModel,
  type CardModelActions,
  type CardModelVariant,
} from "./card-model.types";
// ST2b-0 — 쿠폰 마감 타이머(1-A 배지 재사용 · 수신카드 1-C couponTimer 동형 — 거울 원칙).
//   L6 예외: 미리보기 한정 클라 시계 폴백(31창 승인 — 구 studio-build 주석 승계), serverNow 미주입.
import { TimerBadge } from "@/components/home/ShareCardTile";

/**
 * CardModelBody — CardModel 거울 2.0 렌더러. 정본: docs/ref/v0-45-card-body.tsx (868줄).
 *
 * 정본 대비 변환(ST1 — 미마운트 병행 구축, 기존 파일 0수정):
 *   · mock/데모 데이터 제거 — 전부 props(model/variant/actions)로만.
 *   · receiver 실동작(쿠폰 받기·예약·구매·연락·공유·도킹)은 CardModelActions optional
 *     콜백 — 미주입 시 studio/share 와 동일한 시각 stub(onClick 없음).
 *   · 배송추적·시설태그·후기·ReservationPreview 는 model 에 데이터 있을 때만 렌더
 *     (applied 게이트 + 데이터 게이트 이중 — 백엔드 부재 필드 가짜 렌더 금지).
 *   · 히어로: model.heroImageUrl 있으면 실이미지, 없으면 정본 placeholder.
 *   · accent 색 시스템(모드별 accent 가 카드 전체에 흐름)·레이아웃·수치는 정본 그대로.
 *   · 애니메이션 keyframes 는 v0 globals 에 없어 cm-* 접두 클래스로 자체 동봉
 *     (styles.css 무접촉, 전역 충돌 방지).
 *   · SSR 안전 — 브라우저 전용 API 0(useState 뿐). 펼침은 전부 인라인(Radix 아님).
 */

// 정본 animate-slide-up/animate-scale-in/forge-burst — 자체 동봉(cm- 접두).
const CM_KEYFRAMES = `
@keyframes cm-slide-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.cm-slide-up { animation: cm-slide-up 0.3s ease-out both; }
@keyframes cm-scale-in { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
.cm-scale-in { animation: cm-scale-in 0.3s ease-out both; }
@keyframes cm-forge-burst { 0% { transform: scale(0.4); opacity: 0; } 40% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
.cm-forge-burst { animation: cm-forge-burst 0.8s ease-out both; }
/* B전환 커밋2 — 실시간 반영 pop(시안 .just-in): 값이 빈→채움 되는 순간 그 필드 0.5s 하이라이트.
   inset box-shadow 로 채워 어떤 바탕색(칩·투명 텍스트) 위에서도 스냅 없이 페이드 → 원래 바탕 복귀.
   틴트색은 목적색(--cm-pop, 요소 인라인 주입). studio 미리보기 전용(수신 거울 무영향). */
@keyframes cm-just-in { from { box-shadow: inset 0 0 0 200px var(--cm-pop, rgba(15,118,110,0.15)); } to { box-shadow: inset 0 0 0 200px rgba(255,255,255,0); } }
.cm-just-in { animation: cm-just-in 0.5s ease; }
/* S3-4 §3 — 포토 셀 첫 로드 1회 펄스(허용 모션 · 반복 금지). */
@keyframes cm-pulse-once { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }
.cm-pulse-once { animation: cm-pulse-once 0.6s ease-out 1 both; }
`;

export function CardModelBody({
  model,
  variant = "receiver",
  burstKey = 0,
  // S3-4 §5 — 카드 내 여정 아코디언 기본 OFF(공유 여정 지도가 슬립[페이지 존]으로 이동).
  //   렌더 코드는 보존(가역) — 소비처가 명시 true 를 주면 재활성.
  showJourney = false,
  showShareFooter = true,
  actions,
  currentSlot,
  couponCtaRef,
  reserveExecutorSlot,
}: {
  model: CardModel;
  variant?: CardModelVariant;
  burstKey?: number;
  showJourney?: boolean;
  /** 거울 수렴 S1 — 카드 내장 공유푸터(복사/카톡)+FTC 노출. 기본 true(스튜디오·기존 소비처 유지).
   *  /d 는 페이지 크롬의 richer shareFooter(나도만들기/신고/여정)를 쓰므로 false 로 억제(중복 방지). */
  showShareFooter?: boolean;
  actions?: CardModelActions;
  /** FIX-48+50 P2 — 번호 인터뷰 현재 슬롯(별도 prop · 모델 타입 무오염). variant==="studio" 에서만
   *  점선 번호 슬롯("③ 가격이 여기 붙어요")으로 현재 단계 위치를 미리보기에 표시. /d 미전달 = 렌더 무영향. */
  currentSlot?: { no: number; label: string; anchor: string };
  /** S2 — 인카드 "쿠폰 받기" CTA 래퍼 ref 슬롯(옵셔널·additive). /d 페이지 크롬의 IO
   *  (보이면 sticky 숨김 · S18-A)가 관찰 대상으로 쓴다 — IO·숨김 로직은 페이지 소관(여기선 배선만).
   *  미주입 = 동작 불변(스튜디오·타 variant 영향 0). */
  couponCtaRef?: Ref<HTMLDivElement>;
  /** S3-4c — 예약 실행기 인라인 슬롯(수신 전용·additive): [예약 가능일] 펼침 안 [예약하기]
   *  탭 시 그 자리에서 확장(캘린더·선택예약·CTA·결제고지 — 페이지가 조립해 주입). 재탭 닫힘.
   *  미주입(스튜디오) = 버튼은 시각 stub(act.onReserve 폴백) — 렌더 동일. Radix 0. */
  reserveExecutorSlot?: ReactNode;
}) {
  const { accent, cardColor, pageBg, applied } = model;
  // FIX-48+50 P2 — 점선 슬롯 게이트: studio 미리보기 + 현재 앵커 일치 + 해당 값 비어있을 때만.
  const slotFor = (anchor: string) =>
    variant === "studio" && currentSlot?.anchor === anchor ? currentSlot : null;
  const [journeyOpen, setJourneyOpen] = useState(false);

  // B전환 커밋2 — 실시간 반영 pop: studio 미리보기에서 필드 값이 빈→채움으로 전이하는 순간 그 필드에
  //   0.5s 하이라이트(시안 .just-in). 순수 렌더 유지 — 값 변화만 감지(외부 상태 주입 0). /d 수신
  //   거울은 variant 게이트로 무영향. 스텝퍼·독 배지·점선 슬롯은 currentSlot 단일 정본과 이미 동기.
  const [justIn, setJustIn] = useState<string | null>(null);
  const prevValsRef = useRef<Record<string, string>>({});
  const popSeededRef = useRef(false);
  useEffect(() => {
    if (variant !== "studio") return;
    const cur: Record<string, string> = {
      origin: model.productOrigin ?? "",
      price: model.priceText ?? "",
      qty: model.productQty ? String(model.productQty) : "",
    };
    // 첫 실행 = 시드만(기존 값 pre-fill 된 카드 편집 진입 시 mount pop 오발 방지).
    if (!popSeededRef.current) {
      popSeededRef.current = true;
      prevValsRef.current = cur;
      return;
    }
    const prev = prevValsRef.current;
    let filled: string | null = null;
    for (const k of Object.keys(cur)) if (!prev[k] && cur[k]) filled = k; // 빈→채움 전이만.
    prevValsRef.current = cur;
    if (!filled) return;
    setJustIn(filled);
    const t = setTimeout(() => setJustIn(null), 500);
    return () => clearTimeout(t);
  }, [variant, model.productOrigin, model.priceText, model.productQty]);
  const popCls = (a: string) => (justIn === a ? "cm-just-in" : "");
  const popStyle = (a: string) =>
    justIn === a ? ({ ["--cm-pop"]: `${accent}26` } as CSSProperties) : undefined;

  const CategoryIcon: LucideIcon = model.categoryIcon ?? Tag;
  const CtaIcon: LucideIcon = model.ctaIcon ?? Tag;

  // receiver 실동작 — 미주입 콜백은 undefined 그대로(시각 stub, onClick 없음).
  const act = variant === "receiver" ? (actions ?? {}) : {};

  // 행동 버튼 조립 — S3-4 §2: calendar(예약하기)·link(매장정보)는 그리드 버튼존으로 이동.
  //   여기엔 commerce 계열(구매·인원)만 잔존(상품판매 미리보기 무회귀 — S4 몫).
  const bodyButtons: {
    id: string;
    label: string;
    icon: LucideIcon;
    main?: boolean;
    trailing?: string;
    onClick?: () => void;
  }[] = [];
  if (applied["seasonal"] || applied["product"])
    bodyButtons.push({
      id: "buy",
      // S4 — 라벨만 모델 분기(ctaLabel 미주입 = "구매" 폴백 — 스튜디오 렌더 불변).
      label: model.ctaLabel ?? "구매",
      icon: CtaIcon,
      main: true,
      trailing: model.priceText || undefined,
      onClick: act.onPreorder,
    });
  if (applied["party"] && model.party != null)
    bodyButtons.push({ id: "party", label: `${model.party}명`, icon: Users });

  // S3-4 §2 — 그리드 버튼존(장착 블록만 렌더 — 미장착 = 미렌더, 조립 원칙).
  //   ①예약 가능일 ②시설 정보 ③매장 정보 ④함께 받는 카드(포토 셀 §3).
  //   쿠폰 받기는 편입 금지 — 쿠폰존 전용. 인라인 펼침 = 한 번에 하나·재탭 닫힘·Radix 0.
  const [openGrid, setOpenGrid] = useState<string | null>(null);
  // S3-4c — 예약 실행기 인라인 확장 상태(재탭 닫힘). 다른 그리드로 이동 시 자동 닫힘.
  const [reserveOpen, setReserveOpen] = useState(false);
  const toggleGrid = (id: string) =>
    setOpenGrid((v) => {
      const next = v === id ? null : id;
      if (next !== "calendar") setReserveOpen(false);
      return next;
    });
  const dockItems = model.dockItems ?? [];
  const gridItems: { id: string; label: string; icon: LucideIcon }[] = [];
  // S3-4d — 셀 렌더 기준 = '캘린더 장착'(applied.calendar). 슬롯 유무는 펼침 분기로만.
  const hasReservationDataEarly = (model.dates?.length ?? 0) > 0 || !!model.date;
  if (applied["calendar"])
    gridItems.push({ id: "calendar", label: "예약 가능일", icon: Calendar });
  if (applied["link"] && (model.facilities?.length ?? 0) > 0)
    gridItems.push({ id: "facilities", label: "시설 정보", icon: Store });
  if (applied["link"] && (model.phone || model.map))
    gridItems.push({ id: "store", label: "매장 정보", icon: model.phone ? Phone : MapPin });
  // S4-6 — 배송정보 셀(additive): 이중 게이트(applied.shipping + 실값 행 존재 — delivery 문법 동형).
  //   내용 = buildShippingView 산출 표(판매자 고지) — SHIP_STAGES/송장(배송추적)과 무관(§0 S4b 락).
  if (applied["shipping"] && (model.shipping?.rows.length ?? 0) > 0)
    gridItems.push({ id: "shipping", label: "배송정보", icon: Truck });
  const hasDockCell = applied["dock"] && dockItems.length > 0;
  const gridCount = gridItems.length + (hasDockCell ? 1 : 0);

  const hasHeroMedia = applied["content"] || applied["image"] || applied["productimage"];
  // 데이터 게이트 — 백엔드 부재 섹션은 model 에 실데이터 있을 때만(미주입 = 미렌더).
  const hasDelivery =
    !!model.courier ||
    model.shipStage != null ||
    !!model.trackingNo ||
    !!model.shipFee ||
    !!model.shipEta;
  const hasReview = model.rating != null && !!model.reviewText;
  const hasReservationData = (model.dates?.length ?? 0) > 0 || !!model.date;
  const journey = model.journey ?? [];
  const spreadCount = model.spreadCount ?? 0;

  return (
    <div className="relative mx-auto w-full">
      <style>{CM_KEYFRAMES}</style>
      {/* ───────── 메인 카드 ───────── */}
      <div
        className="relative w-full select-none overflow-hidden rounded-[26px] p-5 text-[#0A0A0A] antialiased"
        style={{
          backgroundColor: cardColor,
          boxShadow:
            "0 1px 2px rgba(15,23,42,0.04), 0 8px 20px -8px rgba(15,23,42,0.10), 0 24px 56px -18px rgba(15,23,42,0.18), 0 0 0 1px #ECECEC",
        }}
      >
        {/* 레벨업 버스트 (스튜디오 전용) */}
        {variant === "studio" && burstKey > 0 && (
          <div key={burstKey} className="pointer-events-none absolute right-5 top-5 z-10">
            <div
              className="cm-forge-burst flex h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: accent }}
            >
              <Zap className="h-4 w-4 text-white" strokeWidth={2.5} fill="#fff" />
            </div>
          </div>
        )}

        <div className="relative">
          {/* 카테고리 + 출처 */}
          <div className="flex items-center justify-between">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ backgroundColor: `${accent}14`, color: accent }}
            >
              <CategoryIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
              {model.category}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#6E6E6E]">
              <Play className="h-3 w-3 fill-[#6E6E6E]" strokeWidth={0} />
              {model.source}
            </span>
          </div>

          {/* 도달 강화 리본 */}
          {(applied["top"] || applied["boost"] || applied["marketing"]) && (
            <div className="cm-slide-up mt-3 flex flex-wrap gap-1.5">
              {applied["top"] && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ backgroundColor: `${accent}14`, color: accent }}
                >
                  <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                  상위노출
                </span>
              )}
              {applied["boost"] && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ backgroundColor: `${accent}14`, color: accent }}
                >
                  <Rocket className="h-3.5 w-3.5" strokeWidth={2.5} />
                  부스트
                </span>
              )}
              {applied["marketing"] && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ backgroundColor: `${accent}14`, color: accent }}
                >
                  <Megaphone className="h-3.5 w-3.5" strokeWidth={2.5} />
                  마케팅
                </span>
              )}
            </div>
          )}

          {/* 히어로 미디어 — heroImageUrl 있으면 실이미지, 없으면 정본 placeholder */}
          {/* 거울 수렴 S1 — videoEmbed 주입 시 인플레이스 재생(공용 YouTubeLiteEmbed 재사용, 신규
              임베드 구현 0). 미주입(스튜디오 등) = 아래 현행 썸네일 분기 그대로 = 렌더 불변. */}
          {hasHeroMedia && model.videoEmbed ? (
            <div className="cm-scale-in relative mt-3 overflow-hidden rounded-2xl ring-1 ring-[#EDEDED]">
              <YouTubeLiteEmbed {...model.videoEmbed} />
            </div>
          ) : hasHeroMedia ? (
            <div className="cm-scale-in relative mt-3 aspect-video overflow-hidden rounded-2xl bg-[#F4F4F5] ring-1 ring-[#EDEDED]">
              {model.heroImageUrl ? (
                <div className="relative h-full w-full">
                  <img
                    src={model.heroImageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {applied["content"] && !applied["productimage"] && (
                    <>
                      <div
                        className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full"
                        style={{ backgroundColor: accent }}
                      >
                        <Play className="ml-0.5 h-5 w-5 fill-white text-white" strokeWidth={0} />
                      </div>
                      {model.clip && (
                        <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                          {model.clip} 핵심
                        </span>
                      )}
                    </>
                  )}
                </div>
              ) : applied["productimage"] ? (
                <div
                  className="flex h-full w-full flex-col items-center justify-center gap-1.5"
                  style={{ background: `linear-gradient(135deg, ${accent}12, ${accent}05)` }}
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${accent}1A`, color: accent }}
                  >
                    <ImageIcon className="h-6 w-6" strokeWidth={2} />
                  </span>
                  <span className="text-[11px] font-semibold text-[#525252]">상품 사진</span>
                  <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    본체 이미지
                  </span>
                </div>
              ) : (
                <div className="relative flex h-full w-full items-center justify-center">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: accent }}
                  >
                    <Play className="ml-0.5 h-5 w-5 fill-white text-white" strokeWidth={0} />
                  </div>
                  {applied["content"] && model.clip && (
                    <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                      {model.clip} 핵심
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              className="mt-3 flex aspect-video flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed"
              style={{ borderColor: `${accent}40`, backgroundColor: `${accent}0A` }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${accent}1A`, color: accent }}
              >
                <ImageIcon className="h-6 w-6" strokeWidth={2} />
              </span>
              <span className="text-[12px] font-semibold text-[#525252]">
                {variant === "studio" ? "덱에서 콘텐츠를 장착하세요" : "콘텐츠 준비 중"}
              </span>
            </div>
          )}

          {/* 제목 / 설명 */}
          <h3 className="mt-4 text-balance text-[21px] font-bold leading-snug tracking-[-0.02em] text-[#0A0A0A]">
            {model.titleText}
          </h3>
          <p className="mt-1 text-pretty text-[13px] leading-relaxed text-[#525252]">
            {model.subtitleText}
          </p>
          {(slotFor("title") || slotFor("subtitle")) && (
            // FIX-48+50 P2 — 점선 번호 슬롯(studio 전용): 현재 단계가 제목/한마디면 위치 힌트.
            <span
              className="mt-1.5 inline-flex items-center gap-1 rounded-full border-[1.5px] border-dashed px-2 py-0.5 text-[10px] font-bold"
              style={{ borderColor: accent, color: accent }}
            >
              {currentSlot!.no}. {currentSlot!.label} 여기에 붙어요
            </span>
          )}

          {/* 거울 수렴 S1 보정1 — 비커머스 셀링포인트(정보/쿠폰/예약 카드 키포인트 복원). 커머스는
              applied["product"] 블록 안에서 렌더하므로 여기선 !applied["product"] 로 분기(중복 출력 0).
              미주입=미렌더(빈 배열/미주입 시 섹션 자체 없음). variant 무관 공통(스튜디오=정본 복원). */}
          {!applied["product"] && model.productPoints && model.productPoints.length > 0 && (
            <ul className="mt-3 space-y-1">
              {model.productPoints.map((pt, i) => (
                <li
                  key={i}
                  className="flex items-start gap-1.5 text-[12px] leading-relaxed text-[#525252]"
                >
                  <Check
                    className="mt-0.5 h-3.5 w-3.5 flex-none"
                    style={{ color: accent }}
                    strokeWidth={2.75}
                  />
                  <span className="text-pretty">{pt}</span>
                </li>
              ))}
            </ul>
          )}

          {/* 브랜드 소개 */}
          {applied["brand"] && !!model.brandText && (
            <div
              className="cm-slide-up mt-3 flex items-start gap-2.5 rounded-xl py-2 pl-3 pr-3"
              style={{ backgroundColor: `${accent}0A`, boxShadow: `inset 3px 0 0 ${accent}` }}
            >
              <Store
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                strokeWidth={2.25}
                style={{ color: accent }}
              />
              <p className="text-pretty text-[12px] font-medium leading-relaxed text-[#525252]">
                {model.brandText}
              </p>
            </div>
          )}

          {/* 판매 기간 (판매 캘린더) — 데이터 있을 때만 */}
          {applied["seasonal"] && (model.saleStart || model.saleEnd) && (
            <div className="cm-slide-up mt-3">
              <div
                className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5"
                style={{ backgroundColor: `${accent}0D`, boxShadow: `inset 0 0 0 1px ${accent}22` }}
              >
                <Calendar className="h-4 w-4 shrink-0" style={{ color: accent }} strokeWidth={2.25} />
                <span className="text-[11px] font-semibold" style={{ color: accent }}>
                  판매 기간
                </span>
                <span className="ml-auto text-[12px] font-bold tabular-nums text-[#0A0A0A]">
                  {model.saleStart || "미정"}
                  {model.saleEnd && model.saleEnd !== model.saleStart ? ` ~ ${model.saleEnd}` : ""}
                </span>
              </div>
            </div>
          )}

          {/* 상품 정보 — 판매가 · 유형/원산지/단위 · 셀링포인트 */}
          {applied["product"] && (
            <div className="cm-slide-up mt-4">
              {/* FIX-39 — 판매 부스터 칩(전부 실값 · 빈 배열/미주입 = 미렌더 · 압박 카피 0).
                  품절만 붉은 톤, 나머지는 accent 틴트. */}
              {(model.boosterChips?.length ?? 0) > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {model.boosterChips!.map((c, idx) => (
                    <span
                      key={`${c.kind}-${idx}`}
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={
                        c.label === "품절"
                          ? { backgroundColor: "#FEF2F2", color: "#DC2626" }
                          : { backgroundColor: `${model.accent}14`, color: model.accent }
                      }
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
              )}
              {/* FIX-41 — 품절 카드 [재입고 알림 받기](부스터 품절 칩 아래 — FIX-39 배치 조화).
                  실동작은 receiver 콜백(onRestockAlert) 주입 시만 — 미주입 = 시각 stub(기존
                  CardModelActions 계약). /d 배선은 거울 수술 필요 → ST2b 이관. 신청 수 표시 0. */}
              {model.boosterChips?.some((c) => c.kind === "stock" && c.label === "품절") && (
                <button
                  type="button"
                  onClick={act.onRestockAlert}
                  className="mb-2 flex h-10 w-full items-center justify-center rounded-xl text-[12px] font-bold text-white active:scale-[0.98]"
                  style={{ backgroundColor: model.accent }}
                >
                  재입고 알림 받기
                </button>
              )}
              {/* FIX-40 — 공동구매 v1: 조건(사실만) + 진행률(실집계 있을 때만) + 필수 고지
                  (참여 시점 선명 노출 · §13 압박 카피 0 · 취소는 매장 문의 정직 표기). */}
              {model.groupBuy && (
                <div
                  className="mb-2 rounded-xl p-2.5"
                  style={{
                    backgroundColor: `${model.accent}0A`,
                    boxShadow: `inset 0 0 0 1px ${model.accent}26`,
                  }}
                >
                  <p className="text-[12px] font-bold" style={{ color: model.accent }}>
                    공동구매 · {model.groupBuy.offerLine}
                  </p>
                  {model.groupBuy.progressLine && (
                    <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-[#404040]">
                      {model.groupBuy.progressLine}
                    </p>
                  )}
                  <p className="mt-1 text-[10.5px] font-medium leading-relaxed text-[#525252] [word-break:keep-all]">
                    {model.groupBuy.noticeLine} {model.groupBuy.cancelLine}
                  </p>
                </div>
              )}
              {/* 유형 · 원산지 · 판매 단위 메타 */}
              {(model.productType ||
                model.productOrigin ||
                model.productUnitLabel ||
                model.productDateRangeLabel ||
                (slotFor("origin") && !model.productOrigin)) && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {model.productType && (
                    <span className="rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[10px] font-bold text-[#525252]">
                      {model.productType}
                    </span>
                  )}
                  {model.productUnitLabel && (
                    <span className="rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[10px] font-bold text-[#525252]">
                      {model.productUnitLabel}
                    </span>
                  )}
                  {/* FIX-24 — 수확·발송 기간(순차배송) 칩. 단일일 = 미주입 = 미렌더(기존 유지). */}
                  {model.productDateRangeLabel && (
                    <span className="rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[10px] font-bold text-[#525252]">
                      수확·발송 {model.productDateRangeLabel}
                    </span>
                  )}
                  {model.productOrigin && (
                    <span
                      className={`rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[10px] font-bold text-[#525252] ${popCls("origin")}`}
                      style={popStyle("origin")}
                    >
                      원산지 {model.productOrigin}
                    </span>
                  )}
                  {slotFor("origin") && !model.productOrigin && (
                    // FIX-48+50 P2 — 점선 번호 슬롯(studio 전용): "④ 원산지가 여기 붙어요".
                    <span
                      className="flex items-center gap-1 rounded-full border-[1.5px] border-dashed px-2 py-0.5 text-[10px] font-bold"
                      style={{ borderColor: accent, color: accent }}
                    >
                      {currentSlot!.no}. {currentSlot!.label}
                    </span>
                  )}
                </div>
              )}

              {/* 판매가 */}
              <div
                className="flex items-center justify-between rounded-2xl px-4 py-3"
                style={{ backgroundColor: `${accent}0D` }}
              >
                <span
                  className="flex items-center gap-1.5 text-[12px] font-semibold"
                  style={{ color: accent }}
                >
                  <Tag className="h-4 w-4" strokeWidth={2.25} />
                  판매가
                </span>
                <span className="flex items-baseline gap-1.5">
                  {model.productQty && (
                    <span
                      className={`text-[10px] font-semibold text-[#8A8A8A] ${popCls("qty")}`}
                      style={popStyle("qty")}
                    >
                      한정 {model.productQty}
                      {model.productQtyUnit ?? "개"}
                    </span>
                  )}
                  {slotFor("price") && !model.priceText ? (
                    // FIX-48+50 P2 — 점선 번호 슬롯(studio 전용): "③ 가격이 여기 붙어요".
                    <span
                      className="flex items-center gap-1 rounded-lg border-[1.5px] border-dashed px-2 py-1 text-[11px] font-bold"
                      style={{ borderColor: accent, color: accent }}
                    >
                      <span
                        className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] tabular-nums text-white"
                        style={{ backgroundColor: accent }}
                      >
                        {currentSlot!.no}
                      </span>
                      {currentSlot!.label}이 여기 붙어요
                    </span>
                  ) : (
                    <span
                      className={`text-[18px] font-bold tabular-nums text-[#0A0A0A] ${popCls("price")}`}
                      style={popStyle("price")}
                    >
                      {model.priceText || "가격 미정"}
                    </span>
                  )}
                </span>
              </div>

              {/* 거울 수렴 S0 — 드로피 적립 라인(수신 전용). 락 §드로피: 항상 "준비 중", 숫자 절대
                  미노출(dropyReady 불리언만 게이트 — 금액 필드 자체 없음). variant==="receiver" 게이트로
                  studio/share 는 미렌더 → 스튜디오 렌더 불변. 소비자 ProductWidget 문구·락과 동형. */}
              {variant === "receiver" && model.dropyReady && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#F7F6F2] px-2.5 py-1.5 text-[11px] font-semibold text-[#6B6961]">
                  <span
                    className="h-2.5 w-2.5 rotate-45 rounded-[2px]"
                    style={{ backgroundColor: `${accent}66` }}
                    aria-hidden="true"
                  />
                  Droppy · 판매 성사 시 적립 <span className="text-[#9A988F]">(준비 중)</span>
                </div>
              )}

              {/* 셀링포인트 */}
              {model.productPoints && model.productPoints.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {model.productPoints.map((pt, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-[12px] leading-relaxed text-[#525252]"
                    >
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 flex-none"
                        style={{ color: accent }}
                        strokeWidth={2.75}
                      />
                      <span className="text-pretty">{pt}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* 배송 안내 — 배송 진행 추적 + 택배사. 백엔드 부재 — 데이터 있을 때만(미주입=미렌더). */}
          {applied["delivery"] && hasDelivery && (
            <div
              className="cm-slide-up mt-3 rounded-2xl px-3.5 py-3.5"
              style={{ backgroundColor: `${accent}0A` }}
            >
              {/* 헤더: 택배사 · 현재 상태 */}
              <div className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} strokeWidth={2.5} />
                <span className="text-[12px] font-bold text-[#0A0A0A]">
                  {model.courier || "택배사 미정"}
                </span>
                <span
                  className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: accent, color: "#fff" }}
                >
                  {SHIP_STAGES[model.shipStage ?? 0]}
                </span>
              </div>

              {/* 진행 스텝퍼 */}
              <div className="mt-3 flex items-center">
                {SHIP_STAGES.map((label, i) => {
                  const stage = model.shipStage ?? 0;
                  const reached = i <= stage;
                  return (
                    <div key={label} className="flex flex-1 flex-col items-center last:flex-none">
                      <div className="flex w-full items-center">
                        {i > 0 && (
                          <span
                            className="h-[3px] flex-1 rounded-full"
                            style={{ backgroundColor: i <= stage ? accent : `${accent}22` }}
                          />
                        )}
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: reached ? accent : "#fff",
                            boxShadow: reached ? "none" : `inset 0 0 0 1.5px ${accent}30`,
                          }}
                        >
                          {i < stage ? (
                            <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                          ) : i === stage ? (
                            <span className="h-2 w-2 rounded-full bg-white" />
                          ) : (
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: `${accent}40` }}
                            />
                          )}
                        </span>
                        {i < SHIP_STAGES.length - 1 && (
                          <span
                            className="h-[3px] flex-1 rounded-full"
                            style={{ backgroundColor: i < stage ? accent : `${accent}22` }}
                          />
                        )}
                      </div>
                      <span
                        className="mt-1 text-[10px] font-semibold"
                        style={{ color: reached ? accent : "#9A9A9A" }}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 송장번호 (있을 때) */}
              {model.trackingNo && (
                <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-white px-2.5 py-1.5">
                  <span className="text-[10px] font-semibold text-[#6E6E6E]">송장번호</span>
                  <span className="ml-auto text-[11px] font-bold tabular-nums text-[#0A0A0A]">
                    {model.trackingNo}
                  </span>
                </div>
              )}

              {/* 배송비 · 도착 예정 */}
              {(model.shipFee || model.shipEta) && (
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-[#6E6E6E]">
                      <Truck className="h-3 w-3" strokeWidth={2.5} />
                      배송비
                    </span>
                    <span className="mt-0.5 block text-[12px] font-bold text-[#0A0A0A]">
                      {model.shipFee || "미정"}
                    </span>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-[#6E6E6E]">
                      <Calendar className="h-3 w-3" strokeWidth={2.5} />
                      도착 예정
                    </span>
                    <span className="mt-0.5 block text-[12px] font-bold text-[#0A0A0A]">
                      {model.shipEta || "미정"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 고객 후기 — 데이터 있을 때만(백엔드 부재, 미주입=미렌더) */}
          {applied["review"] && hasReview && (
            <div
              className="cm-slide-up mt-3 rounded-2xl px-3.5 py-3"
              style={{ backgroundColor: `${accent}0A` }}
            >
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className="h-3.5 w-3.5"
                      strokeWidth={2}
                      style={{
                        color: n <= (model.rating ?? 0) ? accent : "#D4D4D4",
                        fill: n <= (model.rating ?? 0) ? accent : "transparent",
                      }}
                    />
                  ))}
                </div>
                <span className="text-[12px] font-bold tabular-nums text-[#0A0A0A]">
                  {(model.rating ?? 0).toFixed(1)}
                </span>
                <span className="ml-auto text-[10px] font-semibold text-[#6E6E6E]">
                  실구매 고객 후기
                </span>
              </div>
              <p className="mt-1.5 text-pretty text-[12px] font-medium leading-relaxed text-[#525252]">
                {model.reviewText}
              </p>
            </div>
          )}

          {/* 행동 버튼 조립 — 거울 수렴 S1 보정2: 빈 상태("행동 버튼 준비 중")는 studio 제작 가이드
              에서만. receiver/share 는 액션 0이면 이 영역 렌더 0(빈 껍데기 노출 금지). */}
          {bodyButtons.length === 0 && gridCount === 0 && variant === "studio" ? (
            <div className="mt-3.5 rounded-xl border border-dashed border-[#D6D6D6] px-3 py-3 text-center text-[12px] font-medium text-[#737373] [word-break:keep-all]">
              목적 카드를 장착하면 여기에 행동 버튼이 생겨요
            </div>
          ) : bodyButtons.length > 0 ? (
            // FIX-12 — 행동 블록 세로 스택: 블록 하나 = 한 행(전폭). variant 3종 동일(거울).
            <div className="mt-3.5 flex flex-col gap-1.5">
              {bodyButtons.map((b) => {
                const BIcon = b.icon;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={b.onClick}
                    className="cm-slide-up flex h-11 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition-transform duration-150 active:translate-y-px"
                    style={
                      b.main
                        ? {
                            backgroundColor: accent,
                            color: "#fff",
                            boxShadow:
                              "inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 2px rgba(15,23,42,0.14)",
                          }
                        : { backgroundColor: `${accent}12`, color: accent }
                    }
                  >
                    <BIcon className="h-4 w-4" strokeWidth={2.25} />
                    {b.label}
                    {b.trailing && <span className="ml-0.5 font-bold tabular-nums">{b.trailing}</span>}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* S3-4 §2·§3 — 그리드 버튼존(카드 내 마지막 요소 — 이후 절취선→쿠폰존이 카드 마감).
              2열 · gap 8px · 셀 min-h 52px · radius 10px · 아이콘+라벨 세로. 홀수 시 마지막 풀폭. */}
          {gridCount > 0 && (
            <>
              <div className="mt-3.5 grid grid-cols-2 gap-2" data-testid="card-grid-zone">
                {gridItems.map((it, idx) => {
                  const GIcon = it.icon;
                  const isLastOdd = !hasDockCell && gridCount % 2 === 1 && idx === gridItems.length - 1;
                  const open = openGrid === it.id;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => toggleGrid(it.id)}
                      aria-expanded={open}
                      className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[10px] bg-white px-2 py-2 transition-transform duration-150 active:translate-y-px ${isLastOdd ? "col-span-2" : ""}`}
                      style={{
                        boxShadow: open ? `inset 0 0 0 1.5px ${accent}` : "inset 0 0 0 1px #EDEDED",
                      }}
                    >
                      <GIcon className="h-4 w-4" style={{ color: accent }} strokeWidth={2.25} />
                      <span className="flex items-center gap-0.5 text-[12px] font-bold text-[#0A0A0A]">
                        {it.label}
                        <ChevronDown
                          className={`h-3 w-3 text-[#9A9A9A] transition-transform ${open ? "rotate-180" : ""}`}
                          strokeWidth={2.5}
                        />
                      </span>
                    </button>
                  );
                })}
                {hasDockCell && (
                  <button
                    type="button"
                    onClick={() => toggleGrid("dock")}
                    aria-expanded={openGrid === "dock"}
                    className={`cm-pulse-once relative min-h-[52px] overflow-hidden rounded-[10px] text-left transition-transform duration-150 active:translate-y-px ${gridCount % 2 === 1 ? "col-span-2" : ""}`}
                    style={{
                      boxShadow:
                        openGrid === "dock" ? `inset 0 0 0 1.5px ${accent}` : "inset 0 0 0 1px #EDEDED",
                    }}
                    data-testid="dock-photo-cell"
                  >
                    {/* §3 — 상품 실사진 배경(등록 실사진만 — AI 생성 금지). 사진 없으면 아이콘 폴백. */}
                    {dockItems[0].imageUrl ? (
                      <img
                        src={dockItems[0].imageUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <span
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ backgroundColor: `${accent}12`, color: accent }}
                      >
                        <ImageIcon className="h-5 w-5" strokeWidth={2} />
                      </span>
                    )}
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-[#0A0A0A]">
                      함께 받는 카드 · {dockItems.length}
                    </span>
                    <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-white/95 px-2 py-1">
                      <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-[#0A0A0A]">
                        {dockItems[0].name}
                        {dockItems[0].priceLabel ? ` ${dockItems[0].priceLabel}` : ""}
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-[#6E6E6E] transition-transform ${openGrid === "dock" ? "rotate-180" : ""}`}
                        strokeWidth={2.5}
                      />
                    </span>
                  </button>
                )}
              </div>

              {/* 인라인 펼침 — 그리드 바로 아래, 한 번에 하나만. */}
              {/* S3-4d — 슬롯 0 = 정직 안내 + [매장 정보] 열기(기존 그리드 패널 핸들러).
                  예약하기·인라인 실행기 미노출(빈 제출 방지). */}
              {openGrid === "calendar" && !hasReservationDataEarly && (
                <div
                  className="cm-slide-up mt-2 rounded-xl bg-white px-3 py-3.5 text-center"
                  style={{ boxShadow: "inset 0 0 0 1px #EDEDED" }}
                >
                  <p className="text-[12px] font-medium leading-relaxed text-[#525252] [word-break:keep-all]">
                    지금 예약 가능한 날이 없어요 — 매장에 문의해 보세요
                  </p>
                  {applied["link"] && (model.phone || model.map) && (
                    <button
                      type="button"
                      onClick={() => toggleGrid("store")}
                      className="mt-2.5 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-4 text-[12px] font-semibold"
                      style={{ backgroundColor: `${accent}12`, color: accent }}
                    >
                      <Store className="h-3.5 w-3.5" strokeWidth={2.25} />
                      매장 정보 열기
                    </button>
                  )}
                </div>
              )}
              {openGrid === "calendar" && hasReservationDataEarly && (
                <div className="cm-slide-up">
                  <ReservationPreview model={model} accent={accent} />
                  {/* S3-4c — [예약하기] = 실행기 인라인 확장 토글(슬롯 주입 시 · 재탭 닫힘).
                      미주입(스튜디오) = act.onReserve 폴백(시각 stub). Radix 0. */}
                  <button
                    type="button"
                    onClick={
                      reserveExecutorSlot ? () => setReserveOpen((v) => !v) : act.onReserve
                    }
                    aria-expanded={reserveExecutorSlot ? reserveOpen : undefined}
                    className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-white transition-transform duration-150 active:translate-y-px"
                    style={{
                      backgroundColor: accent,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 2px rgba(15,23,42,0.14)",
                    }}
                  >
                    <Calendar className="h-4 w-4" strokeWidth={2.25} />
                    {reserveOpen ? "예약 닫기" : "예약하기"}
                  </button>
                  {reserveOpen && reserveExecutorSlot ? (
                    <div className="cm-slide-up mt-2">{reserveExecutorSlot}</div>
                  ) : null}
                </div>
              )}
              {/* S4-6 — 배송정보 펼침(표 행 = 모델 산출 그대로 · 실값 행만). */}
              {openGrid === "shipping" && model.shipping && (
                <div className="cm-slide-up mt-2 space-y-1.5">
                  {model.shipping.rows.map((r, i) => (
                    <div
                      key={`${r.label}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2"
                      style={{ boxShadow: "inset 0 0 0 1px #EDEDED" }}
                    >
                      <span className="shrink-0 text-[11px] font-semibold text-[#6E6E6E]">
                        {r.label}
                      </span>
                      <span className="min-w-0 text-right text-[12px] font-bold leading-relaxed text-[#0A0A0A] [word-break:keep-all]">
                        {r.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {openGrid === "facilities" && (
                <div className="cm-slide-up mt-2 flex flex-wrap gap-1.5">
                  {(model.facilities ?? []).map((f, i) => (
                    <span
                      key={`${f}-${i}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#404040]"
                      style={{ boxShadow: "inset 0 0 0 1px #EDEDED" }}
                    >
                      <Check className="h-3 w-3 shrink-0" style={{ color: accent }} strokeWidth={2.75} />
                      {f}
                    </span>
                  ))}
                </div>
              )}
              {openGrid === "store" && (
                <div className="cm-slide-up mt-2 grid grid-cols-3 gap-2">
                  {model.phone && (
                    <button
                      type="button"
                      onClick={act.onPhone ?? act.onContact}
                      className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[10px] bg-white text-[12px] font-semibold text-[#0A0A0A]"
                      style={{ boxShadow: "inset 0 0 0 1px #EDEDED" }}
                    >
                      <Phone className="h-4 w-4" style={{ color: accent }} strokeWidth={2.25} />
                      전화
                    </button>
                  )}
                  {model.phone && (
                    <button
                      type="button"
                      onClick={act.onSms ?? act.onContact}
                      className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[10px] bg-white text-[12px] font-semibold text-[#0A0A0A]"
                      style={{ boxShadow: "inset 0 0 0 1px #EDEDED" }}
                    >
                      <MessageCircle className="h-4 w-4" style={{ color: accent }} strokeWidth={2.25} />
                      문자
                    </button>
                  )}
                  {model.map && (
                    <button
                      type="button"
                      onClick={act.onDirections ?? act.onContact}
                      className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[10px] bg-white text-[12px] font-semibold text-[#0A0A0A]"
                      style={{ boxShadow: "inset 0 0 0 1px #EDEDED" }}
                    >
                      <MapPin className="h-4 w-4" style={{ color: accent }} strokeWidth={2.25} />
                      길찾기
                    </button>
                  )}
                </div>
              )}
              {openGrid === "dock" && (
                <div className="cm-slide-up mt-2 space-y-1.5">
                  {dockItems.map((d, i) => {
                    const row = (
                      <>
                        {d.imageUrl ? (
                          <img
                            src={d.imageUrl}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${accent}12`, color: accent }}
                          >
                            <ImageIcon className="h-4 w-4" strokeWidth={2} />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-[#0A0A0A]">
                            {d.name}
                          </span>
                          {d.priceLabel && (
                            <span className="block text-[11px] text-[#6E6E6E]">{d.priceLabel}</span>
                          )}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#C4C4C4]" strokeWidth={2.5} />
                      </>
                    );
                    const cls =
                      "flex w-full items-center gap-2.5 rounded-xl bg-white p-2 pr-2.5 text-left transition-transform duration-150 active:translate-y-px";
                    const ring = { boxShadow: "inset 0 0 0 1px #EDEDED" } as const;
                    return d.href ? (
                      <a key={i} href={d.href} target="_blank" rel="noopener noreferrer" className={cls} style={ring}>
                        {row}
                      </a>
                    ) : (
                      <button key={i} type="button" onClick={act.onDockOpen} className={cls} style={ring}>
                        {row}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* S3-4 §1 — 내장 공유푸터(3액션+FTC)·'나도 만들기' 렌더 제거: 전달 슬립(페이지 존,
              info-drop-page)으로 이동. remakeHref/remakeLabel 필드·onShare/onCopyLink 핸들러는
              보존(렌더만 제거 — 가역). showShareFooter prop 도 호환 보존(현재 미소비). */}

          {/* 공유 여정 — FIX-46: v0 원형 복원(행은 showJourney 만으로 상시 — 정본 :596 동일).
              진실경계: 확산 칩은 실집계(model.spreadCount) 주입 시만, 여정 미주입 = 펼침 안
              빈 상태 정직 표기(mock 이름·경로 이식 금지). 실데이터 주입은 FIX-39 문법 —
              journey/spreadCount optional 입력 대기(ST2b 에서 get_share_journey 실값 주입). */}
          {showJourney && (
            <div className="mt-3.5 border-t border-[#F0F0F0] pt-1">
              <button
                type="button"
                onClick={() => setJourneyOpen((v) => !v)}
                aria-expanded={journeyOpen}
                className="flex w-full items-center justify-between rounded-xl px-1 py-2.5 text-left transition-colors active:bg-[#F7F7F8]"
              >
                <span className="flex items-center gap-2 text-[13px] font-bold text-[#404040]">
                  <Waypoints className="h-4 w-4" strokeWidth={2.25} style={{ color: accent }} />
                  공유 여정 보기
                </span>
                <span className="flex items-center gap-1.5">
                  {/* FIX-46 — 확산 칩 = 실집계 주입 시만(미주입 = 숫자 없이 행만 · 부풀림 0). */}
                  {model.spreadCount != null && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                      style={{ backgroundColor: `${accent}14`, color: accent }}
                    >
                      {spreadCount}명 확산
                    </span>
                  )}
                  <ChevronDown
                    className="h-4 w-4 text-[#A3A3A3] transition-transform duration-300"
                    strokeWidth={2.5}
                    style={{ transform: journeyOpen ? "rotate(180deg)" : "none" }}
                  />
                </span>
              </button>
              <div
                className="grid transition-all duration-300 ease-out"
                style={{ gridTemplateRows: journeyOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  {/* FIX-46 — 여정 미주입 = 빈 상태 정직 표기(가짜 명단 0). */}
                  {journey.length === 0 && (
                    <p className="mt-1 rounded-xl bg-[#F7F7F8] px-3 py-2.5 text-center text-[12px] font-medium text-[#8A8A8A] [word-break:keep-all]">
                      발행 후 공유가 시작되면 여기서 볼 수 있어요
                    </p>
                  )}
                  <div className="mt-1 space-y-1 px-0.5 pb-0.5">
                    {journey.map((node, i) => {
                      const isLast = i === journey.length - 1;
                      const isMe = node.kind === "me";
                      const isBuyer = node.kind === "buyer";
                      return (
                        <div key={i} className="flex items-stretch gap-2.5">
                          <div className="flex flex-none flex-col items-center">
                            <span
                              className="flex h-7 w-7 flex-none items-center justify-center rounded-full"
                              style={
                                isMe
                                  ? {
                                      backgroundColor: accent,
                                      color: "#fff",
                                      boxShadow: `0 4px 10px -3px ${accent}80`,
                                    }
                                  : isBuyer
                                    ? { backgroundColor: "#fff", color: accent, boxShadow: `0 0 0 1.5px ${accent}` }
                                    : { backgroundColor: "#F1F1F2", color: "#A3A3A3" }
                              }
                            >
                              {isMe ? (
                                <Crown className="h-3.5 w-3.5" strokeWidth={2.25} />
                              ) : isBuyer ? (
                                <PartyPopper className="h-3.5 w-3.5" strokeWidth={2.25} />
                              ) : (
                                <Share2 className="h-3 w-3" strokeWidth={2.25} />
                              )}
                            </span>
                            {!isLast && (
                              <span
                                className="my-1 w-px flex-1 rounded-full"
                                style={{ minHeight: 10, backgroundColor: isMe ? `${accent}59` : "#E8E8EA" }}
                              />
                            )}
                          </div>
                          <div
                            className="mb-0.5 flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-1.5"
                            style={{ backgroundColor: isMe ? `${accent}0F` : "transparent" }}
                          >
                            <span
                              className={`flex-none text-[12px] font-bold ${isMe ? "" : "text-[#9A9A9A]"}`}
                              style={isMe ? { color: accent } : undefined}
                            >
                              {node.name}
                            </span>
                            <span
                              className="truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                              style={
                                node.emphasis
                                  ? { backgroundColor: accent, color: "#fff" }
                                  : isBuyer
                                    ? { backgroundColor: `${accent}18`, color: accent }
                                    : { backgroundColor: "#F1F1F2", color: "#737373" }
                              }
                            >
                              {node.role}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* FIX-46 — 확산 통계 박스도 실집계 주입 시만(미주입 = 빈 상태 문구가 대신). */}
                  {model.spreadCount != null && (
                    <div
                      className="relative mt-2 overflow-hidden rounded-xl px-3 py-3"
                      style={{ backgroundColor: "#0F172A" }}
                    >
                      {/* 선명한 상단 액센트 라인 (번짐 없음) */}
                      <span
                        className="pointer-events-none absolute inset-x-0 top-0 h-0.5"
                        style={{ backgroundColor: accent }}
                      />
                      <p className="relative flex items-center gap-1.5 text-[11px] font-semibold text-white/65">
                        <TrendingUp
                          className="h-3.5 w-3.5 flex-none"
                          strokeWidth={2.5}
                          style={{ color: accent }}
                        />
                        지금까지 퍼진 사람
                      </p>
                      <p className="relative mt-1 text-[22px] font-extrabold leading-none tabular-nums text-white">
                        {spreadCount}
                        <span className="ml-1 text-[13px] font-semibold text-white/70">명</span>
                      </p>
                      <p className="relative mt-2 border-t border-white/10 pt-2 text-[11px] font-medium leading-snug text-white/75">
                        내가 이어준 카드가 <b className="font-bold text-white">{spreadCount}명</b>에게
                        닿았어요
                      </p>
                      <p className="relative mt-1.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-white/45">
                        <Lock className="mt-0.5 h-3 w-3 flex-none" strokeWidth={2} />
                        타인 익명 · 구매·수령은 익명 유지 · 기여도만 집계(모집 없음)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ───────── 도킹된 쿠폰 카드 (이음새로 연결) ───────── */}
      {applied["coupon"] && !!model.couponLabel && (
        <div className="relative">
          {/* 이음새: 좌우 노치 + 점선 천공 */}
          <div className="relative h-5">
            <span
              className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
              style={{ backgroundColor: cardColor, boxShadow: "0 0 0 1px #EDEDED" }}
            >
              <Scissors className="h-3 w-3" strokeWidth={2.25} style={{ color: `${accent}CC` }} />
            </span>
            <span
              className="absolute -left-1.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full"
              style={{ backgroundColor: pageBg }}
            />
            <span
              className="absolute -right-1.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full"
              style={{ backgroundColor: pageBg }}
            />
            <div
              className="absolute left-6 right-6 top-1/2 -translate-y-1/2 border-t-2 border-dashed"
              style={{ borderColor: `${accent}33` }}
            />
          </div>

          <div
            className="relative -mt-px w-full overflow-hidden rounded-[26px] p-5 text-[#0A0A0A]"
            style={{
              backgroundColor: cardColor,
              boxShadow: "0 22px 60px -18px rgba(15,23,42,0.14), 0 0 0 1px #EDEDED",
            }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ backgroundColor: `${accent}14`, color: accent }}
              >
                <Ticket className="h-3.5 w-3.5" strokeWidth={2.5} />
                쿠폰 카드
              </span>
              <span className="ml-auto text-[11px] font-medium text-[#6E6E6E]">도킹 연결됨</span>
            </div>

            {/* ST2b-0 — 마감 타이머: 수신카드 1-C couponTimer 동형(relative 스트립 + 배지 무수정).
                couponExpiresAt 미주입 = 미렌더. 만료 = TimerBadge 자체 "마감" 고정 표기(L2). */}
            {model.couponExpiresAt ? (
              <div className="relative mt-3 h-7">
                {/* S2 — serverNow 관통(L6 offset 보정 · 라우트 loader 공급). 미주입 = 클라 시계 폴백. */}
                <TimerBadge expiresAt={model.couponExpiresAt} serverNow={model.serverNow} />
              </div>
            ) : null}

            <div className="mt-3 flex items-center gap-3">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: accent, color: "#fff" }}
              >
                <Ticket className="h-6 w-6" strokeWidth={2.25} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-[#0A0A0A]">{model.couponLabel}</p>
                <p className="mt-0.5 text-[12px] text-[#6E6E6E]">
                  {model.store ? `${model.store} · ` : ""}받는 즉시 사용 가능
                </p>
              </div>
            </div>

            {/* S2 — 구 CouponPreview 필드 커버리지(미주입 = 미렌더): 증정 칩 ↔ 조건 문구 상호배타 + 기한 표기. */}
            {model.couponGift ? (
              <p
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold"
                style={{ backgroundColor: `${accent}14`, color: accent }}
              >
                <Gift className="h-3.5 w-3.5" strokeWidth={2.25} />
                {model.couponGift} 증정
              </p>
            ) : model.couponCondition ? (
              <p className="mt-2.5 text-[12px] font-medium text-[#6E6E6E]">{model.couponCondition}</p>
            ) : null}
            {model.couponValidText ? (
              <p className="mt-1 text-[12px] font-medium text-[#6E6E6E]">{model.couponValidText}</p>
            ) : null}

            {/* S2 — couponCtaRef 래퍼: 페이지 IO(sticky 숨김) 관찰 대상. 미주입 = 렌더 동일. */}
            <div ref={couponCtaRef}>
              <button
                type="button"
                onClick={act.onClaimCoupon}
                className="mt-3.5 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold text-white transition-transform duration-150 active:translate-y-px"
                style={{ backgroundColor: accent, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)" }}
              >
                <Ticket className="h-4 w-4" strokeWidth={2.25} />
                쿠폰 받기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 예약 가능일 미리보기 — 날짜가 많으면 접어서 카드 길이를 제어한다. (정본 그대로)
 * 접힘 상태는 순수 로컬 UI 상태라 모델(거울 데이터)을 건드리지 않는다.
 * 스튜디오·공유·수신자 인스턴스 모두 동일 초기 상태로 시작하므로 거울이 깨지지 않는다.
 */
function ReservationPreview({ model, accent }: { model: CardModel; accent: string }) {
  const COLLAPSE_THRESHOLD = 4;
  const PREVIEW_COUNT = 3;
  const [expanded, setExpanded] = useState(false);

  const dates = model.dates && model.dates.length ? model.dates : model.date ? [model.date] : [];
  // model.times가 정의됐지만 비어있으면 = 시간 미지정(종일)
  const noTime = Array.isArray(model.times) && model.times.length === 0;
  const times = model.times && model.times.length ? model.times : model.time ? [model.time] : [];
  const slotMap = model.slotsByDate ?? {};
  const fallback = model.slots ?? model.party ?? 0;

  const collapsible = dates.length > COLLAPSE_THRESHOLD;
  const visibleDates = collapsible && !expanded ? dates.slice(0, PREVIEW_COUNT) : dates;
  const hiddenCount = dates.length - PREVIEW_COUNT;
  const openSeats = dates.reduce((sum, d) => sum + (slotMap[d] ?? fallback), 0);

  return (
    <div className="cm-slide-up mt-3.5 rounded-2xl border border-[#EDEDED] bg-[#FAFAFA] p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] font-bold text-[#0A0A0A]">
          <Calendar className="h-3.5 w-3.5" style={{ color: accent }} strokeWidth={2.5} />
          예약 가능일
        </span>
        <span className="text-[10px] font-semibold tabular-nums text-[#8A8A8A]">
          {dates.length}일 · 잔여 {openSeats}석
        </span>
      </div>

      {/* 날짜별 잔여 좌석 — accent는 좌석 수에만 (포인트) */}
      <div
        className={`mt-2 space-y-1 ${
          expanded && collapsible ? "max-h-52 overflow-y-auto pr-0.5 [scrollbar-width:thin]" : ""
        }`}
      >
        {visibleDates.map((d) => {
          const seats = slotMap[d] ?? fallback;
          const soldOut = seats === 0;
          return (
            <div
              key={d}
              className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 [box-shadow:0_0_0_1px_#EDEDED]"
            >
              <span className="text-[11px] font-semibold tabular-nums text-[#404040]">{d}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums"
                style={
                  soldOut
                    ? { backgroundColor: "#F4F4F5", color: "#A3A3A3" }
                    : { backgroundColor: `${accent}14`, color: accent }
                }
              >
                {soldOut ? "마감" : `잔여 ${seats}석`}
              </span>
            </div>
          );
        })}
      </div>

      {/* 접기/펼치기 토글 */}
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg bg-white py-1.5 text-[11px] font-bold text-[#525252] [box-shadow:0_0_0_1px_#EDEDED] transition-colors active:bg-[#F4F4F5]"
        >
          {expanded ? (
            <>
              접기
              <ChevronDown className="h-3.5 w-3.5 rotate-180" strokeWidth={2.5} />
            </>
          ) : (
            <>
              {`+${hiddenCount}일 더보기`}
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
            </>
          )}
        </button>
      )}

      {(noTime || times.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[#EDEDED] pt-2">
          <Clock className="h-3.5 w-3.5 text-[#8A8A8A]" strokeWidth={2.25} />
          {noTime && <span className="text-[11px] font-semibold text-[#8A8A8A]">시간 미지정 · 종일</span>}
          {times.map((t) => (
            <span key={t} className="text-[11px] font-semibold tabular-nums text-[#525252]">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
