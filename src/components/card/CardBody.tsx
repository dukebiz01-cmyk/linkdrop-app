import { Play, Phone, MapPin, ExternalLink, Calendar, Info } from "lucide-react";
import { YouTubeLiteEmbed } from "@/components/receiver/youtube-lite-embed";
import { SellingPoints } from "@/components/card/SellingPoints";
import { CouponPreview } from "@/components/receiver/CouponPreview";
import { CardActionButton } from "@/components/card/CardActionButton";
import { ButtonBlock } from "@/components/card/ButtonBlock";
import type { CardBodyProps } from "@/components/card/CardBody.types";

/**
 * CardBody — 카드 본체(presentational, 실콘텐츠 전용).
 *
 * 스튜디오 미리보기(mode="preview")와 손님 /d(mode="live")가 같은 CardBody 를 렌더(싱크로율).
 * ★ 실콘텐츠만 그린다 — 데이터 없는 슬롯엔 아무것도 안 그림(빈 칸). preview placeholder
 *   ("영상을 검색하세요" 등)는 호출부(studio-build) 책임(결정 b). presentational = onClick 0.
 *
 * 라이브 카드 append 미래 대비:
 *  - sellingPoints 는 string[] → SellingPoints 가 내부 map(이미 리스트친화).
 *  - 쿠폰은 현재 단일(coupon). ★향후 쿠폰 리스트(append) 시 이 자리에서 coupons.map 으로 확장.
 *  - 실기능(예약캘린더·CTA·연락)은 live 에서 슬롯(ReactNode) 주입 — 제작/출고 층 분리.
 */
export function CardBody({
  mode,
  video,
  title,
  tagline,
  taglinePlaceholder,
  sellingPoints,
  coupon,
  store,
  contactSlot,
  couponBlock,
  reservationBlock,
  contactBlock,
}: CardBodyProps) {
  return (
    <>
      {/* 영상 출처 라벨 — video 데이터에서(하드코딩 제거). video 있을 때만. */}
      {video ? (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/75">
          <Play className="h-3 w-3 fill-white/75" strokeWidth={0} />
          {video.sourceLabel ?? "YouTube"}
          {video.title ? ` · ${video.title}` : ""}
        </div>
      ) : null}

      {/* 영상칸 — video 있을 때만 임베드. 없으면 슬롯 안 그림(placeholder 는 호출부). */}
      {video ? (
        <div className="mt-3 flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15">
          <YouTubeLiteEmbed {...video} />
        </div>
      ) : null}

      {/* 제목 — 매장명/영상헤드라인. 빈 문자열이면 안 그림. */}
      {title ? <h3 className="mt-4 text-xl font-bold tracking-tight">{title}</h3> : null}

      {/* 태그라인 — 한마디/부제. 채워지면 실제 tagline, 비고 taglinePlaceholder 주입 시 흐린 안내(스튜디오 전용).
          손님은 taglinePlaceholder 미주입 → 둘 다 없으면 안 그림. */}
      {tagline ? (
        <p className="mt-0.5 text-[13px] text-white/75">{tagline}</p>
      ) : taglinePlaceholder ? (
        <p className="mt-0.5 text-[13px] text-white/40">{taglinePlaceholder}</p>
      ) : null}

      {/* 셀링포인트 — 배열(SellingPoints 가 내부 map, 빈 배열이면 null). */}
      <SellingPoints points={sellingPoints} />

      {/* 행동영역 — 쿠폰 + 예약 + 연락. 균일 스택(손님 정돈 리듬 space-y-6). */}
      <div className="mt-4 space-y-6">
        {/* §2-1 하단 블록 슬롯 — container 가 균일 스택으로 주입(신규, 우선).
            3a: 아무도 안 넘김 → 전부 null → 아래 기존 경로 그대로(동작 0변화). */}
        {couponBlock ? couponBlock : null}
        {reservationBlock ? (
          <ButtonBlock
            label="예약 날짜 선택"
            icon={<Calendar className="h-4 w-4" strokeWidth={2} />}
            defaultExpanded={false}
            expandedContent={reservationBlock}
          />
        ) : null}
        {contactBlock ? (
          <ButtonBlock
            label="정보 보기"
            icon={<Info className="h-4 w-4" strokeWidth={2} />}
            defaultExpanded={false}
            expandedContent={contactBlock}
          />
        ) : null}

        {/* 쿠폰(기존) — couponBlock 신규 슬롯 없을 때만(중복 방지). 3d 제거 전까지 유지. */}
        {!couponBlock && coupon ? (
          <div className="space-y-2">
            <CouponPreview coupon={coupon} />
          </div>
        ) : null}

        {/* 연락(기존) — contactBlock 없을 때만. live=주입 슬롯(실동작 tel:/지도), preview=store 기반 시각 칩(onClick 0). */}
        {!contactBlock ? (
          mode === "live" ? (
            (contactSlot ?? null)
          ) : store && (store.phone || store.address || store.reservationUrl) ? (
            <div className="flex gap-2">
              {store.phone ? (
                <CardActionButton
                  icon={<Phone className="h-3.5 w-3.5" strokeWidth={2} />}
                  label="전화"
                />
              ) : null}
              {store.address ? (
                <CardActionButton
                  icon={<MapPin className="h-3.5 w-3.5" strokeWidth={2} />}
                  label="길찾기"
                />
              ) : null}
              {store.reservationUrl ? (
                <CardActionButton
                  icon={<ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />}
                  label="예약"
                />
              ) : null}
            </div>
          ) : null
        ) : null}

      </div>
    </>
  );
}
