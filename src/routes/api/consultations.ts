// POST /api/consultations — 상담 신청 (Step 7 §4)
//
// 무로그인 + phone. submit_consultation_lead RPC.
// 명세 입력은 8필드였으나 v3.1 실제 RPC는 12인자 — lead_type / privacy_agreed 가
// 필수다(명세 누락분). 이 Route 는 실제 RPC 시그니처를 따른다 (A안).

import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/lib/supabase-server.server";

type ConsultationBody = {
  drop_id?: string;
  lead_type?: string;
  name?: string;
  phone?: string;
  privacy_agreed?: boolean;
  message?: string;
  desired_date?: string;
  desired_time?: string;
  adults?: number;
  children?: number;
  budget_range?: string;
  partner_id?: string;
};

const PHONE_RE = /^01[0-9][\s-]?\d{3,4}[\s-]?\d{4}$/;

export const Route = createFileRoute("/api/consultations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as ConsultationBody;

          if (!body.drop_id || !body.lead_type || !body.name || !body.phone) {
            return Response.json(
              { error: "INVALID_INPUT", message: "필수 정보를 입력해 주세요." },
              { status: 400 },
            );
          }
          if (body.privacy_agreed !== true) {
            return Response.json(
              { error: "PRIVACY_REQUIRED", message: "개인정보 수집 동의가 필요해요." },
              { status: 400 },
            );
          }
          if (!PHONE_RE.test(String(body.phone).replace(/\s/g, ""))) {
            return Response.json(
              { error: "INVALID_PHONE", message: "휴대폰 번호 형식이 올바르지 않아요." },
              { status: 400 },
            );
          }

          const supabase = getSupabaseServer();
          const { data, error } = await supabase.rpc("submit_consultation_lead", {
            p_drop_id: body.drop_id,
            p_lead_type: body.lead_type,
            p_name: body.name,
            p_phone: body.phone,
            p_privacy_agreed: true,
            p_message: body.message ?? null,
            p_desired_date: body.desired_date ?? null,
            p_desired_time: body.desired_time ?? null,
            p_adults: body.adults ?? null,
            p_children: body.children ?? null,
            p_budget_range: body.budget_range ?? null,
            p_partner_id: body.partner_id ?? null,
          });

          if (error) {
            return Response.json(
              {
                error: "CONSULTATION_FAILED",
                message: "상담 신청에 실패했어요. 다시 시도해 주세요.",
                details: error.message,
              },
              { status: 500 },
            );
          }

          return Response.json({
            consultation_id: data,
            message: "상담 신청이 접수됐어요. 곧 연락드릴게요.",
          });
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
