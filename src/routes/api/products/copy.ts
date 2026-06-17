// /api/products/copy — 나-1 상품 카피(headline/selling_points) 편집 저장.
//
//   GET  ?drop_id=  → 소유자 확인 후 상품 정보 + 현재 카피(메인 product 블록 block_data) 반환(프리필).
//   POST { drop_id, headline, selling_points } → 소유자 확인 후 메인 product 블록 block_data 머지 UPDATE.
//
// 별도 RPC 없이 서버 라우트에서 처리(DDL 0). supabaseAdmin(서비스롤)으로 읽기/쓰기하되
//   반드시 info_drops.owner_user_id === 로그인 user.id 확인(타인 상품 수정 차단).
// 메인 product 블록 = block_kind='product' && block_data.ref_drop_id 없음(self 상품 블록).

import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/lib/supabase-server.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

type ProductBlockRow = {
  id: string;
  block_data: Record<string, unknown> | null;
};

type ResolveResult =
  | { ok: false; response: Response }
  | { ok: true; drop: { id: string; source_id: string | null }; block: ProductBlockRow | null };

// 소유자 확인 + 메인 product 블록 조회. 실패 시 ok:false + Response, 성공 시 drop/block.
async function resolveOwnedMainBlock(dropId: string, userId: string): Promise<ResolveResult> {
  const { data: drop } = await supabaseAdmin
    .from("info_drops")
    .select("id, owner_user_id, source_id")
    .eq("id", dropId)
    .maybeSingle();
  if (!drop) {
    return {
      ok: false,
      response: Response.json(
        { error: "NOT_FOUND", message: "상품을 찾을 수 없어요." },
        { status: 404 },
      ),
    };
  }
  if ((drop as { owner_user_id?: string }).owner_user_id !== userId) {
    return {
      ok: false,
      response: Response.json(
        { error: "FORBIDDEN", message: "본인 상품만 수정할 수 있어요." },
        { status: 403 },
      ),
    };
  }
  const { data: blocks } = await supabaseAdmin
    .from("component_blocks")
    .select("id, block_data")
    .eq("info_drop_id", dropId)
    .eq("block_kind", "product")
    .order("position", { ascending: true });
  const list = (blocks ?? []) as ProductBlockRow[];
  // self(메인) 상품 블록 = ref_drop_id 없는 것. 없으면 첫 product 블록.
  const main = list.find((b) => !(b.block_data ?? {}).ref_drop_id) ?? list[0] ?? null;
  return {
    ok: true,
    drop: drop as { id: string; source_id: string | null },
    block: main,
  };
}

function cleanPoints(v: unknown): string[] {
  return Array.isArray(v)
    ? v
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, 5)
    : [];
}

export const Route = createFileRoute("/api/products/copy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const dropId = url.searchParams.get("drop_id");
          if (!dropId) {
            return Response.json(
              { error: "INVALID_INPUT", message: "drop_id가 필요해요." },
              { status: 400 },
            );
          }
          const supabase = getSupabaseServer();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            return Response.json(
              { error: "UNAUTHORIZED", message: "로그인이 필요해요." },
              { status: 401 },
            );
          }
          const resolved = await resolveOwnedMainBlock(dropId, user.id);
          if (!resolved.ok) return resolved.response;

          // 상품 표시 정보(이름·가격·이미지) = content_sources.
          let name: string | null = null;
          let priceKrw: number | null = null;
          let imageUrl: string | null = null;
          if (resolved.drop.source_id) {
            const { data: src } = await supabaseAdmin
              .from("content_sources")
              .select("title, price_krw, thumbnail_url")
              .eq("id", resolved.drop.source_id)
              .maybeSingle();
            const s = src as {
              title?: string | null;
              price_krw?: number | null;
              thumbnail_url?: string | null;
            } | null;
            name = s?.title ?? null;
            priceKrw = typeof s?.price_krw === "number" ? s.price_krw : null;
            imageUrl = s?.thumbnail_url ?? null;
          }
          const bd = (resolved.block?.block_data ?? {}) as Record<string, unknown>;
          return Response.json({
            name,
            price_krw: priceKrw,
            image_url: imageUrl,
            headline: typeof bd.headline === "string" ? bd.headline : "",
            selling_points: cleanPoints(bd.selling_points),
          });
        } catch {
          return Response.json(
            { error: "INTERNAL_ERROR", message: "서버 오류가 발생했어요." },
            { status: 500 },
          );
        }
      },
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            drop_id?: string;
            headline?: string;
            selling_points?: string[];
          };
          if (!body.drop_id) {
            return Response.json(
              { error: "INVALID_INPUT", message: "drop_id가 필요해요." },
              { status: 400 },
            );
          }
          const supabase = getSupabaseServer();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            return Response.json(
              { error: "UNAUTHORIZED", message: "로그인이 필요해요." },
              { status: 401 },
            );
          }
          const resolved = await resolveOwnedMainBlock(body.drop_id, user.id);
          if (!resolved.ok) return resolved.response;
          if (!resolved.block) {
            return Response.json(
              { error: "NO_PRODUCT_BLOCK", message: "상품 블록을 찾지 못했어요." },
              { status: 404 },
            );
          }

          const headline = (body.headline ?? "").trim();
          const points = cleanPoints(body.selling_points);
          // block_data 머지 — 카피 키만 갱신(name/price_krw 등 기존 키 보존). 빈 값은 키 제거.
          const merged: Record<string, unknown> = { ...(resolved.block.block_data ?? {}) };
          if (headline) merged.headline = headline;
          else delete merged.headline;
          if (points.length > 0) merged.selling_points = points;
          else delete merged.selling_points;

          const { error: upErr } = await supabaseAdmin
            .from("component_blocks")
            .update({ block_data: merged as unknown as Json })
            .eq("id", resolved.block.id);
          if (upErr) {
            return Response.json(
              { error: "UPDATE_FAILED", message: "저장하지 못했어요.", details: upErr.message },
              { status: 500 },
            );
          }
          return Response.json({ ok: true, headline, selling_points: points });
        } catch {
          return Response.json(
            { error: "INTERNAL_ERROR", message: "서버 오류가 발생했어요." },
            { status: 500 },
          );
        }
      },
    },
  },
});
