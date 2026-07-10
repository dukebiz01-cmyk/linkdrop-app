// PG(헥토) 심사용 테스트 계정 2개 생성 + 비즈니스 권한(승인 파트너) 부여 — 멱등.
//
// 하는 일(계정당):
//   1. auth.users 에 이메일 확인 완료(email_confirm:true) 계정 생성 — 이미 있으면 스킵 보고.
//   2. 심사용 데모 파트너("링크드롭 심사용 데모매장 N", verification_status='approved') 신설
//      후 계정을 오너로 연결 — 오너의 파트너가 이미 있으면 스킵 보고.
//      ⚠️ partners.owner_user_id 는 단일 오너 구조라 계정당 데모 파트너 1행(총 2행).
//      ⚠️ 파일럿 매장(노을하우스·소소떡볶이·모래재·리리팜)에는 절대 연결하지 않는다(오염 방지).
//   3. 검증: is_active_partner_owner(_user_id) RPC = true + 이메일/비번 signInWithPassword 성공.
//
// 사용: bun run scripts/create-review-accounts.ts
// 키: .env.local 의 SUPABASE_URL / SUPABASE_SECRET_KEY(admin) / SUPABASE_PUBLISHABLE_KEY(로그인 검증).
//     비밀번호는 stdout 에 출력하지 않는다(계정 스펙 문서 소관).

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ACCOUNTS: Array<{ email: string; password: string; partnerName: string }> = [
  { email: "test01@drop.how", password: "linkdrop01!", partnerName: "링크드롭 심사용 데모매장 1" },
  { email: "test02@drop.how", password: "linkdrop02!", partnerName: "링크드롭 심사용 데모매장 2" },
];

const repoRoot = resolve(import.meta.dirname, "..");
const envPath = resolve(repoRoot, ".env.local");
if (!existsSync(envPath)) {
  console.error(".env.local not found at " + envPath);
  process.exit(2);
}

// BOM 제거 필수 — .env.local 이 BOM 포함(CLAUDE.md 박제)이라 첫 키가 ﻿VITE_... 로 깨진다.
const envText = readFileSync(envPath, "utf8").replace(/^﻿/, "");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY;
const publishable = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !secret || !publishable) {
  console.error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY / SUPABASE_PUBLISHABLE_KEY in .env.local");
  process.exit(2);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Report = {
  email: string;
  user_id: string;
  user: "created" | "existed";
  partner_id: string;
  partner: "created" | "existed";
  partner_name: string;
  is_active_partner_owner: boolean;
  password_login: "ok" | "failed";
};

async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  // admin.listUsers 는 email 필터가 없어 페이지 순회(계정 수 적은 프로젝트 전제, 최대 5페이지).
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("listUsers failed: " + error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return { id: hit.id };
    if (data.users.length < 200) break;
  }
  return null;
}

const reports: Report[] = [];

for (const acc of ACCOUNTS) {
  // 1. 계정 — 멱등(존재 시 스킵).
  let userId: string;
  let userStatus: Report["user"];
  const existing = await findUserByEmail(acc.email);
  if (existing) {
    userId = existing.id;
    userStatus = "existed";
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
      user_metadata: { role: "pg_review" },
    });
    if (error || !data.user) {
      console.error(`[${acc.email}] createUser failed:`, error?.message);
      process.exit(1);
    }
    userId = data.user.id;
    userStatus = "created";
  }

  // 2. 데모 파트너 — 오너의 파트너가 이미 있으면 스킵(파일럿 연결 금지 — 신규 행만 만든다).
  let partnerId: string;
  let partnerName: string;
  let partnerStatus: Report["partner"];
  const { data: prow, error: pErr } = await admin
    .from("partners")
    .select("id, display_name, verification_status")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (pErr) {
    console.error(`[${acc.email}] partners select failed:`, pErr.message);
    process.exit(1);
  }
  if (prow) {
    partnerId = prow.id;
    partnerName = prow.display_name;
    partnerStatus = "existed";
    if (prow.verification_status !== "approved") {
      const { error: upErr } = await admin
        .from("partners")
        .update({ verification_status: "approved" })
        .eq("id", prow.id);
      if (upErr) {
        console.error(`[${acc.email}] partner approve failed:`, upErr.message);
        process.exit(1);
      }
    }
  } else {
    const { data: created, error: insErr } = await admin
      .from("partners")
      .insert({
        owner_user_id: userId,
        partner_kind: "store",
        display_name: acc.partnerName,
        verification_status: "approved",
        rep_name: "심사용 테스트",
        metadata: { purpose: "pg_review", created_by: "scripts/create-review-accounts.ts" },
      })
      .select("id, display_name")
      .single();
    if (insErr || !created) {
      console.error(`[${acc.email}] partner insert failed:`, insErr?.message);
      process.exit(1);
    }
    partnerId = created.id;
    partnerName = created.display_name;
    partnerStatus = "created";
  }

  // 3a. 가드 RPC 검증.
  const { data: isOwner, error: rpcErr } = await admin.rpc("is_active_partner_owner", {
    _user_id: userId,
  });
  if (rpcErr) {
    console.error(`[${acc.email}] is_active_partner_owner failed:`, rpcErr.message);
    process.exit(1);
  }

  // 3b. 이메일/비번 로그인 검증(publishable key — 실제 로그인 화면과 동일 경로).
  const loginClient = createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signin, error: signErr } = await loginClient.auth.signInWithPassword({
    email: acc.email,
    password: acc.password,
  });
  const loginOk = !signErr && !!signin.session;
  if (loginOk) await loginClient.auth.signOut();

  reports.push({
    email: acc.email,
    user_id: userId,
    user: userStatus,
    partner_id: partnerId,
    partner: partnerStatus,
    partner_name: partnerName,
    is_active_partner_owner: Boolean(isOwner),
    password_login: loginOk ? "ok" : "failed",
  });
}

console.log(JSON.stringify({ ok: true, accounts: reports }, null, 2));
