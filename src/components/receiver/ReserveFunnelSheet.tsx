import { useEffect, useState } from "react";
import { Calendar, Users, Phone, User, MessageSquare, CheckCircle2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getSupabase } from "@/lib/supabase";

/**
 * 직접예약 (인앱 예약 신청) 시트 — A안. 네이버로 내보내지 않고 /d 안에서 예약 *신청*.
 * 신청 = 리드 캡처(확정·결제·정산 없음). 쿠폰과 분리(claim_coupon 호출 안 함).
 *
 * 흐름 (4 step):
 *   1. form  — (캘린더에서 prefill된) 날짜·인원 + 이름·전화·메시지
 *   2. submitting — upsert_visitor → create_reservation_anon
 *   3. done  — "예약 신청이 접수되었어요" (확정 아님 — 매장 확인 후 연락)
 *   4. error — 에러 화면 (재시도). 23505=이미 진행 중인 예약 안내.
 *
 * 인자:
 *   - shareUuid: 현재 share_event 의 share_uuid (share_events.id 조회용)
 *   - dropId: info_drops.id
 *   - userId: 로그인한 catcher_user_id (A안 로그인 강제)
 *   - initialCheckIn/Out/GuestCount: 캘린더 선택값 prefill (이중입력 방지, 수정 가능)
 *
 * RPC:
 *   - create_reservation_anon(SECURITY DEFINER): reservations INSERT + reservation_contacts
 *     + reservation_notifications + slot current_bookings +1 (소프트홀드). partner_id 는
 *     info_drops 에서 자동 추출. reward 미발생(gross=0).
 */

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUuid: string;
  dropId: string;
  userId: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuestCount?: number;
};

type Step = "form" | "submitting" | "done" | "error";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

