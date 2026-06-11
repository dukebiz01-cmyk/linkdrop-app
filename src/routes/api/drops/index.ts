// POST /api/drops — Drop 생성 풀 흐름 (Step 7 §1)
//
// 5단계 orchestration: extract-meta → intent 결정 → create_drop_v2 → generate-summary
//   → detect-product(구매 목적만). 로그인 필수.
//
// 명세 §1.5 코드를 실제 구현에 맞춰 작성 (A안):
//   - createFileRoute({ server: { handlers } }) — TanStack Start 실제 패턴
//   - getSupabaseServer() (명세의 supabaseServerClient 아님)
//   - create_drop_v2 / check_ai_quota — v3.1 실제 시그니처

import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/lib/supabase-server.server";
import { invokeEdge } from "@/lib/edge-invoke.server";

const PROD_BASE = "https://app.drop.how";

type CreateDropBody = {
  media_url?: string;
  purpose?: string;
  intent_key?: string;
  curator_message?: string;
  campaign_id?: string;
  blocks?: unknown[];
  /** chunk1 1d — 탐색에서 진입 시 본인 매장 자동 연결. RPC 시그니처 무수정,
   *  RPC 후 owner 매칭 검증 + info_drops.partner_id UPDATE. */
  partner_id?: string;
  /** Slice 1 커머스 — 구매 목적 시 상품 source 메타. 프론트 미전송이라 선택(null 허용). */
  price_krw?: number | null;
  category?: string | null;
};

