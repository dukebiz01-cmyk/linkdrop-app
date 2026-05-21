// v3 RPC 타입 안전 래퍼.
//
// getSupabase()는 Database 제네릭이 없는 SupabaseClient라 .rpc() 자체는 untyped다.
// 이 모듈의 래퍼들이 명시적 Args/Returns 타입 경계를 제공한다 — 호출부는 항상
// 여기를 거치므로 RPC 이름 오타·인자 누락이 컴파일 타임에 잡힌다.
//
// 에러 패턴: Supabase 표준 { data, error } 에서 error 가 있으면 throw.
// 호출부는 friendlyErrors(ErrorMessage.tsx)로 감싸 사용자 메시지를 만든다.

import { getSupabase } from "@/lib/supabase";
import type { CreateDropResult, DropDetail, DropResults, AiQuota } from "@/lib/types";

/**
 * 영상 → Drop 생성을 단일 트랜잭션으로 수행한다.
 * info_drops + component_blocks + share_events 를 원자적으로 INSERT —
 * 기존 create.tsx 의 분리 INSERT 가 가진 부분 실패 문제를 제거한다.
 */
export async function createDropV2(args: {
  intentId: string;
  sourceId: string;
  blocks?: unknown[];
  curatorMessage?: string | null;
  campaignId?: string | null;
}): Promise<CreateDropResult> {
  const { data, error } = await getSupabase().rpc("create_drop_v2", {
    p_intent_id: args.intentId,
    p_source_id: args.sourceId,
    p_blocks: args.blocks ?? [],
    p_curator_message: args.curatorMessage ?? null,
    p_campaign_id: args.campaignId ?? null,
  });
  if (error) throw error;
  return data as CreateDropResult;
}

/**
 * 받은 사람 화면(무로그인)의 일괄 데이터를 가져온다.
 * drop + intent + source + ctas + blocks + products 를 한 번에 반환하고,
 * 호출 시 해당 share 의 조회수(click_count)를 +1 한다 (v3.2 통합).
 * share_uuid 가 없으면 null.
 */
export async function getDropDetail(shareUuid: string): Promise<DropDetail | null> {
  const { data, error } = await getSupabase().rpc("get_drop_detail", {
    p_share_uuid: shareUuid,
  });
  if (error) throw error;
  return (data as DropDetail | null) ?? null;
}

/**
 * Drop 결과 집계를 가져온다 — share_events 카운터 + info_drops 카운터
 * + lifecycle_events 이벤트 타입별 카운트. (로그인한 공유자용)
 */
export async function getDropResults(shareUuid: string): Promise<DropResults | null> {
  const { data, error } = await getSupabase().rpc("get_drop_results", {
    p_share_uuid: shareUuid,
  });
  if (error) throw error;
  return (data as DropResults | null) ?? null;
}

/**
 * 무로그인 상담 신청을 접수한다.
 * 서버에서 phone_hash(SHA256) 계산 + partner 보완(campaign 경유)
 * + consent_records 기록까지 원자적으로 처리한다. 신규 lead id 반환.
 */
export async function submitConsultationLead(args: {
  dropId: string | null;
  leadType: string;
  name: string;
  phone: string;
  privacyAgreed: boolean;
  message?: string | null;
  desiredDate?: string | null;
  desiredTime?: string | null;
  adults?: number | null;
  children?: number | null;
  budgetRange?: string | null;
  partnerId?: string | null;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc("submit_consultation_lead", {
    p_drop_id: args.dropId,
    p_lead_type: args.leadType,
    p_name: args.name,
    p_phone: args.phone,
    p_privacy_agreed: args.privacyAgreed,
    p_message: args.message ?? null,
    p_desired_date: args.desiredDate ?? null,
    p_desired_time: args.desiredTime ?? null,
    p_adults: args.adults ?? null,
    p_children: args.children ?? null,
    p_budget_range: args.budgetRange ?? null,
    p_partner_id: args.partnerId ?? null,
  });
  if (error) throw error;
  return data as string;
}

/**
 * 무로그인 방문자를 upsert 한다. anonymous_id 충돌 시 last_seen_at 갱신
 * + metadata 병합. visitor id 반환.
 */
export async function upsertVisitor(
  anonymousId: string,
  metadata?: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await getSupabase().rpc("upsert_visitor", {
    p_anonymous_id: anonymousId,
    p_metadata: metadata ?? {},
  });
  if (error) throw error;
  return data as string;
}

/**
 * Drop 관련 이벤트를 기록한다 (reservation_click 등).
 * 무로그인은 anonymousId → visitors → lifecycle_events.visitor_id 로 연결,
 * 로그인 사용자는 서버에서 auth.uid() 로 식별한다. event id 반환.
 */
export async function trackDropEvent(args: {
  eventType: string;
  infoDropId?: string | null;
  anonymousId?: string | null;
  context?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc("track_drop_event", {
    p_event_type: args.eventType,
    p_info_drop_id: args.infoDropId ?? null,
    p_anonymous_id: args.anonymousId ?? null,
    p_context: args.context ?? {},
  });
  if (error) throw error;
  return data as string;
}

/**
 * 현재 사용자의 일일 AI 사용량 quota 를 체크한다.
 * period 가 지났으면 서버에서 used_count 를 리셋한다. (순수 체크 — 증가는 서버 RPC)
 * userId 생략 시 서버가 auth.uid() 로 식별.
 */
export async function checkAiQuota(userId?: string): Promise<AiQuota> {
  const { data, error } = await getSupabase().rpc("check_ai_quota", {
    p_user_id: userId ?? null,
  });
  if (error) throw error;
  return data as AiQuota;
}

/**
 * AI 생성 호출 이력을 기록한다 (Edge Function 용).
 * status='success' 이고 userId 가 있으면 ai_usage_quotas 사용량이 +1 된다.
 * generation id 반환.
 */
export async function recordAiGeneration(args: {
  generationType: string;
  userId?: string | null;
  dropId?: string | null;
  sourceId?: string | null;
  model?: string | null;
  prompt?: string | null;
  response?: unknown;
  tokensUsed?: number | null;
  costKrw?: number | null;
  status?: "success" | "error" | "pending";
  errorMessage?: string | null;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc("record_ai_generation", {
    p_generation_type: args.generationType,
    p_user_id: args.userId ?? null,
    p_drop_id: args.dropId ?? null,
    p_source_id: args.sourceId ?? null,
    p_model: args.model ?? null,
    p_prompt: args.prompt ?? null,
    p_response: args.response ?? null,
    p_tokens_used: args.tokensUsed ?? null,
    p_cost_krw: args.costKrw ?? null,
    p_status: args.status ?? "success",
    p_error_message: args.errorMessage ?? null,
  });
  if (error) throw error;
  return data as string;
}
