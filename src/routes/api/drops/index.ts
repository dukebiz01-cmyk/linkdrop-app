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
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
  /** S2b 자체업로드 — true 면 외부 스크랩 대신 직접 INSERT 경로. image_url/name/price_krw 사용. */
  self_upload?: boolean;
  image_url?: string;
  name?: string;
  /** 나-1 상품 카피 — 메인 product 블록 block_data 에 머지(headline/selling_points). 자체업로드 전용. */
  headline?: string;
  selling_points?: string[];
  /** 신선 원물(농가 선주문) — 메인 product 블록 block_data 에 머지. 자체업로드 전용, ADDITIVE.
   *  is_fresh=false(가공) 면 나머지 신선 키 생략. 마이그 0(jsonb 키만 추가). */
  is_fresh?: boolean;
  harvest_date?: string | null;
  stock_limit?: number | null;
  price_band_enabled?: boolean;
  /** KAMIS 품목코드 — 신선 시세·제철 연동용. 선택값(미지정 가능). is_fresh 일 때만 머지. */
  kamis_item_code?: string;
  /** 공개/비공개 — true 면 탐색 피드 노출, false(기본) 면 받은 사람만 링크 열람. */
  is_public?: boolean;
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

          // 2b. S2b 자체업로드(자체상품) 분기 — 외부 스크랩 경로와 완전 분리.
          //   extract-url-metadata / AI quota / generate-summary 미사용. content_sources
          //   직접 INSERT(서비스롤) → 구매 intent → product 블록 포함 create_drop_v2.
          //   ⚠️ 아래 기존 구매(외부 URL 스크랩) 흐름은 일절 건드리지 않는다.
          if (body.self_upload) {
            const imageUrl = (body.image_url ?? "").trim();
            const priceKrw =
              typeof body.price_krw === "number" ? body.price_krw : Number(body.price_krw);
            if (!imageUrl || !Number.isFinite(priceKrw) || priceKrw <= 0) {
              return Response.json(
                { error: "INVALID_INPUT", message: "상품 사진과 가격은 필수예요." },
                { status: 400 },
              );
            }
            const productName = (body.name ?? "").trim() || null;

            // (1) content_sources 직접 INSERT — 서비스롤(RLS 우회). source_url=canonical_url=
            //   합성 고유 URL(app.drop.how/p/{uuid}): NOT NULL 충족 + (provider,canonical_url)
            //   유니크 회피 + self-upload 카드 식별자(prefix). 실제 구매링크 아님.
            const syntheticUrl = `${PROD_BASE}/p/${crypto.randomUUID()}`;
            const { data: srcRow, error: srcErr } = await supabaseAdmin
              .from("content_sources")
              .insert({
                provider: "manual",
                source_mode: "creator_registered",
                source_url: syntheticUrl,
                canonical_url: syntheticUrl,
                title: productName,
                thumbnail_url: imageUrl,
                price_krw: priceKrw,
                price_currency: "KRW",
                registered_by_user_id: user.id,
                extraction_method: "manual",
              })
              .select("id")
              .single();
            if (srcErr || !srcRow) {
              return Response.json(
                {
                  error: "SOURCE_CREATE_FAILED",
                  message: "상품을 저장하지 못했어요.",
                  details: srcErr,
                },
                { status: 500 },
              );
            }
            const selfSourceId = (srcRow as { id: string }).id;

            // (2) intent_id = 구매 목적
            const { data: buyIntents } = await supabase
              .from("intent_types")
              .select("id")
              .eq("purpose", "구매")
              .limit(1);
            const selfIntentId = buyIntents?.[0]?.id;
            if (!selfIntentId) {
              return Response.json(
                { error: "INVALID_PURPOSE", message: "구매 목적 설정을 찾을 수 없어요." },
                { status: 400 },
              );
            }

            // (3) share_code (실패해도 fallback 긴 URL)
            const { data: selfShareCodeData } = await supabase.rpc("gen_share_code");
            const selfShareCode = typeof selfShareCodeData === "string" ? selfShareCodeData : null;

            // (4) create_drop_v2 — 가격/이름은 product 블록으로 운반(프론트가 blocks 포함).
            //   비사업자 게이트(v7.4): approved partner 없으면 '구매' 거부 — 이 경로는
            //   /partner/products/new(_partner 가드=approved owner) 뒤라 통과.
            //   partner_id 는 RPC 본문이 owner→approved partner 로 자동 매핑(store.phone 연결).
            const selfBlocks =
              Array.isArray(body.blocks) && body.blocks.length > 0
                ? body.blocks
                : [
                    {
                      block_kind: "product",
                      block_data: { name: productName ?? "", price_krw: priceKrw },
                      position: 0,
                    },
                  ];
            // 나-1 — 카피(headline/selling_points)를 메인 product 블록(self, ref_drop_id 없음)
            //   block_data 에 머지. 카피 없으면 키 생략(회귀 0). selling_points = jsonb 배열.
            const selfHeadline = (body.headline ?? "").trim();
            const selfPoints = Array.isArray(body.selling_points)
              ? body.selling_points
                  .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
                  .map((s) => s.trim())
                  .slice(0, 5)
              : [];
            if (selfHeadline || selfPoints.length > 0) {
              const arr = selfBlocks as Array<{
                block_kind?: string;
                block_data?: Record<string, unknown>;
              }>;
              const target =
                arr.find((b) => b?.block_kind === "product" && !b.block_data?.ref_drop_id) ??
                arr[0];
              if (target) {
                target.block_data = {
                  ...(target.block_data ?? {}),
                  ...(selfHeadline ? { headline: selfHeadline } : {}),
                  ...(selfPoints.length > 0 ? { selling_points: selfPoints } : {}),
                };
              }
            }
            // 신선 원물(농가 선주문) — 메인 product 블록 block_data 에 신선 키 머지(ADDITIVE).
            //   카피 머지(위)와 독립 — 카피 없이 신선 속성만 있어도 반영. 기존 키 무수정.
            //   is_fresh 는 항상 기록(true=신선/false=가공). 가공이면 나머지 신선 키 생략.
            //   신선이면 harvest_date/stock_limit(있을 때만) + price_band_enabled(플래그) 추가.
            const selfIsFresh = body.is_fresh === true; // 명시적 true 만 신선. 미지정/false = 일반(스크랩·가공 포함).
            const selfHarvestDate =
              typeof body.harvest_date === "string" && body.harvest_date.trim()
                ? body.harvest_date.trim()
                : null;
            const selfStockLimit =
              typeof body.stock_limit === "number" &&
              Number.isFinite(body.stock_limit) &&
              body.stock_limit > 0
                ? Math.floor(body.stock_limit)
                : null;
            const selfPriceBandEnabled = body.price_band_enabled === true;
            const selfKamisItemCode =
              typeof body.kamis_item_code === "string" && body.kamis_item_code.trim()
                ? body.kamis_item_code.trim()
                : null;
            {
              const arr = selfBlocks as Array<{
                block_kind?: string;
                block_data?: Record<string, unknown>;
              }>;
              const target =
                arr.find((b) => b?.block_kind === "product" && !b.block_data?.ref_drop_id) ??
                arr[0];
              if (target) {
                target.block_data = {
                  ...(target.block_data ?? {}),
                  is_fresh: selfIsFresh,
                  ...(selfIsFresh && selfHarvestDate ? { harvest_date: selfHarvestDate } : {}),
                  ...(selfIsFresh && selfStockLimit != null ? { stock_limit: selfStockLimit } : {}),
                  ...(selfIsFresh ? { price_band_enabled: selfPriceBandEnabled } : {}),
                  ...(selfIsFresh && selfKamisItemCode ? { kamis_item_code: selfKamisItemCode } : {}),
                };
              }
            }
            const { data: selfDropRes, error: selfDropErr } = await supabase.rpc("create_drop_v2", {
              p_intent_id: selfIntentId,
              p_source_id: selfSourceId,
              p_blocks: selfBlocks,
              p_curator_message: body.curator_message ?? null,
              p_campaign_id: body.campaign_id ?? null,
              p_share_code: selfShareCode,
              p_is_public: body.is_public ?? false,
            });
            if (selfDropErr || !selfDropRes) {
              return Response.json(
                {
                  error: "DROP_CREATE_FAILED",
                  message: "상품 카드를 만들지 못했어요.",
                  details: selfDropErr,
                },
                { status: 500 },
              );
            }
            const { info_drop_id: selfDropId, share_uuid: selfShareUuid } = selfDropRes as {
              info_drop_id: string;
              share_uuid: string;
            };

            return Response.json({
              drop: {
                id: selfDropId,
                share_uuid: selfShareUuid,
                purpose: "구매",
                intent_id: selfIntentId,
                source_id: selfSourceId,
              },
              source: {
                id: selfSourceId,
                title: productName,
                thumbnail_url: imageUrl,
                author_name: null,
              },
              shareable_url: selfShareCode
                ? `https://drop.how/${selfShareCode}`
                : `${PROD_BASE}/d/${selfShareUuid}`,
            });
          }

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
                {
                  error: "EXTRACT_META_FAILED",
                  message: "상품 정보를 불러올 수 없어요.",
                  details: meta.error,
                },
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
                {
                  error: "EXTRACT_META_FAILED",
                  message: "영상 정보를 불러올 수 없어요.",
                  details: meta.error,
                },
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
          const { data: shareCodeData, error: shareCodeErr } = await supabase.rpc("gen_share_code");
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
            p_is_public: body.is_public ?? false,
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

          // 커머스: detect-product 비활성 — 가짜 오퍼 방지, KAMIS 시세로 Slice 2 대체.
          //   (구매 드롭은 상품 URL 소스가 진실원천 — AI 상품탐지/가격비교 미사용.)
          //   정보/쿠폰/예약은 원래 detect-product 미실행이라 영향 없음.
          const productDetectionId: string | undefined = undefined;

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
