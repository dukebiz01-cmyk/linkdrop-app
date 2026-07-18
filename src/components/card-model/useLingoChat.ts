// useLingoChat / useLingoVoice — 링고AI 대화 훅 (T5 실배선, 41창 백엔드 계약).
//
// 채팅: POST /api/lingo/chat (쿠키 세션 인증) → SSE(text/event-stream)
//   meta{session_id,stage} 1회 → delta{text} 반복 → done{message_id} / error{code,friendly}.
//   content-type 이 event-stream 이 아니면 JSON {code,friendly} — friendly 를 일반 말풍선으로.
//   session_id 는 meta 에서 받아 보관, 이후 전송에 동봉(화면 이탈 시 리셋 무방 — v1).
//
// 음성 v1: Web Speech API 만(백엔드 무변경) — 반이중(듣기→입력창 확인→전송→낭독→중단).
//   인식 결과는 자동 전송하지 않는다(오인식 방지 — 사용자가 [전송]으로 확인).
//
// LINGO-V2 — 계약 v2 클라 배선(정본 = lingo-chat Edge 소스 실측 — docs 계약 문서 부재 판정):
//   · 요청: context.studio { mode, deck:[{id,label,applied,locked}], fields } 동봉(호출부 몫).
//   · 수신: event:actions {actions:[{type,mode,blockId,field,value}], steps:[{label,note}]}
//     — done 직전 최대 1회. type 4종(switchMode/equip/detach/setField) 외 클라 재가드 제거.
//   · 제안은 확인 게이트 통과 전 상태로만 보관 — 새 send() 시작 시 만료(스테일 적용 금지).
//   · 종료: {action:'close', session_id} 직invoke(verify_jwt·유저 세션 JWT) fire-and-forget
//     1회 — 세션 ref 를 비워 중복 no-op(멱등 서버 + 클라 과호출 방지).

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export type LingoMessage = {
  id: string;
  role: "user" | "lingo";
  text: string;
  streaming?: boolean;
};

// FIX-42 — 개입 강도 게이트(서버 lingo_user_state.stage 정본: guide→assist→standby).
//   meta 이벤트에 이미 실려 오던 값(주석 :4)을 보관·노출만 추가 — 서버·전송 계약 무변경.
export type LingoStage = "guide" | "assist" | "standby";

// LINGO-V2 — 계약 v2 스키마(서버 persona.ts LingoStudioDeckItem/LingoStudioContext 와
//   필드명 문자 단위 동일 — 이탈 금지).
export type LingoStudioDeckItem = {
  id: string;
  label?: string;
  applied?: boolean;
  locked?: boolean;
};
export type LingoStudioSnapshot = {
  mode?: string;
  deck?: LingoStudioDeckItem[];
  fields?: Record<string, string>;
  /** LINGO-HANDS-1 — 선택 가능한 쿠폰 목록(서버는 title 만 프롬프트 주입 — id 해석은 클라). */
  coupons?: { id: string; title: string }[];
};
// 서버 검증 화이트리스트와 동일: type 4종 / mode 3종 / field 11종은 서버가 재검증 —
//   클라는 type 4종만 경량 재가드(그 외 필드는 적용 시점 최종 가드가 판정).
export type LingoStudioAction = {
  // LINGO-HANDS-1 — goToBlock(화면 이동) 추가: type 5종.
  type: "switchMode" | "equip" | "detach" | "setField" | "goToBlock";
  mode?: string;
  blockId?: string;
  field?: string;
  value?: string;
};
export type LingoActionProposal = {
  actions: LingoStudioAction[];
  steps: { label: string; note?: string }[];
};

