import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Crown,
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
  Waypoints,
  Zap,
} from "lucide-react";
import {
  SHIP_STAGES,
  type CardModel,
  type CardModelActions,
  type CardModelVariant,
} from "./card-model.types";

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
`;

export function CardModelBody({
  model,
  variant = "receiver",
  burstKey = 0,
  showJourney = true,
  actions,
}: {
  model: CardModel;
  variant?: CardModelVariant;
  burstKey?: number;
  showJourney?: boolean;
  actions?: CardModelActions;
}) {
  const { accent, cardColor, pageBg, applied } = model;
  const [journeyOpen, setJourneyOpen] = useState(false);

  const CategoryIcon: LucideIcon = model.categoryIcon ?? Tag;
  const CtaIcon: LucideIcon = model.ctaIcon ?? Tag;

  // receiver 실동작 — 미주입 콜백은 undefined 그대로(시각 stub, onClick 없음).
  const act = variant === "receiver" ? (actions ?? {}) : {};

  // 행동 버튼 조립 (본체/배경/강화/쿠폰 제외 — 쿠폰은 아래 도킹 카드로 분리). 정본 그대로.
  const bodyButtons: {
    id: string;
    label: string;
    icon: LucideIcon;
    main?: boolean;
    trailing?: string;
    onClick?: () => void;
  }[] = [];
  if (applied["calendar"])
    bodyButtons.push({
      id: "calendar",
      label: "예약하기",
      icon: Calendar,
      main: true,
      onClick: act.onReserve,
    });
  if (applied["seasonal"] || applied["product"])
    bodyButtons.push({
      id: "buy",
      label: "구매",
      icon: CtaIcon,
      main: true,
      trailing: model.priceText || undefined,
      onClick: act.onPreorder,
    });
  if (applied["party"] && model.party != null)
    bodyButtons.push({ id: "party", label: `${model.party}명`, icon: Users });
  if (applied["link"] && (model.phone || model.map))
    bodyButtons.push({
      id: "link",
      label: model.phone && model.map ? "매장정보" : model.phone ? "전화" : "위치",
      icon: model.phone ? Phone : MapPin,
      onClick: act.onContact,
    });

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
          {hasHeroMedia ? (
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
              {/* 유형 · 원산지 · 판매 단위 메타 */}
              {(model.productType || model.productOrigin || model.productUnitLabel) && (
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
                  {model.productOrigin && (
                    <span className="rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[10px] font-bold text-[#525252]">
                      원산지 {model.productOrigin}
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
                    <span className="text-[10px] font-semibold text-[#8A8A8A]">
                      한정 {model.productQty}개
                    </span>
                  )}
                  <span className="text-[18px] font-bold tabular-nums text-[#0A0A0A]">
                    {model.priceText || "가격 미정"}
                  </span>
                </span>
              </div>

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

          {/* 예약 가능일 — 데이터 있을 때만 렌더(정본 접기 로직 그대로) */}
          {applied["calendar"] && hasReservationData && (
            <ReservationPreview model={model} accent={accent} />
          )}

          {/* 행동 버튼 조립 */}
          {bodyButtons.length === 0 && !applied["dock"] ? (
            <div className="mt-3.5 rounded-xl border border-dashed border-[#D6D6D6] px-3 py-3 text-center text-[12px] font-medium text-[#737373] [word-break:keep-all]">
              {variant === "studio" ? "목적 카드를 장착하면 여기에 행동 버튼이 생겨요" : "행동 버튼 준비 중"}
            </div>
          ) : bodyButtons.length > 0 ? (
            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
              {bodyButtons.map((b) => {
                const BIcon = b.icon;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={b.onClick}
                    className="cm-slide-up inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition-transform duration-150 active:translate-y-px"
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

          {/* 매장 시설 정보 (주차·와이파이 등) — 데이터 있을 때만(백엔드 부재, 미주입=미렌더) */}
          {applied["link"] && (model.facilities?.length ?? 0) > 0 && (
            <div className="cm-slide-up mt-3">
              <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#6E6E6E]">
                <Store className="h-3 w-3" strokeWidth={2.5} />
                매장 시설
              </div>
              <div className="flex flex-wrap gap-1.5">
                {model.facilities!.map((f, i) => (
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
            </div>
          )}

          {/* 함께 받는 카드 (도킹된 참조 카드) */}
          {applied["dock"] && !!model.dockTitle && (
            <div className="cm-slide-up mt-3">
              <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#6E6E6E]">
                <Copy className="h-3 w-3" strokeWidth={2.5} />
                함께 받는 카드
              </div>
              <button
                type="button"
                onClick={act.onDockOpen}
                className="flex w-full items-center gap-2.5 rounded-xl bg-white p-2 pr-2.5 text-left transition-transform duration-150 active:translate-y-px"
                style={{ boxShadow: "inset 0 0 0 1px #EDEDED" }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${accent}12`, color: accent }}
                >
                  <Play className="ml-0.5 h-4 w-4 fill-current" strokeWidth={0} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-[#0A0A0A]">
                    {model.dockTitle}
                  </span>
                  {model.dockMeta && (
                    <span className="block text-[11px] text-[#6E6E6E]">{model.dockMeta}</span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#C4C4C4]" strokeWidth={2.5} />
              </button>
            </div>
          )}

          {/* 공유 푸터 */}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={act.onCopyLink}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white text-[13px] font-semibold text-[#404040] transition-transform duration-150 active:translate-y-px"
              style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
            >
              <Copy className="h-4 w-4" strokeWidth={2.25} />
              링크 복사
            </button>
            <button
              type="button"
              onClick={act.onShare}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white text-[13px] font-semibold text-[#404040] transition-transform duration-150 active:translate-y-px"
              style={{ boxShadow: "inset 0 0 0 1px #E5E5E5" }}
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
              카톡 공유
            </button>
          </div>

          {/* FTC 고지 */}
          <p className="mt-3 text-center text-[11px] leading-relaxed text-[#6E6E6E]">
            본 콘텐츠는 LinkDrop 광고/제휴 안내가 적용됩니다. (FTC 권고 사항)
          </p>

          {/* 공유 여정 — journey 미주입 = 미렌더(카드 단건 RPC 에 여정 미포함, READ 6항) */}
          {showJourney && journey.length > 0 && (
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
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                    style={{ backgroundColor: `${accent}14`, color: accent }}
                  >
                    {spreadCount}명 확산
                  </span>
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
                      <TrendingUp className="h-3.5 w-3.5 flex-none" strokeWidth={2.5} style={{ color: accent }} />
                      지금까지 퍼진 사람
                    </p>
                    <p className="relative mt-1 text-[22px] font-extrabold leading-none tabular-nums text-white">
                      {spreadCount}
                      <span className="ml-1 text-[13px] font-semibold text-white/70">명</span>
                    </p>
                    <p className="relative mt-2 border-t border-white/10 pt-2 text-[11px] font-medium leading-snug text-white/75">
                      내가 이어준 카드가 <b className="font-bold text-white">{spreadCount}명</b>에게 닿았어요
                    </p>
                    <p className="relative mt-1.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-white/45">
                      <Lock className="mt-0.5 h-3 w-3 flex-none" strokeWidth={2} />
                      타인 익명 · 구매·수령은 익명 유지 · 기여도만 집계(모집 없음)
                    </p>
                  </div>
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
