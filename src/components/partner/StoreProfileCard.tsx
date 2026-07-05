import { useState, type ReactNode } from "react";
import { Copy, Link2, MapPin, Phone, Tag, Ticket, Users } from "lucide-react";

// 매장 프로필 카드(명함) — 사장 본인 내매장 + 공유용 /alliance 뷰 공용.
// 보는 partner 를 prop 으로 받고, 구독수 등 소유자 전용 요소는 비소유자 뷰에서 숨긴다.

export type AllianceActiveCoupon = {
  id: string;
  title: string | null;
  valid_until: string | null;
};

export type StoreProfileCardProps = {
  name: string;
  tier: "biz" | "pb";
  businessTypeLabel: string | null; // 업종 한글 (business_categories depth=1)
  partnerKind: string | null; // 보조
  address: string | null;
  // 명함 고정 정보 — 연락처(있으면 tel: 링크). 없으면 행 미표시.
  contactPhone?: string | null;
  activeCoupons: AllianceActiveCoupon[];
  /** S2b — 매장 영문 주소(slug). 있으면 drop.how/{slug} 링크 행 + 복사 버튼. 미주입 = 미렌더. */
  slug?: string | null;
  /** 소유자 전용 — 구독수. undefined/null 이면 구독 행 숨김(비소유자 뷰). */
  subscriberCount?: number | null;
  /** 이름 아래 부제 (예: "내 매장 명함"). 없으면 미표시. */
  note?: string;
  /** 헤더 우측 액션 (예: 명함 공유 버튼). */
  headerAction?: ReactNode;
  /** 카드 하단 영역 (공동프로모션 비활성 버튼 / 제휴 버튼 등). */
  footer?: ReactNode;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

// partner_kind enum → 한글 라벨 (업종 보조 표시용). business_type 한글이 우선.
function partnerKindLabel(kind: string | null): string | null {
  switch (kind) {
    case "campsite":
      return "캠핑장";
    case "store":
      return "매장";
    case "brand":
      return "브랜드";
    case "ticket_seller":
      return "티켓";
    case "campaign_org":
      return "캠페인";
    case "creator_owned":
      return "크리에이터";
    case "other":
      return "기타";
    default:
      return null;
  }
}

// 등급 칩 — me.tsx 와 동일 스타일. biz: 퍼플 / pb: 틸. 대문자, 11px, tracking 0.02em.
function TierChip({ tier }: { tier: "biz" | "pb" }) {
  const cls = tier === "biz" ? "bg-[#F0EDFB] text-[#4C3FA0]" : "bg-[#E1F5EE] text-[#0E4D42]";
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold tracking-[0.02em] ${cls}`}
    >
      {tier.toUpperCase()}
    </span>
  );
}

function ProfileRow({
  Icon,
  label,
  value,
  muted = false,
}: {
  Icon: typeof Tag;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="size-4 shrink-0 text-[#94A3B8]" strokeWidth={2} />
      <span className="w-9 shrink-0 text-xs font-medium text-[#94A3B8]">{label}</span>
      <span className={`truncate font-medium ${muted ? "text-[#94A3B8]" : "text-[#0F172A]"}`}>
        {value}
      </span>
    </div>
  );
}

export function StoreProfileCard({
  name,
  tier,
  businessTypeLabel,
  partnerKind,
  address,
  contactPhone,
  activeCoupons,
  slug,
  subscriberCount,
  note,
  headerAction,
  footer,
}: StoreProfileCardProps) {
  // S2b — 링크 복사 피드백(정적 라벨 전환, L7 — 토스트 미사용: 공유 컴포넌트에 toast 의존 미도입).
  const [linkCopied, setLinkCopied] = useState(false);
  const initial = name.trim().charAt(0) || "?";
  const industry = businessTypeLabel || partnerKindLabel(partnerKind);
  const visibleCoupons = activeCoupons.slice(0, 3);
  const extra = activeCoupons.length - visibleCoupons.length;
  const addr = address?.trim();

  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
      {/* 헤더 — 이니셜 아바타 + 이름 + 등급 칩 (+ 우측 액션) */}
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#E1F5EE] text-lg font-bold text-[#0E4D42]">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-base font-bold text-[#0F172A]">{name}</p>
            <TierChip tier={tier} />
          </div>
          {note ? <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">{note}</p> : null}
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>

      {/* 업종 · 지역 · 연락처 · (구독수: 소유자 전용) */}
      <div className="mt-4 space-y-2">
        <ProfileRow Icon={Tag} label="업종" value={industry || "미등록"} muted={!industry} />
        <ProfileRow Icon={MapPin} label="지역" value={addr || "위치 미등록"} muted={!addr} />
        {contactPhone?.trim() ? (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="size-4 shrink-0 text-[#0E4D42]" strokeWidth={2} />
            <span className="w-9 shrink-0 text-xs font-medium text-[#94A3B8]">연락처</span>
            <a
              href={`tel:${contactPhone.replace(/[^0-9+]/g, "")}`}
              className="truncate font-semibold text-[#0E4D42] hover:underline"
            >
              {contactPhone.trim()}
            </a>
          </div>
        ) : null}
        {subscriberCount != null ? (
          <ProfileRow Icon={Users} label="구독" value={`${subscriberCount.toLocaleString()}명`} />
        ) : null}
        {/* S2b — 매장 링크(drop.how/{slug}) + 소형 복사 버튼. 공개 화면 공용(로그인 분기 불요). */}
        {slug ? (
          <div className="flex items-center gap-2 text-sm">
            <Link2 className="size-4 shrink-0 text-[#94A3B8]" strokeWidth={2} />
            <span className="w-9 shrink-0 text-xs font-medium text-[#94A3B8]">링크</span>
            <span className="truncate font-semibold text-[#0A0A0A]">drop.how/{slug}</span>
            <button
              type="button"
              aria-label="매장 링크 복사"
              onClick={() => {
                void (async () => {
                  try {
                    await navigator.clipboard.writeText(`https://drop.how/${slug}`);
                    setLinkCopied(true);
                  } catch {
                    // 복사 실패 — 링크 텍스트가 보이므로 수동 복사 가능(추가 처리 없음).
                  }
                })();
              }}
              className="ml-auto flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F8FAFC]"
            >
              {linkCopied ? (
                <span className="text-[11px] font-bold text-[#15803D]">복사됨 ✓</span>
              ) : (
                <Copy className="size-4" strokeWidth={2} />
              )}
            </button>
          </div>
        ) : null}
      </div>

      {/* 진행 중 혜택 (활성 쿠폰) */}
      <div className="mt-4 border-t border-[#F1F5F9] pt-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Ticket className="size-4 text-[#0E4D42]" strokeWidth={2} />
          <h3 className="text-sm font-semibold text-[#0A0A0A]">진행 중 혜택</h3>
        </div>
        {activeCoupons.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">진행 중인 혜택 없음</p>
        ) : (
          <ul className="space-y-1.5">
            {visibleCoupons.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-[#0F172A]">
                  {c.title?.trim() || "쿠폰"}
                </span>
                {c.valid_until ? (
                  <span className="shrink-0 text-xs text-[#94A3B8]">
                    {formatDate(c.valid_until)}까지
                  </span>
                ) : null}
              </li>
            ))}
            {extra > 0 ? (
              <li className="text-xs font-medium text-[#64748B]">외 {extra}개</li>
            ) : null}
          </ul>
        )}
      </div>

      {footer ? <div className="mt-4">{footer}</div> : null}
    </section>
  );
}