export const Route = createFileRoute("/api/drops/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const supabase = getSupabaseServer();

          // 1. 인증
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            return Response.json(
              { error: "UNAUTHORIZED", message: "로그인이 필요해요." },
              { status: 401 },
            );
          }
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const jwt = session?.access_token ?? null;

          // 2. 입력
          const body = (await request.json()) as CreateDropBody;
          if (!body.media_url || !body.purpose) {
            return Response.json(
              { error: "INVALID_INPUT", message: "영상 링크와 목적은 필수예요." },
              { status: 400 },
            );
          }

          // 3. AI quota
          const { data: quota } = await supabase.rpc("check_ai_quota", {
            p_user_id: user.id,
          });
          if (!quota?.allowed) {
            return Response.json(
              {
                error: "QUOTA_EXCEEDED",
                message: "오늘 AI 사용 한도(50건)를 초과했어요. Pro 업그레이드 시 무제한이에요.",
                details: { quota },
              },
              { status: 429 },
            );
          }

          // 4. source 추출 — 목적별 분기 (Slice 1 Arch A).
          //    커머스(구매): extract-url-metadata 로 상품 URL OG → content_sources persist.
          //    그 외(영상): 기존 extract-meta(YouTube/IG oEmbed) 그대로.
          let sourceId: string;
          let sourceTitle: string | null = null;
          let sourceThumb: string | null = null;
          let sourceAuthor: string | null = null;
          if (body.purpose === "구매") {
            const meta = await invokeEdge<{
              source_id?: string;
              title?: string | null;
              thumbnailUrl?: string | null;
              authorName?: string | null;
            }>(
              "extract-url-metadata",
              {
                url: body.media_url,
                persist_source: true,
                price_krw: body.price_krw ?? null,
                category: body.category ?? null,
              },
              jwt,
            );
            if (meta.error || !meta.data?.source_id) {
              return Response.json(
                { error: "EXTRACT_META_FAILED", message: "상품 정보를 불러올 수 없어요.", details: meta.error },
                { status: 502 },
              );
            }
            sourceId = meta.data.source_id;
            sourceTitle = meta.data.title ?? null;
            sourceThumb = meta.data.thumbnailUrl ?? null;
            sourceAuthor = meta.data.authorName ?? null;
          } else {
            const meta = await invokeEdge<{
              source_id: string;
              title: string;
              thumbnail_url: string;
              author_name: string;
            }>("extract-meta", { url: body.media_url }, jwt);
            if (meta.error || !meta.data) {
              return Response.json(
                { error: "EXTRACT_META_FAILED", message: "영상 정보를 불러올 수 없어요.", details: meta.error },
                { status: 502 },
              );
            }
            sourceId = meta.data.source_id;
            sourceTitle = meta.data.title ?? null;
            sourceThumb = meta.data.thumbnail_url ?? null;
            sourceAuthor = meta.data.author_name ?? null;
          }

          // 5. intent_id 결정 (intent_key 우선, 없으면 purpose 기반)
          let intentId: string | undefined;
          if (body.intent_key) {
            const { data: it } = await supabase
              .from("intent_types")
              .select("id")
              .eq("key", body.intent_key)
              .maybeSingle();
            intentId = it?.id;
          } else {
            const { data: its } = await supabase
              .from("intent_types")
              .select("id")
              .eq("purpose", body.purpose)
              .limit(1);
            intentId = its?.[0]?.id;
          }
          if (!intentId) {
            return Response.json(
              { error: "INVALID_PURPOSE", message: "유효하지 않은 목적이에요." },
              { status: 400 },
            );
          }

          // 6. share_code 생성 (drop.how/{6자} 단축 URL용)
          //    실패해도 throw X — fallback 긴 URL 유지로 UX 차단 방지.
          const { data: shareCodeData, error: shareCodeErr } = await supabase.rpc(
            "gen_share_code",
          );
          if (shareCodeErr) {
            console.error("gen_share_code failed:", shareCodeErr);
          }
          const shareCode = typeof shareCodeData === "string" ? shareCodeData : null;

          // 7. create_drop_v2 (트랜잭션 — info_drops + component_blocks + share_events)
          const { data: dropRes, error: dropErr } = await supabase.rpc("create_drop_v2", {
            p_intent_id: intentId,
            p_source_id: sourceId,
            p_blocks: body.blocks ?? [],
            p_curator_message: body.curator_message ?? null,
            p_campaign_id: body.campaign_id ?? null,
            p_share_code: shareCode,
          });
          if (dropErr || !dropRes) {
            return Response.json(
              { error: "DROP_CREATE_FAILED", message: "Drop 생성에 실패했어요.", details: dropErr },
              { status: 500 },
            );
          }
          const { info_drop_id, share_uuid } = dropRes as {
            info_drop_id: string;
            share_uuid: string;
          };

          // chunk1 1d — partner_id 연결 (탐색 진입 시). owner 본인 매장만 허용,
          //   다른 매장 id 무시. RLS info_drops UPDATE policy = owner_user_id=auth.uid().
          if (body.partner_id) {
            const { data: partnerOwn } = await supabase
              .from("partners")
              .select("id")
              .eq("id", body.partner_id)
              .eq("owner_user_id", user.id)
              .maybeSingle();
            if (partnerOwn) {
              await supabase
                .from("info_drops")
                .update({ partner_id: body.partner_id })
                .eq("id", info_drop_id);
            }
          }

          // 7. generate-summary (동기 — 결과를 응답에 포함)
          const summary = await invokeEdge<{ ai_summary: string; ai_key_points: string[] }>(
            "generate-summary",
            { source_id: sourceId, purpose: body.purpose, user_id: user.id, drop_id: info_drop_id },
            jwt,
          );

          // 8. detect-product (구매 목적만)
          let productDetectionId: string | undefined;
          if (body.purpose === "구매") {
            const prod = await invokeEdge<{ detection_id?: string }>(
              "detect-product",
              { source_id: sourceId, drop_id: info_drop_id, user_id: user.id },
              jwt,
            );
            productDetectionId = prod.data?.detection_id;
          }

          // 9. 응답
          return Response.json({
            drop: {
              id: info_drop_id,
              share_uuid,
              purpose: body.purpose,
              intent_id: intentId,
              source_id: sourceId,
            },
            source: {
              id: sourceId,
              title: sourceTitle,
              thumbnail_url: sourceThumb,
              author_name: sourceAuthor,
            },
            ai: {
              summary: summary.data?.ai_summary ?? null,
              key_points: summary.data?.ai_key_points ?? [],
              product_detection_id: productDetectionId,
            },
            shareable_url: shareCode
              ? `https://drop.how/${shareCode}`
              : `${PROD_BASE}/d/${share_uuid}`,
          });
        } catch (e) {
          return Response.json(
            {
              error: "INTERNAL_ERROR",
              message: "서버 오류가 발생했어요.",
              details: e instanceof Error ? e.message : String(e),
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
