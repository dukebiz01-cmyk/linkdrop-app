// v3 앱 레벨 타입 — gen types(src/integrations/supabase/types.ts) 위의 편의 레이어.
//
// gen types 의 Database 타입은 RPC 의 jsonb RETURNS 를 느슨한 Json 으로만 표현한다.
// 받은사람 화면·결과집계 등은 구조가 고정돼 있으므로, 여기서 구체 타입을 정의해
// src/lib/db.ts 래퍼가 명시적 반환 타입을 제공하도록 한다.

import type { Database } from "@/integrations/supabase/types";

type DB = Database["public"];

/** 테이블 Row 단축 — Tables<"drop_ctas"> 형태로 사용. */
export type Tables<T extends keyof DB["Tables"]> = DB["Tables"][T]["Row"];
/** Enum 단축. */
export type Enums<T extends keyof DB["Enums"]> = DB["Enums"][T];

// ── 5 목적 (UX) ──────────────────────────────────────────────
export type DropPurpose = Enums<"drop_purpose">;

// ── v3 신규 테이블 Row alias ─────────────────────────────────
export type DropCta = Tables<"drop_ctas">;
export type ProductDetection = Tables<"product_detections">;
export type ProductOffer = Tables<"product_offers">;
export type ConsultationLead = Tables<"consultation_leads">;
export type Visitor = Tables<"visitors">;
export type AiGeneration = Tables<"ai_generations">;
export type ConsentRecord = Tables<"consent_records">;
export type AuditLog = Tables<"audit_logs">;
export type AiUsageQuota = Tables<"ai_usage_quotas">;

// ── RPC 입출력 구체 타입 ─────────────────────────────────────
// gen types 가 jsonb RETURNS 를 Json 으로만 주므로 여기서 고정 구조를 정의.

/** create_drop_v2 반환. */
export type CreateDropResult = {
  info_drop_id: string;
  share_uuid: string;
};

/** get_drop_detail 의 한 CTA 항목. */
export type DropDetailCta = {
  cta_type: string;
  label: string;
  url: string | null;
  is_primary: boolean;
  sort_order: number;
};

/** get_drop_detail 의 한 블록 항목. */
export type DropDetailBlock = {
  block_kind: string;
  block_data: unknown;
  block_config: unknown;
  position: number;
  video_start_seconds: number | null;
  video_end_seconds: number | null;
};

/** get_drop_detail 의 한 상품 셀러(offer) 항목. */
export type DropDetailOffer = {
  seller_name: string;
  seller_country: string;
  platform: string | null;
  product_url: string | null;
  price: number | null;
  currency: string;
  estimated_total_price: number | null;
};

/** get_drop_detail 의 한 상품 항목. */
export type DropDetailProduct = {
  id: string;
  product_name_guess: string | null;
  brand_guess: string | null;
  confidence: string;
  offers: DropDetailOffer[];
};

/** get_drop_detail 반환 — 받은 사람 화면 일괄 데이터. share_uuid 미존재 시 null. */
export type DropDetail = {
  share_uuid: string;
  curator_message: string | null;
  created_at: string | null;
  drop: {
    id: string;
    purpose: DropPurpose | null;
    ai_summary: string | null;
    ai_key_points: unknown;
    reservation_data: unknown;
  };
  intent: {
    key: string | null;
    name: string | null;
    purpose: DropPurpose | null;
  };
  source: {
    title: string | null;
    thumbnail_url: string | null;
    source_url: string | null;
    author_name: string | null;
    provider: string | null;
    duration_sec: number | null;
  };
  ctas: DropDetailCta[];
  blocks: DropDetailBlock[];
  products: DropDetailProduct[];
};

/** get_drop_results 반환 — 결과 집계. */
export type DropResults = {
  share_uuid: string;
  click_count: number;
  unique_clicker_count: number;
  conversion_count: number;
  drop: {
    id: string;
    view_count: number;
    share_count: number;
    conversion_count: number;
  };
  events: Record<string, number>;
};

/** check_ai_quota 반환. */
export type AiQuota = {
  allowed: boolean;
  used: number;
  daily_limit: number;
  remaining: number;
};
