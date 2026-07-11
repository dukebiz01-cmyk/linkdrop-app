// useLingoChat / useLingoVoice — 링고AI 대화 훅 (T5 실배선, 41창 백엔드 계약).
//
// 채팅: POST /api/lingo/chat (쿠키 세션 인증) → SSE(text/event-stream)
//   meta{session_id,stage} 1회 → delta{text} 반복 → done{message_id} / error{code,friendly}.
//   content-type 이 event-stream 이 아니면 JSON {code,friendly} — friendly 를 일반 말풍선으로.
//   session_id 는 meta 에서 받아 보관, 이후 전송에 동봉(화면 이탈 시 리셋 무방 — v1).
//
// 음성 v1: Web Speech API 만(백엔드 무변경) — 반이중(듣기→입력창 확인→전송→낭독→중단).
//   인식 결과는 자동 전송하지 않는다(오인식 방지 — 사용자가 [전송]으로 확인).

import { useCallback, useEffect, useRef, useState } from "react";

export type LingoMessage = {
  id: string;
  role: "user" | "lingo";
  text: string;
  streaming?: boolean;
};

export type LingoContext = {
  studio_state: {
    mode: string;
    applied_blocks: string[];
    score: number;
    card_title: string;
    product_name?: string;
    product_price?: number;
  };
  video_summary?: string;
  key_points?: string[];
};

const FALLBACK_FRIENDLY = "죄송해요, 지금 답을 만들지 못했어요. 잠시 후 다시 물어봐 주세요.";

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
    async (message: string, channel: "text" | "voice", context: LingoContext): Promise<string | null> => {
      if (streamingRef.current) return null;
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
            } else if (ev.event === "delta") {
              const d = safeJson(ev.data);
              if (typeof d?.text === "string" && d.text) {
                acc += d.text;
                appendBot(d.text);
              }
            } else if (ev.event === "done") {
              gotDone = true;
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

  return { messages, streaming, seed, send, stop };
}

// ── 음성 반이중 v1 — Web Speech API (지원 감지, 미지원 시 정직 안내) ──────────────

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
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

  /** 마이크 시작 — 결과는 입력창에 채우기만(자동 전송 금지, 사용자가 [전송]으로 확인). */
  const startListening = useCallback(
    (onText: (t: string) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) {
        showNotice("음성 대화는 크롬·삼성인터넷에서 쓸 수 있어요");
        return;
      }
      try {
        const rec = new Ctor();
        rec.lang = "ko-KR";
        rec.continuous = false;
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.onresult = (e) => {
          const t = e.results[0]?.[0]?.transcript?.trim() ?? "";
          if (t) onText(t);
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

  /** done 후 링고 응답 낭독(ko-KR). 실패는 조용히 무시 — 텍스트는 이미 화면에 있음. */
  const speak = useCallback(
    (text: string) => {
      if (!ttsOn || typeof window === "undefined" || !window.speechSynthesis) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "ko-KR";
        u.onstart = () => setSpeaking(true);
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(u);
      } catch {
        setSpeaking(false);
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

  return { listening, speaking, notice, ttsOn, startListening, stopListening, speak, stopSpeaking, toggleTts };
}