export type LingoContext = {
  /** 스튜디오 표면 상태. surface='home'(성과 진단)에는 없음 → optional. Edge 는 optional 처리. */
  studio_state?: {
    mode: string;
    applied_blocks: string[];
    score: number;
    card_title: string;
    product_name?: string;
    product_price?: number;
    /** FIX-29 — 현재 타깃 블록 + 전략 코칭(정본 why/effect) — "이거 왜 필요해?"에
     *  화면 안내와 같은 근거로 일관 답변하도록 동봉. */
    current_target?: { block: string; why: string; effect: string };
  };
  video_summary?: string;
  key_points?: string[];
  /** LINGO-V2 — 계약 v2 §1: 실제 덱 스냅샷(전송 시점 실상태). 스튜디오 표면에서만 동봉. */
  studio?: LingoStudioSnapshot;
  /** FIX-48+50 P2 — 계약 v2.1 additive: 번호 인터뷰 상태(interview-steps45 정본). 스튜디오 전용. */
  interview?: LingoInterviewContext;
  /** T-D — 홈 성과 진단 요청 플래그(surface='home' 전용, Edge 가 RPC 집계 주입). additive. */
  performance?: boolean;
};

/** FIX-48+50 P2 — 번호 인터뷰 컨텍스트(스텝퍼와 동일 번호 — 발화 번호 강제 일치용). */
export type LingoInterviewContext = {
  version: string; // "2.1"
  mode: string;
  sales_method?: string; // commerce 전용(quick/full/groupBuy)
  total: number;
  current_no: number | null;
  current_label: string | null;
  steps: {
    no: number;
    label: string;
    done: boolean;
    can_set: boolean; // 대화로 부착 가능(setField) 여부 — false = "직접 해주셔야" 단계
    skippable?: boolean;
    publish?: boolean;
  }[];
};

const FALLBACK_FRIENDLY = "죄송해요, 지금 답을 만들지 못했어요. 잠시 후 다시 물어봐 주세요.";

// LINGO-V2 — 클라 경량 재가드(서버 §5 재검증이 1차 — 여기선 type·8개 상한만).
//   LINGO-HANDS-1 — goToBlock 추가(5종).
const LINGO_ACTION_TYPES = new Set(["switchMode", "equip", "detach", "setField", "goToBlock"]);

// id — 세션 내 유일이면 충분(모듈 카운터, 시계 불요).
let msgSeq = 0;
const nextId = () => `lm-${++msgSeq}`;

function safeJson(raw: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// SSE 블록 1개("\n\n" 경계) → { event, data }. data: 라인 복수면 개행 join(표준 시맨틱).
function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const raw of block.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0 && event === "message") return null;
  return { event, data: dataLines.join("\n") };
}