export function ReserveFunnelSheet({
  open,
  onOpenChange,
  shareUuid,
  dropId,
  userId,
  initialCheckIn,
  initialCheckOut,
  initialGuestCount,
}: Props) {
  const [step, setStep] = useState<Step>("form");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestCount, setGuestCount] = useState("2");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("form");
      setErrorMsg(null);
      // 캘린더 선택값 prefill (이중입력 방지). 연락처(이름/전화/메시지)는 매 오픈 초기화.
      setCheckIn(initialCheckIn ?? "");
      setCheckOut(initialCheckOut ?? "");
      setGuestCount(initialGuestCount ? String(initialGuestCount) : "2");
      setName("");
      setPhone("");
      setMessage("");
    }
  }, [open, initialCheckIn, initialCheckOut, initialGuestCount]);

  const isMultiNight = checkOut.length > 0 && checkOut !== checkIn;

  function validate(): string | null {
    if (!checkIn) return "체크인 날짜를 선택해 주세요.";
    if (checkOut && checkOut < checkIn) return "체크아웃이 체크인보다 빠를 수 없어요.";
    const gc = Number(guestCount);
    if (!Number.isFinite(gc) || gc < 1) return "인원을 정확히 입력해 주세요.";
    if (!name.trim()) return "이름을 입력해 주세요.";
    const phoneDigits = normalizePhone(phone);
    if (phoneDigits.length < 9 || phoneDigits.length > 11) return "전화번호를 정확히 입력해 주세요.";
    return null;
  }

  async function handleSubmit() {
    // RSV-DUP-FIX (A-2): 이미 제출 중/완료/에러면 무시 — 연속 탭 차단(이서라 케이스)
    if (step !== "form") return;
    const v = validate();
    if (v) {
      setErrorMsg(v);
      return;
    }
    setErrorMsg(null);
    setStep("submitting");
    try {
      const supabase = getSupabase();
      const phoneDigits = normalizePhone(phone);
      const phoneHash = await sha256Hex(phoneDigits);
      const phoneLast4 = phoneDigits.slice(-4);
      // RSV-FIX1 — 안정적 anonymous_id (E2 이벤트 추적과 같은 localStorage 키 재사용).
      // visitors row 사전 생성 없이 random UUID 를 그대로 p_visitor_id 로 보내면
      // reservations.visitor_id_fkey → visitors(id) FK 위반으로 INSERT 실패.
      let anonId: string;
      try {
        anonId = localStorage.getItem("ld_visitor_id") ?? "";
        if (!anonId) {
          anonId = crypto.randomUUID();
          localStorage.setItem("ld_visitor_id", anonId);
        }
      } catch {
        anonId = crypto.randomUUID(); // 시크릿 모드 등 localStorage 차단 → 메모리 fallback
      }
      // RSV-FIX2 — 캠핑 파일럿: 단일·연박 모두 날짜 범위로 통일.
      // 제약 reservations_calendar_mode_check = ANY (ARRAY['date_range','date_time_slot']).
      // 이전엔 짧은 별명 "range"/"single" 을 보내 23514 위반 → INSERT 실패.
      // date_time_slot 은 시간 슬롯 예약(식당/미용실)용 — 캠핑은 p_time_slot 미사용.
      const calendarMode = "date_range";

      // share_uuid → share_events.id (RLS: shares_public_read_by_uuid 로 anon 가능).
      const { data: se, error: seErr } = await supabase
        .from("share_events")
        .select("id")
        .eq("share_uuid", shareUuid)
        .maybeSingle();
      if (seErr || !se?.id) {
        console.error("[ReserveFunnel] share_event lookup failed:", seErr);
        setErrorMsg("공유 정보를 찾을 수 없어요. 다시 시도해 주세요.");
        setStep("error");
        return;
      }
      const shareEventId = se.id;

      // RSV-FIX1 — visitors row 사전 생성 (FK 충족용). upsert_visitor 가 같은
      // anonymous_id 면 기존 행 반환 + last_seen_at 갱신.
      const { data: visitorUuid, error: vErr } = await supabase.rpc("upsert_visitor", {
        p_anonymous_id: anonId,
        p_metadata: {},
      });
      if (vErr || !visitorUuid) {
        console.error("[ReserveFunnel] upsert_visitor failed:", vErr);
        setErrorMsg("예약 문의 전송에 실패했어요. 잠시 후 다시 시도해 주세요.");
        setStep("error");
        return;
      }

      const { error: resErr } = await supabase.rpc("create_reservation_anon", {
        p_drop_id: dropId,
        p_share_event_id: shareEventId,
        p_visitor_id: visitorUuid,
        p_calendar_mode: calendarMode,
        p_reserved_date: isMultiNight ? null : checkIn,
        p_time_slot: null,
        p_check_in_date: checkIn,
        p_check_out_date: isMultiNight ? checkOut : null,
        p_guest_count: Number(guestCount),
        p_name: name.trim(),
        p_phone_hash: phoneHash,
        p_phone_last4: phoneLast4,
        p_customer_message: message.trim() || null,
        // A안 로그인 강제 — catcher_user_id 로 uq_reservations_active_catcher
        //   (drop당 1인 1활성예약) abuse 방어. RPC 가 DEFAULT NULL 이라 안전.
        p_catcher_user_id: userId ?? null,
      });
      if (resErr) {
        console.error("[ReserveFunnel] create_reservation_anon failed:", resErr);
        // A4-2 — partial UNIQUE(uq_reservations_active_catcher) 위반 시 정직 안내.
        // 같은 catcher 가 같은 drop 에 활성(pending/confirmed) 예약을 이미 가짐 →
        // "실패" 가 아니라 "이미 진행 중" 으로 사실대로.
        const errCode = (resErr as { code?: string } | null)?.code;
        const errMsg = (resErr as { message?: string } | null)?.message ?? "";
        const isCatcherDup =
          errCode === "23505" || errMsg.includes("uq_reservations_active_catcher");
        setErrorMsg(
          isCatcherDup
            ? "이미 진행 중인 예약이 있어요. 예약 내역을 확인해 주세요."
            : "예약 문의 전송에 실패했어요. 잠시 후 다시 시도해 주세요.",
        );
        setStep("error");
        return;
      }

      // 쿠폰과 분리(디커플링) — 예약 신청은 claim_coupon 호출 안 함. 리드 캡처까지만.
      setStep("done");
    } catch (e) {
      console.error("[ReserveFunnel] unexpected:", e);
      setErrorMsg("처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
      setStep("error");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 pt-6 tracking-ko">
        {step === "form" ? (
          <FormBody
            checkIn={checkIn}
            setCheckIn={setCheckIn}
            checkOut={checkOut}
            setCheckOut={setCheckOut}
            guestCount={guestCount}
            setGuestCount={setGuestCount}
            name={name}
            setName={setName}
            phone={phone}
            setPhone={setPhone}
            message={message}
            setMessage={setMessage}
            errorMsg={errorMsg}
            step={step}
            onSubmit={handleSubmit}
          />
        ) : step === "submitting" ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <span
              className="size-8 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#0A0A0A]"
              aria-hidden
            />
            <p className="text-sm font-semibold text-[#0F172A]">예약 신청을 보내고 있어요…</p>
          </div>
        ) : step === "done" ? (
          <DoneBody onClose={() => onOpenChange(false)} />
        ) : (
          <ErrorBody errorMsg={errorMsg} onRetry={() => setStep("form")} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-[#0F172A]">
      {children}
    </label>
  );
}

function FormBody(props: {
  checkIn: string;
  setCheckIn: (v: string) => void;
  checkOut: string;
  setCheckOut: (v: string) => void;
  guestCount: string;
  setGuestCount: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  errorMsg: string | null;
  step: Step;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-bold text-[#0F172A]">예약 신청하기</h2>
        <p className="mt-1 text-sm text-[#64748B]">
          신청을 보내면 매장에서 확인 후 카톡으로 연락드려요.
          <br />
          신청만으로는 예약이 확정되지 않아요.
        </p>
      </header>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div>
          <Label htmlFor="check-in">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-4 text-[#94A3B8]" strokeWidth={2} />
              체크인
            </span>
          </Label>
          <input
            id="check-in"
            type="date"
            value={props.checkIn}
            onChange={(e) => props.setCheckIn(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#0F172A] focus:border-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20"
          />
        </div>

        <div>
          <Label htmlFor="check-out">체크아웃 (연박이면 입력)</Label>
          <input
            id="check-out"
            type="date"
            value={props.checkOut}
            onChange={(e) => props.setCheckOut(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#0F172A] focus:border-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20"
          />
        </div>

        <div>
          <Label htmlFor="guest-count">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4 text-[#94A3B8]" strokeWidth={2} />
              인원
            </span>
          </Label>
          <input
            id="guest-count"
            type="number"
            inputMode="numeric"
            min={1}
            value={props.guestCount}
            onChange={(e) => props.setGuestCount(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#0F172A] focus:border-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20"
          />
        </div>

        <div>
          <Label htmlFor="reservation-name">
            <span className="inline-flex items-center gap-1.5">
              <User className="size-4 text-[#94A3B8]" strokeWidth={2} />
              이름
            </span>
          </Label>
          <input
            id="reservation-name"
            type="text"
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
            placeholder="예: 홍길동"
            className="mt-1 h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#0F172A] focus:border-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20"
          />
        </div>

        <div>
          <Label htmlFor="reservation-phone">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-4 text-[#94A3B8]" strokeWidth={2} />
              전화번호
            </span>
          </Label>
          <input
            id="reservation-phone"
            type="tel"
            inputMode="numeric"
            value={props.phone}
            onChange={(e) => props.setPhone(e.target.value)}
            placeholder="예: 010-1234-5678"
            className="mt-1 h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#0F172A] focus:border-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20"
          />
        </div>

        <div>
          <Label htmlFor="reservation-message">
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="size-4 text-[#94A3B8]" strokeWidth={2} />
              남기실 말 (선택)
            </span>
          </Label>
          <textarea
            id="reservation-message"
            value={props.message}
            onChange={(e) => props.setMessage(e.target.value)}
            rows={3}
            placeholder="문의사항을 남겨주세요"
            className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#0F172A] focus:border-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20"
          />
        </div>
      </div>

      {props.errorMsg ? (
        <p className="text-sm font-medium text-[#EF4444]">{props.errorMsg}</p>
      ) : null}

      <button
        type="button"
        onClick={props.onSubmit}
        disabled={props.step !== "form"}
        className="flex w-full min-h-[48px] items-center justify-center rounded-2xl bg-[#0A0A0A] px-6 py-3 text-base font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {props.step === "submitting" ? "보내는 중…" : "예약 신청 보내기"}
      </button>
    </div>
  );
}

function DoneBody({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-5 pt-2">
      <div className="flex justify-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-[#ECFDF5]">
          <CheckCircle2 className="size-7 text-[#059669]" strokeWidth={2} />
        </span>
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold text-[#0F172A]">예약 신청이 접수되었어요</h2>
        <p className="mt-2 text-sm text-[#475569]">매장에서 확인 후 연락드려요.</p>
        <p className="mt-1 text-xs text-[#94A3B8]">신청만으로는 예약이 확정되지 않아요.</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex w-full min-h-[48px] items-center justify-center rounded-2xl bg-[#0A0A0A] px-6 py-3 text-base font-bold text-white"
      >
        확인
      </button>
    </div>
  );
}

function ErrorBody({ errorMsg, onRetry }: { errorMsg: string | null; onRetry: () => void }) {
  return (
    <div className="space-y-4 py-6 text-center">
      <h2 className="text-lg font-bold text-[#0F172A]">처리에 실패했어요</h2>
      <p className="text-sm text-[#475569]">
        {errorMsg ?? "잠시 후 다시 시도해 주세요."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="flex w-full min-h-[48px] items-center justify-center rounded-2xl bg-[#0A0A0A] px-6 py-3 text-base font-bold text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
