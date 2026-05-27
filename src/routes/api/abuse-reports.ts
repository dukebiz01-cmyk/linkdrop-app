// POST /api/abuse-reports — 신고 접수 (anon + auth)
//
// Cloudflare CF-Connecting-IP → SHA-256 → reporter_ip_hash.
// v4.0.1 트리거가 24h 윈도우 중복 거부 → 'duplicate_report_within_24h' 에러 catch.

import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/lib/supabase-server.server";

type Body = {
  drop_id?: string;
  reason?: string;
  description?: string;
};

const VALID_REASONS = new Set([
  "fake_store",
  "inappropriate",
  "spam",
  "fraud",
  "copyright",
  "other",
]);

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const Route = createFileRoute("/api/abuse-reports")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          if (!body.drop_id || !body.reason || !VALID_REASONS.has(body.reason)) {
            return Response.json(
              { success: false, error: "invalid_input" },
              { status: 400 },
            );
          }

          // Cloudflare 표준 헤더 우선, 폴백으로 x-forwarded-for 첫 토큰.
          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            null;
          const ipHash = ip ? await sha256Hex(ip) : null;

          const supabase = getSupabaseServer();
          const { data, error } = await supabase
            .from("abuse_reports")
            .insert({
              drop_id: body.drop_id,
              reason: body.reason,
              description: body.description?.trim() ? body.description.trim() : null,
              reporter_ip_hash: ipHash,
            })
            .select("id")
            .single();

          if (error) {
            // v4.0.1 트리거가 RAISE EXCEPTION 'duplicate_report_within_24h'.
            if (error.message?.includes("duplicate_report_within_24h")) {
              return Response.json({ success: false, error: "duplicate" });
            }
            console.warn("[/api/abuse-reports] insert failed:", error.message);
            return Response.json(
              { success: false, error: "unknown" },
              { status: 500 },
            );
          }

          return Response.json({ success: true, report_id: data.id });
        } catch (e) {
          console.warn("[/api/abuse-reports] catch:", e);
          return Response.json(
            { success: false, error: "unknown" },
            { status: 500 },
          );
        }
      },
    },
  },
});