export function useLingoChat() {
  const [messages, setMessages] = useState<LingoMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  // FIX-42 — meta.stage 수신값(대화 전 = null). 소비처(능동 안내)가 기본값 정책을 정한다.
  const [stage, setStage] = useState<LingoStage | null>(null);
  // LINGO-V2 — 액션 제안(event:actions 수신분). 확인 게이트 통과 전까지만 유효 —
  //   새 send() 시작 시 만료(스테일 액션 적용 금지). 거절([안 할래요]) = clearProposal.
  const [proposal, setProposal] = useState<LingoActionProposal | null>(null);
  const streamingRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => () => acRef.current?.abort(), []);

  // 빈 채팅박스 금지 — 첫 진입 시 시작 제안 1개(이미 대화가 있으면 no-op).
  const seed = useCallback((text: string) => {
    setMessages((prev) => (prev.length > 0 ? prev : [{ id: nextId(), role: "lingo", text }]));
  }, []);

  const stop = useCallback(() => acRef.current?.abort(), []);

  /** 전송 → 스트림 완주 시 최종 답변 텍스트 반환(낭독용), 오류·중지 시 null. */
  const send = useCallback(
    async (
      message: string,
      channel: "text" | "voice",
      context: LingoContext,
      // HOME-LINGO — surface 선택 인자(미지정=서버 기본 'studio'. 홈 박스는 'home' 전달 = T-B/T-D).
      surface?: "studio" | "home",
    ): Promise<string | null> => {
      if (streamingRef.current) return null;
      setProposal(null); // LINGO-V2 — 새 대화 시작 = 미확인 제안 만료(스테일 적용 금지).
      const botId = nextId();
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", text: message },
        { id: botId, role: "lingo", text: "", streaming: true },
      ]);
      streamingRef.current = true;
      setStreaming(true);
      const ac = new AbortController();
      acRef.current = ac;

      const appendBot = (t: string) =>
        setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, text: m.text + t } : m)));
      const finishBot = (finalText?: string) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, text: finalText ?? m.text, streaming: false } : m)),
        );
      // error 이벤트의 friendly — 빨간 스타일 금지: 일반 링고 말풍선 톤으로.
      const pushFriendly = (friendly: string) =>
        setMessages((prev) => [...prev, { id: nextId(), role: "lingo", text: friendly }]);

      const doFetch = (ch: "text" | "voice") =>
        fetch("/api/lingo/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            ...(sessionIdRef.current ? { session_id: sessionIdRef.current } : {}),
            message,
            context,
            input_channel: ch,
            ...(surface ? { surface } : {}),
          }),
        });

      let acc = "";
      let gotDone = false;
      try {
        let res = await doFetch(channel);
        let contentType = res.headers.get("content-type") ?? "";

        // JSON 경로(quota·검증 등) — friendly 를 말풍선으로. 단 voice 채널 미지원(구계약
        // 중계 라우트) 응답이면 text 로 1회 재시도 — 전사 텍스트는 동일하므로 내용 무손실.
        if (!contentType.includes("text/event-stream")) {
          const json = (await res.json().catch(() => null)) as { code?: string; friendly?: string } | null;
          if (channel === "voice" && json?.code === "channel_not_supported") {
            res = await doFetch("text");
            contentType = res.headers.get("content-type") ?? "";
            if (!contentType.includes("text/event-stream")) {
              const retryJson = (await res.json().catch(() => null)) as { friendly?: string } | null;
              finishBot(retryJson?.friendly ?? FALLBACK_FRIENDLY);
              return null;
            }
          } else {
            finishBot(json?.friendly ?? FALLBACK_FRIENDLY);
            return null;
          }
        }

        const reader = res.body?.getReader();
        if (!reader) {
          finishBot(FALLBACK_FRIENDLY);
          return null;
        }
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buf.indexOf("\n\n")) >= 0) {
            const ev = parseSseBlock(buf.slice(0, sep));
            buf = buf.slice(sep + 2);
            if (!ev) continue;
            if (ev.event === "meta") {
              const d = safeJson(ev.data);
              if (typeof d?.session_id === "string") sessionIdRef.current = d.session_id;
              // FIX-42 — stage 보관(guide/assist/standby 외 값은 무시 — 서버 CHECK 동일).
              if (d?.stage === "guide" || d?.stage === "assist" || d?.stage === "standby") {
                setStage(d.stage);
              }
            } else if (ev.event === "delta") {
              const d = safeJson(ev.data);
              if (typeof d?.text === "string" && d.text) {
                acc += d.text;
                appendBot(d.text);
              }
            } else if (ev.event === "actions") {
              // LINGO-V2 — 액션 제안 수신(서버 §5 재검증 통과분). 클라 경량 재가드:
              //   type 4종 외 제거 + 8개 상한. 빈 배열 = 제안 없음(카드 미노출).
              const d = safeJson(ev.data);
              const rawActions = Array.isArray(d?.actions) ? (d.actions as unknown[]) : [];
              const actions: LingoStudioAction[] = [];
              for (const raw of rawActions) {
                if (actions.length >= 8) break;
                if (!raw || typeof raw !== "object") continue;
                const a = raw as LingoStudioAction;
                if (typeof a.type !== "string" || !LINGO_ACTION_TYPES.has(a.type)) continue;
                actions.push(a);
              }
              const rawSteps = Array.isArray(d?.steps) ? (d.steps as unknown[]) : [];
              const steps = rawSteps
                .filter(
                  (s): s is { label: string; note?: unknown } =>
                    !!s &&
                    typeof s === "object" &&
                    typeof (s as { label?: unknown }).label === "string",
                )
                .slice(0, 5)
                .map((s) => ({
                  label: s.label,
                  ...(typeof s.note === "string" && s.note ? { note: s.note } : {}),
                }));
              if (actions.length > 0) {
                setProposal({ actions, steps });
              } else {
                // LINGO-V2b A1(클라 커버분) — actions 이벤트는 실존하는데 파싱(safeJson null)·
                //   재가드로 전량 소실: 정직 안내 1줄. 서버는 빈 actions 를 미전송하므로
                //   이 분기 = 클라 측 소실 확정(텍스트 해석 기반 판정 아님 — 진실경계).
                setMessages((prev) => [
                  ...prev,
                  {
                    id: nextId(),
                    role: "lingo",
                    text: "제안을 불러오지 못했어요. 다시 한번 말씀해 주시면 새로 준비할게요",
                  },
                ]);
              }
            } else if (ev.event === "done") {
              gotDone = true;
              // LINGO-V2b A1 스텁 — 서버 done 프레임에 actions_sent 플래그 합의(41창 회신) 후:
              //   actions_sent=true 인데 proposal 미수신(이벤트 자체 유실)이면 위와 동일한
              //   정직 안내를 배선 예정. 현재는 이벤트 실존 케이스만 커버(추측 판정 금지).
            } else if (ev.event === "error") {
              const friendly =
                (safeJson(ev.data)?.friendly as string | undefined) ?? FALLBACK_FRIENDLY;
              if (acc) {
                finishBot();
                pushFriendly(friendly);
              } else {
                finishBot(friendly);
              }
              return null;
            }
          }
        }
        finishBot(acc || FALLBACK_FRIENDLY);
        return gotDone && acc ? acc : null;
      } catch {
        // 중지(abort) 또는 네트워크 — 부분 텍스트는 보존, 제작 흐름은 차단하지 않는다.
        finishBot(
          acc ||
            (ac.signal.aborted
              ? "여기서 멈췄어요. 이어서 물어봐 주세요."
              : "네트워크가 불안정해요. 잠시 후 다시 물어봐 주세요."),
        );
        return null;
      } finally {
        streamingRef.current = false;
        setStreaming(false);
        if (acRef.current === ac) acRef.current = null;
      }
    },
    [],
  );

  // LINGO-V2 — 제안 소거([안 할래요]·적용 후). 거절 시 재제안 금지는 서버 몫(§13) —
  //   클라는 조용히 닫기만(재요청·재해석 없음).
  const clearProposal = useCallback(() => setProposal(null), []);

  // LINGO-V2 — 로컬 안내 말풍선(서버 왕복 0): 적용 결과 요약·정직 안내 전용.
  //   §13 재작성 아님 — 호출부가 실적용 값만 담는다(제안 발화는 delta 그대로 유지).
  const notify = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), role: "lingo", text }]);
  }, []);

  // LINGO-V2 — 종료(장기기억 트리거): {action:'close', session_id} 를 lingo-chat Edge 에
  //   직invoke(verify_jwt — 유저 세션 JWT 자동 첨부, FIX-44 실측 패턴). fire-and-forget.
  //   중계 라우트(/api/lingo/chat)는 message 필수라 close 를 통과 못 시킴 — 직호출이 유일 경로
  //   (서버·라우트 무수정 제약). 세션 ref 를 먼저 비워 재호출 no-op(과호출 금지) +
  //   다음 대화는 새 세션(closed 세션 재사용 방지).
  const close = useCallback(() => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    sessionIdRef.current = null;
    try {
      void getSupabase()
        .functions.invoke("lingo-chat", { body: { action: "close", session_id: sid } })
        .catch(() => {});
    } catch {
      // 미설정 환경(getSupabase throw) — 종료는 조용히 생략.
    }
  }, []);

  return { messages, streaming, stage, proposal, seed, send, stop, clearProposal, notify, close };
}

