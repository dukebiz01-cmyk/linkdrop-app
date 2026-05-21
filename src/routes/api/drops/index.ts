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

          // 4. extract-meta
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
          const sourceId = meta.data.source_id;

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

          // 6. create_drop_v2 (트랜잭션 — info_drops + component_blocks + share_events)
          const { data: dropRes, error: dropErr } = await supabase.rpc("create_drop_v2", {
            p_intent_id: intentId,
            p_source_id: sourceId,
            p_blocks: body.blocks ?? [],
            p_curator_message: body.curator_message ?? null,
            p_campaign_id: body.campaign_id ?? null,
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
              title: meta.data.title,
              thumbnail_url: meta.data.thumbnail_url,
              author_name: meta.data.author_name,
            },
            ai: {
              summary: summary.data?.ai_summary ?? null,
              key_points: summary.data?.ai_key_points ?? [],
              product_detection_id: productDetectionId,
            },
            shareable_url: `${PROD_BASE}/d/${share_uuid}`,
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