// ── 음성 반이중 v1 — Web Speech API (지원 감지, 미지원 시 정직 안내) ──────────────

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult:
    | ((e: {
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
      }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  /** FIX-43 — 우아한 종료([말 끝났어요]): 지금까지 발화의 최종 결과를 확정한 뒤 onend. */
  stop: () => void;
  abort: () => void;
};

function getRecognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const TTS_STORAGE_KEY = "sl-lingo-tts";

export function useLingoVoice() {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // 낭독 기본 on, 세션 기억(sessionStorage).
  const [ttsOn, setTtsOn] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.sessionStorage.getItem(TTS_STORAGE_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const recRef = useRef<RecognitionLike | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  const stopSpeaking = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // 미지원 브라우저 — 무시(텍스트 모드 유지).
    }
    setSpeaking(false);
  }, []);

  const stopListening = useCallback(() => {
    recRef.current?.abort();
    recRef.current = null;
    setListening(false);
  }, []);

  // FIX-43 — [말 끝났어요]: abort(폐기)가 아닌 stop(확정) — 최종 결과가 onresult 로 들어온 뒤
  //   onend 가 listening 을 내린다. stop 미지원 구현체 폴백 = 기존 abort.
  const finishListening = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      rec.abort();
      recRef.current = null;
      setListening(false);
    }
  }, []);

  useEffect(
    () => () => {
      recRef.current?.abort();
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // ignore
      }
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  /** 마이크 시작 — 결과는 입력창에 채우기만(자동 전송 금지, 사용자가 [전송]으로 확인).
   *  FIX-43 — opts.onInterim(선택): 실시간 인식 텍스트 스트림(파형 패널 표시용). 미주입이면
   *  interimResults=false 기존 경로 그대로(동작 무변경 — 반이중 계약 유지). */
  const startListening = useCallback(
    (onText: (t: string) => void, opts?: { onInterim?: (t: string) => void }) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) {
        showNotice("음성 대화는 크롬·삼성인터넷에서 쓸 수 있어요");
        return;
      }
      try {
        const rec = new Ctor();
        rec.lang = "ko-KR";
        rec.continuous = false;
        rec.interimResults = !!opts?.onInterim;
        rec.maxAlternatives = 1;
        rec.onresult = (e) => {
          if (!opts?.onInterim) {
            // 기존 경로(최종 1건만) — 무변경.
            const t = e.results[0]?.[0]?.transcript?.trim() ?? "";
            if (t) onText(t);
            return;
          }
          // FIX-43 — interim 경로: 중간 결과는 표시 콜백으로만, 입력창 반영(onText)은 최종만.
          let finalT = "";
          let interimT = "";
          for (let i = 0; i < e.results.length; i++) {
            const r = e.results[i];
            const t = r[0]?.transcript ?? "";
            if (r.isFinal) finalT += t;
            else interimT += t;
          }
          const merged = `${finalT} ${interimT}`.trim();
          if (merged) opts.onInterim(merged);
          if (finalT.trim()) onText(finalT.trim());
        };
        rec.onerror = () => {
          // 조용한 폴백 — 텍스트 모드 유지 + 안내 1줄.
          showNotice("음성 인식이 잘 안 됐어요 — 글로 입력해 주세요");
        };
        rec.onend = () => {
          recRef.current = null;
          setListening(false);
        };
        recRef.current = rec;
        setListening(true);
        rec.start();
      } catch {
        recRef.current = null;
        setListening(false);
        showNotice("음성 인식이 잘 안 됐어요 — 글로 입력해 주세요");
      }
    },
    [showNotice],
  );

  /** done 후 링고 응답 낭독(ko-KR). 실패는 조용히 무시 — 텍스트는 이미 화면에 있음.
   *  FIX-48 — onDone additive: 낭독 종료(성공·오류·TTS off 즉시) 콜백 — 대화 모드 재청취
   *  트리거(에코 차단: 낭독이 끝난 뒤에만 호출됨). 기존 호출부(1인자) 동작 무변경. */
  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      if (!ttsOn || typeof window === "undefined" || !window.speechSynthesis) {
        onDone?.();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "ko-KR";
        u.onstart = () => setSpeaking(true);
        u.onend = () => {
          setSpeaking(false);
          onDone?.();
        };
        u.onerror = () => {
          setSpeaking(false);
          onDone?.();
        };
        window.speechSynthesis.speak(u);
      } catch {
        setSpeaking(false);
        onDone?.();
      }
    },
    [ttsOn],
  );

  const toggleTts = useCallback(() => {
    setTtsOn((prev) => {
      const next = !prev;
      try {
        window.sessionStorage.setItem(TTS_STORAGE_KEY, next ? "on" : "off");
      } catch {
        // ignore
      }
      if (!next) stopSpeaking();
      return next;
    });
  }, [stopSpeaking]);

  return {
    listening,
    speaking,
    notice,
    ttsOn,
    startListening,
    stopListening,
    finishListening,
    speak,
    stopSpeaking,
    toggleTts,
  };
}
